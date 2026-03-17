import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Franchises from './Franchises';
import { useCRM } from '@/hooks/useCRM';

const toastSpy = vi.fn();

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/system/FirstScreenTemplate', () => ({
  FirstScreenTemplate: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/admin/ImportFranchiseModal', () => ({
  ImportFranchiseModal: () => null,
}));

vi.mock('@/components/franchise/TenantFranchiseMappingList', () => ({
  TenantFranchiseMappingList: () => <div />,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: 'token-1' },
        },
      }),
    },
  },
}));

describe('Franchises isolation', () => {
  function createScopedDb(rows: any[] = []) {
    const result = { data: rows, error: null };
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve(result).then(resolve),
    };
    return {
      from: vi.fn(() => builder),
      builder,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    toastSpy.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: [] }),
      headers: {
        get: () => 'application/json',
      },
    }));
  });

  it('sends tenant header for tenant users', async () => {
    const { from } = createScopedDb();
    vi.mocked(useCRM).mockReturnValue({
      context: { isPlatformAdmin: false, tenantId: 'tenant-1' },
      scopedDb: { from },
    } as any);

    render(
      <BrowserRouter>
        <Franchises />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init?.headers).toMatchObject({
      'x-tenant-id': 'tenant-1',
    });
  });

  it('omits tenant header for platform admins', async () => {
    const { from } = createScopedDb();
    vi.mocked(useCRM).mockReturnValue({
      context: { isPlatformAdmin: true, tenantId: 'tenant-1' },
      scopedDb: { from },
    } as any);

    render(
      <BrowserRouter>
        <Franchises />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
    });
    expect((init?.headers as Record<string, string>)['x-tenant-id']).toBeUndefined();
  });

  it('falls back to scoped database query when API returns html', async () => {
    const { from } = createScopedDb([{ id: 'fr-1', name: 'Fallback Franchise' }]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<!doctype html><html></html>',
      headers: {
        get: () => 'text/html',
      },
    }));
    vi.mocked(useCRM).mockReturnValue({
      context: { isPlatformAdmin: false, tenantId: 'tenant-1' },
      scopedDb: { from },
    } as any);

    render(
      <BrowserRouter>
        <Franchises />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(from).toHaveBeenCalledWith('franchises');
    });
    expect(toastSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error' }),
    );
  });
});
