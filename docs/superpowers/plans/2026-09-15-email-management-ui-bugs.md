# Email Management UI Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three confirmed, isolated bugs on `/dashboard/email-management`
— a duplicate "Templates" tab hiding a real feature, a stale tab label,
and a misleading account-status badge — plus one directly-adjacent color-
token fix, with zero behavior change to anything else on the page and zero
backend/data changes.

**Architecture:** Two independent tasks, one per file: `EmailManagement.tsx`
(the tab bar — Fixes 1 and 2) and `EmailAccounts.tsx` (the status badge —
Fix 3 plus the adjacent warning-box token fix). Neither task depends on
the other.

**Tech Stack:** React 18 + TypeScript, Radix `Tabs` (`@/components/ui/tabs`),
Tailwind CSS with this project's semantic status-color tokens, vitest +
`@testing-library/react`.

## Global Constraints

- No backend, database, or edge-function change of any kind — pure
  frontend fix across two files.
- No behavior change beyond the three named fixes and the one directly-
  adjacent token-consistency fix under Task 2 — no other `TabsTrigger`/
  `TabsContent` pairing in `EmailManagement.tsx` changes, no other status-
  badge or warning logic in `EmailAccounts.tsx` changes.
- Any new or touched color must use this project's semantic status tokens
  (`bg-status-warning`/`text-status-warning-foreground`/`border-status-warning-border`,
  matching the existing `bg-status-success`/`text-status-success-foreground`/`border-status-success-border`
  convention already in `EmailAccounts.tsx`) — never a raw Tailwind
  palette color.
- Full spec: `docs/superpowers/specs/2026-09-15-email-management-ui-bugs-design.md`.

---

### Task 1: Restore the hidden "Email Client" tab; rename "Routing Rules" → "Queue Rules"

**Files:**
- Modify: `src/pages/dashboard/EmailManagement.tsx:114-141`
- Test: `src/pages/dashboard/EmailManagement.test.tsx` (new)

**Interfaces:**
- Consumes: `EmailClientSettings` (`@/features/module-communications/components/email/EmailClientSettings`,
  default export, no props) — already imported at line 14, already
  rendered by the existing `TabsContent value="clients"` block at
  lines 161-163. This task does not change that import or that
  `TabsContent` block — only which `TabsTrigger` points at `value="clients"`.
- Produces: nothing consumed by Task 2 — these two tasks are independent.

- [ ] **Step 1: Write the failing tests**

The page renders inside `DashboardLayout` and pulls in ten heavy feature
components as its tab panels. Mock all of them as simple `data-testid`
stubs — this repo's established convention for page-level tab/nav tests
(see `src/pages/dashboard/LeadDetail.test.tsx`'s mocks for the same
pattern).

```typescript
// src/pages/dashboard/EmailManagement.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmailManagement from './EmailManagement';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/features/module-communications/components/email/EmailInbox', () => ({
  EmailInbox: () => <div data-testid="email-inbox" />,
}));
vi.mock('@/features/module-communications/components/email/EmailAccounts', () => ({
  EmailAccounts: () => <div data-testid="email-accounts" />,
}));
vi.mock('@/features/module-communications/components/email/EmailFilters', () => ({
  EmailFilters: () => <div data-testid="email-filters" />,
}));
vi.mock('@/features/module-communications/components/email/EmailTemplates', () => ({
  EmailTemplates: () => <div data-testid="email-templates" />,
}));
vi.mock('@/features/module-communications/components/email/OAuthSettings', () => ({
  OAuthSettings: () => <div data-testid="oauth-settings" />,
}));
vi.mock('@/features/module-communications/components/email/ComplianceSettings', () => ({
  ComplianceSettings: () => <div data-testid="compliance-settings" />,
}));
vi.mock('@/features/module-communications/components/email/QueueRulesManager', () => ({
  QueueRulesManager: () => <div data-testid="queue-rules-manager" />,
}));
vi.mock('@/features/module-communications/components/email/SequencesList', () => ({
  SequencesList: () => <div data-testid="sequences-list" />,
}));
vi.mock('@/features/module-communications/components/email/EmailClientSettings', () => ({
  EmailClientSettings: () => <div data-testid="email-client-settings" />,
}));
vi.mock('@/features/module-communications/components/email/DomainHealth', () => ({
  DomainHealth: () => <div data-testid="domain-health" />,
}));

describe('EmailManagement tabs', () => {
  it('renders exactly one tab labeled "Templates"', () => {
    render(<EmailManagement />);
    expect(screen.getAllByRole('tab', { name: 'Templates' })).toHaveLength(1);
  });

  it('renders an "Email Client" tab that opens EmailClientSettings', async () => {
    const user = userEvent.setup();
    render(<EmailManagement />);
    await user.click(screen.getByRole('tab', { name: 'Email Client' }));
    expect(screen.getByTestId('email-client-settings')).toBeInTheDocument();
  });

  it('labels the routing tab "Queue Rules", not "Routing Rules"', () => {
    render(<EmailManagement />);
    expect(screen.getByRole('tab', { name: 'Queue Rules' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Routing Rules' })).not.toBeInTheDocument();
  });
});
```

