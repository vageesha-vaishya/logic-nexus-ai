
import { mapOptionToQuote } from '../quote-mapper';

// Mock Data representing different source formats

// 1. AI Smart Quote Format (often missing explicit charges array, has price_breakdown)
const aiSmartQuote = {
    id: 'ai-opt-1',
    carrier: 'Maersk',
    name: 'Ocean - FCL',
    price: 1500,
    currency: 'USD',
    transitTime: '25 Days',
    tier: 'best_value',
    source_attribution: 'AI Smart Engine',
    price_breakdown: {
        total: 1500,
        base_fare: 1200,
        taxes: 100,
        surcharges: {
            'Fuel': 150,
            'Peak Season': 50
        },
        fees: {}
    },
    legs: [
        { mode: 'ocean', from: 'Shanghai', to: 'Los Angeles' }
    ]
};

// 2. Standard Quick Quote Format (Legacy Rate Engine)
const standardQuote = {
    id: 'std-opt-1',
    carrier: 'MSC',
    name: 'Standard Ocean',
    price: 1400,
    currency: 'USD',
    transitTime: '30 Days',
    tier: 'standard',
    // No price_breakdown, just total
    legs: [
        { 
            mode: 'ocean', 
            from: 'Shanghai', 
            to: 'Los Angeles',
            charges: [
                { name: 'Ocean Freight', amount: 1300, currency: 'USD' },
                { name: 'Doc Fee', amount: 100, currency: 'USD' }
            ]
        }
    ]
};

// 3. Unbalanced Quote (Total != Sum of Parts) - Needs Balancing Charge
const unbalancedQuote = {
    id: 'unbalanced-1',
    carrier: 'Cosco',
    name: 'Unbalanced Option',
    price: 1000,
    currency: 'USD',
    price_breakdown: {
        total: 1000,
        base_fare: 800,
        taxes: 50
        // Sum = 850. Missing 150.
    }
};

describe('Quote Synchronization Integration Tests', () => {

    test('AI Smart Quote transforms to valid QuoteNew format with synthesized charges', () => {
        const mapped = mapOptionToQuote(aiSmartQuote);

        // 1. Check Top Level Fields
        expect(mapped.total_amount).toBe(1500);
        expect(mapped.carrier).toBe('Maersk');
        expect(mapped.tier).toBe('best_value');

        // 2. Check Charge Synthesis (Critical for ChargeBreakdown)
        // Charges might be distributed to legs or global
        const allCharges = [...(mapped.charges || []), ...(mapped.legs || []).flatMap((l: any) => l.charges || [])];
        expect(allCharges.length).toBeGreaterThan(0);
        
        // Should have Freight, Tax, and 2 Surcharges = 4 items
        const categories = allCharges.map((c: any) => c.category);
        expect(categories).toContain('Freight');
        expect(categories).toContain('Tax');
        expect(categories).toContain('Surcharge');

        // 3. Verify Notes and Units (Added for QuoteNew compatibility)
        const freight = allCharges.find((c: any) => c.category === 'Freight');
        expect(freight.note).toBe('Base Freight');
        expect(freight.unit).toBe('per_shipment');
        expect(freight.amount).toBe(1200);

        const fuel = allCharges.find((c: any) => c.name === 'Fuel');
        expect(fuel.amount).toBe(150);
        expect(fuel.note).toBe('Fuel');
    });

    test('Standard Quote preserves existing leg charges and calculates breakdown', () => {
        const mapped = mapOptionToQuote(standardQuote);

        expect(mapped.total_amount).toBe(1400);
        
        // Should calculate breakdown from leg charges
        expect(mapped.price_breakdown).toBeDefined();
        
        // "Ocean Freight" -> Base Fare (1300)
        // "Doc Fee" -> Fees (100)
        
        expect(mapped.price_breakdown.base_fare).toBe(1300);
        expect(mapped.price_breakdown.fees['Fee']).toBe(100); 
    });

    test('Unbalanced Quote generates correct Balancing Charge', () => {
        const mapped = mapOptionToQuote(unbalancedQuote);

        expect(mapped.total_amount).toBe(1000);
        
        // Sum of explicit parts = 800 + 50 = 850
        // Discrepancy = 150
        
        const allCharges = [...(mapped.charges || []), ...(mapped.legs || []).flatMap((l: any) => l.charges || [])];
        const adjustment = allCharges.find((c: any) => c.category === 'Adjustment');
        
        expect(adjustment).toBeDefined();
        expect(adjustment.name).toBe('Ancillary Fees');
        expect(adjustment.amount).toBe(150);
        expect(adjustment.note).toBe('Unitemized surcharges from Smart Quote');
    });

    test('Output structure is compatible with QuoteNew insertion logic', () => {
        const mapped = mapOptionToQuote(aiSmartQuote);
        
        // QuoteNew expects:
        // rate.charges.forEach...
        // charge.amount, charge.name, charge.unit
        
        const allCharges = [...(mapped.charges || []), ...(mapped.legs || []).flatMap((l: any) => l.charges || [])];
        allCharges.forEach((charge: any) => {
            expect(charge.amount).toBeDefined();
            expect(typeof charge.amount).toBe('number');
            expect(charge.name).toBeDefined();
            expect(charge.unit).toBeDefined(); // Important for QuoteNew
        });
    });

});
