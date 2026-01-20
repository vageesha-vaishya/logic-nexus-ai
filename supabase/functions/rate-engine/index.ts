import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Hello from Rate Engine!")

interface RateRequest {
  origin: string
  destination: string
  weight: number
  mode: 'air' | 'ocean' | 'road'
  commodity: string
  unit: 'kg' | 'lbs'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { origin, destination, weight, mode, unit } = await req.json() as RateRequest

    // Normalize weight to KG
    const weightKg = unit === 'lbs' ? weight * 0.453592 : weight

    // 1. Lookup Contracted Rates (Priority)
    // Note: In a production app, we would use a more sophisticated location matching (PostGIS)
    const { data: rates, error } = await supabase
      .from('carrier_rates')
      .select(`
        id,
        base_rate,
        transit_time_days,
        carrier:carrier_id(name),
        service:service_id(service_name)
      `)
      .eq('origin_location', origin) 
      .eq('destination_location', destination)
      .eq('mode', mode)
      .eq('is_active', true)
      // .gte('valid_until', new Date().toISOString()) // Uncomment if data exists
      .limit(5)

    let options = []

    if (rates && rates.length > 0) {
        // Transform DB rates to options
        options = rates.map((r: any) => ({
            id: r.id,
            name: `${r.carrier?.name || 'Standard'} - ${r.service?.service_name || mode}`,
            price: Number(r.base_rate) * Number(weightKg),
            transitTime: r.transit_time_days ? `${r.transit_time_days} Days` : '3-5 Days',
            carrier: r.carrier?.name || 'Unknown',
            type: 'standard' 
        }))
    } 
    
    // If no exact matches or few matches, fill with Spot Market Estimates
    if (options.length === 0) {
        // 2. Fallback: Spot Market Algorithm (Mock for now, but logical)
        // Base Rates per KG
        const baseRates: Record<string, number> = {
            'air': 4.50,
            'ocean': 0.85,
            'road': 1.20
        }
        
        const baseRate = baseRates[mode] || 2.00
        const estimatedPrice = Number(weightKg) * baseRate

        options = [
            {
                id: 'spot_eco',
                name: 'Economy Saver',
                type: 'economy',
                price: Math.round(estimatedPrice * 0.85) + 50,
                transitTime: mode === 'air' ? '5-7 Days' : '30-40 Days',
                carrier: 'Spot Market (Eco)',
            },
            {
                id: 'spot_std',
                name: 'Standard Service',
                type: 'standard',
                price: Math.round(estimatedPrice * 1.0) + 75,
                transitTime: mode === 'air' ? '3-5 Days' : '20-25 Days',
                carrier: 'Spot Market (Std)',
            },
            {
                id: 'spot_exp',
                name: 'Express Priority',
                type: 'express',
                price: Math.round(estimatedPrice * 1.4) + 120,
                transitTime: mode === 'air' ? '1-2 Days' : '15-18 Days',
                carrier: 'Spot Market (Exp)',
            }
        ]
    }

    return new Response(
      JSON.stringify({ options }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
