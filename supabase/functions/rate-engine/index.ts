import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
}

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

        let query = supabase
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

    // 6. Fallback / Market Estimates
    if (options.length === 0) {
        // Dynamic Base Rates
        let estimatedPrice = 0;

        if (mode === 'ocean') {
            const baseRate20 = 1500;
            const baseRate40 = 2800;
            const qty = Number(containerQty) || 1;
            const size = containerSize || '20ft';
            const base = size.includes('40') ? baseRate40 : baseRate20;
            estimatedPrice = base * qty;
        } else if (mode === 'air') {
            const ratePerKg = 4.50;
            estimatedPrice = (weightKg || 100) * ratePerKg;
        } else if (mode === 'road') {
            const ratePerKm = 2.50; // Mock distance based
            const mockDistance = 500; // km
            estimatedPrice = mockDistance * ratePerKm;
            if (vehicleType === 'reefer') estimatedPrice *= 1.2;
        }

        options.push({
            id: 'mkt_std',
            tier: 'market',
            name: 'Standard Market Rate',
            carrier: 'Market Avg',
            price: Math.round(estimatedPrice * 100) / 100,
            currency: 'USD',
            transitTime: mode === 'air' ? '3-5 Days' : (mode === 'ocean' ? '25-30 Days' : '2 Days'),
        });
        
        options.push({
            id: 'mkt_exp',
            tier: 'market',
            name: 'Express Market Rate',
            carrier: 'Market Avg',
            price: Math.round(estimatedPrice * 1.3 * 100) / 100,
            currency: 'USD',
            transitTime: mode === 'air' ? '1-2 Days' : (mode === 'ocean' ? '20 Days' : '1 Day'),
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
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
        } 
      },
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
