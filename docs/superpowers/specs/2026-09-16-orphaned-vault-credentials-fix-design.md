# Orphaned Email-Account Vault Credentials — Design

## Background

Discovered while trying to verify today's two Gmail sync fixes end-to-end
in production. All 3 Gmail accounts, and one already-working SMTP/IMAP
account, failed to sync with generic errors (`"Cannot refresh token:
missing config or refresh token"`, `"IMAP Connection Failed: No password
configured"`). Root-caused by direct investigation of the self-hosted
production database — **not** a defect in either of today's Gmail sync
fixes, which are unaffected and already merged and deployed.

### Root cause

Migration `supabase/migrations/20260528220000_backfill_email_accounts_to_core_secrets.sql`
(2026-05-28, "Phase 1 Slice C") moved plaintext credentials from
`public.email_accounts`'s four plaintext columns into `supabase_vault`,
recording a pointer in `core.secrets` (`vault_secret_name`, `purpose`,
`subject_kind`, `subject_id`, `is_active`). Its per-row logic:

```sql
BEGIN
  PERFORM vault.create_secret(v_value, v_vault_name, '...');
EXCEPTION
  WHEN unique_violation THEN
    NULL; -- assumes: "vault entry exists from an earlier partial run"
END;

INSERT INTO core.secrets (...) VALUES (..., true, ...)
ON CONFLICT (vault_secret_name) DO NOTHING;
```

