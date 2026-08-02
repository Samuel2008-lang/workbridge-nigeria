-- =============================================================================
-- WorkBridge — full schema bootstrap for a FRESH Supabase project
-- Idempotent where possible. Safe to re-run on empty or partial DBs.
-- Free-tier friendly: pg_cron is optional and skipped if unavailable.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('worker', 'client'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_type AS ENUM ('digital', 'physical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_status AS ENUM ('open', 'assigned', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.application_status AS ENUM ('pending', 'accepted', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.transaction_type AS ENUM ('escrow', 'release', 'withdrawal', 'deposit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.escrow_status AS ENUM ('none','locked','released','frozen','disputed','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dispute_status AS ENUM ('open','under_review','resolved_worker','resolved_client','resolved_split','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.review_status AS ENUM ('pending','published','held','removed','disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.cash_request_status AS ENUM ('pending','accepted','declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.onboarding_type AS ENUM ('worker_prejob','client_onboarding'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.preferred_mode AS ENUM ('worker', 'client'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'hired','job_completed','payment_released','payment_available',
    'new_message','dispute_raised','dispute_resolved','review_received',
    'review_under_review','badge_unlocked','application_received',
    'confirm_reminder','auto_confirmed','job_closed','hire_expired',
    'cash_agreed','cash_declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add enum values that may be missing on older partial DBs
DO $$ BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'cash_agreed'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'cash_declined'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dispute_resolved'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) = 'hopeegbon28@gmail.com'
  )
  OR public.has_role(auth.uid(), 'admin');
$$;

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  role public.user_role,
  location TEXT,
  language TEXT,
  profile_photo TEXT,
  cash_transaction_count INT NOT NULL DEFAULT 0,
  client_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  worker_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  job_interests TEXT[] NOT NULL DEFAULT '{}',
  preferred_mode public.preferred_mode DEFAULT 'worker',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cash_transaction_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS worker_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_interests TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_mode public.preferred_mode DEFAULT 'worker';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  frozen_balance    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (frozen_balance >= 0),
  pin_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type public.job_type NOT NULL,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  budget_min NUMERIC(12,2),
  budget_max NUMERIC(12,2),
  status public.job_status NOT NULL DEFAULT 'open',
  hired_worker_id UUID REFERENCES auth.users(id),
  agreed_amount NUMERIC(14,2),
  escrow_status public.escrow_status NOT NULL DEFAULT 'none',
  hired_at TIMESTAMPTZ,
  hire_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  confirm_deadline TIMESTAMPTZ,
  frozen_until TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  commission_amount NUMERIC(14,2),
  payment_mode TEXT NOT NULL DEFAULT 'wallet' CHECK (payment_mode IN ('wallet','cash')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS hired_worker_id UUID REFERENCES auth.users(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(14,2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS escrow_status public.escrow_status NOT NULL DEFAULT 'none';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS hire_expires_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS confirm_deadline TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(14,2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'wallet';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'pending',
  proposed_price NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, worker_id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  type public.transaction_type NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  description TEXT,
  balance_bucket TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS balance_bucket TEXT;

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status public.review_status NOT NULL DEFAULT 'published',
  response TEXT,
  investigation_note TEXT,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, rater_id, rated_user_id)
);
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS status public.review_status NOT NULL DEFAULT 'published';
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS investigation_note TEXT;
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  media_url TEXT,
  media_type TEXT,
  duration_seconds INT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS duration_seconds INT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  description TEXT,
  status public.dispute_status NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  resolution TEXT,
  worker_amount NUMERIC(14,2),
  client_amount NUMERIC(14,2),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolved_by UUID;

CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  media_url TEXT,
  media_type TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cash_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status public.cash_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.onboarding_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.onboarding_type NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, job_id)
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_jobs_client ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_hired_worker ON public.jobs(hired_worker_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_worker ON public.applications(worker_id);
CREATE INDEX IF NOT EXISTS idx_messages_job ON public.messages(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_participants ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(sender_id, receiver_id);

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
GRANT SELECT, INSERT ON public.dispute_evidence TO authenticated;
GRANT ALL ON public.dispute_evidence TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.cash_payment_requests TO authenticated;
GRANT ALL ON public.cash_payment_requests TO service_role;
GRANT SELECT, INSERT ON public.onboarding_acknowledgements TO authenticated;
GRANT ALL ON public.onboarding_acknowledgements TO service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_acknowledgements ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users delete own profile" ON public.profiles;
CREATE POLICY "Users delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "admin reads all profiles" ON public.profiles;
CREATE POLICY "admin reads all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_platform_admin());

-- user_roles
DROP POLICY IF EXISTS "view own roles" ON public.user_roles;
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- wallets
DROP POLICY IF EXISTS "view own wallet" ON public.wallets;
CREATE POLICY "view own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.is_platform_admin());
DROP POLICY IF EXISTS "update own wallet pin" ON public.wallets;
CREATE POLICY "update own wallet pin" ON public.wallets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert own wallet" ON public.wallets;
CREATE POLICY "insert own wallet" ON public.wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin reads all wallets" ON public.wallets;
CREATE POLICY "admin reads all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.is_platform_admin());

-- user_settings
DROP POLICY IF EXISTS "Users view own settings" ON public.user_settings;
CREATE POLICY "Users view own settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own settings" ON public.user_settings;
CREATE POLICY "Users insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own settings" ON public.user_settings;
CREATE POLICY "Users update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- jobs
DROP POLICY IF EXISTS "Jobs viewable by authenticated" ON public.jobs;
CREATE POLICY "Jobs viewable by authenticated" ON public.jobs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Open jobs viewable by anyone" ON public.jobs;
CREATE POLICY "Open jobs viewable by anyone" ON public.jobs FOR SELECT TO anon, authenticated
  USING (status = 'open' OR client_id = auth.uid() OR hired_worker_id = auth.uid());
DROP POLICY IF EXISTS "Clients create jobs" ON public.jobs;
CREATE POLICY "Clients create jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
DROP POLICY IF EXISTS "Clients update own jobs" ON public.jobs;
CREATE POLICY "Clients update own jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = hired_worker_id OR public.is_platform_admin())
  WITH CHECK (auth.uid() = client_id OR auth.uid() = hired_worker_id OR public.is_platform_admin());
DROP POLICY IF EXISTS "Clients delete own jobs" ON public.jobs;
CREATE POLICY "Clients delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = client_id);
DROP POLICY IF EXISTS "admin reads all jobs" ON public.jobs;
CREATE POLICY "admin reads all jobs" ON public.jobs FOR SELECT TO authenticated USING (public.is_platform_admin());

-- applications
DROP POLICY IF EXISTS "Applications visible to job client or worker" ON public.applications;
CREATE POLICY "Applications visible to job client or worker" ON public.applications FOR SELECT TO authenticated
  USING (
    auth.uid() = worker_id
    OR auth.uid() = (SELECT client_id FROM public.jobs WHERE id = job_id)
    OR public.is_platform_admin()
  );
DROP POLICY IF EXISTS "Workers create own applications" ON public.applications;
CREATE POLICY "Workers create own applications" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = worker_id);
DROP POLICY IF EXISTS "Job client updates applications" ON public.applications;
CREATE POLICY "Job client updates applications" ON public.applications FOR UPDATE TO authenticated
  USING (auth.uid() = (SELECT client_id FROM public.jobs WHERE id = job_id) OR auth.uid() = worker_id)
  WITH CHECK (auth.uid() = (SELECT client_id FROM public.jobs WHERE id = job_id) OR auth.uid() = worker_id);
DROP POLICY IF EXISTS "Workers delete own applications" ON public.applications;
CREATE POLICY "Workers delete own applications" ON public.applications FOR DELETE TO authenticated USING (auth.uid() = worker_id);
DROP POLICY IF EXISTS "admin reads all applications" ON public.applications;
CREATE POLICY "admin reads all applications" ON public.applications FOR SELECT TO authenticated USING (public.is_platform_admin());

-- transactions
DROP POLICY IF EXISTS "Transactions visible to participants" ON public.transactions;
CREATE POLICY "Transactions visible to participants" ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR public.is_platform_admin());
DROP POLICY IF EXISTS "admin reads all transactions" ON public.transactions;
CREATE POLICY "admin reads all transactions" ON public.transactions FOR SELECT TO authenticated USING (public.is_platform_admin());

-- ratings
DROP POLICY IF EXISTS "Ratings viewable by authenticated" ON public.ratings;
CREATE POLICY "Ratings viewable by authenticated" ON public.ratings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users create own ratings" ON public.ratings;
CREATE POLICY "Users create own ratings" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = rater_id);
DROP POLICY IF EXISTS "Users update own ratings" ON public.ratings;
CREATE POLICY "Users update own ratings" ON public.ratings FOR UPDATE TO authenticated USING (auth.uid() = rater_id) WITH CHECK (auth.uid() = rater_id);
DROP POLICY IF EXISTS "Users delete own ratings" ON public.ratings;
CREATE POLICY "Users delete own ratings" ON public.ratings FOR DELETE TO authenticated USING (auth.uid() = rater_id);
DROP POLICY IF EXISTS "admins manage reviews" ON public.ratings;
CREATE POLICY "admins manage reviews" ON public.ratings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_platform_admin())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_platform_admin());
DROP POLICY IF EXISTS "rated user can respond" ON public.ratings;
CREATE POLICY "rated user can respond" ON public.ratings FOR UPDATE TO authenticated
  USING (auth.uid() = rated_user_id) WITH CHECK (auth.uid() = rated_user_id);
DROP POLICY IF EXISTS "admin reads all ratings" ON public.ratings;
CREATE POLICY "admin reads all ratings" ON public.ratings FOR SELECT TO authenticated USING (public.is_platform_admin());

-- messages
DROP POLICY IF EXISTS "Messages visible to participants" ON public.messages;
CREATE POLICY "Messages visible to participants" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR public.is_platform_admin());
DROP POLICY IF EXISTS "Users send own messages" ON public.messages;
CREATE POLICY "Users send own messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Receivers mark messages read" ON public.messages;
CREATE POLICY "Receivers mark messages read" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);
DROP POLICY IF EXISTS "admin reads all messages" ON public.messages;
CREATE POLICY "admin reads all messages" ON public.messages FOR SELECT TO authenticated USING (public.is_platform_admin());

-- disputes
DROP POLICY IF EXISTS "parties view dispute" ON public.disputes;
CREATE POLICY "parties view dispute" ON public.disputes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.is_platform_admin()
  OR raised_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid()))
);
DROP POLICY IF EXISTS "parties create dispute" ON public.disputes;
CREATE POLICY "parties create dispute" ON public.disputes FOR INSERT TO authenticated WITH CHECK (
  raised_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid())
  )
);
DROP POLICY IF EXISTS "admin resolve dispute" ON public.disputes;
CREATE POLICY "admin resolve dispute" ON public.disputes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_platform_admin())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_platform_admin());
DROP POLICY IF EXISTS "admin reads all disputes" ON public.disputes;
CREATE POLICY "admin reads all disputes" ON public.disputes FOR SELECT TO authenticated USING (public.is_platform_admin());

