
import { describe, it, expect } from 'vitest';
import { mapOptionToQuote } from '../quote-mapper';

// Mock Data Structures

// 1. Raw API Response from Smart Quote (AI Advisor)
const smartQuoteApiResponse = {
    carrier_name: "AI Carrier",
    source_attribution: "AI Smart Engine",
    total_amount: 5000,
    currency: "USD",
    mode: "ocean",
    transit_time: { details: "25 days" },
    price_breakdown: {
        base_fare: 4000,
        surcharges: {
            "Bunker Adjustment": 500,
            "Peak Season": 300
        },
        fees: {
            "Doc Fee": 200
        },
        taxes: 0,
        total: 5000
    },
    // AI quotes often don't have a 'charges' array initially
    // charges: [] - Removed to ensure mapper runs (avoid idempotency check)
};

// 2. Saved DB Record (after QuoteNew.tsx processes it)
// This simulates what we get when querying quotation_version_options with joined legs and charges
const savedDbRecord = {
    id: "db-opt-1",
    carrier_name: "AI Carrier",
    source_attribution: "AI Smart Engine",
    total_amount: 5000,
    currency: "USD",
    mode: "ocean",
    transit_time: { details: "25 days" },
    legs: [
        {
            id: "leg-1",
            mode: "ocean",
            charges: [
                {
                    category: "Freight", // Note: mapped from 'base_fare' -> 'FREIGHT' -> category name
                    name: "Base Freight",
                    amount: 4000,
                    currency: "USD",
                    unit: "per_shipment"
                },
                {
                    category: "Surcharge",
                    name: "Bunker Adjustment",
                    amount: 500,
                    currency: "USD",
                    unit: "per_shipment"
                },
                {
                    category: "Surcharge",
                    name: "Peak Season",
                    amount: 300,
                    currency: "USD",
                    unit: "per_shipment"
                },
                {
                    category: "Fee",
                    name: "Doc Fee",
                    amount: 200,
                    currency: "USD",
                    unit: "per_shipment"
                }
            ]
        }
    ],
    // The top-level 'charges' array might be empty or synthesized by the mapper
    charges: [] 
};

describe('Data Flow Integration Test', () => {

    it('consistently maps AI Smart Quote API response for Preview', () => {
        const mapped = mapOptionToQuote(smartQuoteApiResponse);
        
        // 1. Check Identity & Metadata
        expect(mapped.carrier_name).toBe("AI Carrier");
        expect(mapped.ai_generated).toBe(true);
        expect(mapped.total_amount).toBe(5000);

        // 2. Check Charge Synthesis
        // The API response had no 'charges' array, so mapper should synthesize it from price_breakdown
        // And because it had no legs, it should create a synthetic leg
        expect(mapped.legs).toHaveLength(1);
        const charges = mapped.legs[0].charges;
        expect(charges).toHaveLength(4); // Base + Bunker + Peak + Doc
        
        const baseCharge = charges.find((c: any) => c.name === "Base Freight");
        expect(baseCharge).toBeDefined();
        expect(baseCharge.amount).toBe(4000);
        expect(baseCharge.category).toBe("Freight");
        
        const bunkerCharge = charges.find((c: any) => c.name === "Bunker Adjustment");
        expect(bunkerCharge).toBeDefined();
        expect(bunkerCharge.amount).toBe(500);
        
        // 3. Check Balancing
        // Total is 5000. Sum of charges is 4000+500+300+200 = 5000. No discrepancy.
        const totalCharges = charges.reduce((sum: number, c: any) => sum + c.amount, 0);
        expect(totalCharges).toBe(5000);
    });

    it('consistently maps Saved DB Record for View', () => {
        const mapped = mapOptionToQuote(savedDbRecord);

        // 1. Check Identity
        expect(mapped.carrier_name).toBe("AI Carrier");
        expect(mapped.ai_generated).toBe(true);
        
        // 2. Check Charge Handling
        // For DB records, we expect 'charges' to be populated from 'legs.charges' or kept as is
        // The mapper calculates price_breakdown from leg charges if missing
        
        expect(mapped.price_breakdown).toBeDefined();
        expect(mapped.price_breakdown.total).toBe(5000);
        
        // The mapper should NOT synthesize top-level charges if leg charges exist
        // But for ChargeBreakdown component compatibility, we might want it to expose a unified view?
        // Actually, ChargeBreakdown handles legs separately.
        // Let's verify that mapOptionToQuote preserves the leg structure
        expect(mapped.legs).toHaveLength(1);
        expect(mapped.legs[0].charges).toHaveLength(4);
    });

    it('handles balancing charge when API response has discrepancy', () => {
        const discrepantQuote = {
            ...smartQuoteApiResponse,
            total_amount: 5100, // $100 more than components
            price_breakdown: {
                ...smartQuoteApiResponse.price_breakdown,
                total: 5100
            }
        };
        
        const mapped = mapOptionToQuote(discrepantQuote);
        
        // Mapper assigns category "Adjustment" for balancing charges
        // It will be in the synthetic leg
        const charges = mapped.legs[0].charges;
        const ancillary = charges.find((c: any) => c.category === "Adjustment");
        expect(ancillary).toBeDefined();
        expect(ancillary.amount).toBe(100);
        // Name should be 'Ancillary Fees' for positive discrepancy
        expect(ancillary.name).toBe('Ancillary Fees');
        
        const totalCharges = charges.reduce((sum: number, c: any) => sum + c.amount, 0);
        expect(totalCharges).toBe(5100);
    });
    
    it('normalizes RateOption keys from Quick Quote API', () => {
        const quickQuoteRate = {
            carrier: "MSC", // instead of carrier_name
            name: "Standard Service", // instead of option_name
            price: 1200, // instead of total_amount
            currency: "EUR",
            transport_mode: "ocean",
            transitTime: "12 days", // string instead of object
            charges: [
                { description: "Ocean Freight", amount: 1000, currency: "EUR" },
                { description: "THC", amount: 200, currency: "EUR" }
            ]
        };
        
        const mapped = mapOptionToQuote(quickQuoteRate);
        
        expect(mapped.carrier_name).toBe("MSC");
        expect(mapped.option_name).toBe("Standard Service");
        expect(mapped.total_amount).toBe(1200);
        expect(mapped.transit_time.details).toBe("12 days");
        // charges moved to leg
        expect(mapped.legs).toHaveLength(1);
        expect(mapped.legs[0].charges).toHaveLength(2);
        expect(mapped.price_breakdown.total).toBe(1200);
    });

});
