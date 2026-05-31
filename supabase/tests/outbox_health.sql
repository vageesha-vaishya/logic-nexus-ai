-- Phase 6 Step 51 — smoke test for core.v_outbox_health.
--
-- Asserts:
--   A1. Injecting an artificially-aged unpublished row (15min in
--       the past) flips is_stale=true for that event_type AND
--       increments unpublished_count by 1.
--   A2. Adding a FRESH (now) unpublished row alongside keeps
--       is_stale=true — the view reports based on OLDEST unpublished,
--       not newest.
--   A3. Publishing the stale row (UPDATE published_at = now())
--       flips is_stale back to false (only the fresh one remains,
--       and it's not yet 10min old).
--
-- Note on NULL semantics: when unpublished_count = 0, is_stale and
-- the age columns are NULL (no data to evaluate). Ops queries
-- should use `is_stale = true` or `is_stale IS TRUE` to filter
-- actionable rows; both correctly exclude NULL.

DO $$
DECLARE
  v_tenant uuid;
  v_stale_id uuid; v_fresh_id uuid;
  v_is_stale boolean;
  v_unpublished_before integer; v_unpublished_after integer;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;

  SELECT COALESCE(unpublished_count, 0) INTO v_unpublished_before
  FROM core.v_outbox_health
  WHERE module='crm' AND event_type='crm.do_not_contact.set';

  INSERT INTO core.outbox (id, tenant_id, module, entity_type, event_type, entity_id,
                            occurred_at, version, payload, metadata)
  VALUES (gen_random_uuid(), v_tenant, 'crm', 'account', 'crm.do_not_contact.set',
          gen_random_uuid(), now() - interval '15 minutes', 1,
          jsonb_build_object('party_id', gen_random_uuid()),
          jsonb_build_object('smoke_test', true))
  RETURNING id INTO v_stale_id;

  SELECT is_stale, unpublished_count INTO v_is_stale, v_unpublished_after
  FROM core.v_outbox_health
  WHERE module='crm' AND event_type='crm.do_not_contact.set';
  IF NOT v_is_stale THEN RAISE EXCEPTION 'A1: is_stale=false; expected true'; END IF;
  IF v_unpublished_after <> v_unpublished_before + 1 THEN
    RAISE EXCEPTION 'A1: unpublished delta=%', v_unpublished_after - v_unpublished_before;
  END IF;
  RAISE NOTICE 'A1 OK — stale flag fires + count incremented';

  INSERT INTO core.outbox (id, tenant_id, module, entity_type, event_type, entity_id,
                            occurred_at, version, payload, metadata)
  VALUES (gen_random_uuid(), v_tenant, 'crm', 'account', 'crm.do_not_contact.set',
          gen_random_uuid(), now(), 1, '{}'::jsonb, jsonb_build_object('smoke_test', true))
  RETURNING id INTO v_fresh_id;
  SELECT is_stale INTO v_is_stale FROM core.v_outbox_health
  WHERE module='crm' AND event_type='crm.do_not_contact.set';
  IF NOT v_is_stale THEN RAISE EXCEPTION 'A2: is_stale=false after fresh insert; expected true'; END IF;
  RAISE NOTICE 'A2 OK — stale based on oldest';

  UPDATE core.outbox SET published_at = now() WHERE id = v_stale_id;
  SELECT is_stale INTO v_is_stale FROM core.v_outbox_health
  WHERE module='crm' AND event_type='crm.do_not_contact.set';
  IF v_is_stale THEN RAISE EXCEPTION 'A3: is_stale=true after publishing; expected false'; END IF;
  RAISE NOTICE 'A3 OK — stale flips off after publish';

  DELETE FROM core.outbox WHERE id IN (v_stale_id, v_fresh_id);
  RAISE NOTICE '=== v_outbox_health SMOKE PASSED (3/3) ===';
END;
$$;
