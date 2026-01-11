import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScopedDataAccess, DataAccessContext, withScope } from '../access';
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

describe('ScopedDataAccess - Admin Override Strictness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Filtering (SELECT)', () => {
    it('should strictly filter by tenant when override is enabled for Platform Admin', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: true,
        tenantId: 'override-tenant-id',
        userId: 'admin-user',
      };

      const dao = new ScopedDataAccess(mockSupabase, context);
      dao.from('leads').select();

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'override-tenant-id');
    });

    it('should strictly filter by tenant AND franchise when override is enabled with franchise', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: true,
        tenantId: 'override-tenant-id',
        franchiseId: 'override-franchise-id',
        userId: 'admin-user',
      };

      const dao = new ScopedDataAccess(mockSupabase, context);
      dao.from('leads').select();

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 'override-tenant-id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('franchise_id', 'override-franchise-id');
    });

    it('should NOT filter if override is disabled (Global View)', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: false,
        tenantId: 'some-tenant-id', // Context might have it, but override is disabled
        userId: 'admin-user',
      };

      const dao = new ScopedDataAccess(mockSupabase, context);
      dao.from('leads').select();

      expect(mockQueryBuilder.eq).not.toHaveBeenCalled();
    });
  });

  describe('Injection (INSERT)', () => {
    it('should inject tenant_id when override is enabled for Platform Admin', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: true,
        tenantId: 'override-tenant-id',
        userId: 'admin-user',
      };

      const dao = new ScopedDataAccess(mockSupabase, context);
      dao.from('leads').insert({ name: 'New Lead' });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        name: 'New Lead',
        tenant_id: 'override-tenant-id',
      });
    });

    it('should inject tenant_id and franchise_id when override is enabled', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: true,
        tenantId: 'override-tenant-id',
        franchiseId: 'override-franchise-id',
        userId: 'admin-user',
      };

      const dao = new ScopedDataAccess(mockSupabase, context);
      dao.from('leads').insert({ name: 'New Lead' });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        name: 'New Lead',
        tenant_id: 'override-tenant-id',
        franchise_id: 'override-franchise-id',
      });
    });

    it('should NOT inject tenant_id if override is disabled', () => {
      const context: DataAccessContext = {
        isPlatformAdmin: true,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        adminOverrideEnabled: false,
        tenantId: 'override-tenant-id',
        userId: 'admin-user',
      };

      const dao = new ScopedDataAccess(mockSupabase, context);
      dao.from('leads').insert({ name: 'New Lead' });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        name: 'New Lead',
      });
    });
  });
});
