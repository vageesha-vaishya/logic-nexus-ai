# EmailAccountDialog OAuth Silent-Failure Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `EmailAccountDialog.tsx`'s OAuth-connect failures actually visible to the user, by adding the two missing `await` keywords that currently let a real error become a silent, unhandled promise rejection.

**Architecture:** Two lines change in `handleConnect`, adding `await` before `initiateGoogleOAuth(...)` and `initiateMicrosoftOAuth(...)` — mirroring the already-correct pattern in `EmailAutoSetup.tsx`'s `handleOAuth`. The existing `try/catch` and its error toast are otherwise untouched; they only needed the rejection to actually reach them.

**Tech Stack:** React + TypeScript, vitest + Testing Library (existing conventions in this directory).

## Global Constraints

- Confined to `src/features/module-communications/components/email/EmailAccountDialog.tsx` and its new test file — no change to `EmailAutoSetup.tsx`, `src/lib/oauth.ts`, or any other file.
- No change to toast messages, button labels, or any UI text — only the two `await` keywords are added.
- Full spec: `docs/superpowers/specs/2026-09-16-email-account-dialog-oauth-await-fix-design.md`.

---

### Task 1: Fix the missing await and add regression tests

**Files:**
- Modify: `src/features/module-communications/components/email/EmailAccountDialog.tsx:107-111`
- Test: `src/features/module-communications/components/email/EmailAccountDialog.test.tsx` (new — no test file exists for this component today)

**Interfaces:**
- Consumes: `initiateGoogleOAuth(userId: string)` / `initiateMicrosoftOAuth(userId: string)` (`src/lib/oauth.ts`, unchanged — both already `async`, already `throw` on failure).
- Produces: nothing consumed elsewhere — this is the only task in this plan.

- [ ] **Step 1: Write the failing tests**

Passing an `account` prop makes `EmailAccountDialog` skip straight to
its manual provider-tabs view (confirmed by reading the component's own
`useEffect`: `if (account) { setMode('manual'); setProviderId(account.provider); ... }`)
— this avoids needing to interact with the separate `EmailAutoSetup`
sub-component at all, since these tests are about `handleConnect`, not
the auto-detect flow.

```typescript
// src/features/module-communications/components/email/EmailAccountDialog.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const initiateGoogleOAuthMock = vi.fn();
const initiateMicrosoftOAuthMock = vi.fn();
vi.mock('@/lib/oauth', () => ({
  initiateGoogleOAuth: (...args: unknown[]) => initiateGoogleOAuthMock(...args),
  initiateMicrosoftOAuth: (...args: unknown[]) => initiateMicrosoftOAuthMock(...args),
  handleOAuthCallback: vi.fn(),
}));

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
  useToast: () => ({ toast: (...args: unknown[]) => toastMock(...args) }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ context: { userId: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

import { EmailAccountDialog } from './EmailAccountDialog';

function officeAccount() {
  return {
    id: 'acc-1',
    provider: 'office365',
    email_address: 'existing@outlook.com',
    display_name: 'Existing Account',
    is_primary: false,
  };
}

function gmailAccount() {
  return {
    id: 'acc-2',
    provider: 'gmail',
    email_address: 'existing@gmail.com',
    display_name: 'Existing Gmail',
    is_primary: false,
  };
}

describe('EmailAccountDialog OAuth connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error toast when Microsoft OAuth initiation rejects (the exact production failure)', async () => {
    initiateMicrosoftOAuthMock.mockRejectedValue(
      new Error('Office 365 OAuth not configured. System administrator must set VITE_MICROSOFT_CLIENT_ID or User must provide custom configuration.'),
    );
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={officeAccount()}
        onSuccess={vi.fn()}
      />,
    );

    const connectButton = await screen.findByRole('button', { name: /Connect with Microsoft Office 365/i });
    await user.click(connectButton);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Office 365 OAuth not configured. System administrator must set VITE_MICROSOFT_CLIENT_ID or User must provide custom configuration.',
          variant: 'destructive',
        }),
      ),
    );
  });

  it('shows an error toast when Google OAuth initiation rejects (same defect, other branch)', async () => {
    initiateGoogleOAuthMock.mockRejectedValue(new Error('Gmail OAuth not configured for this test.'));
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={gmailAccount()}
        onSuccess={vi.fn()}
      />,
    );

    const connectButton = await screen.findByRole('button', { name: /Connect with Gmail/i });
    await user.click(connectButton);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Gmail OAuth not configured for this test.',
          variant: 'destructive',
        }),
      ),
    );
  });

  it('does not show an error toast when Google OAuth initiation succeeds', async () => {
    initiateGoogleOAuthMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={gmailAccount()}
        onSuccess={vi.fn()}
      />,
    );

    const connectButton = await screen.findByRole('button', { name: /Connect with Gmail/i });
    await user.click(connectButton);

    await waitFor(() => expect(initiateGoogleOAuthMock).toHaveBeenCalledWith('user-1'));
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail against the current, buggy code**

Run: `npx vitest run src/features/module-communications/components/email/EmailAccountDialog.test.tsx`
Expected: the first two tests FAIL — `toastMock` is never called with the
error, because the rejection from `initiateMicrosoftOAuthMock`/
`initiateGoogleOAuthMock` currently becomes an unhandled promise
rejection that never reaches `handleConnect`'s `catch` block (this may
also print an "unhandled rejection" warning in the test output — that is
expected and matches the exact defect being fixed, not a new problem).
The third test (the passing-path sanity check) should already pass,
since nothing about the happy path is broken today. If the third test
fails too, stop and debug the test file itself before proceeding — that
would indicate a setup problem unrelated to the bug this task fixes.

- [ ] **Step 3: Apply the fix**

In `src/features/module-communications/components/email/EmailAccountDialog.tsx`,
find this block (currently lines 107-111):

```typescript
      if (provider === "gmail") {
        initiateGoogleOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
      } else if (provider === "office365") {
        initiateMicrosoftOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
      } else {
        setMode('manual');
      }
```

Replace with:

```typescript
      if (provider === "gmail") {
        await initiateGoogleOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
      } else if (provider === "office365") {
        await initiateMicrosoftOAuth(context.userId || (supabase.auth.getUser() as any)?.id);
      } else {
        setMode('manual');
      }
```

No other line in `handleConnect`, or anywhere else in the file, changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/module-communications/components/email/EmailAccountDialog.test.tsx`
Expected: 3 passed.

- [ ] **Step 5: Run the broader Email Management test suite as a sanity check**

Run: `npx vitest run src/pages/dashboard/EmailManagement.test.tsx src/features/module-communications/components/email/`
Expected: all passing — confirms this change doesn't affect
`EmailClientSettings.test.tsx`, `DomainHealth.test.tsx`,
`EmailAccounts.test.tsx`, or `EmailManagement.test.tsx`, none of which
touch `EmailAccountDialog.tsx`'s internals.

- [ ] **Step 6: Lint**

Run: `npx eslint src/features/module-communications/components/email/EmailAccountDialog.tsx src/features/module-communications/components/email/EmailAccountDialog.test.tsx`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/module-communications/components/email/EmailAccountDialog.tsx src/features/module-communications/components/email/EmailAccountDialog.test.tsx
git commit -m "fix(email-ui): await OAuth initiation in EmailAccountDialog so failures aren't silently swallowed"
```
