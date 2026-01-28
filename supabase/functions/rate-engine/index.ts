import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: {
  env: { get(name: string): string | undefined };
};

console.log("Rate Engine v2.1 Initialized")

interface RateRequest {
  origin: string // Code (e.g., "LAX") or UUID
  destination: string // Code (e.g., "PVG") or UUID
  weight: number | string
  mode: 'air' | 'ocean' | 'road'
  commodity?: string
  unit?: string
  account_id?: string
  // Extended Fields
  containerType?: string
  containerSize?: string
  containerQty?: string | number
  dims?: string
  vehicleType?: string
  dangerousGoods?: boolean
}

interface RateOption {
  id: string
  tier: 'contract' | 'spot' | 'market'
  name: string
  carrier: string
  price: number
  currency: string
  transitTime: string
  validUntil?: string
  margin_applied?: string[]
  co2_kg?: number
  route_type?: 'Direct' | 'Transshipment'
  stops?: number
}

// Global Carrier List for AI Simulation / Market Estimates
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
    ]
};

serve(async (req) => {
  // 1. CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Auth & Client Setup
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )

    // 3. Parse Request
    let body: RateRequest;
    try {
        body = await req.json() as RateRequest;
    } catch (e) {
        throw new Error("Invalid JSON body");
    }
    const { 
        origin, destination, weight, mode, unit, account_id,
        containerQty, containerSize, vehicleType 
    } = body;

    if (!origin || !destination || !mode) {
      throw new Error("Missing required fields: origin, destination, mode")
    }

    // Normalize weight to KG
    let weightKg = 0;
    if (weight) {
        weightKg = Number(weight);
        if (unit === 'lbs') weightKg = weightKg * 0.453592;
    }

    // 4. Resolve Locations (Code -> UUID)
    const resolveLocation = async (loc: string): Promise<string | null> => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(loc)) return loc;

      const { data } = await supabase
        .from('ports_locations')
        .select('id')
        .eq('location_code', loc)
        .single();
      return data?.id || null;
    }

    const [originId, destId] = await Promise.all([
      resolveLocation(origin),
      resolveLocation(destination)
    ])

    const options: RateOption[] = []

    // 5. Query 3-Tier Rates from DB
    if (originId && destId) {
        const now = new Date().toISOString().split('T')[0]; 

        const query = supabase
            .from('carrier_rates')
            .select(`
                id, tier, carrier:carrier_id(name),
                total_amount, transit_days, valid_to, account_id
            `)
            .eq('origin_port_id', originId)
            .eq('destination_port_id', destId)
            .eq('mode', mode)
            .eq('status', 'active')
            .or(`valid_to.is.null,valid_to.gte.${now}`)
        
        const { data: rates, error } = await query;

        if (!error && rates) {
            rates.forEach((r: any) => {
                const isContract = r.tier === 'contract';
                
                if (isContract && r.account_id !== account_id) return;

                // Simple Price Calc
                let price = Number(r.total_amount);
                
                // Adjust for quantity/weight
                if (mode === 'ocean' && containerQty) {
                    price = price * Number(containerQty);
                } else if (weightKg > 0) {
                    // Assume rate is per kg for Air/Road unless specified otherwise
                    // In real app, check rate unit (per kg, per shipment)
                    price = price * weightKg; 
                }

                options.push({
                    id: r.id,
                    tier: r.tier as any,
                    name: isContract ? 'Contract Rate' : (r.tier === 'spot' ? 'Spot Rate' : 'Market Rate'),
                    carrier: r.carrier?.name || 'Unknown',
                    price: Math.round(price * 100) / 100,
                    currency: 'USD',
                    transitTime: r.transit_days ? `${r.transit_days} Days` : '3-5 Days',
                    validUntil: r.valid_to
                });
            });
        }
    }

    // 6. Fallback / 10+ Options Guarantee Strategy
    if (options.length < 10) {
        // Dynamic Base Rates Calculation
        let basePrice = 0;
        let baseTransitDays = 0;

        if (mode === 'ocean') {
            const baseRate20 = 1500;
            const baseRate40 = 2800;
            const qty = Number(containerQty) || 1;
            const size = containerSize || '20ft';
            const base = size.includes('40') ? baseRate40 : baseRate20;
            basePrice = base * qty;
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
        }

        // Generate Simulated Options for Target Carriers
        const targetCarriers = CARRIERS[mode] || CARRIERS.ocean; // Default to ocean if unknown
        
        targetCarriers.forEach((carrierName, index) => {
            // Skip if we already have a real contract/spot rate for this carrier
            if (options.some(o => o.carrier === carrierName)) return;

            // Stop if we have enough options (though we want to provide variety)
            // if (options.length >= 15) return; 

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

            // CO2 Estimate (Simple Factor)
            const co2Factor = mode === 'air' ? 0.6 : (mode === 'ocean' ? 0.03 : 0.1); // kg CO2 per kg cargo
            const estimatedCo2 = Math.round((weightKg || 1000) * co2Factor * (1 + (stops * 0.1)));

            options.push({
                id: `sim_${mode}_${index}_${Date.now()}`,
                tier: 'market',
                name: `${carrierName} ${isExpress ? 'Express' : 'Standard'}`,
                carrier: carrierName,
                price: Math.round(simulatedPrice * 100) / 100,
                currency: 'USD',
                transitTime: `${simulatedTransit} Days`,
                route_type: routeType,
                stops: stops,
                co2_kg: estimatedCo2,
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Valid for 7 days
            });
        });
    }

    // 6.5 Apply Tenant Margins
    const { data: marginRules } = await supabase
        .from('margin_rules')
        .select('*')
        .order('priority', { ascending: false });

    if (marginRules && marginRules.length > 0) {
        options.forEach(opt => {
            let price = opt.price;
            const appliedMargins: string[] = [];

            for (const rule of marginRules) {
                // Check conditions
                let match = true;
                const conditions = rule.condition_json;
                
                for (const [key, value] of Object.entries(conditions)) {
                    // Check against request body or option details
                    // Priority: Option -> Request
                    const optValue = (opt as any)[key];
                    const reqValue = (body as any)[key];
                    const targetValue = optValue !== undefined ? optValue : reqValue;

                    // Simple equality check (can be expanded to support operators like 'gt', 'lt')
                    if (targetValue != value) { 
                        match = false;
                        break;
                    }
                }

                if (match) {
                    if (rule.adjustment_type === 'percent') {
                        price += price * (Number(rule.adjustment_value) / 100);
                    } else if (rule.adjustment_type === 'fixed') {
                        price += Number(rule.adjustment_value);
                    }
                    appliedMargins.push(rule.name);
                }
            }
            
            // Update price
            if (appliedMargins.length > 0) {
                // (opt as any).original_price = opt.price; // Optional: Keep original
                opt.price = Math.round(price * 100) / 100;
                opt.margin_applied = appliedMargins;
            }
        });
    }

    // 7. Sort
    options.sort((a, b) => {
        const tierOrder = { 'contract': 0, 'spot': 1, 'market': 2 };
        if (tierOrder[a.tier] !== tierOrder[b.tier]) {
            return tierOrder[a.tier] - tierOrder[b.tier];
        }
        return a.price - b.price;
    });

    return new Response(
      JSON.stringify({ options }),
      { 
        headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Content-Language": "en",
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
        }  
      },
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
          status: 400, 
          headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Content-Language": "en"
          } 
      },
    )
  }
})
