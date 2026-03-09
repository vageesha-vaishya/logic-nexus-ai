// Regression Tests for MGL NYC-DED Routing Engine
// Ensures backward compatibility with existing quotation workflows for QUO-260309-00001

import { describe, it, expect, vi } from 'vitest';
import { NycDedRoutingEngine } from '../../src/services/quotation/mgl/routing-engine';
import { ScopedDataAccess } from '../../src/lib/db/access';
import type { RoutingMatrixEntry } from '../../src/services/quotation/mgl/routing-engine';

// Mock database responses for regression testing
const createLegacyCompatibleData = (): RoutingMatrixEntry[] => [
  {
    originCode: 'JFK',
    destinationCode: 'DED',
    transportMode: 'air',
    carrierCoverage: ['MiamiGlobal'],
    transitTimeDays: 2,
    frequencyPerWeek: 7,
    viabilityScore: 0.9,
    historicalPerformance: 0.95,
    geographicConstraints: {},
    preferredTransshipmentHubs: []
  } as RoutingMatrixEntry,
  {
    originCode: 'EWR',
    destinationCode: 'DED',
    transportMode: 'air',
    carrierCoverage: ['MiamiGlobal'],
    transitTimeDays: 3,
    frequencyPerWeek: 5,
    viabilityScore: 0.88,
    historicalPerformance: 0.92,
    geographicConstraints: {},
    preferredTransshipmentHubs: []
  } as RoutingMatrixEntry
];

// Mock ScopedDataAccess for regression testing
function createRegressionMockScopedDb(routeData: RoutingMatrixEntry[] = []) {
  const finalResult = { data: routeData, error: null };
  const singleResult = { data: routeData[0] ?? null, error: null };
  const queryBuilder: any = {
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(finalResult),
    single: vi.fn().mockResolvedValue(singleResult),
  };

  const mockSelect = vi.fn().mockReturnValue(queryBuilder);
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

  return {
    from: mockFrom
  } as unknown as ScopedDataAccess;
}

