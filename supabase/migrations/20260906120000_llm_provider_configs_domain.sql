-- ====================================================================
-- Per-domain LLM provider configuration.
--
-- Adds a nullable `domain` to platform.llm_provider_configs, where
-- NULL means "tenant-wide default". Existing rows are untouched and keep
-- their exact current meaning: a tenant's single configured provider
-- becomes the fallback for all five domains. No backfill is required.
--
-- Domains are the task-ID prefixes the gateway routes on
-- (see LlmTaskId in supabase/functions/_shared/llm-gateway.ts).
-- ====================================================================

-- Before applying to production: confirm the live constraint name dropped
-- below. platform.llm_provider_configs was reconstituted from prod rather
-- than built by replaying this repo's migrations, so its auto-generated
-- constraint name is not guaranteed to match what CREATE TABLE would have
-- produced locally. Run first:
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'platform.llm_provider_configs'::regclass
--      AND contype = 'u';
--
-- Expected: one row named llm_provider_configs_tenant_id_provider_display_name_key
-- with definition UNIQUE (tenant_id, provider, display_name). If the name
-- differs, use the actual name below instead of the assumed one.

ALTER TABLE platform.llm_provider_configs
  ADD COLUMN domain text NULL
  CHECK (domain IS NULL OR domain IN ('markets','logistics','comms','ops','security'));

COMMENT ON COLUMN platform.llm_provider_configs.domain IS
  'Gateway domain this config serves (task-ID prefix). NULL = tenant-wide default, used by any domain without its own config.';

-- ── Uniqueness ──────────────────────────────────────────────────────
-- COALESCE, not a bare (tenant_id, domain): Postgres treats NULLs as
-- distinct in unique indexes, so a bare composite would allow two
-- tenant-default rows with is_default = true — breaking the guarantee
-- on precisely the row every unconfigured domain falls back to.

DROP INDEX IF EXISTS platform.llm_provider_configs_one_default_per_tenant;

CREATE UNIQUE INDEX llm_provider_configs_one_default_per_tenant_domain
  ON platform.llm_provider_configs (tenant_id, COALESCE(domain, '*'))
  WHERE is_default = true;

-- Widen the natural key so the same display name can be reused per domain.
ALTER TABLE platform.llm_provider_configs
  DROP CONSTRAINT llm_provider_configs_tenant_id_provider_display_name_key;

CREATE UNIQUE INDEX llm_provider_configs_tenant_domain_provider_name_key
  ON platform.llm_provider_configs (tenant_id, COALESCE(domain, '*'), provider, display_name);

-- ── Lookup index ────────────────────────────────────────────────────

CREATE INDEX llm_provider_configs_tenant_domain_idx
  ON platform.llm_provider_configs (tenant_id, domain, is_active);

-- ── Trigger: single default per (tenant, domain), not per tenant ─────
-- Without the COALESCE predicate, setting a logistics default would
-- silently clear the markets one.

CREATE OR REPLACE FUNCTION platform.llm_configs_enforce_single_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, platform
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE platform.llm_provider_configs
       SET is_default = false
     WHERE tenant_id = NEW.tenant_id
       AND COALESCE(domain, '*') = COALESCE(NEW.domain, '*')
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Resolution ──────────────────────────────────────────────────────
-- DROP then CREATE, not CREATE OR REPLACE: adding a defaulted parameter
-- creates an overload rather than replacing, leaving two same-named
-- functions and an ambiguous PostgREST RPC dispatch.

DROP FUNCTION IF EXISTS platform.get_tenant_llm_config(uuid, text);

CREATE FUNCTION platform.get_tenant_llm_config(
  p_tenant_id uuid,
  p_provider  text DEFAULT NULL,
  p_domain    text DEFAULT NULL
)
RETURNS TABLE (
  config_id      uuid,
  provider       text,
  base_url       text,
  default_model  text,
  api_key        text,    -- DECRYPTED — never expose this to clients
  is_default     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform, vault
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id                AS config_id,
    c.provider          AS provider,
    c.base_url          AS base_url,
    c.default_model     AS default_model,
    vs.decrypted_secret AS api_key,
    c.is_default        AS is_default
  FROM platform.llm_provider_configs c
  LEFT JOIN vault.decrypted_secrets vs ON vs.name = c.vault_secret_name
  WHERE c.tenant_id = p_tenant_id
    AND c.is_active = true
    AND (p_domain IS NULL OR c.domain = p_domain OR c.domain IS NULL)
    AND (
      (p_provider IS NULL AND c.is_default = true)
      OR (p_provider IS NOT NULL AND c.provider = p_provider)
    )
  ORDER BY (c.domain IS NOT NULL) DESC,  -- domain-specific beats tenant default
           c.is_default DESC,
           c.created_at ASC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION platform.get_tenant_llm_config(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION platform.get_tenant_llm_config(uuid, text, text) TO service_role;

COMMENT ON FUNCTION platform.get_tenant_llm_config(uuid, text, text) IS
  'Gateway helper. SECURITY DEFINER + service_role-only. Returns the tenant active LLM provider config for a domain (falling back to the tenant-wide default) WITH the decrypted API key. Never expose to clients.';

-- ── Fix: platform.get_default_llm_config regression ──────────────────
-- This function (supabase/migrations/20260516030101_platform_get_default_llm_config.sql)
-- is called by the Python worker LLM gateway and has no domain filter. It
-- was previously safe because the old unique index guaranteed exactly one
-- is_default row per tenant. After this migration, that guarantee becomes
-- one is_default row per (tenant, domain) — so without a fix, this
-- function would arbitrarily return whichever is_default row (any domain)
-- happened to have the most recent updated_at, instead of deterministically
-- returning the tenant-wide default. Add "AND c.domain IS NULL" to restore
-- its exact original semantics (tenant-wide default only). Signature,
-- return type, SECURITY DEFINER, and search_path are unchanged.

CREATE OR REPLACE FUNCTION platform.get_default_llm_config(p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  id             uuid,
  provider       text,
  default_model  text,
  base_url       text,
  api_key        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = platform, vault, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.provider,
    c.default_model,
    c.base_url,
    v.decrypted_secret AS api_key
  FROM platform.llm_provider_configs c
  LEFT JOIN vault.decrypted_secrets v ON v.name = c.vault_secret_name
  WHERE c.is_active  = true
    AND c.is_default = true
    AND c.domain IS NULL  -- tenant-wide default only; domain defaults are
                          -- a separate, unrelated is_default=true row now
                          -- that this tenant-wide-only helper must ignore.
    AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  ORDER BY c.updated_at DESC
  LIMIT 1;
END;
$$;