If rendering throws on an import this list missed (the page has other
imports beyond the ten tab-panel components — `Card`, `Button`, `Input`,
`Label`, `toast` from `sonner` — these are plain presentational/utility
imports that don't need mocking), add the minimal mock needed and note it
in your report — matching how earlier plans in this project handled the
same situation for other page-level tests.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/dashboard/EmailManagement.test.tsx`
Expected: FAIL — the first test fails (`getAllByRole` finds 2 elements
named "Templates", not 1); the second fails ("Email Client" tab doesn't
exist); the third fails ("Queue Rules" tab doesn't exist, "Routing Rules"
does).

- [ ] **Step 3: Fix the duplicate "Templates" tab**

In `src/pages/dashboard/EmailManagement.tsx`, the second `TabsTrigger`
with `value="templates"` (lines 135-141) is a byte-for-byte copy of the
first (lines 86-92). Change it to:

```tsx
                <TabsTrigger 
                  value="clients" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <Server className="w-4 h-4" />
                  <span className="font-medium">Email Client</span>
                </TabsTrigger>
```

(`Server` is already imported at line 12 — it's currently unused anywhere
in this file, which is why it was almost certainly the intended icon for
this tab originally.) Do not touch the `TabsContent value="clients"`
block (lines 161-163) — it already renders `<EmailClientSettings />`
correctly; it was only unreachable because no trigger pointed at it.

- [ ] **Step 4: Rename "Routing Rules" to "Queue Rules"**

In the same file, the `routing` `TabsTrigger` (lines 114-120) currently
reads:

```tsx
                <TabsTrigger 
                  value="routing" 
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  <GitBranch className="w-4 h-4" />
                  <span className="font-medium">Routing Rules</span>
                </TabsTrigger>
```

Change only the text inside the `<span>`:

```tsx
                  <span className="font-medium">Queue Rules</span>
```

Nothing else on this trigger changes — same `value`, same icon, same
`className`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/pages/dashboard/EmailManagement.test.tsx`
Expected: 3 passed.

- [ ] **Step 6: Lint**

Run: `npx eslint src/pages/dashboard/EmailManagement.tsx src/pages/dashboard/EmailManagement.test.tsx`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/pages/dashboard/EmailManagement.tsx src/pages/dashboard/EmailManagement.test.tsx
git commit -m "fix(email-management): restore hidden Email Client tab; rename Routing Rules to Queue Rules"
```

---

### Task 2: Distinguish "Needs Re-auth" from "Active"; fix the adjacent warning box's colors

**Files:**
- Modify: `src/features/module-communications/components/email/EmailAccounts.tsx:315-343`
- Test: `src/features/module-communications/components/email/EmailAccounts.test.tsx` (new)

**Interfaces:**
- Consumes: nothing from Task 1 — independent.
- Produces: nothing consumed elsewhere — this is the last task.

- [ ] **Step 1: Write the failing tests**

`EmailAccounts` fetches its data directly through the module-level
`supabase` client (`@/integrations/supabase/client`) inside a `useEffect`
on mount — two calls: `supabase.from("email_accounts").select(...)`
(account rows) and `supabase.schema("core").rpc("my_oauth_connected_email_accounts")`
(the set of account IDs with a valid OAuth token). Mock both, using this
repo's shared chainable-query helper (`test/supabaseQueryMock.ts`) for the
`.from()` call.

```typescript
// src/features/module-communications/components/email/EmailAccounts.test.tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createChainableQuery } from '../../../../../test/supabaseQueryMock';

vi.mock('@/hooks/use-toast');
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./EmailAccountDialog', () => ({
  EmailAccountDialog: () => null,
}));
vi.mock('./EmailDelegationDialog', () => ({
  EmailDelegationDialog: () => null,
}));

const ACCOUNTS = [
  { id: 'acc-reauth', provider: 'gmail', email_address: 'reauth@example.com', display_name: 'Needs Reauth', is_primary: false, is_active: true, last_sync_at: null, created_at: '2026-01-01T00:00:00Z', user_id: 'u1' },
  { id: 'acc-inactive', provider: 'office365', email_address: 'inactive@example.com', display_name: 'Inactive Account', is_primary: false, is_active: false, last_sync_at: null, created_at: '2026-01-01T00:00:00Z', user_id: 'u1' },
  { id: 'acc-active', provider: 'gmail', email_address: 'active@example.com', display_name: 'Active Account', is_primary: false, is_active: true, last_sync_at: null, created_at: '2026-01-01T00:00:00Z', user_id: 'u1' },
  { id: 'acc-smtp', provider: 'smtp', email_address: 'smtp@example.com', display_name: 'SMTP Account', is_primary: false, is_active: true, last_sync_at: null, created_at: '2026-01-01T00:00:00Z', user_id: 'u1' },
];

