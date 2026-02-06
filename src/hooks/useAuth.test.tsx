import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Restore real useAuth (overrides global mock from setup.ts)
vi.unmock('@/hooks/useAuth');

import { useAuth, AuthProvider } from './useAuth';
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
