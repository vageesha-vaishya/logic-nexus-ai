-- Phase 1 Slice B Part 2 — shadow-write trigger #3/17
-- public.domain_audit_log → core.audit_log
--
-- Source schema (per migration 20260317124500_*):
--   id, tenant_id, domain_id, action, actor_user_id, batch_id, metadata, created_at
--
-- subject_type = 'core.domain'  (the platform-domains object)
-- subject_id   = domain_id
-- action       = action
-- diff         = NULL  (this source doesn't capture before/after; the action label tells the story)
-- metadata     = source metadata + batch_id

CREATE OR REPLACE FUNCTION core.shadow_write_from_domain_audit_log()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.domain_id IS NULL THEN
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
    NEW.actor_user_id,
    CASE WHEN NEW.actor_user_id IS NULL THEN 'system' ELSE 'user' END,
    'core.domain',
    NEW.domain_id,
    NEW.action,
    NULL,
    -- Preserve source metadata + tag the batch_id when present.
    COALESCE(NEW.metadata, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object('batch_id', NEW.batch_id)),
    'public.domain_audit_log',
    NEW.id::text,
    -- Domain-config changes are infrastructure-level — 2 years is fine.
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_domain_audit_log failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_domain_audit_log_shadow_to_core
  AFTER INSERT ON public.domain_audit_log
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_domain_audit_log();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_domain_audit_log(
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
      FROM public.domain_audit_log
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL
        AND domain_id IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.domain_audit_log'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_domain_audit_log
  TO service_role, authenticated;
