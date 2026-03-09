// NYC-DED Origin-Destination Routing Engine with Carrier Alliances
// Enhanced routing intelligence for QUO-260309-00001 multi-modal scenarios

import { ScopedDataAccess } from '@/lib/db/access';
import type {
  MglTransportLeg,
  TransportMode,
  MglCommodityType,
  MglContainerType
} from './types';

export interface RouteOptimizationResult {
  recommendedRoute: MglTransportLeg[];
  totalTransitDays: number;
  totalCost: number;
  viabilityScore: number;
  carrierAlliances: string[];
  transferPoints: string[];
  serviceLevel: 'express' | 'standard' | 'economy';
  capacityAvailable: boolean;
  realTimePricing: boolean;
}

export interface CarrierAllianceInfo {
  allianceCode: string;
  allianceName: string;
  memberCarriers: string[];
  coverage: TransportMode[];
  interlineAgreements: string[];
  viabilityScore: number;
}

export interface RoutingMatrixEntry {
  originCode: string;
  destinationCode: string;
  transportMode: TransportMode;
  carrierCoverage: string[];
  transitTimeDays: number;
  frequencyPerWeek: number;
  viabilityScore: number;
  historicalPerformance: number;
  geographicConstraints: Record<string, any>;
  preferredTransshipmentHubs: string[];
}

export class NycDedRoutingEngine {
  private scopedDb: ScopedDataAccess;
  private readonly NYC_CODES = new Set(['JFK', 'EWR', 'LGA', 'USNYC', 'NYC', 'NEW YORK']);
  private readonly DED_CODE = 'DED';

  constructor(scopedDb: ScopedDataAccess) {
    this.scopedDb = scopedDb;
  }

  // Main routing optimization method
  async optimizeNycToDedRoute(
    commodityType: MglCommodityType,
    containerType: MglContainerType,
    priority: 'cost' | 'time' | 'reliability' = 'cost',
    serviceLevel: 'express' | 'standard' | 'economy' = 'standard'
  ): Promise<RouteOptimizationResult> {
    // Get all viable routes from routing matrix
    const viableRoutes = await this.getViableRoutes(commodityType, containerType, serviceLevel);

    if (viableRoutes.length === 0) {
      throw new Error('No viable routes found from NYC to Dehra Dun Airport');
    }

    // Optimize each viable route
    const optimizedRoutes = await Promise.all(
      viableRoutes.map(route => 
        this.optimizeSingleRoute(route, commodityType, containerType, priority)
      )
    );

    // Select best route based on priority
    const bestRoute = this.selectBestRoute(optimizedRoutes, priority);

    return bestRoute;
  }

  // Get viable routes from routing matrix
  private async getViableRoutes(
    commodityType: MglCommodityType,
    containerType: MglContainerType,
    serviceLevel: string
  ): Promise<RoutingMatrixEntry[]> {
    const { data: routes } = await this.scopedDb
      .from('route_matrices')
      .select('*')
      .or(`origin_code.in.(${Array.from(this.NYC_CODES).join(',')}),destination_code.eq.${this.DED_CODE}`)
      .gte('viability_score', this.getMinViabilityScore(commodityType, serviceLevel))
      .order('viability_score', { ascending: false });

    return routes || [];
  }

  // Optimize a single route with detailed leg construction
  private async optimizeSingleRoute(
    route: RoutingMatrixEntry,
    commodityType: MglCommodityType,
    containerType: MglContainerType,
    priority: string
  ): Promise<RouteOptimizationResult> {
    // Build detailed transport legs with carrier alliances
    const legs = await this.buildDetailedLegs(route, commodityType, containerType);

    // Calculate total metrics
    const totalTransitDays = this.calculateTotalTransitTime(legs);
    const totalCost = await this.estimateRouteCost(legs, commodityType, containerType);
    
    // Extract carrier alliances
    const carrierAlliances = this.extractCarrierAlliances(legs);
    
    // Identify transfer points
    const transferPoints = this.identifyTransferPoints(legs);

    // Check real-time capacity
    const capacityAvailable = await this.checkRealTimeCapacity(legs, containerType);

    return {
      recommendedRoute: legs,
      totalTransitDays,
      totalCost,
      viabilityScore: route.viabilityScore,
      carrierAlliances,
      transferPoints,
      serviceLevel: this.determineServiceLevel(legs),
      capacityAvailable,
      realTimePricing: await this.hasRealTimePricing(legs)
    };
  }

