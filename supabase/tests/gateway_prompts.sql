-- Smoke: LLM Gateway P3.1 — gateway.prompts + gateway.prompt_versions
--   + upsert_prompt_version() RPC.
BEGIN;

-- A1: tables + RLS
DO $$
DECLARE rls boolean;
BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='gateway' AND table_name='prompts';
  IF NOT FOUND THEN RAISE EXCEPTION 'gateway.prompts missing'; END IF;
  PERFORM 1 FROM information_schema.tables WHERE table_schema='gateway' AND table_name='prompt_versions';
  IF NOT FOUND THEN RAISE EXCEPTION 'gateway.prompt_versions missing'; END IF;
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='gateway' AND c.relname='prompts';
  IF NOT rls THEN RAISE EXCEPTION 'gateway.prompts missing RLS'; END IF;
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='gateway' AND c.relname='prompt_versions';
  IF NOT rls THEN RAISE EXCEPTION 'gateway.prompt_versions missing RLS'; END IF;
  RAISE NOTICE 'A1 OK';
END $$;

-- A2: upsert creates prompt + version + sets active_version_id
DO $$
DECLARE v_id uuid; v_num int; v_active uuid;
BEGIN
  SELECT version_id, version_number INTO v_id, v_num
    FROM gateway.upsert_prompt_version('smoke.test.prompt', 'smoke', 'test.prompt',
        'hello {{name}}', 'smoke desc');
  IF v_num <> 1 THEN RAISE EXCEPTION 'expected version 1, got %', v_num; END IF;
  SELECT active_version_id INTO v_active FROM gateway.prompts WHERE key = 'smoke.test.prompt';
  IF v_active <> v_id THEN RAISE EXCEPTION 'active_version_id not set to new version'; END IF;
  RAISE NOTICE 'A2 OK';
END $$;

-- A3: re-upsert bumps version + supersedes prior + flips active
DO $$
DECLARE v_id uuid; v_num int; v_prior_status text;
BEGIN
  SELECT version_id, version_number INTO v_id, v_num
    FROM gateway.upsert_prompt_version('smoke.test.prompt', 'smoke', 'test.prompt',
        'hello v2 {{name}}', NULL);
  IF v_num <> 2 THEN RAISE EXCEPTION 'expected version 2, got %', v_num; END IF;
  SELECT status INTO v_prior_status
    FROM gateway.prompt_versions WHERE prompt_key = 'smoke.test.prompt' AND version_number = 1;
  IF v_prior_status <> 'superseded' THEN RAISE EXCEPTION 'expected v1 superseded, got %', v_prior_status; END IF;
  RAISE NOTICE 'A3 OK';
END $$;

-- A4: promote_active=false creates draft; active stays on prior
DO $$
DECLARE v_id uuid; v_status text; v_active_before uuid; v_active_after uuid;
BEGIN
  SELECT active_version_id INTO v_active_before FROM gateway.prompts WHERE key = 'smoke.test.prompt';
  SELECT version_id INTO v_id
    FROM gateway.upsert_prompt_version('smoke.test.prompt', 'smoke', 'test.prompt',
        'draft body', NULL, '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, 0, 'standard', 'admin_ui', NULL, false);
  SELECT status INTO v_status FROM gateway.prompt_versions WHERE id = v_id;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'expected draft, got %', v_status; END IF;
  SELECT active_version_id INTO v_active_after FROM gateway.prompts WHERE key = 'smoke.test.prompt';
  IF v_active_after <> v_active_before THEN RAISE EXCEPTION 'active should not change on draft'; END IF;
  RAISE NOTICE 'A4 OK';
END $$;

-- A5: safety_class CHECK rejects unknown values
DO $$
BEGIN
  BEGIN
    INSERT INTO gateway.prompt_versions (prompt_key, version_number, body, safety_class)
      VALUES ('smoke.test.prompt', 999, 'x', 'rogue');
    RAISE EXCEPTION 'expected safety_class CHECK to reject "rogue"';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A5 OK';
  END;
END $$;

ROLLBACK;
SELECT 'gateway_prompts OK' AS smoke_result;
