-- Phase 1 subscription-lifecycle sweeps — grace_period + past_due.
--
-- Complements 20260522064818_trial_expiry_sweep.sql, which handles the
-- common case (trial ends with no card → downgrade to freemium). That
-- migration covers ~99% of free-trial conversions because most tenants
-- never hit grace_period (their trial just lapses into freemium).
--
-- This migration covers the two remaining lifecycle transitions that
-- the schema can represent but no function currently enforces:
--
--   1. grace_period → expired
--      Triggered when an active paid subscription fails to renew and
--      ops/admin grants an explicit grace_until window. When the
--      window elapses, access must be revoked.
--
--   2. past_due → expired
--      Triggered when Razorpay reports a renewal failure (sets status
--      to 'past_due'). The platform keeps access for a 7-day soft
--      window so a customer can update card, then revokes.
--
-- All three functions (this migration + the trial sweep) read from the
-- same tenant_domain_assignments table and are independent. They can
-- run in any order; pg_cron schedules them at offset minutes so they
-- don't pile up on the same DB cycle.
--
-- See docs/plans/2026-05-20-multi-domain-platform-sequence-design.md §B.4.

-- ─── 1. expire_grace_periods() ───────────────────────────────────────────────
-- grace_until elapsed → status='expired'. The plan_id is preserved so the
-- billing UI can show "your <plan> access ended on <date>". A row in 'expired'
-- state is filtered out by the tenant_active_domain_assignments view below.

CREATE OR REPLACE FUNCTION public.expire_grace_periods()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.tenant_domain_assignments
    SET    subscription_status = 'expired',
           updated_at           = now()
    WHERE  subscription_status = 'grace_period'
      AND  grace_until IS NOT NULL
      AND  grace_until    <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    RAISE NOTICE 'expire_grace_periods: % rows expired', v_count;
  END IF;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_grace_periods() TO service_role;

COMMENT ON FUNCTION public.expire_grace_periods() IS
  'Flips tenant_domain_assignments where status=grace_period and grace_until has elapsed to status=expired. Scheduled via pg_cron daily. Returns the count of expired rows. See docs/plans/2026-05-20-multi-domain-platform-sequence-design.md.';

-- ─── 2. expire_past_due_subscriptions() ──────────────────────────────────────
-- past_due longer than the soft window → status='expired'. The window length
-- is read from a settings GUC (`app.past_due_grace_days`, default 7) so ops
-- can tune it without a migration.

CREATE OR REPLACE FUNCTION public.expire_past_due_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count int := 0;
  v_grace_days int := 7;
BEGIN
  BEGIN
    v_grace_days := COALESCE(NULLIF(current_setting('app.past_due_grace_days', true), '')::int, 7);
  EXCEPTION WHEN OTHERS THEN
    v_grace_days := 7;
  END;

  WITH upd AS (
    UPDATE public.tenant_domain_assignments
    SET    subscription_status = 'expired',
           updated_at           = now()
    WHERE  subscription_status = 'past_due'
      AND  updated_at <= now() - make_interval(days => v_grace_days)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM upd;

  IF v_count > 0 THEN
    RAISE NOTICE 'expire_past_due_subscriptions: % rows expired after % days', v_count, v_grace_days;
  END IF;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_past_due_subscriptions() TO service_role;

COMMENT ON FUNCTION public.expire_past_due_subscriptions() IS
  'Flips tenant_domain_assignments where status=past_due and the row has been past_due longer than app.past_due_grace_days (default 7) to status=expired. Scheduled via pg_cron daily. See docs/plans/2026-05-20-multi-domain-platform-sequence-design.md.';

-- ─── 3. View: tenant_active_domain_assignments ───────────────────────────────
-- Single read surface for "assignments that grant access today." Filters out
-- expired / cancelled / inactive states. The Sthira mobile shell and the
-- DomainService client-side resolver both select from this view so a paying
-- customer who lapsed cannot reach gated routes by URL-typing.
--
-- grace_period rows are INCLUDED here — they still have access until the
-- sweep runs. The sweep then flips them to expired and they drop out of
-- this view on the next refresh.

CREATE OR REPLACE VIEW public.tenant_active_domain_assignments AS
SELECT *
FROM   public.tenant_domain_assignments
WHERE  is_active = true
  AND  subscription_status IN ('active', 'trialing', 'grace_period');

COMMENT ON VIEW public.tenant_active_domain_assignments IS
  'Tenant-domain assignments that grant access RIGHT NOW. Filters out subscription_status in (expired, cancelled, inactive, past_due). Used by DomainService.resolveTenantDomainsClientSide and any other consumer that wants the "do I have access?" question answered authoritatively. See docs/plans/2026-05-20-multi-domain-platform-sequence-design.md §B.4.';

GRANT SELECT ON public.tenant_active_domain_assignments TO authenticated, anon, service_role;

-- ─── 4. pg_cron — schedule both sweeps ───────────────────────────────────────
-- Offset by 5 minutes from the existing trial sweep (03:30 UTC) so they
-- don't run concurrently on a small Supabase instance.

DO $$
DECLARE
  v_existing int;
BEGIN
  SELECT count(*) INTO v_existing FROM cron.job WHERE jobname = 'grace-period-expiry-sweep';
  IF v_existing > 0 THEN PERFORM cron.unschedule('grace-period-expiry-sweep'); END IF;

  SELECT count(*) INTO v_existing FROM cron.job WHERE jobname = 'past-due-expiry-sweep';
  IF v_existing > 0 THEN PERFORM cron.unschedule('past-due-expiry-sweep'); END IF;
END $$;

SELECT cron.schedule(
  'grace-period-expiry-sweep',
  '35 3 * * *',
  $cron$ SELECT public.expire_grace_periods(); $cron$
);

SELECT cron.schedule(
  'past-due-expiry-sweep',
  '40 3 * * *',
  $cron$ SELECT public.expire_past_due_subscriptions(); $cron$
);
