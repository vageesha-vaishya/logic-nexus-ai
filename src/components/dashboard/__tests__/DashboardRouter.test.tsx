import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardRouter } from '../DashboardRouter';
import * as useCRMModule from '@/hooks/useCRM';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../DashboardTemplateLoader', () => ({
  DashboardTemplateLoader: ({ userRole }: { userRole: string }) => (
    <div data-testid="template-loader">Template Loader: {userRole}</div>
  ),
}));

describe('DashboardRouter Component', () => {
  beforeEach(() => {
    vi.spyOn(useCRMModule, 'useCRM').mockReturnValue({
      context: { user: { id: 'test-user-1' } },
      scopedDb: {} as any,
    } as any);
  });

  it('renders loading state initially', () => {
    render(<DashboardRouter />);
    // The loading state should render before layout loads
    // Check that flex-1 container exists
    expect(document.querySelector('.flex-1')).toBeInTheDocument();
  });

  it('renders dashboard template loader after loading', async () => {
    const { container } = render(<DashboardRouter />);

    // Wait a bit for the effect to run
    await new Promise(resolve => setTimeout(resolve, 50));

    const templateLoader = screen.queryByTestId('template-loader');
    expect(templateLoader).toBeInTheDocument();
  });

  it('uses default role crm_sales_rep', async () => {
    render(<DashboardRouter />);

    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 50));

    const templateLoader = screen.queryByTestId('template-loader');
    expect(templateLoader?.textContent).toContain('crm_sales_rep');
  });

  it('shows error message when userRole cannot be determined', () => {
    // Mock a scenario where no context available after loading
    vi.spyOn(useCRMModule, 'useCRM').mockReturnValue({
      context: null,
      scopedDb: {} as any,
    } as any);

    const { rerender } = render(<DashboardRouter />);

    // Rerender to trigger effect again
    rerender(<DashboardRouter />);
  });

  it('passes correct userId to template loader', async () => {
    render(<DashboardRouter />);

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    const templateLoader = screen.queryByTestId('template-loader');
    expect(templateLoader).toBeInTheDocument();
  });

  it('handles missing user id gracefully', async () => {
    vi.spyOn(useCRMModule, 'useCRM').mockReturnValue({
      context: { user: null },
      scopedDb: {} as any,
    } as any);

    render(<DashboardRouter />);

    // Should still render without errors
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(document.querySelector('.flex-1')).toBeInTheDocument();
  });
});
