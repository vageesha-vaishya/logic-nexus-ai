-- Phase 5 Finance Step 1 — canonical finance.* base tables (invoices, lines, payments, subscriptions)
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 5
--
-- Context: a finance.* schema already exists with 8 placeholder tables
-- (gl_accounts, journal_entries, tax_codes, tax_jurisdictions, tax_rules,
-- tenant_nexus, invoices, invoice_items). The GL + tax tables are wired
-- to live code (GLPosterService, TaxEngine, TaxManagementService); leave
-- them alone. But finance.invoices + finance.invoice_items are dead stubs
-- (0 rows, NO code references, shape doesn't match public.invoices) — drop
-- them and recreate with canonical-mirror shape.
--
-- billing_invoices / billing_payments duplicate reconciliation called out
-- as "High risk, 2-week parity script" in the master plan turns out to be
-- moot — both have 0 rows. The canonical tables are public.invoices (16
-- rows) and public.payments (0 rows). Don't mirror billing_*; drop them
-- in a later cleanup once it's clear nothing reads them.
--
-- Tables created in this slice:
--   - finance.invoices               mirror of public.invoices (16 rows)
--   - finance.invoice_lines          mirror of public.invoice_line_items (0 rows; named "lines" for the canonical name)
--   - finance.payments               mirror of public.payments (0 rows; schema-only)
--   - finance.subscriptions          mirror of public.subscriptions (2 rows)
--   - finance.subscription_plans     mirror of public.subscription_plans (7 rows)
--   - finance.subscription_invoices  mirror of public.subscription_invoices (4 rows)
--   - finance.subscription_features  mirror of public.subscription_features (0 rows; schema-only)
--
-- GL invariants (debit=credit triggers) are part of the same master-plan
-- workstream but deferred to their own slice — they need a true journal-
-- entry table shape, and the existing finance.journal_entries serves a
-- different (sync-recording) purpose.

-- ══════════════════════════════════════════════════════════════════════
-- 0. Retire dead stub tables (finance.invoices + finance.invoice_items)
-- ══════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS finance.invoice_items CASCADE;
DROP TABLE IF EXISTS finance.invoices CASCADE;

-- ══════════════════════════════════════════════════════════════════════
-- 1. finance.invoices (mirror of public.invoices)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.invoices (LIKE public.invoices INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE finance.invoices ADD PRIMARY KEY (id);

COMMENT ON TABLE finance.invoices IS
  'Phase 5 Finance Step 1 — mirror of public.invoices. Dual-write trigger keeps it current.';

CREATE INDEX finance_invoices_tenant_status_idx ON finance.invoices (tenant_id, status, issue_date DESC);
CREATE INDEX finance_invoices_customer_idx     ON finance.invoices (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX finance_invoices_shipment_idx     ON finance.invoices (shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX finance_invoices_number_idx       ON finance.invoices (tenant_id, invoice_number);
CREATE INDEX finance_invoices_due_idx          ON finance.invoices (tenant_id, due_date) WHERE due_date IS NOT NULL AND status NOT IN ('paid','cancelled','void');

ALTER TABLE finance.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_invoices_tenant_select ON finance.invoices
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_finance_invoices_updated_at
  BEFORE UPDATE ON finance.invoices
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON finance.invoices TO authenticated;
GRANT ALL    ON finance.invoices TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. finance.invoice_lines (mirror of public.invoice_line_items)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.invoice_lines (LIKE public.invoice_line_items INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE finance.invoice_lines ADD PRIMARY KEY (id);

COMMENT ON TABLE finance.invoice_lines IS
  'Phase 5 Finance Step 1 — mirror of public.invoice_line_items (renamed "lines" for canonical naming).';

CREATE INDEX finance_invoice_lines_invoice_idx ON finance.invoice_lines (invoice_id);
CREATE INDEX finance_invoice_lines_tenant_idx  ON finance.invoice_lines (tenant_id);

ALTER TABLE finance.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_invoice_lines_tenant_select ON finance.invoice_lines
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_finance_invoice_lines_updated_at
  BEFORE UPDATE ON finance.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON finance.invoice_lines TO authenticated;
GRANT ALL    ON finance.invoice_lines TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. finance.payments (mirror of public.payments)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.payments (LIKE public.payments INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE finance.payments ADD PRIMARY KEY (id);

COMMENT ON TABLE finance.payments IS
  'Phase 5 Finance Step 1 — mirror of public.payments. Source has 0 rows; schema-only until first payment lands.';

CREATE INDEX finance_payments_invoice_idx ON finance.payments (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX finance_payments_tenant_idx  ON finance.payments (tenant_id, payment_date DESC);

ALTER TABLE finance.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_payments_tenant_select ON finance.payments
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_finance_payments_updated_at
  BEFORE UPDATE ON finance.payments
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON finance.payments TO authenticated;
GRANT ALL    ON finance.payments TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 4. finance.subscriptions (mirror of public.subscriptions)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.subscriptions (LIKE public.subscriptions INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE finance.subscriptions ADD PRIMARY KEY (id);

COMMENT ON TABLE finance.subscriptions IS
  'Phase 5 Finance Step 1 — mirror of public.subscriptions (SaaS-of-SaaS billing).';

CREATE INDEX finance_subscriptions_tenant_idx ON finance.subscriptions (tenant_id, status);
CREATE INDEX finance_subscriptions_plan_idx   ON finance.subscriptions (plan_id);

ALTER TABLE finance.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_subscriptions_tenant_select ON finance.subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_finance_subscriptions_updated_at
  BEFORE UPDATE ON finance.subscriptions
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON finance.subscriptions TO authenticated;
GRANT ALL    ON finance.subscriptions TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 5. finance.subscription_plans (mirror of public.subscription_plans)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.subscription_plans (LIKE public.subscription_plans INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE finance.subscription_plans ADD PRIMARY KEY (id);

COMMENT ON TABLE finance.subscription_plans IS
  'Phase 5 Finance Step 1 — mirror of public.subscription_plans.';

ALTER TABLE finance.subscription_plans ENABLE ROW LEVEL SECURITY;
-- Subscription plans are public-readable (every authenticated user can browse
-- plans to upgrade); no per-tenant filter on read.
CREATE POLICY finance_subscription_plans_authenticated_select ON finance.subscription_plans
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_finance_subscription_plans_updated_at
  BEFORE UPDATE ON finance.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON finance.subscription_plans TO authenticated;
GRANT ALL    ON finance.subscription_plans TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 6. finance.subscription_invoices (mirror of public.subscription_invoices)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.subscription_invoices (LIKE public.subscription_invoices INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE finance.subscription_invoices ADD PRIMARY KEY (id);

COMMENT ON TABLE finance.subscription_invoices IS
  'Phase 5 Finance Step 1 — mirror of public.subscription_invoices.';

CREATE INDEX finance_subscription_invoices_subscription_idx
  ON finance.subscription_invoices (subscription_id);
CREATE INDEX finance_subscription_invoices_tenant_idx
  ON finance.subscription_invoices (tenant_id, created_at DESC);

ALTER TABLE finance.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_subscription_invoices_tenant_select ON finance.subscription_invoices
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_finance_subscription_invoices_updated_at
  BEFORE UPDATE ON finance.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON finance.subscription_invoices TO authenticated;
GRANT ALL    ON finance.subscription_invoices TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 7. finance.subscription_features (mirror of public.subscription_features)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.subscription_features (LIKE public.subscription_features INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE finance.subscription_features ADD PRIMARY KEY (id);

COMMENT ON TABLE finance.subscription_features IS
  'Phase 5 Finance Step 1 — mirror of public.subscription_features. Source 0 rows; schema-only.';

ALTER TABLE finance.subscription_features ENABLE ROW LEVEL SECURITY;
-- Same public-read model as plans.
CREATE POLICY finance_subscription_features_authenticated_select ON finance.subscription_features
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON finance.subscription_features TO authenticated;
GRANT ALL    ON finance.subscription_features TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 8. Backfill
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO finance.invoices              SELECT * FROM public.invoices              ON CONFLICT (id) DO NOTHING;
INSERT INTO finance.invoice_lines         SELECT * FROM public.invoice_line_items    ON CONFLICT (id) DO NOTHING;
INSERT INTO finance.payments              SELECT * FROM public.payments              ON CONFLICT (id) DO NOTHING;
INSERT INTO finance.subscription_plans    SELECT * FROM public.subscription_plans    ON CONFLICT (id) DO NOTHING;
INSERT INTO finance.subscriptions         SELECT * FROM public.subscriptions         ON CONFLICT (id) DO NOTHING;
INSERT INTO finance.subscription_invoices SELECT * FROM public.subscription_invoices ON CONFLICT (id) DO NOTHING;
INSERT INTO finance.subscription_features SELECT * FROM public.subscription_features ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 9. Dual-write triggers (one shape — INSERT/UPDATE/DELETE → mirror)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finance.dual_write_from_invoices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = finance, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM finance.invoices WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO finance.invoices SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM finance.invoices WHERE id = NEW.id; INSERT INTO finance.invoices SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_invoices (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_invoices_dual_write_to_finance
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION finance.dual_write_from_invoices();

CREATE OR REPLACE FUNCTION finance.dual_write_from_invoice_line_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = finance, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM finance.invoice_lines WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO finance.invoice_lines SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM finance.invoice_lines WHERE id = NEW.id; INSERT INTO finance.invoice_lines SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_invoice_line_items (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_invoice_line_items_dual_write_to_finance
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION finance.dual_write_from_invoice_line_items();

CREATE OR REPLACE FUNCTION finance.dual_write_from_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = finance, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM finance.payments WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO finance.payments SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM finance.payments WHERE id = NEW.id; INSERT INTO finance.payments SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_payments (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_payments_dual_write_to_finance
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION finance.dual_write_from_payments();

CREATE OR REPLACE FUNCTION finance.dual_write_from_subscriptions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = finance, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM finance.subscriptions WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO finance.subscriptions SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM finance.subscriptions WHERE id = NEW.id; INSERT INTO finance.subscriptions SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_subscriptions (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_subscriptions_dual_write_to_finance
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION finance.dual_write_from_subscriptions();

CREATE OR REPLACE FUNCTION finance.dual_write_from_subscription_plans()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = finance, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM finance.subscription_plans WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO finance.subscription_plans SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM finance.subscription_plans WHERE id = NEW.id; INSERT INTO finance.subscription_plans SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_subscription_plans (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_subscription_plans_dual_write_to_finance
  AFTER INSERT OR UPDATE OR DELETE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION finance.dual_write_from_subscription_plans();

CREATE OR REPLACE FUNCTION finance.dual_write_from_subscription_invoices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = finance, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM finance.subscription_invoices WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO finance.subscription_invoices SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM finance.subscription_invoices WHERE id = NEW.id; INSERT INTO finance.subscription_invoices SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_subscription_invoices (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_subscription_invoices_dual_write_to_finance
  AFTER INSERT OR UPDATE OR DELETE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION finance.dual_write_from_subscription_invoices();

CREATE OR REPLACE FUNCTION finance.dual_write_from_subscription_features()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = finance, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM finance.subscription_features WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO finance.subscription_features SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM finance.subscription_features WHERE id = NEW.id; INSERT INTO finance.subscription_features SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_subscription_features (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_subscription_features_dual_write_to_finance
  AFTER INSERT OR UPDATE OR DELETE ON public.subscription_features
  FOR EACH ROW EXECUTE FUNCTION finance.dual_write_from_subscription_features();

-- ══════════════════════════════════════════════════════════════════════
-- 10. Drift monitor
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION finance.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = finance, public, pg_catalog AS $$
  SELECT 'invoices_minus_finance_invoices', (SELECT count(*) FROM public.invoices) - (SELECT count(*) FROM finance.invoices)
  UNION ALL
  SELECT 'invoice_line_items_minus_finance_invoice_lines', (SELECT count(*) FROM public.invoice_line_items) - (SELECT count(*) FROM finance.invoice_lines)
  UNION ALL
  SELECT 'payments_minus_finance_payments', (SELECT count(*) FROM public.payments) - (SELECT count(*) FROM finance.payments)
  UNION ALL
  SELECT 'subscriptions_minus_finance_subscriptions', (SELECT count(*) FROM public.subscriptions) - (SELECT count(*) FROM finance.subscriptions)
  UNION ALL
  SELECT 'subscription_plans_minus_finance_subscription_plans', (SELECT count(*) FROM public.subscription_plans) - (SELECT count(*) FROM finance.subscription_plans)
  UNION ALL
  SELECT 'subscription_invoices_minus_finance_subscription_invoices', (SELECT count(*) FROM public.subscription_invoices) - (SELECT count(*) FROM finance.subscription_invoices)
  UNION ALL
  SELECT 'subscription_features_minus_finance_subscription_features', (SELECT count(*) FROM public.subscription_features) - (SELECT count(*) FROM finance.subscription_features);
$$;
COMMENT ON FUNCTION finance.base_drift_check IS 'Phase 5 Finance Step 1 drift monitor. All seven deltas should remain 0.';
GRANT EXECUTE ON FUNCTION finance.base_drift_check TO service_role;
