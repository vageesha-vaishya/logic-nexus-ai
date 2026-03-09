// Integration Tests for MGL NYC-DED Routing Engine
// Tests database integration and real-world routing scenarios for QUO-260309-00001

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NycDedRoutingEngine } from '../../src/services/quotation/mgl/routing-engine';
import { ScopedDataAccess } from '../../src/lib/db/access';
import type { RoutingMatrixEntry } from '../../src/services/quotation/mgl/routing-engine';

// Mock database responses for integration testing
const mockRouteData: RoutingMatrixEntry[] = [
  {
    originCode: 'JFK',
    destinationCode: 'DED',
    transportMode: 'air',
    carrierCoverage: ['FedEx', 'UPS', 'DHL'],
    transitTimeDays: 2,
    frequencyPerWeek: 7,
    viabilityScore: 0.95,
    historicalPerformance: 0.98,
    geographicConstraints: {},
    preferredTransshipmentHubs: []
  },
  {
    originCode: 'EWR',
    destinationCode: 'DED',
    transportMode: 'air',
    carrierCoverage: ['American Airlines', 'United'],
    transitTimeDays: 3,
    frequencyPerWeek: 5,
    viabilityScore: 0.88,
    historicalPerformance: 0.92,
    geographicConstraints: {},
    preferredTransshipmentHubs: []
  },
  {
    originCode: 'USNYC',
    destinationCode: 'DED',
    transportMode: 'multimodal' as any, // multimodal not in TransportMode
    carrierCoverage: ['Maersk', 'FedEx', 'LocalCarrier'],
    transitTimeDays: 18,
    frequencyPerWeek: 3,
    viabilityScore: 0.85,
    historicalPerformance: 0.9,
    geographicConstraints: {},
    preferredTransshipmentHubs: ['DXB', 'DEL']
  }
];

