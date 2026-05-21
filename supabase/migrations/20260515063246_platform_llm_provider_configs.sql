-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515063246; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- ====================================================================
-- Per-tenant LLM provider configs.
-- ADR-024 §1+§2: provider preference is configurable; tenants can plug in
-- their own keys without code changes.
--
-- API keys live in supabase_vault (encrypted). This table stores only
-- non-secret metadata + the vault secret name to look up.
-- ====================================================================

CREATE TABLE platform.llm_provider_configs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider          text NOT NULL CHECK (provider IN ('anthropic','openai','gemini','openrouter','local-qwen','custom')),
  display_name      text NOT NULL,                  -- e.g. "OpenRouter Personal Account"
  base_url          text,                            -- override; null = provider default
  default_model     text NOT NULL,                   -- e.g. "anthropic/claude-sonnet-4-5" (openrouter format) or "claude-sonnet-4-5" (anthropic native)
  vault_secret_name text NOT NULL,                   -- name in vault.decrypted_secrets
  is_active         boolean NOT NULL DEFAULT true,
  is_default        boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_used_at      timestamptz,
  metadata          jsonb NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, provider, display_name)
);

-- Only one default per tenant
CREATE UNIQUE INDEX llm_provider_configs_one_default_per_tenant
  ON platform.llm_provider_configs (tenant_id)
  WHERE is_default = true;

CREATE INDEX llm_provider_configs_tenant_idx
  ON platform.llm_provider_configs (tenant_id, is_active);

-- Trigger to clear is_default on others when setting a new default
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
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_llm_configs_enforce_default
  BEFORE INSERT OR UPDATE ON platform.llm_provider_configs
  FOR EACH ROW EXECUTE FUNCTION platform.llm_configs_enforce_single_default();

-- RLS — tenant_admin / franchise_admin / platform_admin can manage their tenant's configs.
ALTER TABLE platform.llm_provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY llm_configs_tenant_admin_select ON platform.llm_provider_configs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = platform.llm_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'platform_admin'
    )
  );

CREATE POLICY llm_configs_tenant_admin_insert ON platform.llm_provider_configs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = platform.llm_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
  );

CREATE POLICY llm_configs_tenant_admin_update ON platform.llm_provider_configs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = platform.llm_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = platform.llm_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
  );

CREATE POLICY llm_configs_tenant_admin_delete ON platform.llm_provider_configs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = platform.llm_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON platform.llm_provider_configs TO authenticated;
GRANT ALL                            ON platform.llm_provider_configs TO service_role;

-- ====================================================================
-- Helper: gateway-side decryption (SECURITY DEFINER, service_role only).
-- Returns the tenant's default config (or specified provider) WITH the
-- decrypted API key. Called from the Edge Function's _shared/llm-gateway.ts.
-- ====================================================================

CREATE OR REPLACE FUNCTION platform.get_tenant_llm_config(
  p_tenant_id uuid,
  p_provider  text DEFAULT NULL
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
    AND (
      (p_provider IS NULL AND c.is_default = true)
      OR (p_provider IS NOT NULL AND c.provider = p_provider)
    )
  ORDER BY c.is_default DESC, c.created_at ASC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION platform.get_tenant_llm_config FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION platform.get_tenant_llm_config TO service_role;

COMMENT ON FUNCTION platform.get_tenant_llm_config IS
  'Gateway helper. SECURITY DEFINER + service_role-only. Returns the tenant active LLM provider config WITH the decrypted API key. Never expose to clients.';