# Orphaned Email-Account Vault Credentials Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect the currently-orphaned `core.secrets` rows, make it structurally impossible for a future write to silently create a new one, and remediate the 12 known-orphaned rows with a report identifying the affected accounts/users.

**Architecture:** Three new Postgres migrations under `supabase/migrations/`, following this repo's existing convention: (1) redeploy `core.email_accounts_secret_parity()`, rewritten to check `core.secrets` against `vault.secrets` directly (its original definition referenced plaintext `email_accounts` columns that no longer exist); (2) a `BEFORE INSERT OR UPDATE` trigger on `core.secrets` rejecting any row with `is_active = true` and no matching `vault.secrets` row, with a matching `.assertions.sql` test file under `supabase/migrations/tests/` per this repo's existing pattern; (3) a migration deactivating exactly the 12 known-orphaned rows, plus a generated markdown report.

**Tech Stack:** PL/pgSQL (Postgres), applied and verified directly against the self-hosted production database via SSH (`ssh hostinger-vps "docker exec -i db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres ..."`) — this repo's local Supabase CLI stack was not confirmed available in this environment, and this session has already used this exact direct-verification approach repeatedly for prior fixes today. The live container name changes on recreate; re-resolve it with `ssh hostinger-vps "docker ps --format '{{.Names}}' | grep '^db-'"` before running any step below if it differs from what's shown.

## Global Constraints

- No change to `core.write_email_account_credential`, `core.read_email_account_credential`, `exchange-oauth-token`, `create-email-client-account`, or any application code — SQL migrations only, plus one generated markdown report.
- The remediation migration must target exactly the 12 specific, already-identified `(subject_id, purpose)` pairs — not a dynamic `WHERE`-clause sweep — so its effect is fully predictable and reviewable.
- The new trigger must not block deactivating a row, or inserting/updating any row with `is_active = false`.
- Full spec: `docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md`.

---

### Task 1: Redeploy the vault-parity reconciliation function

**Files:**
- Create: `supabase/migrations/20260916130000_redeploy_email_accounts_secret_parity.sql`

**Interfaces:**
- Consumes: nothing from other tasks — this is independent of Tasks 2 and 3.
- Produces: `core.email_accounts_secret_parity()` — `RETURNS TABLE (email_account_id uuid, purpose text, vault_secret_name text, has_vault_secret boolean)`, callable by `service_role`. Task 3's verification step (not its migration) calls this function.

- [ ] **Step 1: Confirm the function is currently absent (the "before" check)**

Run:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -tAc \"SELECT * FROM core.email_accounts_secret_parity();\""
```
Expected: `ERROR: function core.email_accounts_secret_parity() does not exist`. If it does not error, stop — it may already have been redeployed by someone else; investigate before proceeding.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/20260916130000_redeploy_email_accounts_secret_parity.sql
--
-- Redeploys core.email_accounts_secret_parity(), which was defined in
-- migration 20260528220000_backfill_email_accounts_to_core_secrets.sql
-- but is confirmed absent from production (calling it errors with
-- "function does not exist" -- never actually deployed, or dropped by
-- an untracked later change).
--
-- Its original definition checked plaintext columns on
-- public.email_accounts (access_token, refresh_token, smtp_password,
-- imap_password) that no longer exist -- they were permanently dropped
-- by migration 20260529010000_drop_email_accounts_plaintext_credentials.sql.
-- This version checks what actually matters now: for every ACTIVE
-- comms.email_account row in core.secrets, does its vault_secret_name
-- point to a real, readable vault.secrets row?
--
-- See docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md
-- for the incident this reconciliation function exists to detect.

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
    EXISTS (
      SELECT 1 FROM vault.secrets v WHERE v.name = s.vault_secret_name
    )
  FROM core.secrets s
  WHERE s.subject_kind = 'comms.email_account'
    AND s.is_active    = true;
$$;

COMMENT ON FUNCTION core.email_accounts_secret_parity IS
  'Reconciliation: every ACTIVE comms.email_account row in core.secrets, and whether its vault_secret_name is actually backed by a real vault.secrets row. A false has_vault_secret means the application believes this credential exists but cannot actually read it -- see docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md.';

GRANT EXECUTE ON FUNCTION core.email_accounts_secret_parity() TO service_role;
```

