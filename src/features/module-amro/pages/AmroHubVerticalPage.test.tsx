import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AmroHubVerticalPage from './AmroHubVerticalPage';

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

  it('renders AMRO integration contract links and active domain badge', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });

    render(<AmroHubVerticalPage />);

    expect(screen.getByText('AMRO Operations Overview')).toBeTruthy();
    expect(screen.getByText('AMRO Domain Context Active')).toBeTruthy();
    expect(screen.getByText('KPI Data Source: /api/v2/amro/overview-kpi')).toBeTruthy();
    expect(screen.getByText('Critical KPI Metrics')).toBeTruthy();
    expect(screen.getByText('Standard KPI Metrics')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'AMRO Dashboard CRUD Controls' })).toBeTruthy();
    expect(screen.getByText('Apply Dashboard Scope')).toBeTruthy();
    expect(screen.getByText('Clear Scope')).toBeTruthy();
    expect(screen.getByText('AMRO Module CRUD Hub')).toBeTruthy();
    expect(screen.getAllByText('Create').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Read').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Update').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delete').length).toBeGreaterThan(0);
    expect(screen.getByText('Anomaly Flags')).toBeTruthy();
    expect(screen.getByText('Export KPI Snapshot')).toBeTruthy();
    expect(screen.getByText('AMRO Integration Contracts')).toBeTruthy();
    expect(screen.getByText('OpenAPI 3.1 Contract')).toBeTruthy();
    expect(screen.getByText('GraphQL Subgraph Contract')).toBeTruthy();
    expect(screen.getByText('gRPC Proto Contract')).toBeTruthy();
    expect(screen.getByText('AsyncAPI Event Contract')).toBeTruthy();
    expect(screen.getByText('Phase-Wise Plan API')).toBeTruthy();
    expect(screen.getByText('Phase 1 Readiness API')).toBeTruthy();
    expect(screen.getByText('Module Catalog API')).toBeTruthy();
    expect(screen.getByText('Screen Inventory + UI/UX Contracts API')).toBeTruthy();
    expect(screen.getByText('Migration Plan API')).toBeTruthy();
    expect(screen.getByText('AMRO 15.1 Module Catalog')).toBeTruthy();
    expect(screen.getByText('AMRO 16.1 Screen Inventory')).toBeTruthy();
    expect(screen.getByText('AMRO 16.2 Per-Screen Layout Contracts')).toBeTruthy();
    expect(screen.getByText('AMRO 16.3 UI/UX Behavior Rules')).toBeTruthy();
    expect(screen.getByText('AMRO 16.4 Accessibility and Internationalization')).toBeTruthy();
    expect(screen.getByText('Sticky top actions')).toBeTruthy();
    expect(screen.getByText(/dual confirmation/i)).toBeTruthy();
    expect(screen.getByText('Keyboard navigation')).toBeTruthy();
    expect(screen.getAllByText('SCR-AMRO-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Forecast Recommendation Hub').length).toBeGreaterThan(0);
    expect(screen.getByText('Overview and KPI Intelligence')).toBeTruthy();
    expect(screen.getByText('Forecast and Reliability')).toBeTruthy();
    expect(screen.getByText('Core UI Components & Basic Workflows')).toBeTruthy();
    expect(screen.getByText('Establish AMRO domain routes and navigation')).toBeTruthy();
    expect(screen.getAllByText('Overview Dashboard').length).toBeGreaterThan(0);
    expect(screen.getByText('Role Controls')).toBeTruthy();
    expect(screen.getByText('AMRO Phase-Wise Implementation Plan')).toBeTruthy();
    expect(screen.getByText('Phase Plan Source: Fallback Model')).toBeTruthy();
    expect(screen.getByText('P0 Foundation')).toBeTruthy();
    expect(screen.getByText('P4 Integration and Scale')).toBeTruthy();
  });

  it('applies persona controls for user role and hides restricted actions', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });

    render(<AmroHubVerticalPage />);

    expect(screen.getByText('Role Controls: anomaly intelligence is hidden for user persona.')).toBeTruthy();
    expect(screen.getByText('Export restricted to tenant/platform admin persona')).toBeTruthy();
  });

  it('applies and clears dashboard scope filters with planner and engineer values', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });

    render(<AmroHubVerticalPage />);

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
    expect(mockLoadDashboard.mock.calls[1][0]).toEqual({
      dateRange: expect.stringMatching(/\|/),
    });
    expect(screen.getByText('Critical Refresh: 30s')).toBeTruthy();
    expect(screen.getByText('Standard Refresh: 300s')).toBeTruthy();
  });
});
