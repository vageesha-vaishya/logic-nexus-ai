-- Assertions for the domain-scoped LLM provider config resolution.
-- Run with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this file>
-- Every block raises an exception on failure; a clean exit means all passed.

BEGIN;

-- Fixture: one tenant, a tenant-default config, and a markets-specific config.
CREATE TEMP TABLE _t AS SELECT id AS tenant_id FROM public.tenants LIMIT 1;

DO $$
DECLARE
  v_tenant uuid := (SELECT tenant_id FROM _t);
  v_default_id uuid;
  v_markets_id uuid;
  v_got uuid;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant rows available to run assertions against';
  END IF;

  INSERT INTO platform.llm_provider_configs
    (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
  VALUES
    (v_tenant, 'anthropic', 'zz-assert-default', 'claude-sonnet-4-5', 'zz_assert_default', NULL, true)
  RETURNING id INTO v_default_id;

  INSERT INTO platform.llm_provider_configs
    (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
  VALUES
    (v_tenant, 'openai', 'zz-assert-markets', 'gpt-4o-mini', 'zz_assert_markets', 'markets', true)
  RETURNING id INTO v_markets_id;

  -- 1. A domain-specific row wins over the tenant default for that domain.
  SELECT config_id INTO v_got
    FROM platform.get_tenant_llm_config(v_tenant, NULL, 'markets');
  IF v_got IS DISTINCT FROM v_markets_id THEN
    RAISE EXCEPTION 'A1 failed: markets should resolve to the markets row, got %', v_got;
  END IF;

  -- 2. A domain with no row of its own resolves to the tenant default.
  SELECT config_id INTO v_got
    FROM platform.get_tenant_llm_config(v_tenant, NULL, 'logistics');
  IF v_got IS DISTINCT FROM v_default_id THEN
    RAISE EXCEPTION 'A2 failed: logistics should fall back to the tenant default, got %', v_got;
  END IF;

  -- 3. Setting a default in one domain leaves another domain's default intact.
  IF NOT (SELECT is_default FROM platform.llm_provider_configs WHERE id = v_default_id) THEN
    RAISE EXCEPTION 'A3 failed: inserting a markets default cleared the tenant default';
  END IF;

  -- 4. A second is_default row for the same (tenant, domain) leaves exactly
  --    one default — the trigger clears the previous one.
  INSERT INTO platform.llm_provider_configs
    (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
  VALUES
    (v_tenant, 'gemini', 'zz-assert-markets-2', 'gemini-2.5-flash', 'zz_assert_markets_2', 'markets', true);
  -- The enforce-single-default trigger clears the previous one, so this must
  -- succeed AND leave exactly one default for the domain.
  IF (SELECT count(*) FROM platform.llm_provider_configs
       WHERE tenant_id = v_tenant AND domain = 'markets' AND is_default) <> 1 THEN
    RAISE EXCEPTION 'A4 failed: more than one default for (tenant, markets)';
  END IF;

  -- 5. A second is_default row with domain IS NULL leaves exactly one
  --    default for the tenant. This is the case a bare (tenant_id, domain)
  --    unique index would have missed, since Postgres treats NULLs as
  --    distinct.
  INSERT INTO platform.llm_provider_configs
    (tenant_id, provider, display_name, default_model, vault_secret_name, domain, is_default)
  VALUES
    (v_tenant, 'openrouter', 'zz-assert-default-2', 'anthropic/claude-3.5-sonnet', 'zz_assert_default_2', NULL, true);
  IF (SELECT count(*) FROM platform.llm_provider_configs
       WHERE tenant_id = v_tenant AND domain IS NULL AND is_default) <> 1 THEN
    RAISE EXCEPTION 'A5 failed: more than one tenant-default row with is_default';
  END IF;

  RAISE NOTICE 'All LLM domain assertions passed.';
END $$;

ROLLBACK;
