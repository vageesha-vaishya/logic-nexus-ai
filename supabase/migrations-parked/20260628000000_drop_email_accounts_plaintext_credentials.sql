-- ⚠ PARKED — DO NOT APPLY YET
-- Lives in supabase/migrations-parked/ so the supabase CLI never picks
-- it up automatically. Read supabase/migrations-parked/README.md for the
-- unpark lifecycle.
--
-- Phase 1 Slice C cleanup, final step — drop the four plaintext credential
-- columns (and the long-unused pop3_password) on public.email_accounts.
-- Per master design doc §7.2 no-break rule #1:
--
--   create new → dual-write → backfill → switch reads → 30-day
--   no-direct-read window → drop old
--
-- The earlier four steps are done by 2026-05-29 evening:
--   - core.secrets + vault.secrets (20260528140100, 20260528220000)
--   - core.{read,write}_email_account_credential RPCs (20260528250000)
--   - reader/writer cutover in send-email, sync-emails(-v2),
--     exchange-oauth-token (commit cfb50945)
--   - column-NULL migration (20260528260000) once prod edge fns deploy
--
-- This file is the last step. It cannot apply until ALL of these gates
-- clear:
--
-- ── Unpark checklist ────────────────────────────────────────────────────
--
-- 1. ✓  20260528260000 (column NULL-out) has been applied to prod, AND
--       the parity helper returns has_plaintext=false for every row:
--         SELECT bool_or(has_plaintext) FROM core.email_accounts_secret_parity();
--       must be `false` (or row count 0).
--
-- 2. ✓  A 30-day no-direct-read window has passed since #1, with no
--       production telemetry / alerts referencing access_token /
--       refresh_token / smtp_password / imap_password / pop3_password
--       column reads on public.email_accounts.
--
-- 3. ✓  Office 365 OAuth path in send-email/index.ts cut over to vault.
--       As of commit cfb50945 the Office 365 provider STILL reads
--       account.access_token and account.refresh_token directly (lines
--       ~464+). Move it to getEmailCredential / setEmailCredential
--       mirroring the Gmail provider rewrite from the same commit before
--       unparking.
--
-- 4. ✓  src/components/email/EmailAccounts.tsx — the
--       `!account.access_token` UI check that gates the "Connect" button
--       (lines ~303 and ~317) must move off the column. A small helper
--       hook (e.g. useEmailAccountConnected(account_id)) that queries
--       core.secrets for an active oauth_access_token row is the natural
--       replacement.
--
-- 5. ✓  src/integrations/supabase/types.ts regenerated AFTER this drop
--       applies so the EmailAccount row type loses the four columns.
--       Run `npm run supabase:types:gen` and commit the result in the
--       same PR as the unpark.
--
-- 6. ✓  EmailAccount TS interface in
--       supabase/functions/sync-emails-v2/utils/db.ts declares these
--       columns optional (`imap_password?: string`); remove those
--       optional fields when this drop lands so any future caller that
--       tries `account.imap_password` is a type error, not a silent
--       undefined.
--
-- Once 1–6 are checked, `git mv` this file into
-- `supabase/migrations/`, keeping the timestamp prefix (it's late enough
-- to sort after every migration that landed since), apply to local
-- (`npx supabase migration up`), and then apply to prod via MCP.

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
