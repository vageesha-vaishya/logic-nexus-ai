-- core.secrets.vault_secret_name had a table-wide UNIQUE constraint,
-- inconsistent with every other uniqueness rule on this table (e.g.
-- secrets_unique_active_per_purpose), which are all correctly scoped to
-- WHERE is_active = true. Discovered live today: after deactivating (not
-- deleting) the 12 orphaned credential rows from
-- docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md,
-- any new credential write for those same 6 accounts collides with the
-- deactivated row's vault_secret_name and fails with
-- "duplicate key value violates unique constraint
-- secrets_vault_secret_name_key" -- permanently blocking exactly the
-- credential re-entry/re-authorization that remediation's report asked
-- those 6 accounts' owners to do.
--
-- Confirmed safe: core.read_email_account_credential already filters by
-- is_active = true and does not rely on table-wide uniqueness; two
-- ACTIVE rows sharing a vault_secret_name for this table's actual
-- naming scheme (email_account_<id>_<purpose>) is already prevented by
-- secrets_unique_active_per_purpose. Pre-checked directly against
-- production: zero active rows currently share a vault_secret_name.

ALTER TABLE core.secrets DROP CONSTRAINT secrets_vault_secret_name_key;

CREATE UNIQUE INDEX secrets_vault_secret_name_key
  ON core.secrets (vault_secret_name)
  WHERE is_active = true;
