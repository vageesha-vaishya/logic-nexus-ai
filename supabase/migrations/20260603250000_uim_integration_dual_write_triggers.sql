-- Phase 7 UIM Step 2 — dual-write triggers from platform.integration_*
-- into the uim.* mirrors created in Step 1 (commit 8c0f701c).
--
-- Matches the Phase 5/6 Step 6 pattern:
--   AFTER INSERT / UPDATE / DELETE triggers replay every change into
--   the canonical mirror.
--   uim.integrations_drift_check() helper that returns one row per
--   mirror table with delta=0 when the dual-write is in sync.
--
-- platform.* stays authoritative until Step 9-equivalent (FK rewires
-- + DROP TABLE). The triggers run as SECURITY DEFINER so they bypass
-- any RLS on the mirror tables.

-- ── Trigger functions ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION uim.tg_mirror_integrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO uim, platform, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM uim.integrations WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO uim.integrations
    VALUES (NEW.*)
    ON CONFLICT (id) DO UPDATE SET
      kind             = EXCLUDED.kind,
      name             = EXCLUDED.name,
      vendor           = EXCLUDED.vendor,
      tenant_id        = EXCLUDED.tenant_id,
      franchise_id     = EXCLUDED.franchise_id,
      scope_json       = EXCLUDED.scope_json,
      vendor_risk_class= EXCLUDED.vendor_risk_class,
      owner_user_id    = EXCLUDED.owner_user_id,
      lifecycle_state  = EXCLUDED.lifecycle_state,
      metadata         = EXCLUDED.metadata,
      updated_at       = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION uim.tg_mirror_integration_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO uim, platform, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM uim.integration_credentials WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO uim.integration_credentials
    VALUES (NEW.*)
    ON CONFLICT (id) DO UPDATE SET
      integration_id    = EXCLUDED.integration_id,
      credential_type   = EXCLUDED.credential_type,
      vault_secret_name = EXCLUDED.vault_secret_name,
      rotation_policy   = EXCLUDED.rotation_policy,
      expires_at        = EXCLUDED.expires_at,
      last_rotated_at   = EXCLUDED.last_rotated_at,
      last_used_at      = EXCLUDED.last_used_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION uim.tg_mirror_integration_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO uim, platform, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM uim.integration_log WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  -- integration_log uses bigint id (sequence-backed) so INSERT must
  -- pass through the id verbatim. Sequence on uim.* side is
  -- independent, but we never INSERT directly into uim.integration_log
  -- — this trigger is its only writer once the source is dropped.
  INSERT INTO uim.integration_log
    VALUES (NEW.*)
    ON CONFLICT (id) DO UPDATE SET
      ts            = EXCLUDED.ts,
      direction     = EXCLUDED.direction,
      integration_id= EXCLUDED.integration_id,
      tenant_id     = EXCLUDED.tenant_id,
      franchise_id  = EXCLUDED.franchise_id,
      user_id       = EXCLUDED.user_id,
      request_id    = EXCLUDED.request_id,
      method        = EXCLUDED.method,
      url_path      = EXCLUDED.url_path,
      status        = EXCLUDED.status,
      latency_ms    = EXCLUDED.latency_ms,
      bytes_in      = EXCLUDED.bytes_in,
      bytes_out     = EXCLUDED.bytes_out,
      body_redacted = EXCLUDED.body_redacted;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION uim.tg_mirror_integration_dlq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO uim, platform, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM uim.integration_dlq WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO uim.integration_dlq
    VALUES (NEW.*)
    ON CONFLICT (id) DO UPDATE SET
      integration_id  = EXCLUDED.integration_id,
      payload         = EXCLUDED.payload,
      error           = EXCLUDED.error,
      attempts        = EXCLUDED.attempts,
      first_failed_at = EXCLUDED.first_failed_at,
      last_failed_at  = EXCLUDED.last_failed_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION uim.tg_mirror_webhook_subscriptions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO uim, platform, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM uim.webhook_subscriptions WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO uim.webhook_subscriptions
    VALUES (NEW.*)
    ON CONFLICT (id) DO UPDATE SET
      integration_id    = EXCLUDED.integration_id,
      tenant_id         = EXCLUDED.tenant_id,
      target_url        = EXCLUDED.target_url,
      event_filter      = EXCLUDED.event_filter,
      signing_secret_id = EXCLUDED.signing_secret_id,
      retry_policy      = EXCLUDED.retry_policy,
      last_delivery_ts  = EXCLUDED.last_delivery_ts,
      status            = EXCLUDED.status;
  RETURN NEW;
END;
$$;

-- ── Triggers ───────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_uim_mirror_integrations ON platform.integrations;
CREATE TRIGGER trg_uim_mirror_integrations
  AFTER INSERT OR UPDATE OR DELETE ON platform.integrations
  FOR EACH ROW EXECUTE FUNCTION uim.tg_mirror_integrations();

DROP TRIGGER IF EXISTS trg_uim_mirror_integration_credentials ON platform.integration_credentials;
CREATE TRIGGER trg_uim_mirror_integration_credentials
  AFTER INSERT OR UPDATE OR DELETE ON platform.integration_credentials
  FOR EACH ROW EXECUTE FUNCTION uim.tg_mirror_integration_credentials();

DROP TRIGGER IF EXISTS trg_uim_mirror_integration_log ON platform.integration_log;
CREATE TRIGGER trg_uim_mirror_integration_log
  AFTER INSERT OR UPDATE OR DELETE ON platform.integration_log
  FOR EACH ROW EXECUTE FUNCTION uim.tg_mirror_integration_log();

DROP TRIGGER IF EXISTS trg_uim_mirror_integration_dlq ON platform.integration_dlq;
CREATE TRIGGER trg_uim_mirror_integration_dlq
  AFTER INSERT OR UPDATE OR DELETE ON platform.integration_dlq
  FOR EACH ROW EXECUTE FUNCTION uim.tg_mirror_integration_dlq();

DROP TRIGGER IF EXISTS trg_uim_mirror_webhook_subscriptions ON platform.webhook_subscriptions;
CREATE TRIGGER trg_uim_mirror_webhook_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON platform.webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION uim.tg_mirror_webhook_subscriptions();

-- ── Drift check helper ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION uim.integrations_drift_check()
RETURNS TABLE(metric text, delta bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO uim, platform, pg_catalog
AS $$
  SELECT 'integrations_minus_mirror',
         (SELECT count(*) FROM platform.integrations)
       - (SELECT count(*) FROM uim.integrations)
  UNION ALL
  SELECT 'integration_credentials_minus_mirror',
         (SELECT count(*) FROM platform.integration_credentials)
       - (SELECT count(*) FROM uim.integration_credentials)
  UNION ALL
  SELECT 'integration_log_minus_mirror',
         (SELECT count(*) FROM platform.integration_log)
       - (SELECT count(*) FROM uim.integration_log)
  UNION ALL
  SELECT 'integration_dlq_minus_mirror',
         (SELECT count(*) FROM platform.integration_dlq)
       - (SELECT count(*) FROM uim.integration_dlq)
  UNION ALL
  SELECT 'webhook_subscriptions_minus_mirror',
         (SELECT count(*) FROM platform.webhook_subscriptions)
       - (SELECT count(*) FROM uim.webhook_subscriptions);
$$;

COMMENT ON FUNCTION uim.integrations_drift_check() IS
  'Phase 7 UIM dual-write sentinel. Returns one row per platform.integration_* mirror with delta=0 when in sync.';

GRANT EXECUTE ON FUNCTION uim.integrations_drift_check() TO authenticated, service_role;
