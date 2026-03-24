import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import AmroHubVerticalPage from './AmroHubVerticalPage';
import { AmroOverviewPage, AmroWorkspaceDocumentationPage } from './AmroHubVerticalPage';

const mockUseDomain = vi.fn();
const mockUseAuth = vi.fn();
const mockLoadDashboard = vi.fn();

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/ui/enterprise', () => ({
  PlatformWidgetSlot: ({ children }: { children: React.ReactNode }) => <div data-testid="platform-widget-slot">{children}</div>,
}));

vi.mock('../components/AmroOwnedWorkspace', () => ({
  AmroOwnedWorkspace: () => <div data-testid="amro-owned-workspace">AMRO Workspace</div>,
}));

vi.mock('../hooks/useAmroOverviewKpi', () => ({
  useAmroOverviewKpi: () => ({
    dashboard: {
      executive_summary: {
        active_work_packages: 42,
        overdue_tasks: 4,
        compliance_status_pct: 97.2,
        forecast_accuracy_pct: 92.4,
      },
      kpi_cards: [
        { key: 'open_work_packages', label: 'Open Work Packages', value: 42, trend: '+2%' },
        { key: 'compliance_risk', label: 'Compliance Risk', value: 1, trend: '-8%' },
      ],
      risk_heatmap: { cells: [] },
      trend_lines: [],
      anomaly_flags: [{ id: 'an-1', metric_key: 'aog_count', severity: 'high', message: 'AOG spike above baseline' }],
      work_package_overview: [
        {
          work_package_id: 'wp-1',
          title: 'A Check',
          status: 'in_progress',
          planner_id: 'planner-1',
          engineer_id: 'engineer-1',
          due_at: '2026-03-22T10:00:00.000Z',
          progress_pct: 45,
        },
      ],
      materials_reservation_alerts: [],
      compliance_gate_status: [],
      integration_monitor: {
        status: 'healthy',
        failed_attempts: 0,
        failure_rate_pct: 0,
        recent_failures: [],
      },
      screen_modules: { total_modules: 12, management_and_planner_landing: true },
      data_issues: [],
      freshness_warning: null,
    },
    trends: {
      time_series: [],
      variance: 1.2,
      threshold_breaches: [],
      task_execution_monitor: {
        technician_count: 6,
        completed_tasks: 25,
        average_productivity_pct: 91,
        mobile_completion_rate_pct: 84,
      },
      scheduling_board_snapshot: {
        upcoming_slots: [],
        resource_utilization_pct: 79,
      },
      certification_decision_queue: [],
      audit_timeline: [],
      forecast_recommendation_hub: [],
      data_issues: [],
    },
    lastExport: null,
    loading: false,
    exporting: false,
    error: null,
    refreshCadence: { criticalMs: 30000, standardMs: 300000 },
    getMetricTier: (metricKey: string) => (metricKey === 'compliance_risk' || metricKey === 'aog_count' ? 'critical' : 'standard'),
    refreshAll: vi.fn(),
    lastDashboardRefreshAt: '2026-03-22T00:00:00.000Z',
    lastTrendsRefreshAt: '2026-03-22T00:00:00.000Z',
    loadDashboard: mockLoadDashboard,
    loadTrends: vi.fn(),
    exportSnapshot: vi.fn(),
  }),
}));

vi.mock('@/contexts/DomainContext', () => ({
  useDomain: () => mockUseDomain(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: {
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1',
      userId: 'user-1',
    },
  }),
}));

