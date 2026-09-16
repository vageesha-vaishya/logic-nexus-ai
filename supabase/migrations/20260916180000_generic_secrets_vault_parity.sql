-- I4 follow-up from the final whole-branch review: core.email_accounts_secret_parity()
-- hardcodes subject_kind = 'comms.email_account'. core.secrets.subject_kind
-- is unconstrained text and core.secrets_purpose_check already permits
-- purposes unrelated to email accounts (provider_api_key,
-- webhook_signing_secret, oauth_client_secret, encryption_key, etc.) --
-- if this table is ever used to store one of those, this reconciliation
-- capability would silently stop covering it. Adds a generic underlying
-- function; the existing email-accounts-specific function becomes a
-- thin wrapper so no existing caller needs to change.

CREATE OR REPLACE FUNCTION core.secrets_vault_parity(p_subject_kind text DEFAULT NULL)
RETURNS TABLE (
  subject_kind      text,
  subject_id        uuid,
  purpose           text,
  vault_secret_name text,
  has_vault_secret  boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, vault, pg_catalog
AS $$
  SELECT
    s.subject_kind,
    s.subject_id,
    s.purpose,
    s.vault_secret_name,
    EXISTS (
      SELECT 1 FROM vault.secrets v WHERE v.name = s.vault_secret_name
    )
  FROM core.secrets s
  WHERE s.is_active = true
    AND (p_subject_kind IS NULL OR s.subject_kind = p_subject_kind);
$$;

COMMENT ON FUNCTION core.secrets_vault_parity(text) IS
  'Reconciliation: every ACTIVE core.secrets row (optionally filtered to one subject_kind), and whether its vault_secret_name is actually backed by a real vault.secrets row. A false has_vault_secret means the application believes this credential exists but cannot actually read it. Called with no argument, covers every subject_kind currently in the table.';

REVOKE EXECUTE ON FUNCTION core.secrets_vault_parity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.secrets_vault_parity(text) TO service_role;

CREATE OR REPLACE FUNCTION core.email_accounts_secret_parity()
RETURNS TABLE (
  email_account_id  uuid,
  purpose           text,
  vault_secret_name text,
  has_vault_secret  boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, vault, pg_catalog
AS $$
  SELECT subject_id, purpose, vault_secret_name, has_vault_secret
  FROM core.secrets_vault_parity('comms.email_account');
$$;

COMMENT ON FUNCTION core.email_accounts_secret_parity IS
  'Thin wrapper over core.secrets_vault_parity(''comms.email_account'') -- kept for existing callers/docs. See docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md.';
