-- Phase 1 Slice B Part 2 — shadow-write trigger #14/17
-- public.mapping_audit_logs → core.audit_log
--
-- Source schema (per migration 20260221120000_mapping_system.sql):
--   id, tenant_id, user_id, source_id NOT NULL (Quote ID),
--   target_id (Booking ID, nullable), action ('VALIDATE','MAP','PREVIEW'),
--   status ('SUCCESS','FAILURE','WARNING'),
--   details JSONB (validation errors, field diffs),
--   metadata JSONB (IP, user agent), created_at
--
-- This table audits the Quote → Booking mapping/conversion flow. Per the UIM
-- module subdoc (§3.2 integration namespace), this is connector-side mapping
-- — so subject is the quote-to-booking mapping operation, scoped to the
-- source quote.
--
-- subject_type = 'uim.quote_booking_mapping'
-- subject_id   = source_id  (the quote being mapped)
-- action       = lower(NEW.action)   ('validate','map','preview')
-- diff         = details             (validation errors / field diffs blob)
-- metadata     = NEW.metadata + status + target_id (when present)

CREATE OR REPLACE FUNCTION core.shadow_write_from_mapping_audit_logs()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.source_id IS NULL THEN
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
    NEW.user_id,
    CASE WHEN NEW.user_id IS NULL THEN 'system' ELSE 'user' END,
    'uim.quote_booking_mapping',
    NEW.source_id,
    lower(NEW.action),                                              -- normalise UPPERCASE → lowercase per core convention
    NEW.details,                                                    -- validation errors + field diffs
    COALESCE(NEW.metadata, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'status',                  NEW.status,
      'source_action_uppercase', NEW.action,                          -- preserve original case forensically
      'target_id',               NEW.target_id                        -- the booking when mapping succeeded
    )),
    'public.mapping_audit_logs',
    NEW.id::text,
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_mapping_audit_logs failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mapping_audit_logs_shadow_to_core
  AFTER INSERT ON public.mapping_audit_logs
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_mapping_audit_logs();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_mapping_audit_logs(
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
      FROM public.mapping_audit_logs
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL AND source_id IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.mapping_audit_logs'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_mapping_audit_logs
  TO service_role, authenticated;
