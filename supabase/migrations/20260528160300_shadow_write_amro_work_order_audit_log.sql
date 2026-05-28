-- Phase 1 Slice B Part 2 — shadow-write trigger #5/17
-- amro_work_order_audit_log → core.audit_log
--
-- Note: table lives in public.* (per `amro_work_order_audit_log` not
-- prefixed in the source). The amro.* schema lift happens in Phase 8.
--
-- Source schema (per migration 20260412100000_amro_work_order_enhanced_schema.sql):
--   id, tenant_id,
--   entity_type CHECK IN ('work_order','task','material','compliance','certificate','resource_assignment'),
--   entity_id,
--   action CHECK IN ('created','updated','deleted','status_changed','resource_assigned',
--                    'compliance_recorded','certificate_issued','task_completed'),
--   old_values JSONB, new_values JSONB, changed_fields TEXT[],
--   performed_by, performed_at, ip_address INET, user_agent, checksum TEXT NOT NULL
--
-- subject_type = 'amro.' || entity_type
--   Examples: 'amro.work_order', 'amro.task', 'amro.material',
--             'amro.compliance', 'amro.certificate', 'amro.resource_assignment'
-- subject_id   = entity_id
-- action       = action  (source-side enum is rich; we preserve as-is)
-- diff         = {before: old_values, after: new_values, changed_fields}
-- metadata     = {ip_address, user_agent, checksum, source: 'amro_work_order_audit_log'}

CREATE OR REPLACE FUNCTION core.shadow_write_from_amro_work_order_audit_log()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_subject_type text;
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.entity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Compose schema-qualified subject_type per master §2.4.
  v_subject_type := 'amro.' || lower(NEW.entity_type);

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
    NEW.performed_at,
    NEW.performed_by,
    CASE WHEN NEW.performed_by IS NULL THEN 'system' ELSE 'user' END,
    v_subject_type,
    NEW.entity_id,
    NEW.action,
    -- AMRO captures before/after + the explicit changed_fields list.
    jsonb_strip_nulls(jsonb_build_object(
      'before',         NEW.old_values,
      'after',          NEW.new_values,
      'changed_fields', NEW.changed_fields
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'ip_address', NEW.ip_address::text,
      'user_agent', NEW.user_agent,
      'checksum',   NEW.checksum
    )),
    'public.amro_work_order_audit_log',
    NEW.id::text,
    -- Aviation maintenance audit trail is regulator-evidence: FAA / EASA /
    -- CAAC / SACAA. 7-year retention is the regulatory baseline.
    'compliance_evidence_7y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_amro_work_order_audit_log failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_amro_work_order_audit_log_shadow_to_core
  AFTER INSERT ON public.amro_work_order_audit_log
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_amro_work_order_audit_log();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_amro_work_order_audit_log(
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
      FROM public.amro_work_order_audit_log
      WHERE performed_at >= p_start AND performed_at < p_end
        AND tenant_id IS NOT NULL AND entity_id IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.amro_work_order_audit_log'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_amro_work_order_audit_log
  TO service_role, authenticated;