  // Build detailed transport legs with carrier selection
  private async buildDetailedLegs(
    route: RoutingMatrixEntry,
    commodityType: MglCommodityType,
    containerType: MglContainerType
  ): Promise<MglTransportLeg[]> {
    const legs: MglTransportLeg[] = [];
    const sequenceNo = 1;

    // Direct route optimization
    if (route.transportMode !== 'multimodal' as any) {
      const directLeg = await this.createDirectLeg(route, commodityType, containerType, sequenceNo);
      legs.push(directLeg);
    } else {
      // Multi-modal route with transshipment
      legs.push(...await this.createMultimodalLegs(route, commodityType, containerType));
    }

    return legs;
  }

  // Create direct transport leg
  private async createDirectLeg(
    route: RoutingMatrixEntry,
    commodityType: MglCommodityType,
    containerType: MglContainerType,
    sequenceNo: number
  ): Promise<MglTransportLeg> {
    // Select optimal carrier based on commodity and container type
    const optimalCarrier = await this.selectOptimalCarrier(
      route.carrierCoverage,
      route.transportMode,
      commodityType,
      containerType
    );

    return {
      id: crypto.randomUUID(),
      sequenceNo,
      mode: route.transportMode,
      originCode: route.originCode,
      destinationCode: route.destinationCode,
      carrierName: optimalCarrier,
      transitDays: route.transitTimeDays,
      frequencyPerWeek: route.frequencyPerWeek
    };
  }

  // Create multi-modal legs with transshipment points
  private async createMultimodalLegs(
    route: RoutingMatrixEntry,
    commodityType: MglCommodityType,
    containerType: MglContainerType
  ): Promise<MglTransportLeg[]> {
    const legs: MglTransportLeg[] = [];
    let sequenceNo = 1;

    // NYC to primary hub (typically East Coast port/airport)
    const primaryHub = await this.selectPrimaryTransshipmentHub(route.originCode);
    legs.push(await this.createLegSegment(
      route.originCode,
      primaryHub,
      'road',
      commodityType,
      containerType,
      sequenceNo++
    ));

    // Primary hub to intermediate hub (typically Middle East/Asia)
    const intermediateHub = await this.selectIntermediateHub(primaryHub, route.destinationCode);
    legs.push(await this.createLegSegment(
      primaryHub,
      intermediateHub,
      'ocean',
      commodityType,
      containerType,
      sequenceNo++
    ));

    // Intermediate hub to Delhi (closest major airport to DED)
    legs.push(await this.createLegSegment(
      intermediateHub,
      'DEL', // Delhi airport as gateway to DED
      'air',
      commodityType,
      containerType,
      sequenceNo++
    ));

    // Delhi to Dehra Dun (final road segment)
    legs.push(await this.createLegSegment(
      'DEL',
      route.destinationCode,
      'road',
      commodityType,
      containerType,
      sequenceNo++
    ));

    return legs;
  }

  // Create individual leg segment
  private async createLegSegment(
    origin: string,
    destination: string,
    mode: TransportMode,
    commodityType: MglCommodityType,
    containerType: MglContainerType,
    sequenceNo: number
  ): Promise<MglTransportLeg> {
    const segmentRoute = await this.getRouteSegment(origin, destination, mode);
    const optimalCarrier = await this.selectOptimalCarrier(
      segmentRoute.carrierCoverage,
      mode,
      commodityType,
      containerType
    );

    return {
      id: crypto.randomUUID(),
      sequenceNo,
      mode,
      originCode: origin,
      destinationCode: destination,
      carrierName: optimalCarrier,
      transitDays: segmentRoute.transitTimeDays,
      frequencyPerWeek: segmentRoute.frequencyPerWeek
    };
  }

  // Select optimal carrier based on multiple factors
  private async selectOptimalCarrier(
    availableCarriers: string[],
    mode: TransportMode,
    commodityType: MglCommodityType,
    containerType: MglContainerType
  ): Promise<string> {
    // Get carrier alliance information
    const carrierAlliances = await this.getCarrierAlliances(availableCarriers);

    // Score carriers based on multiple criteria
    const carrierScores = await Promise.all(
      availableCarriers.map(async carrier => ({
        carrier,
        score: await this.scoreCarrier(carrier, mode, commodityType, containerType, carrierAlliances)
      }))
    );

    // Select carrier with highest score
    return carrierScores.sort((a, b) => b.score - a.score)[0]?.carrier || availableCarriers[0];
  }

