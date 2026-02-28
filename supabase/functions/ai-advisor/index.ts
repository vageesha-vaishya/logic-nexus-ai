import { getCorsHeaders } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/auth.ts"
import { sanitizeForLLM } from "../_shared/pii-guard.ts"
import { logAiCall } from "../_shared/audit.ts"
import { serveWithLogger, Logger } from "../_shared/logger.ts"

declare const Deno: any;

// Mock Knowledge Base for fallback
const KNOWLEDGE_BASE = {
  commodities: [
    { keywords: ["coal", "ore", "sand", "gravel"], unit: "ton", type: "Bulk", hts: "2701.12", scheduleB: "2701.12.0000" },
    { keywords: ["iphone", "phone", "laptop", "computer", "electronics"], unit: "kg", type: "General Cargo", hts: "8517.12", scheduleB: "8517.12.0000" },
    { keywords: ["banana", "fruit", "vegetable", "meat", "fish"], unit: "kg", type: "Perishable", hts: "0803.10", scheduleB: "0803.10.0000" },
    { keywords: ["oil", "gas", "liquid"], unit: "cbm", type: "Liquid", hts: "2709.00", scheduleB: "2709.00.0000" },
    { keywords: ["furniture", "sofa", "table"], unit: "cbm", type: "General Cargo", hts: "9403.50", scheduleB: "9403.50.0000" },
    { keywords: ["car", "vehicle", "truck"], unit: "unit", type: "RoRo", hts: "8703.23", scheduleB: "8703.23.0000" },
  ],
  ports: [
    { code: "USLAX", name: "Los Angeles", country: "US", type: "ocean" },
    { code: "CNSHA", name: "Shanghai", country: "CN", type: "ocean" },
    { code: "NLRTM", name: "Rotterdam", country: "NL", type: "ocean" },
    { code: "SGSIN", name: "Singapore", country: "SG", type: "ocean" },
  ],
  airports: [
    { code: "LAX", name: "Los Angeles Int", country: "US", type: "air" },
    { code: "PVG", name: "Shanghai Pudong", country: "CN", type: "air" },
    { code: "LHR", name: "London Heathrow", country: "UK", type: "air" },
    { code: "DXB", name: "Dubai Int", country: "AE", type: "air" },
  ],
  rail_terminals: [
    { code: "DEDUI", name: "Duisburg Intermodal Terminal", country: "DE", type: "rail" },
    { code: "CNXIA", name: "Xi'an International Port", country: "CN", type: "rail" },
    { code: "PLMAL", name: "Małaszewicze Terminal", country: "PL", type: "rail" },
    { code: "KZDOZ", name: "Dostyk", country: "KZ", type: "rail" },
  ]
};

serveWithLogger(async (req, logger, supabase) => {
  const headers = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const correlationId = crypto.randomUUID();

    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      logger.warn("Auth failed, continuing in anonymous mode", { correlationId, error: authError });
    }

    const { action, payload } = await req.json()
    // Check for OpenAI Key
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    logger.info(`Action: ${action}, Key Present: ${!!openAiKey}, correlationId: ${correlationId}, userId: ${user?.id ?? 'anonymous'}`);

    if (action === 'generate_smart_quotes' && !openAiKey) {
        logger.warn("Missing OpenAI Key. Returning fallback/empty response.");
        return new Response(
            JSON.stringify({ 
                options: [], 
                market_analysis: "AI Analysis unavailable (Configuration Missing).",
                confidence_score: 0,
                anomalies: [] 
            }),
            { 
                headers: { ...headers, "Content-Type": "application/json" },
                status: 200 
            }
        );
    }

    // Get User Token
    const authHeader = req.headers.get('Authorization');
    const userToken = authHeader ? authHeader.replace('Bearer ', '') : undefined;

    let result = {};

    switch (action) {
      case 'suggest_unit':
        result = await suggestUnit(payload.commodity);
        break;
      case 'classify_commodity':
        result = await classifyCommodity(payload.commodity);
        break;
      case 'predict_price':
        result = await predictPrice(payload);
        break;
      case 'generate_smart_quotes':
        result = await generateSmartQuotes(payload, openAiKey, supabase, logger, userToken, user?.id);
        break;
      case 'lookup_codes':
        result = await lookupCodes(payload.query, payload.mode, supabase);
        break;
      case 'validate_compliance':
        result = await validateCompliance(payload);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
            ...headers, 
            "Content-Type": "application/json",
            "Content-Language": "en"
        },
        status: 200 
      }
    )

  } catch (error: any) {
    logger.error("Error processing request", { error: error.message || String(error) });
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        headers: { 
            ...headers, 
            "Content-Type": "application/json",
            "Content-Language": "en"
        },
        status: 400 
      }
    )
  }
}, "ai-advisor")

