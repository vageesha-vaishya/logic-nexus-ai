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
  v_errm        text;
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
    v_errm := SQLERRM;
    v_violation := (v_errm LIKE '%refusing to activate a row with no matching vault.secrets row%');
  END;
  IF NOT v_violation THEN
    RAISE EXCEPTION 'A1 failed: an active row with no matching vault.secrets row was accepted, or was rejected for the wrong reason (%)', v_errm;
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

  -- A4: an ACTIVE row backed by a real vault secret can be deactivated
  -- via UPDATE -- this is the exact operation Task 3's remediation
  -- migration performed against production, previously untested (A1-A3
  -- only exercised INSERT).
  PERFORM vault.create_secret('zz-assert-value-2', 'zz_assert_update_path', 'trigger assertion fixture (UPDATE path)');
  INSERT INTO core.secrets
    (vault_secret_name, purpose, subject_kind, subject_id, is_active)
  VALUES
    ('zz_assert_update_path', 'smtp_password', 'comms.email_account', v_account_id, true);

  UPDATE core.secrets
  SET    is_active = false
  WHERE  vault_secret_name = 'zz_assert_update_path' AND subject_id = v_account_id;

  IF NOT EXISTS (
    SELECT 1 FROM core.secrets
    WHERE vault_secret_name = 'zz_assert_update_path' AND subject_id = v_account_id AND is_active = false
  ) THEN
    RAISE EXCEPTION 'A4 failed: UPDATE deactivating an active row (with a real vault secret) was rejected or did not apply';
  END IF;

  -- A5: deleting a vault.secrets row that is still referenced by an
  -- ACTIVE core.secrets row must be rejected (new I1 guard trigger,
  -- symmetric to the core.secrets guard above).
  PERFORM vault.create_secret('zz-assert-value-3', 'zz_assert_vault_delete_guard', 'trigger assertion fixture (vault delete guard)');
  INSERT INTO core.secrets
    (vault_secret_name, purpose, subject_kind, subject_id, is_active)
  VALUES
    ('zz_assert_vault_delete_guard', 'smtp_password', 'comms.email_account', v_account_id, true);

  BEGIN
    DELETE FROM vault.secrets WHERE name = 'zz_assert_vault_delete_guard';
    v_violation := false;
  EXCEPTION WHEN OTHERS THEN
    v_errm := SQLERRM;
    v_violation := (v_errm LIKE '%still referenced by an active core.secrets row%');
  END;
  IF NOT v_violation THEN
    RAISE EXCEPTION 'A5 failed: deleting a vault secret still referenced by an active core.secrets row was accepted, or was rejected for the wrong reason (%)', v_errm;
  END IF;

  -- A6: after deactivating the core.secrets row, deleting the same vault
  -- secret must succeed -- cleanup of a properly-retired credential is
  -- never blocked.
  UPDATE core.secrets SET is_active = false
  WHERE vault_secret_name = 'zz_assert_vault_delete_guard' AND subject_id = v_account_id;

  DELETE FROM vault.secrets WHERE name = 'zz_assert_vault_delete_guard';
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'zz_assert_vault_delete_guard') THEN
    RAISE EXCEPTION 'A6 failed: deleting a vault secret for an already-deactivated core.secrets row was rejected';
  END IF;

  RAISE NOTICE 'All core.secrets vault-parity trigger assertions passed.';
END $$;

ROLLBACK;
