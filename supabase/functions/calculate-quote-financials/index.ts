declare const Deno: any;
import { getCorsHeaders } from "../_shared/cors.ts"
import { serveWithLogger } from "../_shared/logger.ts"

serveWithLogger(async (req, logger) => {
  const headers = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  logger.info("Hello from calculate-quote-financials!")

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
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Error calculating financials", { error: message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Language': 'en' },
      status: 400,
    })
  }
}, "calculate-quote-financials")
