// Enhanced NYC→DED Routing Engine with Dynamic Rate Calculation
import { ScopedDataAccess } from '@/lib/scoped-data-access';
import type {
  MglRateOption,
  MglRateType,
  TransportMode,
  ContainerType,
  CommodityType,
  RouteOptimizationResult,
  MglTransportLeg
} from './types';

interface DynamicRateCalculationInput {
  tenantId: string;
  originCode: string;
  destinationCode: string;
  commodityType: CommodityType;
  containerType: ContainerType;
  containerSize: string;
  rateType: MglRateType;
  priority: 'cost' | 'time' | 'reliability';
  serviceLevel: 'express' | 'standard' | 'economy';
  hsCode?: string;
  weightKg?: number;
  volumeCbm?: number;
}

interface RateCalculationResult {
  baseRate: number;
  fuelSurcharge: number;
  securitySurcharge: number;
  peakSeasonSurcharge: number;
  commoditySurcharge: number;
  equipmentSurcharge: number;
  totalRate: number;
  currency: string;
  validityPeriod: { from: Date; to: Date };
  rateBreakdown: Record<string, number>;
}

export class EnhancedNycDedRoutingEngine {
  private scopedDb: ScopedDataAccess;
  
  constructor(scopedDb: ScopedDataAccess) {
    this.scopedDb = scopedDb;
  }

  // Dynamic Rate Calculation Engine supporting 4 rate types
  async calculateDynamicRate(input: DynamicRateCalculationInput): Promise<RateCalculationResult> {
    const {
      tenantId,
      originCode,
      destinationCode,
      commodityType,
      containerType,
      containerSize,
      rateType,
      priority,
      serviceLevel,
      hsCode,
      weightKg = 10000, // Default 10 tons
      volumeCbm = 30    // Default 30 CBM
    } = input;

    // Get base rates from routing matrix
    const baseRate = await this.getBaseRate(tenantId, originCode, destinationCode, containerType, containerSize);
    
    // Apply rate type specific multipliers
    const rateTypeMultiplier = this.getRateTypeMultiplier(rateType);
    
    // Calculate dynamic surcharges
    const fuelSurcharge = await this.calculateFuelSurcharge(tenantId, commodityType, containerType);
    const securitySurcharge = await this.calculateSecuritySurcharge(tenantId, originCode, destinationCode);
    const peakSeasonSurcharge = await this.calculatePeakSeasonSurcharge(tenantId);
    
    // Apply commodity and equipment specific factors
    const commodityMultiplier = this.getCommodityMultiplier(commodityType);
    const equipmentMultiplier = this.getEquipmentMultiplier(containerType, containerSize);
    
    // Service level adjustment
    const serviceLevelMultiplier = this.getServiceLevelMultiplier(serviceLevel);
    
    // Calculate total rate
    const totalRate = this.calculateTotalRate(
      baseRate,
      rateTypeMultiplier,
      fuelSurcharge,
      securitySurcharge,
      peakSeasonSurcharge,
      commodityMultiplier,
      equipmentMultiplier,
      serviceLevelMultiplier,
      weightKg,
      volumeCbm
    );

    return {
      baseRate,
      fuelSurcharge,
      securitySurcharge,
      peakSeasonSurcharge,
      commoditySurcharge: baseRate * (commodityMultiplier - 1),
      equipmentSurcharge: baseRate * (equipmentMultiplier - 1),
      totalRate,
      currency: 'USD',
      validityPeriod: this.getValidityPeriod(rateType),
      rateBreakdown: this.generateRateBreakdown(baseRate, totalRate)
    };
  }

