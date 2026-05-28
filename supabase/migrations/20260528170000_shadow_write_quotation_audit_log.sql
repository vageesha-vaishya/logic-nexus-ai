-- Phase 1 Slice B Part 2 — shadow-write trigger #10/17
-- public.quotation_audit_log → core.audit_log
--
-- Source schema (per migration 20251119135002_*):
--   id, tenant_id (NOT NULL ✓), quote_id, quotation_version_id,
--   quotation_version_option_id, action, entity_type, entity_id, user_id,
--   changes JSONB, metadata JSONB, created_at
--
-- This is the comprehensive quotation audit. Polymorphic via entity_type;
-- entity_id is the specific row. quote_id / quotation_version_id /
-- quotation_version_option_id are denormalized parent pointers.
--
-- subject_type = 'quotation.' || lower(entity_type)
--   Common entity_type values: 'quote', 'quotation_version',
--                              'quotation_version_option', 'quotation_version_option_leg'
-- subject_id   = entity_id  (the specific entity that was acted on)
-- action       = action
-- diff         = changes  (source stores diff as single jsonb blob)
-- metadata     = NEW.metadata + denormalized parent pointers for cross-ref

CREATE OR REPLACE FUNCTION core.shadow_write_from_quotation_audit_log()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_subject_type text;
  v_subject_id   uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_subject_id := NEW.entity_id;
  IF v_subject_id IS NULL THEN
    -- Fall back to whichever parent ref is non-null for the row's intent.
    v_subject_id := COALESCE(
      NEW.quotation_version_option_id,
      NEW.quotation_version_id,
      NEW.quote_id
    );
  END IF;
  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_subject_type := 'quotation.' || lower(COALESCE(NEW.entity_type, 'unknown'));

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
    v_subject_type,
    v_subject_id,
    NEW.action,
    NEW.changes,
    COALESCE(NEW.metadata, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'parent_quote_id',                     NEW.quote_id,
      'parent_quotation_version_id',         NEW.quotation_version_id,
      'parent_quotation_version_option_id',  NEW.quotation_version_option_id
    )),
    'public.quotation_audit_log',
    NEW.id::text,
    -- Quotations are commercial records — retain longer than general default
    -- so disputes (price challenge, contract terms) have audit trail.
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_quotation_audit_log failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quotation_audit_log_shadow_to_core
  AFTER INSERT ON public.quotation_audit_log
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_quotation_audit_log();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_quotation_audit_log(
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
      FROM public.quotation_audit_log
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL
        AND COALESCE(entity_id, quotation_version_option_id, quotation_version_id, quote_id) IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.quotation_audit_log'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_quotation_audit_log
  TO service_role, authenticated;
