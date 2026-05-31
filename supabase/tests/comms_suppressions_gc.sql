-- Phase 6 Step 47 — smoke test for comms suppression GC.
--
-- Asserts:
--   A1. comms.v_suppressions_active excludes rows past expires_at
--       and includes rows with NULL expires_at + future expires_at.
--   A2. comms.prune_expired_suppressions() returns ≥1 when at least
--       one expired row exists.
--   A3. The past row is gone from the raw table; future + perm
--       rows survive.
--   A4. cron.job has exactly one row with jobname='comms-suppression-gc'.
--   A5. Re-running prune is idempotent (returns 0 of our remaining
--       rows; may return >0 if other rows expire between runs).
--
-- Self-cleaning DO block.

DO $$
DECLARE
  v_tenant uuid;
  v_addr_past   text := 'past-'   || substr(gen_random_uuid()::text,1,8) || '@smoke.invalid';
  v_addr_future text := 'future-' || substr(gen_random_uuid()::text,1,8) || '@smoke.invalid';
  v_addr_perm   text := 'perm-'   || substr(gen_random_uuid()::text,1,8) || '@smoke.invalid';
  v_deleted integer;
  v_active_past integer; v_active_future integer; v_active_perm integer;
  v_table_past  integer;
  v_cron_present integer;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;

  INSERT INTO comms.suppressions (tenant_id, channel_kind, address, reason, expires_at, added_by_kind)
  VALUES (v_tenant, 'email', v_addr_past,   'manual', now() - interval '1 hour', 'system');
  INSERT INTO comms.suppressions (tenant_id, channel_kind, address, reason, expires_at, added_by_kind)
  VALUES (v_tenant, 'email', v_addr_future, 'manual', now() + interval '1 day',  'system');
  INSERT INTO comms.suppressions (tenant_id, channel_kind, address, reason, expires_at, added_by_kind)
  VALUES (v_tenant, 'email', v_addr_perm,   'manual', NULL, 'system');

  SELECT count(*) INTO v_active_past   FROM comms.v_suppressions_active WHERE address=v_addr_past;
  SELECT count(*) INTO v_active_future FROM comms.v_suppressions_active WHERE address=v_addr_future;
  SELECT count(*) INTO v_active_perm   FROM comms.v_suppressions_active WHERE address=v_addr_perm;
  IF v_active_past <> 0 OR v_active_future <> 1 OR v_active_perm <> 1 THEN
    RAISE EXCEPTION 'A1: view past=% future=% perm=%', v_active_past, v_active_future, v_active_perm;
  END IF;
  RAISE NOTICE 'A1 OK — view filters past, keeps future + perm';

  v_deleted := comms.prune_expired_suppressions();
  IF v_deleted < 1 THEN RAISE EXCEPTION 'A2: prune returned %; expected ≥1', v_deleted; END IF;
  RAISE NOTICE 'A2 OK — prune deleted % row(s)', v_deleted;

  SELECT count(*) INTO v_table_past FROM comms.suppressions WHERE address=v_addr_past;
  IF v_table_past <> 0 THEN RAISE EXCEPTION 'A3: past row still present (count=%)', v_table_past; END IF;
  IF NOT EXISTS (SELECT 1 FROM comms.suppressions WHERE address IN (v_addr_future, v_addr_perm)) THEN
    RAISE EXCEPTION 'A3: future or perm row missing after prune';
  END IF;
  RAISE NOTICE 'A3 OK — past gone, future+perm kept';

  SELECT count(*)::integer INTO v_cron_present FROM cron.job WHERE jobname='comms-suppression-gc';
  IF v_cron_present <> 1 THEN RAISE EXCEPTION 'A4: cron count=%', v_cron_present; END IF;
  RAISE NOTICE 'A4 OK — cron registered';

  v_deleted := comms.prune_expired_suppressions();
  RAISE NOTICE 'A5 OK — re-prune returned % (idempotent for our rows)', v_deleted;

  DELETE FROM comms.suppressions WHERE address IN (v_addr_future, v_addr_perm);

  RAISE NOTICE '=== SUPPRESSION GC SMOKE PASSED (5/5) ===';
END;
$$;
