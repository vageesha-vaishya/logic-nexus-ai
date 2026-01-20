import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Rate Engine v2 Initialized")

interface RateRequest {
  origin: string // Code (e.g., "LAX") or UUID
  destination: string // Code (e.g., "PVG") or UUID
  weight: number
  mode: 'air' | 'ocean' | 'road'
  commodity?: string
  unit: 'kg' | 'lbs'
  customer_id?: string
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
}

serve(async (req) => {
  // 1. CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Auth & Client Setup
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 3. Parse Request
    const { origin, destination, weight, mode, unit, customer_id } = await req.json() as RateRequest

    if (!origin || !destination || !weight || !mode) {
      throw new Error("Missing required fields: origin, destination, weight, mode")
    }

    // Normalize weight to KG
    const weightKg = unit === 'lbs' ? weight * 0.453592 : weight

    // 4. Resolve Locations (Code -> UUID)
    // Helper to resolve location
    const resolveLocation = async (loc: string): Promise<string | null> => {
      // If it looks like a UUID, return it
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(loc)) return loc;

      // Otherwise lookup by code
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

    if (!originId || !destId) {
      // If locations not found in DB, we can't query exact routes. 
      // Proceed to fallback logic immediately or throw.
      // For Phase 1, we'll try to find rates, if not, use fallback.
      console.warn(`Locations not found for codes: ${origin}, ${destination}`)
    }

    const options: RateOption[] = []

    // 5. Query 3-Tier Rates from DB
    if (originId && destId) {
        const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Build query
        let query = supabase
            .from('carrier_rates')
            .select(`
                id,
                tier,
                carrier:carrier_id(name),
                total_amount,
                transit_days,
                valid_to,
                customer_id
            `)
            .eq('origin_port_id', originId)
            .eq('destination_port_id', destId)
            .eq('mode', mode)
            .eq('status', 'active')
            .or(`valid_to.is.null,valid_to.gte.${now}`) // Valid or indefinite
        
        // Fetch rates
        const { data: rates, error } = await query;

        if (!error && rates) {
            rates.forEach((r: any) => {
                const isContract = r.tier === 'contract';
                const isSpot = r.tier === 'spot';
                
                // Filter Contract rates: must match customer_id
                if (isContract && r.customer_id !== customer_id) return;

                // Calculate total price (Simplified: Rate * Weight)
                // In production, check charge structure (flat vs per_kg)
                // Assuming 'total_amount' is per unit (kg) for now
                const price = Number(r.total_amount) * weightKg;

                options.push({
                    id: r.id,
                    tier: r.tier as any,
                    name: isContract ? 'Contract Rate' : (isSpot ? 'Spot Rate' : 'Market Rate'),
                    carrier: r.carrier?.name || 'Unknown',
                    price: Math.round(price * 100) / 100,
                    currency: 'USD',
                    transitTime: r.transit_days ? `${r.transit_days} Days` : '3-5 Days',
                    validUntil: r.valid_to
                });
            });
        }
    }

    // 6. Fallback / Market Estimates (if no DB rates found)
    if (options.length === 0) {
        // Mock Market Rates
        const baseRates: Record<string, number> = {
            'air': 4.50,
            'ocean': 0.85,
            'road': 1.20
        }
        const baseRate = baseRates[mode] || 2.00;
        const estimatedPrice = weightKg * baseRate;

        options.push({
            id: 'mkt_std',
            tier: 'market',
            name: 'Standard Market Rate',
            carrier: 'Market Avg',
            price: Math.round(estimatedPrice * 100) / 100,
            currency: 'USD',
            transitTime: mode === 'air' ? '3-5 Days' : '20-30 Days',
        });
        
        options.push({
            id: 'mkt_exp',
            tier: 'market',
            name: 'Express Market Rate',
            carrier: 'Market Avg',
            price: Math.round(estimatedPrice * 1.3 * 100) / 100,
            currency: 'USD',
            transitTime: mode === 'air' ? '1-2 Days' : '15-20 Days',
        });
    }

    // 7. Sort: Contract first, then Price
    options.sort((a, b) => {
        const tierOrder = { 'contract': 0, 'spot': 1, 'market': 2 };
        if (tierOrder[a.tier] !== tierOrder[b.tier]) {
            return tierOrder[a.tier] - tierOrder[b.tier];
        }
        return a.price - b.price;
    });

    // 8. Return Response
    // Cache for 60 seconds
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
