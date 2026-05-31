-- Phase 6 Step 33-34 — end-to-end smoke test for the compliance
-- override flow. Run against any environment where Steps 19-34 are
-- applied. Self-cleaning DO block — failure aborts + rolls back.
--
-- Residue note: core.audit_log is append-only (DELETEs blocked by
-- a trigger — by design, audit chains are immutable). One audit_log
-- row per successful run is intentionally retained; it's tagged
-- with a fresh gen_random_uuid() actor_user_id (no real user has
-- that uuid) and a reason prefixed '[smoke_test]', so they're
-- trivially filterable for later inspection. Everything else
-- (screening, audit_decisions, lead, account, quote, version,
-- outbox) is cleaned up.
--
-- Asserts:
--   A1. After compliance.screen_subject produces a 'failed' screening
--       for a denylisted name, is_party_blocked returns true.
--   A2. override_screening writes both compliance.audit_decisions AND
--       core.audit_log rows in the same txn, and flips screening
--       status='overridden' decision='override_pass'.
--   A3. After override, is_party_blocked returns false for the same
--       party (the gate unblocks).
--   A4. A new quote.sent transition for that customer succeeds — the
--       BEFORE-UPDATE gate (Step 23) lets the update through.
--   A5. Re-calling override on an already-overridden screening raises
--       P0001 SCREENING_NOT_OVERRIDABLE (compare-and-set semantics).
--   A6. Calling override with an empty reason raises P0001
--       OVERRIDE_REASON_REQUIRED (audit-fraud guard).

DO $$
DECLARE
  v_tenant uuid; v_franchise uuid;
  v_search_name text := 'Mega Evil Corp';
  v_user_id uuid := gen_random_uuid();         -- synthetic officer
  v_account_id uuid; v_lead_id uuid;
  v_quote_id uuid; v_version_id uuid;
  v_outbox_id uuid; v_screening_id uuid;
  v_screening_status text;
  v_blocked boolean;
  v_audit_id uuid; v_audit_log_count integer;
  v_audit_decisions_count integer;
  v_caught_state text; v_caught_msg text;
