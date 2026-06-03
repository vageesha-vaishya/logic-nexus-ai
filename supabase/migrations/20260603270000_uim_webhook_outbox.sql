-- Phase 7 UIM Step 6 follow-up — webhook outbox + outbound dispatcher.
--
-- Adds uim.webhook_outbox as the producer surface that was missing
-- when Step 6 shipped. Producers (services that emit domain events)
-- write rows here; the dispatcher tick drains them, signs + POSTs,
-- and on transient failure inserts into uim.integration_dlq so the
-- existing Step 6 retry processor picks them up.
--
-- Two-stage flow:
--   pending   → first delivery attempt by the outbox dispatcher
--   delivered → 2xx response, terminal
--   failed    → permanent 4xx OR max_attempts reached, terminal
--               (transient failures escalate to uim.integration_dlq
--               so the existing retry view + backoff function takes
--               over — keeps backoff logic in one place.)

SET search_path = public;

BEGIN;

CREATE TABLE IF NOT EXISTS uim.webhook_outbox (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id    uuid        NOT NULL REFERENCES uim.webhook_subscriptions(id) ON DELETE CASCADE,
  event_type         text        NOT NULL,
  payload            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','delivered','failed')),
  attempts           int         NOT NULL DEFAULT 0,
  max_attempts       int         NOT NULL DEFAULT 1,
  scheduled_at       timestamptz NOT NULL DEFAULT now(),
  last_attempted_at  timestamptz,
  last_error         text,
  delivered_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE uim.webhook_outbox IS
  'Phase 7 UIM Step 6 follow-up: outbound webhook event producer surface. Dispatcher drains pending rows; transient failures escalate to uim.integration_dlq for retry.';

CREATE INDEX IF NOT EXISTS idx_uim_webhook_outbox_tenant
  ON uim.webhook_outbox (tenant_id);

CREATE INDEX IF NOT EXISTS idx_uim_webhook_outbox_pending_ready
  ON uim.webhook_outbox (scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_uim_webhook_outbox_subscription
  ON uim.webhook_outbox (subscription_id);

ALTER TABLE uim.webhook_outbox ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read. Service role bypasses RLS so the dispatcher
-- (which doesn't carry a tenant context) keeps full visibility.
CREATE POLICY uim_webhook_outbox_tenant_read ON uim.webhook_outbox
  FOR SELECT USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

-- ── View: pending rows whose scheduled_at has elapsed ──────────────
-- Joined with webhook_subscriptions for target_url + signing_secret_id
-- so the dispatcher can deliver in one query.
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
  ws.status AS subscription_status
FROM uim.webhook_outbox o
JOIN uim.webhook_subscriptions ws ON ws.id = o.subscription_id
WHERE o.status = 'pending'
  AND o.scheduled_at <= now()
  AND ws.status = 'active'
ORDER BY o.scheduled_at ASC;

COMMENT ON VIEW uim.v_outbox_pending IS
  'Phase 7 UIM Step 6 follow-up: pending outbox rows whose scheduled_at has elapsed AND whose owning subscription is still active. Joined for target_url + signing_secret_id so the dispatcher delivers in one query.';

-- ── Trigger: keep updated_at fresh on every UPDATE ─────────────────
CREATE OR REPLACE FUNCTION uim.tg_touch_webhook_outbox()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS uim_webhook_outbox_touch ON uim.webhook_outbox;
CREATE TRIGGER uim_webhook_outbox_touch
  BEFORE UPDATE ON uim.webhook_outbox
  FOR EACH ROW
  EXECUTE FUNCTION uim.tg_touch_webhook_outbox();

COMMIT;
