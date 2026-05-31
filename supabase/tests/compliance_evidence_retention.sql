-- Phase 6 Step 38-39 — smoke test for the compliance evidence
-- retention chain. Run against any environment where Steps 19-39
-- are applied.
--
-- Asserts:
--   A1. A core.files row created with retention_class='general_30d'
--       can be DELETEd normally (general_30d is not enforced).
--   A2. Referencing the file from compliance.audit_decisions.
--       evidence_file_ids via override_screening auto-bumps its
--       retention_class to 'compliance_7y' (Step 39 trigger).
--   A3. DELETE on a compliance_7y file uploaded just now raises
--       P0001 FILE_RETENTION_NOT_MET (Step 38 guard).
--   A4. UPDATE of an unrelated column (filename) on the same file
--       is allowed — the trigger watches DELETE + deleted_at only.
--   A5. Admin downgrade (UPDATE retention_class → 'general_30d')
--       followed by DELETE succeeds — the escape hatch works.
--
-- Residue: one core.audit_log row from the override (append-only by
-- design); everything else cleaned up.

DO $$
DECLARE
  v_tenant uuid; v_franchise uuid;
  v_search_name text := 'Mega Evil Corp';
  v_user_id uuid := gen_random_uuid();
  v_account_id uuid; v_lead_id uuid;
  v_outbox_id uuid; v_screening_id uuid; v_screening_status text;
  v_file_id uuid;
  v_other_file_id uuid;
  v_audit_id uuid;
  v_file_retention text;
  v_caught_state text; v_caught_msg text;
