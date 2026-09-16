# Domain Management UI Duplication Fix — Design

## Background

Flagged as a deliberate Non-Goal in the original audit
(`docs/superpowers/specs/2026-09-15-email-management-ui-bugs-design.md`):
"`EmailClientSettings` renders its own 'Domain Management' section,
duplicating what the separate 'Domains' tab's `DomainHealth` component
does... a bigger consolidation decision than fast/safe/concrete allows."
This is the last open item from that audit's Group A/B/C split (Group B
and the domain-verification half of Group C are already fixed and
deployed).

### Confirmed: a real, full feature duplication

Two components manage the exact same data through the exact same edge
functions, in two different tabs of the Email Management page:

**`src/features/module-communications/components/email/DomainManagement.tsx`**
(246 lines) — rendered inside `EmailClientSettings.tsx:236-246`, inside a
"Domain Management" `Card`, itself rendered under the page's "Email
Client" tab (`src/pages/dashboard/EmailManagement.tsx`,
`TabsContent value="clients"`). Calls `supabase.from("tenant_domains")`
and `supabase.functions.invoke("domains-register"/"domains-verify")`
directly. Features: list domains, Verified/Unverified badge, SPF/DKIM/DMARC
status icons, an "Add Domain" dialog, a "Verify DNS" button, and inline
DKIM-only DNS instructions shown automatically for unverified domains. No
delete. No way to view DNS for an already-verified domain.

**`src/features/module-communications/components/email/DomainHealth.tsx`**
(353 lines) — rendered directly under the page's separate "Domains" tab
(`TabsContent value="domains"`). Reads/writes the *same*
`public.tenant_domains` table and calls the *same* `domains-register`/
`domains-verify` edge functions, but through a dedicated service layer
(`src/services/email/DomainVerificationService.ts`). Has most of what
`DomainManagement.tsx` has, plus: a delete button, a "DNS" button showing
full SPF+DKIM+DMARC instructions for *any* domain (not just unverified
ones), explicit tenant-scoping (`tenantId` derived from `useAuth()` and
passed into `addDomain` rather than relying purely on RLS), and a
permanent "DNS Configuration Guide" help card.

**Correction, added after the final whole-branch review:** this is not
a strict superset. Two capabilities the removed card had are genuinely
missing from `DomainHealth.tsx`: (1) its "Verify DNS" button disables
once `is_verified = true` (`disabled={verifying === domain.id ||
domain.is_verified}`), so an already-verified domain can never be
re-checked — a real gap now that `domains-verify` can flip a domain back
to unverified on a later run (recoverable only via delete + re-add, not
a re-verify); (2) it has no copy-to-clipboard affordance for DKIM CNAME
records, unlike the removed card's per-token `Copy` button. Both are
pre-existing properties of `DomainHealth.tsx` itself, not something this
plan introduces or is in scope to fix (this plan's Global Constraints
explicitly forbid touching that file) — tracked as a follow-up.

`DomainManagement.tsx` has exactly one consumer — `EmailClientSettings.tsx`
— confirmed by repo-wide grep. `DomainHealth.tsx` is objectively the more
complete implementation and already lives in its own dedicated,
independently-discoverable tab.

(Not part of this duplication, despite the name collision:
`src/pages/dashboard/DomainManagement.tsx` is a completely separate page
about platform/business verticals — an unrelated "domain" concept, not
touched by this fix.)

## Goal

Remove the duplicate, less-capable "Domain Management" card from
`EmailClientSettings.tsx`. `DomainHealth.tsx`'s "Domains" tab remains the
single place to manage sending domains.

## Architecture

Pure frontend removal, two files:

1. **`EmailClientSettings.tsx`** — delete the `{canEdit && (...)}` block
   at lines 236-246 (the whole "Domain Management" `Card`, including its
   `CardHeader`/`CardTitle`/`CardDescription`/`CardContent` and the
   `<DomainManagement />` render) and the now-unused
   `import { DomainManagement } from "./DomainManagement";` at line 14.
   `canEdit` (line 105) stays — it's still used at lines 351 and 354 for
   the SMTP/IMAP form's own save button and read-only notice.
2. **`DomainManagement.tsx`** — delete the file entirely. Confirmed via
   repo-wide grep that `EmailClientSettings.tsx` is its only importer.
3. **`EmailClientSettings.test.tsx`** — remove the now-meaningless
   `vi.mock('./DomainManagement', ...)` block (lines 5-7). No test in
   this file currently asserts on `data-testid="domain-management"`
   (confirmed via grep), so nothing else in the test file changes.

Nothing in `DomainHealth.tsx`, `DomainVerificationService.ts`,
`domains-register`, or `domains-verify` changes — this fix only removes
the duplicate consumer; the surviving implementation is untouched.

## Non-Goals

- Merging the two implementations into one shared component used by
  both tabs (considered and rejected — it would re-introduce the same
  "domain list shown in two tabs" problem, just with matching
  capability).
- A lightweight pointer/link from the Email Client tab to the Domains
  tab (considered and rejected in favor of a clean removal — the
  original audit's own complaint was about *duplication*, and a full
  card-to-nowhere addition isn't needed when the "Domains" tab is
  already a top-level, equally discoverable tab on the same page).
- Any change to `domains-register`, `domains-verify`, `tenant_domains`,
  or `DomainVerificationService.ts` — all already correct and unaffected.
- Any change to `src/pages/dashboard/DomainManagement.tsx` (the unrelated
  platform-verticals page) — not part of this duplication.

## Testing

`EmailClientSettings.test.tsx` already exists (created by the earlier
Group A frontend fix) and already exercises this file's rendering and
save-flow behavior. This fix needs one new regression guard plus the
mock cleanup described above:

- A test asserting the page no longer renders a "Domain Management"
  heading/card inside `EmailClientSettings` — the direct regression
  guard for this fix (proves the duplicate card is actually gone, not
  just that the mock was removed).
- **Correction during self-review:** `EmailManagement.test.tsx` (the
  page-level test from the Group A fix) mocks `DomainHealth`
  (`vi.mock(...)` at lines 37-39, rendering
  `data-testid="domain-health"`) but never actually asserts that testid
  appears — confirmed by grep, no `getByTestId('domain-health')` or
  equivalent exists in that file today. This fix does not need to touch
  that file, but it is a pre-existing coverage gap, not a test this fix
  can rely on as already proving the "Domains" tab renders
  `DomainHealth`. Not in scope to fix here (this plan's scope is the
  duplication removal, not backfilling unrelated pre-existing test
  gaps) — noted for the record only.

## Global Constraints

- No backend, database, or edge-function change of any kind — this is a
  pure frontend removal across two files plus one test file update.
- `DomainHealth.tsx`, `DomainVerificationService.ts`, and both edge
  functions are not modified.
- `canEdit`'s other two usages in `EmailClientSettings.tsx` (lines 351,
  354) are untouched.
