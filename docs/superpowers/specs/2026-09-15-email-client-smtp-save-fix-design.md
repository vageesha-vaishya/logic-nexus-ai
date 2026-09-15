# Email Client SMTP/IMAP Save Fix — Design

## Background

Confirmed and live-reproduced in
`docs/investigation/EMAIL_CLIENT_TAB_SMTP_SAVE_BROKEN.md`: submitting the
"SMTP/IMAP Email Client" form at `/dashboard/email-management` → Email
Client fails with a live `400` from `POST .../rest/v1/email_accounts`.
Root cause: `src/features/module-communications/components/email/EmailClientSettings.tsx`'s
save handler inserts `smtp_password`/`imap_password` directly into
`public.email_accounts` — both columns were dropped by
`supabase/migrations/20260529010000_drop_email_accounts_plaintext_credentials.sql`
(applied to production 2026-05-29). No row is ever written; the account
is never created.

The read path is unaffected — every `SELECT` in this file uses `"*"`, not
an explicit column list, so it doesn't fail on the missing columns. Only
the insert is broken.

## Goal

Make the SMTP/IMAP save form actually work, using this project's existing
credential-vault infrastructure — not a new mechanism.

## Why this isn't new infrastructure

This exact problem was already solved for OAuth accounts:

- `supabase/functions/_shared/email-credentials.ts`'s `setEmailCredential()`
  wraps `core.write_email_account_credential` (migration `20260528250000`)
  and already lists `"smtp_password"`/`"imap_password"` as valid
  `EmailCredentialPurpose` values — built for exactly this case, never
  called from the SMTP/IMAP path.
- That RPC is `GRANT EXECUTE ... TO service_role` only (confirmed by
  reading the migration directly) — the frontend cannot call it. The fix
  must go through an edge function.
- `supabase/functions/exchange-oauth-token/index.ts` is the working
  precedent for the exact same shape of problem: insert the
  `email_accounts` row with metadata only, derive `tenant_id`/`franchise_id`
  server-side from the authenticated caller's own `user_roles` row (never
  trust a client-supplied tenant id, since this function runs as
  service-role and bypasses RLS), then call `setEmailCredential()` per
  secret.

## Architecture

One new edge function, `supabase/functions/create-email-client-account/index.ts`,
following `exchange-oauth-token`'s structure:

1. `requireAuth(req)` (`_shared/auth.ts`) — 401 if not signed in.
2. `SELECT tenant_id, franchise_id FROM user_roles WHERE user_id = <caller>`
   (service-role client, same as `exchange-oauth-token:157-162`) — the
   tenant/franchise this account belongs to is derived from the caller's
   own role row, never taken from the request body.
3. Insert `email_accounts`: `provider: "smtp_imap"`, `email_address`,
   `display_name`, `is_primary`, `smtp_host`/`smtp_port`/`smtp_username`/`smtp_use_tls`,
   `imap_host`/`imap_port`/`imap_username`/`imap_use_ssl`, `tenant_id`,
   `franchise_id`, `is_active: true`, `settings`. **No `smtp_password` or
   `imap_password` field** — those columns don't exist.
4. Call `setEmailCredential(supabase, { account_id: newRow.id, purpose: "smtp_password", value: <smtp.password> })`
   and again with `purpose: "imap_password"`.
5. **If either credential write fails:** delete the just-inserted
   `email_accounts` row (`DELETE FROM email_accounts WHERE id = newRow.id`)
   before returning an error — an account with no working credentials is
   worse than no account, and there's no multi-statement transaction
   spanning both the table insert and the vault RPC to roll back
   automatically.
6. On success, return the created row: `{ ok: true, data: { account: {...} } }`.
   On any failure: `{ ok: false, error: string }`.

**Frontend change** — `EmailClientSettings.tsx`'s `handleSubmit` (currently
lines ~176-211): replace the direct
`scopedDb.from("email_accounts").insert(payload)` call with
`invokeFunction("create-email-client-account", { body: {...} })` — the
same helper (`@/lib/supabase-functions`) `EmailAccounts.tsx` already uses
to call `sync-emails-v2`. The request body carries exactly what the form
already collects: `display_name`, `email_address`, `is_primary`, `smtp`
(host/port/username/password/use_tls), `imap` (host/port/username/password/use_ssl),
`settings: { preset }`. **No `user_id`, `tenant_id`, or `franchise_id` in
the request body** — the edge function derives those itself (see
Architecture step 2). Success/error toast behavior, form reset, and the
account-list refresh stay exactly as they are today — only the insert
mechanism changes.

## Non-Goals

- No change to the OAuth (`gmail`/`office365`) account-creation path
  (`exchange-oauth-token`) — already correct, untouched.
- No change to how existing accounts are read/displayed, or to
  `sendTestEmail`'s existing behavior for `smtp_imap` accounts.
- The `EmailClientSettings.tsx` panel's "Domain Management" section
  (duplicating the separate "Domains" tab) — already logged as a known
  overlap in `docs/superpowers/specs/2026-09-15-email-management-ui-bugs-design.md`'s
  Non-Goals, not part of this fix.
- No change to `core.write_email_account_credential`/`read_email_account_credential`
  themselves, or their grants — used as-is.

## Testing

- `supabase/functions/create-email-client-account/index.test.ts` (new,
  following this repo's vitest convention for edge functions — mock
  `_shared/logger.ts`, `_shared/cors.ts`, `_shared/auth.ts`, and
  `_shared/email-credentials.ts`'s `setEmailCredential`):
  - Missing/invalid auth → 401, no insert attempted.
  - Happy path: insert succeeds, both `setEmailCredential` calls succeed
    (`smtp_password` then `imap_password`) → 200 with the created account.
  - `setEmailCredential` fails for `smtp_password` → the inserted row is
    deleted (assert the delete call happened with the right id) and an
    error is returned; the second `setEmailCredential` call is never made.
  - `setEmailCredential` fails for `imap_password` (the first succeeds)
    → the row is still deleted and an error returned — a half-stored
    credential is not left behind.
  - The insert payload passed to the mocked Supabase client never
    contains `smtp_password` or `imap_password` keys — the single
    strongest regression guard for the original bug.
- `src/features/module-communications/components/email/EmailClientSettings.test.tsx`
  (new — no existing test file for this component, confirmed via a
  direct search):
  - Submitting the form calls `invokeFunction("create-email-client-account", ...)`
    with a body that has no `smtp_password`/`imap_password`-as-plain-column
    shape mixed into a raw `email_accounts` insert (i.e., asserts the
    call target changed, not just that *some* network call happened).
  - Success path: toast shown, form reset, account list re-fetched
    (matching existing behavior, now via the new call).
  - Error path: toast shown with the error message, form NOT reset.

## Global Constraints

- No change to `core.write_email_account_credential`, `core.read_email_account_credential`,
  or their `GRANT EXECUTE` recipients — used exactly as they exist today.
- No behavior change to the OAuth account path, the "Configured Accounts"
  read/display logic, or `sendTestEmail` — only the SMTP/IMAP *save*
  mechanism changes.
- The new edge function must derive `tenant_id`/`franchise_id` from the
  authenticated caller's own `user_roles` row server-side — never accept
  these as client-supplied request-body fields, since the function runs
  with service-role privileges and bypasses RLS.
- A credential-write failure after the account row is inserted must
  delete that row before returning an error — never leave a
  half-configured account with no stored password.
