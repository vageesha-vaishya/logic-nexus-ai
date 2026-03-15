
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LeadsPipeline from '../LeadsPipeline';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        }))
      })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      })),
      removeChannel: vi.fn()
    },
    context: { tenantId: 'test-tenant', isPlatformAdmin: false },
    scopedDb: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        }))
      }))
    }
  })
}));

vi.mock('@/hooks/useLeadsViewState', () => ({
  useLeadsViewState: () => ({
    state: {
      theme: 'light',
      hydrated: true,
      hydrationSource: 'storage',
      view: 'pipeline',
      pipeline: {
        q: '',
        status: [],
        tab: 'board',
      },
    },
    setTheme: vi.fn(),
    setView: vi.fn(),
    setPipeline: vi.fn(),
    setWorkspace: vi.fn()
  }),
  LeadsViewStateProvider: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/services/pipeline-service', () => ({
  PipelineService: {
    listLeads: vi.fn().mockResolvedValue({ data: [], totalCount: 0 }),
    transitionLeadStage: vi.fn(),
    updateLead: vi.fn(),
  },
}));

vi.mock('@/components/debug/pipeline/PipelineContext', () => ({
  usePipeline: () => ({ toggleDashboard: vi.fn() }),
  PipelineProvider: ({ children }: any) => <div>{children}</div>
}));

// Mock child components to avoid complex rendering
vi.mock('@/components/leads/pipeline/PipelineBoard', () => ({
  PipelineBoard: () => <div data-testid="pipeline-board">Pipeline Board</div>
}));

vi.mock('@/components/leads/pipeline/PipelineList', () => ({
  PipelineList: () => <div data-testid="pipeline-list">Pipeline List</div>
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>
}));

describe('LeadsPipeline', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders successfully', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LeadsPipeline />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Leads Pipeline|leads\.title/i)).toBeInTheDocument();
    });
  });
});
