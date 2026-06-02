-- Smoke: LLM Gateway P1.3 — gateway.* schema.
-- Verifies all 5 tables exist + RLS enabled + seeds populated + the
-- append-only trigger on gateway.llm_invocations blocks UPDATE/DELETE.
--
-- Wrapped in BEGIN/ROLLBACK so the INSERT during the trigger test is
-- undone (the trigger blocks UPDATE/DELETE, not the implicit ROLLBACK).
BEGIN;

-- 5 tables present + RLS enabled
DO $$
DECLARE
  expected text[] := ARRAY[
    'tenant_provider_credentials','provider_configs','provider_models',
    'provider_residency_map','llm_invocations'
  ];
  t text;
  rls boolean;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    PERFORM 1 FROM information_schema.tables
      WHERE table_schema='gateway' AND table_name=t;
    IF NOT FOUND THEN RAISE EXCEPTION 'missing gateway.% table', t; END IF;
    SELECT relrowsecurity INTO rls
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='gateway' AND c.relname=t;
    IF NOT rls THEN RAISE EXCEPTION 'gateway.% missing RLS', t; END IF;
  END LOOP;
  RAISE NOTICE 'A1 OK — 5 tables + RLS';
END $$;

-- Seeds present
DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM gateway.provider_models;
  IF n < 5 THEN RAISE EXCEPTION 'expected ≥5 provider_models rows, got %', n; END IF;
  SELECT COUNT(*) INTO n FROM gateway.provider_residency_map;
  IF n < 9 THEN RAISE EXCEPTION 'expected ≥9 provider_residency_map rows, got %', n; END IF;
  SELECT COUNT(*) INTO n FROM gateway.provider_configs WHERE scope_kind='platform_default';
  IF n < 1 THEN RAISE EXCEPTION 'expected platform_default config seed, found 0'; END IF;
  RAISE NOTICE 'A2 OK — seeds populated';
END $$;

-- pin_only_on_feature_pin CHECK constraint
DO $$
BEGIN
  BEGIN
    INSERT INTO gateway.provider_configs (scope_kind, scope_id, provider_kind, model_id, is_pin, billing_mode)
    VALUES ('tenant', 'tenant-X-smoke', 'echo', 'echo-v1', true, 'platform_paid');
    RAISE EXCEPTION 'expected pin_only_on_feature_pin CHECK to block is_pin on non-feature_pin scope';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A3 OK — is_pin restricted to feature_pin scope';
  END;
END $$;

-- Append-only trigger on llm_invocations
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO gateway.llm_invocations (tenant_id, request_id, prompt_key, module, feature,
    resolved_scope_kind, resolved_scope_id, provider_kind, model_id, billing_mode, latency_ms)
  VALUES (gen_random_uuid(), 'smoke-' || gen_random_uuid()::text,
          'smoke.prompt', 'smoke', 'smoke',
          'platform_default', '*', 'echo', 'echo-v1', 'platform_paid', 1)
  RETURNING id INTO v_id;

  BEGIN
    UPDATE gateway.llm_invocations SET latency_ms = 999 WHERE id = v_id;
    RAISE EXCEPTION 'expected append-only trigger to block UPDATE';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM gateway.llm_invocations WHERE id = v_id;
    RAISE EXCEPTION 'expected append-only trigger to block DELETE';
  EXCEPTION WHEN restrict_violation THEN NULL;
  END;

  RAISE NOTICE 'A4 OK — append-only guard blocks UPDATE/DELETE';
END $$;

ROLLBACK;
SELECT 'gateway_phase_p1_schema OK' AS smoke_result;
