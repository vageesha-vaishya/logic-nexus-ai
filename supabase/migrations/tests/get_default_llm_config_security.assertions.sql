-- Assertions for the platform.get_default_llm_config key-leak fix
-- (20260909100000_secure_get_default_llm_config.sql).
-- Run with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this file>
-- Every block raises an exception on failure; a clean exit means all passed.

BEGIN;

-- Fixture: one tenant, one tenant-wide default config.
CREATE TEMP TABLE _t AS SELECT id AS tenant_id FROM public.tenants LIMIT 1;

DO $$
DECLARE
  v_tenant uuid := (SELECT tenant_id FROM _t);
  v_config_id uuid;
  v_got_id uuid;
  v_null_count int;
  v_public_has_execute boolean;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant rows available to run assertions against';
  END IF;

  INSERT INTO platform.llm_provider_configs
    (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
  VALUES
    (v_tenant, 'anthropic', 'zz-assert-leak-fix', 'claude-sonnet-4-5', 'zz_assert_leak_fix', NULL, true)
  RETURNING id INTO v_config_id;

  -- 1. NULL tenant_id must return no rows (the leak this migration closes).
  SELECT count(*) INTO v_null_count FROM platform.get_default_llm_config(NULL);
  IF v_null_count <> 0 THEN
    RAISE EXCEPTION 'L1 failed: get_default_llm_config(NULL) returned % rows, expected 0', v_null_count;
  END IF;

  -- 2. Omitting the argument entirely (same as NULL, it is the default) must
  --    also return no rows.
  SELECT count(*) INTO v_null_count FROM platform.get_default_llm_config();
  IF v_null_count <> 0 THEN
    RAISE EXCEPTION 'L2 failed: get_default_llm_config() returned % rows, expected 0', v_null_count;
  END IF;

  -- 3. A real tenant_id must still resolve to that tenant's own default --
  --    the fix must not have broken the legitimate case.
  SELECT id INTO v_got_id FROM platform.get_default_llm_config(v_tenant);
  IF v_got_id IS DISTINCT FROM v_config_id THEN
    RAISE EXCEPTION 'L3 failed: get_default_llm_config(v_tenant) returned %, expected the fixture row %', v_got_id, v_config_id;
  END IF;

  -- 4. EXECUTE must no longer be granted to PUBLIC.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
     WHERE routine_schema = 'platform'
       AND routine_name = 'get_default_llm_config'
       AND grantee = 'PUBLIC'
  ) INTO v_public_has_execute;
  IF v_public_has_execute THEN
    RAISE EXCEPTION 'L4 failed: PUBLIC still holds EXECUTE on platform.get_default_llm_config';
  END IF;

  RAISE NOTICE 'All get_default_llm_config security assertions passed.';
END $$;

ROLLBACK;
