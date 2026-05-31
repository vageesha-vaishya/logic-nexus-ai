-- Phase 6 Step 19-23 — end-to-end smoke test for the compliance
-- gating saga. Run against any environment where Steps 19-24 are
-- applied; expects no consumer service running (the test calls
-- compliance.screen_subject directly to simulate consumer pickup).
--
-- Asserts the four pieces in sequence:
--   1. emit_lead_created trigger writes a core.outbox row on lead INSERT
--   2. compliance.screen_subject returns status='failed' for a name that
--      matches compliance.restricted_party_lists with similarity ≥ 0.85
--      ("Mega Evil Corp" — synthetic OFAC SDN seed entry)
--   3. compliance.is_party_blocked returns TRUE for the account once the
--      lead is marked converted, exercising the indirect (via-lead)
--      lookup branch in the helper
--   4. enforce_quote_sent_compliance_gate raises SQLSTATE P0001 with
--      'COMPLIANCE_BLOCKED' when quotation_versions.status transitions
--      to 'sent' for that account
--
-- Self-cleaning: every row the test creates is DELETEd at the end. If
-- any assertion fires RAISE EXCEPTION mid-block, the whole DO aborts
-- and the implicit transaction rolls back automatically — no residue
-- on prod either way.
--
-- Tenant/franchise are looked up dynamically so the test works against
-- any environment with at least one tenant + franchise. Will FAIL FAST
-- with a clear message if either is missing OR if the OFAC seed entry
-- 'Mega Evil Corp' has been removed from compliance.restricted_party_lists.
--
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/compliance_gating_saga.sql
-- Or:   paste into MCP execute_sql against the target project.

DO $$
DECLARE
  v_tenant       uuid;
  v_franchise    uuid;
  v_search_name  text := 'Mega Evil Corp';
  v_account_id   uuid;
  v_lead_id      uuid;
  v_quote_id     uuid;
  v_version_id   uuid;
  v_outbox_id    uuid;
  v_screening_id uuid;
  v_screening_status text;
  v_screening_hit_count integer;
  v_blocked      boolean;
  v_caught_state text;
  v_caught_msg   text;
  v_seed_present boolean;
