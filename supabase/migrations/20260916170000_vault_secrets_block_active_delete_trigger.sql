-- I1 follow-up from the final whole-branch review of
-- docs/superpowers/plans/2026-09-16-orphaned-vault-credentials-fix.md:
-- the core.secrets guard trigger (20260916140000) only fires on writes
-- to core.secrets. It cannot prevent the orphan pattern this whole
-- incident was about if it was instead caused by directly deleting a
-- vault.secrets row that a core.secrets row still points to as active
-- -- one of the root-cause hypotheses in
-- docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md
-- that could not be ruled out. This closes that gap symmetrically.

CREATE OR REPLACE FUNCTION core.enforce_vault_secret_not_referenced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, vault, pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM core.secrets
    WHERE vault_secret_name = OLD.name
      AND is_active = true
  ) THEN
    RAISE EXCEPTION
      'vault.secrets: refusing to delete secret "%" -- still referenced by an active core.secrets row',
      OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION core.enforce_vault_secret_not_referenced IS
  'Trigger function for trg_vault_secrets_block_active_delete on vault.secrets -- rejects deleting a secret still referenced by an active core.secrets row. Symmetric to core.enforce_secrets_vault_parity, which guards the other direction.';

DROP TRIGGER IF EXISTS trg_vault_secrets_block_active_delete ON vault.secrets;

CREATE TRIGGER trg_vault_secrets_block_active_delete
  BEFORE DELETE ON vault.secrets
  FOR EACH ROW
  EXECUTE FUNCTION core.enforce_vault_secret_not_referenced();
