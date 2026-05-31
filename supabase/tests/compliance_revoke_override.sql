-- Phase 6 Step 45 — smoke test for compliance.revoke_override.
--
-- Asserts:
--   A1. After override_screening flips a failed screening to
--       'overridden', revoke_override flips it back to its
--       previous_status (stored in screening.metadata).
--   A2. revoke writes a compliance.audit_decisions row with
--       override_decision='revoke_override' and the right
--       previous_status/new_status pair.
--   A3. revoke writes a core.audit_log row with action=
--       'compliance.screening.override_revoked' and the right
--       diff jsonb shape.
--   A4. After revoke, is_party_blocked returns true again (the
--       restored 'failed' status with expires_at=now()+90d re-
--       activates the gate).
--   A5. Re-calling revoke on a screening NOT in 'overridden' state
--       raises P0001 SCREENING_NOT_REVOKABLE (compare-and-set).
--   A6. revoke with empty reason raises P0001 REVOKE_REASON_REQUIRED.
--
-- Residue: 2 core.audit_log rows per successful run (one from the
-- override, one from the revoke — both append-only by design). Tagged
-- with synthetic user uuids + '[smoke_test]' reason prefix for
-- trivial filtering.

DO $$
DECLARE
  v_tenant uuid; v_franchise uuid;
  v_search_name text := 'Mega Evil Corp';
  v_user_id uuid := gen_random_uuid();
  v_account_id uuid; v_lead_id uuid;
  v_outbox_id uuid; v_screening_id uuid;
  v_screening_status text;
  v_audit_id uuid; v_revoke_audit_id uuid;
  v_revoke_old text; v_revoke_new text;
  v_audit_decisions_count integer;
  v_audit_log_count integer;
  v_blocked boolean;
  v_caught_state text; v_caught_msg text;
