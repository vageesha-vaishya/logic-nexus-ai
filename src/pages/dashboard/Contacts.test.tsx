import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Contacts from './Contacts';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/CRMModuleHeaderNavigation', () => ({
  CRMModuleHeaderNavigation: () => <div data-testid="crm-module-header-nav" />,
  CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: [],
}));

const mockContacts = [
  { id: 'contact-1', first_name: 'Jane', last_name: 'Doe', title: 'Director of Ops', email: 'jane@example.com', phone: '+15551234567', account_id: 'acc-1', accounts: { name: 'Acme Logistics' }, created_at: new Date().toISOString() },
  { id: 'contact-2', first_name: 'John', last_name: 'Smith', title: null, email: 'john@example.com', phone: null, account_id: null, accounts: null, created_at: new Date().toISOString() },
];

const stableScopedDb = {
  accessContext: {},
  from: vi.fn((table: string) => {
    if (table === 'v_contacts') return createChainableQuery({ data: mockContacts, error: null, count: mockContacts.length });
    return createChainableQuery({ data: [], error: null, count: 0 });
  }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
    scopedDb: stableScopedDb,
  }),
}));

describe('Contacts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the contacts list without crashing', async () => {
    render(
      <BrowserRouter>
        <Contacts />
      </BrowserRouter>,
    );

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search contacts...')).toBeInTheDocument();
  });
});
