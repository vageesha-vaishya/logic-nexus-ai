import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ContactsPipeline from './ContactsPipeline';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/CRMModuleHeaderNavigation', () => ({
  CRMModuleHeaderNavigation: () => <div data-testid="crm-module-header-nav" />,
  CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: [],
}));

const mockContacts = [
  { id: 'contact-1', account_id: null, first_name: 'Jane', last_name: 'Doe', title: 'Director of Ops', email: 'jane@example.com', phone: '+15551234567', is_primary: true, created_at: new Date().toISOString() },
  { id: 'contact-2', account_id: null, first_name: 'John', last_name: 'Smith', title: null, email: null, phone: null, is_primary: false, created_at: new Date().toISOString() },
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

describe('ContactsPipeline', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders contact stage columns without a broken drag affordance', async () => {
    render(
      <BrowserRouter>
        <ContactsPipeline />
      </BrowserRouter>,
    );

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    // Regression guard: no dnd-kit draggable/droppable roles should be present
    // now that the unwired drag-and-drop affordance has been removed.
    expect(document.querySelectorAll('[aria-roledescription="draggable"]').length).toBe(0);
  });
});