BEGIN
  -- ──────────────────────────────────────────────────────────────────
  -- Pre-flight: seed entry must exist, otherwise the screen_subject
  -- call will return passed and the test loses its denylist match.
  -- ──────────────────────────────────────────────────────────────────
  SELECT EXISTS(
    SELECT 1 FROM compliance.restricted_party_lists
    WHERE entity_name = v_search_name
  ) INTO v_seed_present;
  IF NOT v_seed_present THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: compliance.restricted_party_lists has no entry for "%s" — restore the seed before running this smoke test.', v_search_name;
  END IF;

  -- Pick the first tenant + one of its franchises. Any will do — the
  -- screening/gate logic is tenant-scoped and the test cleans up.
  SELECT t.id, f.id
  INTO v_tenant, v_franchise
  FROM public.tenants t
  JOIN public.franchises f ON f.tenant_id = t.id
  ORDER BY t.created_at, f.created_at
  LIMIT 1;
  IF v_tenant IS NULL OR v_franchise IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: need at least one tenant with one franchise to run the smoke test';
  END IF;
  RAISE NOTICE 'using tenant=% franchise=%', v_tenant, v_franchise;

  -- ──────────────────────────────────────────────────────────────────
  -- Setup: account + lead (lead INSERT fires emit_lead_created)
  -- ──────────────────────────────────────────────────────────────────
  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-TEST-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;

  INSERT INTO public.leads (
    tenant_id, franchise_id, first_name, last_name,
    company, company_name, contact_name
  )
  VALUES (
    v_tenant, v_franchise, 'Smoke', 'Test',
    v_search_name,            -- emit_lead_created reads NEW.company
    v_search_name,            -- company_name is NOT NULL
    'Smoke Test Contact'      -- contact_name is NOT NULL
  )
  RETURNING id INTO v_lead_id;

  -- ──────────────────────────────────────────────────────────────────
  -- Assertion 1: emit_lead_created wrote an outbox row
  -- ──────────────────────────────────────────────────────────────────
  SELECT id INTO v_outbox_id
  FROM core.outbox
  WHERE event_type = 'sales.lead.created' AND entity_id = v_lead_id
  ORDER BY occurred_at DESC
  LIMIT 1;
  IF v_outbox_id IS NULL THEN
    RAISE EXCEPTION 'ASSERTION 1 FAILED: emit_lead_created did not write a core.outbox row for lead %', v_lead_id;
  END IF;
  RAISE NOTICE 'Assertion 1 OK — outbox row % emitted for lead %', v_outbox_id, v_lead_id;

  -- ──────────────────────────────────────────────────────────────────
  -- Simulate consumer: call screen_subject directly with the outbox
  -- event's data. In prod the gating-consumer in services/compliance-
  -- api does this asynchronously on a 5s poll loop.
  -- ──────────────────────────────────────────────────────────────────
  SELECT s.screening_id, s.status, s.hit_count
  INTO v_screening_id, v_screening_status, v_screening_hit_count
  FROM compliance.screen_subject(
    v_tenant,
    'sales.lead',
    v_lead_id,
    NULL,                            -- subject_party_id: lead isn't a party yet
    'sales.lead.created',
    v_outbox_id,
    v_search_name,
    NULL                             -- country_code
  ) s;

  -- ──────────────────────────────────────────────────────────────────
  -- Assertion 2: screen_subject decided "failed" with ≥1 hit
  -- ──────────────────────────────────────────────────────────────────
  IF v_screening_status <> 'failed' OR v_screening_hit_count < 1 THEN
    RAISE EXCEPTION 'ASSERTION 2 FAILED: expected status=failed with ≥1 hit; got status=%, hit_count=% (screening_id=%)',
      v_screening_status, v_screening_hit_count, v_screening_id;
  END IF;
  RAISE NOTICE 'Assertion 2 OK — screening % status=failed, hits=%', v_screening_id, v_screening_hit_count;

  -- ──────────────────────────────────────────────────────────────────
  -- Mark lead converted to the test account so is_party_blocked's
  -- indirect-via-lead branch resolves.
  -- ──────────────────────────────────────────────────────────────────
  UPDATE public.leads
  SET converted_account_id = v_account_id,
      converted_at = now()
  WHERE id = v_lead_id;

  -- ──────────────────────────────────────────────────────────────────
  -- Assertion 3: is_party_blocked returns true via the indirect path
  -- ──────────────────────────────────────────────────────────────────
  v_blocked := compliance.is_party_blocked(v_tenant, v_account_id);
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'ASSERTION 3 FAILED: is_party_blocked(%, %) returned false; expected true via converted-lead path', v_tenant, v_account_id;
  END IF;
  RAISE NOTICE 'Assertion 3 OK — is_party_blocked returns true for account %', v_account_id;

  -- ──────────────────────────────────────────────────────────────────
  -- Setup: draft quote + draft version for the blocked account
  -- ──────────────────────────────────────────────────────────────────
  INSERT INTO public.quotes (tenant_id, franchise_id, account_id, quote_number, title, status)
  VALUES (v_tenant, v_franchise, v_account_id,
          'SMOKE-' || substr(gen_random_uuid()::text, 1, 8),
          'Compliance smoke test quote', 'draft')
  RETURNING id INTO v_quote_id;

  INSERT INTO public.quotation_versions (tenant_id, quote_id, major, minor, version_number, status)
  VALUES (v_tenant, v_quote_id, 1, 0, 1, 'draft')
  RETURNING id INTO v_version_id;

  -- ──────────────────────────────────────────────────────────────────
  -- Assertion 4: gate blocks the quote.sent transition with P0001
  -- ──────────────────────────────────────────────────────────────────
  BEGIN
    UPDATE public.quotation_versions
    SET status = 'sent'
    WHERE id = v_version_id;
    -- If we reach here the gate did NOT fire.
    RAISE EXCEPTION 'ASSERTION 4 FAILED: quote.sent transition succeeded; expected COMPLIANCE_BLOCKED';
  EXCEPTION
    WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS
        v_caught_state = RETURNED_SQLSTATE,
        v_caught_msg   = MESSAGE_TEXT;
      IF v_caught_state <> 'P0001' OR v_caught_msg NOT LIKE 'COMPLIANCE_BLOCKED%' THEN
        RAISE EXCEPTION 'ASSERTION 4 FAILED: expected SQLSTATE P0001 with COMPLIANCE_BLOCKED prefix; got state=% msg=%', v_caught_state, v_caught_msg;
      END IF;
      RAISE NOTICE 'Assertion 4 OK — gate raised: %', v_caught_msg;
  END;

  -- ──────────────────────────────────────────────────────────────────
  -- Cleanup. Order matters: notifications + outbox first (they're
  -- side-effects of the producers); then the gated entities; then the
  -- subjects; then the screening row.
  -- ──────────────────────────────────────────────────────────────────
  DELETE FROM comms.deliveries
  WHERE notification_id IN (
    SELECT id FROM core.notifications
    WHERE subject_type = 'compliance.screening' AND subject_id = v_screening_id
  );
  DELETE FROM core.notifications
  WHERE subject_type = 'compliance.screening' AND subject_id = v_screening_id;

  DELETE FROM public.quotation_versions WHERE id = v_version_id;
  DELETE FROM public.quotes WHERE id = v_quote_id;
  DELETE FROM public.leads WHERE id = v_lead_id;
  DELETE FROM public.accounts WHERE id = v_account_id;
  DELETE FROM compliance.screenings WHERE id = v_screening_id;
  DELETE FROM core.outbox WHERE id = v_outbox_id;

  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'COMPLIANCE GATING SAGA — SMOKE TEST PASSED (4/4)';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END;
$$;
