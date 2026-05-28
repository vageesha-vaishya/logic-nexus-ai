-- Phase 1 Slice B — first shadow-write trigger
-- platform.audit_log → core.audit_log
--
-- This is the EXAMPLE trigger that proves the shadow-write pattern. The other
-- 16 source audit tables (mro_audit.records, public.email_audit_log, etc.)
-- each ship their own follow-up migration following this template.
--
-- Per master §7.2 no-break rule #1:
--   create new → dual-write → backfill → switch reads → 30-day no-direct-read → drop old
--
-- This migration installs the "dual-write" trigger. The source table
-- (platform.audit_log) continues to receive INSERTs as today; the trigger
-- ALSO writes a row to core.audit_log. Both tables hold the same content
-- during the shadow window. After 30 days of reads being cut over and
-- reconciliation verifying parity, the source table can be dropped (separate
-- migration).
--
-- See docs/architecture/shadow-write-audit-backlog.md for the remaining 16
-- source tables + their column mappings.
--
-- Mapping (platform.audit_log → core.audit_log):
--
--   platform.audit_log.ts               → core.audit_log.occurred_at
--   platform.audit_log.tenant_id        → core.audit_log.tenant_id (NOT NULL — required)
--   platform.audit_log.acted_by         → core.audit_log.actor_user_id
--   platform.audit_log.user_id          → metadata.target_user_id (the user being acted-upon, not the actor)
--   platform.audit_log.domain           → metadata.legacy_domain (e.g. 'markets', 'crm')
--   platform.audit_log.op               → metadata.op (e.g. 'consume', 'mutate')
--   platform.audit_log.op_ms            → metadata.op_ms
--   platform.audit_log.resource_type    → subject_type (PREFIXED with legacy_domain if not already schema-qualified)
--   platform.audit_log.resource_id      → subject_id (as uuid; rows with non-uuid resource_id are skipped — see WHERE clause)
--   platform.audit_log.action           → action
--   platform.audit_log.before/.after    → diff = {before, after}
--   platform.audit_log.ip / .user_agent → metadata.ip / metadata.user_agent
--   platform.audit_log.request_id       → metadata.request_id
--   platform.audit_log.franchise_id     → metadata.franchise_id

CREATE OR REPLACE FUNCTION core.shadow_write_from_platform_audit_log()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_subject_type text;
  v_subject_id   uuid;
BEGIN
  -- platform.audit_log has tenant_id nullable; core.audit_log requires it.
  -- Skip rows without tenant_id rather than fail the source INSERT.
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resource ID must be a UUID to land in core.audit_log.subject_id.
  -- Rows with text/bigint resource_id (legacy non-uuid identifiers) are skipped.
  BEGIN
    v_subject_id := NEW.resource_id::uuid;
  EXCEPTION WHEN invalid_text_representation OR data_exception OR null_value_not_allowed THEN
    RETURN NEW;  -- Can't shadow; non-uuid resource_id stays on legacy table only.
  END;

  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Compose subject_type: if resource_type already contains a dot, take as-is.
  -- Otherwise prefix with legacy domain (e.g. 'markets.portfolio').
  IF NEW.resource_type IS NULL OR NEW.resource_type = '' THEN
    v_subject_type := COALESCE(NEW.domain, 'unknown') || '.unknown';
  ELSIF position('.' in NEW.resource_type) > 0 THEN
    v_subject_type := lower(NEW.resource_type);
  ELSE
    v_subject_type := lower(COALESCE(NEW.domain, 'unknown') || '.' || NEW.resource_type);
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
    NEW.ts,
    NEW.acted_by,
    CASE
      WHEN NEW.acted_by IS NULL THEN 'system'
      ELSE 'user'
    END,
    v_subject_type,
    v_subject_id,
    COALESCE(NEW.action, 'unknown'),
    CASE
      WHEN NEW.before IS NOT NULL OR NEW.after IS NOT NULL
        THEN jsonb_build_object('before', NEW.before, 'after', NEW.after)
      ELSE NULL
    END,
    jsonb_strip_nulls(jsonb_build_object(
      'legacy_domain',     NEW.domain,
      'op',                NEW.op,
      'op_ms',             NEW.op_ms,
      'target_user_id',    NEW.user_id,
      'franchise_id',      NEW.franchise_id,
      'request_id',        NEW.request_id,
      'ip',                NEW.ip,
      'user_agent',        NEW.user_agent
    )),
    'platform.audit_log',
    NEW.id::text,
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Shadow-write must NEVER break the source INSERT. Log and continue.
    RAISE WARNING 'shadow_write_from_platform_audit_log failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION core.shadow_write_from_platform_audit_log IS
  'AFTER INSERT trigger on platform.audit_log that also writes to core.audit_log. Falls open on error — never blocks source inserts. Phase 1 Slice B example pattern; the other 16 source audit tables follow the same template.';

CREATE TRIGGER trg_platform_audit_log_shadow_to_core
  AFTER INSERT ON platform.audit_log
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_platform_audit_log();

-- Reconciliation helper: count platform.audit_log rows vs their core.audit_log
-- shadow rows over a date range. Run before declaring the shadow-write
-- complete and ready for cut-over.
--
-- Example usage:
--   SELECT * FROM core.audit_shadow_parity_platform_audit_log(
--     p_start => '2026-05-28T00:00:00Z',
--     p_end   => '2026-05-29T00:00:00Z'
--   );

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_platform_audit_log(
  p_start timestamptz,
  p_end   timestamptz
) RETURNS TABLE (
  source_rows           bigint,
  shadow_rows           bigint,
  unshadowed_rows       bigint,
  shadow_unique_rows    bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  WITH
    src AS (
      SELECT id::text AS src_id
      FROM platform.audit_log
      WHERE ts >= p_start AND ts < p_end AND tenant_id IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'platform.audit_log'
    )
  SELECT
    (SELECT count(*) FROM src)                              AS source_rows,
    (SELECT count(*) FROM shadow)                           AS shadow_rows,
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)) AS unshadowed_rows,
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src)) AS shadow_unique_rows;
$$;

COMMENT ON FUNCTION core.audit_shadow_parity_platform_audit_log IS
  'Reconciliation: returns (source_rows, shadow_rows, unshadowed, extra). Both unshadowed_rows and shadow_unique_rows should be 0 after 24h of running the trigger. Run before cutting over readers to core.audit_log.';

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_platform_audit_log
  TO service_role, authenticated;
