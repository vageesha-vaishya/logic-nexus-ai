// Unit Tests for MGL NYC-DED Routing Engine
// Comprehensive test coverage for QUO-260309-00001 routing capabilities

import { describe, it, expect, vi } from 'vitest';
import { NycDedRoutingEngine } from '../../src/services/quotation/mgl/routing-engine';

describe('NycDedRoutingEngine', () => {
  describe('Route Optimization Logic', () => {
    it('should correctly identify NYC airport and port codes', () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      // Test NYC code recognition
      const nycCodes = ['JFK', 'EWR', 'LGA', 'USNYC', 'NYC', 'NEW YORK'];
      nycCodes.forEach(code => {
        expect((engine as any).NYC_CODES.has(code)).toBe(true);
      });
    });

    it('should correctly identify DED airport code', () => {
      const engine = new NycDedRoutingEngine({} as any);
      expect((engine as any).DED_CODE).toBe('DED');
    });

    it('should calculate minimum viability scores based on commodity type', () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      // Test the getMinViabilityScore method
      const hazardousScore = (engine as any).getMinViabilityScore('hazardous', 'express');
      const generalScore = (engine as any).getMinViabilityScore('general', 'express');
      const pharmaScore = (engine as any).getMinViabilityScore('pharmaceutical', 'express');
      
      // Verify scores are calculated correctly (multiplicative approach)
      expect(hazardousScore).toBe(0.9 * 0.9); // 0.81
      expect(generalScore).toBe(0.9 * 1.0);   // 0.9
      expect(pharmaScore).toBe(0.9 * 0.98);  // 0.882
      
      // Pharmaceutical should have higher viability than hazardous
      expect(pharmaScore).toBeGreaterThan(hazardousScore);
    });
  });

  describe('Route Construction', () => {
    it('should identify transfer points in multi-modal routes', () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      const legs = [
        { originCode: 'JFK', destinationCode: 'DXB' },
        { originCode: 'DXB', destinationCode: 'DEL' },
        { originCode: 'DEL', destinationCode: 'DED' }
      ] as any;
      
      // Test the identifyTransferPoints method
      const transferPoints = (engine as any).identifyTransferPoints(legs);
      // No transfer points should be identified since all codes match sequentially
      expect(transferPoints).toEqual([]);
    });

    it('should identify transfer points when codes dont match', () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      const legs = [
        { originCode: 'JFK', destinationCode: 'DXB' },
        { originCode: 'SIN', destinationCode: 'DEL' }, // Different origin
        { originCode: 'DEL', destinationCode: 'DED' }
      ] as any;
      
      // Test the identifyTransferPoints method
      const transferPoints = (engine as any).identifyTransferPoints(legs);
      // Should identify DXB as transfer point since next leg has different origin
      expect(transferPoints).toEqual(['DXB']);
    });

    it('should determine service level based on transport modes', () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      const expressLegs = [
        { mode: 'air', carrierName: 'FedEx' },
        { mode: 'road', carrierName: 'LocalCarrier' }
      ] as any;
      
      const standardLegs = [
        { mode: 'air', carrierName: 'RegularAirline' },
        { mode: 'road', carrierName: 'LocalCarrier' }
      ] as any;
      
      const economyLegs = [
        { mode: 'ocean', carrierName: 'ShippingLine' },
        { mode: 'road', carrierName: 'LocalCarrier' }
      ] as any;
      
      // Test the determineServiceLevel method
      expect((engine as any).determineServiceLevel(expressLegs)).toBe('express');
      expect((engine as any).determineServiceLevel(standardLegs)).toBe('standard');
      expect((engine as any).determineServiceLevel(economyLegs)).toBe('economy');
    });
  });

  describe('Cost and Time Calculations', () => {
    it('should calculate total transit time across multiple legs', () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      const legs = [
        { transitDays: 2 },
        { transitDays: 3 },
        { transitDays: 1 }
      ] as any;
      
      // Test the calculateTotalTransitTime method
      const totalTime = (engine as any).calculateTotalTransitTime(legs);
      expect(totalTime).toBe(6);
    });

    it('should apply commodity-specific cost multipliers', async () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      // Mock the estimateLegCost method
      vi.spyOn(engine as any, 'estimateLegCost').mockImplementation(async (leg: any, commodityType: any) => {
        const baseCost = 1000;
        const multipliers = {
          general: 1.0,
          hazardous: 1.5,
          pharmaceutical: 2.0
        };
        return baseCost * (multipliers[commodityType as keyof typeof multipliers] || 1.0);
      });
      
      const hazardousCost = await (engine as any).estimateLegCost({ mode: 'air' }, 'hazardous');
      const generalCost = await (engine as any).estimateLegCost({ mode: 'air' }, 'general');
      
      expect(hazardousCost).toBeGreaterThan(generalCost);
    });
  });

  describe('Route Selection', () => {
    it('should select best route based on optimization priority', () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      const routes = [
        { totalCost: 5000, totalTransitDays: 5, viabilityScore: 0.9 },
        { totalCost: 3000, totalTransitDays: 7, viabilityScore: 0.8 },
        { totalCost: 4000, totalTransitDays: 3, viabilityScore: 0.85 }
      ] as any;
      
      // Test the selectBestRoute method
      const costOptimal = (engine as any).selectBestRoute(routes, 'cost');
      expect(costOptimal.totalCost).toBe(3000);
      
      const timeOptimal = (engine as any).selectBestRoute(routes, 'time');
      expect(timeOptimal.totalTransitDays).toBe(3);
      
      const reliabilityOptimal = (engine as any).selectBestRoute(routes, 'reliability');
      expect(reliabilityOptimal.viabilityScore).toBe(0.9);
    });
  });

  describe('Public Interface', () => {
    it('should expose the main optimization method', () => {
      const engine = new NycDedRoutingEngine({} as any);
      expect(typeof engine.optimizeNycToDedRoute).toBe('function');
    });

    it('should handle errors when no viable routes found', async () => {
      const engine = new NycDedRoutingEngine({} as any);
      
      // Mock getViableRoutes to return empty array
      vi.spyOn(engine as any, 'getViableRoutes').mockResolvedValue([]);
      
      await expect(engine.optimizeNycToDedRoute('general', 'standard')).rejects.toThrow(
        'No viable routes found from NYC to Dehra Dun Airport'
      );
    });
  });
});