BEGIN
  -- Setup
  SELECT t.id, f.id INTO v_tenant, v_franchise
  FROM public.tenants t JOIN public.franchises f ON f.tenant_id=t.id
  ORDER BY t.created_at, f.created_at LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'PRECONDITION: no tenant+franchise'; END IF;

  -- ─────────────────────────────────────────────────────────────────
  -- A1: general_30d file deletes normally (not enforced)
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO core.files (tenant_id, storage_bucket, storage_path, filename, retention_class)
  VALUES (v_tenant, 'smoke', 'smoke/' || gen_random_uuid()::text, 'smoke-A1.pdf', 'general_30d')
  RETURNING id INTO v_other_file_id;
  DELETE FROM core.files WHERE id = v_other_file_id;
  IF EXISTS (SELECT 1 FROM core.files WHERE id = v_other_file_id) THEN
    RAISE EXCEPTION 'A1 FAILED: general_30d file still present after DELETE';
  END IF;
  RAISE NOTICE 'A1 OK — general_30d file deleted (no enforcement)';

  -- Setup the saga so override_screening has something real to override
  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-EVID-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;
  INSERT INTO public.leads (tenant_id, franchise_id, first_name, last_name, company, company_name, contact_name)
  VALUES (v_tenant, v_franchise, 'Smoke', 'Evidence', v_search_name, v_search_name, 'Smoke Evidence Contact')
  RETURNING id INTO v_lead_id;
  SELECT id INTO v_outbox_id FROM core.outbox
  WHERE event_type='sales.lead.created' AND entity_id=v_lead_id ORDER BY occurred_at DESC LIMIT 1;
  SELECT s.screening_id INTO v_screening_id
  FROM compliance.screen_subject(v_tenant, 'sales.lead', v_lead_id, NULL,
                                  'sales.lead.created', v_outbox_id, v_search_name, NULL) s;
  UPDATE public.leads SET converted_account_id = v_account_id, converted_at = now() WHERE id = v_lead_id;

  -- Evidence file — starts at general_30d
  INSERT INTO core.files (tenant_id, storage_bucket, storage_path, filename, retention_class)
  VALUES (v_tenant, 'smoke', 'smoke/' || gen_random_uuid()::text, 'kyc-evidence.pdf', 'general_30d')
  RETURNING id INTO v_file_id;

  -- ─────────────────────────────────────────────────────────────────
  -- A2: override referencing the file bumps retention to compliance_7y
  -- ─────────────────────────────────────────────────────────────────
  SELECT r.audit_decision_id INTO v_audit_id
  FROM compliance.override_screening(
    v_screening_id, v_user_id,
    '[smoke_test] Cleared after KYC review; evidence attached.',
    ARRAY[v_file_id]
  ) r;
  IF v_audit_id IS NULL THEN RAISE EXCEPTION 'A2: override returned null audit_decision_id'; END IF;

  SELECT retention_class INTO v_file_retention FROM core.files WHERE id = v_file_id;
  IF v_file_retention <> 'compliance_7y' THEN
    RAISE EXCEPTION 'A2 FAILED: expected retention_class=compliance_7y after override; got %', v_file_retention;
  END IF;
  RAISE NOTICE 'A2 OK — evidence file bumped to compliance_7y';

  -- ─────────────────────────────────────────────────────────────────
  -- A3: DELETE on compliance_7y file raises P0001
  -- ─────────────────────────────────────────────────────────────────
  BEGIN
    DELETE FROM core.files WHERE id = v_file_id;
    RAISE EXCEPTION 'A3 FAILED: DELETE on compliance_7y file succeeded; expected FILE_RETENTION_NOT_MET';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_caught_state = RETURNED_SQLSTATE, v_caught_msg = MESSAGE_TEXT;
    IF v_caught_state <> 'P0001' OR v_caught_msg NOT LIKE 'FILE_RETENTION_NOT_MET%' THEN
      RAISE EXCEPTION 'A3 FAILED: state=% msg=%', v_caught_state, v_caught_msg;
    END IF;
    RAISE NOTICE 'A3 OK — DELETE blocked: %', v_caught_msg;
  END;

  -- Verify the soft-delete branch fires too
  BEGIN
    UPDATE core.files SET deleted_at = now() WHERE id = v_file_id;
    RAISE EXCEPTION 'A3 FAILED: soft-delete on compliance_7y file succeeded';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_caught_state = RETURNED_SQLSTATE, v_caught_msg = MESSAGE_TEXT;
    IF v_caught_state <> 'P0001' OR v_caught_msg NOT LIKE 'FILE_RETENTION_NOT_MET%' THEN
      RAISE EXCEPTION 'A3 FAILED (soft): state=% msg=%', v_caught_state, v_caught_msg;
    END IF;
    RAISE NOTICE 'A3 OK — soft-delete also blocked: %', v_caught_msg;
  END;

  -- ─────────────────────────────────────────────────────────────────
  -- A4: UPDATE of unrelated columns is allowed
  -- ─────────────────────────────────────────────────────────────────
  UPDATE core.files SET filename = 'kyc-evidence-renamed.pdf' WHERE id = v_file_id;
  IF (SELECT filename FROM core.files WHERE id = v_file_id) <> 'kyc-evidence-renamed.pdf' THEN
    RAISE EXCEPTION 'A4 FAILED: UPDATE of filename did not stick';
  END IF;
  RAISE NOTICE 'A4 OK — UPDATE of unrelated column allowed';

  -- ─────────────────────────────────────────────────────────────────
  -- A5: admin downgrade → DELETE escape hatch works
  -- ─────────────────────────────────────────────────────────────────
  UPDATE core.files SET retention_class = 'general_30d' WHERE id = v_file_id;
  DELETE FROM core.files WHERE id = v_file_id;
  IF EXISTS (SELECT 1 FROM core.files WHERE id = v_file_id) THEN
    RAISE EXCEPTION 'A5 FAILED: file still present after downgrade+delete';
  END IF;
  RAISE NOTICE 'A5 OK — admin downgrade + DELETE succeeded';

  -- Cleanup the saga residue
  DELETE FROM comms.deliveries WHERE notification_id IN (
    SELECT id FROM core.notifications WHERE subject_type='compliance.screening' AND subject_id=v_screening_id
  );
  DELETE FROM core.notifications WHERE subject_type='compliance.screening' AND subject_id=v_screening_id;
  DELETE FROM compliance.audit_decisions WHERE screening_id=v_screening_id;
  DELETE FROM public.leads WHERE id=v_lead_id;
  DELETE FROM public.accounts WHERE id=v_account_id;
  DELETE FROM compliance.screenings WHERE id=v_screening_id;
  DELETE FROM core.outbox WHERE id=v_outbox_id;

  RAISE NOTICE '=== COMPLIANCE EVIDENCE RETENTION SMOKE TEST PASSED (5/5) ===';
END;
$$;
