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
});
