import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AmroHubVerticalPage from './AmroHubVerticalPage';

const mockUseDomain = vi.fn();

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
      kpi_cards: [{ key: 'open_work_packages', label: 'Open Work Packages', value: 42, trend: '+2%' }],
      risk_heatmap: { cells: [] },
      trend_lines: [],
      anomaly_flags: [],
      freshness_warning: null,
    },
    trends: { time_series: [], variance: 1.2, threshold_breaches: [] },
    lastExport: null,
    loading: false,
    exporting: false,
    error: null,
    loadDashboard: vi.fn(),
    loadTrends: vi.fn(),
    exportSnapshot: vi.fn(),
  }),
}));

vi.mock('@/contexts/DomainContext', () => ({
  useDomain: () => mockUseDomain(),
}));

describe('AmroHubVerticalPage', () => {
  it('renders AMRO integration contract links and active domain badge', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });

    render(<AmroHubVerticalPage />);

    expect(screen.getByText('AMRO Operations Overview')).toBeTruthy();
    expect(screen.getByText('AMRO Domain Context Active')).toBeTruthy();
    expect(screen.getByText('KPI Data Source: /api/v2/amro/overview-kpi')).toBeTruthy();
    expect(screen.getByText('Export KPI Snapshot')).toBeTruthy();
    expect(screen.getByText('AMRO Integration Contracts')).toBeTruthy();
    expect(screen.getByText('OpenAPI 3.1 Contract')).toBeTruthy();
    expect(screen.getByText('GraphQL Subgraph Contract')).toBeTruthy();
    expect(screen.getByText('gRPC Proto Contract')).toBeTruthy();
    expect(screen.getByText('AsyncAPI Event Contract')).toBeTruthy();
    expect(screen.getByText('Phase-Wise Plan API')).toBeTruthy();
    expect(screen.getByText('Phase 1 Readiness API')).toBeTruthy();
    expect(screen.getByText('Migration Plan API')).toBeTruthy();
    expect(screen.getByText('Core UI Components & Basic Workflows')).toBeTruthy();
    expect(screen.getByText('Establish AMRO domain routes and navigation')).toBeTruthy();
    expect(screen.getByText('Overview Dashboard')).toBeTruthy();
    expect(screen.getByText('Role Controls')).toBeTruthy();
    expect(screen.getByText('AMRO Phase-Wise Implementation Plan')).toBeTruthy();
    expect(screen.getByText('Core UI & APIs')).toBeTruthy();
    expect(screen.getByText('Integration & scale')).toBeTruthy();
  });
});
