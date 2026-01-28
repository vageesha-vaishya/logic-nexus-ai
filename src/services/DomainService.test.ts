
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainService, PlatformDomain } from './DomainService';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
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
      (supabase.from as any).mockReturnValue(mockChain);

      await DomainService.getAllDomains();
      
      // Clear mock to ensure it's not called again
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
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await DomainService.getDomainByCode('logistics');
      expect(result).toEqual(mockDomains[0]);
    });

    it('should return undefined for non-existent code', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDomains, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await DomainService.getDomainByCode('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('createDomain', () => {
    it('should create a new domain and invalidate cache', async () => {
      const newDomain = { name: 'New', code: 'new', description: 'New', is_active: true };
      const createdDomain = { ...newDomain, id: '3', created_at: 'now', updated_at: 'now' };

      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdDomain, error: null }),
      };
      (supabase.from as any).mockReturnValue(mockChain);

      // Pre-populate cache to test invalidation
      // We can cheat by setting the private cache variable if it was accessible, 
      // or just trust the invalidateCache call
      const spyInvalidate = vi.spyOn(DomainService, 'invalidateCache');

      const result = await DomainService.createDomain(newDomain);

      expect(supabase.from).toHaveBeenCalledWith('platform_domains');
      expect(mockChain.insert).toHaveBeenCalledWith(newDomain);
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
      (supabase.from as any).mockReturnValue(mockChain);

      const spyInvalidate = vi.spyOn(DomainService, 'invalidateCache');

      await DomainService.deleteDomain('1');

      expect(supabase.from).toHaveBeenCalledWith('platform_domains');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', '1');
      expect(spyInvalidate).toHaveBeenCalled();
    });
  });
});
