-- Trial-expiry sweep (Phase D · task U-D3).
-- See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
--
-- expire_trials_and_downgrade() finds every tenant_domain_assignments
-- row that is trialing, past its trial_ends_at, and has no
-- razorpay_subscription_id (i.e. the user never added a card). Each
-- such row is downgraded to the matching domain's freemium plan with
-- status='active' and trial_ends_at cleared.
--
-- The function returns the count of downgraded rows so the cron job
-- logs are useful. Idempotent — re-running immediately downgrades zero
-- rows.
--
-- pg_cron job "trial-expiry-sweep" runs every day at 03:30 UTC
-- (≈09:00 IST — well after midnight rollover; before working hours
-- so users see the downgrade banner first thing).

CREATE OR REPLACE FUNCTION public.expire_trials_and_downgrade()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH due AS (
    SELECT tda.id, t.domain_id
    FROM   public.tenant_domain_assignments tda
    JOIN   public.tenants                   t ON t.id = tda.tenant_id
    WHERE  tda.subscription_status       = 'trialing'
      AND  tda.trial_ends_at IS NOT NULL
      AND  tda.trial_ends_at            <= now()
      AND  tda.razorpay_subscription_id IS NULL
  ),
  freemium AS (
    SELECT sp.id AS plan_id, sp.domain_id
    FROM   public.subscription_plans sp
    WHERE  sp.tier      = 'free'
      AND  sp.is_active = true
  ),
  upd AS (
    UPDATE public.tenant_domain_assignments tda
    SET    subscription_status = 'active',
           plan_id              = freemium.plan_id,
           trial_ends_at        = NULL,
           updated_at           = now()
    FROM   due
    JOIN   freemium ON freemium.domain_id = due.domain_id
    WHERE  tda.id = due.id
    RETURNING tda.id
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    RAISE NOTICE 'expire_trials_and_downgrade: % rows downgraded', v_count;
  END IF;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_trials_and_downgrade() TO service_role;

COMMENT ON FUNCTION public.expire_trials_and_downgrade() IS
  'Sweeps tenant_domain_assignments where the 14-day trial has ended without a card on file and downgrades them to the matching domain''s freemium plan. Scheduled via pg_cron nightly. Returns the count of downgraded rows. See U-D3 / docs/plans/2026-05-22-unified-platform-onboarding-design.md.';

DO $$
DECLARE
  v_existing int;
BEGIN
  SELECT count(*) INTO v_existing FROM cron.job WHERE jobname = 'trial-expiry-sweep';
  IF v_existing > 0 THEN
    PERFORM cron.unschedule('trial-expiry-sweep');
  END IF;
END $$;

SELECT cron.schedule(
  'trial-expiry-sweep',
  '30 3 * * *',
  $cron$ SELECT public.expire_trials_and_downgrade(); $cron$
);
