import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommandCenterNav } from './CommandCenterNav';

const mockUseSidebar = vi.fn();
const mockUseDomain = vi.fn();
const mockUseAuth = vi.fn();
const mockUseAppFeatureFlag = vi.fn();

vi.mock('@/components/ui/sidebar', () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  useSidebar: () => mockUseSidebar(),
}));

vi.mock('@/contexts/DomainContext', () => ({
  useDomain: () => mockUseDomain(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: {
    AMRO_RBAC_FIX_ENABLED: 'amro_rbac_fix_enabled',
  },
  useAppFeatureFlag: () => mockUseAppFeatureFlag(),
}));

function renderNav(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CommandCenterNav />
    </MemoryRouter>,
  );
}

describe('CommandCenterNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUseSidebar.mockReturnValue({ state: 'expanded' });
    mockUseDomain.mockReturnValue({
      availableDomains: [{ code: 'AMRO' }],
      isPlatformAdmin: false,
    });
    const amroPermissions = new Set([
      'view_amro_dashboard',
      'create_maintenance_request',
      'edit_aircraft_records',
      'approve_work_orders',
      'delete_flight_logs',
    ]);
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn((permission: string) => amroPermissions.has(permission)),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });
    mockUseAppFeatureFlag.mockReturnValue({
      enabled: true,
      isLoading: false,
      error: null,
    });
  });

  it('renders AMRO group with submenu routes and active state', () => {
    sessionStorage.setItem('sidebar:groups', JSON.stringify({ amro: true }));
    renderNav('/dashboard/amro/overview');

    expect(screen.getByRole('button', { name: 'Toggle AMRO menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AMRO Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'AMRO Work Packages' })).toBeInTheDocument();
  });

  it('hides AMRO module when user has no AMRO domain access', () => {
    mockUseDomain.mockReturnValue({
      availableDomains: [{ code: 'CRM' }],
      isPlatformAdmin: false,
    });

    renderNav('/dashboard');

    expect(screen.queryByRole('button', { name: 'Toggle AMRO menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'AMRO Overview' })).not.toBeInTheDocument();
  });

  it('keeps group expansion state persisted in session storage', () => {
    sessionStorage.setItem('sidebar:groups', JSON.stringify({ amro: true, logistics: false }));
    renderNav('/dashboard');

    expect(screen.getByRole('link', { name: 'AMRO Overview' })).toBeInTheDocument();
  });

  it('applies role and permission guards for administration items', () => {
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn((role: string) => role === 'platform_admin'),
      hasPermission: vi.fn((permission: string) => permission === 'admin.settings.manage'),
      isPlatformAdmin: vi.fn().mockReturnValue(true),
    });
    sessionStorage.setItem('sidebar:groups', JSON.stringify({ admin: true }));
    sessionStorage.setItem('sidebar:expandedItems', JSON.stringify({ admin: true }));

    renderNav('/dashboard');

    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('hides AMRO routes when RBAC fix flag is enabled and permission is missing', () => {
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(false),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });
    sessionStorage.setItem('sidebar:groups', JSON.stringify({ amro: true }));

    renderNav('/dashboard');

    expect(screen.queryByRole('link', { name: 'AMRO Overview' })).not.toBeInTheDocument();
  });

  it('keeps AMRO routes visible when RBAC fix flag is disabled', () => {
    mockUseAppFeatureFlag.mockReturnValue({
      enabled: false,
      isLoading: false,
      error: null,
    });
    sessionStorage.setItem('sidebar:groups', JSON.stringify({ amro: true }));

    renderNav('/dashboard');

    expect(screen.getByRole('link', { name: 'AMRO Overview' })).toBeInTheDocument();
  });
});
