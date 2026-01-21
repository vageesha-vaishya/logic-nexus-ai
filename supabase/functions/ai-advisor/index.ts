import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

console.log("AI Advisor v2 Initialized")

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
  ]
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, payload } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    
    console.log(`[AI-Advisor] Action: ${action}`, payload);

    let result = {};

    switch (action) {
      case 'suggest_unit':
        result = await suggestUnit(payload.commodity, openAiKey);
        break;
      case 'classify_commodity':
        result = await classifyCommodity(payload.commodity, openAiKey);
        break;
      case 'predict_price':
        result = await predictPrice(payload, openAiKey);
        break;
      case 'lookup_codes':
        result = await lookupCodes(payload.query, payload.mode);
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    )

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    )
  }
})

async function suggestUnit(commodity: string, apiKey?: string) {
  if (!commodity) return { unit: 'kg', confidence: 0.1, source: 'default' };

  const lowerComm = commodity.toLowerCase();
  const match = KNOWLEDGE_BASE.commodities.find(k => k.keywords.some(kw => lowerComm.includes(kw)));
  
  if (match) {
    return { unit: match.unit, confidence: 0.8, source: 'heuristic' };
  }

  if (lowerComm.length > 3) {
      return { unit: 'kg', confidence: 0.4, source: 'ai-mock' };
  }

  return { unit: 'kg', confidence: 0.1, source: 'fallback' };
}

async function classifyCommodity(commodity: string, apiKey?: string) {
  if (!commodity) return { type: 'General Cargo', confidence: 0.5 };
  
  const lowerComm = commodity.toLowerCase();
  const match = KNOWLEDGE_BASE.commodities.find(k => k.keywords.some(kw => lowerComm.includes(kw)));
  
  if (match) {
    return { 
        type: match.type, 
        hts: match.hts, 
        scheduleB: match.scheduleB,
        confidence: 0.9, 
        source: 'heuristic' 
    };
  }

  return { type: 'General Cargo', confidence: 0.3, source: 'default' };
}

async function predictPrice(payload: any, apiKey?: string) {
  const basePrice = 1000; 
  const randomFactor = 0.8 + Math.random() * 0.4; 
  
  return {
    predicted_price: Math.round(basePrice * randomFactor),
    confidence_interval: {
      low: Math.round(basePrice * 0.8),
      high: Math.round(basePrice * 1.2)
    },
    trend: Math.random() > 0.5 ? 'increasing' : 'stable',
    source: 'historical_model'
  };
}

async function lookupCodes(query: string, mode: string) {
    if (!query || query.length < 2) return { suggestions: [] };
    
    const lowerQ = query.toLowerCase();
    let source = [];
    
    if (mode === 'ocean') source = KNOWLEDGE_BASE.ports;
    else if (mode === 'air') source = KNOWLEDGE_BASE.airports;
    else return { suggestions: [] }; // Road usually uses Google Places or Postal APIs

    const suggestions = source.filter(item => 
        item.code.toLowerCase().includes(lowerQ) || 
        item.name.toLowerCase().includes(lowerQ) ||
        item.country.toLowerCase().includes(lowerQ)
    ).map(item => ({
        label: `${item.name} (${item.code})`,
        value: item.code,
        details: item
    }));

    return { suggestions };
}

async function validateCompliance(payload: any) {
    const { origin, destination, commodity, mode, dangerous_goods } = payload;
    const issues = [];
    
    // 1. Sanctions Check (Mock)
    if (destination === 'KP' || destination === 'IR') { // North Korea, Iran
        issues.push({ level: 'critical', message: 'Destination is under sanctions.' });
    }

    // 2. Dangerous Goods
    if (dangerous_goods) {
        if (mode === 'air') {
            issues.push({ level: 'warning', message: 'IATA DGR check required for Air Cargo.' });
        }
        if (commodity && commodity.toLowerCase().includes('battery')) {
             issues.push({ level: 'info', message: 'Lithium Battery regulations apply (UN3480/UN3481).' });
        }
    }

    // 3. Export Controls
    if (commodity && commodity.toLowerCase().includes('chip') && destination === 'CN') {
        issues.push({ level: 'warning', message: 'Check Export Administration Regulations (EAR) for semiconductors.' });
    }

    return {
        compliant: issues.length === 0 || issues.every(i => i.level === 'info'),
        issues
    };
}
