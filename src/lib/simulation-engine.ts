
import { RateOption } from '@/types/quote-breakdown';

const CARRIERS = {
    ocean: [
        'COSCO Shipping', 'ONE (Ocean Network Express)', 'Hapag-Lloyd', 
        'Maersk', 'MSC', 'CMA CGM', 'Evergreen', 'Yang Ming', 'HMM', 'ZIM', 'Wan Hai', 'PIL'
    ],
    air: [
        'Emirates SkyCargo', 'Cathay Pacific Cargo', 'Korean Air Cargo', 
        'Lufthansa Cargo', 'FedEx', 'UPS', 'Qatar Airways Cargo', 
        'China Airlines Cargo', 'Singapore Airlines Cargo', 'DHL Aviation'
    ],
    road: [
        'JB Hunt', 'XPO Logistics', 'Old Dominion', 'YRC Freight', 
        'Estes Express', 'TForce Freight', 'ABF Freight', 'R+L Carriers', 'Saia', 'Southeastern'
    ],
    rail: [
        'CR Express', 'DB Cargo', 'Union Pacific', 'BNSF', 'CSX', 
        'Norfolk Southern', 'CN (Canadian National)', 'CPKC'
    ]
};

export interface SimulationParams {
    mode: 'air' | 'ocean' | 'road' | 'rail';
    origin: string;
    destination: string;
    weightKg?: number;
    containerQty?: number;
    containerSize?: string;
    vehicleType?: string;
}

export function generateSimulatedRates(params: SimulationParams): RateOption[] {
    const { mode, weightKg = 0, containerQty = 1, containerSize, vehicleType } = params;
    const options: RateOption[] = [];
    
    // Dynamic Base Rates Calculation
    let basePrice = 0;
    let baseTransitDays = 0;

    if (mode === 'ocean') {
        const baseRate20 = 1500;
        const baseRate40 = 2800;
        const size = containerSize || '20ft';
        const base = size.includes('40') ? baseRate40 : baseRate20;
        basePrice = base * containerQty;
        baseTransitDays = 25;
    } else if (mode === 'air') {
        const ratePerKg = 4.50;
        basePrice = (weightKg || 100) * ratePerKg;
        baseTransitDays = 3;
    } else if (mode === 'road') {
        const ratePerKm = 2.50; 
        const mockDistance = 500; // km
        basePrice = mockDistance * ratePerKm;
        if (vehicleType === 'reefer') basePrice *= 1.2;
        baseTransitDays = 1;
    } else if (mode === 'rail') {
        const baseRate20 = 4000;
        const baseRate40 = 7500;
        const size = containerSize || '20ft';
        const base = size.includes('40') ? baseRate40 : baseRate20;
        basePrice = base * containerQty;
        baseTransitDays = 16;
    }

    // Generate Simulated Options for Target Carriers
    const targetCarriers = CARRIERS[mode] || CARRIERS.ocean; 
    
    targetCarriers.forEach((carrierName, index) => {
        // Limit to 10-15 options
        if (options.length >= 15) return; 

        // Simulation Factors
        // Price Variance: +/- 15% based on carrier index to ensure spread
        const priceVariance = 0.85 + (Math.random() * 0.3); 
        // Transit Variance: +/- 20%
        const transitVariance = 0.8 + (Math.random() * 0.4);
        
        const simulatedPrice = basePrice * priceVariance;
        const simulatedTransit = Math.round(baseTransitDays * transitVariance);
        
        // Determine Service Level
        const isExpress = simulatedTransit < baseTransitDays;
        const routeType = isExpress ? 'Direct' : 'Transshipment';
        const stops = isExpress ? 0 : 1 + Math.floor(Math.random() * 2);

        // CO2 Estimate
        const co2Factor = mode === 'air' ? 0.6 : 
                         (mode === 'ocean' ? 0.03 : 
                         (mode === 'rail' ? 0.02 : 0.1));
        const estimatedCo2 = Math.round((weightKg || 1000) * co2Factor * (1 + (stops * 0.1)));
        
        const originalCost = simulatedPrice;

        options.push({
            id: `sim_${mode}_${index}_${Date.now()}`,
            tier: 'market',
            option_name: `${carrierName} ${isExpress ? 'Express' : 'Standard'}`, // Map to option_name expected by UI
            carrier_name: carrierName, // Map to carrier_name expected by UI
            total_amount: Math.round(simulatedPrice * 100) / 100, // Map to total_amount
            currency: 'USD',
            transit_time: { details: `${simulatedTransit} Days` }, // Map to complex object
            valid_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            source_attribution: 'Simulation Engine (Fallback)',
            legs: [],
            charges: [],
            total_co2_kg: estimatedCo2,
            meta: {
                route_type: routeType,
                stops: stops
            }
        } as any);
    });

    return options;
}