  // NYC→DED Route Optimization with Multi-Leg Routing
  async optimizeNycToDedRoute(
    commodityType: CommodityType,
    containerType: ContainerType,
    priority: 'cost' | 'time' | 'reliability' = 'cost',
    serviceLevel: 'express' | 'standard' | 'economy' = 'standard'
  ): Promise<RouteOptimizationResult> {
    
    // Get pre-calculated routing options from matrix
    const viableRoutes = await this.getViableRoutes(commodityType, containerType);
    
    // Apply optimization criteria
    const optimizedRoutes = viableRoutes
      .filter(route => this.validateRouteCompatibility(route, commodityType, containerType))
      .map(route => this.calculateRouteMetrics(route, priority, serviceLevel))
      .sort((a, b) => {
        switch (priority) {
          case 'cost': return a.totalCost - b.totalCost;
          case 'time': return a.totalTransitDays - b.totalTransitDays;
          case 'reliability': return b.reliabilityScore - a.reliabilityScore;
          default: return a.totalCost - b.totalCost;
        }
      });

    const recommendedRoute = optimizedRoutes[0];
    
    return {
      recommendedRoute: recommendedRoute.legs,
      totalTransitDays: recommendedRoute.totalTransitDays,
      totalCost: recommendedRoute.totalCost,
      viabilityScore: recommendedRoute.viabilityScore,
      carrierAlliances: recommendedRoute.carrierAlliances,
      transferPoints: recommendedRoute.transferPoints,
      serviceLevel,
      capacityAvailable: await this.checkCapacityAvailability(recommendedRoute.legs),
      realTimePricing: true
    };
  }

