-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516143912; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- ── Helper: primary franchise per tenant (earliest created_at) ───────────────
CREATE TEMP TABLE _pf ON COMMIT DROP AS
SELECT DISTINCT ON (f.tenant_id)
  f.tenant_id,
  f.id AS franchise_id
FROM public.franchises f
ORDER BY f.tenant_id, f.created_at ASC;

CREATE INDEX ON _pf (tenant_id);

-- ══════════════════════════════════════════════════════════════════════════
-- SECTION 1: public.compliance_* — add franchise_id where missing
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.compliance_domain_verifications
  ADD COLUMN IF NOT EXISTS franchise_id UUID;
ALTER TABLE public.compliance_domain_verifications
  ALTER COLUMN franchise_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_domain_verifications_franchise
  ON public.compliance_domain_verifications (franchise_id);

ALTER TABLE public.compliance_legal_holds
  ADD COLUMN IF NOT EXISTS franchise_id UUID;
ALTER TABLE public.compliance_legal_holds
  ALTER COLUMN franchise_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_legal_holds_franchise
  ON public.compliance_legal_holds (franchise_id);

ALTER TABLE public.compliance_retention_policies
  ADD COLUMN IF NOT EXISTS franchise_id UUID;
ALTER TABLE public.compliance_retention_policies
  ALTER COLUMN franchise_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_retention_policies_franchise
  ON public.compliance_retention_policies (franchise_id);

ALTER TABLE public.compliance_screenings
  ALTER COLUMN franchise_id SET NOT NULL;

UPDATE public.compliance_records_duplicate d
SET    franchise_id = pf.franchise_id
FROM   _pf pf
WHERE  d.tenant_id    = pf.tenant_id
  AND  d.franchise_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.compliance_records_duplicate WHERE franchise_id IS NULL LIMIT 1) THEN
    RAISE WARNING 'compliance_records_duplicate: some rows still null after backfill — NOT NULL not set.';
  ELSE
    ALTER TABLE public.compliance_records_duplicate ALTER COLUMN franchise_id SET NOT NULL;
    RAISE NOTICE 'compliance_records_duplicate: franchise_id NOT NULL enforced.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compliance_records_duplicate_franchise
  ON public.compliance_records_duplicate (franchise_id);

-- ══════════════════════════════════════════════════════════════════════════
-- SECTION 2: module_finance.* — backfill + enforce NOT NULL
-- ══════════════════════════════════════════════════════════════════════════

UPDATE module_finance.module_finance_invoices i
SET    franchise_id = pf.franchise_id
FROM   _pf pf
WHERE  i.tenant_id    = pf.tenant_id
  AND  i.franchise_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM module_finance.module_finance_invoices WHERE franchise_id IS NULL LIMIT 1) THEN
    RAISE WARNING 'module_finance_invoices: some rows still null after backfill — NOT NULL not set.';
  ELSE
    ALTER TABLE module_finance.module_finance_invoices ALTER COLUMN franchise_id SET NOT NULL;
    RAISE NOTICE 'module_finance_invoices: franchise_id NOT NULL enforced.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_module_finance_invoices_franchise
  ON module_finance.module_finance_invoices (franchise_id);

ALTER TABLE module_finance.module_finance_payments
  ALTER COLUMN franchise_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_module_finance_payments_franchise
  ON module_finance.module_finance_payments (franchise_id);

ALTER TABLE module_finance.module_finance_invoice_items
  ADD COLUMN IF NOT EXISTS franchise_id UUID;

UPDATE module_finance.module_finance_invoice_items ii
SET    franchise_id = inv.franchise_id
FROM   module_finance.module_finance_invoices inv
WHERE  ii.invoice_id = inv.id
  AND  ii.franchise_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM module_finance.module_finance_invoice_items WHERE franchise_id IS NULL LIMIT 1) THEN
    RAISE WARNING 'module_finance_invoice_items: some rows still null after backfill — NOT NULL not set.';
  ELSE
    ALTER TABLE module_finance.module_finance_invoice_items ALTER COLUMN franchise_id SET NOT NULL;
    RAISE NOTICE 'module_finance_invoice_items: franchise_id NOT NULL enforced.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_module_finance_invoice_items_franchise
  ON module_finance.module_finance_invoice_items (franchise_id);

-- Column comments
COMMENT ON COLUMN public.compliance_domain_verifications.franchise_id IS
  'NOT NULL since 2026-05-16 P0 follow-up. Table was empty at time of retrofit.';
COMMENT ON COLUMN public.compliance_legal_holds.franchise_id IS
  'NOT NULL since 2026-05-16 P0 follow-up. Table was empty at time of retrofit.';
COMMENT ON COLUMN public.compliance_retention_policies.franchise_id IS
  'NOT NULL since 2026-05-16 P0 follow-up. Table was empty at time of retrofit.';
COMMENT ON COLUMN public.compliance_records_duplicate.franchise_id IS
  'NOT NULL since 2026-05-16 P0 follow-up. Null rows backfilled to tenant primary franchise.';
COMMENT ON COLUMN module_finance.module_finance_invoices.franchise_id IS
  'NOT NULL since 2026-05-16 P0 follow-up. Null rows backfilled to tenant primary franchise.';
COMMENT ON COLUMN module_finance.module_finance_invoice_items.franchise_id IS
  'NOT NULL since 2026-05-16 P0 follow-up. Inherited from parent invoice at backfill time.';