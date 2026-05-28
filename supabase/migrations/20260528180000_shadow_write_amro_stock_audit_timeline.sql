-- Phase 1 Slice B Part 2 — shadow-write trigger #9/17
-- public.amro_stock_audit_timeline → core.audit_log
--
-- Source schema (per migration 20260408233000_amro_stock_ledger_phase2_*):
--   id, tenant_id NOT NULL ✓, franchise_id, actor_user_id, event_type,
--   event_category DEFAULT 'stock-ledger', reference_id text (⚠ not uuid!),
--   event_payload jsonb, immutable_hash, created_at
--
-- subject_type = 'amro.' || lower(replace(event_category, '-', '_'))
--   The event_category defaults to 'stock-ledger' → 'amro.stock_ledger';
--   future categories follow same convention.
-- subject_id   = reference_id::uuid  (skip the row if reference_id isn't a UUID)
-- action       = event_type
-- diff         = NULL  (source captures the action label + payload only)
-- metadata     = event_payload + immutable_hash + franchise_id +
--                preserved original reference_id (so non-UUID references
--                aren't lost from forensic record)

CREATE OR REPLACE FUNCTION core.shadow_write_from_amro_stock_audit_timeline()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_subject_id uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- reference_id is TEXT in source; try to coerce to UUID. If it's a
  -- non-UUID identifier (e.g. an external supplier ref), preserve in
  -- metadata and skip the shadow write (we can't satisfy core.audit_log's
  -- uuid subject_id requirement).
  BEGIN
    v_subject_id := NEW.reference_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_subject_id := NULL;
  END;

  IF v_subject_id IS NULL THEN
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
    'amro.' || lower(replace(COALESCE(NEW.event_category, 'stock_ledger'), '-', '_')),
    v_subject_id,
    NEW.event_type,
    NULL,
    COALESCE(NEW.event_payload, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'immutable_hash',         NEW.immutable_hash,
      'franchise_id',           NEW.franchise_id,
      'original_reference_id',  NEW.reference_id        -- keep raw form for forensic exactness
    )),
    'public.amro_stock_audit_timeline',
    NEW.id::text,
    -- Stock movements feed inventory valuation; tax authorities (India GST,
    -- US 1099-K) want stock-movement records for 6-8 years.
    'compliance_evidence_7y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_amro_stock_audit_timeline failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_amro_stock_audit_timeline_shadow_to_core
  AFTER INSERT ON public.amro_stock_audit_timeline
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_amro_stock_audit_timeline();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_amro_stock_audit_timeline(
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
      -- Mirror the trigger's filters: only rows with a UUID-coercible reference_id
      -- count toward parity (the rest are deliberately skipped).
      SELECT id::text AS src_id
      FROM public.amro_stock_audit_timeline
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL
        AND reference_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.amro_stock_audit_timeline'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_amro_stock_audit_timeline
  TO service_role, authenticated;