- [ ] **Step 3: Apply the migration**

```bash
ssh hostinger-vps "docker exec -i db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < supabase/migrations/20260916130000_redeploy_email_accounts_secret_parity.sql
```
Expected: `CREATE FUNCTION`, `COMMENT`, `GRANT` — no errors.

- [ ] **Step 4: Verify it now returns the known-orphaned set**

Run:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM core.email_accounts_secret_parity() WHERE NOT has_vault_secret;\""
```
Expected: `12` — matching the exact set documented in the spec's table (Task 3 restates the full list). If it is not exactly `12`, stop and investigate before proceeding to Task 2 — the count driving Task 3's remediation migration must match.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260916130000_redeploy_email_accounts_secret_parity.sql
git commit -m "fix(vault): redeploy core.email_accounts_secret_parity against vault.secrets"
```

---

### Task 2: Guard trigger preventing a future silent orphan

**Files:**
- Create: `supabase/migrations/20260916140000_secrets_require_vault_parity_trigger.sql`
- Test: `supabase/migrations/tests/secrets_require_vault_parity.assertions.sql`

**Interfaces:**
- Consumes: nothing from Task 1 — independent.
- Produces: nothing consumed by Task 3 (deactivation is never blocked by this trigger, by design — see Global Constraints).

- [ ] **Step 1: Write the failing assertions file**

```sql
-- supabase/migrations/tests/secrets_require_vault_parity.assertions.sql
-- Assertions for the core.secrets vault-parity guard trigger
-- (trg_secrets_require_vault_parity / core.enforce_secrets_vault_parity).
-- Run with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this file>
-- Every block raises an exception on failure; a clean exit means all passed.

BEGIN;

DO $$
DECLARE
  v_account_id  uuid := gen_random_uuid();
  v_violation   boolean := false;
BEGIN
  -- A1: an ACTIVE row whose vault_secret_name has no matching
  -- vault.secrets row must be rejected.
  BEGIN
    INSERT INTO core.secrets
      (vault_secret_name, purpose, subject_kind, subject_id, is_active)
    VALUES
      ('zz_assert_no_vault_row', 'smtp_password', 'comms.email_account', v_account_id, true);
    v_violation := false;
  EXCEPTION WHEN OTHERS THEN
    v_violation := true;
  END;
  IF NOT v_violation THEN
    RAISE EXCEPTION 'A1 failed: an active row with no matching vault.secrets row was accepted';
  END IF;

  -- A2: an ACTIVE row whose vault_secret_name DOES have a matching
  -- vault.secrets row (created first, same transaction) must succeed --
  -- this is the path core.write_email_account_credential already uses.
  PERFORM vault.create_secret('zz-assert-value', 'zz_assert_has_vault_row', 'trigger assertion fixture');
  INSERT INTO core.secrets
    (vault_secret_name, purpose, subject_kind, subject_id, is_active)
  VALUES
    ('zz_assert_has_vault_row', 'smtp_password', 'comms.email_account', v_account_id, true);
  IF NOT EXISTS (
    SELECT 1 FROM core.secrets
    WHERE vault_secret_name = 'zz_assert_has_vault_row' AND subject_id = v_account_id
  ) THEN
    RAISE EXCEPTION 'A2 failed: an active row WITH a matching vault.secrets row was rejected';
  END IF;

  -- A3: an INACTIVE row with no matching vault.secrets row must succeed --
  -- deactivating/cleaning up an already-broken row is never blocked.
  INSERT INTO core.secrets
    (vault_secret_name, purpose, subject_kind, subject_id, is_active)
  VALUES
    ('zz_assert_inactive_no_vault_row', 'smtp_password', 'comms.email_account', v_account_id, false);
  IF NOT EXISTS (
    SELECT 1 FROM core.secrets
    WHERE vault_secret_name = 'zz_assert_inactive_no_vault_row' AND subject_id = v_account_id
  ) THEN
    RAISE EXCEPTION 'A3 failed: an inactive row with no matching vault.secrets row was rejected';
  END IF;

  RAISE NOTICE 'All core.secrets vault-parity trigger assertions passed.';
END $$;

ROLLBACK;
```

