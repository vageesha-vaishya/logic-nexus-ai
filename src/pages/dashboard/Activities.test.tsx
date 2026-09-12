import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Activities from './Activities';
import { StickyActionsProvider } from '@/components/layout/StickyActionsContext';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/CRMModuleHeaderNavigation', () => ({
  CRMModuleHeaderNavigation: () => <div data-testid="crm-module-header-nav" />,
  CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: [],
}));

const mockActivities = [
  { id: 'activity-1', activity_type: 'call', status: 'planned', priority: 'medium', subject: 'Follow-up call', description: null, due_date: null, completed_at: null, created_at: new Date().toISOString(), account_id: null, contact_id: null, lead_id: null, assigned_to: null, leads: null, accounts: null, contacts: null },
  { id: 'activity-2', activity_type: 'email', status: 'completed', priority: 'low', subject: 'Send proposal', description: null, due_date: null, completed_at: new Date().toISOString(), created_at: new Date().toISOString(), account_id: null, contact_id: null, lead_id: null, assigned_to: null, leads: null, accounts: null, contacts: null },
];

const stableScopedDb = {
  accessContext: {},
  from: vi.fn((table: string) => {
    if (table === 'activities') return createChainableQuery({ data: mockActivities, error: null, count: mockActivities.length });
    return createChainableQuery({ data: [], error: null, count: 0 });
  }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { from: vi.fn(() => createChainableQuery({ data: null, error: null })) },
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
    scopedDb: stableScopedDb,
  }),
}));

describe('Activities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the activity board without crashing', async () => {
    render(
      <BrowserRouter>
        <StickyActionsProvider>
          <Activities />
        </StickyActionsProvider>
      </BrowserRouter>,
    );

    expect(await screen.findByText('Follow-up call')).toBeInTheDocument();
    expect(screen.getByText('Send proposal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search activities...')).toBeInTheDocument();
  });
});
