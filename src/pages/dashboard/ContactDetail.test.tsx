import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContactDetail from './ContactDetail';
import { StickyActionsProvider } from '@/components/layout/StickyActionsContext';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/features/module-communications/components/email/EmailHistoryPanel', () => ({
  EmailHistoryPanel: () => <div data-testid="email-history-panel" />,
}));

const mockContact = {
  id: 'contact-1',
  first_name: 'Jane',
  last_name: 'Doe',
  title: 'Director of Ops',
  email: 'jane.doe@example.com',
  phone: '+15551234567',
  mobile: null,
  department: null,
  lead_source: null,
  lifecycle_stage: null,
  custom_fields: null,
  is_primary: false,
  tenant_id: 'tenant-1',
  accounts: { name: 'Acme Logistics' },
};

const stableScopedDb = {
  from: vi.fn((table: string) => {
    if (table === 'v_contacts') return createChainableQuery({ data: mockContact, error: null });
    return createChainableQuery({ data: [], error: null });
  }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
    scopedDb: stableScopedDb,
  }),
}));

describe('ContactDetail', () => {
  it('renders the contact header and related sections without crashing', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/contacts/contact-1']}>
        <StickyActionsProvider>
          <Routes>
            <Route path="/dashboard/contacts/:id" element={<ContactDetail />} />
          </Routes>
        </StickyActionsProvider>
      </MemoryRouter>,
    );

    expect((await screen.findAllByRole('heading', { name: 'Jane Doe' })).length).toBeGreaterThan(0);
    expect(screen.getByText('Director of Ops')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Edit$/i }).length).toBeGreaterThan(0);
  });
});
