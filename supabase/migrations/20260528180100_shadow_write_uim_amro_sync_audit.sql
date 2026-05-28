-- Phase 1 Slice B Part 2 — shadow-write trigger #16/17
-- public.uim_amro_sync_audit → core.audit_log
--
-- Source schema (per migration 20260407113000_uim_mro_seed_and_amro_pipeline.sql):
--   id, tenant_id NOT NULL ✓, franchise_id, job_id (→uim_amro_sync_jobs),
--   action text, direction CHECK ('uim_to_amro','amro_to_uim'),
--   inventory_item_id (→uim_inventory_items),
--   reservation_id (→uim_inventory_reservations),
--   payload jsonb, outcome CHECK ('accepted','processed','replayed','failed'),
--   error_message, correlation_id text, created_at, created_by
--
-- Polymorphic subject via fallback chain (per uim subdoc §5 + §6):
--   subject_id   = COALESCE(inventory_item_id, reservation_id, job_id)
--   subject_type = matching: 'uim.inventory_item'   when inventory_item_id present
--                          | 'uim.reservation'      when reservation_id present
--                          | 'uim.sync_job'         when only job_id present
--
-- ⭐ correlation_id propagates into core.audit_log.metadata.correlation_id
-- so saga reconstruction via the §5.9 pattern works for UIM ↔ AMRO sync.

CREATE OR REPLACE FUNCTION core.shadow_write_from_uim_amro_sync_audit()
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

  IF NEW.inventory_item_id IS NOT NULL THEN
    v_subject_type := 'uim.inventory_item';
    v_subject_id   := NEW.inventory_item_id;
  ELSIF NEW.reservation_id IS NOT NULL THEN
    v_subject_type := 'uim.reservation';
    v_subject_id   := NEW.reservation_id;
  ELSIF NEW.job_id IS NOT NULL THEN
    v_subject_type := 'uim.sync_job';
    v_subject_id   := NEW.job_id;
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
    NEW.created_by,
    CASE WHEN NEW.created_by IS NULL THEN 'integration' ELSE 'user' END,
    v_subject_type,
    v_subject_id,
    NEW.action,
    NULL,
    -- Note: correlation_id is the master §5.9 saga key; we put it at the
    -- top level of metadata (not nested) so the audit_log_correlation_idx
    -- partial index picks it up correctly.
    COALESCE(NEW.payload, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'correlation_id',         NEW.correlation_id,
      'direction',              NEW.direction,
      'outcome',                NEW.outcome,
      'error_message',          NEW.error_message,
      'franchise_id',           NEW.franchise_id,
      'parent_job_id',          NEW.job_id,
      'parent_inventory_item_id', NEW.inventory_item_id,
      'parent_reservation_id',  NEW.reservation_id
    )),
    'public.uim_amro_sync_audit',
    NEW.id::text,
    -- UIM ↔ AMRO sync touches aircraft-parts inventory; same retention class
    -- as AMRO compliance evidence.
    'compliance_evidence_7y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_uim_amro_sync_audit failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_uim_amro_sync_audit_shadow_to_core
  AFTER INSERT ON public.uim_amro_sync_audit
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_uim_amro_sync_audit();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_uim_amro_sync_audit(
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
      FROM public.uim_amro_sync_audit
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL
        AND COALESCE(inventory_item_id, reservation_id, job_id) IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.uim_amro_sync_audit'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_uim_amro_sync_audit
  TO service_role, authenticated;
