
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(_dispute_id uuid, _decision text, _worker_pct numeric DEFAULT 100)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disp public.disputes%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_worker_share numeric; v_client_share numeric; v_commission numeric;
  v_status public.dispute_status;
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
    UPDATE public.wallets SET available_balance = available_balance + v_job.agreed_amount
      WHERE user_id = v_job.client_id;
    UPDATE public.jobs SET escrow_status = 'refunded', status = 'cancelled' WHERE id = v_job.id;
    v_status := 'resolved_client';
  ELSIF _decision = 'release_worker' THEN
    v_commission := ROUND(v_job.agreed_amount * 0.10, 2);
    v_worker_share := v_job.agreed_amount - v_commission;
    UPDATE public.wallets SET available_balance = available_balance + v_worker_share
      WHERE user_id = v_job.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'released', status = 'completed',
           commission_amount = v_commission, released_at = now() WHERE id = v_job.id;
    v_status := 'resolved_worker';
  ELSIF _decision = 'split' THEN
    IF _worker_pct IS NULL OR _worker_pct < 0 OR _worker_pct > 100 THEN
      RAISE EXCEPTION 'Invalid split percentage'; END IF;
    v_worker_share := ROUND(v_job.agreed_amount * (_worker_pct / 100.0), 2);
    v_client_share := v_job.agreed_amount - v_worker_share;
    IF v_worker_share > 0 THEN
      UPDATE public.wallets SET available_balance = available_balance + v_worker_share
        WHERE user_id = v_job.hired_worker_id; END IF;
    IF v_client_share > 0 THEN
      UPDATE public.wallets SET available_balance = available_balance + v_client_share
        WHERE user_id = v_job.client_id; END IF;
    UPDATE public.jobs SET escrow_status = 'released', status = 'completed', released_at = now()
      WHERE id = v_job.id;
    v_status := 'resolved_split';
  ELSE
    RAISE EXCEPTION 'Unknown decision';
  END IF;

  UPDATE public.disputes
    SET status = v_status, resolved_at = now(), resolution = _decision, resolved_by = auth.uid()
    WHERE id = _dispute_id;

  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (v_job.client_id, 'dispute_resolved', 'Dispute resolved', 'Decision: ' || _decision, '/jobs/' || v_job.id),
    (COALESCE(v_job.hired_worker_id, v_job.client_id), 'dispute_resolved', 'Dispute resolved', 'Decision: ' || _decision, '/jobs/' || v_job.id);

  RETURN json_build_object('ok', true);
END; $$;
