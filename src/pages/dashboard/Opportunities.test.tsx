import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Opportunities from './Opportunities';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/CRMModuleHeaderNavigation', () => ({
  CRMModuleHeaderNavigation: () => <div data-testid="crm-module-header-nav" />,
  CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: [],
}));

const mockOpportunities = [
  { id: 'opp-1', name: 'Acme Logistics Expansion', stage: 'proposal', amount: 50000, probability: 60, close_date: null, accounts: { name: 'Acme Logistics' }, created_at: new Date().toISOString() },
  { id: 'opp-2', name: 'Globex Freight Renewal', stage: 'closed_won', amount: 25000, probability: 100, close_date: null, accounts: { name: 'Globex Freight' }, created_at: new Date().toISOString() },
];

const stableScopedDb = {
  accessContext: {},
  from: vi.fn((table: string) => {
    if (table === 'opportunities') return createChainableQuery({ data: mockOpportunities, error: null, count: mockOpportunities.length });
    return createChainableQuery({ data: [], error: null, count: 0 });
  }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
    scopedDb: stableScopedDb,
  }),
}));

describe('Opportunities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the opportunities list and summary cards without crashing', async () => {
    render(
      <BrowserRouter>
        <Opportunities />
      </BrowserRouter>,
    );

    expect(await screen.findByText('Acme Logistics Expansion')).toBeInTheDocument();
    expect(screen.getByText('Globex Freight Renewal')).toBeInTheDocument();
    expect(screen.getByText('Total Pipeline Value')).toBeInTheDocument();
    expect(screen.getByText('$75,000.00')).toBeInTheDocument();
  });
});
