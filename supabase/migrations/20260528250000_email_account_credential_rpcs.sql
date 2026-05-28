-- Phase 1 Slice C tail — RPCs for reading + rotating email-account credentials
-- Per master design doc §2.7 + comms-infrastructure.md §3 G-CR-1
--
-- Edge functions (send-email, sync-emails-v2, sync-emails, exchange-oauth-token)
-- read SMTP/IMAP passwords and OAuth tokens directly off
-- public.email_accounts today. Phase 1 Slice C backfilled those values into
-- vault.secrets + core.secrets (migration 20260528220000); these two RPCs
-- give the edge functions a single security-definer path to read the
-- vault-stored value and to rotate it on refresh, so the plaintext columns
-- on email_accounts can be NULLed (next migration) and eventually dropped.
--
-- The functions only operate on subject_kind='comms.email_account'. Any
-- other subject_kind raises so accidental misuse from other callers fails
-- loudly.

CREATE OR REPLACE FUNCTION core.read_email_account_credential(
  p_account_id  uuid,
  p_purpose     text
) RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = core, vault, pg_catalog
AS $$
DECLARE
  v_vault_name text;
  v_secret     text;
BEGIN
  IF p_purpose NOT IN (
    'oauth_access_token','oauth_refresh_token','smtp_password','imap_password'
  ) THEN
    RAISE EXCEPTION 'core.read_email_account_credential: unsupported purpose %', p_purpose;
  END IF;

  SELECT vault_secret_name INTO v_vault_name
  FROM   core.secrets
  WHERE  subject_kind = 'comms.email_account'
    AND  subject_id   = p_account_id
    AND  purpose      = p_purpose
    AND  is_active    = true
  LIMIT  1;

  IF v_vault_name IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM   vault.decrypted_secrets
  WHERE  name = v_vault_name
  LIMIT  1;

  -- update last_accessed_at for observability — best-effort, never fail the read
  BEGIN
    UPDATE core.secrets
    SET    last_accessed_at = now()
    WHERE  subject_kind = 'comms.email_account'
      AND  subject_id   = p_account_id
      AND  purpose      = p_purpose
      AND  is_active    = true;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_secret;
END;
$$;

COMMENT ON FUNCTION core.read_email_account_credential IS
  'Returns the decrypted credential value from vault for a (email_account, purpose). NULL when no active secret exists. Touches last_accessed_at as a side effect.';

GRANT EXECUTE ON FUNCTION core.read_email_account_credential(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION core.write_email_account_credential(
  p_account_id   uuid,
  p_purpose      text,
  p_value        text,
  p_tenant_id    uuid       DEFAULT NULL,
  p_expires_at   timestamptz DEFAULT NULL,
  p_metadata     jsonb      DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, vault, pg_catalog
AS $$
DECLARE
  v_vault_name  text;
  v_suffix      text;
BEGIN
  IF p_purpose NOT IN (
    'oauth_access_token','oauth_refresh_token','smtp_password','imap_password'
  ) THEN
    RAISE EXCEPTION 'core.write_email_account_credential: unsupported purpose %', p_purpose;
  END IF;
  IF p_value IS NULL OR p_value = '' THEN
    RAISE EXCEPTION 'core.write_email_account_credential: value is required (purpose=%)', p_purpose;
  END IF;

  -- Deactivate any prior active secret for this (account, purpose) tuple
  -- so the unique-active partial index stays clean.
  UPDATE core.secrets
  SET    is_active = false
  WHERE  subject_kind = 'comms.email_account'
    AND  subject_id   = p_account_id
    AND  purpose      = p_purpose
    AND  is_active    = true;

  -- vault.secrets enforces unique `name`. Re-rotations get a timestamp
  -- suffix so the deactivated old row can stay in vault unchanged. (A
  -- future cleanup job purges deactivated rows after a retention window.)
  v_vault_name := 'email_account_' || p_account_id::text || '_' || p_purpose;
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = v_vault_name) THEN
    v_suffix     := '_v' || extract(epoch from clock_timestamp())::bigint::text;
    v_vault_name := v_vault_name || v_suffix;
  END IF;

  PERFORM vault.create_secret(
    p_value,
    v_vault_name,
    'core.write_email_account_credential (' || p_purpose || ')'
  );

  INSERT INTO core.secrets (
    tenant_id, vault_secret_name, purpose, subject_kind, subject_id,
    is_active, created_at, expires_at, rotated_at, metadata
  ) VALUES (
    p_tenant_id, v_vault_name, p_purpose, 'comms.email_account', p_account_id,
    true, now(), p_expires_at,
    CASE WHEN p_purpose IN ('oauth_access_token','oauth_refresh_token') THEN now() ELSE NULL END,
    p_metadata
  );
END;
$$;

COMMENT ON FUNCTION core.write_email_account_credential IS
  'Stores (or rotates) an email-account credential in vault and core.secrets. Deactivates any prior active row for the same (account, purpose). Used by exchange-oauth-token and the OAuth refresh paths in send-email/sync-emails*.';

GRANT EXECUTE ON FUNCTION core.write_email_account_credential(uuid, text, text, uuid, timestamptz, jsonb)
  TO service_role;