  // Score carrier based on multiple criteria
  private async scoreCarrier(
    carrier: string,
    mode: TransportMode,
    commodityType: MglCommodityType,
    containerType: MglContainerType,
    alliances: CarrierAllianceInfo[]
  ): Promise<number> {
    let score = 0;

    // Alliance membership score
    const carrierAlliance = alliances.find(a => a.memberCarriers.includes(carrier));
    if (carrierAlliance) {
      score += carrierAlliance.viabilityScore * 20;
    }

    // Commodity expertise score
    const commodityExpertise = await this.getCarrierCommodityExpertise(carrier, commodityType);
    score += commodityExpertise * 15;

    // Equipment capability score
    const equipmentCapability = await this.getCarrierEquipmentCapability(carrier, containerType, mode);
    score += equipmentCapability * 15;

    // Service reliability score
    const reliability = await this.getCarrierReliability(carrier, mode);
    score += reliability * 25;

    // Cost competitiveness score
    const costCompetitiveness = await this.getCarrierCostCompetitiveness(carrier, mode);
    score += costCompetitiveness * 25;

    return score;
  }

  // Helper methods for carrier evaluation
  private async getCarrierCommodityExpertise(carrier: string, commodityType: MglCommodityType): Promise<number> {
    // Implementation for carrier commodity expertise lookup
    const expertise: Record<string, number> = {
      hazardous: 0.8,
      perishable: 0.9,
      pharmaceutical: 0.95,
      general: 1.0,
      fragile: 0.85,
      oversized: 0.7
    };
    return expertise[commodityType] || 0.7;
  }

  private async getCarrierEquipmentCapability(carrier: string, containerType: MglContainerType, mode: TransportMode): Promise<number> {
    // Implementation for carrier equipment capability lookup
    return 0.9; // Default score
  }

  private async getCarrierReliability(carrier: string, mode: TransportMode): Promise<number> {
    // Implementation for carrier reliability lookup
    return 0.92; // Default score
  }

  private async getCarrierCostCompetitiveness(carrier: string, mode: TransportMode): Promise<number> {
    // Implementation for carrier cost competitiveness lookup
    return 0.88; // Default score
  }

  // Get carrier alliances information
  private async getCarrierAlliances(carriers: string[]): Promise<CarrierAllianceInfo[]> {
    const { data: alliances } = await this.scopedDb
      .from('carrier_alliances')
      .select('*')
      .in('member_carriers', carriers);

    return alliances || [];
  }

  // Get route segment information
  private async getRouteSegment(origin: string, destination: string, mode: TransportMode): Promise<RoutingMatrixEntry> {
    const { data: segment } = await this.scopedDb
      .from('route_matrices')
      .select('*')
      .eq('origin_code', origin)
      .eq('destination_code', destination)
      .eq('transport_mode', mode)
      .single();

    return segment || {
      originCode: origin,
      destinationCode: destination,
      transportMode: mode,
      carrierCoverage: [],
      transitTimeDays: this.estimateTransitTime(origin, destination, mode),
      frequencyPerWeek: 3,
      viabilityScore: 0.8,
      historicalPerformance: 0.85,
      geographicConstraints: {},
      preferredTransshipmentHubs: []
    };
  }

  // Estimate transit time for unknown segments
  private estimateTransitTime(origin: string, destination: string, mode: TransportMode): number {
    const baseTimes: Record<TransportMode, number> = {
      air: 2,
      ocean: 18,
      road: 5,
      rail: 7
    };
    return baseTimes[mode] || 5;
  }

  // Select primary transshipment hub
  private async selectPrimaryTransshipmentHub(origin: string): Promise<string> {
    // Prefer East Coast hubs for NYC origin
    const eastCoastHubs = ['JFK', 'EWR', 'BOS', 'IAD', 'ATL'];
    return eastCoastHubs[Math.floor(Math.random() * eastCoastHubs.length)];
  }

  // Select intermediate hub
  private async selectIntermediateHub(primaryHub: string, destination: string): Promise<string> {
    // Prefer Middle East/Asia hubs for India destination
    const intermediateHubs = ['DXB', 'AUH', 'DOH', 'SIN', 'BKK', 'HKG'];
    return intermediateHubs[Math.floor(Math.random() * intermediateHubs.length)];
  }

  // Calculate total transit time including buffers
  private calculateTotalTransitTime(legs: MglTransportLeg[]): number {
    return legs.reduce((total, leg) => total + (leg.transitDays || 0), 0);
  }

  // Estimate route cost
  private async estimateRouteCost(legs: MglTransportLeg[], commodityType: MglCommodityType, containerType: MglContainerType): Promise<number> {
    let totalCost = 0;

    for (const leg of legs) {
      const legCost = await this.estimateLegCost(leg, commodityType, containerType);
      totalCost += legCost;
    }

    return totalCost;
  }

