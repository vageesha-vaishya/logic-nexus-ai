-- supabase/migrations/20260916130000_redeploy_email_accounts_secret_parity.sql
--
-- Redeploys core.email_accounts_secret_parity(), which was defined in
-- migration 20260528220000_backfill_email_accounts_to_core_secrets.sql
-- but is confirmed absent from production (calling it errors with
-- "function does not exist" -- never actually deployed, or dropped by
-- an untracked later change).
--
-- Its original definition checked plaintext columns on
-- public.email_accounts (access_token, refresh_token, smtp_password,
-- imap_password) that no longer exist -- they were permanently dropped
-- by migration 20260529010000_drop_email_accounts_plaintext_credentials.sql.
-- This version checks what actually matters now: for every ACTIVE
-- comms.email_account row in core.secrets, does its vault_secret_name
-- point to a real, readable vault.secrets row?
--
-- See docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md
-- for the incident this reconciliation function exists to detect.

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
  SELECT
    s.subject_id,
    s.purpose,
    s.vault_secret_name,
    EXISTS (
      SELECT 1 FROM vault.secrets v WHERE v.name = s.vault_secret_name
    )
  FROM core.secrets s
  WHERE s.subject_kind = 'comms.email_account'
    AND s.is_active    = true;
$$;

COMMENT ON FUNCTION core.email_accounts_secret_parity IS
  'Reconciliation: every ACTIVE comms.email_account row in core.secrets, and whether its vault_secret_name is actually backed by a real vault.secrets row. A false has_vault_secret means the application believes this credential exists but cannot actually read it -- see docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md.';

GRANT EXECUTE ON FUNCTION core.email_accounts_secret_parity() TO service_role;
