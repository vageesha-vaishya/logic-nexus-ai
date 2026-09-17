# SMTP/IMAP Credential Save & Test Fix — Design

## Background

Discovered live today while helping a real account owner fall back to
SMTP/IMAP for two Office 365 accounts whose OAuth is unconfigured
(`Bahuguna.vimal@outlook.com`, `vimal_s390@hotmail.com`). After filling
in host/port and typing a real app password, clicking "Save Account"
failed with:

```
Could not find the 'imap_password' column of 'email_accounts' in the schema cache
```

### Root cause

`src/features/module-communications/components/email/EmailAccountDialog.tsx`'s
`handleSave` (lines 124-180) — the only code path reachable from the
"Save Account" button, which only renders for providers where
`requiresOAuth` is `false` (currently only the SMTP/IMAP provider;
Gmail/Office 365 always render "Connect with ..." buttons that call
`handleConnect` instead) — does this:

```ts
const accountData = {
  user_id: context.userId,
  tenant_id: context.tenantId,
  franchise_id: context.franchiseId,
  provider: providerId,
  ...formConfig
};

let error;
if (account) {
  const { error: updateError } = await supabase
    .from("email_accounts")
    .update(accountData)
    .eq("id", account.id);
  error = updateError;
} else {
  const { error: insertError } = await supabase
    .from("email_accounts")
    .insert(accountData);
  error = insertError;
}
```

`formConfig` is driven by `SmtpImapProvider.getConfigFields()`
(`src/services/email/plugins/SmtpImapProvider.ts`), which includes
`smtp_password` and `imap_password` as plain `type: 'password'` form
fields alongside the still-valid columns (`smtp_host`, `smtp_port`,
`smtp_username`, `smtp_use_tls`, `imap_host`, `imap_port`,
`imap_username`, `imap_use_ssl`, `display_name`, `email_address`,
`is_primary`). The whole `formConfig` — credentials included — gets
spread directly into a **browser-side** `.update()`/`.insert()` against
`public.email_accounts`.

But `smtp_password`, `imap_password` (and `access_token`,
`refresh_token`, `pop3_password`) were dropped from
`public.email_accounts` by migration
`20260529010000_drop_email_accounts_plaintext_credentials.sql` (Phase 1
Slice C), which moved all email-account credential storage to Supabase
Vault via two `SECURITY DEFINER` RPCs:
`core.read_email_account_credential` / `core.write_email_account_credential`
(migration `20260528250000`). Because the credential fields are mixed
into the same single `.update()`/`.insert()` call as the still-valid
columns, the **entire call fails atomically** — nothing saves, not even
the host/port fields that would otherwise be fine on their own.

**Confirmed live, via direct production DB query:** no SMTP/IMAP-provider
email account in this deployment has successfully saved credentials
through this dialog since 2026-05-29. Every credential row in
`core.secrets` for every SMTP/IMAP-provider account — including one
shown in the UI as "Active" with a real "Last synced" timestamp
(`vimal.bahuguna@miapps.co`) — traces back to a one-time backfill
migration from 2026-05-28, the day before the columns were dropped.

### A second, identical-root-cause bug: "Test IMAP Connection"

`src/features/module-communications/components/email/EmailAccounts.tsx`'s
`testImap` (lines 179-208):

```ts
const acc = accounts.find(a => a.id === accountId) as any;
...
if (!acc.imap_host || !acc.imap_username || !acc.imap_password) {
  toast({ title: "Missing IMAP settings", ... });
  return;
}
const result: any = await invokeAnonymous("verify-email-credentials", {
  imap: { host: acc.imap_host, port: acc.imap_port || 993,
          username: acc.imap_username || acc.email_address,
          password: acc.imap_password, secure: acc.imap_use_ssl ?? true }
});
```

`acc` comes from `fetchAccounts`'s plain `select("*")` against
`email_accounts` — which no longer has an `imap_password` column, so
`acc.imap_password` is always `undefined` and the guard always fires
`"Missing IMAP settings"`, regardless of whether credentials were ever
saved. This button has been silently dead since the same 2026-05-29
migration. In scope for this fix (confirmed with the project owner):
same root cause, same feature area, and shipping a working Save button
next to a still-broken Test button would be a confusing half-fix.

