import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGuard } from './RoleGuard';
import * as authHooks from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

describe('RoleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children for platform admin', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(true),
    } as any);

    render(
      <RoleGuard roles={['platform_admin']}>
        <div>System Settings Menu</div>
      </RoleGuard>
    );

    expect(screen.getByText('System Settings Menu')).toBeInTheDocument();
  });

  it('hides children for regular users and renders fallback', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      hasRole: vi.fn().mockReturnValue(false),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard roles={['platform_admin']} fallback={<div>Blocked</div>}>
        <div>System Settings Menu</div>
      </RoleGuard>
    );

    expect(screen.queryByText('System Settings Menu')).not.toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('hides children for moderator-like users that are not platform admins', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      hasRole: vi.fn().mockImplementation((role: string) => role === 'moderator'),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard roles={['platform_admin']}>
        <div>System Settings Menu</div>
      </RoleGuard>
    );

    expect(screen.queryByText('System Settings Menu')).not.toBeInTheDocument();
  });

  it('hides platform-admin-only content when hasRole is true but strict admin check is false', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      hasRole: vi.fn().mockImplementation((role: string) => role === 'platform_admin'),
      hasPermission: vi.fn().mockReturnValue(true),
      isPlatformAdmin: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard roles={['platform_admin']}>
        <div>System Settings Menu</div>
      </RoleGuard>
    );

    expect(screen.queryByText('System Settings Menu')).not.toBeInTheDocument();
  });
});
