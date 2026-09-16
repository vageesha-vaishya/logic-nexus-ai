-- supabase/migrations/20260916140000_secrets_require_vault_parity_trigger.sql
--
-- Guard: core.secrets must never hold an ACTIVE row whose
-- vault_secret_name has no matching vault.secrets row. See
-- docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md
-- for the incident this prevents a recurrence of (a one-time backfill
-- migration inserted 12 such rows in 2026-05, none of which were ever
-- actually readable). Deactivating a row (is_active = false) is never
-- blocked, so cleanup of already-broken rows is unaffected.

CREATE OR REPLACE FUNCTION core.enforce_secrets_vault_parity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, vault, pg_catalog
AS $$
BEGIN
  IF NEW.is_active AND NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = NEW.vault_secret_name
  ) THEN
    RAISE EXCEPTION
      'core.secrets: refusing to activate a row with no matching vault.secrets row (subject_kind=%, subject_id=%, purpose=%, vault_secret_name=%)',
      NEW.subject_kind, NEW.subject_id, NEW.purpose, NEW.vault_secret_name;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION core.enforce_secrets_vault_parity IS
  'Trigger function for trg_secrets_require_vault_parity on core.secrets -- rejects activating a row whose vault_secret_name has no matching vault.secrets row.';

DROP TRIGGER IF EXISTS trg_secrets_require_vault_parity ON core.secrets;

CREATE TRIGGER trg_secrets_require_vault_parity
  BEFORE INSERT OR UPDATE ON core.secrets
  FOR EACH ROW
  EXECUTE FUNCTION core.enforce_secrets_vault_parity();