### The correct pattern already exists in this codebase

`supabase/functions/exchange-oauth-token/index.ts` (the OAuth
connect/re-authorize path) already does this correctly: it writes
non-credential fields to `email_accounts`, then persists tokens via
`setEmailCredential()` (`supabase/functions/_shared/email-credentials.ts`),
which wraps `core.write_email_account_credential`. That RPC deactivates
any prior active row for the `(account_id, purpose)` and inserts a fresh
active one — the same RPC (and the same partial-unique-index-on-active-rows
constraint) that was central to the orphaned-vault-credentials incident
fixed earlier today
(`docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md`).
`setEmailCredential`'s purpose enum already includes `"smtp_password"` and
`"imap_password"` — first-class supported purposes that simply have no
caller for the manual-entry flow today.

### Why the frontend can't call the vault RPCs directly

Checked live against production:

```
core.write_email_account_credential: EXECUTE granted to supabase_admin, service_role only
core.read_email_account_credential:  EXECUTE granted to supabase_admin, service_role only
```

Neither RPC grants `EXECUTE` to `authenticated`. A direct
`supabase.rpc()` call from the browser with the user's own session would
fail outright. Any fix must go through a server-side edge function using
the service-role client — the same shape as `exchange-oauth-token`.

Also confirmed: `core.write_email_account_credential` performs **no**
ownership/tenant validation of `p_account_id` itself — it fully trusts
the caller, by design, since only `service_role`/`supabase_admin` can
invoke it. That means the new edge functions below are the only place
enforcing that a caller can only touch accounts in their own tenant.

## Goal

Make SMTP/IMAP account credential save and connection testing actually
work, by routing both through new, tenant-scoped, authenticated edge
functions that write/read credentials via the vault — mirroring the
already-correct OAuth path.

## Architecture

Two new edge functions, following this codebase's one-function-per-verb
convention (`exchange-oauth-token`, `discover-email-settings`,
`verify-email-credentials` are each single-purpose).

### 1. `supabase/functions/save-smtp-imap-account/index.ts`

Replaces `EmailAccountDialog.tsx`'s direct `email_accounts`
`.update()`/`.insert()` for the SMTP/IMAP save path.

**Request** (`POST`, `Authorization: Bearer <user JWT>`):
```ts
{
  accountId?: string;      // present = update, absent = create
  provider: string;        // "smtp_imap" today; passed through, not hardcoded
  display_name: string;
  email_address: string;
  is_primary: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password: string;
  imap_use_ssl: boolean;
}
```

**Behavior:**
1. `requireAuth(req)` — 401 if missing/invalid.
2. Validate required fields (`display_name`, `email_address`,
   `smtp_host`, `smtp_port`, `smtp_username`, `smtp_password`,
   `imap_host`, `imap_port`, `imap_username`, `imap_password`) present
   and non-empty — 400 with a specific missing-field message otherwise.
3. Resolve the caller's `tenant_id`/`franchise_id` via
   `SELECT tenant_id, franchise_id FROM user_roles WHERE user_id = <auth
   user.id> LIMIT 1` (same lookup `exchange-oauth-token` already does,
   but keyed off the *verified* JWT's `user.id`, not a client-supplied
   field — see Global Constraints).
