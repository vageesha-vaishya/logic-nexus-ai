import { render, screen } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach } from 'vitest';
import LeadDetail from './LeadDetail';
import { BrowserRouter } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// Mock dependencies
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/features/module-sales/components/LeadScoringCard', () => ({
  LeadScoringCard: () => <div data-testid="lead-scoring-card" />,
}));

vi.mock('@/features/module-sales/components/LeadActivitiesTimeline', () => ({
  LeadActivitiesTimeline: () => <div data-testid="lead-activities-timeline" />,
}));

vi.mock('@/features/module-sales/components/LeadForm', () => ({
  LeadForm: () => <div data-testid="lead-form" />,
}));

vi.mock('@/components/email/EmailHistoryPanel', () => ({
  EmailHistoryPanel: () => <div data-testid="email-history-panel" />,
}));

vi.mock('@/features/module-sales/components/LeadConversionDialog', () => ({
  LeadConversionDialog: () => null,
}));

vi.mock('@/components/layout/StickyActionsContext', () => ({
  useStickyActions: () => ({
    actions: { left: [], right: [] },
    setActions: vi.fn(),
    clearActions: vi.fn(),
  }),
}));

vi.mock('@/features/module-sales/components/assignment/ManualAssignment', () => ({
  ManualAssignment: () => <div data-testid="manual-assignment" />,
}));

vi.mock('@/hooks/useLeadsViewState', () => ({
  useLeadsViewState: () => ({
    state: { theme: 'Azure Sky' },
    setTheme: vi.fn(),
    setView: vi.fn(),
    setPipeline: vi.fn(),
  }),
}));

const navigateMock = vi.fn();
let locationState: any = {};
const fetchMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'lead-1' }),
    useNavigate: () => navigateMock,
    useLocation: () => ({ hash: '', state: locationState }),
  };
});

vi.mock('@/hooks/useCRM', () => {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({}),
  };

  const supabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    channel: vi.fn().mockReturnValue(channel),
    removeChannel: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === 'activities') {
        const query = {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return {
          select: vi.fn(() => query),
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
    from: vi.fn((table: string) => {
      if (table === 'leads') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: lead, error: null }),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === 'accounts') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }
      if (table === 'activities') {
        const query = {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return {
          select: vi.fn(() => query),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      };
    }),
  };

  return {
    useCRM: () => ({
      supabase,
      scopedDb,
      context: {
        tenantId: 'tenant-1',
        userId: 'user-1',
      },
    }),
  };
});

describe('LeadDetail', () => {
  beforeEach(() => {
    locationState = {};
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/description-notes')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              leadId: 'lead-1',
              description: '<p>Lead description</p>',
              notes: '<p>Lead notes</p>',
              updatedAt: new Date().toISOString(),
            },
          }),
        } as Response;
      }
      if (init?.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({
            data: {
              leadId: 'lead-1',
              description: '<p>Lead description</p>',
              notes: '<p>Lead notes</p>',
              updatedAt: new Date().toISOString(),
            },
          }),
        } as Response;
      }
      return {
        ok: false,
        json: async () => ({ error: 'Not found' }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

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
    expect(await screen.findByText('Additional Information')).toBeInTheDocument();
  });

  it('opens in edit mode when navigation state requests it', async () => {
    locationState = { openEdit: true, returnTo: '/dashboard/leads' };

    render(
      <BrowserRouter>
        <LeadDetail />
      </BrowserRouter>,
    );

    expect(await screen.findByTestId('lead-form')).toBeInTheDocument();
  });
});
