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

const writeTextMock = vi.fn().mockResolvedValue(undefined);

describe('DomainHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHooks.useAuth).mockReturnValue({
      roles: [{ role: 'admin', tenant_id: 'tenant-1', franchise_id: null }],
      isPlatformAdmin: () => false,
    } as ReturnType<typeof authHooks.useAuth>);

    // Setup mock clipboard - must be configurable for userEvent to work
    const mockClipboard = {
      writeText: writeTextMock,
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
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

    // Re-setup mock after userEvent.setup
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<DomainHealth />);

    const dnsButton = await screen.findByRole('button', { name: 'DNS' });
    await user.click(dnsButton);

    const copyButton = await screen.findByRole('button', { name: 'Copy SPF record' });
    await user.click(copyButton);

    // Asserts the hardcoded default handleViewDns always shows for SPF
    // (not the fixture's spf_record, which is deliberately a different
    // string above) -- proves the button copies what's actually
    // rendered in the dialog.
    expect(writeTextMock).toHaveBeenCalledWith('v=spf1 include:amazonses.com ~all');
    expect(toastSuccessMock).toHaveBeenCalledWith('Copied to clipboard.');
  });

  it('copies the exact DMARC value when its copy button is clicked', async () => {
    getDomainsMock.mockResolvedValue([verifiedDomain()]);
    const user = userEvent.setup();

    // Re-setup mock after userEvent.setup
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<DomainHealth />);

    const dnsButton = await screen.findByRole('button', { name: 'DNS' });
    await user.click(dnsButton);

    const copyButton = await screen.findByRole('button', { name: 'Copy DMARC record' });
    await user.click(copyButton);

    // Same reasoning as the SPF test above: handleViewDns's hardcoded
    // DMARC default, deliberately different from the fixture's
    // dmarc_record.
    expect(writeTextMock).toHaveBeenCalledWith('v=DMARC1; p=none;');
  });

  it('copies the exact DKIM record name and value from their own copy buttons', async () => {
    getDomainsMock.mockResolvedValue([verifiedDomain()]);
    const user = userEvent.setup();

    // Re-setup mock after userEvent.setup
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<DomainHealth />);

    const dnsButton = await screen.findByRole('button', { name: 'DNS' });
    await user.click(dnsButton);

    const copyNameButton = await screen.findByRole('button', { name: 'Copy DKIM record name' });
    await user.click(copyNameButton);
    expect(writeTextMock).toHaveBeenLastCalledWith('abc123token._domainkey.example.com');

    const copyValueButton = await screen.findByRole('button', { name: 'Copy DKIM record value' });
    await user.click(copyValueButton);
    expect(writeTextMock).toHaveBeenLastCalledWith('abc123token.dkim.amazonses.com');
  });
});