// --- Helper Functions ---

async function suggestUnit(commodity: string) {
  if (!commodity) return { unit: 'kg', confidence: 0.1, source: 'default' };
  const lowerComm = commodity.toLowerCase();
  const match = KNOWLEDGE_BASE.commodities.find(k => k.keywords.some(kw => lowerComm.includes(kw)));
  if (match) return { unit: match.unit, confidence: 0.8, source: 'heuristic' };
  if (lowerComm.length > 3) return { unit: 'kg', confidence: 0.4, source: 'ai-mock' };
  return { unit: 'kg', confidence: 0.1, source: 'fallback' };
}

async function classifyCommodity(commodity: string) {
  if (!commodity) return { type: 'General Cargo', confidence: 0.5 };
  const lowerComm = commodity.toLowerCase();
  const match = KNOWLEDGE_BASE.commodities.find(k => k.keywords.some(kw => lowerComm.includes(kw)));
  if (match) return { type: match.type, hts: match.hts, scheduleB: match.scheduleB, confidence: 0.9, source: 'heuristic' };
  return { type: 'General Cargo', confidence: 0.3, source: 'default' };
}

async function predictPrice(payload: any) {
  const basePrice = 1000; 
  const randomFactor = 0.8 + Math.random() * 0.4; 
  return {
    predicted_price: Math.round(basePrice * randomFactor),
    confidence_interval: { low: Math.round(basePrice * 0.8), high: Math.round(basePrice * 1.2) },
    trend: Math.random() > 0.5 ? 'increasing' : 'stable',
    source: 'historical_model'
  };
}

async function lookupCodes(query: string, mode: string, supabase: any) {
    if (!query || query.length < 2) return { suggestions: [] };
    const lowerQ = query.toLowerCase();
    let source: any[] = [];
    if (mode === 'ocean') source = KNOWLEDGE_BASE.ports;
    else if (mode === 'air') source = KNOWLEDGE_BASE.airports;
    else if (mode === 'rail') source = KNOWLEDGE_BASE.rail_terminals;
    else return { suggestions: [] }; 
    const suggestions = source.filter(item => 
        item.code.toLowerCase().includes(lowerQ) || 
        item.name.toLowerCase().includes(lowerQ) ||
        item.country.toLowerCase().includes(lowerQ)
    ).map(item => ({ label: `${item.name} (${item.code})`, value: item.code, details: item }));
    
    try {
      // Enhance with real IDs from ports_locations when available
      const { data, error } = await supabase
        .from('ports_locations')
        .select('id, location_name, location_code, location_type, country, city')
        .or(`location_code.ilike.%${query}%,location_name.ilike.%${query}%`)
        .limit(10);
      
      if (!error && Array.isArray(data)) {
        const byCode = new Map<string, any>();
        for (const row of data) {
          if (row.location_code) byCode.set(String(row.location_code).toUpperCase(), row);
        }
        // Merge IDs into suggestions where codes match
        for (const s of suggestions) {
          const codeKey = String(s.value || s.details?.code || '').toUpperCase();
          const match = byCode.get(codeKey);
          if (match) {
            s.details = {
              ...s.details,
              id: match.id,
              name: match.location_name || s.details?.name,
              code: match.location_code || s.details?.code,
              country: match.country || s.details?.country,
              type: match.location_type || s.details?.type,
              city: match.city || s.details?.city
            };
          }
        }
      }
    } catch (_err) {
      // Silent fallback to mock suggestions when DB unavailable
    }
    
    return { suggestions };
}

