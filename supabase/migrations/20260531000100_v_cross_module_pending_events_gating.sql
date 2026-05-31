-- Phase 6 Step 20 — extend v_cross_module_pending_events to gating events.
--
-- 20260529190000 created the view filtered to the two Phase 5 finance
-- chains (sales.opportunity.won + logistics.shipment.delivered).
-- 20260529270000 rebuilt it to JOIN core.outbox_retries for exponential
-- backoff. Neither slice included the gating events the compliance-api
-- consumer polls for — so the consumer at HEAD reads zero rows even
-- after Step 19 emits sales.lead.created into core.outbox.
--
-- This rebuild keeps the retry-backoff semantics from 20260529270000
-- and widens the event_type filter to include the four GATING_EVENT_
-- TYPES the compliance-api gating-consumer expects (see
-- services/compliance-api/src/types/compliance.types.ts).
--
-- Finance + compliance both poll the same view; each consumer filters
-- by its own event_type set in code (.in('event_type', [...])). The
-- view-level filter just keeps unrelated events (like
-- quotation.quote.sent intents emitted to core.notifications) out of
-- the pickup set.

CREATE OR REPLACE VIEW core.v_cross_module_pending_events AS
SELECT o.id, o.tenant_id, o.module, o.event_type, o.entity_id,
       o.occurred_at, o.version, o.payload, o.metadata
FROM core.outbox o
LEFT JOIN core.outbox_retries r ON r.outbox_id = o.id
WHERE o.published_at IS NULL
  AND o.event_type IN (
    -- Phase 5 finance chains
    'sales.opportunity.won',
    'logistics.shipment.delivered',
    -- Phase 6 compliance gating chains (compliance.md §5)
    'sales.lead.created',
    'quotation.quote.send_requested',
    'logistics.booking.created',
    'finance.payment.created'
  )
  AND (r.id IS NULL OR (r.status = 'pending' AND r.next_attempt_at <= now()))
ORDER BY o.occurred_at;

COMMENT ON VIEW core.v_cross_module_pending_events IS
  'Unpublished cross-module events ready for consumer pickup. Excludes events whose retry backoff window has not elapsed, and events whose retry budget is exhausted. Phase 6 Step 20 added the 4 compliance gating event types alongside the original Phase 5 finance chains.';

GRANT SELECT ON core.v_cross_module_pending_events TO service_role;
