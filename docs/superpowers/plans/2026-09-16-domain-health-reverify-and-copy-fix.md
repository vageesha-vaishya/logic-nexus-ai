# DomainHealth Re-Verify and DNS Copy-to-Clipboard Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an already-verified domain be re-verified, and add copy-to-clipboard buttons to every DNS record value shown in `DomainHealth.tsx`'s "DNS" dialog.

**Architecture:** Remove the `|| domain.is_verified` clause from the "Verify" button's `disabled` prop; add one `handleCopy` helper (clipboard write + `sonner` toast, matching this file's existing toast library) and one small icon-only `Copy` button per DNS record value in the dialog.

**Tech Stack:** React + TypeScript, vitest + Testing Library, `lucide-react` icons, `sonner` toasts (all already used by this file).

## Global Constraints

- Confined to `src/features/module-communications/components/email/DomainHealth.tsx` and its new test file — no change to `domains-verify`, `domains-register`, `DomainVerificationService.ts`, `tenant_domains`, or any other file.
- No change to the "Verify" button's label/text, only its `disabled` condition.
- `sonner`'s `toast` (already imported in this file) is the toast library for the new copy-success/error messages — not shadcn's `use-toast`.
- Full spec: `docs/superpowers/specs/2026-09-16-domain-health-reverify-and-copy-fix-design.md`.

---

### Task 1: Restore re-verify and add DNS record copy buttons

**Files:**
- Modify: `src/features/module-communications/components/email/DomainHealth.tsx:1-10` (add one import), `:132-138` (unchanged, for reference), `:184-228` (DNS dialog — add copy buttons), `:292-303` (Verify button — remove disable condition)
- Test: `src/features/module-communications/components/email/DomainHealth.test.tsx` (new — no test file exists for this component today)

**Interfaces:**
- Consumes: `DomainVerificationService.getDomains()` / `.verifyDomain(domainId: string)` (`src/services/email/DomainVerificationService.ts`, unchanged, already-existing signatures), `useAuth()` (`@/hooks/useAuth`, unchanged, already-existing `{ roles: UserRole[], isPlatformAdmin: () => boolean }` shape where `UserRole = { role: string, tenant_id: string | null, franchise_id: string | null }`).
- Produces: nothing consumed elsewhere — this is the only task in this plan.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/module-communications/components/email/DomainHealth.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as authHooks from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

