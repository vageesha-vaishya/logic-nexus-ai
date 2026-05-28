-- Phase 1 Slice B Part 2 — shadow-write trigger #2/17
-- public.email_audit_log → core.audit_log
--
-- Follows the canonical template from 20260528150100_shadow_write_platform_audit_log.sql.
--
-- Source schema (per migration 20260111142014_*):
--   id, tenant_id, franchise_id, email_id, scheduled_email_id,
--   event_type CHECK IN ('sent','delivered','opened','clicked','bounced','failed','scheduled','cancelled'),
--   event_data JSONB, user_id, ip_address, user_agent, created_at
--
-- subject_type = 'comms.email'  (master §2.4)
-- subject_id   = email_id  (or scheduled_email_id if email_id is null)
-- action       = event_type
-- diff         = event_data (raw)
-- metadata     = {ip_address, user_agent, franchise_id, target_email_id, scheduled_email_id}

CREATE OR REPLACE FUNCTION core.shadow_write_from_email_audit_log()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_subject_id uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prefer email_id; fall back to scheduled_email_id; if neither, skip.
  v_subject_id := COALESCE(NEW.email_id, NEW.scheduled_email_id);
  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO core.audit_log (
    tenant_id,
    occurred_at,
    actor_user_id,
    actor_kind,
    subject_type,
    subject_id,
    action,
    diff,
    metadata,
    shadow_source_table,
    shadow_source_id,
    retention_class
  ) VALUES (
    NEW.tenant_id,
    NEW.created_at,
    NEW.user_id,
    CASE WHEN NEW.user_id IS NULL THEN 'system' ELSE 'user' END,
    'comms.email',
    v_subject_id,
    NEW.event_type,
    NEW.event_data,
    jsonb_strip_nulls(jsonb_build_object(
      'ip_address',          NEW.ip_address::text,
      'user_agent',          NEW.user_agent,
      'franchise_id',        NEW.franchise_id,
      'scheduled_email_id',  CASE WHEN NEW.email_id IS NOT NULL THEN NEW.scheduled_email_id ELSE NULL END
    )),
    'public.email_audit_log',
    NEW.id::text,
    -- Email events have moderate retention; CAN-SPAM in US requires 2-3 years
    -- for marketing comms records; DPDP (India) gives consumers a 6-year
    -- window to request access. 2 years is the platform default; CRM can
    -- override via policy.
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_email_audit_log failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_audit_log_shadow_to_core
  AFTER INSERT ON public.email_audit_log
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_email_audit_log();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_email_audit_log(
  p_start timestamptz,
  p_end   timestamptz
) RETURNS TABLE (
  source_rows        bigint,
  shadow_rows        bigint,
  unshadowed_rows    bigint,
  shadow_unique_rows bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  WITH
    src AS (
      SELECT id::text AS src_id
      FROM public.email_audit_log
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL
        AND COALESCE(email_id, scheduled_email_id) IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.email_audit_log'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_email_audit_log
  TO service_role, authenticated;
