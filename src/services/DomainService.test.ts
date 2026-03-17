
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainService, PlatformDomain } from './DomainService';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('DomainService', () => {
  const mockDomains: PlatformDomain[] = [
    { id: '1', code: 'logistics', name: 'Logistics', description: 'Logistics domain', is_active: true },
    { id: '2', code: 'finance', name: 'Finance', description: 'Finance domain', is_active: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    DomainService.invalidateCache();
    vi.stubGlobal('fetch', vi.fn());
    (supabase.auth.getSession as any).mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
        },
      },
    });
  });

  describe('getAuthorizedDomains', () => {
    const jsonHeaders = { get: vi.fn().mockReturnValue('application/json') };

    it('should return authorized domains payload from API', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: jsonHeaders,
        json: async () => ({
          data: {
            domains: mockDomains,
            tenantDomainCount: 2,
            tenantId: 'tenant-1',
            isPlatformAdmin: false,
          },
        }),
      } as unknown as Response);

      const result = await DomainService.getAuthorizedDomains();

      expect(fetch).toHaveBeenCalledWith('/api/v1/platform-domains', expect.any(Object));
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/platform-domains',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer session-token',
          }),
        })
      );
      expect(result.domains).toEqual(mockDomains);
      expect(result.tenantDomainCount).toBe(2);
      expect(result.tenantId).toBe('tenant-1');
      expect(result.isPlatformAdmin).toBe(false);
    });

    it('should throw when API responds with an error', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        headers: jsonHeaders,
        json: async () => ({ error: 'Forbidden' }),
      } as unknown as Response);

      await expect(DomainService.getAuthorizedDomains()).rejects.toThrow('Forbidden');
    });

    it('should include correlation reference in thrown errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: jsonHeaders,
        json: async () => ({ error: 'Internal Server Error', correlationId: 'corr-500' }),
      } as unknown as Response);

      await expect(DomainService.getAuthorizedDomains()).rejects.toThrow('ref: corr-500');
    });

    it('should recover when API returns HTML instead of JSON', async () => {
      const mockFetch = vi.mocked(fetch);
      const tenantAssignmentsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ platform_domains: mockDomains[0] }],
          error: null,
        }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'tenant_domain_assignments') return tenantAssignmentsChain;
        throw new Error(`Unexpected table: ${table}`);
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn().mockReturnValue('text/html') },
        text: async () => '<!doctype html><html></html>',
      } as unknown as Response);

      const result = await DomainService.getAuthorizedDomains();
      expect(result.domains).toEqual([mockDomains[0]]);
      expect(result.tenantDomainCount).toBe(1);
      expect(result.isPlatformAdmin).toBe(false);
    });
  });

  describe('getAllDomains', () => {
    it('should fetch domains from supabase when cache is empty', async () => {
      const mockSelect = vi.fn().mockReturnValue({ data: mockDomains, error: null });
      const mockOrder = vi.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: mockDomains, error: null }) }) });
      
      // Detailed mock setup to match the chain: .from().select().order()
      // Note: The previous simple mock structure might be insufficient for the chained calls
      // Let's refine the mock to be more robust
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDomains, error: null }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await DomainService.getAllDomains();

      expect(supabase.from).toHaveBeenCalledWith('platform_domains');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.order).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockDomains);
    });

    it('should return cached domains on subsequent calls', async () => {
      // First call to populate cache
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDomains, error: null }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValue(mockChain);

      await DomainService.getAllDomains();
      
      // Clear mock to ensure it's not called again
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockClear();

      // Second call should use cache
      const result = await DomainService.getAllDomains();

      expect(supabase.from).not.toHaveBeenCalled();
      expect(result).toEqual(mockDomains);
    });

    it('should force refresh when requested', async () => {
      // First call to populate cache
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDomains, error: null }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValue(mockChain);

      await DomainService.getAllDomains();
      
      // Second call with forceRefresh=true
      await DomainService.getAllDomains(true);

      expect(supabase.from).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      const mockError = { message: 'Network error' };
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValue(mockChain);

      await expect(DomainService.getAllDomains()).rejects.toEqual(mockError);
    });
  });

  describe('getDomainByCode', () => {
    it('should return the correct domain by code', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDomains, error: null }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await DomainService.getDomainByCode('logistics');
      expect(result).toEqual(mockDomains[0]);
    });

    it('should return undefined for non-existent code', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDomains, error: null }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await DomainService.getDomainByCode('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('createDomain', () => {
    it('should create a new domain and invalidate cache', async () => {
      const newDomain = { name: 'New', code: 'new', description: 'New', is_active: true };
      const createdDomain = { ...newDomain, id: '3', created_at: 'now', updated_at: 'now' };

      const listChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDomains, error: null }),
      };
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdDomain, error: null }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValueOnce(listChain).mockReturnValueOnce(insertChain);

      // Pre-populate cache to test invalidation
      // We can cheat by setting the private cache variable if it was accessible, 
      // or just trust the invalidateCache call
      const spyInvalidate = vi.spyOn(DomainService, 'invalidateCache');

      const result = await DomainService.createDomain(newDomain);

      expect(supabase.from).toHaveBeenCalledWith('platform_domains');
      expect(insertChain.insert).toHaveBeenCalledWith(newDomain);
      expect(result).toEqual(createdDomain);
      expect(spyInvalidate).toHaveBeenCalled();
    });
  });

  describe('updateDomain', () => {
    it('should update a domain and invalidate cache', async () => {
      const updates = { name: 'Updated Name' };
      const updatedDomain = { ...mockDomains[0], ...updates };

      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedDomain, error: null }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValue(mockChain);

      const spyInvalidate = vi.spyOn(DomainService, 'invalidateCache');

      const result = await DomainService.updateDomain('1', updates);

      expect(supabase.from).toHaveBeenCalledWith('platform_domains');
      expect(mockChain.update).toHaveBeenCalledWith(updates);
      expect(mockChain.eq).toHaveBeenCalledWith('id', '1');
      expect(result).toEqual(updatedDomain);
      expect(spyInvalidate).toHaveBeenCalled();
    });
  });

  describe('deleteDomain', () => {
    it('should delete a domain and invalidate cache', async () => {
      const mockChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from as any).mockReturnValue(mockChain);

      const spyInvalidate = vi.spyOn(DomainService, 'invalidateCache');

      await DomainService.deleteDomain('1');

      expect(supabase.from).toHaveBeenCalledWith('platform_domains');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', '1');
      expect(spyInvalidate).toHaveBeenCalled();
    });
  });

  describe('setTenantDomains', () => {
    it('assigns and revokes domain memberships for a tenant', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: async () => ({ data: { ok: true } }),
      } as unknown as Response);

      const result = await DomainService.setTenantDomains('tenant-1', ['d1', 'd3'], ['d1', 'd2']);

      expect(result.assigned).toBe(1);
      expect(result.revoked).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/api/v1/domain-assignments',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"domainId":"d3"'),
        }),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/v1/domain-assignments',
        expect.objectContaining({
          method: 'DELETE',
          body: expect.stringContaining('"domainId":"d2"'),
        }),
      );
    });

    it('throws parsed API errors with correlation id', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: async () => ({ error: 'Forbidden', correlationId: 'corr-dom-1' }),
      } as unknown as Response);

      await expect(
        DomainService.setTenantDomains('tenant-1', ['d1'], []),
      ).rejects.toThrow('Forbidden (ref: corr-dom-1)');
    });
  });

  describe('getDomainAssignmentAuditHistory', () => {
    it('returns audit rows and sends query filters', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: async () => ({
          data: [
            {
              id: 'a1',
              action: 'DOMAIN_ASSIGN',
              tenant_id: 'tenant-1',
              domain_id: 'd1',
              actor_user_id: 'user-1',
              batch_id: 'batch-1',
              metadata: { assigned: 1 },
              created_at: '2026-03-17T12:00:00.000Z',
            },
          ],
        }),
      } as unknown as Response);

      const rows = await DomainService.getDomainAssignmentAuditHistory({
        tenantId: 'tenant-1',
        domainId: 'd1',
        batchId: 'batch-1',
        limit: 20,
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe('DOMAIN_ASSIGN');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/domain-assignments?tenant_id=tenant-1&domain_id=d1&batch_id=batch-1&limit=20',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer session-token',
          }),
        }),
      );
    });

    it('throws parsed audit API errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: async () => ({ error: 'Audit failure', correlationId: 'corr-audit-1' }),
      } as unknown as Response);

      await expect(
        DomainService.getDomainAssignmentAuditHistory(),
      ).rejects.toThrow('Audit failure (ref: corr-audit-1)');
    });
  });
});
