import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import * as authHooks from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRoute = (element: ReactNode) => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={element} />
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
});
