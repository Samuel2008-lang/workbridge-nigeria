
REVOKE EXECUTE ON FUNCTION public.hire_worker(UUID, UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_job_complete(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_job_complete(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_wallet_pin(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_from_wallet(NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._release_escrow(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_jobs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.thaw_frozen_funds() FROM PUBLIC, anon, authenticated;
