import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantBrandingService } from './TenantBrandingService';
import { supabase } from '@/integrations/supabase/client';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

function createTenantTableMock(
  readResult: { data: any; error: any },
  updateResult: { data: any; error: any }
) {
  const selectChain: any = {
    eq: vi.fn(() => selectChain),
    limit: vi.fn(() => selectChain),
    maybeSingle: vi.fn().mockResolvedValue(readResult),
  };

  const updateFinalizeChain: any = {
    limit: vi.fn(() => updateFinalizeChain),
    maybeSingle: vi.fn().mockResolvedValue(updateResult),
  };

  const updateEqChain: any = {
    select: vi.fn(() => updateFinalizeChain),
  };

  const updateChain = {
    eq: vi.fn(() => updateEqChain),
  };

  const table = {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
  };

  return { table };
}

describe('TenantBrandingService.updateBranding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
    } as any);
  });

  it('falls back to direct tenant update when branding API is unavailable', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockRejectedValue(new Error('Not JSON')),
    } as any);

    const branding = { primary_color: '#2563EB' };
    const { table } = createTenantTableMock(
      { data: { id: 'tenant-1', settings: {} }, error: null },
      { data: { branding_settings: branding }, error: null }
    );
    mockFrom.mockReturnValue(table);

    const result = await TenantBrandingService.updateBranding(branding as any, 'tenant-1');

    expect(result).toEqual(branding);
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(table.update).toHaveBeenCalledWith({
      branding_settings: branding,
      settings: { branding_settings: branding },
    });
  });

  it('falls back to direct tenant update when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network unavailable'));

    const branding = { accent_color: '#F59E0B' };
    const { table } = createTenantTableMock(
      { data: { id: 'tenant-1', settings: { timezone: 'UTC' } }, error: null },
      { data: { branding_settings: branding }, error: null }
    );
    mockFrom.mockReturnValue(table);

    const result = await TenantBrandingService.updateBranding(branding as any, 'tenant-1');

    expect(result).toEqual(branding);
    expect(table.update).toHaveBeenCalledWith({
      branding_settings: branding,
      settings: { timezone: 'UTC', branding_settings: branding },
    });
  });

  it('throws API error when tenant id is unavailable for fallback', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ error: 'Forbidden', correlationId: 'corr-2' }),
    } as any);

    await expect(TenantBrandingService.updateBranding({ primary_color: '#111111' } as any)).rejects.toThrow(
      'Forbidden (ref: corr-2)'
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('TenantBrandingService.getResolvedBranding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
    } as any);
    (supabase.auth as any).getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('falls back to direct tenant branding resolution when endpoint returns 404', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({ error: 'Not Found' }),
    } as any);

    const profileSelectChain: any = {
      eq: vi.fn(() => profileSelectChain),
      limit: vi.fn(() => profileSelectChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-1' },
        error: null,
      }),
    };
    const tenantSelectChain: any = {
      eq: vi.fn(() => tenantSelectChain),
      limit: vi.fn(() => tenantSelectChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'tenant-1',
          name: 'Acme',
          slug: 'acme',
          domain: 'acme.com',
          logo_url: 'logos/main.png',
          branding_settings: { primary_color: '#112233' },
          settings: {},
        },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn(() => profileSelectChain) };
      }
      if (table === 'tenants') {
        return { select: vi.fn(() => tenantSelectChain) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await TenantBrandingService.getResolvedBranding({ hostname: 'localhost' });

    expect(result.tenantId).toBe('tenant-1');
    expect(result.tenantName).toBe('Acme');
    expect(result.primaryColor).toBe('#112233');
  });

  it('falls back to direct tenant branding resolution when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network unavailable'));

    const profileSelectChain: any = {
      eq: vi.fn(() => profileSelectChain),
      limit: vi.fn(() => profileSelectChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-1' },
        error: null,
      }),
    };
    const tenantSelectChain: any = {
      eq: vi.fn(() => tenantSelectChain),
      limit: vi.fn(() => tenantSelectChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'tenant-1',
          name: 'Acme',
          slug: 'acme',
          domain: 'acme.com',
          logo_url: 'logos/main.png',
          branding_settings: {},
          settings: {},
        },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn(() => profileSelectChain) };
      }
      if (table === 'tenants') {
        return { select: vi.fn(() => tenantSelectChain) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await TenantBrandingService.getResolvedBranding({ hostname: 'localhost' });

    expect(result.tenantId).toBe('tenant-1');
    expect(result.companyName).toBe('Acme');
  });

  it('includes explicit tenant scope in branding API request', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          tenantId: 'tenant-deccan',
          tenantName: 'Deccan',
          tenantSlug: 'deccan',
          logoUrl: '',
          faviconUrl: '',
          companyName: 'Deccan',
          primaryColor: '#2563EB',
          secondaryColor: '#1D4ED8',
          accentColor: '#F59E0B',
          fontFamily: 'Inter, system-ui, sans-serif',
          customCss: '',
          whiteLabelEnabled: false,
          headerText: '',
          subHeaderText: '',
          footerText: '',
          disclaimerText: '',
          metadata: {
            domain: 'deccan.test',
            hostname: 'localhost',
            resolvedAt: '2026-03-23T00:00:00.000Z',
          },
        },
      }),
    } as any);

    await TenantBrandingService.getResolvedBranding({
      hostname: 'localhost',
      franchiseId: 'fr-deccan-fly',
      tenantId: 'tenant-deccan',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const requestUrl = String((vi.mocked(fetch).mock.calls[0] || [])[0] || '');
    expect(requestUrl).toContain('/api/v1/tenant-branding?');
    expect(requestUrl).toContain('tenant_id=tenant-deccan');
    expect(requestUrl).toContain('franchise_id=fr-deccan-fly');
  });

  it('uses explicit tenant scope for fallback without profile lookup', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({ error: 'Not Found' }),
    } as any);

    const tenantSelectChain: any = {
      eq: vi.fn(() => tenantSelectChain),
      limit: vi.fn(() => tenantSelectChain),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'tenant-deccan',
          name: 'Deccan',
          slug: 'deccan',
          domain: 'deccan.test',
          logo_url: '',
          branding_settings: {},
          settings: {},
        },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return { select: vi.fn(() => tenantSelectChain) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await TenantBrandingService.getResolvedBranding({
      hostname: 'localhost',
      tenantId: 'tenant-deccan',
    });

    expect(result.tenantId).toBe('tenant-deccan');
    expect((supabase.auth as any).getUser).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('tenants');
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
  });
});
