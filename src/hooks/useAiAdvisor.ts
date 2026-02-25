import { useAuth } from '@/hooks/useAuth';
import { invokeFunction } from '@/lib/supabase-functions';

export interface AiAdvisorResponse<T = any> {
  data: T | null;
  error: any | null;
}

export interface AiAdvisorOptions {
  action: string;
  payload: any;
}

export function useAiAdvisor() {
  const { session } = useAuth();

  const invokeAiAdvisor = async <T = any>({ action, payload }: AiAdvisorOptions): Promise<AiAdvisorResponse<T>> => {
    
    // Try using the robust invokeFunction utility first
    // This handles session refreshing, circuit breaking, and correct URL construction
    const { data, error } = await invokeFunction<T>('ai-advisor', {
        body: { action, payload }
    });

    if (!error) {
        return { data, error: null };
    }

    console.error("AI Advisor Invocation Error:", error);

    // If it's a 401/403 that couldn't be resolved by refresh, return the error
    // so the UI can show the "Session Expired" message.
    if (error.status === 401 || error.code === 401 || (error.message && /unauthorized|jwt/i.test(error.message))) {
        return { data: null, error };
    }

    // Fallback 1: Try Client-Side OpenAI Call if Supabase fails (and it's not an auth error)
    try {
        const clientSideKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (action === 'generate_smart_quotes' && clientSideKey && clientSideKey.startsWith('sk-')) {
            console.warn("[AI-Advisor] Network error or Supabase unreachable. Attempting Client-Side OpenAI Call...");
            
                 const { origin, destination, mode, commodity, weight, volume, containerQty, containerSize, containerType } = payload;
                 
                 const systemPrompt = `
You are an Expert Logistics Rate Analyst. Generate 5 distinct freight quotation options.
Input: ${origin} to ${destination} (${mode}). Cargo: ${commodity}, ${weight}kg, ${volume}cbm. Equipment: ${containerQty || 1}x ${containerSize || 'Standard'} ${containerType || ''}.

Requirements:
1. Output JSON ONLY.
2. Generate 5 options: "Best Value", "Cheapest", "Fastest", "Greenest", "Reliable".
3. Calculate realistic charges for every leg (Pickup -> Main -> Delivery).
4. Mode Logic:
   - Road: ~$1.5-4/km
   - Air: ~$2.5-12/kg
   - Ocean: Market rates per TEU/FEU
5. JSON Format:
{
  "options": [
    {
      "id": "uuid",
      "tier": "best_value",
      "transport_mode": "Ocean - FCL",
      "carrier": { "name": "Name", "service_level": "Direct" },
      "transit_time": { "total_days": 20, "details": "description" },
      "legs": [{ "sequence": 1, "type": "pickup", "from": "A", "to": "B", "mode": "truck", "carrier": "Name" }, ...],
      "price_breakdown": { "freight": 1000, "surcharges": 100, "total": 1100, "currency": "USD" },
      "total_amount": 1100,
      "currency": "USD",
      "ai_explanation": "reasoning",
      "co2_emissions": { "value": 100, "unit": "kg" },
      "reliability_score": 9
    }
  ],
  "market_analysis": "summary",
  "confidence_score": 0.8,
  "anomalies": []
}`;

                 const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${clientSideKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: "Generate quotes now." }
                        ],
                        response_format: { type: "json_object" }
                    })
                 });

                 if (response.ok) {
                     const json = await response.json();
                     const content = JSON.parse(json.choices[0].message.content);
                     // Add a flag to indicate this was client-side generated
                     content.market_analysis = "[Client-Side AI Bypass] " + (content.market_analysis || "");
                     return { data: content, error: null };
                 } else {
                     console.error("Client-Side OpenAI Failed:", await response.text());
                 }
        }
    } catch (clientErr) {
        console.error("Client-Side OpenAI Error:", clientErr);
    }

    // Fallback 2: If network fails (e.g. "Failed to fetch") AND Client AI fails, return mock data
    if (action === 'generate_smart_quotes') {
            console.warn("[AI-Advisor] Network error detected. Returning MOCK data for Smart Quotes.");
            const mockData = {
                options: [
                    {
                        id: 'mock-opt-1',
                        tier: 'best_value',
                        transport_mode: payload.mode === 'air' ? 'Air Freight' : 'Ocean - FCL',
                        carrier: { name: 'Maersk (Mock)', service_level: 'Direct', id: 'c-maersk' },
                        transit_time: { total_days: 25, details: '25 days port-to-port' },
                        legs: [
                            { sequence: 1, type: 'pickup', from: payload.origin, to: 'Port of Loading', mode: 'truck', carrier: 'Local Haulage' },
                            { sequence: 2, type: 'main', from: 'Port of Loading', to: 'Port of Discharge', mode: 'ocean', carrier: 'Maersk' },
                            { sequence: 3, type: 'delivery', from: 'Port of Discharge', to: payload.destination, mode: 'truck', carrier: 'Local Haulage' }
                        ],
                        price_breakdown: { 
                            freight: 4500, 
                            surcharges: 350, 
                            total: 4850, 
                            currency: 'USD' 
                        },
                        total_amount: 4850,
                        currency: 'USD',
                        ai_explanation: 'This is a MOCK quote generated because the AI service is unreachable.'
                    },
                    {
                    id: 'mock-opt-2',
                    tier: 'fastest',
                    transport_mode: 'Air Freight',
                    carrier: { name: 'Emirates (Mock)', service_level: 'Express', id: 'c-emirates' },
                    transit_time: { total_days: 5, details: '5 days airport-to-airport' },
                    legs: [],
                    price_breakdown: { freight: 12000, surcharges: 500, total: 12500, currency: 'USD' },
                    total_amount: 12500,
                    currency: 'USD',
                    ai_explanation: 'Mock expedited option.'
                }
                ],
                market_analysis: "⚠️ AI Service Unreachable. Displaying mock market analysis for testing. The system detected a network error when contacting the AI Advisor.",
                confidence_score: 0.1,
                anomalies: []
            };
            return { data: mockData as any, error: null };
    }

    return { data: null, error };
  };

  return { invokeAiAdvisor };
}
