-- Phase 6 Compliance Step 1 — compliance.* schema + canonical base tables
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 6
--
-- The compliance.* schema is new. Mirrors eight canonical base tables
-- from public.* — same dual-write + drift-check pattern used for
-- core.parties / crm.account_extensions / sales.leads / etc.
--
-- Tables mirrored (row counts at backfill):
--   - compliance.records              (2,446 rows, 21 cols) — primary
--   - compliance.obligations          (2,547 rows, 22 cols) — primary
--   - compliance.screenings           (2 rows, 14 cols)
--   - compliance.rules                (0 rows, 12 cols)
--   - compliance.legal_holds          (0 rows, 12 cols)
--   - compliance.retention_policies   (0 rows, 13 cols)
--   - compliance.domain_verifications (0 rows, 12 cols)
--   - compliance.restricted_party_lists (7 rows, 16 cols) — global ref data
--
-- public.compliance_records_duplicate (2,546 rows) is left alone in this
-- slice — the relationship with public.compliance_records (2,446 rows)
-- needs a parity reconciliation slice of its own before either side is
-- canonical. Master plan-style "duplicate to resolve".
--
-- The amro_compliance_* tables are AMRO-domain and stay queued for
-- Phase 8 (the AMRO refactor).

CREATE SCHEMA IF NOT EXISTS compliance;
COMMENT ON SCHEMA compliance IS 'Phase 6 compliance — records, obligations, screenings, rules, legal holds, retention policies, domain verifications.';

