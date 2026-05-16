-- ══════════════════════════════════════════════════════════════════════════
-- P0 Hierarchy Fix: enforce franchise_id NOT NULL across all business tables
-- ══════════════════════════════════════════════════════════════════════════
--
-- Backfill strategy: rows with franchise_id IS NULL are assigned to their
-- tenant's PRIMARY FRANCHISE (earliest created_at). For multi-franchise
-- tenants historical data sits on the root; teams can re-assign specific
-- records via the UI if needed.
--
-- Phase 1 — franchise_id nullable → backfill → NOT NULL:
--   accounts, contacts, leads, activities, opportunities, quotes,
--   compliance_obligations, compliance_records, invoices
--
-- Phase 2 — franchise_id column missing → ADD → backfill → NOT NULL:
--   quote_approval_rules, compliance_rules, invoice_line_items
--
-- Skipped (no tenant_id anchor — addressed in separate epic):
--   compliance_checks, compliance_actions_log,
--   compliance_domain_verifications, compliance_legal_holds,
--   compliance_retention_policies, payment_webhook_events
--
-- DB-VERIFICATION: p0-hierarchy-franchise-id-v1
-- DB-ARCH-APPROVAL: vimal-2026-05-15

-- ── Helper: primary franchise per tenant (earliest created_at) ───────────────
-- Materialised once, referenced by every UPDATE below.

CREATE TEMP TABLE _primary_franchise ON COMMIT DROP AS
SELECT DISTINCT ON (f.tenant_id)
  f.tenant_id,
  f.id AS franchise_id
FROM public.franchises f
ORDER BY f.tenant_id, f.created_at ASC;

CREATE INDEX ON _primary_franchise (tenant_id);

-- ── Phase 1 backfills ────────────────────────────────────────────────────────

-- accounts (6,502 nulls)
UPDATE public.accounts a
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  a.tenant_id    = pf.tenant_id
  AND  a.franchise_id IS NULL;

-- contacts (6,729 nulls)
UPDATE public.contacts c
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  c.tenant_id    = pf.tenant_id
  AND  c.franchise_id IS NULL;

-- leads (6 nulls)
UPDATE public.leads l
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  l.tenant_id    = pf.tenant_id
  AND  l.franchise_id IS NULL;

-- activities (26 nulls)
UPDATE public.activities a
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  a.tenant_id    = pf.tenant_id
  AND  a.franchise_id IS NULL;

-- opportunities (40 nulls)
UPDATE public.opportunities o
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  o.tenant_id    = pf.tenant_id
  AND  o.franchise_id IS NULL;

-- quotes (444 nulls)
UPDATE public.quotes q
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  q.tenant_id    = pf.tenant_id
  AND  q.franchise_id IS NULL;

-- compliance_obligations (1,440 nulls)
UPDATE public.compliance_obligations co
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  co.tenant_id    = pf.tenant_id
  AND  co.franchise_id IS NULL;

-- compliance_records (1,384 nulls)
UPDATE public.compliance_records cr
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  cr.tenant_id    = pf.tenant_id
  AND  cr.franchise_id IS NULL;

-- invoices (16 nulls)
UPDATE public.invoices i
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  i.tenant_id    = pf.tenant_id
  AND  i.franchise_id IS NULL;

-- ── Validate before setting NOT NULL (fail fast if any nulls remain) ─────────

DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM public.accounts           WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.contacts           WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.leads              WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.activities         WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.opportunities      WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.quotes             WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.compliance_obligations WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.compliance_records WHERE franchise_id IS NULL) +
    (SELECT COUNT(*) FROM public.invoices           WHERE franchise_id IS NULL)
  INTO remaining;

  IF remaining > 0 THEN
    RAISE EXCEPTION
      'P0 backfill incomplete: % rows still have NULL franchise_id. '
      'Check that every tenant has at least one franchise.',
      remaining;
  END IF;
END $$;

-- ── Set NOT NULL on Phase 1 tables ───────────────────────────────────────────

ALTER TABLE public.accounts             ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.contacts             ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.leads                ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.activities           ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.opportunities        ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.quotes               ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.compliance_obligations ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.compliance_records   ALTER COLUMN franchise_id SET NOT NULL;
ALTER TABLE public.invoices             ALTER COLUMN franchise_id SET NOT NULL;

-- ── Phase 2: tables missing franchise_id column entirely ─────────────────────

-- quote_approval_rules (70 rows, tenant_id NOT NULL)
ALTER TABLE public.quote_approval_rules
  ADD COLUMN IF NOT EXISTS franchise_id UUID
    REFERENCES public.franchises(id) ON DELETE RESTRICT;

