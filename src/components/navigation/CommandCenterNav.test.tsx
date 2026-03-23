import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
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
    localStorage.clear();
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

  it('renders distinct CRM and Sales navigation sections', () => {
    localStorage.setItem('sidebar:groups', JSON.stringify({ crm: true, sales: true }));
    renderNav('/dashboard');

    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.queryByText('CRM & Sales')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Campaigns' })).toBeInTheDocument();
  });

  it('relocates Quotes and Quote Templates under Sales section', () => {
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn((permission: string) => permission === 'quotes.templates.manage' || permission === 'view_amro_dashboard'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });
    localStorage.setItem('sidebar:groups', JSON.stringify({ crm: true, sales: true }));
    renderNav('/dashboard');

    const salesToggle = screen.getByRole('button', { name: 'Toggle Sales menu' });
    const salesSection = salesToggle.closest('section');
    const crmToggle = screen.getByRole('button', { name: 'Toggle CRM menu' });
    const crmSection = crmToggle.closest('section');

    expect(salesSection).not.toBeNull();
    expect(crmSection).not.toBeNull();
    expect(within(salesSection as HTMLElement).getByRole('link', { name: 'Quotes' })).toBeInTheDocument();
    expect(within(salesSection as HTMLElement).getByRole('link', { name: 'Quote Templates' })).toBeInTheDocument();
    expect(within(crmSection as HTMLElement).queryByRole('link', { name: 'Quotes' })).not.toBeInTheDocument();
    expect(within(crmSection as HTMLElement).queryByRole('link', { name: 'Quote Templates' })).not.toBeInTheDocument();
  });

  it('preserves deep-link active states for CRM and Sales routes', () => {
    const { unmount } = renderNav('/dashboard/leads/pipeline');
    expect(screen.getByRole('link', { name: 'Leads' })).toHaveAttribute('aria-current', 'page');
    unmount();

    renderNav('/dashboard/campaigns');
    expect(screen.getByRole('link', { name: 'Campaigns' })).toHaveAttribute('aria-current', 'page');
  });

  it('preserves deep-link active states for relocated quote routes', () => {
    let result = renderNav('/dashboard/quotes/pipeline');
    expect(screen.getByRole('link', { name: 'Quotes' })).toHaveAttribute('aria-current', 'page');
    result.unmount();

    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn((permission: string) => permission === 'quotes.templates.manage' || permission === 'view_amro_dashboard'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });
    result = renderNav('/dashboard/quotes/templates');
    expect(screen.getByRole('link', { name: 'Quote Templates' })).toHaveAttribute('aria-current', 'page');
    result.unmount();
  });

  it('supports keyboard interaction for CRM and Sales accordion toggles', async () => {
    const user = userEvent.setup();
    renderNav('/dashboard');

    const salesToggle = screen.getByRole('button', { name: 'Toggle Sales menu' });
    expect(salesToggle).toHaveAttribute('aria-expanded', 'false');
    salesToggle.focus();
    await user.keyboard('{Enter}');
    expect(salesToggle).toHaveAttribute('aria-expanded', 'true');

    const crmToggle = screen.getByRole('button', { name: 'Toggle CRM menu' });
    crmToggle.focus();
    await user.keyboard(' ');
    expect(crmToggle).toHaveAttribute('aria-expanded', 'true');
    expect(salesToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps hidden legacy dashboard and reports links out of the sidebar', () => {
    renderNav('/dashboard');
    screen.getByRole('button', { name: 'Toggle Sales menu' }).click();

    expect(screen.queryByRole('link', { name: 'Dashboards' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
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

  it('shows AMRO module for platform admin when domain list is temporarily unavailable', () => {
    mockUseDomain.mockReturnValue({
      availableDomains: [],
      isPlatformAdmin: false,
    });
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn((role: string) => role === 'platform_admin'),
      hasPermission: vi.fn((permission: string) => permission === 'view_amro_dashboard'),
      isPlatformAdmin: vi.fn().mockReturnValue(true),
    });
    sessionStorage.setItem('sidebar:groups', JSON.stringify({ amro: true }));

    renderNav('/dashboard');

    expect(screen.getByRole('button', { name: 'Toggle AMRO menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AMRO Overview' })).toBeInTheDocument();
  });

  it('keeps group expansion state persisted in local storage', () => {
    localStorage.setItem('sidebar:groups', JSON.stringify({ amro: true, logistics: false }));
    renderNav('/dashboard');

    expect(screen.getByRole('link', { name: 'AMRO Overview' })).toBeInTheDocument();
  });

  it('persists section state in local storage after refresh', () => {
    const { unmount } = renderNav('/dashboard');
    expect(screen.getByRole('button', { name: 'Toggle Sales menu' })).toHaveAttribute('aria-expanded', 'false');
    unmount();

    localStorage.setItem('sidebar:groups', JSON.stringify({ crm: false, sales: true }));
    renderNav('/dashboard');
    expect(screen.getByRole('button', { name: 'Toggle CRM menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Toggle Sales menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('retains role and permission gating for CRM submenus after section split', () => {
    mockUseAuth.mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn((permission: string) => permission === 'view_amro_dashboard'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    });
    renderNav('/dashboard');
    screen.getByRole('button', { name: 'Toggle Sales menu' }).click();

    expect(screen.queryByRole('link', { name: 'Quote Templates' })).not.toBeInTheDocument();
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
