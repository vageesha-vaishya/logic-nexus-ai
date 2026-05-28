-- Phase 1 Slice C tail — NULL out the four plaintext credential columns
-- on public.email_accounts after the reader/writer cutover in commit
-- cfb50945.
--
-- ⚠ Applying this on prod REQUIRES the matching edge-function deploy to
-- have shipped first. Order:
--   1. Migration 20260528250000 (RPCs) applied to prod                    ✓ done
--   2. Edge functions deployed to prod:                                    ⚠ deploy before applying this
--        - send-email
--        - sync-emails
--        - sync-emails-v2
--        - exchange-oauth-token
--      (sync-all-mailboxes + ingest-email don't touch the columns
--       directly, so they don't block this migration. They can deploy
--       on the regular cadence.)
--   3. This migration applied to prod
--
-- The column data itself was backfilled into vault on 2026-05-28 by
-- migration 20260528220000; the parity helper
-- core.email_accounts_secret_parity() confirmed has_plaintext + has_core_secret
-- on every (account, purpose) tuple before this NULL-out. Re-running that
-- helper after this migration will return has_plaintext=false +
-- has_core_secret=true for every row — that's the new steady state.
--
-- Columns stay in place (not dropped) so the schema-export.sql baseline
-- doesn't churn before all UI/admin tooling has caught up. A future PR
-- drops them after the no-direct-read window per master §7.2 rule #1.

UPDATE public.email_accounts
SET
  access_token   = NULL,
  refresh_token  = NULL,
  smtp_password  = NULL,
  imap_password  = NULL,
  pop3_password  = NULL
WHERE
  access_token  IS NOT NULL
  OR refresh_token  IS NOT NULL
  OR smtp_password  IS NOT NULL
  OR imap_password  IS NOT NULL
  OR pop3_password  IS NOT NULL;
