-- Phase 1 Slice B Part 2 — shadow-write trigger #13/17
-- public.mgl_quotation_audit_logs → core.audit_log
--
-- Source schema (per migration 20260307153000_mgl_main_template_*):
--   id, tenant_id NOT NULL ✓, quote_id, quote_version_id, rate_option_id,
--   action text, actor_id uuid, actor_email text, request_id text,
--   metadata jsonb NOT NULL DEFAULT '{}', created_at
--
-- This is MGL pricing-engine specific audit — rate-option-level events
-- from the multi-rate quotation engine.
--
-- subject_type = 'quotation.mgl_rate_option' when rate_option_id present
--              | 'quotation.version'       when only quote_version_id
--              | 'quotation.quote'         when only quote_id
-- subject_id   = COALESCE(rate_option_id, quote_version_id, quote_id)
-- diff         = NULL  (source captures action label + metadata only)
-- metadata     = NEW.metadata + {actor_email, request_id, denormalized parents}

CREATE OR REPLACE FUNCTION core.shadow_write_from_mgl_quotation_audit_logs()
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

  IF NEW.rate_option_id IS NOT NULL THEN
    v_subject_type := 'quotation.mgl_rate_option';
    v_subject_id   := NEW.rate_option_id;
  ELSIF NEW.quote_version_id IS NOT NULL THEN
    v_subject_type := 'quotation.version';
    v_subject_id   := NEW.quote_version_id;
  ELSIF NEW.quote_id IS NOT NULL THEN
    v_subject_type := 'quotation.quote';
    v_subject_id   := NEW.quote_id;
  ELSE
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
    NEW.actor_id,
    CASE WHEN NEW.actor_id IS NULL THEN 'system' ELSE 'user' END,
    v_subject_type,
    v_subject_id,
    NEW.action,
    NULL,
    COALESCE(NEW.metadata, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'actor_email',                  NEW.actor_email,
      'request_id',                   NEW.request_id,
      'parent_quote_id',              NEW.quote_id,
      'parent_quote_version_id',      NEW.quote_version_id,
      'parent_rate_option_id',        NEW.rate_option_id
    )),
    'public.mgl_quotation_audit_logs',
    NEW.id::text,
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_mgl_quotation_audit_logs failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mgl_quotation_audit_logs_shadow_to_core
  AFTER INSERT ON public.mgl_quotation_audit_logs
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_mgl_quotation_audit_logs();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_mgl_quotation_audit_logs(
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
      FROM public.mgl_quotation_audit_logs
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL
        AND COALESCE(rate_option_id, quote_version_id, quote_id) IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.mgl_quotation_audit_logs'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_mgl_quotation_audit_logs
  TO service_role, authenticated;
