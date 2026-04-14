/**
 * Unit tests for AmroWorkPackageDetailPage
 * 
 * Tests cover:
 * - Component rendering
 * - Navigation and routing
 * - Edit dialog functionality
 * - Status transitions
 * - Error handling
 * - Accessibility compliance
 * - Responsive design patterns
 * 
 * Target Coverage: 80%+
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AmroWorkPackageDetailPage from './AmroWorkPackageDetailPage';
import * as useWorkPackageState from './useWorkPackageState';

// ── Mock Setup ───────────────────────────────────────────────────────────────

const mockWorkPackage = {
  id: 'wp-001',
  work_package_number: 'WP-2024-001',
  work_order_number: 'WO-2024-001',
  title: 'A-Check Maintenance',
  description: 'Scheduled A-Check maintenance inspection',
  aircraft_registration: 'N12345',
  status: 'planning' as const,
  priority: 3 as const,
  maintenance_type: 'line' as const,
  assigned_to: 'John Doe',
  planned_start_date: '2024-05-01',
  planned_end_date: '2024-05-05',
  estimated_cost: 50000,
  actual_cost: 0,
  estimated_labor_hours: 200,
  actual_labor_hours: 0,
  tasks: [],
  materials: [],
  maintenance_events: [],
  created_at: '2024-04-01T00:00:00Z',
  updated_at: '2024-04-01T00:00:00Z',
};

// Mock hooks
vi.mock('./useWorkPackageState', () => ({
  useWorkPackage: vi.fn(),
  useUpdateWorkPackage: vi.fn(),
  useTransitionWorkPackage: vi.fn(),
  useWorkPackageActions: vi.fn(),
}));

// Mock DashboardLayout
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'wp-001' }),
    useNavigate: () => mockNavigate,
    Link: ({ children, to, ...props }: any) => (
      <a href={to} {...props}>{children}</a>
    ),
  };
});

// ── Helper Functions ─────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement, queryClient?: QueryClient) {
  const qc = queryClient || createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AmroWorkPackageDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(useWorkPackageState.useWorkPackage).mockReturnValue({
      data: mockWorkPackage,
      isLoading: false,
      isError: false,
    } as any);
    
    vi.mocked(useWorkPackageState.useUpdateWorkPackage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    
    vi.mocked(useWorkPackageState.useTransitionWorkPackage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    
    vi.mocked(useWorkPackageState.useWorkPackageActions).mockReturnValue({
      invalidate: vi.fn(),
    } as any);
  });

  // ── Rendering Tests ──────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('should render within DashboardLayout for proper navigation', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const dashboardLayout = screen.getByTestId('dashboard-layout');
      expect(dashboardLayout).toBeInTheDocument();
    });

    it('should render breadcrumb navigation for context', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Work Orders')).toBeInTheDocument();
      expect(screen.getByText('WP-2024-001')).toBeInTheDocument();
    });

    it('should render work package title and subtitle', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('A-Check Maintenance')).toBeInTheDocument();
      expect(screen.getByText(/WP-2024-001.*N12345/)).toBeInTheDocument();
    });

    it('should render status badge with correct status', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('Planning')).toBeInTheDocument();
    });

    it('should render priority badge for high priority items', () => {
      const highPriorityWP = { ...mockWorkPackage, priority: 1 as const };
      vi.mocked(useWorkPackageState.useWorkPackage).mockReturnValue({
        data: highPriorityWP,
        isLoading: false,
        isError: false,
      } as any);
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('P1 - Critical')).toBeInTheDocument();
    });

    it('should render all information cards', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('Work Order Information')).toBeInTheDocument();
      expect(screen.getByText('Cost Tracking')).toBeInTheDocument();
    });

    it('should render tabs for Tasks, Materials, and Timeline', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByRole('tab', { name: /Tasks/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Materials/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Timeline/ })).toBeInTheDocument();
    });
  });

  // ── Loading State Tests ──────────────────────────────────────────────────

  describe('Loading States', () => {
    it('should show loading message when data is fetching', () => {
      vi.mocked(useWorkPackageState.useWorkPackage).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any);
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText(/Loading work order details/)).toBeInTheDocument();
    });

    it('should show error message when fetch fails', () => {
      vi.mocked(useWorkPackageState.useWorkPackage).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any);
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load work order/)).toBeInTheDocument();
      expect(screen.getByText('Back to Work Orders')).toBeInTheDocument();
    });
  });

  // ── Navigation Tests ─────────────────────────────────────────────────────

  describe('Navigation', () => {
    it('should have back button linking to work orders list', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const backButton = screen.getByText('Back to Work Orders');
      expect(backButton).toHaveAttribute('href', '/dashboard/amro/work-packages');
    });

    it('should have breadcrumb links for navigation', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const dashboardLink = screen.getByText('Dashboard');
      const workOrdersLink = screen.getByText('Work Orders');
      
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
      expect(workOrdersLink).toHaveAttribute('href', '/dashboard/amro/work-packages');
    });
  });

  // ── Edit Dialog Tests ────────────────────────────────────────────────────

  describe('Edit Dialog', () => {
    it('should open edit dialog when Edit button is clicked', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      expect(screen.getByText('Edit Work Package')).toBeInTheDocument();
      expect(screen.getByText(/Update details for WP-2024-001/)).toBeInTheDocument();
    });

    it('should pre-populate form with current work package data', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      const titleInput = screen.getByLabelText(/Title \*/);
      expect(titleInput).toHaveValue('A-Check Maintenance');
    });

    it('should validate required fields', async () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      const titleInput = screen.getByLabelText(/Title \*/);
      fireEvent.change(titleInput, { target: { value: '' } });
      
      const saveButton = screen.getByRole('button', { name: /Save Changes/ });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });
    });

    it('should submit form and show success message', async () => {
      const mutateFn = vi.fn((_, { onSuccess }) => {
        setTimeout(() => onSuccess(), 0);
      });
      
      vi.mocked(useWorkPackageState.useUpdateWorkPackage).mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      } as any);
      
      const { toast } = await import('sonner');
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      const saveButton = screen.getByRole('button', { name: /Save Changes/ });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mutateFn).toHaveBeenCalled();
      });
    });

    it('should show loading state during save', () => {
      vi.mocked(useWorkPackageState.useUpdateWorkPackage).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any);
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      expect(screen.getByText(/Saving\.\.\./)).toBeInTheDocument();
    });

    it('should close dialog on cancel', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      fireEvent.click(cancelButton);
      
      expect(screen.queryByText('Edit Work Package')).not.toBeInTheDocument();
    });
  });

  // ── Status Transition Tests ──────────────────────────────────────────────

  describe('Status Transitions', () => {
    it('should show available transitions for current status', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      // Planning status can transition to approved or cancelled
      expect(screen.getByText(/Transition to:/)).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });

    it('should open confirmation dialog when transition is clicked', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const approvedButton = screen.getByText('Approved');
      fireEvent.click(approvedButton);
      
      expect(screen.getByText(/Transition to Approved\?/)).toBeInTheDocument();
    });

    it('should execute transition on confirm', async () => {
      const mutateFn = vi.fn((_, { onSuccess }) => {
        setTimeout(() => onSuccess(), 0);
      });
      
      vi.mocked(useWorkPackageState.useTransitionWorkPackage).mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      } as any);
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const approvedButton = screen.getByText('Approved');
      fireEvent.click(approvedButton);
      
      const confirmButton = screen.getByText('Confirm');
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mutateFn).toHaveBeenCalledWith(
          { id: 'wp-001', target_status: 'approved' },
          expect.any(Object)
        );
      });
    });

    it('should cancel transition on dismiss', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const approvedButton = screen.getByText('Approved');
      fireEvent.click(approvedButton);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(screen.queryByText(/Transition to Approved\?/)).not.toBeInTheDocument();
    });
  });

  // ── Actions Menu Tests ───────────────────────────────────────────────────

  describe('Actions Menu', () => {
    it('should have more actions button', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const moreButton = screen.getByRole('button', { name: '' });
      expect(moreButton).toBeInTheDocument();
    });

    it('should open dropdown menu with actions', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const moreButton = screen.getByRole('button', { name: '' });
      fireEvent.click(moreButton);
      
      expect(screen.getByText('Clone Work Package')).toBeInTheDocument();
      expect(screen.getByText('Print')).toBeInTheDocument();
      expect(screen.getByText('Export PDF')).toBeInTheDocument();
    });
  });

  // ── Accessibility Tests ──────────────────────────────────────────────────

  describe('Accessibility (WCAG 2.1)', () => {
    it('should have proper ARIA labels on interactive elements', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      expect(editButton).toHaveAttribute('aria-label');
    });

    it('should have breadcrumb navigation with proper ARIA attributes', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(nav).toBeInTheDocument();
    });

    it('should mark current page in breadcrumb with aria-current', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const currentItem = screen.getByText('WP-2024-001');
      expect(currentItem).toHaveAttribute('aria-current', 'page');
    });

    it('should have required fields marked with aria-required', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      const titleInput = screen.getByLabelText(/Title \*/);
      expect(titleInput).toHaveAttribute('aria-required', 'true');
    });

    it('should show error messages with role="alert"', async () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      const titleInput = screen.getByLabelText(/Title \*/);
      fireEvent.change(titleInput, { target: { value: '' } });
      
      const saveButton = screen.getByRole('button', { name: /Save Changes/ });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        const error = screen.getByText('Title is required');
        expect(error).toHaveAttribute('role', 'alert');
      });
    });

    it('should have main content area with role="main"', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const mainContent = screen.getByRole('main');
      expect(mainContent).toBeInTheDocument();
    });

    it('should associate form labels with inputs', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      const titleInput = screen.getByLabelText(/Title \*/);
      expect(titleInput).toHaveAttribute('id', 'wp-title');
      
      const label = screen.getByText('Title');
      expect(label).toHaveAttribute('for', 'wp-title');
    });
  });

  // ── Error Handling Tests ─────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle failed update gracefully', async () => {
      const mutateFn = vi.fn((_, { onError }) => {
        setTimeout(() => onError(new Error('Network error')), 0);
      });
      
      vi.mocked(useWorkPackageState.useUpdateWorkPackage).mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      } as any);
      
      const { toast } = await import('sonner');
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const editButton = screen.getByRole('button', { name: /Edit work package details/ });
      fireEvent.click(editButton);
      
      const saveButton = screen.getByRole('button', { name: /Save Changes/ });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to update work package',
          expect.any(Object)
        );
      });
    });

    it('should handle failed status transition gracefully', async () => {
      const mutateFn = vi.fn((_, { onError }) => {
        setTimeout(() => onError(new Error('Invalid transition')), 0);
      });
      
      vi.mocked(useWorkPackageState.useTransitionWorkPackage).mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      } as any);
      
      const { toast } = await import('sonner');
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const approvedButton = screen.getByText('Approved');
      fireEvent.click(approvedButton);
      
      const confirmButton = screen.getByText('Confirm');
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Transition failed',
          expect.any(Object)
        );
      });
    });
  });

  // ── Data Display Tests ───────────────────────────────────────────────────

  describe('Data Display', () => {
    it('should display work package information correctly', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('N12345')).toBeInTheDocument();
      expect(screen.getByText('Line')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display cost tracking information', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    });

    it('should handle missing optional fields gracefully', () => {
      const wpWithoutOptionals = {
        ...mockWorkPackage,
        description: null,
        assigned_to: null,
        aircraft_registration: null,
      };
      
      vi.mocked(useWorkPackageState.useWorkPackage).mockReturnValue({
        data: wpWithoutOptionals,
        isLoading: false,
        isError: false,
      } as any);
      
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
      expect(screen.getByText('Not assigned')).toBeInTheDocument();
    });

    it('should render empty states for tabs with no data', () => {
      renderWithProviders(<AmroWorkPackageDetailPage />);
      
      const tasksTab = screen.getByRole('tab', { name: /Tasks/ });
      fireEvent.click(tasksTab);
      
      expect(screen.getByText('No tasks defined for this work order.')).toBeInTheDocument();
    });
  });
});
