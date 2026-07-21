-- WorkBridge: profile fields for dual-role accounts, job interests, and user settings.
-- Extends public.profiles (the app's user profile table — not a separate users table).

-- Preferred mode: worker | client (one account, both roles)
DO $$ BEGIN
  CREATE TYPE public.preferred_mode AS ENUM ('worker', 'client');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_interests TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_mode public.preferred_mode DEFAULT 'worker';

-- Backfill preferred_mode from legacy role when present
UPDATE public.profiles
SET preferred_mode = CASE
  WHEN role = 'client' THEN 'client'::public.preferred_mode
  ELSE 'worker'::public.preferred_mode
END
WHERE preferred_mode IS NULL;

-- user_settings (persistent toggles; no radius slider)
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

DROP TRIGGER IF EXISTS trg_user_settings_updated ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure profiles UPDATE policy allows new columns (policy already exists for own row)
-- Recreate SELECT/UPDATE policies if missing (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users update own profile'
  ) THEN
    CREATE POLICY "Users update own profile" ON public.profiles
      FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Signup trigger: save full_name (prefer full_name meta, else first_name), interests, preferred_mode
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
  v_mode public.preferred_mode;
  v_interests TEXT[];
BEGIN
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '')
  );
  v_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
  -- Map poster → client for enum compatibility
  IF v_role = 'poster' THEN v_role := 'client'; END IF;
  v_mode := CASE
    WHEN v_role = 'client' THEN 'client'::public.preferred_mode
    WHEN NEW.raw_user_meta_data->>'preferred_mode' = 'client' THEN 'client'::public.preferred_mode
    ELSE 'worker'::public.preferred_mode
  END;

  BEGIN
    v_interests := ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data->'job_interests', '[]'::jsonb))
    );
  EXCEPTION WHEN OTHERS THEN
    v_interests := '{}';
  END;

  INSERT INTO public.profiles (
    id, full_name, phone_number, role, location, language, job_interests, preferred_mode
  ) VALUES (
    NEW.id,
    v_name,
    NEW.raw_user_meta_data->>'phone',
    NULLIF(v_role, '')::public.user_role,
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'language',
    COALESCE(v_interests, '{}'),
    v_mode
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
    location = COALESCE(EXCLUDED.location, public.profiles.location),
    language = COALESCE(EXCLUDED.language, public.profiles.language),
    job_interests = CASE
      WHEN EXCLUDED.job_interests IS NOT NULL AND array_length(EXCLUDED.job_interests, 1) > 0
      THEN EXCLUDED.job_interests
      ELSE public.profiles.job_interests
    END,
    preferred_mode = COALESCE(EXCLUDED.preferred_mode, public.profiles.preferred_mode);

  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Public read of open jobs for authenticated users already exists; ensure anon can browse feed if needed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Open jobs viewable by anyone'
  ) THEN
    CREATE POLICY "Open jobs viewable by anyone" ON public.jobs
      FOR SELECT TO anon, authenticated
      USING (status = 'open' OR client_id = auth.uid() OR hired_worker_id = auth.uid());
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
