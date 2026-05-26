-- markets.dev_refresh_signals — dev helper for the Sthira Signals tab.
--
-- When the markets-worker hasn't run for a while (per [[project_rq_worker_macos]]
-- the RQ worker is manual-start per dev session), every row in markets.signals
-- has an expires_at in the past, so useRetailSignals returns zero matches and
-- the Signals tab shows "0 available". Triggering the worker just to repaint
-- the dashboard is overkill in dev.
--
-- This function pushes expires_at into the future on the N most recent
-- already-expired signals owned by the calling user, so the UI repopulates
-- without needing to re-generate against current market data. No new rows
-- are fabricated — it only refreshes timestamps on rows that already exist.
--
-- Usage:
--   SELECT markets.dev_refresh_signals();         -- defaults: 10 rows, +7 days
--   SELECT markets.dev_refresh_signals(20);       -- 20 rows
--   SELECT markets.dev_refresh_signals(5, '24 hours'::interval);
--
-- Returns the number of rows actually refreshed.
--
-- Safety notes:
--   - SECURITY INVOKER: runs as the caller, RLS applies (signals_owner_update
--     policy gates by owner_user_id = auth.uid()). A user cannot refresh
--     someone else's signals.
--   - Idempotent: only touches rows where expires_at IS NULL or < now(),
--     so calling it twice in a row is a no-op on the second call.
--   - Production-safe but useless in prod: if the real generator is running,
--     no rows match the "expired" criterion, so the function returns 0.
--     The name `dev_*` is a hint to the next reader that this is dev tooling,
--     not part of any user-facing flow.

CREATE OR REPLACE FUNCTION markets.dev_refresh_signals(
  p_count     INTEGER  DEFAULT 10,
  p_extend_by INTERVAL DEFAULT '7 days'::INTERVAL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_refreshed INTEGER;
BEGIN
  IF p_count < 1 OR p_count > 100 THEN
    RAISE EXCEPTION 'p_count must be between 1 and 100, got %', p_count;
  END IF;

  WITH targets AS (
    SELECT id
    FROM   markets.signals
    WHERE  confidence >= 0.60
      AND  asset_class IN ('equity','mf','fo','fx','bond','commodity')
      AND  (expires_at IS NULL OR expires_at < now())
    ORDER  BY ts DESC
    LIMIT  p_count
  )
  UPDATE markets.signals s
  SET    expires_at = now() + p_extend_by
  FROM   targets t
  WHERE  s.id = t.id;

  GET DIAGNOSTICS v_refreshed = ROW_COUNT;
  RETURN v_refreshed;
END;
$$;

COMMENT ON FUNCTION markets.dev_refresh_signals(INTEGER, INTERVAL) IS
  'Dev helper — extends expires_at on the N most recent already-expired '
  'signals owned by the caller. SECURITY INVOKER + RLS; no data fabrication. '
  'Use when the worker hasn''t run and the Sthira Signals tab is empty.';

-- Grant only to authenticated users — anon role has no business calling this.
REVOKE ALL ON FUNCTION markets.dev_refresh_signals(INTEGER, INTERVAL) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION markets.dev_refresh_signals(INTEGER, INTERVAL) TO authenticated;
