-- Phase 6 Step 57 — smoke test for core.gen_dual_write_trigger.
--
-- Asserts:
--   A1. Codegen returns 'created:<derived_fn_name>' with default
--       naming (target_schema.dual_write_from_<source_base>).
--   A2. INSERT on source mirrors a fresh row to target.
--   A3. UPDATE on source updates target (DELETE+INSERT semantics).
--   A4. DELETE on source removes target row.
--   A5. UPDATE replaces stale target rows correctly (the
--       DELETE+INSERT on UPDATE branch beats any prior mirror state).
--   A6. Trigger registered on the source table with the expected name.
--
-- Self-cleaning: synthetic dw_test schema DROPped CASCADE.

DO $smoke$
DECLARE
  v_tenant uuid;
  v_id1 uuid := gen_random_uuid();
  v_id2 uuid := gen_random_uuid();
  v_result text;
  v_count integer;
  v_target_name text;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;

  CREATE SCHEMA IF NOT EXISTS dw_test;
  CREATE TABLE dw_test.src_widgets (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    amount numeric
  );
  CREATE TABLE dw_test.tgt_widgets (LIKE dw_test.src_widgets INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
  ALTER TABLE dw_test.tgt_widgets ADD PRIMARY KEY (id);

  SELECT core.gen_dual_write_trigger(jsonb_build_object(
    'source_table', 'dw_test.src_widgets',
    'target_table', 'dw_test.tgt_widgets'
  )) INTO v_result;
  IF v_result <> 'created:dw_test.dual_write_from_src_widgets' THEN
    RAISE EXCEPTION 'A1: %', v_result;
  END IF;
  RAISE NOTICE 'A1 OK';

  INSERT INTO dw_test.src_widgets (id, tenant_id, name, amount) VALUES (v_id1, v_tenant, 'alpha', 10);
  SELECT count(*)::integer, max(name) INTO v_count, v_target_name FROM dw_test.tgt_widgets WHERE id=v_id1;
  IF v_count <> 1 OR v_target_name <> 'alpha' THEN RAISE EXCEPTION 'A2'; END IF;
  RAISE NOTICE 'A2 OK — INSERT mirrors';

  UPDATE dw_test.src_widgets SET name='alpha-renamed', amount=20 WHERE id=v_id1;
  SELECT name, amount INTO v_target_name, v_count FROM dw_test.tgt_widgets WHERE id=v_id1;
  IF v_target_name <> 'alpha-renamed' OR v_count <> 20 THEN RAISE EXCEPTION 'A3'; END IF;
  RAISE NOTICE 'A3 OK — UPDATE mirrors';

  DELETE FROM dw_test.src_widgets WHERE id=v_id1;
  SELECT count(*)::integer INTO v_count FROM dw_test.tgt_widgets WHERE id=v_id1;
  IF v_count <> 0 THEN RAISE EXCEPTION 'A4'; END IF;
  RAISE NOTICE 'A4 OK — DELETE mirrors';

  -- Inject a stale row directly in target, then UPDATE source to ensure
  -- the dual-write's DELETE+INSERT path beats it.
  INSERT INTO dw_test.src_widgets (id, tenant_id, name, amount) VALUES (v_id2, v_tenant, 'beta', 30);
  INSERT INTO dw_test.tgt_widgets (id, tenant_id, name, amount) VALUES (v_id2, v_tenant, 'beta-stale', 99)
  ON CONFLICT DO NOTHING;
  UPDATE dw_test.src_widgets SET amount=31 WHERE id=v_id2;
  SELECT name, amount INTO v_target_name, v_count FROM dw_test.tgt_widgets WHERE id=v_id2;
  IF v_target_name <> 'beta' OR v_count <> 31 THEN
    RAISE EXCEPTION 'A5: target stale-not-replaced name=% amount=%', v_target_name, v_count;
  END IF;
  RAISE NOTICE 'A5 OK — UPDATE replaces stale target';

  PERFORM 1 FROM pg_trigger
  WHERE tgname = 'trg_src_widgets_dual_write_to_dw_test'
    AND tgrelid = 'dw_test.src_widgets'::regclass;
  IF NOT FOUND THEN RAISE EXCEPTION 'A6: trigger not registered'; END IF;
  RAISE NOTICE 'A6 OK';

  DROP SCHEMA dw_test CASCADE;
  RAISE NOTICE '=== gen_dual_write_trigger SMOKE PASSED (6/6) ===';
END;
$smoke$;
