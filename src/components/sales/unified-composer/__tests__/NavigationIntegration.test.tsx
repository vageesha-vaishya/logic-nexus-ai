
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: { tenantId: 'test-tenant', isPlatformAdmin: true },
    scopedDb: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: {}, error: null }),
            maybeSingle: () => Promise.resolve({ data: {}, error: null }),
          }),
        }),
      }),
    },
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } } }),
      },
    },
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    hasRole: () => true,
    hasPermission: () => true,
    isPlatformAdmin: () => true,
    loading: false,
  }),
  AuthProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/layout/StickyActionsContext', () => ({
  useStickyActions: () => ({ actions: { left: [], right: [] } }),
  StickyActionsProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/system/OnboardingTour', () => ({
  OnboardingTour: () => null,
}));

vi.mock('@/components/system/HelpDialog', () => ({
  HelpDialog: () => null,
}));

vi.mock('@/components/navigation/DomainSwitcher', () => ({
  DomainSwitcher: () => null,
}));

vi.mock('@/components/layout/AdminScopeSwitcher', () => ({
  AdminScopeSwitcher: () => null,
}));

vi.mock('@/components/layout/ObjectMenu', () => ({
  ObjectMenu: () => null,
}));

vi.mock('@/components/debug/pipeline/PipelineContext', () => ({
  usePipeline: () => ({ toggleDashboard: vi.fn() }),
  PipelineProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/debug/pipeline/PipelineDashboard', () => ({
  PipelineDashboard: () => null,
}));

// Mock UnifiedQuoteComposer to avoid complex setup
vi.mock('@/components/sales/unified-composer/UnifiedQuoteComposer', () => ({
  UnifiedQuoteComposer: () => <div data-testid="quote-composer">Quote Composer</div>,
}));

// Component to track location
const LocationTracker = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

describe('Navigation Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('navigates from Quote Edit to Leads Pipeline when sidebar link is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/quotes/123']}>
          <SidebarProvider>
            <TooltipProvider>
              <DashboardLayout>
                <Routes>
                  <Route path="/dashboard/quotes/:id" element={<div data-testid="quote-page">Edit Quote Page</div>} />
                  <Route path="/dashboard/leads/pipeline" element={<div data-testid="leads-page">Leads Pipeline Page</div>} />
                </Routes>
                <LocationTracker />
              </DashboardLayout>
            </TooltipProvider>
          </SidebarProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify we are on the quote page
    expect(screen.getByTestId('quote-page')).toBeInTheDocument();
    expect(screen.getByTestId('location-display')).toHaveTextContent('/dashboard/quotes/123');

    // Find Leads link in sidebar
    // Note: The sidebar renders "Leads" text.
    // Depending on collapse state, it might be visible or in tooltip.
    // We assume default expanded or we can find by text.
    
    // Debug: print body to see what's rendered if needed
    // screen.debug();

    const leadsLink = screen.getByText('Leads');
    expect(leadsLink).toBeInTheDocument();

    // Click Leads link
    fireEvent.click(leadsLink);

    // Verify navigation
    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/dashboard/leads/pipeline');
    });

    expect(screen.getByTestId('leads-page')).toBeInTheDocument();
  });
});