- [ ] **Step 2: Run the assertions now, before the trigger exists, to confirm A1 fails**

```bash
ssh hostinger-vps "docker exec -i db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < supabase/migrations/tests/secrets_require_vault_parity.assertions.sql
```
Expected: fails with `ERROR: A1 failed: an active row with no matching vault.secrets row was accepted` (no trigger exists yet, so the bad insert in A1 succeeds, which is exactly the defect this task fixes). The whole script still safely rolls back on error (the outer `BEGIN`/`ROLLBACK` wraps everything, and psql with `-v ON_ERROR_STOP=1` stops on the first error inside a transaction, which Postgres then requires you to `ROLLBACK` -- the connection closing at the end of the piped session does this automatically). If A1 does not fail (e.g., some other error appears first), stop and debug the assertions file before proceeding.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260916140000_secrets_require_vault_parity_trigger.sql
--
-- Guard: core.secrets must never hold an ACTIVE row whose
-- vault_secret_name has no matching vault.secrets row. See
-- docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md
-- for the incident this prevents a recurrence of (a one-time backfill
-- migration inserted 12 such rows in 2026-05, none of which were ever
-- actually readable). Deactivating a row (is_active = false) is never
-- blocked, so cleanup of already-broken rows is unaffected.

CREATE OR REPLACE FUNCTION core.enforce_secrets_vault_parity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION core.enforce_secrets_vault_parity IS
  'Trigger function for trg_secrets_require_vault_parity on core.secrets -- rejects activating a row whose vault_secret_name has no matching vault.secrets row.';

DROP TRIGGER IF EXISTS trg_secrets_require_vault_parity ON core.secrets;

CREATE TRIGGER trg_secrets_require_vault_parity
  BEFORE INSERT OR UPDATE ON core.secrets
  FOR EACH ROW
  EXECUTE FUNCTION core.enforce_secrets_vault_parity();
```

- [ ] **Step 4: Apply the migration**

```bash
ssh hostinger-vps "docker exec -i db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < supabase/migrations/20260916140000_secrets_require_vault_parity_trigger.sql
```
Expected: `CREATE FUNCTION`, `COMMENT`, `DROP TRIGGER` (or a notice that it doesn't exist yet — harmless with `IF EXISTS`), `CREATE TRIGGER` — no errors.

- [ ] **Step 5: Re-run the assertions to verify they now pass**

```bash
ssh hostinger-vps "docker exec -i db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < supabase/migrations/tests/secrets_require_vault_parity.assertions.sql
```
Expected: `NOTICE: All core.secrets vault-parity trigger assertions passed.` — no errors. The script's own final `ROLLBACK;` means none of the `zz_assert_*` fixture rows or vault secrets persist.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260916140000_secrets_require_vault_parity_trigger.sql supabase/migrations/tests/secrets_require_vault_parity.assertions.sql
git commit -m "fix(vault): reject core.secrets rows activated with no matching vault.secrets row"
```

---

### Task 3: Remediate the 12 known-orphaned rows and report the affected accounts

**Files:**
- Create: `supabase/migrations/20260916150000_deactivate_orphaned_email_credentials.sql`
- Create: `docs/superpowers/reports/2026-09-16-orphaned-email-credentials-report.md`

**Interfaces:**
- Consumes: `core.email_accounts_secret_parity()` from Task 1, used only in this task's verification step (Step 4), not inside the migration itself.
- Produces: nothing consumed elsewhere — this is the last task in this plan.

