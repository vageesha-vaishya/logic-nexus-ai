import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Franchises from './Franchises';
import { useCRM } from '@/hooks/useCRM';

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
  useToast: () => ({ toast: vi.fn() }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }));
  });

  it('sends tenant header for tenant users', async () => {
    vi.mocked(useCRM).mockReturnValue({
      context: { isPlatformAdmin: false, tenantId: 'tenant-1' },
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
    vi.mocked(useCRM).mockReturnValue({
      context: { isPlatformAdmin: true, tenantId: 'tenant-1' },
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
});
