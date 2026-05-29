-- Phase 4 Quotation Step 1 — quotation.* schema + base tables
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 4
--
-- public.* contains ~48 quote-related tables (quotes, quote_items,
-- quote_charges, quotation_versions, quotation_version_options,
-- quote_options, quote_templates, etc.). This Step 1 slice mirrors only
-- the core trio that downstream consumers anchor on:
--
--   - quotation.quotes              (mirror of public.quotes,        461 rows, 65 cols)
--   - quotation.quote_items         (mirror of public.quote_items,   321 rows, 21 cols)
--   - quotation.quote_charges       (mirror of public.quote_charges, 3,220 rows, 22 cols)
--   - quotation.versions            (mirror of public.quotation_versions, 449 rows, 26 cols)
--
-- The remaining 40+ tables (option/leg explosion, templates, AI cache,
-- audit logs, sequences, presentations) get their own slices because
-- they're structurally distinct domains. quote_items_core/legacy/
-- extension_deprecated split is itself a refactor still in flight in
-- public.* — keeping that mess out of quotation.* for now.
--
-- Pattern: CREATE TABLE LIKE … INCLUDING DEFAULTS INCLUDING CONSTRAINTS
-- copies column types + NOT NULL + CHECK + defaults but not indexes or
-- primary keys; we add explicit PK + indexes + RLS + dual-write
-- triggers.

CREATE SCHEMA IF NOT EXISTS quotation;
COMMENT ON SCHEMA quotation IS 'Phase 4 quotation lifecycle — quotes, items, charges, versions.';