4. **Update case** (`accountId` present): `SELECT tenant_id FROM
   email_accounts WHERE id = accountId`. If no row, or its `tenant_id`
   doesn't match the caller's, return 404 (don't distinguish
   not-found from wrong-tenant in the response — avoid leaking
   existence). Otherwise `UPDATE email_accounts SET display_name=...,
   email_address=..., is_primary=..., provider=..., smtp_host=...,
   smtp_port=..., smtp_username=..., smtp_use_tls=..., imap_host=...,
   imap_port=..., imap_username=..., imap_use_ssl=..., updated_at=now()
   WHERE id = accountId` (no credential columns — they don't exist).
5. **Create case** (`accountId` absent): `INSERT INTO email_accounts
   (user_id, tenant_id, franchise_id, provider, display_name,
   email_address, is_primary, smtp_host, smtp_port, smtp_username,
   smtp_use_tls, imap_host, imap_port, imap_username, imap_use_ssl,
   is_active) VALUES (...)` — `user_id` is the authenticated caller's
   `user.id`; `is_active: true`. Returns the new row's `id`.
6. Call `setEmailCredential(supabaseAdmin, { account_id, purpose:
   "smtp_password", value: smtp_password, tenant_id }, logger)` and the
   same for `imap_password`. If either returns `{ ok: false }`, include
   a warning in the response (the account row itself already saved
   successfully at this point — see Error Handling).
7. Return `{ data: { id: accountId }, error: null }` on success.

### 2. `supabase/functions/test-email-account-credentials/index.ts`

Replaces `EmailAccounts.tsx`'s `testImap` reading a nonexistent local
password field.

**Request** (`POST`, `Authorization: Bearer <user JWT>`):
```ts
{ accountId: string }
```

**Behavior:**
1. `requireAuth(req)` — 401 if missing/invalid.
2. Resolve caller's `tenant_id` via `user_roles`, same as above.
3. `SELECT tenant_id, imap_host, imap_port, imap_username,
   imap_use_ssl, email_address FROM email_accounts WHERE id =
   accountId`. 404 if missing or tenant mismatch.
4. If `imap_host` or `imap_username` is null, return `{ success: false,
   error: "IMAP host/username not configured for this account." }`
   (mirrors the dialog's own "Missing IMAP settings" wording, now
   accurate instead of always-false).
5. `getEmailCredential(supabaseAdmin, { account_id: accountId, purpose:
   "imap_password" })` — no `fallback` argument (there is no plaintext
   column to fall back to anymore). If `null`, return `{ success: false,
   error: "No IMAP password saved for this account yet — save your
   SMTP/IMAP credentials first." }` — a distinct message from a real
   connection failure, so the user isn't misled into thinking their
   password is wrong when it was never saved.
6. Otherwise call `verify-email-credentials` server-to-server via
   `supabaseAdmin.functions.invoke("verify-email-credentials", { body:
   { imap: { host: imap_host, port: imap_port || 993, username:
   imap_username || email_address, password: <vault value>, secure:
   imap_use_ssl ?? true } } })` and pass its `{ success, message?,
   error? }` response straight through. `verify-email-credentials`
   itself is unchanged — it's already a clean, provider-agnostic "test
   these raw credentials" utility that never touches the DB.

### Frontend changes

**`EmailAccountDialog.tsx`'s `handleSave`:** replace the
`supabase.from("email_accounts").update()/.insert()` block with:
```ts
const { data, error } = await invokeFunction("save-smtp-imap-account", {
  body: { accountId: account?.id, provider: providerId, ...formConfig },
});
if (error) throw error;
```
Everything before it (the `provider.validateConfig()` call, the
`saving` state, the success/error toasts) is unchanged.

**`EmailAccounts.tsx`'s `testImap`:** replace the body with:
```ts
const acc = accounts.find(a => a.id === accountId) as any;
if (!acc) { toast({ title: "Error", description: "Account not found", variant: "destructive" }); return; }
const { data, error } = await invokeFunction("test-email-account-credentials", {
  body: { accountId },
});
if (error) { toast({ title: "IMAP Test Failed", description: error.message, variant: "destructive" }); return; }
if (data?.success) {
  toast({ title: "IMAP OK", description: data?.message || "Connection successful" });
} else {
  toast({ title: "IMAP Test Failed", description: data?.error || "Connection failed", variant: "destructive" });
}
```
The local pre-check on `acc.imap_host`/`acc.imap_username` is dropped —
the edge function now does that check server-side with an accurate
error message; the local `accounts` state never had the password to
check anyway.

### Registration (both new functions)

Both must be added to:
- `supabase/functions/main/function_importers.ts` (alphabetical) —
  omitting this is exactly what caused today's earlier
  `exchange-oauth-token` "function not found" bug.
- `supabase/functions/main/verify_jwt_map.ts`, entry `false` for each
  (matching `exchange-oauth-token`'s pattern: platform-level JWT
  enforcement disabled, `requireAuth()` called manually inside for a
  controlled 401 JSON response shape instead of a generic gateway
  rejection).
- `supabase/config.toml`, `verify_jwt = false` for each (the source of
  truth `verify_jwt_map.ts` is snapshotting, per that file's own header
  comment).

## Error Handling

- Missing/invalid auth → `401 { error: "Unauthorized" }`.
- Missing required fields → `400` with the specific missing field
  named.
- Unknown `accountId`, or one belonging to a different tenant → `404`,
  generic message.
- `setEmailCredential` failure after the account row already saved →
  the account row's non-credential fields (host/port/etc.) are already
  persisted at this point; return `{ data: { id }, error: {message:
  "Account saved, but credential storage failed: <detail>. Please try
  saving again." } }` so the frontend surfaces a clear partial-failure
  toast rather than a silent success. No cross-statement transaction
  wraps the account-row write and the two vault writes — this matches
  `exchange-oauth-token`'s existing (non-transactional) precedent for
  the identical account-row-then-vault-writes shape; not introducing
  new risk, not over-engineering beyond what the reference
  implementation already does.
- Test path with credentials never saved → distinct message (see
  above), not a generic "connection failed".
- `verify-email-credentials` unreachable / throws → caught and
  surfaced as `{ success: false, error: "Connection test failed: <detail>" }`.

## Non-Goals

- **Fixing `exchange-oauth-token`'s own looser auth pattern** (it
  trusts a client-supplied `userId` field rather than deriving it from
  the verified JWT). The two new functions in this fix use the
  *stricter*, correct pattern (derive `tenant_id` from the verified
  `user.id`), but going back to tighten the older function is separate,
  unrelated work.
