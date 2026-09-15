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

Fix: when `is_active === true` AND the account needs re-authorization —
the exact compound condition already gating the warning message at line
338, `!connectedAccountIds.has(account.id) && (account.provider ===
'gmail' || account.provider === 'office365')` — the badge shows "Needs
Re-auth" instead of "Active." (Note the provider check: SMTP/IMAP/POP3
accounts never show the re-auth warning at all, so they're unaffected by
this fix — only `gmail`/`office365` accounts can be in this state.) When
`is_active === false`, the badge still shows "Inactive" regardless of
OAuth state (deleted/disabled accounts don't need a re-auth prompt). When
`is_active === true` and OAuth is fine, "Active" as today. No new data is
fetched — this only changes which of the two already-fetched signals
drives the badge's text/color.

Use the project's semantic status tokens for the new state — `bg-status-warning
text-status-warning-foreground border-status-warning-border` (`tailwind.config.ts:47`,
`src/index.css:186-188`/`384-386` for light/dark) — matching this same
component's own convention for the "Active" state (`bg-status-success
text-status-success-foreground border-status-success-border`, line
323-326). These tokens exist precisely because an earlier initiative in
this project (the design-system status-tone work) built them for exactly
this purpose; use them rather than inventing a new color.

**Same-file opportunistic fix, directly adjacent to what's being touched:**
the existing "⚠️ Authorization Required" warning box (lines 339-343) uses
raw Tailwind colors (`bg-yellow-500/10 border-yellow-500/30` on the
wrapping `<div>`, `text-yellow-600 dark:text-yellow-500` on the child
`<p>`) instead of the semantic `status-warning` tokens above. This evades
the project's own `no-restricted-syntax` "raw palette badge pair" lint
rule (`eslint.config.*`'s `STATUS_PALETTE_BANS`) because that rule's regex
requires `bg-X-N` and `text-X-N` in the *same* class string — here they're
split across parent and child elements, so the rule never sees the pair.
Since this fix is adding a `status-warning`-toned badge one line away in
the same render path, convert this box to the same tokens in the same
change — trivial, zero behavioral difference, and removes a real,
lint-invisible inconsistency right next to the new code.

## Testing

Neither `EmailManagement.tsx` nor `EmailAccounts.tsx` has an existing test
file (confirmed — `find src -iname "EmailAccounts.test.*" -o -iname
"EmailManagement.test.*"` returns nothing), so this plan creates both,
new:

- `src/pages/dashboard/EmailManagement.test.tsx` (Fixes 1-2): a test
  confirming the "Email Client" tab is clickable and renders
  `EmailClientSettings`; a test confirming there is exactly one tab
  labeled "Templates" (regression guard against the duplicate
  recurring); a test confirming the routing tab reads "Queue Rules," not
  "Routing Rules."
- `src/features/module-communications/components/email/EmailAccounts.test.tsx`
  (Fix 3): a test with an account where `is_active=true` and the OAuth
  RPC-derived needs-reauth flag is true, asserting the badge renders
  "Needs Re-auth" (not "Active"); a sibling case with `is_active=false`
  asserting "Inactive" regardless of OAuth state; a sibling case with
  `is_active=true` and OAuth fine asserting "Active" unchanged (regression
  guard for the existing behavior).

## Global Constraints

- No backend, database, or edge-function change of any kind — this is a
  pure frontend fix across two files.
- No behavior change to anything on the page beyond the three fixes named
  above and the one directly-adjacent token-consistency fix (the
  "Authorization Required" box's colors) called out under Fix 3 — in
  particular, no other `TabsTrigger`/`TabsContent` pairing in
  `EmailManagement.tsx` is touched, and no other status-badge or warning
  logic in `EmailAccounts.tsx` is touched.
- Semantic status tokens only for any new or touched color —
  `bg-status-warning`/`text-status-warning-foreground`/`border-status-warning-border`
  for the new badge state and the adjacent box fix — never a raw Tailwind
  palette color (matches this project's established design-system
  convention).
