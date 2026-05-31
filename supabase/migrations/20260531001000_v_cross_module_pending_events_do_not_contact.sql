-- Phase 6 Step 29 — extend v_cross_module_pending_events for crm.do_not_contact.set.
--
-- Step 28's emitter writes to core.outbox, but the consumer view
-- (last rebuilt in Step 20) doesn't include the new event_type, so
-- the comms-api consumer added in Step 30 would poll zero rows even
-- after the trigger fires.
--
-- Pattern matches Step 20 exactly: keep the retry-backoff JOIN from
-- 20260529270000, widen the event_type IN (...) list. Each consumer
-- still filters by its own subset in code.

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
    'finance.payment.created',
    -- Phase 6 CRM → comms suppression bridge (comms.md §5)
    'crm.do_not_contact.set'
  )
  AND (r.id IS NULL OR (r.status = 'pending' AND r.next_attempt_at <= now()))
ORDER BY o.occurred_at;

COMMENT ON VIEW core.v_cross_module_pending_events IS
  'Unpublished cross-module events ready for consumer pickup. Excludes events whose retry backoff window has not elapsed, and events whose retry budget is exhausted. Phase 6 Step 29 added crm.do_not_contact.set alongside the finance + gating chains.';

GRANT SELECT ON core.v_cross_module_pending_events TO service_role;
