-- ====================================================================
-- Close a key-leak in platform.get_default_llm_config.
--
-- Called with p_tenant_id = NULL (or omitted, its default), the previous
-- definition's WHERE clause `(p_tenant_id IS NULL OR c.tenant_id =
-- p_tenant_id)` matched every tenant's default config, and `ORDER BY
-- c.updated_at DESC LIMIT 1` returned whichever tenant happened to have the
-- most recently updated row -- an arbitrary tenant's DECRYPTED LLM API key.
--
-- This was directly reachable, not just theoretical: EXECUTE on this
-- SECURITY DEFINER function was granted to PUBLIC (verified in production
-- via information_schema.routine_privileges), and `platform` is one of the
-- schemas PostgREST exposes (PGRST_DB_SCHEMAS includes `platform`). Any
-- caller holding the public anon key -- embedded in every frontend bundle,
-- not a secret -- could POST .../rest/v1/rpc/get_default_llm_config with
-- Content-Profile: platform and an empty body and receive a random
-- tenant's decrypted provider API key.
--
-- Fix: a NULL tenant_id now returns no rows, mirroring
-- platform.get_tenant_llm_config's existing guard (see
-- 20260906120000_llm_provider_configs_domain.sql). Lock EXECUTE down to
-- service_role, matching that same function's grants. Signature and return
-- type are unchanged, so CREATE OR REPLACE is safe here (unlike
-- get_tenant_llm_config, which needed DROP+CREATE only because its
-- parameter list grew).
--
-- No current caller passes NULL, or calls this function at all:
-- services/markets-worker was the last caller and was moved onto
-- get_tenant_llm_config in the same work that surfaced this issue. It is
-- kept (not dropped) pending the broader AI/LLM audit's decision on its
-- fate -- see docs/superpowers/plans/2026-09-06-platform-llm-provider-settings-FOLLOWUPS.md#3.
-- ====================================================================

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
  IF p_tenant_id IS NULL THEN
    RETURN;
  END IF;

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
    AND c.tenant_id = p_tenant_id
  ORDER BY c.updated_at DESC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION platform.get_default_llm_config(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION platform.get_default_llm_config(uuid) TO service_role;

COMMENT ON FUNCTION platform.get_default_llm_config(uuid) IS
  'SECURITY DEFINER, service_role-only. Returns the tenant-wide default LLM '
  'provider config WITH the decrypted API key for one tenant. A NULL '
  'p_tenant_id returns no rows -- previously returned an arbitrary tenant''s '
  'row, a key-leak fixed 2026-09-09. Never expose to clients.';
