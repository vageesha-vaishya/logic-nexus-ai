-- Smoke: Phase 6 Slice A — finance gap-fill schema (13 tables).
-- Run via scripts/run-supabase-smokes.sh
BEGIN;

-- All 13 tables exist and are RLS-enabled
DO $$
DECLARE
  expected text[] := ARRAY[
    'periods','invoice_amendments','payment_allocations','payment_webhook_events',
    'credit_notes','refunds','tax_exemption_certificates','tax_calculations',
    'margin_rules','pricing_tier_configs','pricing_tier_ranges',
    'dunning_policies','dunning_runs'
  ];
  t text;
  rls boolean;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    PERFORM 1 FROM information_schema.tables
      WHERE table_schema='finance' AND table_name=t;
    IF NOT FOUND THEN RAISE EXCEPTION 'missing finance.% table', t; END IF;

    SELECT relrowsecurity INTO rls
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='finance' AND c.relname=t;
    IF NOT rls THEN RAISE EXCEPTION 'finance.% does not have RLS enabled', t; END IF;
  END LOOP;
END $$;

-- Each table has a tenant_select policy
DO $$
DECLARE
  tables_needing_policy text[] := ARRAY[
    'periods','invoice_amendments','payment_allocations','payment_webhook_events',
    'credit_notes','refunds','tax_exemption_certificates','tax_calculations',
    'margin_rules','pricing_tier_configs','pricing_tier_ranges',
    'dunning_policies','dunning_runs'
  ];
  t text;
  policy_count int;
BEGIN
  FOREACH t IN ARRAY tables_needing_policy LOOP
    SELECT COUNT(*) INTO policy_count
      FROM pg_policies WHERE schemaname='finance' AND tablename=t;
    IF policy_count = 0 THEN
      RAISE EXCEPTION 'finance.% has RLS enabled but no policies (locks out all reads)', t;
    END IF;
  END LOOP;
END $$;

-- FK integrity: a few representative checks
DO $$
DECLARE r record;
BEGIN
  -- credit_notes → invoices
  SELECT COUNT(*) AS n INTO r
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.constraint_type='FOREIGN KEY'
      AND tc.table_schema='finance' AND tc.table_name='credit_notes'
      AND kcu.column_name='invoice_id';
  IF r.n = 0 THEN RAISE EXCEPTION 'credit_notes.invoice_id FK missing'; END IF;

  -- pricing_tier_ranges → pricing_tier_configs (CASCADE)
  SELECT COUNT(*) AS n INTO r
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc USING (constraint_name, constraint_schema)
    WHERE tc.table_schema='finance' AND tc.table_name='pricing_tier_ranges'
      AND rc.delete_rule='CASCADE';
  IF r.n = 0 THEN RAISE EXCEPTION 'pricing_tier_ranges → pricing_tier_configs CASCADE missing'; END IF;

  -- payment_webhook_events → refunds (deferred FK added after refunds existed)
  SELECT COUNT(*) AS n INTO r
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
    WHERE tc.constraint_type='FOREIGN KEY'
      AND tc.table_schema='finance' AND tc.table_name='payment_webhook_events'
      AND kcu.column_name='related_refund_id';
  IF r.n = 0 THEN RAISE EXCEPTION 'payment_webhook_events.related_refund_id FK missing'; END IF;
END $$;

-- updated_at triggers fire (sample: credit_notes)
DO $$
DECLARE
  v_tenant uuid := gen_random_uuid();
  v_invoice uuid;
  v_cn uuid;
  v_first timestamptz;
  v_second timestamptz;
BEGIN
  -- Borrow an existing invoice (don't need to create one) — or skip if none
  SELECT id INTO v_invoice FROM finance.invoices LIMIT 1;
  IF v_invoice IS NULL THEN
    RAISE NOTICE 'no invoices exist; skipping updated_at trigger smoke';
    RETURN;
  END IF;

  INSERT INTO finance.credit_notes (tenant_id, credit_note_number, invoice_id, amount, currency, reason)
    VALUES (v_tenant, 'SMOKE-CN-' || gen_random_uuid(), v_invoice, 1.00, 'USD', 'smoke')
    RETURNING id, updated_at INTO v_cn, v_first;

  PERFORM pg_sleep(0.05);
  UPDATE finance.credit_notes SET reason='smoke-updated' WHERE id=v_cn;
  SELECT updated_at INTO v_second FROM finance.credit_notes WHERE id=v_cn;

  IF v_second <= v_first THEN
    RAISE EXCEPTION 'credit_notes updated_at trigger did not bump (% <= %)', v_second, v_first;
  END IF;
END $$;

-- CHECK constraints reject obvious junk
DO $$
DECLARE
  v_tenant uuid := gen_random_uuid();
  v_invoice uuid;
  v_payment uuid;
BEGIN
  SELECT id INTO v_invoice FROM finance.invoices LIMIT 1;
  SELECT id INTO v_payment FROM finance.payments LIMIT 1;
  IF v_invoice IS NULL OR v_payment IS NULL THEN
    RAISE NOTICE 'no invoice or payment exists; skipping CHECK constraint smoke';
    RETURN;
  END IF;

  -- payment_allocations.allocated_amount must be > 0
  BEGIN
    INSERT INTO finance.payment_allocations (tenant_id, payment_id, invoice_id, allocated_amount)
      VALUES (v_tenant, v_payment, v_invoice, 0);
    RAISE EXCEPTION 'expected CHECK violation on allocated_amount=0';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- refunds.amount must be > 0
  BEGIN
    INSERT INTO finance.refunds (tenant_id, payment_id, amount, currency, reason)
      VALUES (v_tenant, v_payment, 0, 'USD', 'smoke');
    RAISE EXCEPTION 'expected CHECK violation on refunds.amount=0';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- periods date range sanity (end_date < start_date should fail)
  BEGIN
    INSERT INTO finance.periods (tenant_id, name, start_date, end_date)
      VALUES (v_tenant, 'SMOKE-INVERTED', '2026-12-31', '2026-01-01');
    RAISE EXCEPTION 'expected CHECK violation on inverted period dates';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

ROLLBACK;
SELECT 'finance_missing_schema OK' AS smoke_result;
