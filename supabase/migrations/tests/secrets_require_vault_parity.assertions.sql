-- supabase/migrations/tests/secrets_require_vault_parity.assertions.sql
-- Assertions for the core.secrets vault-parity guard trigger
-- (trg_secrets_require_vault_parity / core.enforce_secrets_vault_parity).
-- Run with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this file>
-- Every block raises an exception on failure; a clean exit means all passed.

BEGIN;

DO $$
DECLARE
  v_account_id  uuid := gen_random_uuid();
  v_violation   boolean := false;
BEGIN
  -- A1: an ACTIVE row whose vault_secret_name has no matching
  -- vault.secrets row must be rejected.
  BEGIN
    INSERT INTO core.secrets
      (vault_secret_name, purpose, subject_kind, subject_id, is_active)
    VALUES
      ('zz_assert_no_vault_row', 'smtp_password', 'comms.email_account', v_account_id, true);
    v_violation := false;
  EXCEPTION WHEN OTHERS THEN
    v_violation := true;
  END;
  IF NOT v_violation THEN
    RAISE EXCEPTION 'A1 failed: an active row with no matching vault.secrets row was accepted';
  END IF;

  -- A2: an ACTIVE row whose vault_secret_name DOES have a matching
  -- vault.secrets row (created first, same transaction) must succeed --
  -- this is the path core.write_email_account_credential already uses.
  PERFORM vault.create_secret('zz-assert-value', 'zz_assert_has_vault_row', 'trigger assertion fixture');
  INSERT INTO core.secrets
    (vault_secret_name, purpose, subject_kind, subject_id, is_active)
  VALUES
    ('zz_assert_has_vault_row', 'smtp_password', 'comms.email_account', v_account_id, true);
  IF NOT EXISTS (
    SELECT 1 FROM core.secrets
    WHERE vault_secret_name = 'zz_assert_has_vault_row' AND subject_id = v_account_id
  ) THEN
    RAISE EXCEPTION 'A2 failed: an active row WITH a matching vault.secrets row was rejected';
  END IF;

  -- A3: an INACTIVE row with no matching vault.secrets row must succeed --
  -- deactivating/cleaning up an already-broken row is never blocked.
  INSERT INTO core.secrets
    (vault_secret_name, purpose, subject_kind, subject_id, is_active)
  VALUES
    ('zz_assert_inactive_no_vault_row', 'smtp_password', 'comms.email_account', v_account_id, false);
  IF NOT EXISTS (
    SELECT 1 FROM core.secrets
    WHERE vault_secret_name = 'zz_assert_inactive_no_vault_row' AND subject_id = v_account_id
  ) THEN
    RAISE EXCEPTION 'A3 failed: an inactive row with no matching vault.secrets row was rejected';
  END IF;

  RAISE NOTICE 'All core.secrets vault-parity trigger assertions passed.';
END $$;

ROLLBACK;
