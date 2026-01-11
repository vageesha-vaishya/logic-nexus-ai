import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScopedDataAccess, DataAccessContext } from '../access';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase Client
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
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
} as unknown as SupabaseClient;

describe('Admin Override Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should simulate full platform admin override workflow', async () => {
    // 1. Initial State: Platform Admin, Override Disabled
    let context: DataAccessContext = {
      isPlatformAdmin: true,
      isTenantAdmin: false,
      isFranchiseAdmin: false,
      adminOverrideEnabled: false,
      userId: 'admin-1',
    };

    let dao = new ScopedDataAccess(mockSupabase, context);
    
    // Verify Global Access (No Filters)
    await dao.from('leads').select();
    expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith('tenant_id', expect.anything());

    // 2. Enable Override (Simulate setAdminOverride RPC effect on context)
    // In real app, RPC is called, then preferences re-fetched, updating context
    context = {
      ...context,
      adminOverrideEnabled: true,
      tenantId: 'tenant-A',
      franchiseId: null, // All franchises in tenant-A
    };
    dao = new ScopedDataAccess(mockSupabase, context);

    // Verify Scoped Access (Tenant Filter)
    await dao.from('leads').select();
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A');
    
    // 3. Drill down to Franchise (Simulate setScopePreference RPC effect)
    context = {
      ...context,
      franchiseId: 'franchise-A1',
    };
    dao = new ScopedDataAccess(mockSupabase, context);

    // Verify Scoped Access (Tenant + Franchise Filter)
    await dao.from('leads').select();
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('franchise_id', 'franchise-A1');

    // 4. Create Data (Insert)
    await dao.from('leads').insert({ name: 'New Lead' });
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
      name: 'New Lead',
      tenant_id: 'tenant-A',
      franchise_id: 'franchise-A1',
    });

    // 5. Disable Override
    context = {
      ...context,
      adminOverrideEnabled: false,
    };
    dao = new ScopedDataAccess(mockSupabase, context);

    // Verify Global Access Again
    vi.clearAllMocks(); // Clear previous calls
    await dao.from('leads').select();
    expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith('tenant_id', expect.anything());
  });

  it('should prevent data leakage between tenants when override is active', async () => {
    const context: DataAccessContext = {
      isPlatformAdmin: true,
      isTenantAdmin: false,
      isFranchiseAdmin: false,
      adminOverrideEnabled: true,
      tenantId: 'tenant-A',
      userId: 'admin-1',
    };

    const dao = new ScopedDataAccess(mockSupabase, context);
    
    // Attempt to access data
    await dao.from('leads').select();
    
    // Check that we STRICTLY filtered by tenant-A
    // This implies we CANNOT see tenant-B data
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-A');
  });
});
