import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AmroSettingsPage from './AmroSettingsPage';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
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

describe('AmroSettingsPage', () => {
  it('renders settings dashboard with Master Data as primary menu item', () => {
    render(
      <MemoryRouter>
        <AmroSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'AMRO Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Master Data' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Master Data' })).toHaveAttribute('href', '/dashboard/amro/settings/master-data');
  });
});