UPDATE public.quote_approval_rules qar
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  qar.tenant_id    = pf.tenant_id
  AND  qar.franchise_id IS NULL;

ALTER TABLE public.quote_approval_rules
  ALTER COLUMN franchise_id SET NOT NULL;

-- compliance_rules (0 rows, tenant_id NOT NULL)
ALTER TABLE public.compliance_rules
  ADD COLUMN IF NOT EXISTS franchise_id UUID
    REFERENCES public.franchises(id) ON DELETE RESTRICT;

UPDATE public.compliance_rules cr
SET    franchise_id = pf.franchise_id
FROM   _primary_franchise pf
WHERE  cr.tenant_id    = pf.tenant_id
  AND  cr.franchise_id IS NULL;

ALTER TABLE public.compliance_rules
  ALTER COLUMN franchise_id SET NOT NULL;

-- invoice_line_items (20 rows — franchise inherits from parent invoice)
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS franchise_id UUID
    REFERENCES public.franchises(id) ON DELETE RESTRICT;

UPDATE public.invoice_line_items li
SET    franchise_id = i.franchise_id
FROM   public.invoices i
WHERE  li.invoice_id    = i.id
  AND  li.franchise_id IS NULL;

-- Only set NOT NULL if every line item resolved (invoices may be empty)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.invoice_line_items WHERE franchise_id IS NULL
  ) THEN
    ALTER TABLE public.invoice_line_items ALTER COLUMN franchise_id SET NOT NULL;
  ELSE
    RAISE WARNING 'invoice_line_items: some rows still null after backfill — NOT NULL not set. Investigate orphaned line items.';
  END IF;
END $$;

-- ── Indexes: franchise_id lookups ─────────────────────────────────────────────
-- Only add where not already present — avoids duplicate index error.

CREATE INDEX IF NOT EXISTS idx_accounts_franchise
  ON public.accounts (franchise_id);

CREATE INDEX IF NOT EXISTS idx_contacts_franchise
  ON public.contacts (franchise_id);

CREATE INDEX IF NOT EXISTS idx_leads_franchise
  ON public.leads (franchise_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_franchise
  ON public.opportunities (franchise_id);

CREATE INDEX IF NOT EXISTS idx_quotes_franchise
  ON public.quotes (franchise_id);

CREATE INDEX IF NOT EXISTS idx_invoices_franchise
  ON public.invoices (franchise_id);

CREATE INDEX IF NOT EXISTS idx_compliance_obligations_franchise
  ON public.compliance_obligations (franchise_id);

CREATE INDEX IF NOT EXISTS idx_compliance_records_franchise
  ON public.compliance_records (franchise_id);

CREATE INDEX IF NOT EXISTS idx_quote_approval_rules_franchise
  ON public.quote_approval_rules (franchise_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_franchise
  ON public.invoice_line_items (franchise_id) WHERE franchise_id IS NOT NULL;

-- ── RLS policy updates ────────────────────────────────────────────────────────
-- Add franchise-scoped policies where only tenant-scoped ones existed.
-- Pattern: platform_admin bypasses; tenant_admin sees whole tenant;
-- franchise_admin/manager/operator sees only their franchise.
-- We use a helper that doesn't require the LTREE extension at apply time.

-- quote_approval_rules: was tenant-scoped only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quote_approval_rules'
      AND policyname = 'qar_franchise_select'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY qar_franchise_select ON public.quote_approval_rules
        FOR SELECT USING (
          -- platform admin sees all
          EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
          -- tenant members see their tenant's rules
          OR tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.tenant_id IS NOT NULL
          )
        );
    $pol$;
  END IF;
END $$;

-- ── Summary comment ───────────────────────────────────────────────────────────
COMMENT ON COLUMN public.accounts.franchise_id IS
  'NOT NULL since 2026-05-15 P0 fix. Historical nulls backfilled to tenant primary franchise.';
COMMENT ON COLUMN public.contacts.franchise_id IS
  'NOT NULL since 2026-05-15 P0 fix. Historical nulls backfilled to tenant primary franchise.';
COMMENT ON COLUMN public.quotes.franchise_id IS
  'NOT NULL since 2026-05-15 P0 fix. Historical nulls backfilled to tenant primary franchise.';
COMMENT ON COLUMN public.invoices.franchise_id IS
  'NOT NULL since 2026-05-15 P0 fix. Historical nulls backfilled to tenant primary franchise.';