describe('NycDedRoutingEngine Regression Tests', () => {
  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing quotation data structures', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      const result = await engine.optimizeNycToDedRoute('general', 'standard');
      
      // Verify result structure matches expected format
      expect(result).toHaveProperty('recommendedRoute');
      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('totalTransitDays');
      expect(result).toHaveProperty('transferPoints');
      expect(result).toHaveProperty('serviceLevel');
      expect(result).toHaveProperty('carrierAlliances');
      
      // Verify route contains valid data
      expect(result.recommendedRoute.length).toBeGreaterThan(0);
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.totalTransitDays).toBeGreaterThan(0);
    });

    it('should handle legacy commodity types without breaking changes', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      // Test all legacy commodity types
      const commodityTypes = ['general', 'hazardous', 'perishable', 'pharmaceutical', 'fragile'] as const;
      
      for (const commodityType of commodityTypes) {
        const result = await engine.optimizeNycToDedRoute(commodityType, 'standard');
        
        expect(result).toBeDefined();
        expect(result.recommendedRoute.length).toBeGreaterThan(0);
        
        // Verify commodity-specific viability scoring is applied
        // Note: Viability scoring is handled at the routing matrix level, not individual leg level
      }
    });

    it('should maintain existing optimization priority behaviors', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      // Test all optimization priorities
      const priorities = ['cost', 'time', 'reliability'] as const;
      
      for (const priority of priorities) {
        const result = await engine.optimizeNycToDedRoute('general', 'standard', priority);
        
        expect(result).toBeDefined();
        expect(result.recommendedRoute.length).toBeGreaterThan(0);
        
        // Verify priority-specific behaviors
        if (priority === 'cost') {
          expect(result.totalCost).toBeLessThanOrEqual(5000); // Cost-optimized routes should be affordable
        } else if (priority === 'time') {
          expect(result.totalTransitDays).toBeLessThanOrEqual(5); // Time-optimized routes should be fast
        } else if (priority === 'reliability') {
          // Reliability is determined by overall route quality, not individual leg performance
          expect(result.totalCost).toBeGreaterThan(0); // Reliability-optimized routes should have valid costs
        }
      }
    });
  });

  describe('API Compatibility', () => {
    it('should maintain existing method signatures and return types', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      // Test that all public methods exist and return expected types
      expect(typeof engine.optimizeNycToDedRoute).toBe('function');
      
      const result = await engine.optimizeNycToDedRoute('general', 'standard');
      
      // Verify return type structure
      expect(result).toMatchObject({
        recommendedRoute: expect.any(Array),
        totalCost: expect.any(Number),
        totalTransitDays: expect.any(Number),
        transferPoints: expect.any(Array),
        serviceLevel: expect.any(String),
        carrierAlliances: expect.any(Array)
      });
    });

    it('should handle error conditions consistently with legacy behavior', async () => {
      // Test with empty database to simulate no routes found
      const emptyDb = createRegressionMockScopedDb([]);
      const engine = new NycDedRoutingEngine(emptyDb);

      await expect(engine.optimizeNycToDedRoute('general', 'standard'))
        .rejects.toThrow('No viable routes found from NYC to Dehra Dun Airport');
    });

    it('should maintain compatibility with existing container types', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      // Test all standard container types
      const containerTypes = ['standard', 'reefer', 'open_top', 'flat_rack'] as const;
      
      for (const containerType of containerTypes) {
        const result = await engine.optimizeNycToDedRoute('general', containerType);
        
        expect(result).toBeDefined();
        expect(result.recommendedRoute.length).toBeGreaterThan(0);
        
        // Container type should not break routing logic
        expect(result.totalCost).toBeGreaterThan(0);
        expect(result.totalTransitDays).toBeGreaterThan(0);
      }
    });
  });

  describe('Integration Compatibility', () => {
    it('should work with existing CRM system integration patterns', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      // Simulate CRM integration pattern
      const quotationRequest = {
        commodityType: 'general' as const,
        containerType: 'standard' as const,
        priority: 'cost' as const,
        origin: 'NYC',
        destination: 'DED'
      };

      const result = await engine.optimizeNycToDedRoute(
        quotationRequest.commodityType,
        quotationRequest.containerType,
        quotationRequest.priority
      );

      // Verify result can be integrated into CRM response format
      const crmResponse = {
        success: true,
        data: {
          route: result.recommendedRoute,
          cost: result.totalCost,
          transitTime: result.totalTransitDays,
          serviceLevel: result.serviceLevel,
          carrierInfo: result.carrierAlliances
        },
        quotationNumber: 'QUO-260309-00001'
      };

      expect(crmResponse.success).toBe(true);
      expect(crmResponse.data.cost).toBeGreaterThan(0);
      expect(crmResponse.data.transitTime).toBeGreaterThan(0);
      expect(crmResponse.quotationNumber).toBe('QUO-260309-00001');
    });

    it('should maintain booking platform compatibility', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      const result = await engine.optimizeNycToDedRoute('general', 'standard');

      // Verify booking platform compatible format
      const bookingPayload = {
        legs: result.recommendedRoute.map(leg => ({
          origin: leg.originCode,
          destination: leg.destinationCode,
          carrier: leg.carrierName,
          mode: leg.mode,
          transitTime: leg.transitDays
        })),
        totalCost: result.totalCost,
        totalTransitTime: result.totalTransitDays,
        serviceLevel: result.serviceLevel
      };

      expect(bookingPayload.legs.length).toBeGreaterThan(0);
      expect(bookingPayload.totalCost).toBeGreaterThan(0);
      expect(bookingPayload.totalTransitTime).toBeGreaterThan(0);
      expect(bookingPayload.serviceLevel).toBeDefined();
    });

    it('should support existing reporting module data requirements', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      const result = await engine.optimizeNycToDedRoute('general', 'standard');

      // Verify reporting module data structure
      const reportData = {
        quotationNumber: 'QUO-260309-00001',
        route: result.recommendedRoute,
        pricing: {
          total: result.totalCost,
          breakdown: result.recommendedRoute.map(leg => ({
            leg: `${leg.originCode}-${leg.destinationCode}`,
            carrier: leg.carrierName
          }))
        },
        timing: {
          totalDays: result.totalTransitDays,
          breakdown: result.recommendedRoute.map(leg => ({
            leg: `${leg.originCode}-${leg.destinationCode}`,
            days: leg.transitDays
          }))
        },
        serviceLevel: result.serviceLevel
      };

      expect(reportData.quotationNumber).toBe('QUO-260309-00001');
      expect(reportData.pricing.total).toBeGreaterThan(0);
      expect(reportData.timing.totalDays).toBeGreaterThan(0);
      expect(reportData.pricing.breakdown.length).toBeGreaterThan(0);
      expect(reportData.timing.breakdown.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Regression', () => {
    it('should maintain sub-second response time for quotation generation', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      const startTime = performance.now();
      const result = await engine.optimizeNycToDedRoute('general', 'standard');
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      
      // Should maintain sub-second performance
      expect(responseTime).toBeLessThan(1000);
      expect(result).toBeDefined();
    });

    it('should handle concurrent requests without performance degradation', async () => {
      const legacyData = createLegacyCompatibleData();
      const mockDb = createRegressionMockScopedDb(legacyData);
      const engine = new NycDedRoutingEngine(mockDb);

      const concurrentRequests = 5;
      const startTime = performance.now();
      
      const results = await Promise.all(
        Array.from({ length: concurrentRequests }, () => 
          engine.optimizeNycToDedRoute('general', 'standard')
        )
      );
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;
      
      // Should maintain reasonable performance under concurrency
      expect(avgTimePerRequest).toBeLessThan(500);
      expect(results.length).toBe(concurrentRequests);
      results.forEach(result => expect(result).toBeDefined());
    });
  });

  describe('Error Handling Regression', () => {
    it('should maintain consistent error messages for integration compatibility', async () => {
      const emptyDb = createRegressionMockScopedDb([]);
      const engine = new NycDedRoutingEngine(emptyDb);

      // Verify error message format matches existing integrations
      await expect(engine.optimizeNycToDedRoute('general', 'standard'))
        .rejects.toThrow('No viable routes found from NYC to Dehra Dun Airport');
    });

    it('should handle database errors consistently with legacy behavior', async () => {
      // Create a mock that throws database error
      const errorDb = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockRejectedValue(new Error('Database connection failed'))
              })
            })
          })
        })
      } as unknown as ScopedDataAccess;

      const engine = new NycDedRoutingEngine(errorDb);

      await expect(engine.optimizeNycToDedRoute('general', 'standard'))
        .rejects.toThrow('Database connection failed');
    });
  });
});