Querying `core.secrets JOIN vault.secrets` for every row this migration
ever created — 12 rows total, `subject_kind = 'comms.email_account'`,
spanning 6 distinct `email_accounts` across all four purposes
(`oauth_access_token`, `oauth_refresh_token`, `smtp_password`,
`imap_password`) — shows **all 12 are orphaned**: `core.secrets` says
`is_active = true` with a `vault_secret_name`, but no `vault.secrets` row
by that name exists. Confirmed these came from this migration's raw
`INSERT`, not the later, correct RPC: all 12 share the exact same
`created_at` (matching the migration's own `now()`), and `rotated_at IS
NULL` for all of them, whereas `core.write_email_account_credential`
(migration `20260528250000_email_account_credential_rpcs.sql`) always
sets `rotated_at = now()` for OAuth purposes.

The `EXCEPTION WHEN unique_violation THEN NULL` branch is architecturally
capable of producing exactly this: if `vault.create_secret` fails for a
reason other than "this exact secret already exists correctly" — or if a
vault row that existed at the time was later removed by an untracked
process — the migration's own idempotency check (`IF EXISTS (SELECT 1
FROM core.secrets WHERE vault_secret_name = v_vault_name) THEN CONTINUE`)
means even re-running it would silently skip these rows forever, since by
its own logic they "already exist."

### Confirmed live impact

Production `system_logs` (component `sync-emails-v2`) show real failures
today between 07:56–09:01 UTC for account `25694c95-3d3f-48f2-891c-01c17df5746e`
— an SMTP/IMAP account with 33 already-saved emails from whenever its
credential last worked — with exactly the error this bug predicts. This
account's `smtp_password` and `imap_password` rows are among the 12
orphaned rows. This is a live, currently-broken account, unrelated to
Gmail.

### Confirmed unrecoverable

The plaintext values this migration read from
(`public.email_accounts.access_token`, `refresh_token`, `smtp_password`,
`imap_password`) were permanently dropped by the later migration
`20260529010000_drop_email_accounts_plaintext_credentials.sql` — not
nulled, dropped. There is no source data anywhere in this database to
recover the real values from. `db.ts`'s `EmailAccount` TypeScript
interface doesn't model these columns at all, confirming they're gone.

### The correct path already exists

`core.write_email_account_credential` (same migration as the reconciliation
function below) calls `vault.create_secret` and `INSERT INTO core.secrets`
in one function body with no swallowed exceptions between them — a single
call either commits both or neither. Read directly to confirm. It's called
by `exchange-oauth-token` (Gmail/office365 OAuth) and
`create-email-client-account` (SMTP/IMAP). This fix does not change either
of those — the write path going forward is already correct. This fix
addresses (1) the 12 currently-orphaned rows, and (2) making a future
silent orphan of this *class* structurally impossible, not just this one
migration's specific bug.

## Goal

1. Deploy a reconciliation function that can detect this class of orphan
   on demand.
2. Make it structurally impossible for a future write to `core.secrets`
   to silently create an active row with no matching vault secret.
3. Clean up the 12 known-orphaned rows and produce a report identifying
   which real accounts/users are affected, so they can be proactively
   asked to re-enter or re-authorize their credentials.

## Architecture

Three independent pieces, each its own task:

### 1. Redeploy the reconciliation function

`core.email_accounts_secret_parity()` was already fully written in the
2026-05-28 backfill migration's file, but is confirmed absent from
production (`SELECT ... FROM core.email_accounts_secret_parity()` errors
with "function does not exist") — never actually deployed, or dropped by
some later untracked change. A new migration re-issues the exact same
`CREATE OR REPLACE FUNCTION` (verbatim from the original file, since its
definition is still correct — it doesn't depend on the plaintext columns
that were later dropped... **correction during design**: it *does*
reference `public.email_accounts.access_token` etc. in its `per_credential`
CTE, which no longer exist. The function must be rewritten to check
`core.secrets` against `vault.secrets` directly instead of against the
now-gone plaintext columns:

```sql
CREATE OR REPLACE FUNCTION core.email_accounts_secret_parity()
RETURNS TABLE (
  email_account_id  uuid,
  purpose           text,
  vault_secret_name text,
  has_vault_secret  boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, vault, pg_catalog
AS $$
  SELECT
    s.subject_id,
    s.purpose,
    s.vault_secret_name,
    EXISTS (SELECT 1 FROM vault.secrets v WHERE v.name = s.vault_secret_name)
  FROM core.secrets s
  WHERE s.subject_kind = 'comms.email_account'
    AND s.is_active = true;
$$;
```

Every row this returns with `has_vault_secret = false` is an active
credential the application believes exists but cannot actually be read.

### 2. Guard trigger on `core.secrets`

```sql
CREATE OR REPLACE FUNCTION core.enforce_secrets_vault_parity()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
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

CREATE TRIGGER trg_secrets_require_vault_parity
  BEFORE INSERT OR UPDATE ON core.secrets
  FOR EACH ROW
  EXECUTE FUNCTION core.enforce_secrets_vault_parity();
```

Traced every current writer of `core.secrets` (grepped the whole repo):
only `core.write_email_account_credential` (already calls
`vault.create_secret` first, in the same transaction — visible to the
trigger's check on the subsequent `INSERT`) and the old backfill migration
(a one-time historical script that won't run again). Traced every current
reader that also writes: `core.read_email_account_credential`'s
best-effort `last_accessed_at` touch is wrapped in its own
`EXCEPTION WHEN OTHERS THEN NULL`, so even if the trigger ever fires there
(only possible if a row's vault secret is deleted after creation), it's
silently absorbed exactly like any other transient error already is —
no behavior change to the read path. Deactivating a row (`is_active =
false`) never triggers the check, so cleanup (piece 3, below) is
unaffected. Only one `subject_kind` (`comms.email_account`) exists in
`core.secrets` today, so there's no other credential type this could
unexpectedly block.

### 3. Remediation: deactivate the known orphans, report the accounts

A migration deactivates exactly the 12 known-orphaned rows (matched by
their current `vault_secret_name` values, listed explicitly — not a broad
`WHERE has_vault_secret = false` sweep, so this migration's effect is
pinned to today's known set and can't accidentally deactivate a
future orphan differently). Then a report — a markdown file, not
executable code — lists the 6 affected `email_accounts` (email address,
provider, owning user) and what each owner needs to do:
SMTP/IMAP accounts need their password re-entered via the account
settings UI (`create-email-client-account`, already fixed earlier today);
Gmail accounts need to re-run Google OAuth consent (`exchange-oauth-token`).
Both paths already use the correct RPC and will be rejected loudly by the
new trigger if they somehow fail to write a real vault secret again.

**The exact 12 `(subject_id, purpose)` pairs, confirmed live in
production** (`subject_kind = 'comms.email_account'`, `is_active = true`,
no matching `vault.secrets` row):

| `subject_id` | `purpose` | account email | provider | owning user |
|---|---|---|---|---|
| `a463d42b-b145-4bbf-b7ac-a89eb55c1d74` | `imap_password` | dinusaundarya@gmail.com | gmail | admin-user-tenant001@gmail.com |
| `a463d42b-b145-4bbf-b7ac-a89eb55c1d74` | `smtp_password` | dinusaundarya@gmail.com | gmail | admin-user-tenant001@gmail.com |
| `1b2b28d5-c00e-4ec6-8909-64e0ff1f0bc7` | `oauth_access_token` | tester@gmail.com | gmail | e2e_test_1770604489753@example.com |
| `1b2b28d5-c00e-4ec6-8909-64e0ff1f0bc7` | `oauth_refresh_token` | tester@gmail.com | gmail | e2e_test_1770604489753@example.com |
| `8223bbbc-f789-40e1-abea-f33975f2c840` | `oauth_access_token` | bahuguna.vimal@gmail.com | gmail | bahuguna.vimal@gmail.com |
| `8223bbbc-f789-40e1-abea-f33975f2c840` | `oauth_refresh_token` | bahuguna.vimal@gmail.com | gmail | bahuguna.vimal@gmail.com |
| `25694c95-3d3f-48f2-891c-01c17df5746e` | `smtp_password` | vimal.bahuguna@miapps.co | smtp_imap | bahuguna.vimal@gmail.com |
| `25694c95-3d3f-48f2-891c-01c17df5746e` | `imap_password` | vimal.bahuguna@miapps.co | smtp_imap | bahuguna.vimal@gmail.com |
| `1710a975-044f-4881-b565-6fa3e0b6417d` | `imap_password` | vimal_s390@hotmail.com | office365 | admin-user-tenant001@gmail.com |
| `1710a975-044f-4881-b565-6fa3e0b6417d` | `smtp_password` | vimal_s390@hotmail.com | office365 | admin-user-tenant001@gmail.com |
| `bb193040-e8ef-408b-be7c-3968aa0723e8` | `smtp_password` | Bahuguna.vimal@outlook.com | office365 | admin-user-tenant001@gmail.com |
| `bb193040-e8ef-408b-be7c-3968aa0723e8` | `imap_password` | Bahuguna.vimal@outlook.com | office365 | admin-user-tenant001@gmail.com |

Note two accounts labeled `provider = 'office365'`
(`vimal_s390@hotmail.com`, `Bahuguna.vimal@outlook.com`) were configured
via `smtp_password`/`imap_password` rather than OAuth — plausible for
personal Microsoft accounts, which historically supported IMAP app
passwords before modern-auth enforcement; not itself a bug this fix
addresses. Similarly, `dinusaundarya@gmail.com` has `provider = 'gmail'`
but only `imap_password`/`smtp_password` secrets, no OAuth ones — this
account was apparently never actually connected via Google OAuth despite
its provider label; re-authorizing it means completing OAuth consent for
the first time, not "re-doing" something that once worked.

## Non-Goals

- **Determining exactly how/when the original vault rows disappeared.**
  No audit log or migration-tracking table exists on this self-hosted
  instance to reconstruct that history. The mechanism that makes it
  *possible* (the swallowed exception in the old, one-time backfill
  migration) is identified and documented; the specific historical event
  is not recoverable and isn't needed to fix this.
- **Actually re-entering credentials for the 6 affected accounts.** That's
  each account owner's action (a password re-entry or an OAuth consent
  flow), not a code change. This fix produces the list; a human acts on it.
- **Changing `core.write_email_account_credential`,
  `core.read_email_account_credential`, `exchange-oauth-token`, or
  `create-email-client-account`.** All four are already correct and
  unaffected.
- **A periodic/scheduled reconciliation job.** The trigger prevents the
  bug at write time, which the user preferred over (or in addition to) a
  periodic check; a cron-scheduled call to
  `core.email_accounts_secret_parity()` was considered and explicitly
  not chosen — the reconciliation function is deployed for on-demand /
  future manual use, not wired to `pg_cron`.

## Testing

New migration, new SQL functions/trigger — verified with a dedicated test
file exercising the trigger against a real (test) Postgres instance via
the project's existing Supabase local-dev setup, the same way other
schema changes in this repo are verified: apply the migration locally,
then exercise it directly with SQL assertions (no vitest/mocking needed
here — there's no TypeScript in this fix).

Required cases:
- Inserting an active `core.secrets` row whose `vault_secret_name` has no
  matching `vault.secrets` row is rejected by the trigger with a clear
  error.
- Inserting an active row whose `vault_secret_name` *does* have a
  matching `vault.secrets` row (created first, same transaction) succeeds
  — proves the trigger doesn't break the legitimate path
  `core.write_email_account_credential` already uses.
- Inserting an *inactive* (`is_active = false`) row with no matching
  vault secret succeeds — proves deactivation/cleanup isn't blocked.
- After the remediation migration runs, `core.email_accounts_secret_parity()`
  returns zero rows for the 12 previously-orphaned `(subject_id, purpose)`
  pairs (they're no longer `is_active = true`, so they drop out of the
  function's `WHERE is_active = true` filter entirely).

## Global Constraints

- No change to `core.write_email_account_credential`,
  `core.read_email_account_credential`, `exchange-oauth-token`,
  `create-email-client-account`, or any application code — SQL migrations
  only, plus one generated markdown report.
- The remediation migration must target exactly the 12 specific,
  already-identified `(subject_id, purpose)` pairs — not a dynamic
  `WHERE`-clause sweep — so its effect is fully predictable and reviewable.
- The new trigger must not block deactivating a row, or inserting/updating
  any row with `is_active = false`.
