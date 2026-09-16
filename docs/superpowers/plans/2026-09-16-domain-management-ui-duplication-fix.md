# Domain Management UI Duplication Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicate, less-capable "Domain Management" card from `EmailClientSettings.tsx` — the "Domains" tab's `DomainHealth.tsx` already covers the same feature more completely, from its own dedicated tab.

**Architecture:** Delete the card's JSX block and its import from `EmailClientSettings.tsx`, delete the now-orphaned `DomainManagement.tsx` file entirely (it has exactly one consumer), and remove the corresponding mock from `EmailClientSettings.test.tsx`.

**Tech Stack:** React + TypeScript, vitest + Testing Library (existing conventions in this file).

## Global Constraints

- No backend, database, or edge-function change of any kind — this is a pure frontend removal across two files plus one test file update.
- `DomainHealth.tsx`, `DomainVerificationService.ts`, and both edge functions (`domains-register`, `domains-verify`) are not modified.
- `canEdit`'s other two usages in `EmailClientSettings.tsx` (the SMTP/IMAP save button and read-only notice) are untouched.
- Full spec: `docs/superpowers/specs/2026-09-16-domain-management-ui-duplication-fix-design.md`.

---

### Task 1: Remove the duplicate Domain Management card

**Files:**
- Modify: `src/features/module-communications/components/email/EmailClientSettings.tsx:14` (remove import), `:236-246` (remove card)
- Modify: `src/features/module-communications/components/email/EmailClientSettings.test.tsx:5-7` (remove now-meaningless mock)
- Test: `src/features/module-communications/components/email/EmailClientSettings.test.tsx` (add one new test)
- Delete: `src/features/module-communications/components/email/DomainManagement.tsx`

**Interfaces:**
- Consumes: nothing from other tasks — this is the only task in this plan.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the failing test**

Add this test to the existing `describe('EmailClientSettings save form', ...)` block in `src/features/module-communications/components/email/EmailClientSettings.test.tsx`, after the last existing `it(...)` (the "shows a failure toast..." test) and before the closing `});` of the `describe` block:

```typescript
  it('does not render a duplicate Domain Management card (Domains tab owns this feature)', () => {
    render(<EmailClientSettings />);
    expect(screen.queryByText('Domain Management')).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/module-communications/components/email/EmailClientSettings.test.tsx`
Expected: the new test FAILS — `screen.queryByText('Domain Management')` finds the still-present card's `CardTitle` text, so the assertion `toBeNull()` fails. The 3 pre-existing tests in this file still pass unchanged. If any pre-existing test fails too, stop and debug before proceeding — this step should only add one new failure.

- [ ] **Step 3: Remove the import**

In `src/features/module-communications/components/email/EmailClientSettings.tsx`, find this line (currently line 14):

```typescript
import { DomainManagement } from "./DomainManagement";
```

Delete it entirely. No other import line changes.

- [ ] **Step 4: Remove the card**

In the same file, find this block (currently lines 236-246):

```typescript
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Domain Management</CardTitle>
            <CardDescription>Manage verified domains for sending emails via high-deliverability infrastructure.</CardDescription>
          </CardHeader>
          <CardContent>
            <DomainManagement />
          </CardContent>
        </Card>
      )}

```

Delete the entire block, including the trailing blank line. The `return (<div className="space-y-6">` line immediately before it, and the `<Card>` block immediately after it (the next card in the file), stay exactly as they are — this leaves the `<div className="space-y-6">` wrapper's first child as that next `<Card>`.

Do not change `canEdit`'s declaration (`const canEdit = useMemo(...)`, earlier in the file) — it's still used by the SMTP/IMAP save button and the read-only notice further down in this same file.

- [ ] **Step 5: Delete the now-orphaned file**

Delete `src/features/module-communications/components/email/DomainManagement.tsx` entirely. Confirm nothing else imports it: `grep -rn "from \"./DomainManagement\"\|from '\./DomainManagement'\|email/DomainManagement" src/` should return no results after this deletion (other than this plan/spec's own documentation, if grepped over `docs/`).

- [ ] **Step 6: Remove the now-meaningless test mock**

In `src/features/module-communications/components/email/EmailClientSettings.test.tsx`, find this block (currently lines 5-7):

```typescript
vi.mock('./DomainManagement', () => ({
  DomainManagement: () => <div data-testid="domain-management" />,
}));
```

Delete it entirely. The other `vi.mock(...)` calls in this file (for `./EmailAccountDialog`, `@/components/ui/use-toast`, etc.) stay unchanged.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/features/module-communications/components/email/EmailClientSettings.test.tsx`
Expected: 4 passed (the 3 pre-existing tests plus the new one).

- [ ] **Step 8: Run the broader Email Management test suite as a sanity check**

Run: `npx vitest run src/pages/dashboard/EmailManagement.test.tsx src/features/module-communications/components/email/`
Expected: all passing — this confirms the "Domains" tab's own test (`EmailManagement.test.tsx`) and any other test file under `email/` are unaffected by this removal.

- [ ] **Step 9: Lint**

Run: `npx eslint src/features/module-communications/components/email/EmailClientSettings.tsx src/features/module-communications/components/email/EmailClientSettings.test.tsx`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src/features/module-communications/components/email/EmailClientSettings.tsx src/features/module-communications/components/email/EmailClientSettings.test.tsx
git rm src/features/module-communications/components/email/DomainManagement.tsx
git commit -m "fix(email-ui): remove duplicate Domain Management card from EmailClientSettings"
```
