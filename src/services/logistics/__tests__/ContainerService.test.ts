import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainerService } from '../ContainerService';

describe('ContainerService', () => {
  let mockDb: any;
  let service: ContainerService;

  beforeEach(() => {
    // Reset singleton instance if possible or just get it
    // Note: Since it's a singleton, state might persist. 
    // Ideally we should be able to reset it, but for this test we'll rely on cache clearing if we implemented it,
    // or just mock the DB responses differently.
    // Actually, since we pass 'db' to methods, we can control the behavior per call.
    
    service = ContainerService.getInstance();
    
    // Mock Supabase client structure
    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
  });

  describe('getAllContainers', () => {
    it('should fetch and join types and sizes correctly', async () => {
      const mockTypes = [
        { id: 't1', code: '20GP', name: '20ft General' }
      ];
      const mockSizes = [
        { id: 's1', container_type_id: 't1', length_ft: 20, capacity_cbm: 33 }
      ];

      // Mock chain for types
      mockDb.from.mockImplementationOnce((table: string) => {
        if (table === 'container_types') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockTypes, error: null })
          };
        }
        if (table === 'container_sizes') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockSizes, error: null })
          };
        }
        return { select: vi.fn() };
      });

      // We need to bypass the cache for this test to ensure it calls DB
      // Access private property or just assume first run.
      // TypeScript might complain about private property access.
      // @ts-ignore
      service.containerCache = null;

      const result = await service.getAllContainers(mockDb);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('20GP');
      expect(result[0].specifications.capacity_cbm).toBe(33);
    });

    it('should handle missing size definitions gracefully', async () => {
        const mockTypes = [
          { id: 't1', code: '20GP' },
          { id: 't2', code: '40GP' } // Missing size
        ];
        const mockSizes = [
          { id: 's1', container_type_id: 't1' }
        ];
  
        mockDb.from.mockImplementation((table: string) => {
            if (table === 'container_types') return { select: vi.fn().mockResolvedValue({ data: mockTypes, error: null }) };
            if (table === 'container_sizes') return { select: vi.fn().mockResolvedValue({ data: mockSizes, error: null }) };
            return { select: vi.fn() };
        });
  
        // @ts-ignore
        service.containerCache = null;
  
        const result = await service.getAllContainers(mockDb);
        expect(result).toHaveLength(1); // Should filter out t2
        expect(result[0].code).toBe('20GP');
    });
  });

  describe('validateCargoFit', () => {
    const mockContainer: any = {
      code: '20GP',
      specifications: {
        max_payload_kg: 28000,
        capacity_cbm: 33
      }
    };

    it('should return true if cargo fits', () => {
      const result = service.validateCargoFit(mockContainer, 20000, 30);
      expect(result.fits).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should return false if weight exceeds limit', () => {
      const result = service.validateCargoFit(mockContainer, 29000, 30);
      expect(result.fits).toBe(false);
      expect(result.reasons).toContain('Weight exceeds limit (29000kg > 28000kg)');
    });

    it('should return false if volume exceeds limit', () => {
      const result = service.validateCargoFit(mockContainer, 20000, 35);
      expect(result.fits).toBe(false);
      expect(result.reasons).toContain('Volume exceeds capacity (35m³ > 33m³)');
    });
  });
});
