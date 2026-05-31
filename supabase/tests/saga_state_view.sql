-- Phase 6 Step 46 — smoke test for core.v_saga_state.
--
-- Builds the full Phase 6 chain end-to-end for a single party
-- (lead → screening → override → revoke + do_not_contact set/cleared)
-- and asserts every event_kind surfaces correctly in the view.
--
-- Asserts:
--   A1. ≥1 'screening' row (the lead-keyed screening, surfaced via
--       leads.converted_account_id since subject_party_id was NULL
--       at screening creation time — exercises the indirect lookup).
--   A2. ≥2 'audit_decision' rows (override + revoke).
--   A3. ≥2 'suppression' rows (email + phone bumped by upsert RPC).
--   A4. ≥2 'outbox' rows (crm.do_not_contact.set + .cleared — these
--       are the only outbox event_types the view surfaces; the lead.
--       created outbox row doesn't carry party_id in payload, so it
--       intentionally doesn't appear).
--
-- Residue: 2 append-only core.audit_log rows per run (the override
-- and revoke), tagged with synthetic user uuid + '[smoke_test] Saga'
-- reason prefix for trivial filtering.

DO $$
DECLARE
  v_tenant uuid; v_franchise uuid;
  v_search_name text := 'Mega Evil Corp';
  v_user_id uuid := gen_random_uuid();
  v_account_id uuid; v_lead_id uuid;
  v_email_id uuid; v_phone_id uuid;
  v_email_addr text := 'smoke-saga-' || substr(gen_random_uuid()::text,1,8) || '@example.invalid';
  v_phone_e164 text := '+1555' || substr(replace(gen_random_uuid()::text,'-',''),1,7);
  v_lead_outbox_id uuid; v_set_outbox_id uuid; v_clr_outbox_id uuid;
  v_screening_id uuid; v_audit_id uuid; v_revoke_audit_id uuid;
  v_screening_count integer; v_audit_count integer;
  v_suppression_count integer; v_outbox_count integer;
BEGIN
  SELECT t.id, f.id INTO v_tenant, v_franchise
  FROM public.tenants t JOIN public.franchises f ON f.tenant_id=t.id
  ORDER BY t.created_at, f.created_at LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'PRECONDITION: no tenant+franchise'; END IF;

  -- Setup: account + linked addresses (so do_not_contact has something to suppress)
  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-SAGA-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;
  -- accounts.id == core.parties.id (Phase 2 backfill) — but if the
  -- party row doesn't auto-materialize, ensure it's present.
  INSERT INTO core.parties (id, tenant_id, party_type, display_name)
  VALUES (v_account_id, v_tenant, 'organization', 'SMOKE-SAGA-PARTY')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO core.email_addresses (tenant_id, email) VALUES (v_tenant, v_email_addr) RETURNING id INTO v_email_id;
  INSERT INTO core.email_links (tenant_id, email_id, subject_type, subject_id, role, is_primary)
  VALUES (v_tenant, v_email_id, 'core.party', v_account_id, 'work', true);
  INSERT INTO core.phone_numbers (tenant_id, e164) VALUES (v_tenant, v_phone_e164) RETURNING id INTO v_phone_id;
  INSERT INTO core.phone_links (tenant_id, phone_id, subject_type, subject_id, role, is_primary)
  VALUES (v_tenant, v_phone_id, 'core.party', v_account_id, 'work', true);

  -- Saga producer: lead with denylisted name → failed screening
  INSERT INTO public.leads (tenant_id, franchise_id, first_name, last_name, company, company_name, contact_name)
  VALUES (v_tenant, v_franchise, 'Smoke', 'Saga', v_search_name, v_search_name, 'Smoke Saga Contact')
  RETURNING id INTO v_lead_id;
  SELECT id INTO v_lead_outbox_id FROM core.outbox
  WHERE event_type='sales.lead.created' AND entity_id=v_lead_id ORDER BY occurred_at DESC LIMIT 1;
  SELECT s.screening_id INTO v_screening_id
  FROM compliance.screen_subject(v_tenant, 'sales.lead', v_lead_id, NULL,
                                  'sales.lead.created', v_lead_outbox_id, v_search_name, NULL) s;
  -- Convert lead → account so the indirect party_id resolution
  -- (leads.converted_account_id) surfaces the screening in the view.
  UPDATE public.leads SET converted_account_id=v_account_id, converted_at=now() WHERE id=v_lead_id;

  -- Override + revoke → 2 audit_decisions rows for the same screening
  SELECT r.audit_decision_id INTO v_audit_id
  FROM compliance.override_screening(v_screening_id, v_user_id, '[smoke_test] Saga override', NULL) r;
  SELECT r.audit_decision_id INTO v_revoke_audit_id
  FROM compliance.revoke_override(v_screening_id, v_user_id, '[smoke_test] Saga revoke') r;

  -- do_not_contact set → outbox + suppressions (account_extensions
  -- row auto-created by the dual-write trigger on accounts INSERT,
  -- so we UPDATE not INSERT here).
  UPDATE crm.account_extensions
  SET do_not_contact=true, do_not_contact_at=now()
  WHERE party_id=v_account_id;
  SELECT id INTO v_set_outbox_id FROM core.outbox
  WHERE event_type='crm.do_not_contact.set' AND entity_id=v_account_id ORDER BY occurred_at DESC LIMIT 1;
  PERFORM comms.upsert_do_not_contact_suppressions(v_tenant, v_account_id, 'account', v_set_outbox_id);

  -- do_not_contact cleared → outbox
  UPDATE crm.account_extensions SET do_not_contact=false, do_not_contact_at=now() WHERE party_id=v_account_id;
  SELECT id INTO v_clr_outbox_id FROM core.outbox
  WHERE event_type='crm.do_not_contact.cleared' AND entity_id=v_account_id ORDER BY occurred_at DESC LIMIT 1;

  -- Query the view per party
  SELECT count(*) FILTER (WHERE event_kind='screening')      INTO v_screening_count   FROM core.v_saga_state WHERE party_id=v_account_id;
  SELECT count(*) FILTER (WHERE event_kind='audit_decision') INTO v_audit_count       FROM core.v_saga_state WHERE party_id=v_account_id;
  SELECT count(*) FILTER (WHERE event_kind='suppression')    INTO v_suppression_count FROM core.v_saga_state WHERE party_id=v_account_id;
  SELECT count(*) FILTER (WHERE event_kind='outbox')         INTO v_outbox_count      FROM core.v_saga_state WHERE party_id=v_account_id;

  RAISE NOTICE 'saga state: screenings=% audit=% suppressions=% outbox=%',
    v_screening_count, v_audit_count, v_suppression_count, v_outbox_count;

  IF v_screening_count < 1   THEN RAISE EXCEPTION 'A1: %', v_screening_count; END IF;
  IF v_audit_count < 2       THEN RAISE EXCEPTION 'A2: %', v_audit_count; END IF;
  IF v_suppression_count < 2 THEN RAISE EXCEPTION 'A3: %', v_suppression_count; END IF;
  IF v_outbox_count < 2      THEN RAISE EXCEPTION 'A4: %', v_outbox_count; END IF;
  RAISE NOTICE 'A1-A4 OK — all 4 event kinds present';

  -- Cleanup (audit_log rows append-only — 2 retained per run)
  DELETE FROM comms.suppressions WHERE tenant_id=v_tenant AND (source_metadata->>'party_id')=v_account_id::text;
  DELETE FROM compliance.audit_decisions WHERE screening_id=v_screening_id;
  DELETE FROM public.leads WHERE id=v_lead_id;
  DELETE FROM compliance.screenings WHERE id=v_screening_id;
  DELETE FROM core.outbox WHERE id IN (v_lead_outbox_id, v_set_outbox_id, v_clr_outbox_id);
  DELETE FROM core.email_links WHERE email_id=v_email_id;
  DELETE FROM core.phone_links WHERE phone_id=v_phone_id;
  DELETE FROM core.email_addresses WHERE id=v_email_id;
  DELETE FROM core.phone_numbers WHERE id=v_phone_id;
  DELETE FROM crm.account_extensions WHERE party_id=v_account_id;
  DELETE FROM public.accounts WHERE id=v_account_id;
  DELETE FROM core.parties WHERE id=v_account_id;

  RAISE NOTICE '=== SAGA STATE VIEW SMOKE PASSED (4/4) ===';
END;
$$;
