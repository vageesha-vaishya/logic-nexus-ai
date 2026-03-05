import type { SupabaseClient } from '@supabase/supabase-js';
import { checkDbPoolHealth, runPoolQuery } from '@/pages/api/_utils/dbPool';
import { ConnectionPoolException } from '@/pages/api/_utils/errors';

export interface ContainerTypeResponse {
  id: number;
  sourceId: string;
  name: string;
  description: string;
  isActive: boolean;
  code: string;
}

export interface ContainerSizeResponse {
  id: number;
  sourceId: string;
  containerTypeSourceId: string;
  name: string;
  description: string;
  isActive: boolean;
  isoCode: string;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_TIMEOUT_MS = 15_000;

function stableNumericId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash || 1);
}

class InMemoryMetadataCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  health(): boolean {
    return true;
  }
}

const sharedCache = new InMemoryMetadataCache();

export class ContainerMetadataApiService {
  private typeCachePrefix = 'container_types';
  private sizeCachePrefix = 'container_sizes';

  constructor(private readonly db: SupabaseClient) {}

  private withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out after ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS);
      }),
    ]);
  }

  private mapTypeRow(row: any): ContainerTypeResponse {
    const sourceId = String(row.id);
    return {
      id: stableNumericId(sourceId),
      sourceId,
      name: String(row.name || ''),
      description: String(row.description || row.name || ''),
      isActive: row.is_active !== false,
      code: String(row.code || ''),
    };
  }

  private mapSizeRow(row: any): ContainerSizeResponse {
    const sourceId = String(row.id);
    const typeSourceId = String(row.container_type_id || row.type_id || '');
    return {
      id: stableNumericId(sourceId),
      sourceId,
      containerTypeSourceId: typeSourceId,
      name: String(row.name || row.size_name || row.size_code || ''),
      description: String(row.description || row.name || row.size_name || ''),
      isActive: row.is_active !== false,
      isoCode: String(row.iso_code || ''),
    };
  }

  private async queryTypesViaPool(tenantId: string): Promise<ContainerTypeResponse[]> {
    const rows = tenantId
      ? await runPoolQuery<any>(
          `
          select id, name, description, code, is_active
          from container_types
          where is_active = true
            and (tenant_id = $1 or tenant_id is null)
          order by name asc
          `,
          [tenantId]
        )
      : await runPoolQuery<any>(
          `
          select id, name, description, code, is_active
          from container_types
          where is_active = true
          order by name asc
          `,
          []
        );
    return rows.map((row) => this.mapTypeRow(row));
  }

  private async querySizesViaPool(typeId?: string): Promise<ContainerSizeResponse[]> {
    const rows = typeId
      ? await runPoolQuery<any>(
          `
          select id, name, description, iso_code, container_type_id, type_id, is_active, size_name, size_code
          from container_sizes
          where is_active = true
            and (container_type_id = $1 or type_id = $1)
          order by name asc
          `,
          [typeId]
        )
      : await runPoolQuery<any>(
          `
          select id, name, description, iso_code, container_type_id, type_id, is_active, size_name, size_code
          from container_sizes
          where is_active = true
          order by name asc
          `,
          []
        );

    return rows.map((row) => this.mapSizeRow(row));
  }

  async getContainerTypes(tenantId: string): Promise<ContainerTypeResponse[]> {
    const cacheKey = `${this.typeCachePrefix}:${tenantId}`;
    const cached = sharedCache.get<ContainerTypeResponse[]>(cacheKey);
    if (cached) return cached;

    let rows: ContainerTypeResponse[] = [];

    try {
      rows = await this.queryTypesViaPool(tenantId);
    } catch (poolError) {
      if (!(poolError instanceof ConnectionPoolException)) {
        // Continue fallback path for non-pool setup issues.
      }

      const query = this.db
        .from('container_types')
        .select('id, name, description, code, is_active')
        .eq('is_active', true);

      if (tenantId) {
        query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
      }

      const queryResult = query.order('name', { ascending: true });

      const { data, error } = await this.withTimeout(queryResult as any, 'container_types query');
      if (error) throw new Error(`Failed to fetch container types: ${error.message}`);
      rows = ((data || []) as any[]).map((row) => this.mapTypeRow(row));
    }

    sharedCache.set(cacheKey, rows);
    return rows;
  }

  async getContainerSizes(tenantId: string, typeId?: string): Promise<ContainerSizeResponse[]> {
    const normalizedType = (typeId || 'all').trim();
    const cacheKey = `${this.sizeCachePrefix}:${tenantId}:${normalizedType}`;
    const cached = sharedCache.get<ContainerSizeResponse[]>(cacheKey);
    if (cached) return cached;

    let rows: ContainerSizeResponse[] = [];

    try {
      rows = await this.querySizesViaPool(typeId);
    } catch {
      let query = this.db
        .from('container_sizes')
        .select('id, name, description, size_name, iso_code, size_code, container_type_id, type_id, is_active');

      if (typeId) {
        query = query.or(`container_type_id.eq.${typeId},type_id.eq.${typeId}`);
      }

      const queryResult = query.order('name', { ascending: true });

      const { data, error } = await this.withTimeout(queryResult as any, 'container_sizes query');
      if (error) throw new Error(`Failed to fetch container sizes: ${error.message}`);
      rows = ((data || []) as any[]).map((row) => this.mapSizeRow(row));
    }

    sharedCache.set(cacheKey, rows);
    return rows;
  }

  invalidateCache(tenantId?: string): void {
    if (!tenantId) {
      sharedCache.clear();
      return;
    }

    sharedCache.del(`${this.typeCachePrefix}:${tenantId}`);
    const prefixes = [`${this.sizeCachePrefix}:${tenantId}:all`, `${this.sizeCachePrefix}:${tenantId}:`];
    // In-memory store doesn't support prefix scans efficiently with encapsulation.
    // Clear all to guarantee consistency.
    prefixes.forEach(() => sharedCache.clear());
  }

  async checkHealth(): Promise<{ db: boolean; cache: boolean }> {
    let dbHealthy = false;
    try {
      dbHealthy = await checkDbPoolHealth();
      if (!dbHealthy) {
        const { error } = await this.db.from('container_types').select('id').limit(1);
        dbHealthy = !error;
      }
    } catch {
      dbHealthy = false;
    }

    return {
      db: dbHealthy,
      cache: sharedCache.health(),
    };
  }
}
