
-- Need pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ hire_worker ============
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

  -- Move client funds out
  UPDATE public.wallets SET available_balance = available_balance - _amount
    WHERE user_id = v_client;
  -- Lock worker pending
  INSERT INTO public.wallets (user_id) VALUES (_worker_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET pending_balance = pending_balance + _amount
    WHERE user_id = _worker_id;

  -- Update job
  UPDATE public.jobs SET
    hired_worker_id = _worker_id,
    agreed_amount = _amount,
    escrow_status = 'locked',
    hired_at = now(),
    hire_expires_at = NULL,
    status = 'assigned'
  WHERE id = _job_id;

  -- Transactions
  INSERT INTO public.transactions (sender_id, receiver_id, job_id, amount, type, status, description, balance_bucket)
    VALUES (v_client, _worker_id, _job_id, _amount, 'escrow', 'completed', 'Escrow locked for job', 'pending');

  -- Notify worker
  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (_worker_id, 'hired', '🎉 You have been hired',
            'Payment of ₦' || _amount || ' is secured. You can begin.', '/jobs/' || _job_id);

  RETURN json_build_object('ok', true);
END;
$$;

-- ============ mark_job_complete (worker) ============
CREATE OR REPLACE FUNCTION public.mark_job_complete(_job_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_job public.jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.hired_worker_id <> v_uid THEN RAISE EXCEPTION 'Not your job'; END IF;
  IF v_job.escrow_status <> 'locked' THEN RAISE EXCEPTION 'Job not in active state'; END IF;

  UPDATE public.jobs SET
    completed_at = now(),
    confirm_deadline = now() + INTERVAL '48 hours'
  WHERE id = _job_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_job.client_id, 'job_completed', 'Your worker marked the job complete',
            'Please confirm within 48 hours to release payment.', '/jobs/' || _job_id);

  RETURN json_build_object('ok', true);
END;
$$;

-- Helper: release with commission to a target bucket (available or frozen)
CREATE OR REPLACE FUNCTION public._release_escrow(_job_id UUID, _to_bucket TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_commission NUMERIC;
  v_worker_share NUMERIC;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF v_job.escrow_status <> 'locked' THEN RETURN; END IF;
  v_commission := ROUND(v_job.agreed_amount * 0.10, 2);
  v_worker_share := v_job.agreed_amount - v_commission;

  -- Remove pending from worker
  UPDATE public.wallets SET pending_balance = pending_balance - v_job.agreed_amount
    WHERE user_id = v_job.hired_worker_id;

  IF _to_bucket = 'available' THEN
    UPDATE public.wallets SET available_balance = available_balance + v_worker_share
      WHERE user_id = v_job.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'released', released_at = now(),
                            commission_amount = v_commission, status = 'completed'
      WHERE id = _job_id;
  ELSE -- frozen
    UPDATE public.wallets SET frozen_balance = frozen_balance + v_worker_share
      WHERE user_id = v_job.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'frozen', released_at = now(),
                            commission_amount = v_commission,
                            frozen_until = now() + INTERVAL '72 hours'
      WHERE id = _job_id;
  END IF;

  INSERT INTO public.transactions (sender_id, receiver_id, job_id, amount, type, status, description, balance_bucket)
    VALUES (v_job.client_id, v_job.hired_worker_id, _job_id, v_worker_share, 'release', 'completed',
            'Payment released (after 10% commission)', _to_bucket);
  INSERT INTO public.transactions (sender_id, receiver_id, job_id, amount, type, status, description, balance_bucket)
    VALUES (v_job.client_id, v_job.client_id, _job_id, v_commission, 'release', 'completed',
            'WorkBridge 10% commission', 'available');

  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_job.hired_worker_id, 'payment_released',
            CASE WHEN _to_bucket = 'available' THEN '✅ Payment released' ELSE 'Payment frozen 72h' END,
            '₦' || v_worker_share || ' (10% commission deducted)', '/wallet');
END;
$$;

-- ============ confirm_job_complete (client) ============
CREATE OR REPLACE FUNCTION public.confirm_job_complete(_job_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_job public.jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id;
  IF v_job.client_id <> v_uid THEN RAISE EXCEPTION 'Not your job'; END IF;
  IF v_job.completed_at IS NULL THEN RAISE EXCEPTION 'Worker has not marked complete'; END IF;
  PERFORM public._release_escrow(_job_id, 'available');
  RETURN json_build_object('ok', true);
END;
$$;

-- ============ Scheduled tasks ============
CREATE OR REPLACE FUNCTION public.auto_confirm_jobs()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN SELECT id FROM public.jobs
    WHERE escrow_status = 'locked' AND completed_at IS NOT NULL AND confirm_deadline < now()
  LOOP
    PERFORM public._release_escrow(r.id, 'frozen');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.thaw_frozen_funds()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_worker_share NUMERIC; n INT := 0;
BEGIN
  FOR r IN SELECT * FROM public.jobs
    WHERE escrow_status = 'frozen' AND frozen_until < now()
  LOOP
    v_worker_share := r.agreed_amount - COALESCE(r.commission_amount, 0);
    UPDATE public.wallets SET frozen_balance = frozen_balance - v_worker_share,
                              available_balance = available_balance + v_worker_share
      WHERE user_id = r.hired_worker_id;
    UPDATE public.jobs SET escrow_status = 'released', status = 'completed' WHERE id = r.id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.hired_worker_id, 'payment_available', '💰 Payment now available',
              '₦' || v_worker_share || ' is fully available to withdraw.', '/wallet');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- ============ PIN management ============
CREATE OR REPLACE FUNCTION public.set_wallet_pin(_pin TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;
  INSERT INTO public.wallets (user_id, pin_hash) VALUES (v_uid, crypt(_pin, gen_salt('bf')))
    ON CONFLICT (user_id) DO UPDATE SET pin_hash = crypt(_pin, gen_salt('bf')), updated_at = now();
  RETURN json_build_object('ok', true);
END;
$$;

-- ============ Withdraw ============
CREATE OR REPLACE FUNCTION public.withdraw_from_wallet(_amount NUMERIC, _pin TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_wallet public.wallets%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 500 THEN RAISE EXCEPTION 'Minimum withdrawal is ₦500'; END IF;
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
END;
$$;

-- ============ Deposit (called server-side after Flutterwave confirms) ============
CREATE OR REPLACE FUNCTION public.deposit_to_wallet(_user_id UUID, _amount NUMERIC, _reference TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET available_balance = available_balance + _amount WHERE user_id = _user_id;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, status, description, balance_bucket)
    VALUES (_user_id, _user_id, _amount, 'deposit', 'completed',
            'Wallet top-up · ' || COALESCE(_reference,''), 'available');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.deposit_to_wallet(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
