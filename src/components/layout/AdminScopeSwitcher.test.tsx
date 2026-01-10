import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminScopeSwitcher } from './AdminScopeSwitcher';
import { useCRM } from '@/hooks/useCRM';

// Mock useCRM
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

describe('AdminScopeSwitcher', () => {
  const mockSetAdminOverride = vi.fn();
  const mockSetScopePreference = vi.fn();
  const mockSupabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [] })),
        eq: vi.fn(() => ({
             order: vi.fn(() => Promise.resolve({ data: [] }))
        }))
      })),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing if user is not platform admin', () => {
    (useCRM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      context: { isPlatformAdmin: false },
      preferences: {},
      setAdminOverride: mockSetAdminOverride,
      setScopePreference: mockSetScopePreference,
      supabase: mockSupabase,
    });

    const { container } = render(<AdminScopeSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render "Global Admin" button if user is platform admin and override is disabled', () => {
    (useCRM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      context: { isPlatformAdmin: true },
      preferences: { admin_override_enabled: false },
      setAdminOverride: mockSetAdminOverride,
      setScopePreference: mockSetScopePreference,
      supabase: mockSupabase,
    });

    render(<AdminScopeSwitcher />);
    expect(screen.getByText('Global Admin')).toBeInTheDocument();
  });

  it('should render "Scoped View" button if user is platform admin and override is enabled', () => {
    (useCRM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      context: { isPlatformAdmin: true },
      preferences: { admin_override_enabled: true },
      setAdminOverride: mockSetAdminOverride,
      setScopePreference: mockSetScopePreference,
      supabase: mockSupabase,
    });

    render(<AdminScopeSwitcher />);
    expect(screen.getByText('Scoped View')).toBeInTheDocument();
  });
});
