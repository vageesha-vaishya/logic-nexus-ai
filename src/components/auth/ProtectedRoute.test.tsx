import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import * as authHooks from '@/hooks/useAuth';
import * as domainContext from '@/contexts/DomainContext';

vi.mock('@/hooks/useAuth');
vi.mock('@/contexts/DomainContext');

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(domainContext.useDomain).mockReturnValue({
      currentDomain: { id: 'domain-logistics', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true },
      setDomain: vi.fn(),
      availableDomains: [{ id: 'domain-logistics', code: 'LOGISTICS', name: 'Logistics', description: null, is_active: true }],
      showDomainSelector: false,
      tenantDomainCount: 1,
      isPlatformAdmin: false,
      isLoading: false,
    });
  });

  const renderRoute = (element: ReactNode, options?: { initialEntry?: string; routePath?: string }) => {
    const initialEntry = options?.initialEntry ?? '/dashboard';
    const routePath = options?.routePath ?? '/dashboard';
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/auth" element={<div>Auth Screen</div>} />
          <Route path="/unauthorized" element={<div>Unauthorized Screen</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('redirects unauthenticated users to auth', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: null,
      loading: false,
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(false),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'user',
      permissions: [],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute>
        <div>Private Dashboard</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('Auth Screen')).toBeInTheDocument();
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument();
  });

  it('redirects users without required permissions to unauthorized', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-100' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(false),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-100' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'user',
      permissions: [],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredPermissions={['dashboards.view']}>
        <div>Private Dashboard</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('Unauthorized Screen')).toBeInTheDocument();
    expect(screen.queryByText('Private Dashboard')).not.toBeInTheDocument();
  });

  it('renders children without permission checks when no required permissions are provided', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-150' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(false),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-150' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'user',
      permissions: [],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute>
        <div>Workspace Home</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('Workspace Home')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized Screen')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated and authorized', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-200' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-200' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'tenant_admin',
      permissions: ['dashboards.view'],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredPermissions={['dashboards.view']}>
        <div>Private Dashboard</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('Private Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Auth Screen')).not.toBeInTheDocument();
    expect(screen.queryByText('Unauthorized Screen')).not.toBeInTheDocument();
  });

  it('allows tenant admins to access franchise detail routes with franchise permissions', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-225' },
      loading: false,
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      hasPermission: vi.fn().mockImplementation((permission: string) => permission === 'admin.franchises.manage'),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-225' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'tenant_admin',
      permissions: ['admin.franchises.manage'],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredPermissions={['admin.franchises.manage']}>
        <div>Franchise Detail</div>
      </ProtectedRoute>,
      {
        initialEntry: '/dashboard/franchises/fr-001',
        routePath: '/dashboard/franchises/:id',
      }
    );

    expect(await screen.findByText('Franchise Detail')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized Screen')).not.toBeInTheDocument();
  });

  it('blocks non-platform admin users from platform-admin-only routes with denial messaging', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-300' },
      loading: false,
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-300' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'tenant_admin',
      permissions: ['admin.settings.manage'],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredRole="platform_admin" accessDeniedMessage="Access denied - Platform admin privileges required">
        <div>System Settings</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('Unauthorized Screen')).toBeInTheDocument();
    expect(screen.queryByText('System Settings')).not.toBeInTheDocument();
  });

  it('blocks users mapped to platform role when strict admin check is false', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-350' },
      loading: false,
      hasRole: vi.fn().mockImplementation((role: string) => role === 'platform_admin'),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-350' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'tenant_admin',
      permissions: ['admin.settings.manage'],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredRole="platform_admin" accessDeniedMessage="Access denied - Platform admin privileges required">
        <div>System Settings</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('Unauthorized Screen')).toBeInTheDocument();
    expect(screen.queryByText('System Settings')).not.toBeInTheDocument();
  });

  it('allows platform admins to access platform-admin-only routes', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-400' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(true),
      session: { user: { id: 'user-400' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'platform_admin',
      permissions: ['admin.settings.manage'],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredRole="platform_admin" accessDeniedMessage="Access denied - Platform admin privileges required">
        <div>System Settings</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('System Settings')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized Screen')).not.toBeInTheDocument();
  });

  it('blocks non-platform admins from direct settings URLs even with admin.settings.manage permission', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-500' },
      loading: false,
      hasRole: vi.fn().mockImplementation((role: string) => role === 'tenant_admin'),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-500' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'tenant_admin',
      permissions: ['admin.settings.manage'],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredPermissions={['admin.settings.manage']}>
        <div>Channel Integrations</div>
      </ProtectedRoute>,
      {
        initialEntry: '/dashboard/settings/channel-integrations',
        routePath: '/dashboard/settings/channel-integrations',
      }
    );

    expect(await screen.findByText('Unauthorized Screen')).toBeInTheDocument();
    expect(screen.queryByText('Channel Integrations')).not.toBeInTheDocument();
  });

  it('allows verified platform admins on direct settings URLs', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-600' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(true),
      session: { user: { id: 'user-600' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'platform_admin',
      permissions: ['admin.settings.manage'],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredPermissions={['admin.settings.manage']}>
        <div>Channel Integrations</div>
      </ProtectedRoute>,
      {
        initialEntry: '/dashboard/settings/channel-integrations',
        routePath: '/dashboard/settings/channel-integrations',
      }
    );

    expect(await screen.findByText('Channel Integrations')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized Screen')).not.toBeInTheDocument();
  });

  it('allows route access when required domain is assigned', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-700' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-700' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'tenant_admin',
      permissions: ['dashboards.view'],
      refreshUserRole: vi.fn(),
    } as any);
    vi.mocked(domainContext.useDomain).mockReturnValue({
      currentDomain: { id: 'domain-amro', code: 'AMRO', name: 'AMRO', description: null, is_active: true },
      setDomain: vi.fn(),
      availableDomains: [{ id: 'domain-amro', code: 'AMRO', name: 'AMRO', description: null, is_active: true }],
      showDomainSelector: false,
      tenantDomainCount: 1,
      isPlatformAdmin: false,
      isLoading: false,
    });

    renderRoute(
      <ProtectedRoute requiredDomainCode="AMRO">
        <div>AMRO Workspace</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('AMRO Workspace')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized Screen')).not.toBeInTheDocument();
  });

  it('blocks route access when required domain is missing', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-701' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
      session: { user: { id: 'user-701' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'tenant_admin',
      permissions: ['dashboards.view'],
      refreshUserRole: vi.fn(),
    } as any);

    renderRoute(
      <ProtectedRoute requiredDomainCode="AMRO">
        <div>AMRO Workspace</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('Unauthorized Screen')).toBeInTheDocument();
    expect(screen.queryByText('AMRO Workspace')).not.toBeInTheDocument();
  });

  it('allows platform admins to access domain-gated routes without assignment list', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      user: { id: 'user-702' },
      loading: false,
      hasRole: vi.fn().mockReturnValue(true),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(true),
      session: { user: { id: 'user-702' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
      role: 'platform_admin',
      permissions: ['*'],
      refreshUserRole: vi.fn(),
    } as any);
    vi.mocked(domainContext.useDomain).mockReturnValue({
      currentDomain: null,
      setDomain: vi.fn(),
      availableDomains: [],
      showDomainSelector: true,
      tenantDomainCount: 0,
      isPlatformAdmin: true,
      isLoading: false,
    });

    renderRoute(
      <ProtectedRoute requiredDomainCode="AMRO">
        <div>AMRO Workspace</div>
      </ProtectedRoute>
    );

    expect(await screen.findByText('AMRO Workspace')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized Screen')).not.toBeInTheDocument();
  });
});
