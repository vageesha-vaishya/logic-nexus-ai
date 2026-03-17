import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainQuotationIsolationService } from './DomainQuotationIsolationService';
import { PluginRegistry } from '@/services/plugins/PluginRegistry';

vi.mock('@/services/plugins/PluginRegistry', () => ({
  PluginRegistry: {
    getPluginByDomain: vi.fn(),
  },
}));

describe('DomainQuotationIsolationService', () => {
  const service = new DomainQuotationIsolationService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves mapped quote ids for a domain', async () => {
    const scopedDb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({
            data: [{ quote_id: 'q-1' }, { quote_id: 'q-2' }, { quote_id: 'q-1' }],
            error: null,
          }),
      })),
    } as any;

    const ids = await service.resolveQuoteIdsForDomain(scopedDb, 'domain-1');
    expect(ids).toEqual(['q-1', 'q-2']);
  });

  it('enforces plugin isolation by domain code', () => {
    vi.mocked(PluginRegistry.getPluginByDomain).mockReturnValue(undefined as any);
    expect(() => service.ensurePluginIsolation('LOGISTICS')).toThrow('No quotation plugin is registered for LOGISTICS');
  });

  it('runs plugin lifecycle hooks when available', () => {
    const beforeHook = vi.fn();
    vi.mocked(PluginRegistry.getPluginByDomain).mockReturnValue({
      onDomainQuotationBeforeFetch: beforeHook,
    } as any);

    service.runPluginHook('LOGISTICS', 'beforeFetch', { domainId: 'd-1' });
    expect(beforeHook).toHaveBeenCalledWith({ domainId: 'd-1' });
  });

  it('spawns and manages isolated instance lifecycle by domain', async () => {
    const onAssign = vi.fn();
    const onSuspend = vi.fn();
    const onResume = vi.fn();
    const onRevoke = vi.fn();
    vi.mocked(PluginRegistry.getPluginByDomain).mockReturnValue({
      onDomainAssign: onAssign,
      onDomainSuspend: onSuspend,
      onDomainResume: onResume,
      onDomainRevoke: onRevoke,
    } as any);

    const scopedDb = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            json_settings: { retries: 3 },
            encrypted_secrets: 'encrypted-payload',
          },
          error: null,
        }),
      })),
    } as any;

    await service.onDomainAssign(scopedDb, { domainId: 'domain-1', domainCode: 'LOGISTICS', tenantId: 'tenant-1' });
    expect(service.getIsolatedInstanceState('domain-1', 'LOGISTICS')).toEqual({
      hasInstance: true,
      isActive: true,
      isSuspended: false,
    });
    expect(onAssign).toHaveBeenCalled();

    service.onDomainSuspend({ domainId: 'domain-1', domainCode: 'LOGISTICS', tenantId: 'tenant-1' });
    expect(service.getIsolatedInstanceState('domain-1', 'LOGISTICS').isSuspended).toBe(true);
    expect(onSuspend).toHaveBeenCalled();

    service.onDomainResume({ domainId: 'domain-1', domainCode: 'LOGISTICS', tenantId: 'tenant-1' });
    expect(service.getIsolatedInstanceState('domain-1', 'LOGISTICS').isActive).toBe(true);
    expect(onResume).toHaveBeenCalled();

    service.onDomainRevoke({ domainId: 'domain-1', domainCode: 'LOGISTICS', tenantId: 'tenant-1' });
    expect(service.getIsolatedInstanceState('domain-1', 'LOGISTICS')).toEqual({
      hasInstance: false,
      isActive: false,
      isSuspended: false,
    });
    expect(onRevoke).toHaveBeenCalled();
  });
});
