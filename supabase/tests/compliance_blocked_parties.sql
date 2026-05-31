-- Phase 6 Step 48 — smoke test for compliance.v_blocked_parties.
--
-- Full lifecycle: appears on failed → disappears on override →
-- reappears on revoke → disappears on expiry. Each transition
-- moves the screening between states the view's predicate either
-- includes or excludes.
--
-- Asserts (all keyed on party_id):
--   A1. Party appears once in v_blocked_parties after the saga
--       produces a failed screening (status=failed + converted lead).
--   A2. Override flips status to 'overridden' → party disappears
--       (predicate is status='failed').
--   A3. Revoke flips back to 'failed' with fresh 90d expires_at →
--       party reappears.
--   A4. Manual expiry (UPDATE expires_at to past) → party
--       disappears (predicate excludes expires_at <= now()).
--
-- Residue: 2 append-only core.audit_log rows (override + revoke).

DO $$
DECLARE
  v_tenant uuid; v_franchise uuid;
  v_search_name text := 'Mega Evil Corp';
  v_user_id uuid := gen_random_uuid();
  v_account_id uuid; v_lead_id uuid;
  v_outbox_id uuid; v_screening_id uuid;
  v_audit_id uuid;
  v_in_inbox integer;
  v_display text;
BEGIN
  SELECT t.id, f.id INTO v_tenant, v_franchise
  FROM public.tenants t JOIN public.franchises f ON f.tenant_id=t.id
  ORDER BY t.created_at, f.created_at LIMIT 1;

  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-INBOX-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;
  INSERT INTO public.leads (tenant_id, franchise_id, first_name, last_name, company, company_name, contact_name)
  VALUES (v_tenant, v_franchise, 'Smoke', 'Inbox', v_search_name, v_search_name, 'Smoke Inbox Contact')
  RETURNING id INTO v_lead_id;
  SELECT id INTO v_outbox_id FROM core.outbox
  WHERE event_type='sales.lead.created' AND entity_id=v_lead_id ORDER BY occurred_at DESC LIMIT 1;
  SELECT s.screening_id INTO v_screening_id
  FROM compliance.screen_subject(v_tenant, 'sales.lead', v_lead_id, NULL,
                                  'sales.lead.created', v_outbox_id, v_search_name, NULL) s;
  UPDATE public.leads SET converted_account_id=v_account_id, converted_at=now() WHERE id=v_lead_id;

  SELECT count(*)::integer, max(party_display_name) INTO v_in_inbox, v_display
  FROM compliance.v_blocked_parties WHERE party_id=v_account_id;
  IF v_in_inbox <> 1 THEN RAISE EXCEPTION 'A1: count=%', v_in_inbox; END IF;
  RAISE NOTICE 'A1 OK — party in inbox (display=%)', v_display;

  SELECT r.audit_decision_id INTO v_audit_id
  FROM compliance.override_screening(v_screening_id, v_user_id, '[smoke_test] inbox override', NULL) r;
  SELECT count(*)::integer INTO v_in_inbox
  FROM compliance.v_blocked_parties WHERE party_id=v_account_id;
  IF v_in_inbox <> 0 THEN RAISE EXCEPTION 'A2: count=% post-override', v_in_inbox; END IF;
  RAISE NOTICE 'A2 OK — disappears on override';

  PERFORM compliance.revoke_override(v_screening_id, v_user_id, '[smoke_test] inbox revoke');
  SELECT count(*)::integer INTO v_in_inbox
  FROM compliance.v_blocked_parties WHERE party_id=v_account_id;
  IF v_in_inbox <> 1 THEN RAISE EXCEPTION 'A3: count=% post-revoke', v_in_inbox; END IF;
  RAISE NOTICE 'A3 OK — reappears on revoke';

  UPDATE compliance.screenings SET expires_at = now() - interval '1 day' WHERE id=v_screening_id;
  SELECT count(*)::integer INTO v_in_inbox
  FROM compliance.v_blocked_parties WHERE party_id=v_account_id;
  IF v_in_inbox <> 0 THEN RAISE EXCEPTION 'A4: count=% post-expire', v_in_inbox; END IF;
  RAISE NOTICE 'A4 OK — disappears on expiry';

  DELETE FROM comms.deliveries WHERE notification_id IN (
    SELECT id FROM core.notifications WHERE subject_type='compliance.screening' AND subject_id=v_screening_id
  );
  DELETE FROM core.notifications WHERE subject_type='compliance.screening' AND subject_id=v_screening_id;
  DELETE FROM compliance.audit_decisions WHERE screening_id=v_screening_id;
  DELETE FROM public.leads WHERE id=v_lead_id;
  DELETE FROM compliance.screenings WHERE id=v_screening_id;
  DELETE FROM core.outbox WHERE id=v_outbox_id;
  DELETE FROM crm.account_extensions WHERE party_id=v_account_id;
  DELETE FROM public.accounts WHERE id=v_account_id;

  RAISE NOTICE '=== v_blocked_parties SMOKE PASSED (4/4) ===';
END;
$$;
