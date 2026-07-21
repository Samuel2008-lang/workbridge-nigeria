-- =============================================================================
-- WorkBridge — paste this ENTIRE file into Supabase Dashboard → SQL Editor → Run
-- Project: ozclkkblbiovgsddxpde
--
-- WHY: When someone signs up, Supabase Auth creates a row in auth.users.
--      A trigger must then create their profile/wallet. If that trigger fails
--      (wrong table name, missing columns, bad enum cast), signup fails with
--      a confusing error in the app.
--
-- NOTE: This app uses public.profiles (NOT public.users). Do not create a
--       separate users table for this — the app reads/writes profiles.
-- =============================================================================

-- 1) Preferred mode enum (worker | client) — safe if already exists
DO $$ BEGIN
  CREATE TYPE public.preferred_mode AS ENUM ('worker', 'client');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Extra profile columns used by the app
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_interests TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_mode public.preferred_mode DEFAULT 'worker';

UPDATE public.profiles
SET preferred_mode = CASE
  WHEN role = 'client' THEN 'client'::public.preferred_mode
  ELSE 'worker'::public.preferred_mode
END
WHERE preferred_mode IS NULL;

-- 3) Settings table (toggles) — safe if already exists
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  sms_notifications BOOLEAN NOT NULL DEFAULT false,
  show_distance BOOLEAN NOT NULL DEFAULT true,
  dark_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own settings" ON public.user_settings;
CREATE POLICY "Users view own settings" ON public.user_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own settings" ON public.user_settings;
CREATE POLICY "Users insert own settings" ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own settings" ON public.user_settings;
CREATE POLICY "Users update own settings" ON public.user_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) THE IMPORTANT PART: signup trigger
--    After Auth creates a user → create profile + wallet + settings.
--    Errors are swallowed so a profile glitch never blocks signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
  v_mode public.preferred_mode;
  v_interests TEXT[] := '{}';
BEGIN
  BEGIN
    v_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '')
    );

    v_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
    IF v_role = 'poster' THEN
      v_role := 'client';
    END IF;
    IF v_role IS DISTINCT FROM 'worker' AND v_role IS DISTINCT FROM 'client' THEN
      v_role := NULL;
    END IF;

    v_mode := CASE
      WHEN v_role = 'client' THEN 'client'::public.preferred_mode
      WHEN NEW.raw_user_meta_data->>'preferred_mode' = 'client' THEN 'client'::public.preferred_mode
      ELSE 'worker'::public.preferred_mode
    END;

    BEGIN
      IF jsonb_typeof(NEW.raw_user_meta_data->'job_interests') = 'array' THEN
        SELECT COALESCE(array_agg(x), '{}')
          INTO v_interests
        FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'job_interests') AS t(x);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_interests := '{}';
    END;

    INSERT INTO public.profiles (
      id,
      full_name,
      phone_number,
      role,
      location,
      language,
      job_interests,
      preferred_mode
    ) VALUES (
      NEW.id,
      v_name,
      NEW.raw_user_meta_data->>'phone',
      NULLIF(v_role, '')::public.user_role,
      NEW.raw_user_meta_data->>'city',
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'language', ''), 'English'),
      COALESCE(v_interests, '{}'),
      v_mode
    )
    ON CONFLICT (id) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.wallets (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user wallet insert failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5) Sanity check (optional — should return one row with the trigger name)
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
