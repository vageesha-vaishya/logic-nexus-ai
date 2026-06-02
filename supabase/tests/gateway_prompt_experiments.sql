-- Smoke: LLM Gateway P3.3 — gateway.prompt_experiments + CHECKs + partial-unique-active.
BEGIN;

-- A1: table + RLS
DO $$
DECLARE rls boolean;
BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='gateway' AND table_name='prompt_experiments';
  IF NOT FOUND THEN RAISE EXCEPTION 'gateway.prompt_experiments missing'; END IF;
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='gateway' AND c.relname='prompt_experiments';
  IF NOT rls THEN RAISE EXCEPTION 'gateway.prompt_experiments missing RLS'; END IF;
  RAISE NOTICE 'A1 OK';
END $$;

-- A2: variants_differ CHECK rejects A=B
DO $$
DECLARE v_key text := 'smoke.exp.prompt'; v_id uuid; v_v1 uuid;
BEGIN
  SELECT version_id INTO v_v1
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'exp.prompt', 'v1 {{x}}');
  BEGIN
    INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id, traffic_split)
      VALUES (v_key, v_v1, v_v1, 0.5);
    RAISE EXCEPTION 'expected variants_differ CHECK to reject A=B';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A2 OK';
  END;
END $$;

-- A3: traffic_split CHECK rejects out-of-range
DO $$
DECLARE v_key text := 'smoke.exp.prompt2'; v_v1 uuid; v_v2 uuid;
BEGIN
  SELECT version_id INTO v_v1
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'exp.prompt2', 'v1 body');
  SELECT version_id INTO v_v2
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'exp.prompt2', 'v2 body', NULL, '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0, 'standard', 'admin_ui', NULL, false);
  BEGIN
    INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id, traffic_split)
      VALUES (v_key, v_v1, v_v2, 1.5);
    RAISE EXCEPTION 'expected traffic_split CHECK to reject 1.5';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A3 OK';
  END;
END $$;

-- A4: partial unique index — only one active experiment per prompt_key
DO $$
DECLARE v_key text := 'smoke.exp.prompt3'; v_v1 uuid; v_v2 uuid;
BEGIN
  SELECT version_id INTO v_v1
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'exp.prompt3', 'v1');
  SELECT version_id INTO v_v2
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'exp.prompt3', 'v2', NULL, '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0, 'standard', 'admin_ui', NULL, false);

  INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id, status)
    VALUES (v_key, v_v1, v_v2, 'active');

  BEGIN
    INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id, status)
      VALUES (v_key, v_v1, v_v2, 'active');
    RAISE EXCEPTION 'expected partial unique to block second active experiment';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'A4 OK';
  END;
END $$;

-- A5: paused/completed experiments can coexist with an active one
DO $$
DECLARE v_key text := 'smoke.exp.prompt4'; v_v1 uuid; v_v2 uuid;
BEGIN
  SELECT version_id INTO v_v1
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'exp.prompt4', 'v1');
  SELECT version_id INTO v_v2
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'exp.prompt4', 'v2', NULL, '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0, 'standard', 'admin_ui', NULL, false);

  INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id, status)
    VALUES (v_key, v_v1, v_v2, 'completed'),
           (v_key, v_v1, v_v2, 'paused'),
           (v_key, v_v1, v_v2, 'active');
  -- Should not throw — 1 active + N non-active is fine
  RAISE NOTICE 'A5 OK';
END $$;

ROLLBACK;
SELECT 'gateway_prompt_experiments OK' AS smoke_result;