// acc-active and acc-smtp are "OAuth-connected" (or provider-exempt);
// acc-reauth is not connected and IS a gmail/office365 account, so it
// should show "Needs Re-auth"; acc-inactive is is_active=false, which
// always shows "Inactive" regardless of connection state.
const CONNECTED_IDS = ['acc-active'];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'email_accounts') {
        return createChainableQuery({ data: ACCOUNTS, error: null });
      }
      return createChainableQuery({ data: [], error: null });
    }),
    schema: vi.fn((name: string) => ({
      rpc: vi.fn(() =>
        name === 'core'
          ? Promise.resolve({ data: CONNECTED_IDS, error: null })
          : Promise.resolve({ data: [], error: null }),
      ),
    })),
  },
}));

import { EmailAccounts } from './EmailAccounts';

describe('EmailAccounts status badge', () => {
  it('shows "Needs Re-auth" for an active gmail/office365 account with no OAuth token', async () => {
    render(<EmailAccounts />);
    const card = await screen.findByText('Needs Reauth');
    const cardEl = card.closest('.border-2') as HTMLElement;
    expect(await within(cardEl).findByText('Needs Re-auth')).toBeInTheDocument();
    expect(within(cardEl).queryByText('Active')).not.toBeInTheDocument();
  });

  it('shows "Inactive" for an is_active=false account regardless of OAuth state', async () => {
    render(<EmailAccounts />);
    const card = await screen.findByText('Inactive Account');
    const cardEl = card.closest('.border-2') as HTMLElement;
    expect(await within(cardEl).findByText('Inactive')).toBeInTheDocument();
  });

  it('shows "Active" for a connected gmail/office365 account', async () => {
    render(<EmailAccounts />);
    const card = await screen.findByText('Active Account');
    const cardEl = card.closest('.border-2') as HTMLElement;
    expect(await within(cardEl).findByText('Active')).toBeInTheDocument();
  });

  it('shows "Active" for an smtp account, which is never subject to the re-auth check', async () => {
    render(<EmailAccounts />);
    const card = await screen.findByText('SMTP Account');
    const cardEl = card.closest('.border-2') as HTMLElement;
    expect(await within(cardEl).findByText('Active')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/module-communications/components/email/EmailAccounts.test.tsx`
Expected: FAIL on the first test only — today, `acc-reauth` shows "Active"
(the bug), so `within(cardEl).queryByText('Active')` is NOT null and the
assertion fails. The other three tests already pass today (they describe
already-correct existing behavior) — confirm this in your report; they
exist as regression guards, not as tests you're making pass.

- [ ] **Step 3: Fix the badge**

In `src/features/module-communications/components/email/EmailAccounts.tsx`,
find this block (lines 321-329 in the current file):

```tsx
                      <Badge 
                        variant="outline"
                        className={account.is_active 
                          ? "bg-status-success text-status-success-foreground border-status-success-border" 
                          : "bg-muted/50 text-muted-foreground border-border"
                        }
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
```

Replace it with a version that also checks the same needs-reauth
condition already used a few lines below (the `!connectedAccountIds.has(account.id) && (account.provider === 'gmail' || account.provider === 'office365')`
check that currently gates the warning box and the Re-authorize button):

```tsx
                      <Badge 
                        variant="outline"
                        className={
                          !account.is_active
                            ? "bg-muted/50 text-muted-foreground border-border"
                            : !connectedAccountIds.has(account.id) && (account.provider === 'gmail' || account.provider === 'office365')
                              ? "bg-status-warning text-status-warning-foreground border-status-warning-border"
                              : "bg-status-success text-status-success-foreground border-status-success-border"
                        }
                      >
                        {!account.is_active
                          ? "Inactive"
                          : !connectedAccountIds.has(account.id) && (account.provider === 'gmail' || account.provider === 'office365')
                            ? "Needs Re-auth"
                            : "Active"}
                      </Badge>
```

- [ ] **Step 4: Fix the adjacent warning box's colors**

A few lines below (lines 338-343 in the current file), the warning box
reads:

```tsx
                {!connectedAccountIds.has(account.id) && (account.provider === 'gmail' || account.provider === 'office365') && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 mb-2">
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 font-medium">
                      ⚠️ Authorization Required: Click 'Re-authorize' to complete OAuth setup
                    </p>
                  </div>
                )}
```

Change only the two `className` values to use the same semantic tokens
as the new badge state:

```tsx
                {!connectedAccountIds.has(account.id) && (account.provider === 'gmail' || account.provider === 'office365') && (
                  <div className="bg-status-warning/10 border border-status-warning-border/30 rounded-md p-3 mb-2">
                    <p className="text-xs text-status-warning-foreground font-medium">
                      ⚠️ Authorization Required: Click 'Re-authorize' to complete OAuth setup
                    </p>
                  </div>
                )}
```

The condition, the icon/text content, and everything else on this block
stays identical — only the two `className` strings change.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/module-communications/components/email/EmailAccounts.test.tsx`
Expected: 4 passed.

- [ ] **Step 6: Lint**

Run: `npx eslint src/features/module-communications/components/email/EmailAccounts.tsx src/features/module-communications/components/email/EmailAccounts.test.tsx`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/module-communications/components/email/EmailAccounts.tsx src/features/module-communications/components/email/EmailAccounts.test.tsx
git commit -m "fix(email-management): distinguish Needs Re-auth from Active; use status-warning tokens"
```
