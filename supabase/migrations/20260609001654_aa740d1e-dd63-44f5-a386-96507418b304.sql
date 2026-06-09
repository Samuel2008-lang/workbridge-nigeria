
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Expire pending hires (none used yet — placeholder for future hire offers)
CREATE OR REPLACE FUNCTION public.expire_hires()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN SELECT * FROM public.jobs
    WHERE escrow_status = 'locked'
      AND hire_expires_at IS NOT NULL
      AND hire_expires_at < now()
      AND completed_at IS NULL
  LOOP
    -- Refund client
    UPDATE public.wallets SET pending_balance = pending_balance - r.agreed_amount
      WHERE user_id = r.hired_worker_id;
    UPDATE public.wallets SET available_balance = available_balance + r.agreed_amount
      WHERE user_id = r.client_id;
    UPDATE public.jobs SET escrow_status = 'refunded', status = 'open',
                            hired_worker_id = NULL, agreed_amount = NULL,
                            hired_at = NULL, hire_expires_at = NULL
      WHERE id = r.id;
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.client_id, 'hire_expired', 'Hire offer expired',
              'Your offer was not accepted in time. Funds refunded.', '/jobs/' || r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

-- Raise a dispute on a job
CREATE OR REPLACE FUNCTION public.raise_dispute(_job_id UUID, _reason TEXT, _description TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_job public.jobs%ROWTYPE;
  v_dispute_id UUID;
  v_other UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_uid <> v_job.client_id AND v_uid <> v_job.hired_worker_id THEN
    RAISE EXCEPTION 'Not a party to this job';
  END IF;

  INSERT INTO public.disputes (job_id, raised_by, reason, description, status)
    VALUES (_job_id, v_uid, _reason, _description, 'open')
    RETURNING id INTO v_dispute_id;

  UPDATE public.jobs SET escrow_status = 'disputed' WHERE id = _job_id
    AND escrow_status IN ('locked','frozen');

  v_other := CASE WHEN v_uid = v_job.client_id THEN v_job.hired_worker_id ELSE v_job.client_id END;
  IF v_other IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (v_other, 'dispute_raised', 'A problem was reported',
              'The other party reported an issue. Admin will review.', '/jobs/' || _job_id);
  END IF;

  RETURN json_build_object('ok', true, 'dispute_id', v_dispute_id);
END; $$;

-- Submit rating; low-star reviews are held for admin review
CREATE OR REPLACE FUNCTION public.submit_rating(
  _job_id UUID, _rated_user_id UUID, _stars INT, _comment TEXT, _tags TEXT[]
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_job public.jobs%ROWTYPE;
  v_status review_status;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _stars < 1 OR _stars > 5 THEN RAISE EXCEPTION 'Invalid stars'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = _job_id;
  IF v_uid <> v_job.client_id AND v_uid <> v_job.hired_worker_id THEN
    RAISE EXCEPTION 'Not a party to this job';
  END IF;
  v_status := CASE WHEN _stars <= 2 THEN 'under_review'::review_status ELSE 'published'::review_status END;

  INSERT INTO public.ratings (job_id, rater_id, rated_user_id, stars, comment, tags, status, published_at)
    VALUES (_job_id, v_uid, _rated_user_id, _stars, _comment, COALESCE(_tags, '{}'),
            v_status, CASE WHEN v_status = 'published' THEN now() ELSE NULL END)
    ON CONFLICT (job_id, rater_id, rated_user_id) DO UPDATE
      SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, tags = EXCLUDED.tags,
          status = EXCLUDED.status, published_at = EXCLUDED.published_at;

  INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (_rated_user_id,
            CASE WHEN v_status = 'published' THEN 'review_received'::notification_type ELSE 'review_under_review'::notification_type END,
            CASE WHEN v_status = 'published' THEN 'New review received' ELSE 'A review is under review' END,
            CASE WHEN v_status = 'published' THEN _stars || '★ — ' || COALESCE(_comment,'') ELSE 'Admin will review before publishing.' END,
            '/profile');

  RETURN json_build_object('ok', true, 'status', v_status);
END; $$;

-- Schedule background tasks every 15 minutes
SELECT cron.schedule('auto_confirm_jobs', '*/15 * * * *', $$SELECT public.auto_confirm_jobs();$$)
  WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto_confirm_jobs');
SELECT cron.schedule('thaw_frozen_funds', '*/15 * * * *', $$SELECT public.thaw_frozen_funds();$$)
  WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'thaw_frozen_funds');
SELECT cron.schedule('expire_hires', '*/15 * * * *', $$SELECT public.expire_hires();$$)
  WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_hires');
