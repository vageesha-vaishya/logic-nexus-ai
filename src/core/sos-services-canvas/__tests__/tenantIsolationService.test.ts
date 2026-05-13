import { describe, expect, it } from 'vitest';
import { TenantIsolationService } from '../application/services/tenantIsolationService';
import { InMemoryCache, InMemoryLogger, InMemoryTenantRepository } from '../infrastructure/adapters/inMemoryAdapters';

describe('TenantIsolationService', () => {
  it('resolves tenant context and enforces strict isolation boundaries', async () => {
    const service = new TenantIsolationService({
      tenantRepository: new InMemoryTenantRepository([
        {
          tenantId: 'tenant-a',
          tenantKey: 'a',
          isolationMode: 'shared_schema',
          dataResidencyRegion: 'us-east',
          shardKey: 'tenant-a',
        },
      ]),
      cache: new InMemoryCache(),
      logger: new InMemoryLogger(),
    });

    const tenant = await service.resolveTenantContext('tenant-a');
    expect(tenant.tenantId).toBe('tenant-a');

    expect(() => service.enforceIsolation('tenant-a', 'tenant-a')).not.toThrow();
    expect(() => service.enforceIsolation('tenant-a', 'tenant-b')).toThrow('Tenant isolation boundary violation');
  });
});
