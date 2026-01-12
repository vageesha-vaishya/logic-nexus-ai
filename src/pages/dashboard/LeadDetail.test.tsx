import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import LeadDetail from './LeadDetail';
import { BrowserRouter } from 'react-router-dom';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/LeadScoringCard', () => ({
  LeadScoringCard: () => <div data-testid="lead-scoring-card" />,
}));

vi.mock('@/components/crm/LeadActivitiesTimeline', () => ({
  LeadActivitiesTimeline: () => <div data-testid="lead-activities-timeline" />,
}));

vi.mock('@/components/email/EmailHistoryPanel', () => ({
  EmailHistoryPanel: () => <div data-testid="email-history-panel" />,
}));

vi.mock('@/components/crm/LeadConversionDialog', () => ({
  LeadConversionDialog: () => null,
}));

vi.mock('@/components/assignment/ManualAssignment', () => ({
  ManualAssignment: () => <div data-testid="manual-assignment" />,
}));

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'lead-1' }),
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/useCRM', () => {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({}),
  };

  const supabase = {
    channel: vi.fn().mockReturnValue(channel),
    removeChannel: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === 'activities') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      if (table === ('lead_activities' as any)) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      if (table === 'leads') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      };
    }),
  };

  const lead = {
    id: 'lead-1',
    first_name: 'John',
    last_name: 'Doe',
    company: 'Acme Logistics',
    email: 'john@example.com',
    phone: '+15551234567',
    status: 'new',
    source: 'website',
    estimated_value: 5000,
    created_at: new Date().toISOString(),
    lead_score: 85,
    qualification_status: 'qualified',
    owner_id: null,
    title: 'Shipping Manager',
    expected_close_date: null,
    description: null,
    notes: null,
    updated_at: new Date().toISOString(),
    last_activity_date: null,
    converted_at: null,
    custom_fields: null,
    tenant_id: 'tenant-1',
    franchise_id: null,
  };

  const scopedDb = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: lead, error: null }),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  };

  return {
    useCRM: () => ({
      supabase,
      scopedDb,
    }),
  };
});

describe('LeadDetail', () => {
  it('renders lead header badges and quick actions', async () => {
    render(
      <BrowserRouter>
        <LeadDetail />
      </BrowserRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'John Doe' })).toBeInTheDocument();
    const statusBadges = screen.getAllByText('New Lead');
    expect(statusBadges.length).toBeGreaterThan(0);
    const priorityBadges = screen.getAllByText('Hot');
    expect(priorityBadges.length).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: 'Call' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Email' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Meeting' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
  });
});