const getDomainsMock = vi.fn();
const verifyDomainMock = vi.fn();
vi.mock('@/services/email/DomainVerificationService', () => ({
  DomainVerificationService: {
    getDomains: (...args: unknown[]) => getDomainsMock(...args),
    verifyDomain: (...args: unknown[]) => verifyDomainMock(...args),
    addDomain: vi.fn(),
    deleteDomain: vi.fn(),
  },
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

import { DomainHealth } from './DomainHealth';

function verifiedDomain() {
  return {
    id: 'domain-1',
    tenant_id: 'tenant-1',
    domain_name: 'example.com',
    is_verified: true,
    // Deliberately different from handleViewDns's hardcoded SPF/DMARC
    // default strings below (a pre-existing, unrelated quirk: that
    // function always shows a fixed default for SPF/DMARC regardless of
    // the domain's own spf_record/dmarc_record -- not something this
    // plan touches). Using different values here proves the copy
    // buttons copy what the dialog actually displays, not this fixture.
    spf_record: 'v=spf1 include:some-other-provider.com ~all',
    spf_verified: true,
    dkim_record: undefined,
    dkim_verified: true,
    dmarc_record: 'v=DMARC1; p=quarantine;',
    dmarc_verified: true,
    provider_metadata: { dkim_tokens: ['abc123token'] },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('DomainHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHooks.useAuth).mockReturnValue({
      roles: [{ role: 'admin', tenant_id: 'tenant-1', franchise_id: null }],
      isPlatformAdmin: () => false,
    } as ReturnType<typeof authHooks.useAuth>);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('keeps the Verify button enabled for an already-verified domain', async () => {
    getDomainsMock.mockResolvedValue([verifiedDomain()]);
    render(<DomainHealth />);

    const verifyButton = await screen.findByRole('button', { name: 'Verify' });
    expect(verifyButton).not.toBeDisabled();
  });

  it('calls verifyDomain when Verify is clicked on an already-verified domain', async () => {
    getDomainsMock.mockResolvedValue([verifiedDomain()]);
    verifyDomainMock.mockResolvedValue({
      success: true,
      domain: 'example.com',
      results: { spf: true, dkim: true, dmarc: true },
      updates: {},
    });
    const user = userEvent.setup();
    render(<DomainHealth />);

    const verifyButton = await screen.findByRole('button', { name: 'Verify' });
    await user.click(verifyButton);

    expect(verifyDomainMock).toHaveBeenCalledWith('domain-1');
  });

  it('copies the exact SPF value when its copy button is clicked', async () => {
    getDomainsMock.mockResolvedValue([verifiedDomain()]);
    const user = userEvent.setup();
    render(<DomainHealth />);

    const dnsButton = await screen.findByRole('button', { name: 'DNS' });
    await user.click(dnsButton);

    const copyButton = await screen.findByRole('button', { name: 'Copy SPF record' });
    await user.click(copyButton);

    // Asserts the hardcoded default handleViewDns always shows for SPF
    // (not the fixture's spf_record, which is deliberately a different
    // string above) -- proves the button copies what's actually
    // rendered in the dialog.
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('v=spf1 include:amazonses.com ~all');
    expect(toastSuccessMock).toHaveBeenCalledWith('Copied to clipboard.');
  });

  it('copies the exact DMARC value when its copy button is clicked', async () => {
    getDomainsMock.mockResolvedValue([verifiedDomain()]);
    const user = userEvent.setup();
    render(<DomainHealth />);

    const dnsButton = await screen.findByRole('button', { name: 'DNS' });
    await user.click(dnsButton);

    const copyButton = await screen.findByRole('button', { name: 'Copy DMARC record' });
    await user.click(copyButton);

    // Same reasoning as the SPF test above: handleViewDns's hardcoded
    // DMARC default, deliberately different from the fixture's
    // dmarc_record.
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('v=DMARC1; p=none;');
  });

  it('copies the exact DKIM record name and value from their own copy buttons', async () => {
    getDomainsMock.mockResolvedValue([verifiedDomain()]);
    const user = userEvent.setup();
    render(<DomainHealth />);

    const dnsButton = await screen.findByRole('button', { name: 'DNS' });
    await user.click(dnsButton);

    const copyNameButton = await screen.findByRole('button', { name: 'Copy DKIM record name' });
    await user.click(copyNameButton);
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('abc123token._domainkey.example.com');

    const copyValueButton = await screen.findByRole('button', { name: 'Copy DKIM record value' });
    await user.click(copyValueButton);
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('abc123token.dkim.amazonses.com');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail against the current, buggy code**

Run: `npx vitest run src/features/module-communications/components/email/DomainHealth.test.tsx`
Expected: the first test fails (`expect(verifyButton).not.toBeDisabled()` — the button is currently disabled for a verified domain). The remaining 4 tests fail with "Unable to find an accessible element with the role 'button' and name '...'" (the copy buttons don't exist yet). If any test fails with a different error (e.g., a mock-setup error before ever finding elements), stop and debug the test file itself before proceeding.

- [ ] **Step 3: Apply Fix 1 — restore re-verify**

In `src/features/module-communications/components/email/DomainHealth.tsx`, find this line (currently within the "Verify" `Button`, around line 296):

```typescript
                          disabled={verifying === domain.id || domain.is_verified}
```

Replace with:

```typescript
                          disabled={verifying === domain.id}
```

No other line in this button, or the row around it, changes.

- [ ] **Step 4: Apply Fix 2 — add the copy helper and copy buttons**

Add the `Copy` icon to the existing `lucide-react` import (currently line 10):

```typescript
import { CheckCircle2, XCircle, RefreshCw, Plus, Trash2, Globe, AlertTriangle } from "lucide-react";
```

Replace with:

```typescript
import { CheckCircle2, XCircle, RefreshCw, Plus, Trash2, Globe, AlertTriangle, Copy } from "lucide-react";
```

Add this helper function next to the file's other handlers (e.g., directly after `handleDelete`, before the `StatusIcon` component definition):

```typescript
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };
```

Then find the DNS dialog's content block (currently lines 193-222):

```typescript
              {dnsDialogData && (
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">DKIM (CNAME Records)</h3>
                    <div className="border rounded-md divide-y">
                      {dnsDialogData.dkim.map((record, i) => (
                        <div key={i} className="p-3 grid grid-cols-12 gap-4 text-sm">
                          <div className="col-span-5 font-mono break-all text-xs bg-muted p-2 rounded">{record.name}</div>
                          <div className="col-span-1 flex items-center justify-center text-muted-foreground">CNAME</div>
                          <div className="col-span-6 font-mono break-all text-xs bg-muted p-2 rounded">{record.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">SPF (TXT Record)</h3>
                    <div className="p-3 border rounded-md bg-muted font-mono text-xs break-all">
                      {dnsDialogData.spf}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">DMARC (TXT Record)</h3>
                    <div className="p-3 border rounded-md bg-muted font-mono text-xs break-all">
                      {dnsDialogData.dmarc}
                    </div>
                  </div>
                </div>
              )}
```

Replace with:

```typescript
              {dnsDialogData && (
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">DKIM (CNAME Records)</h3>
                    <div className="border rounded-md divide-y">
                      {dnsDialogData.dkim.map((record, i) => (
                        <div key={i} className="p-3 grid grid-cols-12 gap-4 text-sm">
                          <div className="col-span-5 flex items-center gap-1">
                            <span className="font-mono break-all text-xs bg-muted p-2 rounded flex-1">{record.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Copy DKIM record name"
                              onClick={() => handleCopy(record.name)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="col-span-1 flex items-center justify-center text-muted-foreground">CNAME</div>
                          <div className="col-span-6 flex items-center gap-1">
                            <span className="font-mono break-all text-xs bg-muted p-2 rounded flex-1">{record.value}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Copy DKIM record value"
                              onClick={() => handleCopy(record.value)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">SPF (TXT Record)</h3>
                    <div className="p-3 border rounded-md bg-muted font-mono text-xs break-all flex items-center gap-2">
                      <span className="flex-1">{dnsDialogData.spf}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy SPF record"
                        onClick={() => handleCopy(dnsDialogData.spf)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">DMARC (TXT Record)</h3>
                    <div className="p-3 border rounded-md bg-muted font-mono text-xs break-all flex items-center gap-2">
                      <span className="flex-1">{dnsDialogData.dmarc}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy DMARC record"
                        onClick={() => handleCopy(dnsDialogData.dmarc)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
```

No other line in the file changes.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/module-communications/components/email/DomainHealth.test.tsx`
Expected: 5 passed.

- [ ] **Step 6: Run the broader Email Management test suite as a sanity check**

Run: `npx vitest run src/pages/dashboard/EmailManagement.test.tsx src/features/module-communications/components/email/`
Expected: all passing — confirms this change doesn't affect `EmailClientSettings.test.tsx` or `EmailManagement.test.tsx`, which don't touch `DomainHealth.tsx`'s internals.

- [ ] **Step 7: Lint**

Run: `npx eslint src/features/module-communications/components/email/DomainHealth.tsx src/features/module-communications/components/email/DomainHealth.test.tsx`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/features/module-communications/components/email/DomainHealth.tsx src/features/module-communications/components/email/DomainHealth.test.tsx
git commit -m "fix(email-ui): let already-verified domains be re-verified, add DNS record copy buttons"
```
