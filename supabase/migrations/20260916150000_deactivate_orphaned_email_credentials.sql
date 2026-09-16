-- supabase/migrations/20260916150000_deactivate_orphaned_email_credentials.sql
--
-- One-time remediation: deactivate the 12 core.secrets rows created by
-- migration 20260528220000_backfill_email_accounts_to_core_secrets.sql
-- that were never actually backed by a real vault.secrets row. See
-- docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md
-- and docs/superpowers/reports/2026-09-16-orphaned-email-credentials-report.md
-- for the full incident writeup and the affected accounts/users.
--
-- Deactivating (not deleting) preserves the historical record. The guard
-- trigger from migration 20260916140000_secrets_require_vault_parity_trigger.sql
-- never blocks setting is_active = false.
--
-- Pinned to exactly these 12 (subject_id, purpose) pairs -- not a dynamic
-- sweep -- so this migration's effect is fully predictable and
-- reviewable, and won't touch any future, different orphan.

UPDATE core.secrets
SET    is_active = false
WHERE  subject_kind = 'comms.email_account'
  AND  is_active    = true
  AND  (subject_id, purpose) IN (
    ('a463d42b-b145-4bbf-b7ac-a89eb55c1d74'::uuid, 'imap_password'),
    ('a463d42b-b145-4bbf-b7ac-a89eb55c1d74'::uuid, 'smtp_password'),
    ('1b2b28d5-c00e-4ec6-8909-64e0ff1f0bc7'::uuid, 'oauth_access_token'),
    ('1b2b28d5-c00e-4ec6-8909-64e0ff1f0bc7'::uuid, 'oauth_refresh_token'),
    ('8223bbbc-f789-40e1-abea-f33975f2c840'::uuid, 'oauth_access_token'),
    ('8223bbbc-f789-40e1-abea-f33975f2c840'::uuid, 'oauth_refresh_token'),
    ('25694c95-3d3f-48f2-891c-01c17df5746e'::uuid, 'smtp_password'),
    ('25694c95-3d3f-48f2-891c-01c17df5746e'::uuid, 'imap_password'),
    ('1710a975-044f-4881-b565-6fa3e0b6417d'::uuid, 'imap_password'),
    ('1710a975-044f-4881-b565-6fa3e0b6417d'::uuid, 'smtp_password'),
    ('bb193040-e8ef-408b-be7c-3968aa0723e8'::uuid, 'smtp_password'),
    ('bb193040-e8ef-408b-be7c-3968aa0723e8'::uuid, 'imap_password')
  );
