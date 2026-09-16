-- Security fix: revoke default PUBLIC EXECUTE from three core credential
-- functions that were reachable unauthenticated over PostgREST.
--
-- Discovered during the final whole-branch review of
-- docs/superpowers/plans/2026-09-16-orphaned-vault-credentials-fix.md.
-- Independently confirmed live: an unauthenticated request with only the
-- anon key returned HTTP 200 (not 401/403) from
-- core.email_accounts_secret_parity() and core.read_email_account_credential(),
-- both SECURITY DEFINER functions that bypass RLS on core.secrets.
-- core.write_email_account_credential() carries the same empty/default ACL
-- pattern (PUBLIC EXECUTE by default), so it is revoked here too even
-- though it was not separately call-tested, to close the same class of
-- exposure preemptively.
--
-- core.email_accounts_secret_parity() was introduced by this branch
-- (migration 20260916130000) and never had its PUBLIC grant revoked.
-- core.read_email_account_credential() and core.write_email_account_credential()
-- predate this branch (migration 20260528250000) and were never revoked
-- either -- this migration closes both, since this branch's own
-- remediation (Task 3) is what's about to make the exposure exploitable
-- again by asking 6 real users to repopulate the credentials these
-- functions read and write.
--
-- service_role's existing EXECUTE grants are untouched by a REVOKE
-- targeting only PUBLIC.

REVOKE EXECUTE ON FUNCTION core.email_accounts_secret_parity()                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION core.read_email_account_credential(uuid, text)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION core.write_email_account_credential(uuid, text, text, uuid, timestamptz, jsonb) FROM PUBLIC;

-- Discovered immediately after applying the REVOKEs above: production
-- never actually had the explicit `GRANT EXECUTE ... TO service_role`
-- that migration 20260528250000_email_account_credential_rpcs.sql
-- specifies for these two functions (their ACL was NULL/default before
-- this migration, not the explicit grant the file's own text shows) --
-- the same "migration file says X, production never got X" gap already
-- found for core.email_accounts_secret_parity() in Task 1 of this
-- branch. Their only working access path was the PUBLIC grant just
-- revoked above, so revoking it broke the real service_role callers
-- (sync-emails-v2, exchange-oauth-token, create-email-client-account).
-- Confirmed live: an authenticated service_role call to
-- read_email_account_credential failed with 42501 "permission denied"
-- immediately after the REVOKE, before this GRANT was added.

GRANT EXECUTE ON FUNCTION core.read_email_account_credential(uuid, text)  TO service_role;
GRANT EXECUTE ON FUNCTION core.write_email_account_credential(uuid, text, text, uuid, timestamptz, jsonb) TO service_role;
