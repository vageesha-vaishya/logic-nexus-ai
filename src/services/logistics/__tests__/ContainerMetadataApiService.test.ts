import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ContainerMetadataApiService } from '../ContainerMetadataApiService';

function makeDbMock(resolvers: Record<string, any>) {
  return {
    from: vi.fn((table: string) => {
      const r = resolvers[table];
      const chain: any = {
        select: vi.fn(() => chain),
        or: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => Promise.resolve(r())),
      };
      return chain;
    }),
  } as unknown as SupabaseClient;
}

describe('ContainerMetadataApiService', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = '';
    const cleanup = new ContainerMetadataApiService(makeDbMock({}) as unknown as SupabaseClient);
    cleanup.invalidateCache();
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('returns container types for tenant/global scope', async () => {
    const db = makeDbMock({
      container_types: () => ({
        data: [{ id: 'dry', name: 'Dry', code: 'DRY' }],
        error: null,
      }),
    });

    const service = new ContainerMetadataApiService(db);
    const data = await service.getContainerTypes('tenant-1');

    expect(data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        sourceId: 'dry',
        name: 'Dry',
        code: 'DRY',
        isActive: true,
      })
    );
  });

  it('returns 0 rows for empty type response', async () => {
    const db = makeDbMock({
      container_types: () => ({ data: [], error: null }),
    });

    const service = new ContainerMetadataApiService(db);
    const data = await service.getContainerTypes('tenant-1');

    expect(data).toEqual([]);
  });

  it('throws on query error', async () => {
    const db = makeDbMock({
      container_types: () => ({ data: null, error: { message: 'db unavailable' } }),
    });

    const service = new ContainerMetadataApiService(db);

    await expect(service.getContainerTypes('tenant-1')).rejects.toThrow('Failed to fetch container types');
  });

  it('uses cache to avoid repeated DB calls under load', async () => {
    const db = makeDbMock({
      container_types: () => ({ data: [{ id: 'dry', name: 'Dry', code: 'DRY' }], error: null }),
    });

    const service = new ContainerMetadataApiService(db);

    await service.getContainerTypes('tenant-1');
    const start = Date.now();
    const results = await Promise.all(
      Array.from({ length: 200 }, () => service.getContainerTypes('tenant-1'))
    );
    const elapsed = Date.now() - start;

    expect(results).toHaveLength(200);
    expect((db as any).from).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(500);
  });

  it('filters sizes by type id', async () => {
    const db = makeDbMock({
      container_sizes: () => ({
        data: [{ id: '20', name: '20ft', iso_code: '22G1', container_type_id: 'dry' }],
        error: null,
      }),
    });

    const service = new ContainerMetadataApiService(db);
    const data = await service.getContainerSizes('tenant-1', 'dry');

    expect(data[0].containerTypeSourceId).toBe('dry');
  });
});
