import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OpportunityDetail from './OpportunityDetail';
import { StickyActionsProvider } from '@/components/layout/StickyActionsContext';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/OpportunityItemsEditor', () => ({
  OpportunityItemsEditor: () => <div data-testid="opportunity-items-editor" />,
}));

const mockOpportunity = {
  id: 'opp-1',
  name: 'Acme Logistics Expansion',
  stage: 'proposal',
  amount: 50000,
  probability: 60,
  close_date: '2026-06-01',
  expected_revenue: 30000,
  created_at: new Date().toISOString(),
  account_id: 'acc-1',
  contact_id: null,
  owner_id: 'user-1',
  franchise_id: null,
  tenant_id: 'tenant-1',
  accounts: { name: 'Acme Logistics' },
  contacts: null,
  leads: null,
  salesforce_sync_status: null,
  salesforce_last_synced: null,
  salesforce_error: null,
};

const stableScopedDb = {
  from: vi.fn((table: string) => {
    if (table === 'opportunities') return createChainableQuery({ data: mockOpportunity, error: null });
    if (table === 'quotes') return createChainableQuery({ data: [], error: null });
    return createChainableQuery({ data: [], error: null });
  }),
};

const stableSupabase = {
  auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
};
const stableContext = { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null };

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: stableSupabase,
    context: stableContext,
    scopedDb: stableScopedDb,
  }),
}));

describe('OpportunityDetail', () => {
  it('renders the opportunity header and details tab without crashing', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/opportunities/opp-1']}>
        <StickyActionsProvider>
          <Routes>
            <Route path="/dashboard/opportunities/:id" element={<OpportunityDetail />} />
          </Routes>
        </StickyActionsProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Acme Logistics Expansion' })).toBeInTheDocument();
    expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    expect(screen.getByTestId('opportunity-items-editor')).toBeInTheDocument();
  });
});
