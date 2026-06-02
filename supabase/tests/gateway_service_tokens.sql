-- Smoke: LLM Gateway P2.2 — service tokens.
-- Verifies the table + RPCs + scope CHECK constraint behave correctly.
-- Wrapped in BEGIN/ROLLBACK so the test-token rows are undone.
BEGIN;

-- A1: table exists + RLS enabled
DO $$
DECLARE rls boolean;
BEGIN
  PERFORM 1 FROM information_schema.tables WHERE table_schema='gateway' AND table_name='service_tokens';
  IF NOT FOUND THEN RAISE EXCEPTION 'gateway.service_tokens missing'; END IF;
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='gateway' AND c.relname='service_tokens';
  IF NOT rls THEN RAISE EXCEPTION 'gateway.service_tokens missing RLS'; END IF;
  RAISE NOTICE 'A1 OK — table + RLS';
END $$;

-- A2: mint helper returns plaintext + persists hash (not plaintext)
DO $$
DECLARE v_token text; v_id uuid; v_count int;
BEGIN
  SELECT token_plaintext, token_id INTO v_token, v_id
    FROM gateway.mint_service_token('smoke-platform', ARRAY['invoke'], 'smoke');
  IF v_token IS NULL OR v_id IS NULL THEN
    RAISE EXCEPTION 'mint_service_token returned NULL';
  END IF;
  IF NOT (v_token LIKE 'lngw_%' AND length(v_token) > 30) THEN
    RAISE EXCEPTION 'unexpected token format: %', v_token;
  END IF;

  -- Plaintext must NOT be in the table; only the hash.
  SELECT COUNT(*) INTO v_count FROM gateway.service_tokens
    WHERE token_hash = v_token OR token_prefix = v_token;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'plaintext token leaked into stored hash/prefix columns';
  END IF;

  -- The hash row should be present.
  SELECT COUNT(*) INTO v_count FROM gateway.service_tokens WHERE id = v_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected 1 row for token_id %, found %', v_id, v_count;
  END IF;

  RAISE NOTICE 'A2 OK — mint stores hash, not plaintext';
END $$;

-- A3: scope CHECK constraint rejects unknown scopes
DO $$
BEGIN
  BEGIN
    INSERT INTO gateway.service_tokens (platform_id, token_hash, token_prefix, scopes)
      VALUES ('smoke-platform', repeat('a', 64), 'aaaaaaaaaaaa', ARRAY['rogue_scope']);
    RAISE EXCEPTION 'expected scope_values_known CHECK to block unknown scope';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A3 OK — unknown scope rejected';
  END;
END $$;

-- A4: revoke flips status + sets revoked_at
DO $$
DECLARE v_token text; v_id uuid; v_status text; v_revoked_at timestamptz;
BEGIN
  SELECT token_plaintext, token_id INTO v_token, v_id
    FROM gateway.mint_service_token('smoke-platform', ARRAY['invoke','read_usage'], 'smoke-revoke');
  PERFORM gateway.revoke_service_token(v_id, 'smoke test');
  SELECT status, revoked_at INTO v_status, v_revoked_at
    FROM gateway.service_tokens WHERE id = v_id;
  IF v_status <> 'revoked' OR v_revoked_at IS NULL THEN
    RAISE EXCEPTION 'expected status=revoked + revoked_at set; got % / %', v_status, v_revoked_at;
  END IF;
  RAISE NOTICE 'A4 OK — revoke flips status';
END $$;

-- A5: mint with empty platform_id throws
DO $$
BEGIN
  BEGIN
    PERFORM gateway.mint_service_token('', ARRAY['invoke'], 'should fail');
    RAISE EXCEPTION 'expected mint to reject empty platform_id';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'A5 OK — empty platform_id rejected';
  END;
END $$;

-- A6: mint with empty scopes throws
DO $$
BEGIN
  BEGIN
    PERFORM gateway.mint_service_token('smoke-platform', ARRAY[]::text[], 'should fail');
    RAISE EXCEPTION 'expected mint to reject empty scopes';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'A6 OK — empty scopes rejected';
  END;
END $$;

ROLLBACK;
SELECT 'gateway_service_tokens OK' AS smoke_result;
