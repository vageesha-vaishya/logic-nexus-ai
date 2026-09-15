# Email Management UI Bugs — Design

## Background

A live audit of `/dashboard/email-management` (2026-09-15, browser-based,
against the real production instance) found several concrete, reproducible
bugs. Investigating the actual source confirmed root causes for three of
them, all self-contained frontend fixes with no backend/data risk — this
spec covers exactly those three ("Group A"). Two more findings need real
backend/data-integrity investigation before any fix is safe to write
("Group B" — duplicate email ingestion, character-encoding corruption in
stored text) and two are not confirmed bugs at all, just things needing a
human decision ("Group C" — all sending domains showing "Unverified"; test
data visible in the UI). Group B and C are explicitly out of scope here and
will get their own brainstorm/spec/plan cycles if and when pursued.

## Goal

Fix three confirmed, isolated UI bugs in the Email Management page with
zero behavior change to anything else on the page, and zero backend/data
changes.

## Non-Goals

- Group B (duplicate emails, encoding corruption) and Group C (domain
  verification, seed-data cleanup) — deliberately deferred, not touched by
  this plan.
- The domain-management overlap noticed while investigating (`EmailClientSettings`
  renders its own "Domain Management" section, duplicating what the
  separate "Domains" tab's `DomainHealth` component does) — real, but a
  bigger consolidation decision than "fast, safe, concrete" allows. Noted
  here for the record; not fixed by this plan.

## The three fixes

**1. Restore the hidden "Email Client" tab.**

`src/pages/dashboard/EmailManagement.tsx` has two `TabsTrigger` elements
with `value="templates"` — lines 86-92 (the real Templates tab) and lines
135-141 (a byte-identical copy-paste of the first). The second one should
instead be `value="clients"`, matching the `TabsContent value="clients"`
block at lines 161-163, which already renders `<EmailClientSettings />`
(already imported at line 14) — a real, built feature (SMTP/IMAP setup,
Outlook compose defaults, configured accounts, per that component's own
`CardTitle`s) that has been completely unreachable in the UI since nothing
points a trigger at it.

Fix: change the duplicate trigger's `value` to `"clients"`, its label to
"Email Client", and its icon from `FileText` to `Server` (already imported
at line 12, currently used nowhere in this file — confirms it was likely
the intended icon for this tab originally). No other trigger, and no
`TabsContent`, changes.

**2. Rename "Routing Rules" → "Queue Rules."**

The `routing` `TabsTrigger` (line 114-120) labels itself "Routing Rules,"
but the panel it opens (`QueueRulesManager`, line 178) heads itself "Queue
Rules" — confirmed by loading the tab directly. One line: change the
trigger's `<span>` text from "Routing Rules" to "Queue Rules." Nothing else
in the file, the component, or its heading changes.

**3. Add a "Needs Re-auth" badge state, distinct from "Active."**

`src/features/module-communications/components/email/EmailAccounts.tsx`
currently derives the status badge purely from `account.is_active`
(~line 323-328: `is_active ? "Active" : "Inactive"`). Separately, a few
lines below (line 341), the same row may show "⚠️ Authorization Required:
Click 'Re-authorize' to complete OAuth setup" — driven by a *different*
signal (whether the account's id is in the set returned by the
`core.my_oauth_connected_email_accounts()` RPC the component already calls
on every fetch, per its own comment at lines 28-36). These two booleans are
orthogonal by design (`is_active` means "record not deleted," the OAuth
check means "vault token present and valid") and were never reconciled in
the badge — so a real, active, non-deleted account whose OAuth token has
expired shows the same green "Active" badge as one that's fully working,
which is misleading.

Fix: when `is_active === true` AND the account needs re-authorization
(the same condition already gating the warning message), the badge shows
"Needs Re-auth" in the existing warning/amber badge style (matching this
component's own established color convention for non-success states, not
a new one). When `is_active === false`, the badge still shows "Inactive"
regardless of OAuth state (deleted/disabled accounts don't need a
re-auth prompt). When `is_active === true` and OAuth is fine, "Active" as
today. No new data is fetched — this only changes which of the two
already-fetched signals drives the badge's text/color.

## Testing

Each fix is small and isolated to one file:
- Fix 1: a test confirming the "Email Client" tab is clickable and renders
  `EmailClientSettings`, and that there is exactly one tab labeled
  "Templates" (regression guard against the duplicate recurring).
- Fix 2: a test (or a simple string assertion if no test file exists yet
  for this exact label) confirming the tab reads "Queue Rules," not
  "Routing Rules."
- Fix 3: a test with an account where `is_active=true` and the OAuth
  RPC-derived needs-reauth flag is true, asserting the badge renders
  "Needs Re-auth" (not "Active"); a sibling case with `is_active=false`
  asserting "Inactive" regardless of OAuth state; a sibling case with
  `is_active=true` and OAuth fine asserting "Active" unchanged (regression
  guard for the existing behavior).

## Global Constraints

- No backend, database, or edge-function change of any kind — this is a
  pure frontend fix across two files.
- No behavior change to anything on the page beyond the three fixes named
  above — in particular, no other `TabsTrigger`/`TabsContent` pairing in
  `EmailManagement.tsx` is touched, and no other status-badge logic in
  `EmailAccounts.tsx` is touched.
