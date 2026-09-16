# Domain Verification (Group C) — Design

## Background

Group C of the original email-management audit
(`docs/superpowers/specs/2026-09-15-email-management-ui-bugs-design.md`)
flagged "all sending domains showing Unverified" as needing investigation
before deciding what, if anything, to fix. That investigation is done.

Live confirmation (2026-09-16): every domain row in production
(`test-domain.com`, `sos-services.com`, `index.com`, `index1.com`,
`bg.com`, `bhamge25.com`, `tenant-1770125051485.com`) has
`is_verified/spf_verified/dkim_verified/dmarc_verified` all `false`, with
`updated_at` frozen at each row's creation timestamp (2026-02-08) — months
ago, despite the UI's "Verify DNS" button having presumably been clicked
since. Reading `supabase/functions/domains-verify/index.ts` explains why:
this is not a DNS-configuration problem, it's two confirmed code bugs.

### Bug 1 — every verification attempt crashes on save (root cause)

`domains-verify/index.ts:225-228` initializes an `updates` object, and
line 329 adds:
```ts
updates.status = (updates.spf_verified && updates.dkim_verified) ? 'active' : 'pending_verification';
```
`public.tenant_domains` has **never had a `status` column** — confirmed
against its defining migration, `supabase/migrations/20260219010000_email_infrastructure_phase1.sql:8-29`
(columns: `id, tenant_id, domain_name, is_verified, spf_record,
spf_verified, dkim_record, dkim_verified, dmarc_record, dmarc_verified,
provider_metadata, created_at, updated_at`). Every call to
`.from("tenant_domains").update(updates)` (line 332-335) therefore fails
with Postgres error `42703` ("column does not exist"), caught by the
function's top-level `catch` and turned into an HTTP 400. **Nothing** —
not even the correctly-computed `spf_verified`/`dkim_verified`/`dmarc_verified`
results — has ever been persisted, for any domain, ever.

This also explains a second, independently-confirmed symptom:
`src/components/admin/TenantForm.tsx:543-554` calls `domains-verify`
during tenant onboarding when an operator requests domain verification at
creation time. Because the call always throws, this always lands in the
surrounding `catch` (`TenantForm.tsx:555-557`), which sets
`domainFailureReason` and routes the onboarding session to
`'support_assisted'` status (`TenantForm.tsx:560-564`) — i.e., "verify
this domain now" during tenant setup has never worked either; it always
silently degrades to a manual-support flow.

### Bug 2 — `is_verified` itself is never set, even if Bug 1 is fixed

