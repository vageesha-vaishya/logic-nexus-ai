-- Smoke: LLM Gateway P3.4 — gateway.outcomes + new audit columns.
BEGIN;

-- A1: outcomes table + RLS
DO $$
DECLARE rls boolean;
BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='gateway' AND table_name='outcomes';
  IF NOT FOUND THEN RAISE EXCEPTION 'gateway.outcomes missing'; END IF;
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='gateway' AND c.relname='outcomes';
  IF NOT rls THEN RAISE EXCEPTION 'gateway.outcomes missing RLS'; END IF;
  RAISE NOTICE 'A1 OK';
END $$;

-- A2: gateway.llm_invocations has new experiment columns
DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM information_schema.columns
   WHERE table_schema='gateway' AND table_name='llm_invocations'
     AND column_name IN ('experiment_id','variant_label','prompt_version_id');
  IF n <> 3 THEN RAISE EXCEPTION 'expected 3 new columns on llm_invocations, found %', n; END IF;
  RAISE NOTICE 'A2 OK';
END $$;

-- A3: outcomes.kind CHECK rejects unknown values
DO $$
BEGIN
  BEGIN
    INSERT INTO gateway.outcomes (invocation_id, tenant_id, kind)
      VALUES (gen_random_uuid(), gen_random_uuid(), 'pondered');
    RAISE EXCEPTION 'expected outcomes.kind CHECK to reject "pondered"';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A3 OK';
  END;
END $$;

-- A4: variant_label CHECK accepts 'a'/'b'/NULL only
DO $$
BEGIN
  BEGIN
    INSERT INTO gateway.outcomes (invocation_id, tenant_id, kind, variant_label)
      VALUES (gen_random_uuid(), gen_random_uuid(), 'accepted', 'c');
    RAISE EXCEPTION 'expected variant_label CHECK to reject "c"';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A4 OK';
  END;
END $$;

-- A5: source CHECK accepts known values; rejects unknown
DO $$
BEGIN
  -- accepts
  INSERT INTO gateway.outcomes (invocation_id, tenant_id, kind, source)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'accepted', 'admin_ui');
  -- rejects
  BEGIN
    INSERT INTO gateway.outcomes (invocation_id, tenant_id, kind, source)
      VALUES (gen_random_uuid(), gen_random_uuid(), 'accepted', 'magic');
    RAISE EXCEPTION 'expected source CHECK to reject "magic"';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A5 OK';
  END;
END $$;

-- A6: append-only trigger blocks UPDATE + DELETE
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO gateway.outcomes (invocation_id, tenant_id, kind, source)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'accepted', 'test')
    RETURNING id INTO v_id;

  BEGIN
    UPDATE gateway.outcomes SET notes='x' WHERE id=v_id;
    RAISE EXCEPTION 'expected append-only trigger to block UPDATE';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM gateway.outcomes WHERE id=v_id;
    RAISE EXCEPTION 'expected append-only trigger to block DELETE';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;
  RAISE NOTICE 'A6 OK';
END $$;

ROLLBACK;
SELECT 'gateway_outcomes OK' AS smoke_result;
