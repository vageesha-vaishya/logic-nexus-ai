import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Restore real useAuth (overrides global mock from setup.ts)
vi.unmock('@/hooks/useAuth');

import { useAuth, AuthProvider, hasVerifiedPlatformAdminAccess, isEmergencyBlockedEmail } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
  },
  isSupabaseConfigured: true,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

describe('hasVerifiedPlatformAdminAccess', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when email is not blocked and admin signals are valid', () => {
    expect(hasVerifiedPlatformAdminAccess(true, [{ role: 'platform_admin' }], 'valid.admin@company.com')).toBe(true);
  });

  it('returns false when strict admin access flag is false', () => {
    expect(hasVerifiedPlatformAdminAccess(false, [{ role: 'platform_admin' }])).toBe(false);
  });

  it('returns false when strict admin access is true but role is not platform_admin', () => {
    expect(hasVerifiedPlatformAdminAccess(true, [{ role: 'tenant_admin' }])).toBe(false);
  });

  it('returns false when identity is in configured emergency blocked list', () => {
    vi.stubEnv('VITE_EMERGENCY_BLOCKED_EMAILS', 'bahuguna.vimal001@gmail.com');
    expect(hasVerifiedPlatformAdminAccess(true, [{ role: 'platform_admin' }], 'bahuguna.vimal001@gmail.com')).toBe(false);
  });

  it('returns true only when strict admin access and platform_admin role are both present', () => {
    expect(
      hasVerifiedPlatformAdminAccess(true, [{ role: 'tenant_admin' }, { role: 'platform_admin' }])
    ).toBe(true);
  });
});

describe('isEmergencyBlockedEmail', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('matches configured blocked email case-insensitively', () => {
    vi.stubEnv('VITE_EMERGENCY_BLOCKED_EMAILS', 'bahuguna.vimal001@gmail.com');
    expect(isEmergencyBlockedEmail('BAHUGUNA.VIMAL001@GMAIL.COM')).toBe(true);
  });

  it('returns false when blocked list is not configured', () => {
    expect(isEmergencyBlockedEmail('bahuguna.vimal001@gmail.com')).toBe(false);
  });
});

describe('useAuth signOut', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
  });

  it('should sign out successfully', async () => {
    (supabase.auth.signOut as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });

  it('should handle sign out error (Network failure)', async () => {
    const error = { message: 'Network error' };
    (supabase.auth.signOut as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(response).toEqual({ error });
    expect(mockNavigate).toHaveBeenCalledWith('/auth'); // Should still navigate
  });

  it('should handle unexpected exceptions during sign out', async () => {
    const error = new Error('Unexpected crash');
    (supabase.auth.signOut as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.signOut();
    });

    // The implementation catches and returns { error }
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(response).toEqual({ error });
    expect(mockNavigate).toHaveBeenCalledWith('/auth'); // Should still navigate
  });

  it('should clear user session and state on sign out', async () => {
     (supabase.auth.signOut as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
     
     const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });
    
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });
});
