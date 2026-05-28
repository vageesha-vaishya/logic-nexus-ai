-- Phase 1 Slice B Part 2 — shadow-write trigger #3/17
-- public.audit_logs → core.audit_log
--
-- Duplicate resolution: there are two similarly-named tables in the legacy
-- schema, and investigation confirms they are NOT both active:
--
--   public.audit_log    (no `s`) ← DEAD. Created by 20260327121500_*
--                         (the amro_ata_hierarchy_and_planning_engine
--                         migration); zero writers in any source code or
--                         later migration. Will be dropped during the
--                         Phase 11 cleanup sweep without a shadow window.
--
--   public.audit_logs   (with `s`) ← ACTIVE. Original CREATE TABLE in
--                         20251001011353_*; later enhanced via
--                         20260114000002_enhance_audit_logs.sql (added
--                         resource_id, tenant_id, franchise_id columns).
--                         Live schema reflected in src/types/supabase.ts.
--                         Writers: UnifiedQuoteComposer.tsx + 8+ migration
--                         scripts. This is the one we shadow.
--
-- Live source schema (per types.ts as the canonical truth):
--   id UUID, action TEXT NOT NULL, resource_type TEXT NOT NULL,
--   resource_id UUID (nullable), user_id (FK profiles, nullable),
--   tenant_id (FK tenants, nullable!), franchise_id (FK franchises, nullable),
--   details JSONB (nullable), ip_address (nullable), created_at
--
-- ⚠ tenant_id is NULLABLE on this source — rows without it can't shadow into
-- core.audit_log (which requires NOT NULL). Falls open per the trigger
-- convention; those rows live on in the source table only.
--
-- subject_type = if resource_type contains '.', take as-is (lowercased);
--                else prefix with 'platform.' so generic events get a stable
--                schema namespace (e.g. 'platform.profile_change')
-- subject_id   = resource_id  (skip if NULL)
-- action       = action
-- diff         = details      (source stores diff as single jsonb blob)
-- metadata     = {franchise_id, ip_address}

CREATE OR REPLACE FUNCTION core.shadow_write_from_audit_logs()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_subject_type text;
BEGIN
  -- tenant_id is nullable on this source — skip rows that lack it.
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip rows without a resource_id (can't satisfy core.audit_log.subject_id NOT NULL).
  IF NEW.resource_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Compose subject_type: respect schema-qualified strings; else prefix.
  IF position('.' in COALESCE(NEW.resource_type, '')) > 0 THEN
    v_subject_type := lower(NEW.resource_type);
  ELSE
    v_subject_type := 'platform.' || lower(COALESCE(NEW.resource_type, 'unknown'));
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
    v_subject_type,
    NEW.resource_id,
    NEW.action,
    NEW.details,
    jsonb_strip_nulls(jsonb_build_object(
      'franchise_id', NEW.franchise_id,
      'ip_address',   NEW.ip_address::text
    )),
    'public.audit_logs',
    NEW.id::text,
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_audit_logs failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_logs_shadow_to_core
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_audit_logs();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_audit_logs(
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
      FROM public.audit_logs
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL          -- trigger requires non-null tenant
        AND resource_id IS NOT NULL        -- trigger requires non-null subject
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.audit_logs'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_audit_logs
  TO service_role, authenticated;