-- ══════════════════════════════════════════════════════════════════════
-- 1. quotation.quotes
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE quotation.quotes (LIKE public.quotes INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE quotation.quotes ADD PRIMARY KEY (id);

COMMENT ON TABLE quotation.quotes IS
  'Phase 4 Quotation Step 1 — mirror of public.quotes. Dual-write from the source keeps it current.';

CREATE INDEX quotation_quotes_tenant_status_idx ON quotation.quotes (tenant_id, status, created_at DESC);
CREATE INDEX quotation_quotes_owner_idx        ON quotation.quotes (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX quotation_quotes_opportunity_idx  ON quotation.quotes (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX quotation_quotes_account_idx      ON quotation.quotes (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX quotation_quotes_number_idx       ON quotation.quotes (tenant_id, quote_number);

ALTER TABLE quotation.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotation_quotes_tenant_select ON quotation.quotes
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_quotation_quotes_updated_at
  BEFORE UPDATE ON quotation.quotes
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON quotation.quotes TO authenticated;
GRANT ALL    ON quotation.quotes TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. quotation.quote_items
-- ══════════════════════════════════════════════════════════════════════

-- public.quote_items is a VIEW over public.quote_items_core; target the
-- underlying base table for the LIKE + dual-write trigger. The view is
-- where downstream readers still query, which keeps working because the
-- dual-write fires on quote_items_core inserts the view delegates to.
CREATE TABLE quotation.quote_items (LIKE public.quote_items_core INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE quotation.quote_items ADD PRIMARY KEY (id);

COMMENT ON TABLE quotation.quote_items IS
  'Phase 4 Quotation Step 1 — mirror of public.quote_items.';

CREATE INDEX quotation_quote_items_quote_idx ON quotation.quote_items (quote_id);

-- quote_items_core has tenant_id directly; no JOIN needed for RLS.
ALTER TABLE quotation.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotation_quote_items_tenant_select ON quotation.quote_items
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_quotation_quote_items_updated_at
  BEFORE UPDATE ON quotation.quote_items
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON quotation.quote_items TO authenticated;
GRANT ALL    ON quotation.quote_items TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. quotation.quote_charges
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE quotation.quote_charges (LIKE public.quote_charges INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE quotation.quote_charges ADD PRIMARY KEY (id);

COMMENT ON TABLE quotation.quote_charges IS
  'Phase 4 Quotation Step 1 — mirror of public.quote_charges.';

-- quote_charges links via quote_option_id (not quote_id) but carries its
-- own tenant_id, so RLS can stay on the table directly without a JOIN.
CREATE INDEX quotation_quote_charges_option_idx ON quotation.quote_charges (quote_option_id);
CREATE INDEX quotation_quote_charges_tenant_idx ON quotation.quote_charges (tenant_id);

ALTER TABLE quotation.quote_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotation_quote_charges_tenant_select ON quotation.quote_charges
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_quotation_quote_charges_updated_at
  BEFORE UPDATE ON quotation.quote_charges
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON quotation.quote_charges TO authenticated;
GRANT ALL    ON quotation.quote_charges TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 4. quotation.versions
-- ══════════════════════════════════════════════════════════════════════
--
-- Source is public.quotation_versions; we rename to quotation.versions
-- because the schema qualifier already conveys "quotation" — the table
-- name itself shouldn't repeat it.

CREATE TABLE quotation.versions (LIKE public.quotation_versions INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE quotation.versions ADD PRIMARY KEY (id);

COMMENT ON TABLE quotation.versions IS
  'Phase 4 Quotation Step 1 — mirror of public.quotation_versions (renamed: schema qualifier already says "quotation").';

CREATE INDEX quotation_versions_quote_idx ON quotation.versions (quote_id, version_number DESC);

ALTER TABLE quotation.versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotation_versions_tenant_select ON quotation.versions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotation.quotes q
    WHERE q.id = quotation.versions.quote_id
      AND q.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));

CREATE TRIGGER trg_quotation_versions_updated_at
  BEFORE UPDATE ON quotation.versions
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON quotation.versions TO authenticated;
GRANT ALL    ON quotation.versions TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Backfill
-- ══════════════════════════════════════════════════════════════════════
--
-- Column shape is identical via LIKE, so INSERT … SELECT * works
-- without enumeration. Order matters: quotes first (referenced by the
-- others), then items/charges/versions in any order.

INSERT INTO quotation.quotes          SELECT * FROM public.quotes              ON CONFLICT (id) DO NOTHING;
INSERT INTO quotation.quote_items     SELECT * FROM public.quote_items_core    ON CONFLICT (id) DO NOTHING;
INSERT INTO quotation.quote_charges   SELECT * FROM public.quote_charges       ON CONFLICT (id) DO NOTHING;
INSERT INTO quotation.versions        SELECT * FROM public.quotation_versions  ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 6. Dual-write triggers
-- ══════════════════════════════════════════════════════════════════════
--
-- Because mirror tables have identical shape, each trigger function is
-- a one-liner. INSERT and UPDATE use the same NEW.* row directly; the
-- COALESCE-on-id makes DELETE work too.

CREATE OR REPLACE FUNCTION quotation.dual_write_from_quotes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = quotation, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM quotation.quotes WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO quotation.quotes SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    DELETE FROM quotation.quotes WHERE id = NEW.id;
    INSERT INTO quotation.quotes SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_quotes (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_quotes_dual_write_to_quotation
  AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION quotation.dual_write_from_quotes();

CREATE OR REPLACE FUNCTION quotation.dual_write_from_quote_items_core()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = quotation, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM quotation.quote_items WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO quotation.quote_items SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    DELETE FROM quotation.quote_items WHERE id = NEW.id;
    INSERT INTO quotation.quote_items SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_quote_items_core (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_quote_items_core_dual_write_to_quotation
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items_core
  FOR EACH ROW EXECUTE FUNCTION quotation.dual_write_from_quote_items_core();

CREATE OR REPLACE FUNCTION quotation.dual_write_from_quote_charges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = quotation, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM quotation.quote_charges WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO quotation.quote_charges SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    DELETE FROM quotation.quote_charges WHERE id = NEW.id;
    INSERT INTO quotation.quote_charges SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_quote_charges (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_quote_charges_dual_write_to_quotation
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_charges
  FOR EACH ROW EXECUTE FUNCTION quotation.dual_write_from_quote_charges();

CREATE OR REPLACE FUNCTION quotation.dual_write_from_versions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = quotation, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM quotation.versions WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO quotation.versions SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    DELETE FROM quotation.versions WHERE id = NEW.id;
    INSERT INTO quotation.versions SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_versions (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_quotation_versions_dual_write_to_quotation
  AFTER INSERT OR UPDATE OR DELETE ON public.quotation_versions
  FOR EACH ROW EXECUTE FUNCTION quotation.dual_write_from_versions();

-- ══════════════════════════════════════════════════════════════════════
-- 7. Drift monitor
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION quotation.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = quotation, public, pg_catalog AS $$
  SELECT 'quotes_minus_quotation_quotes',
         (SELECT count(*) FROM public.quotes) - (SELECT count(*) FROM quotation.quotes)
  UNION ALL
  SELECT 'quote_items_core_minus_quotation_quote_items',
         (SELECT count(*) FROM public.quote_items_core) - (SELECT count(*) FROM quotation.quote_items)
  UNION ALL
  SELECT 'quote_charges_minus_quotation_quote_charges',
         (SELECT count(*) FROM public.quote_charges) - (SELECT count(*) FROM quotation.quote_charges)
  UNION ALL
  SELECT 'quotation_versions_minus_quotation_versions',
         (SELECT count(*) FROM public.quotation_versions) - (SELECT count(*) FROM quotation.versions);
$$;
COMMENT ON FUNCTION quotation.base_drift_check IS
  'Phase 4 Quotation Step 1 drift monitor. All four deltas should remain 0.';
GRANT EXECUTE ON FUNCTION quotation.base_drift_check TO service_role;
