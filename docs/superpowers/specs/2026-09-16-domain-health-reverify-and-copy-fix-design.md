# DomainHealth Re-Verify and DNS Copy-to-Clipboard Fix — Design

## Background

Discovered by the final whole-branch review of the just-merged Domain
Management UI duplication fix
(`docs/superpowers/specs/2026-09-16-domain-management-ui-duplication-fix-design.md`),
which explicitly could not fix either gap itself since that plan's
Global Constraints forbade touching
`src/features/module-communications/components/email/DomainHealth.tsx`
— the file that plan's removal made the sole remaining domain-management
UI surface.

### Gap 1: re-verification is impossible once a domain has ever verified

`DomainHealth.tsx`'s "Verify" button:

```tsx
<Button 
  variant="outline" 
  size="sm"
  onClick={() => handleVerify(domain)}
  disabled={verifying === domain.id || domain.is_verified}
>
```

is permanently disabled once `domain.is_verified` becomes `true`. This
was harmless until today: before the earlier Group C domain-verification
fix, the backend never actually set `is_verified = true` at all, so this
condition never fired in practice. That fix made it live — and it
exposed a real problem, because `supabase/functions/domains-verify/index.ts:335`
recomputes `is_verified` from scratch on *every* run:

```ts
updates.is_verified = Boolean(updates.spf_verified) && Boolean(updates.dkim_verified);
```

If a domain verifies once and its DNS records later change (an IT admin
rotates SPF, drops a DKIM CNAME, migrates DNS providers), the *next* run
of `domains-verify` would correctly recompute `is_verified = false` —
except there is no next run, because the button that triggers it is
disabled. The only remaining path is deleting the domain and re-adding
it, which re-registers the identity with the email provider (AWS
SES/SendGrid) and issues brand-new DKIM tokens — a destructive
re-onboarding, not an equivalent re-check.

**Confirmed safe to fix by removing the disable condition:** read
`domains-verify/index.ts` in full. Its only side-effecting (non-DNS-lookup)
call is `provider.createDomainIdentity()` (line 238), gated behind
`if (!dkimTokens || !Array.isArray(dkimTokens) || dkimTokens.length === 0)`
(line 234) — i.e., it only fires when DKIM tokens are missing. A domain
that has ever been `is_verified = true` necessarily already has
`dkim_tokens` populated in `provider_metadata` (DKIM verification
requires them), so re-running verify on an already-verified domain always
skips that branch and only performs the three pure `Deno.resolveDns(...)`
lookups (SPF TXT, DMARC TXT, DKIM CNAME) before writing the recomputed
booleans back to `tenant_domains`. Fully idempotent, no risk of
duplicate provider registrations.

### Gap 2: no copy-to-clipboard for DNS record values

The "DNS" button's dialog (`DomainHealth.tsx:184-228`) shows SPF, DKIM,
and DMARC records as plain selectable monospace text, with no copy
affordance. The now-deleted duplicate component
(`DomainManagement.tsx`, removed by the branch that just merged) had a
per-DKIM-token `Copy` button
(`navigator.clipboard.writeText(\`${token}._domainkey\`)`) that this file
never had — and even that only copied the record *name*, not the harder
to accurately transcribe *value* (a random-looking hash string).
Hand-typing a DKIM CNAME target into a DNS provider's UI is genuinely
error-prone.

The codebase already has an established convention for this
(`src/pages/dashboard/TeamSettings.tsx:106-111`): a `handleCopy` async
function wrapping `navigator.clipboard.writeText(...)` in `try`/`catch`,
paired with a `sonner` `toast.success(...)` on success —
`DomainHealth.tsx` already imports `toast` from `"sonner"`, so this
matches the file's own existing convention, not a new one.

## Goal

1. Let a domain be re-verified at any time, regardless of its current
   `is_verified` state.
2. Add a copy button next to every DNS record value shown in the "DNS"
   dialog.

## Architecture

Both changes are confined to
`src/features/module-communications/components/email/DomainHealth.tsx`.

**Fix 1:** Remove `|| domain.is_verified` from the "Verify" button's
`disabled` prop (`DomainHealth.tsx:296`). No label change — it stays
"Verify" always, matching the button text the now-removed duplicate used
for the same always-clickable behavior. No backend change.

**Fix 2:** Add one helper function, alongside the file's existing
handlers:

```tsx
const handleCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Could not copy to clipboard.");
  }
};
```

Then add a small icon-only `Copy` button (imported from `lucide-react`,
already the file's icon library) next to each of the DNS dialog's three
value displays:

- The DKIM records block (`DomainHealth.tsx:196-206`): two copy buttons
  per row — one next to the record *name* (`record.name`), one next to
  the record *value* (`record.value`) — since a user pastes each into a
  different field in their DNS provider's UI.
- The SPF block (`DomainHealth.tsx:208-213`): one copy button for
  `dnsDialogData.spf`.
- The DMARC block (`DomainHealth.tsx:215-220`): one copy button for
  `dnsDialogData.dmarc`.

Every button calls `handleCopy` with the exact string shown next to it —
no reformatting, no truncation.

## Non-Goals

- Changing the "Verify" button's label to distinguish first-verify from
  re-verify (e.g. "Verify" vs. "Re-verify") — YAGNI; the removed
  duplicate never made this distinction either, and the button's
  enabled/disabled state was the only thing broken, not its wording.
- Any change to `domains-verify`, `domains-register`, `tenant_domains`,
  or `DomainVerificationService.ts` — the backend is already correct and
  already idempotent; only the frontend gate was wrong.
- A shared/reusable copy-button component — this is the only place in
  `DomainHealth.tsx` that needs one; extracting a component for a single
  call site would be premature.
- Copying all DNS records at once (a single "copy all" action) — not
  requested, and the per-field granularity matches how a user actually
  fills in their DNS provider's UI (one record at a time).

## Testing

`DomainHealth.tsx` has no existing test file (confirmed:
`find src -iname "DomainHealth.test.*"` returns nothing), so this plan
creates one, new: `src/features/module-communications/components/email/DomainHealth.test.tsx`.

Required cases:
- A domain with `is_verified: true` renders its "Verify" button
  **enabled** (not `disabled`) — the direct regression guard for Gap 1.
- Clicking "Verify" on an already-verified domain calls
  `DomainVerificationService.verifyDomain` with that domain's id (same
  behavior as clicking it on an unverified domain — no special-casing by
  verification state).
- Clicking a copy button next to a DNS record value calls
  `navigator.clipboard.writeText` with exactly that value's string (not
  some other field, not a reformatted version) and shows a success
  toast — proves Gap 2's fix wires the right string to the right button,
  not just that *some* copy button exists somewhere in the dialog.

## Global Constraints

- Confined to `src/features/module-communications/components/email/DomainHealth.tsx`
  and its new test file — no change to `domains-verify`,
  `domains-register`, `DomainVerificationService.ts`, `tenant_domains`,
  or any other file.
- No change to the "Verify" button's label/text, only its `disabled`
  condition.
- `sonner`'s `toast` (already imported in this file) is the toast
  library for the new copy-success/error messages — not shadcn's
  `use-toast`, which this file does not use.
