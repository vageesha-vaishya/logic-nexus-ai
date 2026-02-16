import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DebugSettingsCard } from '../DebugSettingsCard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Mock hooks
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/use-toast');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
      getUser: vi.fn(),
    }
  }
}));

describe('DebugSettingsCard', () => {
  const mockToast = vi.fn();
  const mockUpdateUser = supabase.auth.updateUser as any;
  const mockRefreshSession = supabase.auth.refreshSession as any;
  const mockGetUser = supabase.auth.getUser as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
    mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });
    mockRefreshSession.mockResolvedValue({ data: { session: {} }, error: null });
    mockGetUser.mockResolvedValue({ 
      data: { 
        user: { user_metadata: { debug_mode_enabled: false } } 
      }, 
      error: null 
    });
  });

  it('should not render for non-platform admins', () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'user-1' },
      isPlatformAdmin: () => false
    });

    const { container } = render(<DebugSettingsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render correct state based on user metadata', () => {
    (useAuth as any).mockReturnValue({
      user: { 
        id: 'admin-1', 
        user_metadata: { debug_mode_enabled: true } 
      },
      isPlatformAdmin: () => true
    });

    render(<DebugSettingsCard />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeChecked();
  });

  it('should perform optimistic update and verify with getUser', async () => {
    (useAuth as any).mockReturnValue({
      user: { 
        id: 'admin-1', 
        user_metadata: { debug_mode_enabled: true } 
      },
      isPlatformAdmin: () => true
    });

    // Setup getUser to return the NEW state (false)
    mockGetUser.mockResolvedValue({ 
      data: { 
        user: { user_metadata: { debug_mode_enabled: false } } 
      }, 
      error: null 
    });

    render(<DebugSettingsCard />);
    const switchElement = screen.getByRole('switch');
    
    // Toggle OFF
    fireEvent.click(switchElement);

    // Optimistic check
    expect(switchElement).not.toBeChecked();

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { debug_mode_enabled: false }
      });
    });

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Debug Mode Disabled"
    }));
  });

  it('should retry verification if getUser returns stale data initially', async () => {
    // Removed fake timers to avoid complexity with async/await loop
    (useAuth as any).mockReturnValue({
      user: { 
        id: 'admin-1', 
        user_metadata: { debug_mode_enabled: true } 
      },
      isPlatformAdmin: () => true
    });

    // First call returns stale data (true), second call returns fresh data (false)
    mockGetUser
      .mockResolvedValueOnce({ 
        data: { user: { user_metadata: { debug_mode_enabled: true } } }, 
        error: null 
      })
      .mockResolvedValueOnce({ 
        data: { user: { user_metadata: { debug_mode_enabled: false } } }, 
        error: null 
      });

    render(<DebugSettingsCard />);
    const switchElement = screen.getByRole('switch');
    
    // Toggle OFF
    fireEvent.click(switchElement);

    // Should eventually call getUser twice
    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalledTimes(2);
    }, { timeout: 2000 }); // Increase timeout slightly for the delay

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Debug Mode Disabled"
    }));
  });

  it('should revert state on update error', async () => {
    (useAuth as any).mockReturnValue({
      user: { 
        id: 'admin-1', 
        user_metadata: { debug_mode_enabled: false } 
      },
      isPlatformAdmin: () => true
    });

    mockUpdateUser.mockResolvedValue({ data: null, error: { message: 'Update failed' } });

    render(<DebugSettingsCard />);
    const switchElement = screen.getByRole('switch');
    
    // Toggle ON
    fireEvent.click(switchElement);
    
    // Optimistically ON
    expect(switchElement).toBeChecked();

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
    });

    // Should revert to OFF after error
    await waitFor(() => {
      expect(switchElement).not.toBeChecked();
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Error",
      variant: "destructive"
    }));
  });
});
