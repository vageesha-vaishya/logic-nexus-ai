-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516030101; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Helper called by the Python worker LLM gateway to resolve provider + key in one query.
-- Returns NULL if no active default config exists (caller falls back to env vars).
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
    AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
  ORDER BY c.updated_at DESC
  LIMIT 1;
END;
$$;
