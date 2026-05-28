-- Phase 1 Slice B Part 2 — shadow-write trigger #17b/17
-- mro_audit.trails → core.audit_log
--
-- Sibling of mro_audit.records (#17a). Together these are the last 2 of the
-- 17 audit sources; once both are cut over, the mro_audit schema can be
-- dropped (master §2.8 + AMRO subdoc §3.8).
--
-- Source schema (per migration 20260319143100_create_amro_audit_schema.sql):
--   id, tenant_id NOT NULL ✓,
--   event_type  audit_event_type (aircraft_registered, aircraft_grounded/released,
--               component_replaced/repaired/inspected,
--               work_order_created/scheduled/completed,
--               maintenance_approved/signed_off/released,
--               quality_checked, defect_logged, compliance_check,
--               audit_event, system_event),
--   entity_type audit_entity_type (same enum as records.related_entity_type),
--   entity_id   TEXT NOT NULL (⚠ not UUID),
--   user_id     TEXT NOT NULL (⚠ not UUID),
--   user_email  TEXT NOT NULL,
--   timestamp   timestamptz NOT NULL,   ← source's "occurred_at"
--   action_description text NOT NULL,   ← human-readable; preserved in metadata
--   regulatory_context jsonb,           ← regulatory provenance (FAA AD references etc.)
--   created_at  timestamptz NOT NULL DEFAULT now()
--
-- Note: source has BOTH `timestamp` and `created_at`. Use `timestamp` as
-- occurred_at (the event's reported time); `created_at` (the write time)
-- goes into metadata as ingested_at for forensic exactness.
--
-- subject_type = 'amro.' || entity_type
-- subject_id   = entity_id::uuid  (guarded; non-UUID rows skipped)
-- actor_user_id = user_id::uuid (guarded; user_email preserved either way)
-- action       = event_type   (the enum value IS the action)
-- diff         = NULL
-- metadata     = regulatory_context + {user_email, action_description,
--                ingested_at, original_user_id (when non-UUID)}

CREATE OR REPLACE FUNCTION core.shadow_write_from_mro_audit_trails()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_subject_id uuid;
  v_actor_id   uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_subject_id := NEW.entity_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_subject_id := NULL;
  END;
  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_actor_id := NEW.user_id::uuid;
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
    NEW.timestamp,                                                  -- source's event-time (not created_at)
    v_actor_id,
    CASE
      WHEN NEW.event_type IN ('system_event', 'audit_event') THEN 'system'
      WHEN v_actor_id IS NULL                                THEN 'integration'
      ELSE 'user'
    END,
    'amro.' || NEW.entity_type,
    v_subject_id,
    NEW.event_type,
    NULL,
    COALESCE(NEW.regulatory_context, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'user_email',          NEW.user_email,
      'action_description',  NEW.action_description,
      'ingested_at',         to_jsonb(NEW.created_at),                 -- preserve the source write-time
      'original_user_id',    CASE WHEN v_actor_id IS NULL THEN NEW.user_id ELSE NULL END
    )),
    'mro_audit.trails',
    NEW.id::text,
    'compliance_evidence_7y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_mro_audit_trails failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mro_audit_trails_shadow_to_core
  AFTER INSERT ON mro_audit.trails
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_mro_audit_trails();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_mro_audit_trails(
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
      FROM mro_audit.trails
      WHERE timestamp >= p_start AND timestamp < p_end                 -- match the trigger's occurred_at source
        AND tenant_id IS NOT NULL
        AND entity_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'mro_audit.trails'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_mro_audit_trails
  TO service_role, authenticated;
