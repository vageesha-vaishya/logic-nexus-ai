import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('@/components/ui/global-search', () => ({
  GlobalSearch: () => <div data-testid="global-search" />,
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

  it('opens global search from header search button', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(
      <MemoryRouter initialEntries={['/dashboard/leads']}>
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Open global search'));
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'shell:open-global-search' }));
    expect(screen.getByTestId('global-search')).toBeInTheDocument();
    dispatchSpy.mockRestore();
  });
});
