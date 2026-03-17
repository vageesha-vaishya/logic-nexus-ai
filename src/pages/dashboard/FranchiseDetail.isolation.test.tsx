import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FranchiseDetail from './FranchiseDetail';
import { useCRM } from '@/hooks/useCRM';

const toastSpy = vi.fn();

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/admin/FranchiseForm', () => ({
  FranchiseForm: () => <div />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: any) => <button>{children}</button>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children }: any) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: ({ children }: any) => <div>{children}</div>,
  BreadcrumbItem: ({ children }: any) => <div>{children}</div>,
  BreadcrumbLink: ({ children }: any) => <a>{children}</a>,
  BreadcrumbList: ({ children }: any) => <div>{children}</div>,
  BreadcrumbPage: ({ children }: any) => <div>{children}</div>,
  BreadcrumbSeparator: () => <span>/</span>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

describe('FranchiseDetail isolation', () => {
  function createScopedDb(row: any) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    return {
      from: vi.fn(() => builder),
      builder,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    toastSpy.mockReset();
  });

  it('falls back to scoped database when API returns html', async () => {
    const { from } = createScopedDb({ id: 'fr-1', name: 'Fallback Franchise', is_active: true });
    vi.mocked(useCRM).mockReturnValue({
      context: { isPlatformAdmin: false, tenantId: 'tenant-1' },
      scopedDb: { from },
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-1' } } }),
        },
      },
    } as any);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<!doctype html><html></html>',
      headers: {
        get: () => 'text/html',
      },
    }));

    render(
      <MemoryRouter initialEntries={['/dashboard/franchises/fr-1']}>
        <Routes>
          <Route path="/dashboard/franchises/:id" element={<FranchiseDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(from).toHaveBeenCalledWith('franchises');
    });
    expect(screen.getByText('Fallback Franchise')).toBeInTheDocument();
  });
});
