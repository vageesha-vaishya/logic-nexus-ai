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

vi.mock('@/contexts/DomainContext', () => ({
  useDomain: () => mockUseDomain(),
}));

describe('AmroHubVerticalPage', () => {
  it('renders AMRO integration contract links and active domain badge', () => {
    mockUseDomain.mockReturnValue({ currentDomain: { code: 'AMRO' } });

    render(<AmroHubVerticalPage />);

    expect(screen.getByText('AMRO Operations Overview')).toBeTruthy();
    expect(screen.getByText('AMRO Domain Context Active')).toBeTruthy();
    expect(screen.getByText('AMRO Integration Contracts')).toBeTruthy();
    expect(screen.getByText('OpenAPI 3.1 Contract')).toBeTruthy();
    expect(screen.getByText('GraphQL Subgraph Contract')).toBeTruthy();
    expect(screen.getByText('gRPC Proto Contract')).toBeTruthy();
    expect(screen.getByText('AsyncAPI Event Contract')).toBeTruthy();
    expect(screen.getByText('Phase-Wise Plan API')).toBeTruthy();
    expect(screen.getByText('Migration Plan API')).toBeTruthy();
    expect(screen.getByText('AMRO Phase-Wise Implementation Plan')).toBeTruthy();
    expect(screen.getByText('Core UI & APIs')).toBeTruthy();
    expect(screen.getByText('Integration & scale')).toBeTruthy();
  });
});