async function validateCompliance(payload: any) {
    const { destination, commodity, mode, dangerous_goods } = payload;
    const issues = [];
    if (destination === 'KP' || destination === 'IR') issues.push({ level: 'critical', message: 'Destination is under sanctions.' });
    if (dangerous_goods) {
        if (mode === 'air') issues.push({ level: 'warning', message: 'IATA DGR check required for Air Cargo.' });
        if (commodity && commodity.toLowerCase().includes('battery')) issues.push({ level: 'info', message: 'Lithium Battery regulations apply (UN3480/UN3481).' });
    }
    if (commodity && commodity.toLowerCase().includes('chip') && destination === 'CN') issues.push({ level: 'warning', message: 'Check Export Administration Regulations (EAR) for semiconductors.' });
    return { compliant: issues.length === 0 || issues.every(i => i.level === 'info'), issues };
}

// --- Main Generation Logic ---

async function generateSmartQuotes(payload: any, apiKey: string | undefined, supabase: any, logger: Logger, userToken?: string, userId?: string) {
    if (!apiKey) throw new Error("OpenAI API Key is required for Smart Quotes");

    const { 
        origin, destination, mode, commodity, weight, volume, 
        containerType, containerSize, containerQty,
        dangerousGoods, specialHandling, pickupDate, deliveryDeadline
    } = payload;

    // 1. Check Cache
    const cacheKey = `${origin}|${destination}|${mode}|${commodity}|${weight}|${volume}|${containerQty}`;
    let cached = null;
    try {
        const { data, error } = await supabase
            .from('ai_quote_cache')
            .select('response_payload')
            .eq('request_hash', cacheKey)
            .gt('expires_at', new Date().toISOString())
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
            logger.warn("[AI-Advisor] Cache lookup warning (continuing):", { error: error.message });
        } else if (data) {
            cached = data;
        }
    } catch (err) {
        logger.warn("[AI-Advisor] Cache lookup failed (continuing):", { error: err });
    }

    if (cached) {
        logger.info("[AI-Advisor] Cache Hit");
        return cached.response_payload;
    }

    // 2. Fetch Historical Context
    let historicalContext = "No specific historical rates found for this route.";
    let historicalAvg = 0;
    try {
        const { data: rates } = await supabase
            .from('rates')
            .select('base_price')
            .eq('mode', mode)
            .ilike('origin', `%${origin}%`)
            .ilike('destination', `%${destination}%`)
            .limit(5);

        if (rates && rates.length > 0) {
            const prices = rates.map((r: any) => Number(r.base_price));
            historicalAvg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
            historicalContext = `Internal Historical Data: Found ${rates.length} past rates. Average base price: $${historicalAvg.toFixed(2)}.`;
        }
    } catch (err) {
        logger.warn("Failed to fetch historical data:", { error: err });
    }

    // 3. Construct System Prompt
    const systemPrompt = `
You are an Expert Logistics Rate Analyst and Supply Chain Architect.
Your task is to generate exactly 5 distinct, optimal freight quotation options.

Input:
- Route: ${origin} to ${destination} (${mode})
- Cargo: ${commodity}, ${weight}kg, ${volume}cbm
- Equipment: ${containerQty || 1}x ${containerSize || 'Standard'} ${containerType || ''}
- Context: ${historicalContext}

Requirements:
1. **LANGUAGE: OUTPUT MUST BE IN ENGLISH ONLY.** All descriptions, names, instructions, and analysis must be in English, regardless of the input language.
2. Generate 5 options: "Best Value", "Cheapest", "Fastest", "Greenest", "Reliable".
3. **Advanced Route Segmentation**: 
   - Break down each route into specific legs (Pickup -> Port -> Main Leg -> Port -> Delivery).
   - Identify **Border Crossings** and **Customs Procedures** needed at each transition.
   - Flag **Transport Regulations** (e.g., road weight limits, low emission zones).
4. **Dynamic Charge Simulation (CRITICAL)**:
   - **Leg-Level Pricing**: You MUST calculate and populate charges for **EVERY** leg. Zero-cost legs are NOT allowed (except purely administrative steps).
   - **Mode-Specific Logic**:
     - **Road/Trucking**: Calculate based on distance (~$1.50-$4.00/km) + fixed handling fees.
     - **Air**: Calculate based on chargeable weight (Higher of actual vs vol weight). Range: $2.50-$12.00/kg depending on service.
     - **Ocean**: Use market rates per container (TEU/FEU) or w/m for LCL. Include BAF/CAF.
     - **Rail**: Distance-based rail tariffs.
   - **Granular Breakdown**: Include specific line items (e.g., 'Pickup Haulage', 'Terminal Handling Origin', 'Ocean Freight', 'Delivery Trucking').
   - **Total Accuracy**: The global 'price_breakdown' total MUST equal the sum of all leg charges.

5. **Reliability & Environmental**:
   - Estimate CO2 emissions.
   - Provide a reliability score (1-10) based on carrier reputation.

Output JSON Format:
{
  "options": [
    {
      "id": "generated_uuid",
      "tier": "best_value",
      "transport_mode": "Ocean - FCL",
      "carrier": { "name": "Carrier Name", "service_level": "Direct" },
      "transit_time": { "total_days": 21, "details": "21 days port-to-port" },
      "legs": [
        {
          "sequence": 1,
          "from": "Location A",
          "to": "Location B",
          "mode": "road",
          "carrier": "Local Trucking",
          "transit_time": "1 day",
          "distance_km": 150,
          "co2_kg": 20,
          "border_crossing": false,
          "instructions": "Standard pickup",
          "charges": [
             { "name": "Pickup Haulage", "amount": 450, "currency": "USD", "unit": "per_trip" },
             { "name": "Fuel Surcharge (Road)", "amount": 45, "currency": "USD", "unit": "per_trip" }
          ]
        },
        {
          "sequence": 2,
          "from": "Location B",
          "to": "Location C",
          "mode": "ocean",
          "carrier": "Maersk",
          "transit_time": "18 days",
          "charges": [
             { "name": "Ocean Freight", "amount": 2000, "currency": "USD", "unit": "per_container" },
             { "name": "BAF", "amount": 150, "currency": "USD", "unit": "per_container" }
          ]
        }
      ],
      "price_breakdown": {
        "base_fare": 2000,
        "surcharges": {
            "baf": 150,
            "caf": 50,
            "peak_season": 0,
            "fuel_road": 45
        },
        "fees": {
            "pickup": 450,
            "thc_origin": 200,
            "thc_dest": 200,
            "docs": 50,
            "customs": 120
        },
        "taxes": 0,
        "currency": "USD",
        "total": 3265
      },
      "regulatory_info": {
          "customs_procedures": ["Export Declaration", "Import Clearance"],
          "restrictions": ["Weight limit 20T on road leg"]
      },
      "reliability": { "score": 8.5, "on_time_performance": "92%" },
      "environmental": { "co2_emissions": "1200 kg", "rating": "B" },
      "ai_explanation": "Rationale..."
    }
  ],
  "market_analysis": "Text analysis...",
  "confidence_score": 0.9,
  "anomalies": []
}
`;

    const start = performance.now();
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o", 
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate detailed quotation options." }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        })
    });

    const data = await completion.json();
    if (data.error) throw new Error(data.error.message);

    let aiResponse = JSON.parse(data.choices[0].message.content);

    // 4. Dynamic Charge Calculation Engine (Post-Processing)
    // Simulate "Real-time" fuel surcharges based on current month/market conditions
    aiResponse = applyDynamicPricing(aiResponse);

    // 5. Cache Result
    await supabase.from('ai_quote_cache').insert({
        request_hash: cacheKey,
        response_payload: aiResponse
    });

    const latency = Math.round(performance.now() - start);
    const inputSummary = JSON.stringify({ origin, destination, mode, commodity });
    const { sanitized, redacted } = sanitizeForLLM(inputSummary);
    await logAiCall(supabase, {
      user_id: userId ?? null,
      function_name: "ai-advisor.generate_smart_quotes",
      model_used: "gpt-4o",
      latency_ms: latency,
      pii_detected: redacted.length > 0,
      pii_fields_redacted: redacted,
      output_summary: { options_count: aiResponse.options?.length, confidence: aiResponse.confidence_score }
    });

    return aiResponse;
}

 

