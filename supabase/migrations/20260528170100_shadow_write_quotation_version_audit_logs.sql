-- Phase 1 Slice B Part 2 — shadow-write trigger #11/17
-- public.quotation_version_audit_logs → core.audit_log
--
-- Source schema (per migration 20260227000001_*):
--   id, quotation_version_id (FK → quotation_versions), action VARCHAR(50),
--   performed_by, details JSONB, created_at
--   ⚠ NO tenant_id COLUMN — must JOIN to quotation_versions to derive it.
--
-- subject_type = 'quotation.version'
-- subject_id   = quotation_version_id
-- action       = action  (UPPERCASE in source: 'CREATED','UPDATED','STATUS_CHANGE','PURGED')
-- diff         = details
-- metadata     = NEW.details merged + denormalized parent ref

CREATE OR REPLACE FUNCTION core.shadow_write_from_quotation_version_audit_logs()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NEW.quotation_version_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- JOIN-derive tenant_id from the parent quotation_versions row.
  -- If the parent is gone (CASCADE delete in flight), skip — we can't write
  -- without a tenant_id.
  SELECT qv.tenant_id INTO v_tenant_id
  FROM public.quotation_versions qv
  WHERE qv.id = NEW.quotation_version_id;

  IF v_tenant_id IS NULL THEN
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
    v_tenant_id,
    NEW.created_at,
    NEW.performed_by,
    CASE WHEN NEW.performed_by IS NULL THEN 'system' ELSE 'user' END,
    'quotation.version',
    NEW.quotation_version_id,
    lower(NEW.action),                                             -- normalise to lowercase per core convention
    NEW.details,
    jsonb_strip_nulls(jsonb_build_object(
      'source_action_uppercase', NEW.action                         -- preserve original case for forensic exactness
    )),
    'public.quotation_version_audit_logs',
    NEW.id::text,
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_quotation_version_audit_logs failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quotation_version_audit_logs_shadow_to_core
  AFTER INSERT ON public.quotation_version_audit_logs
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_quotation_version_audit_logs();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_quotation_version_audit_logs(
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
      SELECT qval.id::text AS src_id
      FROM public.quotation_version_audit_logs qval
      JOIN public.quotation_versions qv ON qv.id = qval.quotation_version_id
      WHERE qval.created_at >= p_start AND qval.created_at < p_end
        AND qv.tenant_id IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.quotation_version_audit_logs'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_quotation_version_audit_logs
  TO service_role, authenticated;
