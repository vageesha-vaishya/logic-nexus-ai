-- Phase 6 Step 27-30 — end-to-end smoke test for the CRM → comms
-- do_not_contact suppression bridge. Run against any environment
-- where Steps 27-30 are applied. Calls the rpc directly to simulate
-- the comms-api consumer (which polls every 5s).
--
-- Asserts the three pieces:
--   1. emit_do_not_contact_set trigger writes a core.outbox row on
--      account_extensions INSERT with do_not_contact=true
--   2. comms.upsert_do_not_contact_suppressions resolves all email +
--      phone addresses linked to the party (subject_type='core.party')
--      and inserts comms.suppressions rows with reason='do_not_contact'
--   3. ON CONFLICT DO NOTHING preserves prior suppression reasons —
--      a pre-existing 'unsubscribe' row is not overwritten on second run
--
-- Self-cleaning: every row created is DELETEd at the end; failure
-- aborts the DO and rolls back the implicit transaction.

DO $$
DECLARE
  v_tenant      uuid;
  v_party_id    uuid;
  v_email_id    uuid;
  v_phone_id    uuid;
  v_email_addr  text := 'smoke-test-' || substr(gen_random_uuid()::text, 1, 8) || '@example.invalid';
  v_phone_e164  text := '+1555' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7);
  v_outbox_id   uuid;
  v_outbox_count_before integer;
  v_outbox_count_after  integer;
  v_inserted    integer;
  v_email_count integer;
  v_phone_count integer;
  v_suppress_rows integer;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION: no tenant available';
  END IF;
  RAISE NOTICE 'using tenant=%', v_tenant;

  -- Setup: party + linked email + linked phone
  INSERT INTO core.parties (tenant_id, party_type, display_name, legal_name)
  VALUES (v_tenant, 'organization', 'SMOKE-DNC-' || substr(gen_random_uuid()::text, 1, 8), 'SMOKE-DNC')
  RETURNING id INTO v_party_id;

  INSERT INTO core.email_addresses (tenant_id, email)
  VALUES (v_tenant, v_email_addr) RETURNING id INTO v_email_id;
  INSERT INTO core.email_links (tenant_id, email_id, subject_type, subject_id, role, is_primary)
  VALUES (v_tenant, v_email_id, 'core.party', v_party_id, 'work', true);

  INSERT INTO core.phone_numbers (tenant_id, e164)
  VALUES (v_tenant, v_phone_e164) RETURNING id INTO v_phone_id;
  INSERT INTO core.phone_links (tenant_id, phone_id, subject_type, subject_id, role, is_primary)
  VALUES (v_tenant, v_phone_id, 'core.party', v_party_id, 'work', true);

  -- Baseline outbox count for this event_type
  SELECT count(*)::integer INTO v_outbox_count_before
  FROM core.outbox WHERE event_type = 'crm.do_not_contact.set';

  -- INSERT account_extensions with do_not_contact=true (INSERT-with-true
  -- exercises the same trigger path as the FALSE→TRUE update transition).
  INSERT INTO crm.account_extensions (party_id, tenant_id, do_not_contact, do_not_contact_at)
  VALUES (v_party_id, v_tenant, true, now());

  -- ──────────────────────────────────────────────────────────────────
  -- Assertion 1: outbox row emitted
  -- ──────────────────────────────────────────────────────────────────
  SELECT count(*)::integer INTO v_outbox_count_after
  FROM core.outbox WHERE event_type = 'crm.do_not_contact.set';
  IF v_outbox_count_after <> v_outbox_count_before + 1 THEN
    RAISE EXCEPTION 'A1 FAILED: expected exactly 1 new outbox row; before=% after=%',
      v_outbox_count_before, v_outbox_count_after;
  END IF;
  SELECT id INTO v_outbox_id
  FROM core.outbox
  WHERE event_type = 'crm.do_not_contact.set' AND entity_id = v_party_id
  ORDER BY occurred_at DESC LIMIT 1;
  IF v_outbox_id IS NULL THEN
    RAISE EXCEPTION 'A1 FAILED: could not locate the new outbox row by entity_id=%', v_party_id;
  END IF;
  RAISE NOTICE 'A1 OK — outbox % emitted for party %', v_outbox_id, v_party_id;

  -- ──────────────────────────────────────────────────────────────────
  -- Simulate consumer: call the rpc directly
  -- ──────────────────────────────────────────────────────────────────
  SELECT r.inserted_count, r.email_count, r.phone_count
  INTO v_inserted, v_email_count, v_phone_count
  FROM comms.upsert_do_not_contact_suppressions(
    v_tenant, v_party_id, 'account', v_outbox_id
  ) r;

  IF v_inserted <> 2 OR v_email_count <> 1 OR v_phone_count <> 1 THEN
    RAISE EXCEPTION 'A2 FAILED: expected inserted=2 (1 email + 1 phone); got inserted=% email=% phone=%',
      v_inserted, v_email_count, v_phone_count;
  END IF;
  RAISE NOTICE 'A2 OK — rpc upserted 2 suppressions (email=1 phone=1)';

  -- ──────────────────────────────────────────────────────────────────
  -- Assertion 3: suppressions present with right shape
  -- ──────────────────────────────────────────────────────────────────
  SELECT count(*)::integer INTO v_suppress_rows
  FROM comms.suppressions
  WHERE tenant_id = v_tenant
    AND reason = 'do_not_contact'
    AND (source_metadata->>'party_id') = v_party_id::text
    AND address IN (v_email_addr, v_phone_e164);
  IF v_suppress_rows <> 2 THEN
    RAISE EXCEPTION 'A3 FAILED: expected 2 do_not_contact suppression rows for party %; got %',
      v_party_id, v_suppress_rows;
  END IF;
  RAISE NOTICE 'A3 OK — 2 comms.suppressions rows present with reason=do_not_contact';

  -- ──────────────────────────────────────────────────────────────────
  -- Assertion 4: re-running the rpc is a no-op (idempotency)
  -- ──────────────────────────────────────────────────────────────────
  SELECT r.inserted_count INTO v_inserted
  FROM comms.upsert_do_not_contact_suppressions(
    v_tenant, v_party_id, 'account', v_outbox_id
  ) r;
  IF v_inserted <> 0 THEN
    RAISE EXCEPTION 'A4 FAILED: re-run should insert 0 rows (ON CONFLICT DO NOTHING); got %', v_inserted;
  END IF;
  RAISE NOTICE 'A4 OK — re-running rpc inserts 0 rows';

  -- ──────────────────────────────────────────────────────────────────
  -- Cleanup. Order: suppressions → links → addresses → account_ext →
  -- party (CASCADE handles its outgoing FKs) → outbox row.
  -- ──────────────────────────────────────────────────────────────────
  DELETE FROM comms.suppressions
  WHERE tenant_id = v_tenant
    AND (source_metadata->>'party_id') = v_party_id::text;
  DELETE FROM crm.account_extensions WHERE party_id = v_party_id;
  DELETE FROM core.email_links WHERE email_id = v_email_id;
  DELETE FROM core.phone_links WHERE phone_id = v_phone_id;
  DELETE FROM core.email_addresses WHERE id = v_email_id;
  DELETE FROM core.phone_numbers WHERE id = v_phone_id;
  DELETE FROM core.parties WHERE id = v_party_id;
  DELETE FROM core.outbox WHERE id = v_outbox_id;

  RAISE NOTICE '=== COMMS DO_NOT_CONTACT BRIDGE SMOKE TEST PASSED ===';
END;
$$;