BEGIN
  SELECT t.id, f.id INTO v_tenant, v_franchise
  FROM public.tenants t JOIN public.franchises f ON f.tenant_id=t.id
  ORDER BY t.created_at, f.created_at LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'PRECONDITION'; END IF;

  -- Setup: full gating saga → failed screening → override → overridden
  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-REVOKE-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;
  INSERT INTO public.leads (tenant_id, franchise_id, first_name, last_name, company, company_name, contact_name)
  VALUES (v_tenant, v_franchise, 'Smoke', 'Revoke', v_search_name, v_search_name, 'Smoke Revoke Contact')
  RETURNING id INTO v_lead_id;
  SELECT id INTO v_outbox_id FROM core.outbox
  WHERE event_type='sales.lead.created' AND entity_id=v_lead_id ORDER BY occurred_at DESC LIMIT 1;
  SELECT s.screening_id INTO v_screening_id
  FROM compliance.screen_subject(v_tenant, 'sales.lead', v_lead_id, NULL,
                                  'sales.lead.created', v_outbox_id, v_search_name, NULL) s;
  UPDATE public.leads SET converted_account_id=v_account_id, converted_at=now() WHERE id=v_lead_id;
  SELECT r.audit_decision_id INTO v_audit_id
  FROM compliance.override_screening(v_screening_id, v_user_id, '[smoke_test] Initial override.', NULL) r;

  -- ─────────────────────────────────────────────────────────────────
  -- A1: revoke flips overridden → previous_status (failed)
  -- ─────────────────────────────────────────────────────────────────
  SELECT r.old_status, r.new_status, r.audit_decision_id
  INTO v_revoke_old, v_revoke_new, v_revoke_audit_id
  FROM compliance.revoke_override(v_screening_id, v_user_id, '[smoke_test] Override was a mistake.') r;
  IF v_revoke_old <> 'overridden' OR v_revoke_new <> 'failed' THEN
    RAISE EXCEPTION 'A1 FAILED: old=% new=%', v_revoke_old, v_revoke_new;
  END IF;
  SELECT s.status INTO v_screening_status FROM compliance.screenings s WHERE s.id = v_screening_id;
  IF v_screening_status <> 'failed' THEN
    RAISE EXCEPTION 'A1 FAILED: screening.status=% post-revoke', v_screening_status;
  END IF;
  RAISE NOTICE 'A1 OK — revoke flipped overridden → failed';

  -- ─────────────────────────────────────────────────────────────────
  -- A2: audit_decisions row written with revoke_override decision
  -- ─────────────────────────────────────────────────────────────────
  SELECT count(*)::integer INTO v_audit_decisions_count
  FROM compliance.audit_decisions
  WHERE id = v_revoke_audit_id
    AND override_decision = 'revoke_override'
    AND previous_status = 'overridden'
    AND new_status = 'failed';
  IF v_audit_decisions_count <> 1 THEN
    RAISE EXCEPTION 'A2 FAILED: audit_decisions row count=%', v_audit_decisions_count;
  END IF;
  RAISE NOTICE 'A2 OK — audit_decisions row written (revoke_override)';

  -- ─────────────────────────────────────────────────────────────────
  -- A3: core.audit_log row written with override_revoked action
  -- ─────────────────────────────────────────────────────────────────
  SELECT count(*)::integer INTO v_audit_log_count
  FROM core.audit_log
  WHERE subject_type='compliance.screening' AND subject_id=v_screening_id
    AND action='compliance.screening.override_revoked'
    AND actor_user_id=v_user_id;
  IF v_audit_log_count <> 1 THEN
    RAISE EXCEPTION 'A3 FAILED: audit_log row count=%', v_audit_log_count;
  END IF;
  RAISE NOTICE 'A3 OK — core.audit_log row written';

  -- ─────────────────────────────────────────────────────────────────
  -- A4: is_party_blocked re-blocks (status=failed with fresh expires_at)
  -- ─────────────────────────────────────────────────────────────────
  v_blocked := compliance.is_party_blocked(v_tenant, v_account_id);
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'A4 FAILED: gate not blocking post-revoke';
  END IF;
  RAISE NOTICE 'A4 OK — gate re-blocks after revoke';

  -- ─────────────────────────────────────────────────────────────────
  -- A5: revoke on non-overridden screening raises NOT_REVOKABLE
  -- ─────────────────────────────────────────────────────────────────
  BEGIN
    PERFORM compliance.revoke_override(v_screening_id, v_user_id, 'second attempt');
    RAISE EXCEPTION 'A5 FAILED: second revoke succeeded';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_caught_state = RETURNED_SQLSTATE, v_caught_msg = MESSAGE_TEXT;
    IF v_caught_state <> 'P0001' OR v_caught_msg NOT LIKE 'SCREENING_NOT_REVOKABLE%' THEN
      RAISE EXCEPTION 'A5 FAILED: state=% msg=%', v_caught_state, v_caught_msg;
    END IF;
    RAISE NOTICE 'A5 OK — %', v_caught_msg;
  END;

  -- ─────────────────────────────────────────────────────────────────
  -- A6: empty reason raises REVOKE_REASON_REQUIRED
  -- ─────────────────────────────────────────────────────────────────
  BEGIN
    PERFORM compliance.revoke_override(gen_random_uuid(), v_user_id, '   ');
    RAISE EXCEPTION 'A6 FAILED: empty reason accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_caught_state = RETURNED_SQLSTATE, v_caught_msg = MESSAGE_TEXT;
    IF v_caught_state <> 'P0001' OR v_caught_msg NOT LIKE 'REVOKE_REASON_REQUIRED%' THEN
      RAISE EXCEPTION 'A6 FAILED: state=% msg=%', v_caught_state, v_caught_msg;
    END IF;
    RAISE NOTICE 'A6 OK — %', v_caught_msg;
  END;

  -- Cleanup. core.audit_log is append-only — 2 rows retained.
  DELETE FROM comms.deliveries WHERE notification_id IN (
    SELECT id FROM core.notifications WHERE subject_type='compliance.screening' AND subject_id=v_screening_id
  );
  DELETE FROM core.notifications WHERE subject_type='compliance.screening' AND subject_id=v_screening_id;
  DELETE FROM compliance.audit_decisions WHERE screening_id=v_screening_id;
  DELETE FROM public.leads WHERE id=v_lead_id;
  DELETE FROM public.accounts WHERE id=v_account_id;
  DELETE FROM compliance.screenings WHERE id=v_screening_id;
  DELETE FROM core.outbox WHERE id=v_outbox_id;

  RAISE NOTICE '=== COMPLIANCE REVOKE_OVERRIDE SMOKE TEST PASSED (6/6) ===';
END;
$$;
