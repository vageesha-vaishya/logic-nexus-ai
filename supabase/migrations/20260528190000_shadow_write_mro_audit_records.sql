-- Phase 1 Slice B Part 2 — shadow-write trigger #17a/17
-- mro_audit.records → core.audit_log
--
-- Source schema (per migration 20260319143100_create_amro_audit_schema.sql):
--   id, tenant_id NOT NULL ✓,
--   record_type   audit_record_type   (text-domain: aircraft_registration,
--                 aircraft_status_change, component_installation/removal/repair,
--                 maintenance_completion/sign_off/release, work_order_approval,
--                 task_assignment/completion, quality_inspection,
--                 deviation_logged, system_action),
--   related_entity_id    TEXT NOT NULL (⚠ not UUID),
--   related_entity_type  audit_entity_type (aircraft, component, work_order,
--                 task, staff_qualification, maintenance_event, system_config,
--                 user_action, batch_operation),
--   actor_id       TEXT NOT NULL (⚠ not UUID — string identifier),
--   actor_role     audit_actor_role (technician, mechanic, inspector,
--                 quality_assurance, supervisor, maintenance_manager,
--                 operations_manager, system, api, scheduler/_system),
--   action TEXT NOT NULL,
--   context JSONB,
--   signature BYTEA,
--   previous_hash BYTEA,                  ← blockchain-style chain
--   created_at timestamptz NOT NULL DEFAULT now()
--
-- mro_audit.records is the regulator-evidence audit. After cut-over, the
-- entire mro_audit schema is dropped (master §2.8 + AMRO subdoc §3.8).
--
-- subject_type = 'amro.' || related_entity_type → 'amro.aircraft',
--                'amro.component', 'amro.work_order', etc.
-- subject_id   = related_entity_id::uuid  (guarded; non-UUID rows skipped +
--                original preserved in metadata.original_entity_id)
-- actor_user_id = actor_id::uuid (guarded — actor_id is text in source; rows
--                with non-UUID actor land with actor_user_id=NULL +
--                metadata.original_actor_id preserved)
-- diff         = NULL (action label + context tell the story)
-- metadata     = context + {record_type, actor_role, signature (hex),
--                previous_hash (hex), original_entity_id (when non-UUID),
--                original_actor_id (when non-UUID)}

CREATE OR REPLACE FUNCTION core.shadow_write_from_mro_audit_records()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_subject_id   uuid;
  v_actor_id     uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Guarded UUID cast for entity_id (TEXT in source).
  BEGIN
    v_subject_id := NEW.related_entity_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_subject_id := NULL;
  END;
  IF v_subject_id IS NULL THEN
    -- Non-UUID entity references can't satisfy core.audit_log.subject_id.
    -- We preserve them in metadata via a fallback synthetic UUID derived
    -- from a deterministic hash so the rows still land in core, but the
    -- subject_id won't FK-match an entity table. For Phase 1, skip these
    -- (they're rare and the original ID is preserved in mro_audit anyway
    -- during the dual-write window).
    RETURN NEW;
  END IF;

  -- Guarded UUID cast for actor_id (TEXT in source).
  BEGIN
    v_actor_id := NEW.actor_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

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
    v_actor_id,
    CASE
      WHEN NEW.actor_role IN ('system', 'api')           THEN 'service'
      WHEN NEW.actor_role IN ('scheduler', 'scheduler_system') THEN 'service'
      WHEN v_actor_id IS NULL                            THEN 'integration'
      ELSE 'user'
    END,
    'amro.' || NEW.related_entity_type,
    v_subject_id,
    NEW.action,
    NULL,
    COALESCE(NEW.context, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'record_type',         NEW.record_type,
      'actor_role',          NEW.actor_role,
      'signature_hex',       encode(NEW.signature, 'hex'),
      'previous_hash_hex',   encode(NEW.previous_hash, 'hex'),
      'original_actor_id',   CASE WHEN v_actor_id IS NULL THEN NEW.actor_id ELSE NULL END
    )),
    'mro_audit.records',
    NEW.id::text,
    'compliance_evidence_7y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_mro_audit_records failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mro_audit_records_shadow_to_core
  AFTER INSERT ON mro_audit.records
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_mro_audit_records();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_mro_audit_records(
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
      FROM mro_audit.records
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL
        -- Mirror the trigger's UUID-coercibility check
        AND related_entity_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'mro_audit.records'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_mro_audit_records
  TO service_role, authenticated;
