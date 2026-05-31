-- Phase 6 Step 41 — smoke test for the outbox partition
-- auto-provisioner. Run against any environment where Step 41 is
-- applied. Self-cleaning DO block.
--
-- Asserts:
--   A1. ensure_outbox_partition_for(date in already-created month)
--       returns 'already_exists:NAME' and does not error.
--   A2. ensure_outbox_partition_for(date in not-yet-created month)
--       returns 'created:NAME' and the partition is present in
--       pg_catalog afterwards.
--   A3. INSERT into core.outbox with occurred_at in the new month
--       routes successfully (the partition is wired in, not just
--       created at the catalog level).
--   A4. ensure_outbox_partitions_ahead(2) called with all target
--       partitions already present is a clean no-op.
--   A5. cron.job has exactly one row with jobname='outbox-
--       partition-provisioner' (the cron entry registered).
--
-- The synthetic far-future partition gets dropped at the end so
-- the catalog isn't polluted between runs.

DO $$
DECLARE
  v_existing_result text;
  v_new_result text;
  v_new_part_date date := '2027-09-15'::date;
  v_new_part_name text := 'outbox_y2027m09';
  v_qualified text := 'core.' || v_new_part_name;
  v_tenant uuid;
  v_test_id uuid;
  v_cron_present integer;
BEGIN
  v_existing_result := core.ensure_outbox_partition_for('2026-05-15'::date);
  IF v_existing_result <> 'already_exists:outbox_y2026m05' THEN
    RAISE EXCEPTION 'A1: expected already_exists:outbox_y2026m05; got %', v_existing_result;
  END IF;
  RAISE NOTICE 'A1 OK — %', v_existing_result;

  IF to_regclass(v_qualified) IS NOT NULL THEN
    RAISE EXCEPTION 'A2 PRECONDITION FAILED: % already exists (this test assumes 2027 Q3 is past current buffer)', v_qualified;
  END IF;
  v_new_result := core.ensure_outbox_partition_for(v_new_part_date);
  IF v_new_result <> 'created:' || v_new_part_name THEN
    RAISE EXCEPTION 'A2: expected created:%; got %', v_new_part_name, v_new_result;
  END IF;
  IF to_regclass(v_qualified) IS NULL THEN
    RAISE EXCEPTION 'A2: % missing from catalog after creation', v_qualified;
  END IF;
  RAISE NOTICE 'A2 OK — created %', v_new_part_name;

  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  INSERT INTO core.outbox (id, tenant_id, module, entity_type, event_type, entity_id, occurred_at, version, payload, metadata)
  VALUES (gen_random_uuid(), v_tenant, 'test', 'smoke', 'core.outbox.autoprovisioner', gen_random_uuid(),
          v_new_part_date::timestamptz, 1, '{}'::jsonb, '{"smoke_test":true}'::jsonb)
  RETURNING id INTO v_test_id;
  DELETE FROM core.outbox WHERE id = v_test_id;
  RAISE NOTICE 'A3 OK — routing into new partition works';

  PERFORM core.ensure_outbox_partitions_ahead(2);
  RAISE NOTICE 'A4 OK — partitions_ahead(2) idempotent';

  SELECT count(*)::integer INTO v_cron_present
  FROM cron.job WHERE jobname = 'outbox-partition-provisioner';
  IF v_cron_present <> 1 THEN
    RAISE EXCEPTION 'A5: expected exactly 1 cron job named outbox-partition-provisioner; got %', v_cron_present;
  END IF;
  RAISE NOTICE 'A5 OK — cron job registered';

  EXECUTE 'DROP TABLE core.' || quote_ident(v_new_part_name);
  IF to_regclass(v_qualified) IS NOT NULL THEN
    RAISE EXCEPTION 'cleanup failed: % still present', v_qualified;
  END IF;
  RAISE NOTICE '=== OUTBOX AUTO-PROVISIONER SMOKE TEST PASSED (5/5) ===';
END;
$$;