- [ ] **Step 1: Confirm the 12-row baseline (the "before" check)**

Run:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM core.email_accounts_secret_parity() WHERE NOT has_vault_secret;\""
```
Expected: `12`. If this is not `12` (e.g., because the environment changed between Task 1 and now), stop and investigate before writing a migration pinned to a specific 12-row list.

- [ ] **Step 2: Write the remediation migration**

```sql
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
```

- [ ] **Step 3: Apply the migration**

```bash
ssh hostinger-vps "docker exec -i db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" < supabase/migrations/20260916150000_deactivate_orphaned_email_credentials.sql
```
Expected: `UPDATE 12`. Any other row count means the pinned list didn't match the live state exactly — stop and investigate rather than re-running with a broadened `WHERE`.

- [ ] **Step 4: Verify the parity function now returns zero rows**

Run:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-043251798216 psql -U supabase_admin -d postgres -tAc \"SELECT count(*) FROM core.email_accounts_secret_parity();\""
```
Expected: `0` — these 12 rows were the only active `comms.email_account` rows in `core.secrets` at all (confirmed during investigation: `core.secrets` had exactly 12 total rows for this `subject_kind`, all active, all orphaned), so deactivating them empties the function's `WHERE is_active = true` result set entirely.

- [ ] **Step 5: Write the remediation report**

```markdown
<!-- docs/superpowers/reports/2026-09-16-orphaned-email-credentials-report.md -->
# Orphaned Email-Account Credentials — Remediation Report (2026-09-16)

## What happened

A 2026-05-28 migration that moved plaintext email credentials into vault
left 12 `core.secrets` rows pointing at vault secrets that don't exist.
Every account below has a credential the application believes is active
but cannot actually read. Full root-cause writeup:
`docs/superpowers/specs/2026-09-16-orphaned-vault-credentials-fix-design.md`.

The original plaintext values are permanently gone (the source columns
were dropped by a later migration) — there is no way to recover them.
Each account below needs its credential re-entered or re-authorized by
its owner.

## Affected accounts

| Account email | Provider | Owning user | What they need to do |
|---|---|---|---|
| dinusaundarya@gmail.com | gmail | admin-user-tenant001@gmail.com | Connect this account via Google OAuth (it was never actually completed for this account — it was set up with IMAP-style credentials despite being labeled "gmail"). |
| tester@gmail.com | gmail | e2e_test_1770604489753@example.com | Re-run Google OAuth consent for this account. |
| bahuguna.vimal@gmail.com | gmail | bahuguna.vimal@gmail.com | Re-run Google OAuth consent for this account. |
| vimal.bahuguna@miapps.co | smtp_imap | bahuguna.vimal@gmail.com | Re-enter the SMTP/IMAP password in account settings. |
| vimal_s390@hotmail.com | office365 | admin-user-tenant001@gmail.com | Re-enter the IMAP/SMTP app password in account settings. |
| Bahuguna.vimal@outlook.com | office365 | admin-user-tenant001@gmail.com | Re-enter the IMAP/SMTP app password in account settings. |

## Fixed as part of this remediation

- `core.email_accounts_secret_parity()` is redeployed and can be re-run at
  any time to check for this class of problem going forward.
- A new trigger on `core.secrets` now rejects any future attempt to
  activate a credential row with no matching vault secret — this class
  of silent orphan can no longer happen undetected.
- The 12 known-orphaned rows are deactivated (not deleted), so
  `core.email_accounts_secret_parity()` returns zero rows as of this
  report.

## Not fixed by this remediation

Nothing above happens automatically — each account owner must take the
listed action before that account's email sync will work again.
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260916150000_deactivate_orphaned_email_credentials.sql docs/superpowers/reports/2026-09-16-orphaned-email-credentials-report.md
git commit -m "fix(vault): deactivate the 12 orphaned email-account credentials and report affected accounts"
```