  // Estimate individual leg cost
  private async estimateLegCost(leg: MglTransportLeg, commodityType: MglCommodityType, containerType: MglContainerType): Promise<number> {
    // Base cost estimation logic
    const baseCosts: Record<TransportMode, number> = {
      air: 5000,
      ocean: 2000,
      road: 800,
      rail: 1200
    };

    let cost = baseCosts[leg.mode] || 1000;

    // Apply commodity multiplier
    const commodityMultipliers: Record<MglCommodityType, number> = {
      general: 1.0,
      hazardous: 1.3,
      perishable: 1.2,
      pharmaceutical: 1.4,
      fragile: 1.1,
      oversized: 1.5
    };
    cost *= commodityMultipliers[commodityType] || 1.0;

    return cost;
  }

  // Extract carrier alliances from legs
  private extractCarrierAlliances(legs: MglTransportLeg[]): string[] {
    const alliances = new Set<string>();
    legs.forEach(leg => {
      if (leg.carrierName) {
        // Simple alliance mapping based on carrier name
        if (leg.carrierName.includes('Maersk')) alliances.add('2M Alliance');
        if (leg.carrierName.includes('MSC')) alliances.add('2M Alliance');
        if (leg.carrierName.includes('CMA')) alliances.add('Ocean Alliance');
        if (leg.carrierName.includes('COSCO')) alliances.add('Ocean Alliance');
        if (leg.carrierName.includes('Evergreen')) alliances.add('Ocean Alliance');
        if (leg.carrierName.includes('Hapag')) alliances.add('THE Alliance');
        if (leg.carrierName.includes('ONE')) alliances.add('THE Alliance');
        if (leg.carrierName.includes('Yang Ming')) alliances.add('THE Alliance');
      }
    });
    return Array.from(alliances);
  }

  // Identify transfer points in multi-modal routes
  private identifyTransferPoints(legs: MglTransportLeg[]): string[] {
    const transferPoints: string[] = [];
    
    for (let i = 0; i < legs.length - 1; i++) {
      const currentLeg = legs[i];
      const nextLeg = legs[i + 1];
      
      if (currentLeg.destinationCode !== nextLeg.originCode) {
        transferPoints.push(currentLeg.destinationCode);
      }
    }
    
    return transferPoints;
  }

  // Check real-time capacity availability
  private async checkRealTimeCapacity(legs: MglTransportLeg[], containerType: MglContainerType): Promise<boolean> {
    for (const leg of legs) {
      const capacity = await this.scopedDb
        .from('rate_option_legs')
        .select('capacity_available')
        .eq('carrier_name', leg.carrierName)
        .eq('transport_mode', leg.mode)
        .eq('origin_code', leg.originCode)
        .single();

      if (!capacity.data?.capacity_available) {
        return false;
      }
    }
    return true;
  }

  // Determine service level based on route characteristics
  private determineServiceLevel(legs: MglTransportLeg[]): 'express' | 'standard' | 'economy' {
    const hasAir = legs.some(leg => leg.mode === 'air');
    const hasExpressCarrier = legs.some(leg => 
      ['DHL', 'FedEx', 'UPS'].includes(leg.carrierName || '')
    );

    if (hasAir && hasExpressCarrier) return 'express';
    if (hasAir) return 'standard';
    return 'economy';
  }

  // Check if route has real-time pricing
  private async hasRealTimePricing(legs: MglTransportLeg[]): Promise<boolean> {
    for (const leg of legs) {
      const realTime = await this.scopedDb
        .from('rate_option_legs')
        .select('real_time_availability')
        .eq('carrier_name', leg.carrierName)
        .eq('transport_mode', leg.mode)
        .single();

      if (!realTime.data?.real_time_availability) {
        return false;
      }
    }
    return true;
  }

  // Get minimum viability score based on commodity and service level
  private getMinViabilityScore(commodityType: MglCommodityType, serviceLevel: string): number {
    const baseScores: Record<string, number> = {
      express: 0.9,
      standard: 0.8,
      economy: 0.7
    };

    const commodityMultipliers: Record<MglCommodityType, number> = {
      hazardous: 0.9,
      perishable: 0.95,
      pharmaceutical: 0.98,
      general: 1.0,
      fragile: 0.92,
      oversized: 0.85
    };

    return baseScores[serviceLevel] * (commodityMultipliers[commodityType] || 1.0);
  }

  // Select best route based on optimization priority
  private selectBestRoute(routes: RouteOptimizationResult[], priority: string): RouteOptimizationResult {
    return routes.sort((a, b) => {
      switch (priority) {
        case 'cost':
          return a.totalCost - b.totalCost;
        case 'time':
          return a.totalTransitDays - b.totalTransitDays;
        case 'reliability':
          return b.viabilityScore - a.viabilityScore;
        default:
          return a.totalCost - b.totalCost;
      }
    })[0];
  }
}
