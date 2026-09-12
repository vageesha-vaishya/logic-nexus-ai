import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AccountDetail from './AccountDetail';
import { StickyActionsProvider } from '@/components/layout/StickyActionsContext';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

const mockAccount = {
  id: 'acc-1',
  name: 'Acme Logistics',
  status: 'active',
  account_type: 'company',
  billing_street: '123 Main St',
  billing_city: 'Springfield',
  billing_state: 'IL',
  billing_postal_code: '62701',
  billing_country: 'United States',
  email: 'contact@acme.example',
  phone: '+15551234567',
  vat_number: null,
  website: null,
  logo_url: null,
  description: null,
};

const stableScopedDb = {
  from: vi.fn((table: string) => {
    if (table === 'v_accounts') return createChainableQuery({ data: mockAccount, error: null });
    return createChainableQuery({ data: [], error: null });
  }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
    scopedDb: stableScopedDb,
  }),
}));

describe('AccountDetail', () => {
  it('renders the account header and related sections without crashing', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/accounts/acc-1']}>
        <StickyActionsProvider>
          <Routes>
            <Route path="/dashboard/accounts/:id" element={<AccountDetail />} />
          </Routes>
        </StickyActionsProvider>
      </MemoryRouter>,
    );

    expect((await screen.findAllByRole('heading', { name: 'Acme Logistics' })).length).toBeGreaterThan(0);
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Edit$/i }).length).toBeGreaterThan(0);
  });
});