- **Rate-limiting or authenticating `verify-email-credentials`
  itself.** It's called via `invokeAnonymous` today and stays that way;
  the new `test-email-account-credentials` function is the
  authenticated, tenant-scoped gate in front of it for the
  account-based test flow. A general hardening pass on
  `verify-email-credentials`'s own exposure is out of scope.
- **Configuring Office 365 OAuth**, or any other unrelated
  email-account bug surfaced earlier today. Out of scope for this fix.
- **A generic "credential save" abstraction for future providers.**
  Only `smtp_imap` has credential fields today; `save-smtp-imap-account`
  is scoped to that shape. If a future non-OAuth provider needs the
  same treatment, extend then — not speculatively now.

## Testing

- Extend `src/features/module-communications/components/email/EmailAccountDialog.test.tsx`
  (created by today's earlier await-fix) with cases for the new
  `handleSave` path: mocks `invokeFunction` (not `supabase.from`),
  asserts `save-smtp-imap-account` is called with `accountId` +
  `formConfig` spread, asserts the success/error toasts fire correctly
  for both the create and update cases, and for a `setEmailCredential`
  partial-failure response.
- Add tests for `EmailAccounts.tsx`'s updated `testImap`: mocks
  `invokeFunction` for `test-email-account-credentials`, asserts the
  three distinct outcomes (success, connection failure, no-credentials-
  saved-yet) each produce the right toast.
- No existing edge-function-level test convention in this repo
  (`exchange-oauth-token`, `verify-email-credentials`, and
  `discover-email-settings` all have zero test files) — this fix
  doesn't introduce a new pattern unilaterally. Both new functions are
  verified live against the real deployment via a smoke test (save real
  test credentials for one of the two broken accounts, confirm
  `core.secrets` gets a fresh active row, confirm "Test IMAP Connection"
  then succeeds), the same verification approach used for every other
  fix in today's live-troubleshooting arc.

## Global Constraints

- `save-smtp-imap-account` and `test-email-account-credentials` derive
  tenant scoping from the **verified JWT's `user.id`** via `user_roles`
  — never from a client-supplied `userId`/`tenantId` field. This is
  intentionally stricter than `exchange-oauth-token`'s existing pattern
  (see Non-Goals).
- Neither new function writes to `email_accounts`' credential columns —
  those columns don't exist. Credentials go through `setEmailCredential`
  / `getEmailCredential` exclusively.
- `verify-email-credentials` is not modified.
- Both new functions must be registered in `function_importers.ts`,
  `verify_jwt_map.ts`, and `config.toml` before the deploy is considered
  complete — confirmed via the standard 4 health-check curls plus a
  router-correctness spot check (the function's own real error, not the
  router's generic 404) per `deploy/selfhosted-supabase/README.md`'s
  established procedure.
