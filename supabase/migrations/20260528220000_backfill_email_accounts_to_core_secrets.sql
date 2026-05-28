-- Phase 1 Slice C cleanup — backfill public.email_accounts credentials into vault + core.secrets
-- Per master design doc §2.7 + comms-infrastructure.md §3 G-CR-1 + core.md §3.9
--
-- The four plaintext credential columns on public.email_accounts
-- (access_token, refresh_token, smtp_password, imap_password) are the
-- in-the-clear remnant called out as a CRITICAL gap. This migration moves
-- their values into supabase_vault (encrypted at rest) and records the
-- vault pointer + metadata in core.secrets per the new pattern.
--
-- Strategy (additive, non-destructive):
--   1. For each non-null credential on each row, vault.create_secret()
--      stores the value encrypted; the returned name is recorded in
--      core.secrets with a stable subject_kind/subject_id pointer.
--   2. The plaintext columns are LEFT IN PLACE. A follow-up migration
--      (separate PR, after code reads from vault) NULLs them out, and a
--      later one drops the columns entirely. This stage is safe to roll
--      back by deleting the inserted core.secrets/vault rows.
--
-- Idempotency:
--   - vault.create_secret enforces unique name; we use a deterministic
--     pattern '{email_accounts_id}_{purpose}' so re-running skips.
--   - core.secrets has UNIQUE (tenant_id, subject_kind, subject_id,
--     purpose) WHERE is_active=true; INSERT … ON CONFLICT DO NOTHING.
--
-- Naming: vault_secret_name is 'email_account_<uuid>_<purpose>' — long
-- enough to be globally unique across tenants, short enough to remain
-- legible in a debug listing.

DO $$
DECLARE
  rec RECORD;
  v_purpose      text;
  v_value        text;
  v_vault_name   text;
  v_metadata     jsonb;
BEGIN
  FOR rec IN
    SELECT id, tenant_id, provider, email_address,
           access_token, refresh_token, token_expires_at,
           smtp_password, imap_password
    FROM   public.email_accounts
    WHERE  access_token   IS NOT NULL
       OR  refresh_token  IS NOT NULL
       OR  smtp_password  IS NOT NULL
       OR  imap_password  IS NOT NULL
  LOOP
    v_metadata := jsonb_strip_nulls(jsonb_build_object(
      'provider',       rec.provider,
      'email_address',  rec.email_address
    ));

    -- Walk the 4 possible credentials. Same shape each time.
    FOR v_purpose, v_value IN
      SELECT *
      FROM (VALUES
        ('oauth_access_token',  rec.access_token),
        ('oauth_refresh_token', rec.refresh_token),
        ('smtp_password',       rec.smtp_password),
        ('imap_password',       rec.imap_password)
      ) AS t(purpose, value)
      WHERE value IS NOT NULL AND value <> ''
    LOOP
      v_vault_name := 'email_account_' || rec.id::text || '_' || v_purpose;

      -- Skip if already mirrored — re-runnable.
      IF EXISTS (
        SELECT 1 FROM core.secrets s
        WHERE s.vault_secret_name = v_vault_name
      ) THEN
        CONTINUE;
      END IF;

      -- vault.create_secret(value, name, description) returns the vault uuid.
      -- It enforces unique `name`; if a prior partial run inserted into
      -- vault but failed before core.secrets, the second call would error.
      -- Catch + ignore so re-runs succeed.
      BEGIN
        PERFORM vault.create_secret(
          v_value,
          v_vault_name,
          'public.email_accounts plaintext-credential backfill — Phase 1 Slice C'
        );
      EXCEPTION
        WHEN unique_violation THEN
          -- Vault entry exists from an earlier partial run; fall through
          -- so core.secrets gets the row this time.
          NULL;
      END;

      INSERT INTO core.secrets (
        tenant_id,
        vault_secret_name,
        purpose,
        subject_kind,
        subject_id,
        is_active,
        created_at,
        expires_at,
        metadata
      ) VALUES (
        rec.tenant_id,                            -- may be NULL for legacy rows; core.secrets allows it
        v_vault_name,
        v_purpose,
        'comms.email_account',
        rec.id,
        true,
        now(),
        CASE WHEN v_purpose = 'oauth_access_token' THEN rec.token_expires_at ELSE NULL END,
        v_metadata
      )
      ON CONFLICT (vault_secret_name) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Reconciliation helper: confirm every populated credential column on
-- email_accounts has a matching core.secrets row. Run after the backfill
-- and again after the future NULL-out step to make sure nothing slipped.
CREATE OR REPLACE FUNCTION core.email_accounts_secret_parity()
RETURNS TABLE (
  email_account_id     uuid,
  purpose              text,
  has_plaintext        boolean,
  has_core_secret      boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  WITH per_credential AS (
    SELECT id AS ea_id, 'oauth_access_token'::text  AS purpose, access_token   AS val FROM public.email_accounts
    UNION ALL
    SELECT id,          'oauth_refresh_token',                refresh_token         FROM public.email_accounts
    UNION ALL
    SELECT id,          'smtp_password',                       smtp_password         FROM public.email_accounts
    UNION ALL
    SELECT id,          'imap_password',                       imap_password         FROM public.email_accounts
  )
  SELECT
    p.ea_id,
    p.purpose,
    (p.val IS NOT NULL AND p.val <> '')                       AS has_plaintext,
    EXISTS (
      SELECT 1 FROM core.secrets s
      WHERE s.subject_kind = 'comms.email_account'
        AND s.subject_id   = p.ea_id
        AND s.purpose      = p.purpose
        AND s.is_active    = true
    )                                                          AS has_core_secret
  FROM per_credential p
  WHERE p.val IS NOT NULL AND p.val <> '';
$$;

COMMENT ON FUNCTION core.email_accounts_secret_parity IS
  'Reconciliation: per (email_account, purpose) tuple where plaintext is non-null, did the Slice C backfill insert a matching active core.secrets row? Both has_plaintext=true and has_core_secret=true after the backfill completes.';

GRANT EXECUTE ON FUNCTION core.email_accounts_secret_parity
  TO service_role;
