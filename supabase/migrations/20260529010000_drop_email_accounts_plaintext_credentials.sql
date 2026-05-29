-- Phase 1 Slice C — drop the four plaintext credential columns
-- (access_token, refresh_token, smtp_password, imap_password) and the
-- long-unused pop3_password on public.email_accounts. Vault + core.secrets
-- are the canonical store from here on, accessed via the SECURITY DEFINER
-- helpers core.read_email_account_credential / core.write_email_account_credential
-- (migration 20260528250000).
--
-- Applied 2026-05-29 after all 4 reader/writer edge functions deployed
-- (send-email, sync-emails, sync-emails-v2, exchange-oauth-token) and the
-- 20260528260000 column NULL-out ran with zero parity orphans. Unparked
-- ahead of the recommended 30-day no-direct-read window after an
-- in-repo audit confirmed no remaining direct column reads outside the
-- transition-window fallbacks (those vanish in the same commit that
-- trims the EmailAccount TS interface).
--
-- Sequence of related changes shipping together:
--   - supabase/functions/sync-emails-v2/utils/db.ts — EmailAccount
--     interface loses access_token / refresh_token / imap_password /
--     pop3_password / password (the "decrypted helper" comment field).
--   - supabase/functions/_shared/email-credentials.ts callsites — every
--     `fallback: account.xxx ?? null` arg removed; vault is the only
--     source going forward.
--   - src/components/email/EmailAccounts.tsx — local EmailAccount
--     interface loses access_token; UI gates on connectedAccountIds
--     populated from core.my_oauth_connected_email_accounts() (added
--     in migration 20260529000000).
--   - src/integrations/supabase/types.ts regenerated against prod to
--     reflect the dropped columns.
--
-- pop3_host / pop3_port / pop3_use_ssl / pop3_username /
-- pop3_delete_policy columns are intentionally left in place: only the
-- credential columns are dropped here. A future PR can prune the rest of
-- the pop3_* metadata once the UI strips the POP3 provider option.

ALTER TABLE public.email_accounts
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token,
  DROP COLUMN IF EXISTS smtp_password,
  DROP COLUMN IF EXISTS imap_password,
  DROP COLUMN IF EXISTS pop3_password;

-- Drop the no-longer-needed parity helper too. Its body queries the
-- columns we just dropped, so leaving it in place would produce a broken
-- function definition (PostgreSQL would just error on call). The vault
-- + core.secrets state is the steady-state truth from now on; we don't
-- need to reconcile against a column that doesn't exist.
DROP FUNCTION IF EXISTS core.email_accounts_secret_parity();
