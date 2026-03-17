import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardRouter } from '../DashboardRouter';
import * as crmHooks from '@/hooks/useCRM';

// Mock dependencies
vi.mock('@/hooks/useCRM');
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../DashboardTemplateLoader', () => ({
  DashboardTemplateLoader: ({ userRole }: any) => <div>Role: {userRole}</div>,
}));

describe('DashboardRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dashboard_role from profiles table', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { dashboard_role: 'crm_sales_manager' },
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: { user: { id: 'user-123' } },
      user: { id: 'user-123' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText('Role: crm_sales_manager')).toBeInTheDocument();
    });
  });

  it('should normalize legacy dashboard_role alias values from profiles', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { dashboard_role: 'operations' },
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: { user: { id: 'user-321' }, isTenantAdmin: true },
      user: { id: 'user-321' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText('Role: enterprise_operations')).toBeInTheDocument();
    });
  });

  it('should fallback to context mapping for unknown dashboard_role values', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { dashboard_role: 'unknown_role' },
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: { user: { id: 'user-654' }, isPlatformAdmin: true },
      user: { id: 'user-654' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText('Role: enterprise_executive')).toBeInTheDocument();
    });
  });

  it('should map auth roles to dashboard roles if dashboard_role not found', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: {
        user: { id: 'user-123' },
        isTenantAdmin: true,
      },
      user: { id: 'user-123' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText('Role: enterprise_operations')).toBeInTheDocument();
    });
  });

  it.each([
    [{ isPlatformAdmin: true }, 'enterprise_executive'],
    [{ isTenantAdmin: true }, 'enterprise_operations'],
    [{ isFranchiseAdmin: true }, 'enterprise_operations'],
    [{}, 'crm_sales_rep'],
  ])('should resolve fallback role mapping for context %o', async (roleContext, expectedRole) => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: {
        user: { id: 'user-123' },
        ...roleContext,
      },
      user: { id: 'user-123' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText(`Role: ${expectedRole}`)).toBeInTheDocument();
    });
  });

  it('should default to crm_sales_rep if no role found', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Not found'),
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: { user: { id: 'user-123' } },
      user: { id: 'user-123' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText('Role: crm_sales_rep')).toBeInTheDocument();
    });
  });
});
