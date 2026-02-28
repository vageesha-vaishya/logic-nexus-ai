
import { createClient } from '@supabase/supabase-js';
import { QuoteOptionService } from '../src/services/QuoteOptionService';
import { LogisticsRateMapper } from '../src/plugins/logistics/services/LogisticsRateMapper';
import { KEYWORD_RULES } from '../src/lib/charge-bifurcation';

// Mock Dependencies
const mockSupabase = {
    from: (table: string) => {
        return {
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                    single: async () => ({ data: { id: 'mock-id' }, error: null }),
                    order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) })
                }),
                single: async () => ({ data: { id: 'mock-id' }, error: null }),
                maybeSingle: async () => ({ data: null, error: null })
            }),
            insert: (data: any) => {
                console.log(`[MockDB] Insert into ${table}:`, JSON.stringify(data, null, 2));
                
                if (table === 'quotation_version_options') {
                    const mockOption = { id: 'mock-option-id', ...data };
                    return { 
                        select: () => ({ 
                            single: async () => ({ data: mockOption, error: null }),
                            then: (resolve: any) => resolve({ data: [mockOption], error: null })
                        }) 
                    };
                }
                
                if (table === 'quotation_version_option_legs') {
                    // Return mock legs with IDs
                    const legs = Array.isArray(data) ? data : [data];
                    const legsWithIds = legs.map((l, i) => ({
                        ...l,
                        id: `mock-leg-${i}`,
                        mode_id: l.mode_id,
                        leg_type: l.leg_type,
                        sort_order: l.sort_order,
                        service_type_id: l.service_type_id,
                        mode: l.mode // Important: Return mode for charge matching
                    }));
                    
                    return { 
                        select: () => ({ 
                            // When await .select() is called, it behaves like a promise resolving to { data: ... }
                            then: (resolve: any) => resolve({ data: legsWithIds, error: null }),
                            single: async () => ({ data: legsWithIds[0], error: null })
                        }) 
                    };
                }
                
                // Default fallback
                 return { 
                    select: () => ({ 
                        then: (resolve: any) => resolve({ data: null, error: null }),
                        single: async () => ({ data: null, error: null })
                    }) 
                };
            },
            update: () => ({
                eq: async () => ({ data: null, error: null })
            })
        };
    },
    auth: {
        getUser: async () => ({ data: { user: { user_metadata: { tenant_id: 'mock-tenant' } } } })
    }
} as any;

// Mock Master Data
const mockMasterData = {
    serviceModes: [
        { id: 'mode-ocean', code: 'ocean', name: 'Ocean' },
        { id: 'mode-air', code: 'air', name: 'Air' },
        { id: 'mode-road', code: 'road', name: 'Road' }
    ],
    serviceTypes: [
        { id: 'st-fcl', code: 'FCL', name: 'Full Container Load', transport_modes: { code: 'ocean' } },
        { id: 'st-air-std', code: 'Standard', name: 'Standard Air', transport_modes: { code: 'air' } }
    ],
    currencies: [{ id: 'curr-usd', code: 'USD' }],
    categories: [{ id: 'cat-freight', code: 'FREIGHT', name: 'Freight' }, { id: 'cat-fuel', code: 'FSC', name: 'Fuel Surcharge' }],
    bases: [{ id: 'basis-cont', code: 'per_container', name: 'Per Container' }],
    carriers: [{ id: 'carr-dhl', carrier_name: 'DHL' }],
    sides: [{ id: 'side-buy', code: 'buy' }, { id: 'side-sell', code: 'sell' }]
};

// Mock Rate Mapper
const rateMapper = new LogisticsRateMapper(mockMasterData);

