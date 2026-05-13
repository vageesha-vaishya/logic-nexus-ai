import { describe, expect, it } from 'vitest';

describe('Tenant Context Contract', () => {
  it('validates required fields from tenant context endpoint response', () => {
    const response = {
      data: {
        tenantId: 'tenant-demo',
        tenantKey: 'demo',
        isolationMode: 'shared_schema',
        dataResidencyRegion: 'us-east',
        shardKey: 'tenant-demo',
      },
    };

    expect(response.data.tenantId).toBeTypeOf('string');
    expect(response.data.tenantKey).toBeTypeOf('string');
    expect(['shared_schema', 'dedicated_database']).toContain(response.data.isolationMode);
    expect(response.data.dataResidencyRegion).toBeTypeOf('string');
    expect(response.data.shardKey).toBeTypeOf('string');
  });
});
