-- Phase 6 Comms — saga-chain health view.
--
-- The three cross-module sagas in master plan §10 are now wired:
--   quotation.quote.sent.{internal,customer}   ← Step 5
--   compliance.screening.{failed,flagged}      ← Step 13
--   finance.invoice.overdue                     ← Step 53
--   logistics.shipment.exception                ← Step 54
--
-- Each chain has three live pieces (emitter trigger → core.notifications
-- → comms.deliveries via template render). When something silently breaks
-- (e.g. a tenant created before Step 15 has no template; the emitter
-- payload drifts from the template variables), operators currently have
-- to write the join themselves to notice.
--
-- This view returns one row per (tenant_id, intent_kind) with the three
-- health signals in line:
--   intents_emitted     — core.notifications rows the trigger produced
--   intents_with_template — has a template + version provisioned
--   deliveries_total    — comms.deliveries rows attempted from this intent
--   deliveries_delivered, deliveries_failed, deliveries_pending
--   last_emitted_at     — most-recent emit (NULL if never)
--   last_delivered_at   — most-recent delivered (NULL if never)
--   chain_status:
--     'never_fired'    — no intent rows; chain hasn't been exercised
--     'no_template'    — intents exist but no template registered
--     'no_dispatcher'  — intents + template exist but zero deliveries
--                        (dispatcher down or recipient never resolved)
--     'failing'        — every delivery for the chain has status='failed'
--     'healthy'        — at least one delivered + no recent failure spike
--
-- The view is tenant-scoped so RLS-aware admin pages get free per-tenant
-- isolation; operators with platform_admin can read all tenants.

CREATE OR REPLACE VIEW comms.v_saga_chain_health AS
WITH
intent_emits AS (
  SELECT
    n.tenant_id,
    n.intent_kind,
    count(*)              AS intents_emitted,
    max(n.created_at)     AS last_emitted_at
  FROM core.notifications n
  WHERE n.intent_kind IN (
    'quotation.quote.sent.internal',
    'quotation.quote.sent.customer',
    'compliance.screening.failed',
    'compliance.screening.flagged',
    'finance.invoice.overdue',
    'logistics.shipment.exception'
  )
  GROUP BY n.tenant_id, n.intent_kind
),
templates AS (
  SELECT
    t.tenant_id,
    t.intent_kind,
    count(*) FILTER (WHERE t.current_version_id IS NOT NULL) AS templates_with_version
  FROM comms.templates t
  WHERE t.intent_kind IN (
    'quotation.quote.sent.internal',
    'quotation.quote.sent.customer',
    'compliance.screening.failed',
    'compliance.screening.flagged',
    'finance.invoice.overdue',
    'logistics.shipment.exception'
  )
  GROUP BY t.tenant_id, t.intent_kind
),
deliveries AS (
  SELECT
    d.tenant_id,
    n.intent_kind,
    count(*) AS deliveries_total,
    count(*) FILTER (WHERE d.status = 'delivered') AS deliveries_delivered,
    count(*) FILTER (WHERE d.status = 'failed')    AS deliveries_failed,
    count(*) FILTER (WHERE d.status IN ('pending','queued','sending'))
                                                   AS deliveries_pending,
    max(d.delivered_at) AS last_delivered_at
  FROM comms.deliveries d
  JOIN core.notifications n ON n.id = d.notification_id
  WHERE n.intent_kind IN (
    'quotation.quote.sent.internal',
    'quotation.quote.sent.customer',
    'compliance.screening.failed',
    'compliance.screening.flagged',
    'finance.invoice.overdue',
    'logistics.shipment.exception'
  )
  GROUP BY d.tenant_id, n.intent_kind
)
SELECT
  COALESCE(i.tenant_id, t.tenant_id, d.tenant_id) AS tenant_id,
  COALESCE(i.intent_kind, t.intent_kind, d.intent_kind) AS intent_kind,
  COALESCE(i.intents_emitted, 0) AS intents_emitted,
  COALESCE(t.templates_with_version, 0) > 0 AS template_registered,
  COALESCE(d.deliveries_total, 0)         AS deliveries_total,
  COALESCE(d.deliveries_delivered, 0)     AS deliveries_delivered,
  COALESCE(d.deliveries_failed, 0)        AS deliveries_failed,
  COALESCE(d.deliveries_pending, 0)       AS deliveries_pending,
  i.last_emitted_at,
  d.last_delivered_at,
  CASE
    WHEN COALESCE(i.intents_emitted, 0) = 0 THEN 'never_fired'
    WHEN COALESCE(t.templates_with_version, 0) = 0 THEN 'no_template'
    WHEN COALESCE(d.deliveries_total, 0) = 0 THEN 'no_dispatcher'
    WHEN COALESCE(d.deliveries_delivered, 0) = 0
         AND COALESCE(d.deliveries_failed, 0) > 0 THEN 'failing'
    ELSE 'healthy'
  END AS chain_status
FROM intent_emits i
FULL OUTER JOIN templates t
  ON i.tenant_id = t.tenant_id AND i.intent_kind = t.intent_kind
FULL OUTER JOIN deliveries d
  ON COALESCE(i.tenant_id, t.tenant_id) = d.tenant_id
 AND COALESCE(i.intent_kind, t.intent_kind) = d.intent_kind;

COMMENT ON VIEW comms.v_saga_chain_health IS
  'Phase 6 Comms: per (tenant_id, intent_kind) health snapshot for the six canonical saga chains. chain_status enum: never_fired | no_template | no_dispatcher | failing | healthy.';

GRANT SELECT ON comms.v_saga_chain_health TO authenticated, service_role;