-- ══════════════════════════════════════════════════════════════════════
-- 1. Mirror tables (LIKE pattern from Phase 4/5)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE compliance.records (LIKE public.compliance_records INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE compliance.records ADD PRIMARY KEY (id);
COMMENT ON TABLE compliance.records IS 'Phase 6 Compliance Step 1 — mirror of public.compliance_records.';
CREATE INDEX compliance_records_tenant_idx ON compliance.records (tenant_id);
ALTER TABLE compliance.records ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_records_tenant_select ON compliance.records
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_compliance_records_updated_at BEFORE UPDATE ON compliance.records FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON compliance.records TO authenticated;
GRANT ALL ON compliance.records TO service_role;

CREATE TABLE compliance.obligations (LIKE public.compliance_obligations INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE compliance.obligations ADD PRIMARY KEY (id);
COMMENT ON TABLE compliance.obligations IS 'Phase 6 Compliance Step 1 — mirror of public.compliance_obligations.';
CREATE INDEX compliance_obligations_tenant_idx ON compliance.obligations (tenant_id);
ALTER TABLE compliance.obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_obligations_tenant_select ON compliance.obligations
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_compliance_obligations_updated_at BEFORE UPDATE ON compliance.obligations FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON compliance.obligations TO authenticated;
GRANT ALL ON compliance.obligations TO service_role;

CREATE TABLE compliance.screenings (LIKE public.compliance_screenings INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE compliance.screenings ADD PRIMARY KEY (id);
COMMENT ON TABLE compliance.screenings IS 'Phase 6 Compliance Step 1 — mirror of public.compliance_screenings.';
CREATE INDEX compliance_screenings_tenant_idx ON compliance.screenings (tenant_id);
ALTER TABLE compliance.screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_screenings_tenant_select ON compliance.screenings
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_compliance_screenings_updated_at BEFORE UPDATE ON compliance.screenings FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON compliance.screenings TO authenticated;
GRANT ALL ON compliance.screenings TO service_role;

CREATE TABLE compliance.rules (LIKE public.compliance_rules INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE compliance.rules ADD PRIMARY KEY (id);
COMMENT ON TABLE compliance.rules IS 'Phase 6 Compliance Step 1 — mirror of public.compliance_rules. Source 0 rows; schema-only.';
CREATE INDEX compliance_rules_tenant_idx ON compliance.rules (tenant_id);
ALTER TABLE compliance.rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_rules_tenant_select ON compliance.rules
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_compliance_rules_updated_at BEFORE UPDATE ON compliance.rules FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON compliance.rules TO authenticated;
GRANT ALL ON compliance.rules TO service_role;

CREATE TABLE compliance.legal_holds (LIKE public.compliance_legal_holds INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE compliance.legal_holds ADD PRIMARY KEY (id);
COMMENT ON TABLE compliance.legal_holds IS 'Phase 6 Compliance Step 1 — mirror of public.compliance_legal_holds.';
CREATE INDEX compliance_legal_holds_tenant_idx ON compliance.legal_holds (tenant_id);
ALTER TABLE compliance.legal_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_legal_holds_tenant_select ON compliance.legal_holds
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_compliance_legal_holds_updated_at BEFORE UPDATE ON compliance.legal_holds FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON compliance.legal_holds TO authenticated;
GRANT ALL ON compliance.legal_holds TO service_role;

CREATE TABLE compliance.retention_policies (LIKE public.compliance_retention_policies INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE compliance.retention_policies ADD PRIMARY KEY (id);
COMMENT ON TABLE compliance.retention_policies IS 'Phase 6 Compliance Step 1 — mirror of public.compliance_retention_policies.';
CREATE INDEX compliance_retention_policies_tenant_idx ON compliance.retention_policies (tenant_id);
ALTER TABLE compliance.retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_retention_policies_tenant_select ON compliance.retention_policies
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_compliance_retention_policies_updated_at BEFORE UPDATE ON compliance.retention_policies FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON compliance.retention_policies TO authenticated;
GRANT ALL ON compliance.retention_policies TO service_role;

CREATE TABLE compliance.domain_verifications (LIKE public.compliance_domain_verifications INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE compliance.domain_verifications ADD PRIMARY KEY (id);
COMMENT ON TABLE compliance.domain_verifications IS 'Phase 6 Compliance Step 1 — mirror of public.compliance_domain_verifications.';
CREATE INDEX compliance_domain_verifications_tenant_idx ON compliance.domain_verifications (tenant_id);
ALTER TABLE compliance.domain_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_domain_verifications_tenant_select ON compliance.domain_verifications
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_compliance_domain_verifications_updated_at BEFORE UPDATE ON compliance.domain_verifications FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON compliance.domain_verifications TO authenticated;
GRANT ALL ON compliance.domain_verifications TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. restricted_party_lists (global reference; public-readable RLS)
-- ══════════════════════════════════════════════════════════════════════
-- No tenant_id on source — these are global watchlists (OFAC, EU, UN).
-- Same model as logistics.container_sizes.

CREATE TABLE compliance.restricted_party_lists (LIKE public.restricted_party_lists INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE compliance.restricted_party_lists ADD PRIMARY KEY (id);
COMMENT ON TABLE compliance.restricted_party_lists IS 'Phase 6 Compliance Step 1 — mirror of public.restricted_party_lists. Global watchlist reference data; public-readable RLS.';
ALTER TABLE compliance.restricted_party_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY restricted_party_lists_authenticated_select ON compliance.restricted_party_lists
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_compliance_restricted_party_lists_updated_at BEFORE UPDATE ON compliance.restricted_party_lists FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON compliance.restricted_party_lists TO authenticated;
GRANT ALL ON compliance.restricted_party_lists TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Backfill
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO compliance.records                SELECT * FROM public.compliance_records                ON CONFLICT (id) DO NOTHING;
INSERT INTO compliance.obligations            SELECT * FROM public.compliance_obligations            ON CONFLICT (id) DO NOTHING;
INSERT INTO compliance.screenings             SELECT * FROM public.compliance_screenings             ON CONFLICT (id) DO NOTHING;
INSERT INTO compliance.rules                  SELECT * FROM public.compliance_rules                  ON CONFLICT (id) DO NOTHING;
INSERT INTO compliance.legal_holds            SELECT * FROM public.compliance_legal_holds            ON CONFLICT (id) DO NOTHING;
INSERT INTO compliance.retention_policies     SELECT * FROM public.compliance_retention_policies     ON CONFLICT (id) DO NOTHING;
INSERT INTO compliance.domain_verifications   SELECT * FROM public.compliance_domain_verifications   ON CONFLICT (id) DO NOTHING;
INSERT INTO compliance.restricted_party_lists SELECT * FROM public.restricted_party_lists            ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Dual-write triggers (generated programmatically — 8 tables)
-- ══════════════════════════════════════════════════════════════════════
--
-- The (target_table, source_table) pairs differ only by the "compliance_"
-- prefix on the public side. Restricted_party_lists is special-cased
-- because its source name doesn't have the "compliance_" prefix.

DO $do$
DECLARE
  spec record;
  specs jsonb := jsonb_build_array(
    jsonb_build_object('tbl','records','src','public.compliance_records'),
    jsonb_build_object('tbl','obligations','src','public.compliance_obligations'),
    jsonb_build_object('tbl','screenings','src','public.compliance_screenings'),
    jsonb_build_object('tbl','rules','src','public.compliance_rules'),
    jsonb_build_object('tbl','legal_holds','src','public.compliance_legal_holds'),
    jsonb_build_object('tbl','retention_policies','src','public.compliance_retention_policies'),
    jsonb_build_object('tbl','domain_verifications','src','public.compliance_domain_verifications'),
    jsonb_build_object('tbl','restricted_party_lists','src','public.restricted_party_lists')
  );
BEGIN
  FOR spec IN SELECT (s->>'tbl') AS tbl, (s->>'src') AS src FROM jsonb_array_elements(specs) s LOOP
    EXECUTE format($f$
      CREATE OR REPLACE FUNCTION compliance.dual_write_from_%I()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = compliance, pg_catalog AS $TRG$
      BEGIN
        IF TG_OP = 'DELETE' THEN DELETE FROM compliance.%I WHERE id = OLD.id;
        ELSIF TG_OP = 'INSERT' THEN INSERT INTO compliance.%I SELECT NEW.* ON CONFLICT (id) DO NOTHING;
        ELSIF TG_OP = 'UPDATE' THEN DELETE FROM compliance.%I WHERE id = NEW.id; INSERT INTO compliance.%I SELECT NEW.*;
        END IF;
        RETURN COALESCE(NEW, OLD);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'dual_write_from_%I (op=%%, id=%%) failed: %%', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
        RETURN COALESCE(NEW, OLD);
      END; $TRG$;
    $f$, spec.tbl, spec.tbl, spec.tbl, spec.tbl, spec.tbl, spec.tbl);
    EXECUTE format($f$
      CREATE TRIGGER trg_%I_dual_write_to_compliance
        AFTER INSERT OR UPDATE OR DELETE ON %s
        FOR EACH ROW EXECUTE FUNCTION compliance.dual_write_from_%I();
    $f$, spec.tbl, spec.src, spec.tbl);
  END LOOP;
END $do$;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Drift monitor
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compliance.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = compliance, public, pg_catalog AS $$
  SELECT 'records_minus_compliance', (SELECT count(*) FROM public.compliance_records) - (SELECT count(*) FROM compliance.records)
  UNION ALL SELECT 'obligations_minus_compliance', (SELECT count(*) FROM public.compliance_obligations) - (SELECT count(*) FROM compliance.obligations)
  UNION ALL SELECT 'screenings_minus_compliance', (SELECT count(*) FROM public.compliance_screenings) - (SELECT count(*) FROM compliance.screenings)
  UNION ALL SELECT 'rules_minus_compliance', (SELECT count(*) FROM public.compliance_rules) - (SELECT count(*) FROM compliance.rules)
  UNION ALL SELECT 'legal_holds_minus_compliance', (SELECT count(*) FROM public.compliance_legal_holds) - (SELECT count(*) FROM compliance.legal_holds)
  UNION ALL SELECT 'retention_policies_minus_compliance', (SELECT count(*) FROM public.compliance_retention_policies) - (SELECT count(*) FROM compliance.retention_policies)
  UNION ALL SELECT 'domain_verifications_minus_compliance', (SELECT count(*) FROM public.compliance_domain_verifications) - (SELECT count(*) FROM compliance.domain_verifications)
  UNION ALL SELECT 'restricted_party_lists_minus_compliance', (SELECT count(*) FROM public.restricted_party_lists) - (SELECT count(*) FROM compliance.restricted_party_lists);
$$;

COMMENT ON FUNCTION compliance.base_drift_check IS
  'Phase 6 Compliance Step 1 drift monitor. All 8 deltas should remain 0.';

GRANT EXECUTE ON FUNCTION compliance.base_drift_check TO service_role;
