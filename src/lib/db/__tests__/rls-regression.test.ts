import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScopedDataAccess, DataAccessContext } from '../access';
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

describe('RLS Regression Suite: ScopedDataAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createSUT = (context: DataAccessContext) => {
    return new ScopedDataAccess(mockSupabase, context);
  };

  it('Scenario 1: Platform Admin (No Override) - Should access global data', () => {
    const context: DataAccessContext = {
      isPlatformAdmin: true,
      isTenantAdmin: false,
      isFranchiseAdmin: false,
      adminOverrideEnabled: false,
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1'
    };
    
    const sut = createSUT(context);
    sut.from('accounts').select('*');

    // Should NOT apply filters even if IDs are present in context
    expect(mockQueryBuilder.eq).not.toHaveBeenCalled();
  });

  it('Scenario 2: Platform Admin (With Override) - Should simulate specific tenant', () => {
    const context: DataAccessContext = {
      isPlatformAdmin: true,
      isTenantAdmin: false,
      isFranchiseAdmin: false,
      adminOverrideEnabled: true,
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1'
    };
    
    const sut = createSUT(context);
    sut.from('accounts').select('*');

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('franchise_id', 'franchise-1');
  });

  it('Scenario 3: Tenant Admin - Must be scoped to Tenant', () => {
    const context: DataAccessContext = {
      isPlatformAdmin: false,
      isTenantAdmin: true,
      isFranchiseAdmin: false,
      tenantId: 'tenant-1',
      franchiseId: null
    };
    
    const sut = createSUT(context);
    sut.from('accounts').select('*');

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    // Should NOT filter by franchise if not set
    expect(mockQueryBuilder.eq).not.toHaveBeenCalledWith('franchise_id', expect.any(String));
  });

  it('Scenario 4: Tenant Admin - Can filter by Franchise optionally', () => {
    const context: DataAccessContext = {
      isPlatformAdmin: false,
      isTenantAdmin: true,
      isFranchiseAdmin: false,
      tenantId: 'tenant-1',
      franchiseId: 'franchise-sub-1'
    };
    
    const sut = createSUT(context);
    sut.from('accounts').select('*');

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('franchise_id', 'franchise-sub-1');
  });

  it('Scenario 5: Franchise Admin - Must be scoped to Tenant AND Franchise', () => {
    const context: DataAccessContext = {
      isPlatformAdmin: false,
      isTenantAdmin: false,
      isFranchiseAdmin: true,
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1'
    };
    
    const sut = createSUT(context);
    sut.from('accounts').select('*');

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('franchise_id', 'franchise-1');
  });

  it('Scenario 6: Standard User - Must be scoped to Tenant AND Franchise', () => {
    const context: DataAccessContext = {
      isPlatformAdmin: false,
      isTenantAdmin: false,
      isFranchiseAdmin: false,
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1'
    };
    
    const sut = createSUT(context);
    sut.from('accounts').select('*');

    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('franchise_id', 'franchise-1');
  });

  it('Scenario 7: Bypass Mode - Should NOT apply filters when bypass=true', () => {
    const context: DataAccessContext = {
      isPlatformAdmin: false,
      isTenantAdmin: true,
      isFranchiseAdmin: false,
      tenantId: 'tenant-1'
    };
    
    const sut = createSUT(context);
    // Passing true as second argument to from() enables bypass mode
    sut.from('accounts', true).select('*');

    expect(mockQueryBuilder.eq).not.toHaveBeenCalled();
  });
});
