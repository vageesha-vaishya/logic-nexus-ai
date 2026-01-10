import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/components/ui/sidebar';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/hooks/useAuth');
// Mock Sidebar UI components
vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: vi.fn(),
  Sidebar: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar">{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-content">{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-group">{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-group-content">{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-group-label">{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-menu">{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-menu-item">{children}</div>,
  SidebarMenuButton: ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => <div data-testid="sidebar-menu-button">{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-footer">{children}</div>,
}));
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock Logo component since it might cause issues or isn't relevant
vi.mock('@/components/branding/Logo', () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

// Mock RoleGuard to just render children
vi.mock('@/components/auth/RoleGuard', () => ({
  RoleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AppSidebar Sign Out', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      signOut: mockSignOut,
      profile: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
    });
    (useSidebar as any).mockReturnValue({
      state: 'expanded',
    });
  });

  it('renders sign out button', () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('calls signOut when clicked', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Sign Out'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state during sign out', async () => {
    // Make signOut take some time
    mockSignOut.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100)));
    
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Sign Out'));

    expect(screen.getByText('Signing Out...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });

  it('handles sign out error', async () => {
    mockSignOut.mockResolvedValue({ error: new Error('Network error') });
    
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Sign Out'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Sign out failed'));
    });
  });
});
