-- Phase 1 Slice B Part 2 — shadow-write trigger #12/17
-- public.quote_audits → core.audit_log
--
-- Source schema (per migration 20260226120000_quote_numbering_rpc.sql):
--   id, quote_id (FK → quotes), action text, old_value jsonb, new_value jsonb,
--   changed_by, changed_at, notes text
--   ⚠ NO tenant_id COLUMN — JOIN to quotes to derive it.
--
-- This table predates quotation_audit_log; the two co-exist. Each captures
-- different write paths (older RPCs vs newer module code). Both shadow to
-- core.audit_log; readers de-dup at query time via subject_id + occurred_at
-- if needed.
--
-- Known action values from source migrations: 'create', 'update', 'override_number'.
--
-- subject_type = 'quotation.quote'
-- subject_id   = quote_id
-- action       = action
-- diff         = {before: old_value, after: new_value}
-- metadata     = {notes, source_table_legacy: true}

CREATE OR REPLACE FUNCTION core.shadow_write_from_quote_audits()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NEW.quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- JOIN-derive tenant_id from the parent quote.
  SELECT q.tenant_id INTO v_tenant_id
  FROM public.quotes q
  WHERE q.id = NEW.quote_id;

  IF v_tenant_id IS NULL THEN
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
    v_tenant_id,
    NEW.changed_at,
    NEW.changed_by,
    CASE WHEN NEW.changed_by IS NULL THEN 'system' ELSE 'user' END,
    'quotation.quote',
    NEW.quote_id,
    NEW.action,
    CASE
      WHEN NEW.old_value IS NOT NULL OR NEW.new_value IS NOT NULL
        THEN jsonb_build_object('before', NEW.old_value, 'after', NEW.new_value)
      ELSE NULL
    END,
    jsonb_strip_nulls(jsonb_build_object(
      'notes',                NEW.notes,
      'source_table_legacy',  true                                 -- distinguishes vs quotation_audit_log
    )),
    'public.quote_audits',
    NEW.id::text,
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_quote_audits failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quote_audits_shadow_to_core
  AFTER INSERT ON public.quote_audits
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_quote_audits();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_quote_audits(
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
      SELECT qa.id::text AS src_id
      FROM public.quote_audits qa
      JOIN public.quotes q ON q.id = qa.quote_id
      WHERE qa.changed_at >= p_start AND qa.changed_at < p_end
        AND q.tenant_id IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.quote_audits'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_quote_audits
  TO service_role, authenticated;