-- dispute_evidence
DROP POLICY IF EXISTS "view evidence if party" ON public.dispute_evidence;
CREATE POLICY "view evidence if party" ON public.dispute_evidence FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM public.disputes d JOIN public.jobs j ON j.id = d.job_id
    WHERE d.id = dispute_id AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid() OR d.raised_by = auth.uid())
  )
);
DROP POLICY IF EXISTS "add own evidence" ON public.dispute_evidence;
CREATE POLICY "add own evidence" ON public.dispute_evidence FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- notifications
DROP POLICY IF EXISTS "view own notifications" ON public.notifications;
CREATE POLICY "view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "update own notifications" ON public.notifications;
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert own notifications" ON public.notifications;
CREATE POLICY "insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- cash_payment_requests
DROP POLICY IF EXISTS "parties view cash req" ON public.cash_payment_requests;
CREATE POLICY "parties view cash req" ON public.cash_payment_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid()))
);
DROP POLICY IF EXISTS "client creates cash req" ON public.cash_payment_requests;
CREATE POLICY "client creates cash req" ON public.cash_payment_requests FOR INSERT TO authenticated WITH CHECK (
  requested_by = auth.uid() AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.client_id = auth.uid())
);
DROP POLICY IF EXISTS "worker responds cash req" ON public.cash_payment_requests;
CREATE POLICY "worker responds cash req" ON public.cash_payment_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.hired_worker_id = auth.uid() OR j.client_id = auth.uid()))
);

