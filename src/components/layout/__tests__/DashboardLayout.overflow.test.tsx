import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardLayout } from '../DashboardLayout';

vi.mock('../AppSidebar', () => ({
  AppSidebar: () => <aside data-testid="app-sidebar" />,
}));

vi.mock('../ObjectMenu', () => ({
  ObjectMenu: () => <div data-testid="object-menu" />,
}));

vi.mock('../AdminScopeSwitcher', () => ({
  AdminScopeSwitcher: () => <div data-testid="admin-scope-switcher" />,
}));

vi.mock('@/components/navigation/DomainSwitcher', () => ({
  DomainSwitcher: () => <div data-testid="domain-switcher" />,
}));

vi.mock('@/components/layout/StickyActionsContext', () => ({
  useStickyActions: () => ({ actions: { left: [], right: [] } }),
}));

vi.mock('@/components/ui/StickyActionsBar', () => ({
  StickyActionsBar: () => <div data-testid="sticky-actions-bar" />,
}));

vi.mock('@/components/debug/pipeline/PipelineContext', () => ({
  usePipeline: () => ({ toggleDashboard: vi.fn() }),
}));

vi.mock('@/components/debug/pipeline/PipelineDashboard', () => ({
  PipelineDashboard: () => <div data-testid="pipeline-dashboard" />,
}));

vi.mock('@/components/FeatureErrorBoundary', () => ({
  FeatureErrorBoundary: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/system/OnboardingTour', () => ({
  OnboardingTour: () => null,
}));

vi.mock('@/components/system/HelpDialog', () => ({
  HelpDialog: () => <div data-testid="help-dialog" />,
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => {},
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'admin@example.com', user_metadata: {} },
    profile: { first_name: 'Admin', last_name: 'User', avatar_url: null },
    roles: [{ role: 'platform_admin' }],
  }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: { isPlatformAdmin: true, tenantId: null, franchiseId: null },
    scopedDb: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    },
  }),
}));

vi.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: {
    USER_INFO_HEADER_MODULE: 'user_info_header_module',
    HEADER_DEBUG_BUTTON: 'header_debug_button',
  },
  useAppFeatureFlag: (key: string) => ({ enabled: key === 'header_debug_button' ? false : false, isLoading: false, error: null }),
}));

vi.mock('@/components/ui/global-search', () => ({
  GlobalSearch: () => <button aria-label="Open global search" data-testid="global-search">Search</button>,
}));

describe('DashboardLayout overflow behavior', () => {
  it('prevents page-level horizontal scrolling by hiding overflow-x', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/leads']}>
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    expect(main).toHaveClass('overflow-x-hidden');
  });

  it('renders a single global search control in header', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/leads']}>
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(screen.getAllByLabelText('Open global search')).toHaveLength(1);
    expect(screen.getByTestId('global-search')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pipeline Debugger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pipeline-dashboard')).not.toBeInTheDocument();
  });
});