BEGIN
  -- Pre-flight
  IF NOT EXISTS (SELECT 1 FROM compliance.restricted_party_lists WHERE entity_name = v_search_name) THEN
    RAISE EXCEPTION 'PRECONDITION: missing OFAC seed % — run the gating-saga setup first', v_search_name;
  END IF;
  SELECT t.id, f.id INTO v_tenant, v_franchise
  FROM public.tenants t JOIN public.franchises f ON f.tenant_id = t.id
  ORDER BY t.created_at, f.created_at LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'PRECONDITION: no tenant+franchise'; END IF;
  RAISE NOTICE 'using tenant=% franchise=% user=%', v_tenant, v_franchise, v_user_id;

  -- Setup: account + lead → outbox row → screening (failed)
  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-OVR-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;

  INSERT INTO public.leads (tenant_id, franchise_id, first_name, last_name, company, company_name, contact_name)
  VALUES (v_tenant, v_franchise, 'Smoke', 'Override', v_search_name, v_search_name, 'Smoke Override Contact')
  RETURNING id INTO v_lead_id;

  SELECT id INTO v_outbox_id FROM core.outbox
  WHERE event_type='sales.lead.created' AND entity_id=v_lead_id ORDER BY occurred_at DESC LIMIT 1;
  IF v_outbox_id IS NULL THEN RAISE EXCEPTION 'setup: lead emitter did not write outbox row'; END IF;

  SELECT s.screening_id, s.status INTO v_screening_id, v_screening_status
  FROM compliance.screen_subject(v_tenant, 'sales.lead', v_lead_id, NULL,
                                  'sales.lead.created', v_outbox_id, v_search_name, NULL) s;
  IF v_screening_status <> 'failed' THEN
    RAISE EXCEPTION 'setup: expected status=failed; got % (id=%)', v_screening_status, v_screening_id;
  END IF;
  UPDATE public.leads SET converted_account_id = v_account_id, converted_at = now() WHERE id = v_lead_id;

  -- ─────────────────────────────────────────────────────────────────
  -- A1: pre-override gate blocks
  -- ─────────────────────────────────────────────────────────────────
  v_blocked := compliance.is_party_blocked(v_tenant, v_account_id);
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'A1 FAILED: is_party_blocked returned false pre-override; expected true';
  END IF;
  RAISE NOTICE 'A1 OK — pre-override gate blocks (screening=% status=failed)', v_screening_id;

  -- ─────────────────────────────────────────────────────────────────
  -- A2: override writes audit_decisions + core.audit_log + flips status
  -- ─────────────────────────────────────────────────────────────────
  SELECT r.audit_decision_id INTO v_audit_id
  FROM compliance.override_screening(
    v_screening_id, v_user_id,
    '[smoke_test] Reviewed counsel email confirming false-positive match.',
    NULL
  ) r;
  IF v_audit_id IS NULL THEN RAISE EXCEPTION 'A2 FAILED: override returned null audit_decision_id'; END IF;

  SELECT count(*)::integer INTO v_audit_decisions_count
  FROM compliance.audit_decisions WHERE id = v_audit_id;
  IF v_audit_decisions_count <> 1 THEN
    RAISE EXCEPTION 'A2 FAILED: expected 1 audit_decisions row id=%; got %', v_audit_id, v_audit_decisions_count;
  END IF;

  SELECT count(*)::integer INTO v_audit_log_count
  FROM core.audit_log
  WHERE subject_type='compliance.screening' AND subject_id=v_screening_id
    AND action='compliance.screening.overridden' AND actor_user_id=v_user_id;
  IF v_audit_log_count <> 1 THEN
    RAISE EXCEPTION 'A2 FAILED: expected 1 core.audit_log row; got %', v_audit_log_count;
  END IF;

  SELECT s.status INTO v_screening_status FROM compliance.screenings s WHERE s.id = v_screening_id;
  IF v_screening_status <> 'overridden' THEN
    RAISE EXCEPTION 'A2 FAILED: screening status=% post-override; expected overridden', v_screening_status;
  END IF;
  RAISE NOTICE 'A2 OK — audit_decisions + core.audit_log + status=overridden all consistent';

  -- ─────────────────────────────────────────────────────────────────
  -- A3: post-override gate unblocks
  -- ─────────────────────────────────────────────────────────────────
  v_blocked := compliance.is_party_blocked(v_tenant, v_account_id);
  IF v_blocked THEN
    RAISE EXCEPTION 'A3 FAILED: is_party_blocked returned true post-override; expected false';
  END IF;
  RAISE NOTICE 'A3 OK — post-override gate unblocks';

  -- ─────────────────────────────────────────────────────────────────
  -- A4: quote.sent transition now succeeds
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO public.quotes (tenant_id, franchise_id, account_id, quote_number, title, status)
  VALUES (v_tenant, v_franchise, v_account_id,
          'SMOKE-OVR-' || substr(gen_random_uuid()::text,1,8), 'Smoke override quote', 'draft')
  RETURNING id INTO v_quote_id;
  INSERT INTO public.quotation_versions (tenant_id, quote_id, major, minor, version_number, status)
  VALUES (v_tenant, v_quote_id, 1, 0, 1, 'draft')
  RETURNING id INTO v_version_id;

  UPDATE public.quotation_versions SET status='sent' WHERE id=v_version_id;
  -- If the gate were still active we'd have raised P0001 by now.
  SELECT status INTO v_screening_status FROM public.quotation_versions WHERE id=v_version_id;
  IF v_screening_status <> 'sent' THEN
    RAISE EXCEPTION 'A4 FAILED: quote.sent transition silently dropped — status=%', v_screening_status;
  END IF;
  RAISE NOTICE 'A4 OK — quote.sent transition succeeded for previously-blocked customer';

  -- ─────────────────────────────────────────────────────────────────
  -- A5: re-call override on overridden screening raises NOT_OVERRIDABLE
  -- ─────────────────────────────────────────────────────────────────
  BEGIN
    PERFORM compliance.override_screening(v_screening_id, v_user_id, 'second attempt', NULL);
    RAISE EXCEPTION 'A5 FAILED: second override on same screening succeeded; expected SCREENING_NOT_OVERRIDABLE';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_caught_state = RETURNED_SQLSTATE, v_caught_msg = MESSAGE_TEXT;
    IF v_caught_state <> 'P0001' OR v_caught_msg NOT LIKE 'SCREENING_NOT_OVERRIDABLE%' THEN
      RAISE EXCEPTION 'A5 FAILED: state=% msg=%', v_caught_state, v_caught_msg;
    END IF;
    RAISE NOTICE 'A5 OK — second override raised: %', v_caught_msg;
  END;

  -- ─────────────────────────────────────────────────────────────────
  -- A6: empty reason raises OVERRIDE_REASON_REQUIRED
  -- ─────────────────────────────────────────────────────────────────
  BEGIN
    PERFORM compliance.override_screening(gen_random_uuid(), v_user_id, '   ', NULL);
    RAISE EXCEPTION 'A6 FAILED: empty reason accepted; expected OVERRIDE_REASON_REQUIRED';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_caught_state = RETURNED_SQLSTATE, v_caught_msg = MESSAGE_TEXT;
    IF v_caught_state <> 'P0001' OR v_caught_msg NOT LIKE 'OVERRIDE_REASON_REQUIRED%' THEN
      RAISE EXCEPTION 'A6 FAILED: state=% msg=%', v_caught_state, v_caught_msg;
    END IF;
    RAISE NOTICE 'A6 OK — empty reason raised: %', v_caught_msg;
  END;

  -- Cleanup. audit_decisions has FK → screenings ON DELETE RESTRICT,
  -- so delete it before the screening row. core.audit_log is
  -- append-only by design (DELETE blocked by a trigger) — the one row
  -- written by A2 is intentionally retained per the test header note.
  DELETE FROM comms.deliveries WHERE notification_id IN (
    SELECT id FROM core.notifications WHERE subject_type='compliance.screening' AND subject_id=v_screening_id
  );
  DELETE FROM core.notifications WHERE subject_type='compliance.screening' AND subject_id=v_screening_id;
  DELETE FROM compliance.audit_decisions WHERE screening_id=v_screening_id;
  DELETE FROM public.quotation_versions WHERE id=v_version_id;
  DELETE FROM public.quotes WHERE id=v_quote_id;
  DELETE FROM public.leads WHERE id=v_lead_id;
  DELETE FROM public.accounts WHERE id=v_account_id;
  DELETE FROM compliance.screenings WHERE id=v_screening_id;
  DELETE FROM core.outbox WHERE id=v_outbox_id;

  RAISE NOTICE '=== COMPLIANCE OVERRIDE SMOKE TEST PASSED (6/6) ===';
END;
$$;
