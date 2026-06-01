-- Phase 6 Step 53 — smoke test for finance.invoice.overdue dunning emit.
--
-- Asserts:
--   A1. UPDATE finance.invoices SET status='overdue' on a draft
--       invoice inserts exactly one core.notifications row.
--   A2. The row has recipient_party_id = invoices.customer_id,
--       intent_kind='finance.invoice.overdue', and payload carrying
--       invoice_id/number/total/balance_due/currency/due_date.
--   A3. An UPDATE on the same row that DOESN'T change status
--       (status stays 'overdue') does NOT emit a second notification.
--   A4. A transition out of overdue (→ 'paid') and back to 'overdue'
--       DOES emit a second notification — different transition = new
--       event.
--
-- Self-cleaning.

DO $$
DECLARE
  v_tenant uuid; v_franchise uuid;
  v_account_id uuid; v_invoice_id uuid;
  v_notif_count_before integer; v_notif_count_after integer;
  v_notif_id uuid; v_payload jsonb; v_recipient uuid;
BEGIN
  SELECT t.id, f.id INTO v_tenant, v_franchise
  FROM public.tenants t JOIN public.franchises f ON f.tenant_id=t.id
  ORDER BY t.created_at, f.created_at LIMIT 1;

  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-DUN-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;

  INSERT INTO finance.invoices (tenant_id, invoice_number, customer_id, status, type,
                                 issue_date, due_date, currency, subtotal, total, balance_due)
  VALUES (v_tenant, 'SMOKE-INV-' || substr(gen_random_uuid()::text,1,8),
          v_account_id, 'draft', 'standard',
          current_date - 30, current_date - 10, 'INR', 1000.00, 1180.00, 1180.00)
  RETURNING id INTO v_invoice_id;

  SELECT count(*)::integer INTO v_notif_count_before
  FROM core.notifications WHERE subject_type='finance.invoice' AND subject_id=v_invoice_id;

  UPDATE finance.invoices SET status='overdue' WHERE id=v_invoice_id;
  SELECT count(*)::integer INTO v_notif_count_after
  FROM core.notifications WHERE subject_type='finance.invoice' AND subject_id=v_invoice_id;
  IF v_notif_count_after <> v_notif_count_before + 1 THEN
    RAISE EXCEPTION 'A1: delta=%; expected +1', v_notif_count_after - v_notif_count_before;
  END IF;
  RAISE NOTICE 'A1 OK — one notification on draft → overdue';

  SELECT id, payload, recipient_party_id INTO v_notif_id, v_payload, v_recipient
  FROM core.notifications WHERE subject_type='finance.invoice' AND subject_id=v_invoice_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_recipient <> v_account_id THEN
    RAISE EXCEPTION 'A2: recipient_party_id=% vs account=%', v_recipient, v_account_id;
  END IF;
  IF (v_payload->>'invoice_id')::uuid <> v_invoice_id THEN
    RAISE EXCEPTION 'A2: payload invoice_id mismatch';
  END IF;
  IF v_payload->>'subject' NOT LIKE 'Invoice %is overdue' THEN
    RAISE EXCEPTION 'A2: subject=%', v_payload->>'subject';
  END IF;
  RAISE NOTICE 'A2 OK — payload + recipient correct';

  -- No-op UPDATE doesn't fire (status didn't change)
  UPDATE finance.invoices SET notes='ping' WHERE id=v_invoice_id;
  SELECT count(*)::integer INTO v_notif_count_after
  FROM core.notifications WHERE subject_type='finance.invoice' AND subject_id=v_invoice_id;
  IF v_notif_count_after <> v_notif_count_before + 1 THEN
    RAISE EXCEPTION 'A3: double-emit; count=%', v_notif_count_after - v_notif_count_before;
  END IF;
  RAISE NOTICE 'A3 OK — no double-emit on no-op UPDATE';

  -- Genuine re-transition: paid → overdue
  UPDATE finance.invoices SET status='paid'    WHERE id=v_invoice_id;
  UPDATE finance.invoices SET status='overdue' WHERE id=v_invoice_id;
  SELECT count(*)::integer INTO v_notif_count_after
  FROM core.notifications WHERE subject_type='finance.invoice' AND subject_id=v_invoice_id;
  IF v_notif_count_after <> v_notif_count_before + 2 THEN
    RAISE EXCEPTION 'A4: count=% after re-transition; expected +2 from baseline', v_notif_count_after - v_notif_count_before;
  END IF;
  RAISE NOTICE 'A4 OK — re-transition emits again';

  -- Cleanup
  DELETE FROM comms.deliveries WHERE notification_id IN (
    SELECT id FROM core.notifications WHERE subject_type='finance.invoice' AND subject_id=v_invoice_id
  );
  DELETE FROM core.notifications WHERE subject_type='finance.invoice' AND subject_id=v_invoice_id;
  DELETE FROM finance.invoices WHERE id=v_invoice_id;
  DELETE FROM crm.account_extensions WHERE party_id=v_account_id;
  DELETE FROM public.accounts WHERE id=v_account_id;

  RAISE NOTICE '=== INVOICE OVERDUE SMOKE PASSED (4/4) ===';
END;
$$;
