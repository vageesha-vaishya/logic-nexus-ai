import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Accounts from './Accounts';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/system/FirstScreenTemplate', () => ({
  FirstScreenTemplate: ({ children, title }: any) => (
    <div data-testid="first-screen-template">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('@/components/crm/CRMModuleHeaderNavigation', () => ({
  CRMModuleHeaderNavigation: () => <div data-testid="crm-module-header-nav" />,
  CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: [],
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

const makeAccount = (i: number) => ({
  id: `acc-${i}`,
  name: `Account ${i}`,
  account_type: 'customer',
  status: 'active',
  industry: 'Logistics',
  phone: null,
  email: null,
  website: null,
  created_at: new Date(2024, 0, 1 + (i % 28)).toISOString(),
});

const mockAccounts = [
  { id: 'acc-1', name: 'Acme Logistics', account_type: 'customer', status: 'active', industry: 'Logistics', phone: '+15551234567', email: 'acme@example.com', website: null, created_at: new Date().toISOString() },
  { id: 'acc-2', name: 'Globex Freight', account_type: 'prospect', status: 'pending', industry: 'Freight', phone: null, email: 'globex@example.com', website: null, created_at: new Date().toISOString() },
];

const stableScopedDb = {
  accessContext: {},
  from: vi.fn((table: string) => {
    if (table === 'v_accounts') return createChainableQuery({ data: mockAccounts, error: null, count: mockAccounts.length });
    return createChainableQuery({ data: [], error: null, count: 0 });
  }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
    scopedDb: stableScopedDb,
  }),
}));

describe('Accounts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the accounts list without crashing', async () => {
    render(
      <BrowserRouter>
        <Accounts />
      </BrowserRouter>,
    );

    expect(await screen.findByText('Acme Logistics')).toBeInTheDocument();
    expect(screen.getByText('Globex Freight')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search accounts...')).toBeInTheDocument();
  });

  it('renders at most 100 rows and offers Load more', async () => {
    localStorage.setItem(
      'crm.moduleNavigation.v1',
      JSON.stringify({
        version: 1,
        modules: { accounts: { viewMode: 'list', theme: 'Azure Sky' } },
      }),
    );

    const manyAccounts = Array.from({ length: 250 }, (_, i) => makeAccount(i));
    stableScopedDb.from.mockImplementationOnce((table: string) => {
      if (table === 'v_accounts') {
        return createChainableQuery({ data: manyAccounts, error: null, count: manyAccounts.length });
      }
      return createChainableQuery({ data: [], error: null, count: 0 });
    });

    render(
      <BrowserRouter>
        <Accounts />
      </BrowserRouter>,
    );

    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(101); // header + 100
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });
});
