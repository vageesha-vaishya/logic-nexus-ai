-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515164404; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- P0 Hierarchy Fix: enforce franchise_id NOT NULL across all business tables
-- DB-VERIFICATION: p0-hierarchy-franchise-id-v1
-- DB-ARCH-APPROVAL: vimal-2026-05-15

CREATE TEMP TABLE _primary_franchise ON COMMIT DROP AS
SELECT DISTINCT ON (f.tenant_id)
  f.tenant_id,
  f.id AS franchise_id
FROM public.franchises f
ORDER BY f.tenant_id, f.created_at ASC;

CREATE INDEX ON _primary_franchise (tenant_id);

-- Phase 1 backfills
UPDATE public.accounts a
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  a.tenant_id = pf.tenant_id AND a.franchise_id IS NULL;

UPDATE public.contacts c
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  c.tenant_id = pf.tenant_id AND c.franchise_id IS NULL;

UPDATE public.leads l
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  l.tenant_id = pf.tenant_id AND l.franchise_id IS NULL;

UPDATE public.activities a
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  a.tenant_id = pf.tenant_id AND a.franchise_id IS NULL;

ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS valid_close_date;
UPDATE public.opportunities o
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  o.tenant_id = pf.tenant_id AND o.franchise_id IS NULL;
ALTER TABLE public.opportunities
  ADD CONSTRAINT valid_close_date CHECK (
    (close_date >= CURRENT_DATE)
    OR (stage = ANY (ARRAY['closed_won'::opportunity_stage, 'closed_lost'::opportunity_stage]))
  ) NOT VALID;

UPDATE public.quotes q
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  q.tenant_id = pf.tenant_id AND q.franchise_id IS NULL;

UPDATE public.compliance_obligations co
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  co.tenant_id = pf.tenant_id AND co.franchise_id IS NULL;

UPDATE public.compliance_records cr
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  cr.tenant_id = pf.tenant_id AND cr.franchise_id IS NULL;

UPDATE public.invoices i
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  i.tenant_id = pf.tenant_id AND i.franchise_id IS NULL;

-- Guard: fail if any nulls remain
DO $$
DECLARE remaining INT;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM public.accounts            WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.contacts            WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.leads               WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.activities          WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.opportunities       WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.quotes              WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.compliance_obligations WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.compliance_records  WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.invoices            WHERE franchise_id IS NULL)
  INTO remaining;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'P0 backfill incomplete: % rows still have NULL franchise_id.', remaining;
  END IF;
END $$;

-- Set NOT NULL
ALTER TABLE public.accounts             ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.contacts             ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.leads                ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.activities           ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.opportunities        ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.quotes               ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.compliance_obligations ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.compliance_records   ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.invoices             ALTER COLUMN franchise_id SET NOT NULL;

-- Phase 2: add missing franchise_id columns
ALTER TABLE public.quote_approval_rules
  ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT;
UPDATE public.quote_approval_rules qar
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  qar.tenant_id = pf.tenant_id AND qar.franchise_id IS NULL;
ALTER TABLE public.quote_approval_rules ALTER COLUMN franchise_id SET NOT NULL;

ALTER TABLE public.compliance_rules
  ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT;
UPDATE public.compliance_rules cr
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  cr.tenant_id = pf.tenant_id AND cr.franchise_id IS NULL;
ALTER TABLE public.compliance_rules ALTER COLUMN franchise_id SET NOT NULL;

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES public.franchises(id) ON DELETE RESTRICT;
UPDATE public.invoice_line_items li
SET    franchise_id = i.franchise_id
FROM   public.invoices i
WHERE  li.invoice_id = i.id AND li.franchise_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.invoice_line_items WHERE franchise_id IS NULL) THEN
    ALTER TABLE public.invoice_line_items ALTER COLUMN franchise_id SET NOT NULL;
  ELSE
    RAISE WARNING 'invoice_line_items: orphaned rows — NOT NULL skipped.';
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_franchise              ON public.accounts (franchise_id);
CREATE INDEX IF NOT EXISTS idx_contacts_franchise              ON public.contacts (franchise_id);
CREATE INDEX IF NOT EXISTS idx_leads_franchise                 ON public.leads (franchise_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_franchise         ON public.opportunities (franchise_id);
CREATE INDEX IF NOT EXISTS idx_quotes_franchise                ON public.quotes (franchise_id);
CREATE INDEX IF NOT EXISTS idx_invoices_franchise              ON public.invoices (franchise_id);
CREATE INDEX IF NOT EXISTS idx_compliance_obligations_franchise ON public.compliance_obligations (franchise_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_franchise    ON public.compliance_records (franchise_id);
CREATE INDEX IF NOT EXISTS idx_quote_approval_rules_franchise  ON public.quote_approval_rules (franchise_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_franchise    ON public.invoice_line_items (franchise_id) WHERE franchise_id IS NOT NULL;

-- RLS: franchise-aware policy on quote_approval_rules
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_approval_rules' AND policyname='qar_franchise_select') THEN
    EXECUTE $pol$
      CREATE POLICY qar_franchise_select ON public.quote_approval_rules FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
        OR tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL)
      );
    $pol$;
  END IF;
END $$;

COMMENT ON COLUMN public.accounts.franchise_id  IS 'NOT NULL since 2026-05-15 P0 fix. Backfilled to tenant primary franchise.';
COMMENT ON COLUMN public.contacts.franchise_id  IS 'NOT NULL since 2026-05-15 P0 fix. Backfilled to tenant primary franchise.';
COMMENT ON COLUMN public.quotes.franchise_id    IS 'NOT NULL since 2026-05-15 P0 fix. Backfilled to tenant primary franchise.';
COMMENT ON COLUMN public.invoices.franchise_id  IS 'NOT NULL since 2026-05-15 P0 fix. Backfilled to tenant primary franchise.';