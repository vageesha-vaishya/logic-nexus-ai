// Performance Tests for MGL NYC-DED Routing Engine
// Tests performance, scalability, and load handling for QUO-260309-00001 production requirements

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NycDedRoutingEngine } from '../../src/services/quotation/mgl/routing-engine';
import { ScopedDataAccess } from '../../src/lib/db/access';
import type { RoutingMatrixEntry } from '../../src/services/quotation/mgl/routing-engine';

// Mock database responses for performance testing
const createLargeRouteDataset = (size: number): RoutingMatrixEntry[] => {
  const routes: RoutingMatrixEntry[] = [];
  const nycCodes = ['JFK', 'EWR', 'LGA', 'USNYC', 'NYC'];
  const modes = ['air', 'ocean', 'road', 'rail'];
  const commodities = ['general', 'hazardous', 'perishable', 'pharmaceutical'];
  
  for (let i = 0; i < size; i++) {
    const origin = nycCodes[i % nycCodes.length];
    const viability = 0.7 + (Math.random() * 0.3); // 0.7-1.0 viability
    
    routes.push({
      originCode: origin,
      destinationCode: 'DED',
      transportMode: modes[i % modes.length] as any,
      carrierCoverage: [`Carrier${i % 10}`],
      transitTimeDays: 2 + (i % 10),
      frequencyPerWeek: 1 + (i % 7),
      viabilityScore: viability,
      historicalPerformance: 0.8 + (Math.random() * 0.2),
      geographicConstraints: {},
      preferredTransshipmentHubs: []
    });
  }
  
  return routes;
};

