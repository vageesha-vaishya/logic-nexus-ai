-- Phase 6 Step 50 — smoke test for compliance.v_screening_decisions.
--
-- Exercises a 3-decision history (override → revoke → override) and
-- verifies the view surfaces them in chronological order with the
-- correct current screening status on every row.
--
-- Asserts:
--   A1. 3 rows in v_screening_decisions for the test screening.
--   A2. override_decision values appear in correct chronological
--       order: ['override_pass', 'revoke_override', 'override_pass'].
--   A3. screening_current_status = 'overridden' on every row (the
--       3rd decision was an override, so the screening's current
--       state is overridden regardless of which historical row
--       you're reading).
--
-- Residue: 3 append-only core.audit_log rows.

DO $$
DECLARE
  v_tenant uuid; v_franchise uuid;
  v_search_name text := 'Mega Evil Corp';
  v_user_id uuid := gen_random_uuid();
  v_account_id uuid; v_lead_id uuid;
  v_outbox_id uuid; v_screening_id uuid;
  v_decisions_count integer;
  v_decisions_in_order text[];
  v_current_status text;
BEGIN
  SELECT t.id, f.id INTO v_tenant, v_franchise
  FROM public.tenants t JOIN public.franchises f ON f.tenant_id=t.id
  ORDER BY t.created_at, f.created_at LIMIT 1;

  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-DRILL-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;
  INSERT INTO public.leads (tenant_id, franchise_id, first_name, last_name, company, company_name, contact_name)
  VALUES (v_tenant, v_franchise, 'Smoke', 'Drilldown', v_search_name, v_search_name, 'Smoke Drilldown')
  RETURNING id INTO v_lead_id;
  SELECT id INTO v_outbox_id FROM core.outbox
  WHERE event_type='sales.lead.created' AND entity_id=v_lead_id ORDER BY occurred_at DESC LIMIT 1;
  SELECT s.screening_id INTO v_screening_id
  FROM compliance.screen_subject(v_tenant, 'sales.lead', v_lead_id, NULL,
                                  'sales.lead.created', v_outbox_id, v_search_name, NULL) s;
  UPDATE public.leads SET converted_account_id=v_account_id, converted_at=now() WHERE id=v_lead_id;

  PERFORM compliance.override_screening(v_screening_id, v_user_id, '[smoke_test] drill override 1', NULL);
  PERFORM compliance.revoke_override   (v_screening_id, v_user_id, '[smoke_test] drill revoke 1');
  PERFORM compliance.override_screening(v_screening_id, v_user_id, '[smoke_test] drill override 2', NULL);

  SELECT count(*)::integer INTO v_decisions_count
  FROM compliance.v_screening_decisions WHERE screening_id=v_screening_id;
  IF v_decisions_count <> 3 THEN RAISE EXCEPTION 'A1: %', v_decisions_count; END IF;
  RAISE NOTICE 'A1 OK — 3 decisions surfaced';

  SELECT array_agg(override_decision ORDER BY decided_at ASC) INTO v_decisions_in_order
  FROM compliance.v_screening_decisions WHERE screening_id=v_screening_id;
  IF v_decisions_in_order <> ARRAY['override_pass','revoke_override','override_pass']::text[] THEN
    RAISE EXCEPTION 'A2: ordering=%', v_decisions_in_order;
  END IF;
  RAISE NOTICE 'A2 OK — chronological order correct';

  SELECT DISTINCT screening_current_status INTO v_current_status
  FROM compliance.v_screening_decisions WHERE screening_id=v_screening_id;
  IF v_current_status <> 'overridden' THEN
    RAISE EXCEPTION 'A3: current_status=%', v_current_status;
  END IF;
  RAISE NOTICE 'A3 OK — current_status=overridden';

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

  RAISE NOTICE '=== v_screening_decisions SMOKE PASSED (3/3) ===';
END;
$$;