function applyDynamicPricing(response: any) {
    const fuelSurchargeRate = 0.12; // Mock 12% global fuel surcharge
    const exchangeRateBuffer = 0.02; // 2% currency buffer

    if (response.options) {
        response.options = response.options.map((opt: any) => {
            const base = opt.price_breakdown.base_fare || 0;
            
            // Adjust surcharges if AI didn't provide them explicitly or to enforce our logic
            if (!opt.price_breakdown.surcharges) opt.price_breakdown.surcharges = {};
            
            // Calculate dynamic values
            const fuelAmt = Math.round(base * fuelSurchargeRate);
            const currencyAmt = Math.round(base * exchangeRateBuffer);

            // Overwrite/Add to Global Breakdown
            opt.price_breakdown.surcharges.fuel_adjustment = fuelAmt;
            opt.price_breakdown.surcharges.currency_adj = currencyAmt;

            // --- INJECT INTO LEGS FOR CONSISTENCY ---
            if (opt.legs && Array.isArray(opt.legs) && opt.legs.length > 0) {
                // Find Main Leg (longest distance or Ocean/Air)
                // Heuristic: Look for leg with same mode as option, or longest distance
                let mainLeg = opt.legs.find((l: any) => opt.transport_mode && l.mode && opt.transport_mode.toLowerCase().includes(l.mode.toLowerCase()));
                if (!mainLeg) mainLeg = opt.legs.reduce((prev: any, current: any) => (prev.distance_km > current.distance_km) ? prev : current);

                if (mainLeg) {
                    if (!mainLeg.charges) mainLeg.charges = [];
                    
                    // Remove existing dynamic charges to avoid duplication if re-running
                    mainLeg.charges = mainLeg.charges.filter((c: any) => c.name !== 'Fuel Adjustment (Dynamic)' && c.name !== 'Currency Adjustment (Dynamic)');

                    // Add new charges
                    if (fuelAmt > 0) {
                        mainLeg.charges.push({ name: 'Fuel Adjustment (Dynamic)', amount: fuelAmt, currency: opt.price_breakdown.currency || 'USD', unit: 'per_shipment' });
                    }
                    if (currencyAmt > 0) {
                        mainLeg.charges.push({ name: 'Currency Adjustment (Dynamic)', amount: currencyAmt, currency: opt.price_breakdown.currency || 'USD', unit: 'per_shipment' });
                    }
                }
            }
            // ----------------------------------------

            // Recalculate Total
            const surcharges = Object.values(opt.price_breakdown.surcharges).reduce((a: any, b: any) => a + b, 0) as number;
            const fees = opt.price_breakdown.fees ? Object.values(opt.price_breakdown.fees).reduce((a: any, b: any) => a + b, 0) as number : 0;
            const taxes = opt.price_breakdown.taxes || 0;
            
            opt.price_breakdown.total = base + surcharges + fees + taxes;
            
            return opt;
        });
    }
    return response;
}