describe('AmroHubVerticalPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }));
    mockLoadDashboard.mockReset();
    mockLoadDashboard.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders operational dashboard UI for non-overview modules', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });

    render(<AmroHubVerticalPage moduleKey="work-packages" />);

    expect(screen.getByText('Work Packages')).toBeTruthy();
    expect(screen.getByText('AMRO Domain Context Active')).toBeTruthy();
    expect(screen.getByText('KPI Deck')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'AMRO Overview Controls' })).toBeTruthy();
    expect(screen.getByText('Apply Dashboard Scope')).toBeTruthy();
    expect(screen.getByText('Clear Scope')).toBeTruthy();
    expect(screen.getByText('Work Package Overview Grid')).toBeTruthy();
    expect(screen.getByText('Forecast Recommendation Hub')).toBeTruthy();
    expect(screen.getByText('Anomaly Flags')).toBeTruthy();
    expect(screen.getByText('Export KPI Snapshot')).toBeTruthy();
  });

  it('applies persona controls for user role and hides restricted actions', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });

    render(<AmroHubVerticalPage moduleKey="work-packages" />);

    expect(screen.getByText('Role Controls: anomaly intelligence is hidden for user persona.')).toBeTruthy();
    expect(screen.getByText('Export restricted to tenant/platform admin persona')).toBeTruthy();
  });

  it('applies and clears dashboard scope filters with planner and engineer values', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });

    render(<AmroHubVerticalPage moduleKey="work-packages" />);

    const plannerInput = screen.getByPlaceholderText('planner_id');
    const engineerInput = screen.getByPlaceholderText('engineer_id');
    fireEvent.change(plannerInput, { target: { value: 'planner-22' } });
    fireEvent.change(engineerInput, { target: { value: 'engineer-31' } });

    act(() => {
      fireEvent.click(screen.getByText('Apply Dashboard Scope'));
    });

    expect(mockLoadDashboard).toHaveBeenCalledTimes(1);
    expect(mockLoadDashboard.mock.calls[0][0]).toMatchObject({
      plannerId: 'planner-22',
      engineerId: 'engineer-31',
    });
    expect(typeof mockLoadDashboard.mock.calls[0][0].dateRange).toBe('string');
    expect(mockLoadDashboard.mock.calls[0][0].dateRange.includes('|')).toBe(true);

    act(() => {
      fireEvent.click(screen.getByText('Clear Scope'));
    });

    expect(mockLoadDashboard).toHaveBeenCalledTimes(2);
    expect(mockLoadDashboard.mock.calls[1][0]).toMatchObject({
      dateRange: expect.stringMatching(/\|/),
      regulatorProfile: 'FAA',
    });
    expect(screen.getByText('Critical Refresh: 30s')).toBeTruthy();
    expect(screen.getByText('Standard Refresh: 300s')).toBeTruthy();
  });

  it('auto-switches to AMRO domain when tenant assignments include AMRO', () => {
    const setDomain = vi.fn(async () => undefined);
    mockUseDomain.mockReturnValue({
      currentDomain: { code: 'LOGISTICS' },
      availableDomains: [
        { id: 'domain-logistics', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true },
        { id: 'domain-amro', code: 'AMRO', name: 'AMRO', description: null, is_active: true },
      ],
      isLoading: false,
      setDomain,
    });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      isPlatformAdmin: vi.fn().mockReturnValue(true),
    });

    render(<AmroHubVerticalPage />);

    expect(setDomain).toHaveBeenCalledWith('AMRO');
  });

  it('renders next-generation AMRO overview dashboard without legacy overview widgets', async () => {
    mockUseDomain.mockReturnValue({
      currentDomain: { code: 'AMRO' },
      availableDomains: [{ id: 'domain-amro', code: 'AMRO', name: 'AMRO', description: null, is_active: true }],
      isLoading: false,
      setDomain: vi.fn(),
      showDomainSelector: false,
      tenantDomainCount: 1,
      isPlatformAdmin: false,
    });
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-1' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'tenant_admin',
      permissions: ['dashboards.view'],
      refreshUserRole: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard/amro/overview']}>
        <Routes>
          <Route
            path="/dashboard/amro/overview"
            element={
              <ProtectedRoute requiredDomainCode="AMRO">
                <AmroOverviewPage />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<div>Auth Screen</div>} />
          <Route path="/unauthorized" element={<div>Unauthorized Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('dashboard-layout')).toBeTruthy();
    expect(screen.getByText('amro.overview.intelligenceHub')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Critical Signal Board' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Predictive Recommendation Queue' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Compliance and Integration Command' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Trend Analysis Chart' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Risk Heatmap Severity Chart' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cycle date range filter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cycle region filter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'amro.overview.exportPdfAction' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'amro.overview.exportExcelAction' })).toBeTruthy();
    expect(screen.getByText('Open Work Packages')).toBeTruthy();
    expect(screen.getByText('Compliance Risk')).toBeTruthy();
    expect(screen.queryByText('KPI Deck')).toBeNull();
    expect(screen.queryByText('AMRO Workspace')).toBeNull();
    expect(screen.queryByText('Overview Widget Error State')).toBeNull();
    expect(screen.queryByText('Unauthorized Screen')).toBeNull();
  });

  it('renders workspace documentation route with search filtering and bookmarking controls', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });
    localStorage.setItem('amro.workspace.documentation.bookmarks', JSON.stringify(['openapi']));

    render(<AmroWorkspaceDocumentationPage />);

    expect(screen.getAllByText('Workspace Documentation').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Search references')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All Categories' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Contracts' })).toBeTruthy();
    expect(screen.getByText('Bookmarked References')).toBeTruthy();
    expect(screen.getByText('AMRO Integration Contracts')).toBeTruthy();
    expect(screen.getAllByText('AMRO 15.1 Module Catalog').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AMRO 16.4 Accessibility and Internationalization').length).toBeGreaterThan(0);
  });
});
