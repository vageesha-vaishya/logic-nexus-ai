-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515082641; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- SECURITY DEFINER wrappers around supabase_vault internals.
-- These let our edge functions (which connect via PostgREST) create and delete
-- vault secrets without exposing the vault schema itself to the REST API.
--
-- Access is restricted to the service_role to prevent end-user clients from
-- minting arbitrary secrets if they ever discover the function name.

CREATE OR REPLACE FUNCTION platform.create_vault_secret(
  p_secret      text,
  p_name        text,
  p_description text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_secret IS NULL OR length(p_secret) = 0 THEN
    RAISE EXCEPTION 'secret must not be empty';
  END IF;
  IF p_name IS NULL OR length(p_name) = 0 THEN
    RAISE EXCEPTION 'name must not be empty';
  END IF;
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION platform.create_vault_secret(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION platform.create_vault_secret(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION platform.delete_vault_secret(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = p_name;
END;
$$;

REVOKE ALL ON FUNCTION platform.delete_vault_secret(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION platform.delete_vault_secret(text) TO service_role;

COMMENT ON FUNCTION platform.create_vault_secret(text, text, text)
  IS 'SECURITY DEFINER wrapper for vault.create_secret. Callable only by service_role from edge functions.';
COMMENT ON FUNCTION platform.delete_vault_secret(text)
  IS 'SECURITY DEFINER wrapper for vault secret deletion by name. service_role only.';