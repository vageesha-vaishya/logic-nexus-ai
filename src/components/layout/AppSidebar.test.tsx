import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/components/ui/sidebar';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';

const mockLogo = vi.hoisted(() =>
  vi.fn(({ size }: { size?: number }) => <div data-testid="logo" data-size={size}>Logo</div>)
);

// Mock dependencies
vi.mock('@/hooks/useAuth');
// Mock Sidebar UI components
vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: vi.fn(),
  Sidebar: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar">{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-header">{children}</div>,
  SidebarContent: React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    ({ children }, ref) => (
      <div ref={ref} data-testid="sidebar-content">
        {children}
      </div>
    ),
  ),
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
  default: (props: { size?: number }) => mockLogo(props),
}));

// Mock RoleGuard to just render children
vi.mock('@/components/auth/RoleGuard', () => ({
  RoleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AppSidebar Sign Out', () => {
  const mockSignOut = vi.fn();
  const mockToggleSidebar = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogo.mockClear();
    (useAuth as any).mockReturnValue({
      signOut: mockSignOut,
      profile: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
    });
    (useSidebar as any).mockReturnValue({
      state: 'expanded',
      setOpen: vi.fn(),
      isMobile: false,
      setOpenMobile: vi.fn(),
      toggleSidebar: mockToggleSidebar,
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

  it('toggles sidebar from branding button', () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('Toggle Sidebar'));
    expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('keeps original logo size in expanded mode', () => {
    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    const sizes = mockLogo.mock.calls.map(([props]) => props.size);
    expect(sizes).toContain(44);
  });

  it('increases logo size in collapsed mode', () => {
    (useSidebar as any).mockReturnValue({
      state: 'collapsed',
      setOpen: vi.fn(),
      isMobile: false,
      setOpenMobile: vi.fn(),
      toggleSidebar: mockToggleSidebar,
    });

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    const sizes = mockLogo.mock.calls.map(([props]) => props.size);
    expect(sizes).toContain(52);
  });
});
