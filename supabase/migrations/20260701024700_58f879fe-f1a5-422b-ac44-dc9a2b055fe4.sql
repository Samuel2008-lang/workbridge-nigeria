
-- Admin check based on email
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND lower(email) = 'hopeegbon28@gmail.com'
  );
$$;

-- Cash request response
CREATE OR REPLACE FUNCTION public.respond_cash_request(_request_id uuid, _accept boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.cash_payment_requests%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_count int;
  v_reduction numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_req FROM public.cash_payment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = v_req.job_id;
  IF v_job.hired_worker_id IS DISTINCT FROM v_uid AND v_job.client_id IS DISTINCT FROM v_uid THEN
    -- allow worker to respond; when no worker yet, allow either party responding? default: worker only
    IF v_job.hired_worker_id IS NOT NULL AND v_uid <> v_job.hired_worker_id THEN
      RAISE EXCEPTION 'Only the worker can respond';
    END IF;
  END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Already responded'; END IF;

  UPDATE public.cash_payment_requests
    SET status = CASE WHEN _accept THEN 'accepted'::cash_request_status ELSE 'declined'::cash_request_status END,
        responded_at = now()
    WHERE id = _request_id;

  IF _accept THEN
    UPDATE public.jobs SET payment_mode = 'cash' WHERE id = v_req.job_id;
    UPDATE public.profiles
      SET cash_transaction_count = cash_transaction_count + 1
      WHERE id = v_job.client_id
      RETURNING cash_transaction_count INTO v_count;
    -- Rating impact
    IF v_count = 2 THEN v_reduction := 0.1;
    ELSIF v_count >= 3 THEN v_reduction := 0.2;
    END IF;
    IF v_reduction > 0 THEN
      UPDATE public.profiles
        SET client_rating = GREATEST(0, client_rating - v_reduction)
        WHERE id = v_job.client_id;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES
        (v_job.client_id, 'cash_agreed', '⚠️ Cash payment agreed',
          'WorkBridge cannot protect cash transactions.', '/jobs/' || v_job.id),
        (COALESCE(v_job.hired_worker_id, v_uid), 'cash_agreed', '⚠️ Cash payment agreed',
          'Proceed with caution — cash is not protected.', '/jobs/' || v_job.id);
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (v_job.client_id, 'cash_declined', 'Cash payment declined',
              'Payment will go through the WorkBridge wallet.', '/jobs/' || v_job.id);
  END IF;

  RETURN json_build_object('ok', true, 'cash_count', COALESCE(v_count, 0));
END; $$;

-- Admin dispute resolution
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_dispute_id uuid, _decision text, _worker_pct numeric DEFAULT 100)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disp public.disputes%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_worker_share numeric;
  v_client_share numeric;
  v_commission numeric;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_disp FROM public.disputes WHERE id = _dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = v_disp.job_id FOR UPDATE;

  -- Remove pending from worker
  IF v_job.hired_worker_id IS NOT NULL THEN
    UPDATE public.wallets SET pending_balance = GREATEST(0, pending_balance - v_job.agreed_amount)
      WHERE user_id = v_job.hired_worker_id;
  END IF;

  IF _decision = 'refund_client' THEN
    UPDATE public.wallets SET available_balance = available_balance + v_job.agreed_amount
      WHERE user_id = v_job.client_id;
    UPDATE public.jobs SET escrow_status = 'refunded', status = 'cancelled' WHERE id = v_job.id;
  ELSIF _decision = 'release_worker' THEN
    v_commission := ROUND(v_job.agreed_amount * 0.10, 2);
    v_worker_share := v_job.agreed_amount - v_commission;
    UPDATE public.wallets SET available_balance = available_balance + v_worker_share
      WHERE user_id = v_job.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'released', status = 'completed',
           commission_amount = v_commission, released_at = now() WHERE id = v_job.id;
  ELSIF _decision = 'split' THEN
    IF _worker_pct IS NULL OR _worker_pct < 0 OR _worker_pct > 100 THEN
      RAISE EXCEPTION 'Invalid split percentage';
    END IF;
    v_worker_share := ROUND(v_job.agreed_amount * (_worker_pct / 100.0), 2);
    v_client_share := v_job.agreed_amount - v_worker_share;
    IF v_worker_share > 0 THEN
      UPDATE public.wallets SET available_balance = available_balance + v_worker_share
        WHERE user_id = v_job.hired_worker_id;
    END IF;
    IF v_client_share > 0 THEN
      UPDATE public.wallets SET available_balance = available_balance + v_client_share
        WHERE user_id = v_job.client_id;
    END IF;
    UPDATE public.jobs SET escrow_status = 'released', status = 'completed', released_at = now()
      WHERE id = v_job.id;
  ELSE
    RAISE EXCEPTION 'Unknown decision';
  END IF;

  UPDATE public.disputes
    SET status = 'resolved', resolved_at = now(), resolution = _decision, resolved_by = auth.uid()
    WHERE id = _dispute_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES
      (v_job.client_id, 'dispute_resolved', 'Dispute resolved',
        'Decision: ' || _decision, '/jobs/' || v_job.id),
      (COALESCE(v_job.hired_worker_id, v_job.client_id), 'dispute_resolved', 'Dispute resolved',
        'Decision: ' || _decision, '/jobs/' || v_job.id);

  RETURN json_build_object('ok', true);
END; $$;

-- Admin RLS: allow platform admin to read everything
CREATE POLICY "admin reads all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "admin reads all jobs" ON public.jobs FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "admin reads all disputes" ON public.disputes FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "admin reads all transactions" ON public.transactions FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "admin reads all wallets" ON public.wallets FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "admin reads all messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "admin reads all ratings" ON public.ratings FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "admin reads all applications" ON public.applications FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Ensure dispute has resolution/resolved_by columns
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolved_by uuid;

-- Ensure notification enum has the new types
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cash_agreed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cash_declined';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dispute_resolved';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
