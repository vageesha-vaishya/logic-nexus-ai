-- Phase 7 UIM Step 7.4 — extend v_outbox_pending with integration metadata.
--
-- The outbox dispatcher now consults the connector registry (services/
-- uim-api/src/connectors/registry.ts) when a row's integration has a
-- registered adapter. The view needs to surface integration_id + vendor
-- + direction so the dispatcher can look up the right adapter without
-- a second SQL round trip per row.
--
-- Applied to prod 2026-06-03.

SET search_path = public;

BEGIN;

CREATE OR REPLACE VIEW uim.v_outbox_pending AS
SELECT
  o.id,
  o.tenant_id,
  o.subscription_id,
  o.event_type,
  o.payload,
  o.attempts,
  o.max_attempts,
  o.scheduled_at,
  o.created_at,
  ws.target_url,
  ws.signing_secret_id,
  ws.event_filter,
  ws.status AS subscription_status,
  ws.integration_id,
  ig.vendor,
  ig.name AS integration_name,
  ig.direction AS integration_direction
FROM uim.webhook_outbox o
JOIN uim.webhook_subscriptions ws ON ws.id = o.subscription_id
LEFT JOIN uim.integrations ig ON ig.id = ws.integration_id
WHERE o.status = 'pending'
  AND o.scheduled_at <= now()
  AND ws.status = 'active';

COMMENT ON VIEW uim.v_outbox_pending IS
  'Phase 7 UIM Step 6 follow-up + Step 7.4: pending outbox rows joined with active subscription + integration metadata (vendor + direction). The dispatcher reads target_url + signing_secret_id + vendor (for adapter lookup) in one query.';

COMMIT;