Even after removing the crashing `status` line, `domains-verify` computes
`spf_verified`, `dkim_verified`, and `dmarc_verified` individually but
never assigns `updates.is_verified` anywhere. Both UI surfaces that show
the primary green/red "Verified"/"Unverified" badge read `is_verified`
specifically:
- `src/features/module-communications/components/email/DomainManagement.tsx:173-177`
  (rendered inside the Email Client tab's "Domain Management" card).
- `src/features/module-communications/components/email/DomainHealth.tsx:256-263`
  (rendered in the top-level "Domains" tab; same `tenant_domains` table,
  same `domains-verify`/`domains-register` functions, via
  `src/services/email/DomainVerificationService.ts`).

So a domain with fully correct SPF+DKIM DNS records would still show
"Unverified" forever, because nothing ever promotes `is_verified` to
`true`.

### Confirmed separately: no real DNS exists for any current domain

Independent of both bugs, live DNS lookups against `sos-services.com` —
the one domain here that could plausibly be a real, owned production
domain — found no SPF or DMARC TXT record at all. None of the 7 domains
currently in the database have the DNS records `domains-register`
already tells users to add. This is expected/correct behavior once both
bugs are fixed, not a third bug: verification should continue reporting
failure for these specific domains until someone actually configures
their DNS. This spec does not change that.

## Goal

Make "Verify DNS" actually persist its results, and make the
`is_verified` badge reflect them correctly, for any domain with real
SPF+DKIM records — with zero changes to DNS-lookup logic, zero schema
changes, and zero changes to existing domain rows.

## Architecture

One file changes: `supabase/functions/domains-verify/index.ts`.

1. **Delete** line 329 entirely:
   ```ts
   updates.status = (updates.spf_verified && updates.dkim_verified) ? 'active' : 'pending_verification';
   ```
   This is the only line referencing the non-existent column; removing it
   is sufficient to stop every `.update()` call from throwing.

2. **Add**, immediately after the DKIM verification block ends (after
   line 327, before the deleted line 329's old position):
   ```ts
   updates.is_verified = Boolean(updates.spf_verified) && Boolean(updates.dkim_verified);
   ```
   Per explicit decision: **DMARC does not gate `is_verified`.** SPF and
   DKIM together are what most providers mean by "domain authenticated";
   DMARC is a policy layer on top and keeps showing as its own separate
   check in both UI surfaces, just not as part of the main badge.
   `Boolean(...)` handles the case where `updates.dkim_verified` was never
   set at all (e.g. the DKIM-token-provisioning step at
   lines 234-258 failed and was swallowed by its own try/catch, per the
   comment "Don't fail the whole request, just proceed with what we
   have") — `Boolean(undefined)` is `false`, which is the correct
   "not verified" outcome for that case, not a crash.

No other line in the DNS-checking logic (SPF/DMARC/DKIM lookups, the
provider-registration fallback, the auth/fetch/error-handling structure)
changes.

## Non-Goals

- **DNS records themselves.** This fix only makes the *checking* work
  correctly. Whether `sos-services.com` or any other domain gets real
  SPF/DKIM/DMARC records added is DNS-ownership work outside this
  codebase, and out of scope here.
- **The 7 existing domain rows.** No migration, no backfill, no cleanup.
  They keep their current (all-`false`) values until someone clicks
  "Verify DNS" again, at which point the fix takes effect immediately.
  Whether any of these look like leftover seed/test data worth deleting
  is Group C's separate "visible test data" item — not this one.
- **`domains-register`'s own `is_verified: false` default at creation**
  (`domains-register/index.ts:100`) — correct as-is, untouched.
- **`TenantForm.tsx`'s independent verification check**
  (`TenantForm.tsx:549-553`): it computes its own local `domainVerified`
  from the raw `verifyData.results.{spf,dmarc,dkim}` response — requiring
  **all three**, including DMARC — rather than reading the `is_verified`
  column at all. This is a real, pre-existing inconsistency (three
  different call sites now have three different notions of "verified":
  this spec's DB-level `is_verified` uses SPF+DKIM; `TenantForm.tsx`'s
  local variable requires all three) but unifying it would mean changing
  onboarding behavior, which is a separate decision — flagged here, not
  fixed. Bug 1's fix does mean `TenantForm.tsx`'s call **stops always
  throwing**, which changes onboarding behavior on its own (verification
  requests during tenant creation will now be attempted for real instead
  of always degrading to `support_assisted`) — worth the tenant-onboarding
  owner's awareness, but not a reason to hold this fix, since "actually
  attempting verification" is strictly closer to the intended behavior
  than "always fails."
- **`dkim_record` column.** `domains-verify` never writes it (only
  `dkim_verified`); neither UI surface currently reads it (`DomainHealth.tsx`'s
  DKIM tooltip says "Check provider metadata for details" rather than
  showing `dkim_record`). Leaving it unset is consistent with today's
  behavior.
- **The RLS/`get_user_tenant_id` fragility on `tenant_domains` UPDATE.**
  The table's "Tenant admins can update own domains" policy
  (`20260219010000_email_infrastructure_phase1.sql:62-72`) gates on
  `tenant_id = public.get_user_tenant_id(auth.uid())`, and that helper's
  latest definition (`20260128100001_fix_profiles_rls.sql`) has the same
  "arbitrary row for a multi-role user" fragility already flagged
  elsewhere in this project (see the SMTP/IMAP save-fix's Task 1 finding
  on the same helper). A `tenant_admin`-only user holding roles in more
  than one tenant could have their update silently RLS-filtered to zero
  rows (no error — Postgres RLS on UPDATE just matches nothing) even
  after this fix. `platform_admin` users bypass this via a separate,
  unconditional policy and are unaffected. Fixing the shared helper is a
  cross-cutting, already-known issue outside this fix's scope; noted here
  so it isn't mistaken for a regression if a tenant-admin's verification
  silently doesn't persist.

## Testing

New file: `supabase/functions/domains-verify/index.test.ts` (none exists
today). Two things make this test file genuinely different from the
`create-email-client-account/index.test.ts` precedent from the SMTP/IMAP
fix, both must be handled correctly:

1. **The top-level `import { SESClient, VerifyDomainDkimCommand } from "npm:@aws-sdk/client-ses";`
   (`domains-verify/index.ts:115`) cannot resolve under Vitest/Node as a
   real package** — `@aws-sdk/client-ses` is not installed in this repo's
   `node_modules` (confirmed), and `supabase/functions/_types/deno-npm-mods.d.ts`'s
   `declare module "npm:@aws-sdk/client-ses"` is a Deno/TypeScript-only
   ambient type declaration with zero effect on Vite/Vitest's module
   resolution at runtime. The test file **must** mock this exact
   specifier string even though the tested code paths never call it:
   ```ts
   vi.mock("npm:@aws-sdk/client-ses", () => ({
     SESClient: class { send() { return Promise.resolve({}); } },
     VerifyDomainDkimCommand: class {},
   }));
   ```
   Without this, the whole test file fails at import time before any
   test runs, with a "Cannot find module" resolution error — not a test
   failure inside a test body.
2. **`domains-verify/index.ts` calls `Deno.resolveDns(...)` (three times:
   SPF, DMARC, and once per DKIM token) and `Deno.env.get(...)` (inside
   `getEmailProvider()`), and no global `Deno` shim exists anywhere in
   this repo's test setup** (`test/setup.ts` has none — confirmed by
   direct search; the `create-email-client-account` function's test
   didn't need one because that function never references `Deno`
   directly). The test file must stub it itself, scoped to the file, e.g.:
   ```ts
   beforeEach(() => {
     vi.stubGlobal("Deno", {
       resolveDns: vi.fn().mockRejectedValue(new Error("no records")),
       env: { get: vi.fn().mockReturnValue(undefined) },
     });
   });
   afterEach(() => vi.unstubAllGlobals());
   ```
   Individual tests override `Deno.resolveDns`'s mock per-call to return
   the specific TXT/CNAME records that test needs.
3. **Unlike `create-email-client-account`, this function does not use
   the `supabase` parameter `serveWithLogger` injects as its third
   handler argument** (that parameter is literally named `_adminSupabase`
   in the source, unused). All DB reads/writes go through
   `requireAuth(req, logger)`'s returned `supabaseClient` instead
   (`domains-verify/index.ts:197,214`). The mocked `_shared/auth.ts`'s
   `requireAuth` must therefore return
   `{ user, error: null, supabaseClient: <mock> }` with a real mock
   client on it — mocking only `{user, error}` (the Task 1 pattern) is
   not enough here; the code would crash calling `.from(...)` on
   `undefined`.

Required test cases:
- The `.update()` payload passed to `tenant_domains` never contains a
  `status` key, in every scenario below.
- SPF and DKIM both pass (mock `Deno.resolveDns` to return a matching TXT
  record for the domain and a matching CNAME for at least one DKIM
  token), DMARC fails → `is_verified: true` in the update payload
  (proving DMARC doesn't gate it).
- SPF passes, DKIM fails (no matching CNAME for any token) →
  `is_verified: false`.
- DKIM tokens are entirely absent from `provider_metadata` and the
  identity-provisioning fallback also fails (mock `getEmailProvider`'s
  effective path to throw/skip, matching the real try/catch at
  lines 234-258) → `updates.dkim_verified` is never set, and
  `is_verified` still computes to `false` (not `undefined`, not a crash).
- All three pass → `is_verified: true` (sanity check the common case
  still works once DNS is real).
- Missing/invalid auth → 401, no DNS lookups attempted, no update
  attempted.
- Domain not found (`supabaseClient.from("tenant_domains").select().eq().single()`
  returns an error/null) → the function's existing "Domain not found or
  access denied" error path, still 400, unchanged by this fix — included
  as a regression check, not new behavior.

## Global Constraints

- No schema changes, no new migration — this is a pure application-code
  fix for a bug in how existing columns are (and aren't) written.
- No change to the DNS-lookup logic itself (SPF TXT check, DMARC TXT
  check, DKIM CNAME check) — only to what gets persisted afterward.
- No change to `domains-register`, `DomainManagement.tsx`,
  `DomainHealth.tsx`, `DomainVerificationService.ts`, or `TenantForm.tsx`
  — all of them already read `is_verified` (or, for `TenantForm.tsx`,
  the raw response) correctly; only the write side in `domains-verify`
  was broken.
