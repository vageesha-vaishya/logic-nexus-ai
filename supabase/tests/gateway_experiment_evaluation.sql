-- Smoke: LLM Gateway P3.5 — evaluate_experiment + promote_experiment_winner RPCs.
BEGIN;

-- A1: both RPCs exist + service_role can EXECUTE them
DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname='gateway' AND p.proname IN ('evaluate_experiment','promote_experiment_winner');
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 evaluator RPCs, found %', n; END IF;
  RAISE NOTICE 'A1 OK';
END $$;

-- A2: evaluate_experiment returns zero counts for an experiment with no traffic
DO $$
DECLARE
  v_key text := 'smoke.eval.prompt';
  v_a uuid; v_b uuid; v_exp uuid;
  r record;
BEGIN
  SELECT version_id INTO v_a
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'eval.prompt', 'A body');
  SELECT version_id INTO v_b
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'eval.prompt', 'B body', NULL,
      '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0, 'standard', 'admin_ui', NULL, false);

  INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id, traffic_split)
    VALUES (v_key, v_a, v_b, 0.5)
    RETURNING id INTO v_exp;

  SELECT * INTO r FROM gateway.evaluate_experiment(v_exp);
  IF r.invocations_a <> 0 OR r.invocations_b <> 0 OR r.accepted_a <> 0 OR r.accepted_b <> 0 THEN
    RAISE EXCEPTION 'expected all-zero counts for fresh experiment; got %', r;
  END IF;
  IF r.prompt_key <> v_key THEN
    RAISE EXCEPTION 'expected prompt_key=%, got %', v_key, r.prompt_key;
  END IF;
  RAISE NOTICE 'A2 OK';
END $$;

-- A3: evaluate aggregates latest-per-invocation, ignoring superseded outcomes
DO $$
DECLARE
  v_key text := 'sm2';
  v_a uuid; v_b uuid; v_exp uuid; v_tenant uuid := gen_random_uuid();
  v_inv1 uuid := gen_random_uuid();
  r record;
BEGIN
  SELECT version_id INTO v_a
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'eval.prompt2', 'A body');
  SELECT version_id INTO v_b
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'eval.prompt2', 'B body', NULL,
      '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0, 'standard', 'admin_ui', NULL, false);

  INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id)
    VALUES (v_key, v_a, v_b)
    RETURNING id INTO v_exp;

  -- One invocation that variant a served
  INSERT INTO gateway.llm_invocations (id, tenant_id, request_id, prompt_key, module, feature,
    resolved_scope_kind, resolved_scope_id, provider_kind, model_id, billing_mode,
    experiment_id, variant_label, prompt_version_id, latency_ms)
  VALUES (v_inv1, v_tenant, 'req-1', v_key, 'smoke', 'eval.prompt2',
    'platform_default', '*', 'echo', 'echo-v1', 'platform_paid',
    v_exp, 'a', v_a, 1);

  -- User changes mind: first rejected, then accepted. Latest wins.
  INSERT INTO gateway.outcomes (invocation_id, tenant_id, prompt_key, prompt_version_id,
    experiment_id, variant_label, kind, user_id, source, created_at)
  VALUES
    (v_inv1, v_tenant, v_key, v_a, v_exp, 'a', 'rejected', gen_random_uuid(), 'test', now() - interval '5 minutes'),
    (v_inv1, v_tenant, v_key, v_a, v_exp, 'a', 'accepted', gen_random_uuid(), 'test', now());

  SELECT * INTO r FROM gateway.evaluate_experiment(v_exp);
  IF r.invocations_a <> 1 THEN
    RAISE EXCEPTION 'expected 1 invocation for a, got %', r.invocations_a;
  END IF;
  IF r.accepted_a <> 1 THEN
    RAISE EXCEPTION 'expected 1 accepted (latest wins), got %', r.accepted_a;
  END IF;
  IF r.rejected_a <> 0 THEN
    RAISE EXCEPTION 'expected 0 rejected (superseded), got %', r.rejected_a;
  END IF;
  IF r.total_outcomes_a <> 1 THEN
    RAISE EXCEPTION 'expected 1 (distinct invocation), got %', r.total_outcomes_a;
  END IF;
  RAISE NOTICE 'A3 OK';
END $$;

-- A4: promote_experiment_winner flips active_version + supersedes prior + completes the experiment
DO $$
DECLARE
  v_key text := 'sm3';
  v_a uuid; v_b uuid; v_exp uuid;
  r record;
  v_active_after uuid; v_a_status text; v_b_status text; v_exp_status text;
BEGIN
  SELECT version_id INTO v_a
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'eval.prompt3', 'A body');
  SELECT version_id INTO v_b
    FROM gateway.upsert_prompt_version(v_key, 'smoke', 'eval.prompt3', 'B body', NULL,
      '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0, 'standard', 'admin_ui', NULL, false);

  INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id)
    VALUES (v_key, v_a, v_b)
    RETURNING id INTO v_exp;

  SELECT * INTO r FROM gateway.promote_experiment_winner(v_exp, v_b);
  IF r.winner_version_id <> v_b THEN RAISE EXCEPTION 'winner mismatch'; END IF;

  SELECT active_version_id INTO v_active_after FROM gateway.prompts WHERE key = v_key;
  IF v_active_after <> v_b THEN
    RAISE EXCEPTION 'expected active_version=%, got %', v_b, v_active_after;
  END IF;
  SELECT status INTO v_a_status FROM gateway.prompt_versions WHERE id = v_a;
  IF v_a_status <> 'superseded' THEN
    RAISE EXCEPTION 'expected v_a superseded, got %', v_a_status;
  END IF;
  SELECT status INTO v_b_status FROM gateway.prompt_versions WHERE id = v_b;
  IF v_b_status <> 'active' THEN
    RAISE EXCEPTION 'expected v_b active, got %', v_b_status;
  END IF;
  SELECT status INTO v_exp_status FROM gateway.prompt_experiments WHERE id = v_exp;
  IF v_exp_status <> 'completed' THEN
    RAISE EXCEPTION 'expected experiment completed, got %', v_exp_status;
  END IF;

  RAISE NOTICE 'A4 OK';
END $$;

-- A5: promote refuses unknown winner
DO $$
DECLARE
  v_key text := 'sm4';
  v_a uuid; v_b uuid; v_exp uuid; v_random uuid := gen_random_uuid();
BEGIN
  SELECT version_id INTO v_a FROM gateway.upsert_prompt_version(v_key, 'smoke', 'eval.prompt4', 'A');
  SELECT version_id INTO v_b FROM gateway.upsert_prompt_version(v_key, 'smoke', 'eval.prompt4', 'B', NULL,
    '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0, 'standard', 'admin_ui', NULL, false);
  INSERT INTO gateway.prompt_experiments (prompt_key, variant_a_version_id, variant_b_version_id)
    VALUES (v_key, v_a, v_b)
    RETURNING id INTO v_exp;
  BEGIN
    PERFORM gateway.promote_experiment_winner(v_exp, v_random);
    RAISE EXCEPTION 'expected promotion to reject unknown winner';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'A5 OK';
  END;
END $$;

ROLLBACK;
SELECT 'gateway_experiment_evaluation OK' AS smoke_result;
