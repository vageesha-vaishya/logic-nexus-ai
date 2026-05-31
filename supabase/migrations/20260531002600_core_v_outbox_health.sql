-- Phase 6 Step 51 — core.v_outbox_health saga consumer lag view.
--
-- Operational health for every saga consumer in the platform. If
-- the compliance gating-consumer crashes, or the do_not_contact
-- consumer falls behind, or the finance cross-module consumer
-- misses a delivery — this view surfaces it at a glance.
--
-- Grouped by (module, event_type) so each consumer's queue depth
-- + lag is one row. Restricted to the 8 saga event_types we
-- expose via v_cross_module_pending_events; non-saga outbox rows
-- (if any future module starts using the table differently)
-- don't pollute the health surface.
--
-- Stale threshold: oldest unpublished > 10 minutes. All our
-- consumers poll every 5s, so any event sitting unpublished past
-- 10min indicates either a crashed consumer, a consumer error
-- loop hitting outbox_retries backoff, or a saga consumer that
-- doesn't exist yet for that event_type (e.g. logistics.booking.
-- created has no consumer in this codebase right now).
--
-- Joins outbox_retries to surface "retries_pending_count" — the
-- subset of unpublished events that are currently in backoff
-- waiting for next_attempt_at. Separate from "fresh" unpublished
-- events because the consumer is actively (re)trying those vs
-- ignoring them entirely.
--
-- Service-role only — outbox + outbox_retries are infra tables
-- that authenticated users shouldn't enumerate.

CREATE OR REPLACE VIEW core.v_outbox_health AS
WITH saga_events AS (
  SELECT o.module, o.event_type, o.id, o.occurred_at, o.published_at
  FROM core.outbox o
  WHERE o.event_type IN (
    'sales.opportunity.won',
    'logistics.shipment.delivered',
    'sales.lead.created',
    'quotation.quote.send_requested',
    'logistics.booking.created',
    'finance.payment.created',
    'crm.do_not_contact.set',
    'crm.do_not_contact.cleared'
  )
),
retry_status AS (
  SELECT r.outbox_id
  FROM core.outbox_retries r
  WHERE r.status = 'pending'
)
SELECT
  e.module,
  e.event_type,
  count(*)::integer                                       AS total_count,
  count(*) FILTER (WHERE e.published_at IS NULL)::integer AS unpublished_count,
  count(*) FILTER (WHERE rs.outbox_id IS NOT NULL)::integer AS retries_pending_count,
  EXTRACT(EPOCH FROM (now() - MIN(e.occurred_at) FILTER (WHERE e.published_at IS NULL)))::integer
    AS oldest_unpublished_age_seconds,
  EXTRACT(EPOCH FROM (now() - MAX(e.occurred_at) FILTER (WHERE e.published_at IS NULL)))::integer
    AS newest_unpublished_age_seconds,
  MAX(e.published_at)                                      AS last_published_at,
  -- Stale = any unpublished row older than 10 minutes. Our consumers
  -- poll every 5s, so anything past 10min is a real problem.
  (
    EXTRACT(EPOCH FROM (now() - MIN(e.occurred_at) FILTER (WHERE e.published_at IS NULL))) > 600
  )::boolean                                                AS is_stale
FROM saga_events e
LEFT JOIN retry_status rs ON rs.outbox_id = e.id
GROUP BY e.module, e.event_type
ORDER BY e.module, e.event_type;

COMMENT ON VIEW core.v_outbox_health IS
  'Phase 6 Step 51 — per-saga-event-type consumer lag + queue depth. is_stale=true means oldest unpublished > 10 minutes (consumers poll every 5s, so 10min indicates real failure). Restricted to the 8 saga event_types in v_cross_module_pending_events.';

REVOKE ALL  ON core.v_outbox_health FROM PUBLIC;
GRANT SELECT ON core.v_outbox_health TO service_role;
