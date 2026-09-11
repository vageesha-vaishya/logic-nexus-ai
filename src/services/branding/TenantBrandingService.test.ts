import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantBrandingService } from './TenantBrandingService';
import { supabase } from '@/integrations/supabase/client';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
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
  });

  it('updates tenant branding directly via Supabase', async () => {
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

  it('merges into existing settings when updating', async () => {
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

  it('throws when tenant id is not provided', async () => {
    await expect(TenantBrandingService.updateBranding({ primary_color: '#111111' } as any)).rejects.toThrow(
      'Tenant scope required'
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('TenantBrandingService.getResolvedBranding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth as any).getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('resolves tenant branding directly via Supabase using the authenticated user', async () => {
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

  it('uses explicit tenant scope without a profile lookup', async () => {
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
