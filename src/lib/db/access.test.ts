import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScopedDataAccess, DataAccessContext, withScope } from './access';
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

describe('ScopedDataAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withScope', () => {
    it('should not apply filters for Platform Admin without override', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: false,
      };

      withScope(mockQueryBuilder, context);
      expect(mockQueryBuilder.eq).not.toHaveBeenCalled();
    });

    it('should apply tenant filter for Platform Admin with override and tenantId', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: true,
        tenantId: 'tenant-123',
      };

      withScope(mockQueryBuilder, context);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    });

    it('should apply franchise filter for Platform Admin with override and franchiseId', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: true,
        franchiseId: 'franchise-456',
      };

      withScope(mockQueryBuilder, context);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('franchise_id', 'franchise-456');
    });

    it('should apply tenant filter for Tenant Admin', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: false,
        isTenantAdmin: true,
        isFranchiseAdmin: false,
        tenantId: 'tenant-123',
      };

      withScope(mockQueryBuilder, context);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    });

    it('should apply tenant and franchise filters for Franchise Admin', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: false,
        isTenantAdmin: false,
        isFranchiseAdmin: true,
        tenantId: 'tenant-123',
        franchiseId: 'franchise-456',
      };

      withScope(mockQueryBuilder, context);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('franchise_id', 'franchise-456');
    });
  });

  describe('ScopedDataAccess class', () => {
    it('should inject scope on insert for non-platform admin', async () => {
      const context: DataAccessContext = {
        isPlatformAdmin: false,
        isTenantAdmin: true,
        isFranchiseAdmin: false,
        tenantId: 'tenant-123',
        userId: 'user-1',
      };

      const dao = new ScopedDataAccess(mockSupabase, context);
      dao.from('leads').insert({ name: 'Test Lead' });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        name: 'Test Lead',
        tenant_id: 'tenant-123',
      });
    });

    it('should not inject scope on insert for platform admin', async () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        tenantId: 'tenant-123', // Even if present, shouldn't force inject if not desired?
        // Wait, the logic says: "Only inject if not platform admin, or if platform admin didn't specify them (optional)"
        // Let's check implementation:
        // if (!this.context.isPlatformAdmin) { ... }
        // So for Platform Admin it does NOT inject automatically.
      };

      const dao = new ScopedDataAccess(mockSupabase, context);
      dao.from('leads').insert({ name: 'Test Lead' });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        name: 'Test Lead',
      });
    });
  });
});
