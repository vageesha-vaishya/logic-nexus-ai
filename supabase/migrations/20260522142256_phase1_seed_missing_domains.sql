-- Multi-domain Phase 1 — seed platform_domains rows for the 5 manifests
-- that previously had no seedMigration: CRM, FINANCE, COMMUNICATIONS,
-- COMPLIANCE, QUOTATION.
--
-- Per docs/plans/2026-05-20-multi-domain-platform-sequence-design.md §Phase 1
-- Option 2: seed the domain rows only — do NOT auto-assign to every tenant.
-- Tenant assignment is the commercial layer's responsibility and lives in
-- a separate subscription-lifecycle migration (still pending).
--
-- Idempotent via ON CONFLICT (key) DO UPDATE so re-applies are safe.

BEGIN;

INSERT INTO public.platform_domains (key, code, name, description, owner, status, is_active)
VALUES
  ('crm',            'CRM',            'Customer Relationship Management',
   'Leads, accounts, contacts, activities, pipeline, quotation.',
   'Platform Admin', 'active', true),
  ('finance',        'FINANCE',        'Finance & Accounting',
   'Invoices, GL posting, Razorpay + GST, ledger.',
   'Platform Admin', 'active', true),
  ('communications', 'COMMUNICATIONS', 'Communications',
   'Email, SMS, WhatsApp, in-app messaging, multi-channel.',
   'Platform Admin', 'active', true),
  ('compliance',     'COMPLIANCE',     'Compliance',
   'KYC, audit logs, regulatory reporting.',
   'Platform Admin', 'active', true),
  ('quotation',      'QUOTATION',      'Quotation & Unified Composer',
   'Quote composer, PDF export, multi-channel sending.',
   'Platform Admin', 'active', true)
ON CONFLICT (key) DO UPDATE SET
  code        = EXCLUDED.code,
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  status      = EXCLUDED.status,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- Verify all 5 rows are present after the upsert.
DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.platform_domains
  WHERE code IN ('CRM','FINANCE','COMMUNICATIONS','COMPLIANCE','QUOTATION')
    AND is_active = true;
  IF v_count < 5 THEN
    RAISE EXCEPTION 'Phase 1 seed verification failed: expected 5 rows, found %', v_count;
  END IF;
END $$;

COMMIT;