  // Enhanced Validation Services
  async validateContainerCommodityCompatibility(
    containerType: ContainerType,
    containerSize: string,
    commodityType: CommodityType,
    hsCode?: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Container-commodity compatibility matrix
    const compatibilityMatrix: Record<ContainerType, CommodityType[]> = {
      standard: ['general', 'fragile', 'hazardous'],
      open_top: ['general', 'oversized', 'hazardous'],
      flat_rack: ['oversized', 'general'],
      reefer: ['perishable', 'pharmaceutical', 'hazardous'],
      platform: ['oversized']
    };

    if (!compatibilityMatrix[containerType]?.includes(commodityType)) {
      errors.push(`${commodityType} commodity is not compatible with ${containerType} container`);
    }

    // Size-specific validation
    if (containerSize === "20'" && containerType === 'reefer' && commodityType === 'oversized') {
      errors.push('Oversized cargo not suitable for 20\' reefer containers');
    }

    // HS code specific validation
    if (hsCode) {
      const hsSpecificRestrictions = await this.getHsCodeRestrictions(hsCode);
      if (hsSpecificRestrictions && !hsSpecificRestrictions.allowedContainers.includes(containerType)) {
        errors.push(`HS code ${hsCode} requires specific container types`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Private helper methods
  private async getBaseRate(
    tenantId: string,
    originCode: string,
    destinationCode: string,
    containerType: ContainerType,
    containerSize: string
  ): Promise<number> {
    // Implementation would query routing matrix and current market rates
    const baseRates: Record<string, number> = {
      'JFK-DED-air': 7500,
      'EWR-DED-air': 7200,
      'PANYNJ-DED-ocean-road': 3500,
      'PANYNJ-DED-ocean-rail-road': 3800
    };
    
    return baseRates[`${originCode}-DED-${containerType}`] || 5000;
  }

  private getRateTypeMultiplier(rateType: MglRateType): number {
    const multipliers: Record<MglRateType, number> = {
      spot: 1.04,
      contract: 0.95,
      market: 1.02,
      negotiated: 0.92
    };
    return multipliers[rateType] || 1.0;
  }

  private async calculateFuelSurcharge(tenantId: string, commodityType: CommodityType, containerType: ContainerType): Promise<number> {
    // Would query real-time fuel indices and apply commodity/container factors
    const baseFuelSurcharge = 450;
    const commodityFactors: Record<CommodityType, number> = {
      general: 1.0,
      hazardous: 1.15,
      perishable: 1.08,
      pharmaceutical: 1.12,
      fragile: 1.05,
      oversized: 1.10
    };
    
    return baseFuelSurcharge * commodityFactors[commodityType];
  }

  private async calculateSecuritySurcharge(tenantId: string, originCode: string, destinationCode: string): Promise<number> {
    // Would calculate based on route security requirements
    const baseSecurityFee = 125;
    const routeMultipliers: Record<string, number> = {
      'JFK-DED': 1.2,
      'EWR-DED': 1.1,
      'PANYNJ-DED': 1.3
    };
    
    return baseSecurityFee * (routeMultipliers[`${originCode}-DED`] || 1.0);
  }

  private async calculatePeakSeasonSurcharge(tenantId: string): Promise<number> {
    // Would check current date against peak season calendar
    const currentMonth = new Date().getMonth() + 1;
    const peakSeasonMonths = [7, 8, 9, 12]; // July, August, September, December
    
    return peakSeasonMonths.includes(currentMonth) ? 300 : 0;
  }

  private getCommodityMultiplier(commodityType: CommodityType): number {
    const multipliers: Record<CommodityType, number> = {
      general: 1.0,
      hazardous: 1.18,
      perishable: 1.12,
      pharmaceutical: 1.20,
      fragile: 1.08,
      oversized: 1.16
    };
    return multipliers[commodityType];
  }

  private getEquipmentMultiplier(containerType: ContainerType, containerSize: string): number {
    const multipliers: Record<string, number> = {
      'standard:20\'': 1.0,
      'standard:40\'': 1.25,
      'standard:40\'HC': 1.33,
      'standard:45\'': 1.42,
      'open_top:20\'': 1.1,
      'open_top:40\'': 1.36,
      'open_top:40\'HC': 1.44,
      'open_top:45\'': 1.54,
      'flat_rack:20\'': 1.2,
      'flat_rack:40\'': 1.48,
      'flat_rack:40\'HC': 1.56,
      'flat_rack:45\'': 1.65,
      'reefer:20\'': 1.22,
      'reefer:40\'': 1.56,
      'reefer:40\'HC': 1.64,
      'reefer:45\'': 1.74,
      'platform:20\'': 1.18,
      'platform:40\'': 1.42,
      'platform:40\'HC': 1.5,
      'platform:45\'': 1.58
    };
    
    return multipliers[`${containerType}:${containerSize}`] || 1.0;
  }

  private getServiceLevelMultiplier(serviceLevel: string): number {
    const multipliers = {
      express: 1.25,
      standard: 1.0,
      economy: 0.85
    };
    return multipliers[serviceLevel] || 1.0;
  }

  private calculateTotalRate(
    baseRate: number,
    rateTypeMultiplier: number,
    fuelSurcharge: number,
    securitySurcharge: number,
    peakSeasonSurcharge: number,
    commodityMultiplier: number,
    equipmentMultiplier: number,
    serviceLevelMultiplier: number,
    weightKg: number,
    volumeCbm: number
  ): number {
    const adjustedBase = baseRate * rateTypeMultiplier * commodityMultiplier * equipmentMultiplier * serviceLevelMultiplier;
    const totalSurcharges = fuelSurcharge + securitySurcharge + peakSeasonSurcharge;
    
    // Apply weight/volume based adjustments
    const weightFactor = Math.max(1, weightKg / 10000); // Normalize to 10 tons
    const volumeFactor = Math.max(1, volumeCbm / 30);   // Normalize to 30 CBM
    
    return (adjustedBase + totalSurcharges) * Math.max(weightFactor, volumeFactor);
  }

  private getValidityPeriod(rateType: MglRateType): { from: Date; to: Date } {
    const now = new Date();
    const validityDays: Record<MglRateType, number> = {
      spot: 7,
      contract: 30,
      market: 3,
      negotiated: 14
    };
    
    const toDate = new Date(now);
    toDate.setDate(now.getDate() + (validityDays[rateType] || 7));
    
    return { from: now, to: toDate };
  }

  private generateRateBreakdown(baseRate: number, totalRate: number): Record<string, number> {
    return {
      baseFreight: baseRate,
      fuelSurcharge: totalRate - baseRate * 0.15,
      securityFee: totalRate * 0.03,
      handlingCharges: totalRate * 0.07,
      documentationFee: totalRate * 0.02,
      total: totalRate
    };
  }

  private async getViableRoutes(commodityType: CommodityType, containerType: ContainerType): Promise<any[]> {
    // Would query routing matrix with commodity and container filters
    return [];
  }

  private validateRouteCompatibility(route: any, commodityType: CommodityType, containerType: ContainerType): boolean {
    // Implementation would validate route against commodity restrictions and equipment compatibility
    return true;
  }

  private calculateRouteMetrics(route: any, priority: string, serviceLevel: string): any {
    // Implementation would calculate comprehensive route metrics
    return route;
  }

  private async checkCapacityAvailability(legs: MglTransportLeg[]): Promise<boolean> {
    // Implementation would check real-time capacity across all legs
    return true;
  }

  private async getHsCodeRestrictions(hsCode: string): Promise<any> {
    // Implementation would query HS code specific restrictions
    return null;
  }
}