import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Hello from calculate-quote-financials!")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { shipping_amount, tax_percent } = await req.json()

    // Input validation
    const shipping = parseFloat(shipping_amount)
    const taxRate = parseFloat(tax_percent)

    if (isNaN(shipping) || isNaN(taxRate)) {
        throw new Error('Invalid numeric input')
    }

    if (shipping < 0 || taxRate < 0) {
      throw new Error('Negative values are not allowed')
    }

    // Calculation Logic (Centralized)
    const taxAmount = (shipping * taxRate) / 100
    const total = shipping + taxAmount

    const data = {
      shipping_amount: shipping,
      tax_percent: taxRate,
      tax_amount: Number(taxAmount.toFixed(2)),
      total_amount: Number(total.toFixed(2)),
      currency: 'USD', // Default for now, could be passed in
      calculated_at: new Date().toISOString()
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
