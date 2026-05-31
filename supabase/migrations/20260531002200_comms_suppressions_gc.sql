-- Phase 6 Step 47 — suppression expires_at GC + active view + daily cron.
--
-- comms.suppressions.expires_at has been a column since Step 1
-- (20260528140200), but nothing actually expired rows. comms.is_
-- suppressed already filters by (expires_at IS NULL OR > now()), so
-- expired rows don't FALSELY block sends — but they accumulate
-- forever, growing the table + slowing the (tenant_id, channel,
-- address) unique-index probe over time.
--
-- Three pieces:
--
-- 1. comms.v_suppressions_active — SELECT * filtered to the active
--    subset (NULL expires_at OR future). Callers wanting the "what
--    is currently suppressed?" answer (the future UI's suppression-
--    management list) query this view, never the raw table.
--
-- 2. comms.prune_expired_suppressions() — SECURITY DEFINER fn,
--    DELETEs WHERE expires_at <= now() AND expires_at IS NOT NULL.
--    Returns count. Manual + cron-callable.
--
-- 3. cron.schedule('comms-suppression-gc', '30 3 * * *', ...) —
--    daily at 03:30 UTC. Different time from the outbox-partition-
--    provisioner (02:00 1st-of-month) so they never overlap.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Active-suppression view
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW comms.v_suppressions_active AS
SELECT s.*
FROM comms.suppressions s
WHERE s.expires_at IS NULL OR s.expires_at > now();

COMMENT ON VIEW comms.v_suppressions_active IS
  'Phase 6 Step 47 — active subset of comms.suppressions (expires_at NULL or future). Use this view in UIs + reports; raw table reads risk including pruned-but-not-yet-deleted rows during the window between expiry and the daily GC sweep.';

GRANT SELECT ON comms.v_suppressions_active TO authenticated;
GRANT SELECT ON comms.v_suppressions_active TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. GC function
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION comms.prune_expired_suppressions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = comms, pg_catalog
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH del AS (
    DELETE FROM comms.suppressions s
    WHERE s.expires_at IS NOT NULL
      AND s.expires_at <= now()
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_deleted FROM del;

  IF v_deleted > 0 THEN
    RAISE NOTICE 'prune_expired_suppressions: deleted % expired rows', v_deleted;
  END IF;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION comms.prune_expired_suppressions() IS
  'Phase 6 Step 47 — deletes comms.suppressions rows past their expires_at. Returns count. Called daily by the comms-suppression-gc cron; safe to invoke manually anytime.';

REVOKE EXECUTE ON FUNCTION comms.prune_expired_suppressions() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION comms.prune_expired_suppressions() TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Daily cron
-- ══════════════════════════════════════════════════════════════════════

-- 03:30 UTC daily. cron.schedule is idempotent on jobname.
SELECT cron.schedule(
  'comms-suppression-gc',
  '30 3 * * *',
  $cron$ SELECT comms.prune_expired_suppressions(); $cron$
);
