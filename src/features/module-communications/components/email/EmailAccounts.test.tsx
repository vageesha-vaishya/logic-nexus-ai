import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createChainableQuery } from '../../../../../test/supabaseQueryMock';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toasts: [],
    toast: vi.fn(),
    dismiss: vi.fn(),
  }),
}));
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
    const badge = await within(cardEl).findByText('Needs Re-auth');
    expect(badge.className).toContain('bg-status-warning');
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
