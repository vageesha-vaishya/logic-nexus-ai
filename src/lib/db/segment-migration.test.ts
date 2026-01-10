import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScopedDataAccess, DataAccessContext } from './access';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase Client and Query Builder
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  then: vi.fn((resolve) => resolve({ data: [], error: null })),
};

const mockSupabase = {
  from: vi.fn().mockReturnValue(mockQueryBuilder),
} as unknown as SupabaseClient;

describe('Segment Migration Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const tenantContext: DataAccessContext = {
    isPlatformAdmin: false,
    isTenantAdmin: true,
    isFranchiseAdmin: false,
    tenantId: 'tenant-123',
    userId: 'user-1',
  };

  it('should apply tenant_id filter when selecting from segment_members', async () => {
    const dao = new ScopedDataAccess(mockSupabase, tenantContext);
    
    // Simulate the query used in ContactDetail.tsx and AccountDetail.tsx
    await dao.from('segment_members' as any).select('*');

    // Verify that the query was scoped to the tenant
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
  });

  it('should inject tenant_id when inserting into segment_members', async () => {
    const dao = new ScopedDataAccess(mockSupabase, tenantContext);

    await dao.from('segment_members' as any).insert({
      segment_id: 'seg-1',
      entity_id: 'contact-1',
    });

    // Verify that tenant_id was added to the payload
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-123',
      segment_id: 'seg-1',
      entity_id: 'contact-1',
    }));
  });

  it('should apply tenant_id filter when updating segment_members', async () => {
    const dao = new ScopedDataAccess(mockSupabase, tenantContext);

    await dao.from('segment_members' as any).update({
      added_at: new Date().toISOString(),
    });

    // Verify update payload and scope
    // Note: ScopedDataAccess usually doesn't inject tenant_id on update payload (it's immutable usually),
    // but it MUST filter by tenant_id to prevent updating other tenants' data.
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
  });
});
