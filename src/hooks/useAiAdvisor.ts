import { useAuth } from '@/hooks/useAuth';
import { invokeFunction } from '@/lib/supabase-functions';
import { logger } from "@/lib/logger";

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

    logger.error("AI Advisor Invocation Error:", error);

    // If it's a 401/403 that couldn't be resolved by refresh, return the error
    // so the UI can show the "Session Expired" message.
    if (error.status === 401 || error.code === 401 || (error.message && /unauthorized|jwt/i.test(error.message))) {
        return { data: null, error };
    }

    // Fallback: If network fails (e.g. "Failed to fetch"), return mock data
    if (action === 'generate_smart_quotes') {
            logger.warn("[AI-Advisor] Network error detected. Returning MOCK data for Smart Quotes.");
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
