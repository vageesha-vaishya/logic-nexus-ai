-- Phase 1 Slice B Part 2 — shadow-write trigger #4/17
-- public.admin_override_audit → core.audit_log
--
-- Source schema (per migration 20260115000004_strict_rls_override.sql):
--   id, user_id, tenant_id, franchise_id, enabled BOOLEAN, created_at
--
-- This table audits when platform/tenant admin enables or disables a
-- strict-RLS-override flag for a user. Forensic-heavy — admins poking RLS
-- holes for emergency access is exactly what compliance reviewers care about.
--
-- subject_type = 'core.user'  (the user whose access was overridden)
-- subject_id   = user_id      (the target user, not the actor)
-- action       = enabled ? 'rls_override_enabled' : 'rls_override_disabled'
-- diff         = {after: {enabled: NEW.enabled}}
-- metadata     = {franchise_id}
-- actor_user_id = NULL (source doesn't capture who performed the override —
--                gap to file under master §1B; for now we mark actor_kind='system'
--                and capture the target in subject)

CREATE OR REPLACE FUNCTION core.shadow_write_from_admin_override_audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.user_id IS NULL THEN
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
    NULL,                                                            -- source doesn't capture actor
    'system',
    'core.user',
    NEW.user_id,
    CASE
      WHEN NEW.enabled IS TRUE  THEN 'rls_override_enabled'
      WHEN NEW.enabled IS FALSE THEN 'rls_override_disabled'
      ELSE 'rls_override_set'                                        -- defensive — enabled was NULL somehow
    END,
    jsonb_build_object('after', jsonb_build_object('enabled', NEW.enabled)),
    jsonb_strip_nulls(jsonb_build_object('franchise_id', NEW.franchise_id)),
    'public.admin_override_audit',
    NEW.id::text,
    -- Forensic — compliance reviewers may need this. 7-year retention.
    'compliance_evidence_7y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_admin_override_audit failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_override_audit_shadow_to_core
  AFTER INSERT ON public.admin_override_audit
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_admin_override_audit();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_admin_override_audit(
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
      FROM public.admin_override_audit
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL AND user_id IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.admin_override_audit'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_admin_override_audit
  TO service_role, authenticated;
