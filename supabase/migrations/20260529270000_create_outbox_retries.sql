-- Phase 5 hardening — retry queue for the cross-module consumer.
--
-- When dispatch() in cross-module-consumer.ts throws (network blip,
-- schema drift, unexpected payload shape), the event used to silently
-- get picked up again on the next poll — tight loop, no backoff, no
-- visibility. This slice fixes that:
--
--   1. core.outbox_retries records every failed attempt with an
--      exponential next_attempt_at.
--   2. core.v_cross_module_pending_events JOINs to outbox_retries so
--      the consumer only sees events whose backoff window has elapsed
--      (or which have never been tried).
--   3. After max_attempts (default 5) the retry row flips to
--      'exhausted' — admin intervention needed; the consumer stops
--      trying.
--
-- core.record_outbox_retry() encapsulates the upsert + backoff math +
-- status flip so the consumer can call it in one round trip.
-- core.mark_outbox_resolved() flips a retry row to 'resolved' on
-- success — the outbox.published_at stamp is the load-bearing fact;
-- this is just for monitoring history.

CREATE TABLE core.outbox_retries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id       uuid NOT NULL UNIQUE,
  tenant_id       uuid NOT NULL,
  attempt_count   integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error      text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','exhausted','resolved')),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.outbox_retries IS
  'Phase 5 hardening — retry state for cross-module consumer dispatch failures. UNIQUE(outbox_id): at most one retry record per source event.';

CREATE INDEX outbox_retries_next_attempt_idx
  ON core.outbox_retries (next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX outbox_retries_status_idx ON core.outbox_retries (status);
CREATE INDEX outbox_retries_tenant_idx ON core.outbox_retries (tenant_id);

ALTER TABLE core.outbox_retries ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbox_retries_tenant_select ON core.outbox_retries
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_outbox_retries_updated_at
  BEFORE UPDATE ON core.outbox_retries
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON core.outbox_retries TO authenticated;
GRANT ALL ON core.outbox_retries TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- Pending-events view: filter out events whose backoff window hasn't
-- elapsed, and events whose retry budget is exhausted.
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW core.v_cross_module_pending_events AS
SELECT o.id, o.tenant_id, o.module, o.event_type, o.entity_id, o.occurred_at, o.version, o.payload, o.metadata
FROM core.outbox o
LEFT JOIN core.outbox_retries r ON r.outbox_id = o.id
WHERE o.published_at IS NULL
  AND o.event_type IN ('sales.opportunity.won', 'logistics.shipment.delivered')
  AND (r.id IS NULL OR (r.status = 'pending' AND r.next_attempt_at <= now()))
ORDER BY o.occurred_at;

COMMENT ON VIEW core.v_cross_module_pending_events IS
  'Unpublished cross-module events ready for consumer pickup. Excludes events whose retry backoff window has not elapsed, and events whose retry budget is exhausted.';

-- ══════════════════════════════════════════════════════════════════════
-- Recording functions
-- ══════════════════════════════════════════════════════════════════════
--
-- record_outbox_retry: called on dispatch failure. Upserts the retry
-- row, increments attempt_count, sets next_attempt_at via exponential
-- backoff (base 10s, doubling, capped at 1 hour), flips status to
-- 'exhausted' once the attempt budget is spent.
--
-- mark_outbox_resolved: called on dispatch success after a prior
-- failure. Flips status to 'resolved' so retry history is queryable.
-- No-op when no retry row exists (the happy path: first-attempt
-- success).

CREATE OR REPLACE FUNCTION core.record_outbox_retry(
  p_outbox_id    uuid,
  p_tenant_id    uuid,
  p_error_message text,
  p_max_attempts integer DEFAULT 5
) RETURNS core.outbox_retries
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
DECLARE
  v_existing core.outbox_retries;
  v_new_attempt_count integer;
  v_backoff_seconds integer;
  v_new_status text;
  v_result core.outbox_retries;
BEGIN
  SELECT * INTO v_existing FROM core.outbox_retries WHERE outbox_id = p_outbox_id;
  v_new_attempt_count := COALESCE(v_existing.attempt_count, 0) + 1;
  -- Exponential backoff: 10s, 20s, 40s, 80s, … capped at 3600s.
  v_backoff_seconds := LEAST(3600, 10 * (2 ^ (v_new_attempt_count - 1))::integer);
  v_new_status := CASE
    WHEN v_new_attempt_count >= p_max_attempts THEN 'exhausted'
    ELSE 'pending'
  END;

  IF v_existing.id IS NULL THEN
    INSERT INTO core.outbox_retries (
      outbox_id, tenant_id, attempt_count, max_attempts, last_error,
      last_attempt_at, next_attempt_at, status
    ) VALUES (
      p_outbox_id, p_tenant_id, v_new_attempt_count, p_max_attempts, p_error_message,
      now(), now() + make_interval(secs => v_backoff_seconds), v_new_status
    ) RETURNING * INTO v_result;
  ELSE
    UPDATE core.outbox_retries
    SET attempt_count = v_new_attempt_count,
        last_error = p_error_message,
        last_attempt_at = now(),
        next_attempt_at = now() + make_interval(secs => v_backoff_seconds),
        status = v_new_status,
        updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION core.record_outbox_retry IS
  'Phase 5 — called by cross-module consumer on dispatch failure. Upserts retry row with exponential backoff (10s base, capped at 1h). Flips to exhausted after max_attempts.';

GRANT EXECUTE ON FUNCTION core.record_outbox_retry TO service_role;

CREATE OR REPLACE FUNCTION core.mark_outbox_resolved(p_outbox_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
  UPDATE core.outbox_retries SET status = 'resolved', updated_at = now()
  WHERE outbox_id = p_outbox_id AND status <> 'resolved';
$$;

COMMENT ON FUNCTION core.mark_outbox_resolved IS
  'Phase 5 — called by cross-module consumer on dispatch success. No-op when no retry row exists.';

GRANT EXECUTE ON FUNCTION core.mark_outbox_resolved TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- Monitoring helper
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.cross_module_retry_summary()
RETURNS TABLE (status text, total bigint, oldest timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
  SELECT status, count(*)::bigint, min(created_at)
  FROM core.outbox_retries
  GROUP BY status
  ORDER BY status;
$$;

COMMENT ON FUNCTION core.cross_module_retry_summary IS
  'Phase 5 — retry queue health summary. Use to spot stuck/exhausted events.';

GRANT EXECUTE ON FUNCTION core.cross_module_retry_summary TO service_role;
