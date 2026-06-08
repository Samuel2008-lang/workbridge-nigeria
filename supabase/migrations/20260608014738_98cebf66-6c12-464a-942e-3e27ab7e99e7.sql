
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.escrow_status AS ENUM ('none','locked','released','frozen','disputed','refunded');
CREATE TYPE public.dispute_status AS ENUM ('open','under_review','resolved_worker','resolved_client','resolved_split','closed');
CREATE TYPE public.review_status AS ENUM ('pending','published','held','removed','disputed');
CREATE TYPE public.notification_type AS ENUM (
  'hired','job_completed','payment_released','payment_available',
  'new_message','dispute_raised','dispute_resolved','review_received',
  'review_under_review','badge_unlocked','application_received',
  'confirm_reminder','auto_confirmed','job_closed','hire_expired'
);
CREATE TYPE public.cash_request_status AS ENUM ('pending','accepted','declined');
CREATE TYPE public.onboarding_type AS ENUM ('worker_prejob','client_onboarding');

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ wallets ============
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  frozen_balance    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (frozen_balance >= 0),
  pin_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own wallet pin" ON public.wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user to also create a wallet row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number, role, location, language)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'role','')::public.user_role,
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'language'
  );
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill wallet rows for existing users
INSERT INTO public.wallets (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============ jobs: escrow columns ============
ALTER TABLE public.jobs
  ADD COLUMN hired_worker_id UUID REFERENCES auth.users(id),
  ADD COLUMN agreed_amount NUMERIC(14,2),
  ADD COLUMN escrow_status public.escrow_status NOT NULL DEFAULT 'none',
  ADD COLUMN hired_at TIMESTAMPTZ,
  ADD COLUMN hire_expires_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN confirm_deadline TIMESTAMPTZ,
  ADD COLUMN frozen_until TIMESTAMPTZ,
  ADD COLUMN released_at TIMESTAMPTZ,
  ADD COLUMN commission_amount NUMERIC(14,2),
  ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'wallet' CHECK (payment_mode IN ('wallet','cash'));

-- ============ ratings/reviews enhancements ============
ALTER TABLE public.ratings
  ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN status public.review_status NOT NULL DEFAULT 'published',
  ADD COLUMN response TEXT,
  ADD COLUMN investigation_note TEXT,
  ADD COLUMN published_at TIMESTAMPTZ DEFAULT now();

-- Admins may update reviews (publish/remove)
CREATE POLICY "admins manage reviews" ON public.ratings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Allow rated user to respond
CREATE POLICY "rated user can respond" ON public.ratings FOR UPDATE TO authenticated
  USING (auth.uid() = rated_user_id)
  WITH CHECK (auth.uid() = rated_user_id);

-- ============ disputes ============
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  description TEXT,
  status public.dispute_status NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  worker_amount NUMERIC(14,2),
  client_amount NUMERIC(14,2),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties view dispute" ON public.disputes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR raised_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid()))
);
CREATE POLICY "parties create dispute" ON public.disputes FOR INSERT TO authenticated WITH CHECK (
  raised_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid())
  )
);
CREATE POLICY "admin resolve dispute" ON public.disputes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_disputes_updated_at BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  media_url TEXT,
  media_type TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dispute_evidence TO authenticated;
GRANT ALL ON public.dispute_evidence TO service_role;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view evidence if party" ON public.dispute_evidence FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (
    SELECT 1 FROM public.disputes d JOIN public.jobs j ON j.id = d.job_id
    WHERE d.id = dispute_id AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid() OR d.raised_by = auth.uid())
  )
);
CREATE POLICY "add own evidence" ON public.dispute_evidence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ notifications ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);

-- ============ cash_payment_requests ============
CREATE TABLE public.cash_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status public.cash_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.cash_payment_requests TO authenticated;
GRANT ALL ON public.cash_payment_requests TO service_role;
ALTER TABLE public.cash_payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties view cash req" ON public.cash_payment_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND (j.client_id = auth.uid() OR j.hired_worker_id = auth.uid()))
);
CREATE POLICY "client creates cash req" ON public.cash_payment_requests FOR INSERT TO authenticated WITH CHECK (
  requested_by = auth.uid() AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.client_id = auth.uid())
);
CREATE POLICY "worker responds cash req" ON public.cash_payment_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.hired_worker_id = auth.uid())
);

-- Counter on profiles
ALTER TABLE public.profiles
  ADD COLUMN cash_transaction_count INT NOT NULL DEFAULT 0,
  ADD COLUMN client_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN worker_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00;

-- ============ onboarding_acknowledgements ============
CREATE TABLE public.onboarding_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.onboarding_type NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, job_id)
);
GRANT SELECT, INSERT ON public.onboarding_acknowledgements TO authenticated;
GRANT ALL ON public.onboarding_acknowledgements TO service_role;
ALTER TABLE public.onboarding_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own ack" ON public.onboarding_acknowledgements FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "create own ack" ON public.onboarding_acknowledgements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ messages: media columns ============
ALTER TABLE public.messages
  ADD COLUMN media_url TEXT,
  ADD COLUMN media_type TEXT,
  ADD COLUMN duration_seconds INT,
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT false;

-- ============ transactions: enrich ============
ALTER TABLE public.transactions
  ADD COLUMN description TEXT,
  ADD COLUMN balance_bucket TEXT;
