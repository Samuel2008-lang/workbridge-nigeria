-- Harden signup trigger so auth.signUp never fails because of profile side-effects.
-- This project uses public.profiles (not public.users) as the user profile table.

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
    -- Only accept known enum values
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
    -- Never block auth user creation
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
    -- user_settings may not exist on older DBs
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
