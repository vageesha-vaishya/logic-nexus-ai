import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LeadNew from './LeadNew';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/crm/CRMModuleHeaderNavigation', () => ({
  CRMModuleHeaderNavigation: () => <div data-testid="crm-module-header-nav" />,
  CRM_HEADER_PRIMARY_CONTROL_SEQUENCE: [],
}));

vi.mock('@/features/module-sales/components/LeadForm', () => ({
  LeadForm: () => <div data-testid="lead-form" />,
}));

vi.mock('@/features/module-sales/components/LeadWorkspaceSections', () => ({
  LeadWorkspaceSections: () => <div data-testid="lead-workspace-sections" />,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

vi.mock('@/hooks/useLeadsViewState', () => ({
  useLeadsViewState: () => ({
    state: { theme: 'Azure Sky' },
    setTheme: vi.fn(),
    setView: vi.fn(),
    setPipeline: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
    context: { tenantId: 'tenant-1', userId: 'user-1', franchiseId: null },
    scopedDb: { logViewPreference: vi.fn() },
  }),
}));

const mockUseAppFeatureFlag = vi.fn();
vi.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: { LEAD_THREE_SECTION_LAYOUT: 'lead_three_section_layout' },
  useAppFeatureFlag: () => mockUseAppFeatureFlag(),
}));

describe('LeadNew — three-section layout flag', () => {
  beforeEach(() => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: false, isLoading: false, error: null });
  });

  it('renders LeadWorkspaceSections when the flag is enabled', () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    render(
      <BrowserRouter>
        <LeadNew />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('lead-workspace-sections')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-form')).not.toBeInTheDocument();
  });

  it('renders the legacy LeadForm when the flag is disabled', () => {
    render(
      <BrowserRouter>
        <LeadNew />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('lead-form')).toBeInTheDocument();
    expect(screen.queryByTestId('lead-workspace-sections')).not.toBeInTheDocument();
  });
});
