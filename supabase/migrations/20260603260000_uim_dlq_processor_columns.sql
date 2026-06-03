-- Phase 7 UIM Step 6 — DLQ processor schema prep.
--
-- The original platform.integration_dlq (which our Step 1 mirror copied)
-- has only id / integration_id / payload / error / attempts /
-- first_failed_at / last_failed_at. That isn't enough to retry a
-- failed webhook delivery: the retry needs to know which webhook
-- subscription the event was destined for so we can look up
-- target_url + signing_secret_id, and it needs a max_attempts cap so
-- the processor knows when to give up.
--
-- This migration adds two nullable columns to BOTH the platform
-- source and the uim mirror, plus rewires the mirror trigger.
-- Columns are nullable so existing 0-row tables stay loadable; new
-- rows are expected to fill them in.

-- ── 1. Upstream platform.integration_dlq ───────────────────────────
ALTER TABLE platform.integration_dlq
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES platform.webhook_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN platform.integration_dlq.subscription_id IS
  'Phase 7 UIM: links a failed delivery to its uim.webhook_subscriptions source so the DLQ processor can find target_url + signing_secret on retry.';
COMMENT ON COLUMN platform.integration_dlq.max_attempts IS
  'Phase 7 UIM: retry cap. When attempts >= max_attempts the row stays in DLQ but the processor stops trying.';

-- ── 2. Mirror — uim.integration_dlq ────────────────────────────────
ALTER TABLE uim.integration_dlq
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES uim.webhook_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;

-- ── 3. Rewire the dual-write trigger function ──────────────────────
-- The Step 2 mirror function used INSERT … VALUES (NEW.*) which is
-- positional. Adding columns to both sides keeps that working, but
-- now we explicitly enumerate the column list in the ON CONFLICT
-- DO UPDATE to include the new fields. (DELETE branch unchanged.)
CREATE OR REPLACE FUNCTION uim.tg_mirror_integration_dlq()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO uim, platform, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM uim.integration_dlq WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO uim.integration_dlq VALUES (NEW.*)
    ON CONFLICT (id) DO UPDATE SET
      integration_id  = EXCLUDED.integration_id,
      payload         = EXCLUDED.payload,
      error           = EXCLUDED.error,
      attempts        = EXCLUDED.attempts,
      first_failed_at = EXCLUDED.first_failed_at,
      last_failed_at  = EXCLUDED.last_failed_at,
      subscription_id = EXCLUDED.subscription_id,
      max_attempts    = EXCLUDED.max_attempts;
  RETURN NEW;
END;
$$;

-- ── 4. Retryability helper view (operational shortcut) ─────────────
-- Encapsulates the "is this row ready to retry" logic so the
-- processor's SQL stays trivial. Backoff is exponential with base
-- 30s and ceiling 1h, matching the comms-api delivery-worker.
CREATE OR REPLACE FUNCTION uim.dlq_retry_backoff_seconds(p_attempts integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEAST(30 * power(4, GREATEST(p_attempts - 1, 0))::integer, 3600);
$$;

CREATE OR REPLACE VIEW uim.v_dlq_retryable AS
SELECT
  d.id,
  d.tenant_id,
  d.integration_id,
  d.subscription_id,
  d.payload,
  d.error,
  d.attempts,
  d.max_attempts,
  d.first_failed_at,
  d.last_failed_at,
  ws.target_url,
  ws.event_filter,
  ws.signing_secret_id,
  ws.retry_policy,
  d.last_failed_at + (uim.dlq_retry_backoff_seconds(d.attempts) || ' seconds')::interval AS ready_at
FROM uim.integration_dlq d
LEFT JOIN uim.webhook_subscriptions ws ON ws.id = d.subscription_id
WHERE d.attempts < d.max_attempts
  AND d.last_failed_at + (uim.dlq_retry_backoff_seconds(d.attempts) || ' seconds')::interval <= now();

COMMENT ON VIEW uim.v_dlq_retryable IS
  'Phase 7 UIM: DLQ rows whose backoff window has elapsed and which have attempts left. Joined with their owning webhook_subscriptions for target_url + signing_secret_id.';

-- We need d.tenant_id to exist on integration_dlq for the view.
-- Today's platform.integration_dlq has no tenant_id column — let's
-- add it (nullable) so multi-tenant scoping works.
ALTER TABLE platform.integration_dlq
  ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE uim.integration_dlq
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- And include it in the mirror trigger's UPDATE list.
CREATE OR REPLACE FUNCTION uim.tg_mirror_integration_dlq()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO uim, platform, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM uim.integration_dlq WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO uim.integration_dlq VALUES (NEW.*)
    ON CONFLICT (id) DO UPDATE SET
      integration_id  = EXCLUDED.integration_id,
      payload         = EXCLUDED.payload,
      error           = EXCLUDED.error,
      attempts        = EXCLUDED.attempts,
      first_failed_at = EXCLUDED.first_failed_at,
      last_failed_at  = EXCLUDED.last_failed_at,
      subscription_id = EXCLUDED.subscription_id,
      max_attempts    = EXCLUDED.max_attempts,
      tenant_id       = EXCLUDED.tenant_id;
  RETURN NEW;
END;
$$;

GRANT SELECT ON uim.v_dlq_retryable TO authenticated, service_role;