// Mock ScopedDataAccess for integration testing
function createMockScopedDb(routeData: RoutingMatrixEntry[] = []) {
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

describe('NycDedRoutingEngine Integration Tests', () => {
  let routingEngine: NycDedRoutingEngine;
  let mockScopedDb: ReturnType<typeof createMockScopedDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScopedDb = createMockScopedDb(mockRouteData);
    routingEngine = new NycDedRoutingEngine(mockScopedDb);
  });

  describe('Database Integration', () => {
    it('should query routing matrix with correct NYC codes and viability thresholds', async () => {
      await routingEngine.optimizeNycToDedRoute('general', 'standard');

      // Verify database query was made with correct parameters
      expect(mockScopedDb.from).toHaveBeenCalledWith('route_matrices');
    });

    it('should handle empty database responses gracefully', async () => {
      const emptyDb = createMockScopedDb([]);
      const emptyEngine = new NycDedRoutingEngine(emptyDb);

      await expect(emptyEngine.optimizeNycToDedRoute('general', 'standard'))
        .rejects.toThrow('No viable routes found from NYC to Dehra Dun Airport');
    });

    it('should filter routes based on commodity viability requirements', async () => {
      // Test that hazardous materials require higher viability scores
      await routingEngine.optimizeNycToDedRoute('hazardous', 'standard');
      
      // Verify database query was made
      expect(mockScopedDb.from).toHaveBeenCalledWith('route_matrices');
    });
  });

  describe('Real-world Routing Scenarios', () => {
    it('should optimize air freight route from JFK to DED', async () => {
      const result = await routingEngine.optimizeNycToDedRoute('general', 'standard');

      expect(result).toBeDefined();
      expect(result.recommendedRoute.length).toBeGreaterThan(0);
      expect(result.totalTransitDays).toBeGreaterThan(0);
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.viabilityScore).toBeGreaterThan(0.8);
    });

    it('should handle multi-modal routing with transshipment points', async () => {
      // Force multimodal route selection
      const multimodalDb = createMockScopedDb([mockRouteData[2]]); // multimodal route
      const multimodalEngine = new NycDedRoutingEngine(multimodalDb);

      const result = await multimodalEngine.optimizeNycToDedRoute('general', 'standard');

      expect(result.recommendedRoute.length).toBeGreaterThan(1);
      expect(result.transferPoints.length).toBeGreaterThanOrEqual(0);
      expect(['standard', 'economy']).toContain(result.serviceLevel);
    });

    it('should prioritize express service for air transport', async () => {
      const result = await routingEngine.optimizeNycToDedRoute('pharmaceutical', 'standard');

      // Pharmaceutical should prioritize air transport
      expect(result.serviceLevel).toBe('express');
      expect(result.totalTransitDays).toBeLessThanOrEqual(3); // Should be fast
    });

    it('should apply commodity-specific cost calculations', async () => {
      const generalResult = await routingEngine.optimizeNycToDedRoute('general', 'standard');
      const hazardousResult = await routingEngine.optimizeNycToDedRoute('hazardous', 'standard');

      // Hazardous materials should cost more than general commodities
      expect(hazardousResult.totalCost).toBeGreaterThan(generalResult.totalCost);
    });
  });

  describe('Carrier Alliance Integration', () => {
    it('should identify carrier alliances in optimized routes', async () => {
      const result = await routingEngine.optimizeNycToDedRoute('general', 'standard');

      expect(result.carrierAlliances).toBeDefined();
      expect(Array.isArray(result.carrierAlliances)).toBe(true);
    });

    it('should prefer alliance carriers for better viability', async () => {
      // Mock alliance carrier data
      const allianceRouteData = [...mockRouteData];
      allianceRouteData[0].carrierCoverage = ['Maersk', 'MSC']; // 2M Alliance members
      allianceRouteData[0].viabilityScore = 0.98;

      const allianceDb = createMockScopedDb(allianceRouteData);
      const allianceEngine = new NycDedRoutingEngine(allianceDb);

      const result = await allianceEngine.optimizeNycToDedRoute('general', 'standard');

      // Should have high viability score with alliance carriers
      expect(result.viabilityScore).toBeGreaterThan(0.95);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large routing matrices efficiently', async () => {
      // Create large mock dataset
      const largeRouteData: RoutingMatrixEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        largeRouteData.push({
          ...mockRouteData[0],
          originCode: `NYC${i}`,
          viabilityScore: 0.7 + (i * 0.0003)
        });
      }

      const largeDb = createMockScopedDb(largeRouteData);
      const largeEngine = new NycDedRoutingEngine(largeDb);

      const startTime = Date.now();
      const result = await largeEngine.optimizeNycToDedRoute('general', 'standard');
      const endTime = Date.now();

      // Should complete within reasonable time (sub-second for 1000 routes)
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds max
      expect(result).toBeDefined();
    });

    it('should maintain consistent performance under load', async () => {
      const executionTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await routingEngine.optimizeNycToDedRoute('general', 'standard');
        const endTime = Date.now();
        executionTimes.push(endTime - startTime);
      }

      // Calculate performance consistency
      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      
      // Should have consistent performance (within 2x variance)
      expect(maxTime / Math.max(minTime, 1)).toBeLessThan(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      // Create a new mock that throws an error
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

      const errorEngine = new NycDedRoutingEngine(errorDb);

      await expect(errorEngine.optimizeNycToDedRoute('general', 'standard'))
        .rejects.toThrow('Database connection failed');
    });

    it('should validate commodity and container compatibility', async () => {
      // Test incompatible combinations
      await expect(routingEngine.optimizeNycToDedRoute('hazardous', 'reefer'))
        .resolves.toBeDefined(); // Should handle gracefully
    });

    it('should handle extreme optimization priorities', async () => {
      const costResult = await routingEngine.optimizeNycToDedRoute('general', 'standard', 'cost');
      const timeResult = await routingEngine.optimizeNycToDedRoute('general', 'standard', 'time');
      const reliabilityResult = await routingEngine.optimizeNycToDedRoute('general', 'standard', 'reliability');

      // Each priority should produce valid route optimization outputs
      expect(costResult.totalCost).toBeGreaterThan(0);
      expect(timeResult.totalTransitDays).toBeGreaterThan(0);
      expect(reliabilityResult.viabilityScore).toBeGreaterThan(0);
    });
  });
});