-- onboarding
DROP POLICY IF EXISTS "view own ack" ON public.onboarding_acknowledgements;
CREATE POLICY "view own ack" ON public.onboarding_acknowledgements FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "create own ack" ON public.onboarding_acknowledgements;
CREATE POLICY "create own ack" ON public.onboarding_acknowledgements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- TRIGGERS (updated_at)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_jobs_updated ON public.jobs;
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_applications_updated ON public.applications;
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_disputes_updated_at ON public.disputes;
CREATE TRIGGER trg_disputes_updated_at BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_user_settings_updated ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- SIGNUP TRIGGER (profile + wallet + settings; never blocks auth)
-- ---------------------------------------------------------------------------
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
    IF v_role = 'poster' THEN v_role := 'client'; END IF;
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
        SELECT COALESCE(array_agg(x), '{}') INTO v_interests
        FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'job_interests') AS t(x);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_interests := '{}';
    END;

    INSERT INTO public.profiles (
      id, full_name, phone_number, role, location, language, job_interests, preferred_mode
    ) VALUES (
      NEW.id, v_name, NEW.raw_user_meta_data->>'phone',
      NULLIF(v_role, '')::public.user_role,
      NEW.raw_user_meta_data->>'city',
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'language', ''), 'English'),
      COALESCE(v_interests, '{}'), v_mode
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user wallet insert failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- BUSINESS RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hire_worker(_job_id UUID, _worker_id UUID, _amount NUMERIC)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client UUID := auth.uid();
  v_job public.jobs%ROWTYPE;
  v_avail NUMERIC;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.client_id <> v_client THEN RAISE EXCEPTION 'Not your job'; END IF;
  IF v_job.escrow_status <> 'none' AND v_job.escrow_status <> 'refunded' THEN
    RAISE EXCEPTION 'Job already has escrow';
  END IF;
  SELECT available_balance INTO v_avail FROM public.wallets WHERE user_id = v_client FOR UPDATE;
  IF v_avail IS NULL THEN RAISE EXCEPTION 'Client wallet missing'; END IF;
  IF v_avail < _amount THEN
    RETURN json_build_object('ok', false, 'error', 'insufficient_funds', 'available', v_avail, 'required', _amount);
  END IF;
  UPDATE public.wallets SET available_balance = available_balance - _amount WHERE user_id = v_client;
  INSERT INTO public.wallets (user_id) VALUES (_worker_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET pending_balance = pending_balance + _amount WHERE user_id = _worker_id;
  UPDATE public.jobs SET
    hired_worker_id = _worker_id, agreed_amount = _amount, escrow_status = 'locked',
    hired_at = now(), hire_expires_at = NULL, status = 'assigned'
  WHERE id = _job_id;
  INSERT INTO public.transactions (sender_id, receiver_id, job_id, amount, type, status, description, balance_bucket)
    VALUES (v_client, _worker_id, _job_id, _amount, 'escrow', 'completed', 'Escrow locked for job', 'pending');
  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (_worker_id, 'hired', 'You have been hired',
            'Payment of N' || _amount || ' is secured. You can begin.', '/jobs/' || _job_id);
  RETURN json_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.mark_job_complete(_job_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_job public.jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.hired_worker_id <> v_uid THEN RAISE EXCEPTION 'Not your job'; END IF;
  IF v_job.escrow_status <> 'locked' THEN RAISE EXCEPTION 'Job not in active state'; END IF;
  UPDATE public.jobs SET completed_at = now(), confirm_deadline = now() + INTERVAL '48 hours' WHERE id = _job_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_job.client_id, 'job_completed', 'Your worker marked the job complete',
            'Please confirm within 48 hours to release payment.', '/jobs/' || _job_id);
  RETURN json_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public._release_escrow(_job_id UUID, _to_bucket TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job public.jobs%ROWTYPE; v_commission NUMERIC; v_worker_share NUMERIC;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF v_job.escrow_status <> 'locked' THEN RETURN; END IF;
  v_commission := ROUND(v_job.agreed_amount * 0.10, 2);
  v_worker_share := v_job.agreed_amount - v_commission;
  UPDATE public.wallets SET pending_balance = pending_balance - v_job.agreed_amount WHERE user_id = v_job.hired_worker_id;
  IF _to_bucket = 'available' THEN
    UPDATE public.wallets SET available_balance = available_balance + v_worker_share WHERE user_id = v_job.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'released', released_at = now(), commission_amount = v_commission, status = 'completed' WHERE id = _job_id;
  ELSE
    UPDATE public.wallets SET frozen_balance = frozen_balance + v_worker_share WHERE user_id = v_job.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'frozen', released_at = now(), commission_amount = v_commission, frozen_until = now() + INTERVAL '72 hours' WHERE id = _job_id;
  END IF;
  INSERT INTO public.transactions (sender_id, receiver_id, job_id, amount, type, status, description, balance_bucket)
    VALUES (v_job.client_id, v_job.hired_worker_id, _job_id, v_worker_share, 'release', 'completed', 'Payment released (after 10% commission)', _to_bucket);
  INSERT INTO public.transactions (sender_id, receiver_id, job_id, amount, type, status, description, balance_bucket)
    VALUES (v_job.client_id, v_job.client_id, _job_id, v_commission, 'release', 'completed', 'WorkBridge 10% commission', 'available');
  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_job.hired_worker_id, 'payment_released',
            CASE WHEN _to_bucket = 'available' THEN 'Payment released' ELSE 'Payment frozen 72h' END,
            'N' || v_worker_share || ' (10% commission deducted)', '/wallet');
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_job_complete(_job_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_job public.jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id;
  IF v_job.client_id <> v_uid THEN RAISE EXCEPTION 'Not your job'; END IF;
  IF v_job.completed_at IS NULL THEN RAISE EXCEPTION 'Worker has not marked complete'; END IF;
  PERFORM public._release_escrow(_job_id, 'available');
  RETURN json_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.auto_confirm_jobs()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN SELECT id FROM public.jobs
    WHERE escrow_status = 'locked' AND completed_at IS NOT NULL AND confirm_deadline < now()
  LOOP
    PERFORM public._release_escrow(r.id, 'frozen'); n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.thaw_frozen_funds()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_worker_share NUMERIC; n INT := 0;
BEGIN
  FOR r IN SELECT * FROM public.jobs WHERE escrow_status = 'frozen' AND frozen_until < now()
  LOOP
    v_worker_share := r.agreed_amount - COALESCE(r.commission_amount, 0);
    UPDATE public.wallets SET frozen_balance = frozen_balance - v_worker_share,
                              available_balance = available_balance + v_worker_share
      WHERE user_id = r.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'released', status = 'completed' WHERE id = r.id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.hired_worker_id, 'payment_available', 'Payment now available',
              'N' || v_worker_share || ' is fully available to withdraw.', '/wallet');
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.set_wallet_pin(_pin TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;
  INSERT INTO public.wallets (user_id, pin_hash) VALUES (v_uid, crypt(_pin, gen_salt('bf')))
    ON CONFLICT (user_id) DO UPDATE SET pin_hash = crypt(_pin, gen_salt('bf')), updated_at = now();
  RETURN json_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_from_wallet(_amount NUMERIC, _pin TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_wallet public.wallets%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 500 THEN RAISE EXCEPTION 'Minimum withdrawal is N500'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_wallet.pin_hash IS NULL THEN RETURN json_build_object('ok', false, 'error', 'pin_not_set'); END IF;
  IF v_wallet.pin_hash <> crypt(_pin, v_wallet.pin_hash) THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_pin');
  END IF;
  IF v_wallet.available_balance < _amount THEN
    RETURN json_build_object('ok', false, 'error', 'insufficient_funds');
  END IF;
  UPDATE public.wallets SET available_balance = available_balance - _amount WHERE user_id = v_uid;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, status, description, balance_bucket)
    VALUES (v_uid, v_uid, _amount, 'withdrawal', 'pending', 'Withdrawal to bank', 'available');
  RETURN json_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.deposit_to_wallet(_user_id UUID, _amount NUMERIC, _reference TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET available_balance = available_balance + _amount WHERE user_id = _user_id;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, status, description, balance_bucket)
    VALUES (_user_id, _user_id, _amount, 'deposit', 'completed',
            'Wallet top-up · ' || COALESCE(_reference,''), 'available');
END; $$;

CREATE OR REPLACE FUNCTION public.expire_hires()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN SELECT * FROM public.jobs
    WHERE escrow_status = 'locked' AND hire_expires_at IS NOT NULL AND hire_expires_at < now() AND completed_at IS NULL
  LOOP
    UPDATE public.wallets SET pending_balance = GREATEST(0, pending_balance - COALESCE(r.agreed_amount,0)) WHERE user_id = r.hired_worker_id;
    UPDATE public.wallets SET available_balance = available_balance + COALESCE(r.agreed_amount,0) WHERE user_id = r.client_id;
    UPDATE public.jobs SET escrow_status = 'refunded', status = 'open', hired_worker_id = NULL, agreed_amount = NULL, hired_at = NULL, hire_expires_at = NULL WHERE id = r.id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.client_id, 'hire_expired', 'Hire offer expired', 'Your offer was not accepted in time. Funds refunded.', '/jobs/' || r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.raise_dispute(_job_id UUID, _reason TEXT, _description TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_job public.jobs%ROWTYPE; v_dispute_id UUID; v_other UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_uid <> v_job.client_id AND v_uid <> v_job.hired_worker_id THEN RAISE EXCEPTION 'Not a party to this job'; END IF;
  INSERT INTO public.disputes (job_id, raised_by, reason, description, status)
    VALUES (_job_id, v_uid, _reason, _description, 'open') RETURNING id INTO v_dispute_id;
  UPDATE public.jobs SET escrow_status = 'disputed' WHERE id = _job_id AND escrow_status IN ('locked','frozen');
  v_other := CASE WHEN v_uid = v_job.client_id THEN v_job.hired_worker_id ELSE v_job.client_id END;
  IF v_other IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (v_other, 'dispute_raised', 'A problem was reported', 'The other party reported an issue. Admin will review.', '/jobs/' || _job_id);
  END IF;
  RETURN json_build_object('ok', true, 'dispute_id', v_dispute_id);
END; $$;

CREATE OR REPLACE FUNCTION public.submit_rating(
  _job_id UUID, _rated_user_id UUID, _stars INT, _comment TEXT, _tags TEXT[]
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_job public.jobs%ROWTYPE; v_status public.review_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _stars < 1 OR _stars > 5 THEN RAISE EXCEPTION 'Invalid stars'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id;
  IF v_uid <> v_job.client_id AND v_uid <> v_job.hired_worker_id THEN RAISE EXCEPTION 'Not a party to this job'; END IF;
  -- held for low-star reviews (review_status has no under_review)
  v_status := CASE WHEN _stars <= 2 THEN 'held'::public.review_status ELSE 'published'::public.review_status END;
  INSERT INTO public.ratings (job_id, rater_id, rated_user_id, stars, comment, tags, status, published_at)
    VALUES (_job_id, v_uid, _rated_user_id, _stars, _comment, COALESCE(_tags, '{}'),
            v_status, CASE WHEN v_status = 'published' THEN now() ELSE NULL END)
    ON CONFLICT (job_id, rater_id, rated_user_id) DO UPDATE
      SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, tags = EXCLUDED.tags,
          status = EXCLUDED.status, published_at = EXCLUDED.published_at;
  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (_rated_user_id,
            CASE WHEN v_status = 'published' THEN 'review_received'::public.notification_type ELSE 'review_under_review'::public.notification_type END,
            CASE WHEN v_status = 'published' THEN 'New review received' ELSE 'A review is under review' END,
            CASE WHEN v_status = 'published' THEN _stars || ' star — ' || COALESCE(_comment,'') ELSE 'Admin will review before publishing.' END,
            '/profile');
  RETURN json_build_object('ok', true, 'status', v_status);
END; $$;

CREATE OR REPLACE FUNCTION public.respond_cash_request(_request_id uuid, _accept boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_req public.cash_payment_requests%ROWTYPE;
  v_job public.jobs%ROWTYPE; v_count int; v_reduction numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_req FROM public.cash_payment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = v_req.job_id;
  IF v_job.hired_worker_id IS NOT NULL AND v_uid <> v_job.hired_worker_id AND v_uid <> v_job.client_id THEN
    RAISE EXCEPTION 'Only a job party can respond';
  END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Already responded'; END IF;
  UPDATE public.cash_payment_requests
    SET status = CASE WHEN _accept THEN 'accepted'::public.cash_request_status ELSE 'declined'::public.cash_request_status END,
        responded_at = now()
    WHERE id = _request_id;
  IF _accept THEN
    UPDATE public.jobs SET payment_mode = 'cash' WHERE id = v_req.job_id;
    UPDATE public.profiles SET cash_transaction_count = cash_transaction_count + 1
      WHERE id = v_job.client_id RETURNING cash_transaction_count INTO v_count;
    IF v_count = 2 THEN v_reduction := 0.1; ELSIF v_count >= 3 THEN v_reduction := 0.2; END IF;
    IF v_reduction > 0 THEN
      UPDATE public.profiles SET client_rating = GREATEST(0, client_rating - v_reduction) WHERE id = v_job.client_id;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_job.client_id, 'cash_agreed', 'Cash payment agreed', 'WorkBridge cannot protect cash transactions.', '/jobs/' || v_job.id),
      (COALESCE(v_job.hired_worker_id, v_uid), 'cash_agreed', 'Cash payment agreed', 'Proceed with caution — cash is not protected.', '/jobs/' || v_job.id);
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (v_job.client_id, 'cash_declined', 'Cash payment declined', 'Payment will go through the WorkBridge wallet.', '/jobs/' || v_job.id);
  END IF;
  RETURN json_build_object('ok', true, 'cash_count', COALESCE(v_count, 0));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_dispute_id uuid, _decision text, _worker_pct numeric DEFAULT 100)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disp public.disputes%ROWTYPE; v_job public.jobs%ROWTYPE;
  v_worker_share numeric; v_client_share numeric; v_commission numeric; v_status public.dispute_status;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_disp FROM public.disputes WHERE id = _dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = v_disp.job_id FOR UPDATE;
  IF v_job.hired_worker_id IS NOT NULL THEN
    UPDATE public.wallets SET pending_balance = GREATEST(0, pending_balance - COALESCE(v_job.agreed_amount,0))
      WHERE user_id = v_job.hired_worker_id;
  END IF;
  IF _decision = 'refund_client' THEN
    UPDATE public.wallets SET available_balance = available_balance + COALESCE(v_job.agreed_amount,0) WHERE user_id = v_job.client_id;
    UPDATE public.jobs SET escrow_status = 'refunded', status = 'cancelled' WHERE id = v_job.id;
    v_status := 'resolved_client';
  ELSIF _decision = 'release_worker' THEN
    v_commission := ROUND(COALESCE(v_job.agreed_amount,0) * 0.10, 2);
    v_worker_share := COALESCE(v_job.agreed_amount,0) - v_commission;
    UPDATE public.wallets SET available_balance = available_balance + v_worker_share WHERE user_id = v_job.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'released', status = 'completed', commission_amount = v_commission, released_at = now() WHERE id = v_job.id;
    v_status := 'resolved_worker';
  ELSIF _decision = 'split' THEN
    IF _worker_pct IS NULL OR _worker_pct < 0 OR _worker_pct > 100 THEN RAISE EXCEPTION 'Invalid split percentage'; END IF;
    v_worker_share := ROUND(COALESCE(v_job.agreed_amount,0) * (_worker_pct / 100.0), 2);
    v_client_share := COALESCE(v_job.agreed_amount,0) - v_worker_share;
    IF v_worker_share > 0 THEN UPDATE public.wallets SET available_balance = available_balance + v_worker_share WHERE user_id = v_job.hired_worker_id; END IF;
    IF v_client_share > 0 THEN UPDATE public.wallets SET available_balance = available_balance + v_client_share WHERE user_id = v_job.client_id; END IF;
    UPDATE public.jobs SET escrow_status = 'released', status = 'completed', released_at = now() WHERE id = v_job.id;
    v_status := 'resolved_split';
  ELSE
    RAISE EXCEPTION 'Unknown decision';
  END IF;
  UPDATE public.disputes SET status = v_status, resolved_at = now(), resolution = _decision, resolved_by = auth.uid() WHERE id = _dispute_id;
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_job.client_id, 'dispute_resolved', 'Dispute resolved', 'Decision: ' || _decision, '/jobs/' || v_job.id),
    (COALESCE(v_job.hired_worker_id, v_job.client_id), 'dispute_resolved', 'Dispute resolved', 'Decision: ' || _decision, '/jobs/' || v_job.id);
  RETURN json_build_object('ok', true);
END; $$;

-- RPC grants
REVOKE EXECUTE ON FUNCTION public.hire_worker(UUID, UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_job_complete(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_job_complete(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_wallet_pin(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_from_wallet(NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._release_escrow(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_jobs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.thaw_frozen_funds() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deposit_to_wallet(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_hires() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hire_worker(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_job_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_job_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_wallet_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_from_wallet(NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.raise_dispute(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rating(UUID, UUID, INT, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_cash_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deposit_to_wallet(UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- STORAGE: chat-media bucket + policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 'chat-media', false, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/webm','audio/ogg','video/mp4','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "chat media read parties" ON storage.objects;
CREATE POLICY "chat media read parties" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media' AND (
    public.has_role(auth.uid(),'admin') OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id::text = (storage.foldername(name))[1]
        AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "chat media upload own folder" ON storage.objects;
CREATE POLICY "chat media upload own folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id::text = (storage.foldername(name))[1]
      AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "chat media delete own" ON storage.objects;
CREATE POLICY "chat media delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[2]);

DROP POLICY IF EXISTS "chat media update own" ON storage.objects;
CREATE POLICY "chat media update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[2]);

-- Optional profile-photos bucket (for future profile photo uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos', 'profile-photos', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "profile photos public read" ON storage.objects;
CREATE POLICY "profile photos public read" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'profile-photos');
DROP POLICY IF EXISTS "profile photos own upload" ON storage.objects;
CREATE POLICY "profile photos own upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "profile photos own update" ON storage.objects;
CREATE POLICY "profile photos own update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "profile photos own delete" ON storage.objects;
CREATE POLICY "profile photos own delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ---------------------------------------------------------------------------
-- Optional pg_cron (skip silently on free tier if extension unavailable)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  PERFORM cron.schedule('auto_confirm_jobs', '*/15 * * * *', $$SELECT public.auto_confirm_jobs();$$)
    WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto_confirm_jobs');
  PERFORM cron.schedule('thaw_frozen_funds', '*/15 * * * *', $$SELECT public.thaw_frozen_funds();$$)
    WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'thaw_frozen_funds');
  PERFORM cron.schedule('expire_hires', '*/15 * * * *', $$SELECT public.expire_hires();$$)
    WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_hires');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available (common on free tier): %', SQLERRM;
END $$;