// Test Data: Smart Quote Payload (AI Generated)
const smartQuotePayload = {
    carrier: "DHL Express",
    total_amount: 3000,
    currency: "USD",
    transitTime: "5 Days",
    service_type: "Standard",
    legs: [
        { mode: "road", from: "NYC", to: "JFK", transit_time: 1 },
        { mode: "air", from: "JFK", to: "LHR", transit_time: 3 },
        { mode: "road", from: "LHR", to: "LON", transit_time: 1 }
    ],
    charges: [
        { description: "Pickup", amount: 200, currency: "USD" },
        { description: "Air Freight", amount: 2500, currency: "USD" },
        { description: "Fuel Surcharge", amount: 300, currency: "USD" } // Should map to Air leg
    ],
    // AI Fields
    confidence_score: 0.95,
    market_analysis: "High demand season",
    ai_generated: true
};

async function runTests() {
    console.log("🚀 Starting End-to-End Data Flow Verification...");

    const service = new QuoteOptionService(mockSupabase);

    // Scenario 1: Quick Quote Transfer (Simulated from QuoteNew.tsx)
    console.log("\n--- Scenario 1: Quick Quote Transfer ---");
    try {
        const quickQuoteRate = {
            carrier: "Maersk",
            price: 1500,
            currency: "USD",
            transitTime: "20 Days",
            source_attribution: "quick_quote",
            legs: [{ mode: "ocean", from: "CNSHA", to: "USLAX", transit_time: 20 }],
            charges: [{ description: "Ocean Freight", amount: 1500, currency: "USD" }]
        };

        const optId = await service.addOptionToVersion({
            tenantId: "mock-tenant",
            versionId: "mock-version-qq",
            rate: quickQuoteRate,
            rateMapper: rateMapper,
            source: "quick_quote"
        });
        console.log("✅ Quick Quote Option Created:", optId);
    } catch (e) {
        console.error("❌ Quick Quote Failed:", e);
    }

    // Scenario 2: Smart Quote Generation
    console.log("\n--- Scenario 2: Smart Quote Generation ---");
    try {
        const smartRate = {
            ...smartQuotePayload,
            source_attribution: "smart_quote"
        };
        const optId = await service.addOptionToVersion({
            tenantId: "mock-tenant",
            versionId: "mock-version-sq",
            rate: smartRate,
            rateMapper: rateMapper,
            source: "smart_quote"
        });
        console.log("✅ Smart Quote Option Created:", optId);
    } catch (e) {
        console.error("❌ Smart Quote Failed:", e);
    }

    // Scenario 3: AI Generated Quote
    console.log("\n--- Scenario 3: AI Generated Quote ---");
    try {
        const aiRate = {
            carrier: "AI Logistics",
            price: 2800,
            currency: "USD",
            transitTime: "4 Days",
            source_attribution: "ai_generated",
            ai_explanation: "Optimized for speed/cost balance",
            reliability_score: 0.88,
            ai_generated: true,
            legs: [{ mode: "air", from: "SFO", to: "NRT", transit_time: 10 }],
            charges: [{ description: "All In", amount: 2800, currency: "USD" }]
        };
        const optId = await service.addOptionToVersion({
            tenantId: "mock-tenant",
            versionId: "mock-version-ai",
            rate: aiRate,
            rateMapper: rateMapper,
            source: "ai_generated"
        });
        console.log("✅ AI Quote Option Created:", optId);
    } catch (e) {
        console.error("❌ AI Quote Failed:", e);
    }

    // Scenario 4: Manual Quote (Create Detailed Quote)
    console.log("\n--- Scenario 4: Manual Quote ---");
    try {
        const manualRate = {
            carrier_name: "Manual Carrier",
            total_amount: 1000,
            currency: "USD",
            source_attribution: "manual",
            legs: [{ mode: "road", from: "A", to: "B", transit_time: 1 }],
            charges: [{ description: "Trucking", amount: 1000, currency: "USD" }]
        };
        const optId = await service.addOptionToVersion({
            tenantId: "mock-tenant",
            versionId: "mock-version-manual",
            rate: manualRate,
            rateMapper: rateMapper,
            source: "manual"
        });
        console.log("✅ Manual Option Created:", optId);
    } catch (e) {
        console.error("❌ Manual Quote Failed:", e);
    }
}

runTests();