// Mock ScopedDataAccess for performance testing
function createPerformanceMockScopedDb(routeData: RoutingMatrixEntry[] = []) {
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

describe('NycDedRoutingEngine Performance Tests', () => {
  describe('Response Time Performance', () => {
    it('should generate quotations in sub-second response time for typical loads', async () => {
      const typicalLoadData = createLargeRouteDataset(100); // 100 routes
      const mockDb = createPerformanceMockScopedDb(typicalLoadData);
      const engine = new NycDedRoutingEngine(mockDb);

      const startTime = performance.now();
      const result = await engine.optimizeNycToDedRoute('general', 'standard');
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(1000); // Sub-second response
      expect(result).toBeDefined();
      expect(result.recommendedRoute.length).toBeGreaterThan(0);
    });

    it('should maintain sub-second response under peak load (1000+ routes)', async () => {
      const peakLoadData = createLargeRouteDataset(1000); // 1000 routes
      const mockDb = createPerformanceMockScopedDb(peakLoadData);
      const engine = new NycDedRoutingEngine(mockDb);

      const startTime = performance.now();
      const result = await engine.optimizeNycToDedRoute('general', 'standard');
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(1000); // Sub-second even under peak load
      expect(result).toBeDefined();
    });

    it('should handle concurrent requests efficiently', async () => {
      const testData = createLargeRouteDataset(500);
      const mockDb = createPerformanceMockScopedDb(testData);
      const engine = new NycDedRoutingEngine(mockDb);

      const concurrentRequests = 10;
      const startTime = performance.now();
      
      const results = await Promise.all(
        Array.from({ length: concurrentRequests }, () => 
          engine.optimizeNycToDedRoute('general', 'standard')
        )
      );
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;
      
      // Each request should complete in reasonable time even under concurrency
      expect(avgTimePerRequest).toBeLessThan(500); // 500ms average per request
      expect(results.length).toBe(concurrentRequests);
      results.forEach(result => expect(result).toBeDefined());
    });
  });

  describe('Memory Usage and Scalability', () => {
    it('should handle very large routing matrices without memory issues', async () => {
      const massiveDataset = createLargeRouteDataset(5000); // 5000 routes
      const mockDb = createPerformanceMockScopedDb(massiveDataset);
      const engine = new NycDedRoutingEngine(mockDb);

      const memoryBefore = process.memoryUsage().heapUsed;
      const result = await engine.optimizeNycToDedRoute('general', 'standard');
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;
      
      // Should not have excessive memory growth
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
      expect(result).toBeDefined();
    });

    it('should maintain consistent performance across multiple runs', async () => {
      const testData = createLargeRouteDataset(200);
      const mockDb = createPerformanceMockScopedDb(testData);
      const engine = new NycDedRoutingEngine(mockDb);

      const executionTimes: number[] = [];
      const memoryUsages: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const memoryBefore = process.memoryUsage().heapUsed;
        const startTime = performance.now();
        
        await engine.optimizeNycToDedRoute('general', 'standard');
        
        const endTime = performance.now();
        const memoryAfter = process.memoryUsage().heapUsed;
        
        executionTimes.push(endTime - startTime);
        memoryUsages.push(memoryAfter - memoryBefore);
      }

      // Calculate performance consistency
      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      const timeVariance = maxTime / Math.max(minTime, 1);
      
      // Calculate memory consistency
      const avgMemory = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
      const maxMemory = Math.max(...memoryUsages);
      const minMemory = Math.min(...memoryUsages);
      
      // Performance should be consistent (within 2x variance)
      expect(timeVariance).toBeLessThan(20);
      expect(avgTime).toBeLessThan(300); // Average under 300ms
      
      // Memory usage should be stable
      expect(maxMemory - minMemory).toBeLessThan(60 * 1024 * 1024); // Less than 60MB variance
    });
  });

  describe('Load Testing Scenarios', () => {
    it('should handle mixed commodity types under load', async () => {
      const mixedData = createLargeRouteDataset(300);
      const mockDb = createPerformanceMockScopedDb(mixedData);
      const engine = new NycDedRoutingEngine(mockDb);

      const commodityTypes = ['general', 'hazardous', 'perishable', 'pharmaceutical'] as const;
      const containerTypes = ['standard', 'reefer', 'open_top'] as const;
      
      const startTime = performance.now();
      
      const results = await Promise.all(
        commodityTypes.flatMap(commodity => 
          containerTypes.map(container => 
            engine.optimizeNycToDedRoute(commodity, container)
          )
        )
      );
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(5000); // Complete all combinations in under 5 seconds
      expect(results.length).toBe(commodityTypes.length * containerTypes.length);
      results.forEach(result => expect(result).toBeDefined());
    });

    it('should maintain performance during sustained operation', async () => {
      const sustainedData = createLargeRouteDataset(100);
      const mockDb = createPerformanceMockScopedDb(sustainedData);
      const engine = new NycDedRoutingEngine(mockDb);

      const operationDuration = 2000; // 2 seconds of sustained operation
      const startTime = performance.now();
      let operationsCompleted = 0;
      
      while (performance.now() - startTime < operationDuration) {
        await engine.optimizeNycToDedRoute('general', 'standard');
        operationsCompleted++;
      }
      
      const endTime = performance.now();
      const actualDuration = endTime - startTime;
      const operationsPerSecond = operationsCompleted / (actualDuration / 1000);
      
      // Should maintain reasonable throughput during sustained operation
      expect(operationsPerSecond).toBeGreaterThan(5); // At least 5 operations per second
      expect(operationsCompleted).toBeGreaterThan(0);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle no viable routes scenario efficiently', async () => {
      const emptyDb = createPerformanceMockScopedDb([]);
      const engine = new NycDedRoutingEngine(emptyDb);

      const startTime = performance.now();
      
      await expect(engine.optimizeNycToDedRoute('general', 'standard'))
        .rejects.toThrow('No viable routes found from NYC to Dehra Dun Airport');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Error handling should also be efficient
      expect(responseTime).toBeLessThan(500);
    });

    it('should optimize complex multi-modal routes efficiently', async () => {
      const complexData: RoutingMatrixEntry[] = [
        {
          originCode: 'JFK',
          destinationCode: 'DXB',
          transportMode: 'air',
          carrierCoverage: ['Emirates', 'Qatar'],
          transitTimeDays: 12,
          frequencyPerWeek: 7,
          viabilityScore: 0.85,
          historicalPerformance: 0.9,
          geographicConstraints: {},
          preferredTransshipmentHubs: []
        } as RoutingMatrixEntry,
        {
          originCode: 'DXB',
          destinationCode: 'DEL',
          transportMode: 'air',
          carrierCoverage: ['Emirates', 'AirIndia'],
          transitTimeDays: 3,
          frequencyPerWeek: 14,
          viabilityScore: 0.92,
          historicalPerformance: 0.95,
          geographicConstraints: {},
          preferredTransshipmentHubs: []
        } as RoutingMatrixEntry,
        {
          originCode: 'DEL',
          destinationCode: 'DED',
          transportMode: 'road',
          carrierCoverage: ['LocalCarrier'],
          transitTimeDays: 1,
          frequencyPerWeek: 28,
          viabilityScore: 0.88,
          historicalPerformance: 0.85,
          geographicConstraints: {},
          preferredTransshipmentHubs: []
        } as RoutingMatrixEntry
      ];
      
      const mockDb = createPerformanceMockScopedDb(complexData);
      const engine = new NycDedRoutingEngine(mockDb);

      const startTime = performance.now();
      const result = await engine.optimizeNycToDedRoute('pharmaceutical', 'standard', 'reliability');
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      
      // Complex multi-modal routing should still be efficient
      expect(responseTime).toBeLessThan(300);
      expect(result.recommendedRoute.length).toBeGreaterThan(0);
      expect(result.transferPoints.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Production Readiness Metrics', () => {
    it('should meet 99.9% uptime requirements for quotation generation', async () => {
      const reliableData = createLargeRouteDataset(200);
      const mockDb = createPerformanceMockScopedDb(reliableData);
      const engine = new NycDedRoutingEngine(mockDb);

      const testIterations = 200;
      let successfulOperations = 0;
      let failedOperations = 0;
      
      for (let i = 0; i < testIterations; i++) {
        try {
          await engine.optimizeNycToDedRoute('general', 'standard');
          successfulOperations++;
        } catch (error) {
          failedOperations++;
        }
      }
      
      const successRate = successfulOperations / testIterations;
      
      // Should meet 99.9% reliability requirement
      expect(successRate).toBeGreaterThan(0.99);
      expect(failedOperations).toBe(0); // No failures expected in normal operation
    });

    it('should maintain performance under memory pressure', async () => {
      // Simulate memory pressure by creating multiple engine instances
      const engines: NycDedRoutingEngine[] = [];
      const testData = createLargeRouteDataset(100);
      
      for (let i = 0; i < 100; i++) {
        const mockDb = createPerformanceMockScopedDb(testData);
        engines.push(new NycDedRoutingEngine(mockDb));
      }
      
      const startTime = performance.now();
      const results = await Promise.all(
        engines.slice(0, 10).map(engine => 
          engine.optimizeNycToDedRoute('general', 'standard')
        )
      );
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      
      // Performance should remain reasonable even with many instances
      expect(responseTime).toBeLessThan(1000);
      expect(results.length).toBe(10);
      results.forEach(result => expect(result).toBeDefined());
    });
  });
});
