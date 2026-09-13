import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ActivityDetail from './ActivityDetail';
import { createChainableQuery } from '../../../test/supabaseQueryMock';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/ActivityForm', () => ({
  ActivityForm: () => <div data-testid="activity-form" />,
}));

const mockActivity = {
  id: 'activity-1',
  activity_type: 'call',
  status: 'open',
  priority: 'medium',
  subject: 'Follow-up call',
  description: null,
  due_date: null,
  completed_at: null,
  created_at: new Date().toISOString(),
  custom_fields: null,
};

const stableSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'activities') return createChainableQuery({ data: mockActivity, error: null });
    return createChainableQuery({ data: null, error: null });
  }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: stableSupabase,
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
  }),
}));

describe('ActivityDetail', () => {
  it('renders a read-only summary view by default, without crashing', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/activities/activity-1']}>
        <Routes>
          <Route path="/dashboard/activities/:id" element={<ActivityDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Follow-up call' })).toBeInTheDocument();
    expect(screen.queryByTestId('activity-form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  it('switches to the edit form when Edit is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/activities/activity-1']}>
        <Routes>
          <Route path="/dashboard/activities/:id" element={<ActivityDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Edit/i }));

    expect(await screen.findByTestId('activity-form')).toBeInTheDocument();
  });
});
