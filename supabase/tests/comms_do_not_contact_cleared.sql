-- Phase 6 Step 42-43 — bidirectional smoke test for the
-- do_not_contact bridge. Exercises both .set and .cleared paths in
-- one run, plus the surgical predicate that preserves bounce/
-- complaint/unsubscribe/manual rows.
--
-- Asserts:
--   A1. Setting do_not_contact=true on crm.account_extensions emits
--       crm.do_not_contact.set; upsert RPC returns inserted=2 (one
--       email + one phone linked to the party).
--   A2. comms.suppressions has the 2 rows with reason=do_not_contact.
--   A3. A pre-existing 'unsubscribe' row on a DIFFERENT address
--       linked to the same party survives (predicate is per-reason
--       AND per-party — surgical, not blanket).
--   A4. Clearing do_not_contact (true→false) emits .cleared; remove
--       RPC returns deleted=2; the do_not_contact rows are gone.
--   A5. The unsubscribe row from A3 is STILL present after the
--       remove — bounce/complaint/unsubscribe rows have their own
--       lifecycle and the do_not_contact undo never touches them.
--
-- Self-cleaning DO block.

DO $$
DECLARE
  v_tenant uuid;
  v_party_id uuid;
  v_email_id uuid; v_email2_id uuid; v_phone_id uuid;
  v_email_addr text  := 'smoke-clr-' || substr(gen_random_uuid()::text, 1, 8) || '@example.invalid';
  v_email2_addr text := 'smoke-clr2-' || substr(gen_random_uuid()::text, 1, 8) || '@example.invalid';
  v_phone_e164  text := '+1555' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7);
  v_set_outbox_id uuid; v_clr_outbox_id uuid;
  v_upserted_count integer; v_email_upsert integer; v_phone_upsert integer;
  v_deleted_count integer;  v_email_del integer;    v_phone_del integer;
  v_dnc_rows integer; v_unsub_rows integer;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'PRECONDITION: no tenant'; END IF;

  -- Setup: party with one email + one phone (will be do_not_contact'd),
  -- plus a second email that is pre-suppressed for 'unsubscribe' (our
  -- "do not touch this" canary).
  INSERT INTO core.parties (tenant_id, party_type, display_name, legal_name)
  VALUES (v_tenant, 'organization', 'SMOKE-CLR-' || substr(gen_random_uuid()::text,1,8), 'SMOKE-CLR')
  RETURNING id INTO v_party_id;

  INSERT INTO core.email_addresses (tenant_id, email) VALUES (v_tenant, v_email_addr) RETURNING id INTO v_email_id;
  INSERT INTO core.email_links (tenant_id, email_id, subject_type, subject_id, role, is_primary)
  VALUES (v_tenant, v_email_id, 'core.party', v_party_id, 'work', true);

  INSERT INTO core.email_addresses (tenant_id, email) VALUES (v_tenant, v_email2_addr) RETURNING id INTO v_email2_id;
  INSERT INTO core.email_links (tenant_id, email_id, subject_type, subject_id, role, is_primary)
  VALUES (v_tenant, v_email2_id, 'core.party', v_party_id, 'personal', false);

  INSERT INTO core.phone_numbers (tenant_id, e164) VALUES (v_tenant, v_phone_e164) RETURNING id INTO v_phone_id;
  INSERT INTO core.phone_links (tenant_id, phone_id, subject_type, subject_id, role, is_primary)
  VALUES (v_tenant, v_phone_id, 'core.party', v_party_id, 'work', true);

  -- Pre-existing 'unsubscribe' canary on the SECOND email — same party,
  -- but a different reason path. Should NEVER be removed by the
  -- do_not_contact undo.
  INSERT INTO comms.suppressions (tenant_id, channel_kind, address, reason, added_by_kind)
  VALUES (v_tenant, 'email', v_email2_addr, 'unsubscribe', 'recipient_unsubscribe');

  -- ─────────────────────────────────────────────────────────────────
  -- A1: .set path
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO crm.account_extensions (party_id, tenant_id, do_not_contact, do_not_contact_at)
  VALUES (v_party_id, v_tenant, true, now());

  SELECT id INTO v_set_outbox_id FROM core.outbox
  WHERE event_type='crm.do_not_contact.set' AND entity_id=v_party_id
  ORDER BY occurred_at DESC LIMIT 1;
  IF v_set_outbox_id IS NULL THEN RAISE EXCEPTION 'A1: no .set outbox row'; END IF;

  SELECT r.inserted_count, r.email_count, r.phone_count
  INTO v_upserted_count, v_email_upsert, v_phone_upsert
  FROM comms.upsert_do_not_contact_suppressions(v_tenant, v_party_id, 'account', v_set_outbox_id) r;
  IF v_upserted_count <> 2 OR v_email_upsert <> 1 OR v_phone_upsert <> 1 THEN
    RAISE EXCEPTION 'A1: upserted=% email=% phone=%', v_upserted_count, v_email_upsert, v_phone_upsert;
  END IF;
  RAISE NOTICE 'A1 OK — .set produced 2 suppressions (email=1 phone=1)';

  -- ─────────────────────────────────────────────────────────────────
  -- A2: dnc rows present
  -- ─────────────────────────────────────────────────────────────────
  SELECT count(*)::integer INTO v_dnc_rows
  FROM comms.suppressions
  WHERE tenant_id=v_tenant AND reason='do_not_contact'
    AND (source_metadata->>'party_id') = v_party_id::text;
  IF v_dnc_rows <> 2 THEN RAISE EXCEPTION 'A2: %dnc rows', v_dnc_rows; END IF;
  RAISE NOTICE 'A2 OK — 2 do_not_contact rows present';

  -- ─────────────────────────────────────────────────────────────────
  -- A3: pre-existing unsubscribe row survives
  -- ─────────────────────────────────────────────────────────────────
  SELECT count(*)::integer INTO v_unsub_rows
  FROM comms.suppressions
  WHERE tenant_id=v_tenant AND reason='unsubscribe' AND address=v_email2_addr;
  IF v_unsub_rows <> 1 THEN RAISE EXCEPTION 'A3 setup: unsub canary missing'; END IF;
  RAISE NOTICE 'A3 OK (setup) — unsubscribe canary in place';

  -- ─────────────────────────────────────────────────────────────────
  -- A4: .cleared path
  -- ─────────────────────────────────────────────────────────────────
  UPDATE crm.account_extensions
  SET do_not_contact = false, do_not_contact_at = now()
  WHERE party_id = v_party_id;

  SELECT id INTO v_clr_outbox_id FROM core.outbox
  WHERE event_type='crm.do_not_contact.cleared' AND entity_id=v_party_id
  ORDER BY occurred_at DESC LIMIT 1;
  IF v_clr_outbox_id IS NULL THEN RAISE EXCEPTION 'A4: no .cleared outbox row'; END IF;

  SELECT r.deleted_count, r.email_count, r.phone_count
  INTO v_deleted_count, v_email_del, v_phone_del
  FROM comms.remove_do_not_contact_suppressions(v_tenant, v_party_id, 'account', v_clr_outbox_id) r;
  IF v_deleted_count <> 2 OR v_email_del <> 1 OR v_phone_del <> 1 THEN
    RAISE EXCEPTION 'A4: deleted=% email=% phone=%', v_deleted_count, v_email_del, v_phone_del;
  END IF;
  SELECT count(*)::integer INTO v_dnc_rows
  FROM comms.suppressions
  WHERE tenant_id=v_tenant AND reason='do_not_contact'
    AND (source_metadata->>'party_id') = v_party_id::text;
  IF v_dnc_rows <> 0 THEN RAISE EXCEPTION 'A4: %dnc rows survived removal', v_dnc_rows; END IF;
  RAISE NOTICE 'A4 OK — .cleared deleted 2 do_not_contact rows; zero left';

  -- ─────────────────────────────────────────────────────────────────
  -- A5: unsubscribe canary STILL survives
  -- ─────────────────────────────────────────────────────────────────
  SELECT count(*)::integer INTO v_unsub_rows
  FROM comms.suppressions
  WHERE tenant_id=v_tenant AND reason='unsubscribe' AND address=v_email2_addr;
  IF v_unsub_rows <> 1 THEN RAISE EXCEPTION 'A5: unsubscribe canary lost (rows=%)', v_unsub_rows; END IF;
  RAISE NOTICE 'A5 OK — unsubscribe canary survived the cleared path';

  -- Cleanup
  DELETE FROM comms.suppressions WHERE tenant_id=v_tenant AND address IN (v_email_addr, v_email2_addr, v_phone_e164);
  DELETE FROM crm.account_extensions WHERE party_id=v_party_id;
  DELETE FROM core.email_links WHERE email_id IN (v_email_id, v_email2_id);
  DELETE FROM core.phone_links WHERE phone_id=v_phone_id;
  DELETE FROM core.email_addresses WHERE id IN (v_email_id, v_email2_id);
  DELETE FROM core.phone_numbers WHERE id=v_phone_id;
  DELETE FROM core.parties WHERE id=v_party_id;
  DELETE FROM core.outbox WHERE id IN (v_set_outbox_id, v_clr_outbox_id);

  RAISE NOTICE '=== DO_NOT_CONTACT BIDIRECTIONAL SMOKE PASSED (5/5) ===';
END;
$$;
