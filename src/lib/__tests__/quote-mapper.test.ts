import { describe, it, expect } from 'vitest';
import { mapOptionToQuote } from '../quote-mapper';

describe('mapOptionToQuote', () => {
    it('returns null if input is null', () => {
        expect(mapOptionToQuote(null)).toBeNull();
    });

    it('returns the option as-is if it is already mapped', () => {
        const mappedOption = {
            id: '1',
            price_breakdown: { total: 100 },
            transit_time: { details: '5 days' },
            charges: [{ amount: 100 }]
        };
        expect(mapOptionToQuote(mappedOption)).toEqual(mappedOption);
    });

    it('calculates price breakdown from leg charges if missing', () => {
        const rawOption = {
            id: '1',
            total_amount: 0, // Should be recalculated
            currency: 'USD',
            legs: [
                {
                    charges: [
                        { amount: 500, name: 'Freight', charge_categories: { name: 'Freight' } },
                        { amount: 50, name: 'Fuel Surcharge', charge_categories: { name: 'Surcharge' } }
                    ]
                }
            ]
        };

        const result = mapOptionToQuote(rawOption);
        expect(result.price_breakdown).toBeDefined();
        expect(result.price_breakdown.base_fare).toBe(500);
        expect(result.price_breakdown.surcharges['Surcharge']).toBe(50);
        expect(result.price_breakdown.total).toBe(550);
    });

    it('synthesizes global charges from price_breakdown if detailed charges are missing', () => {
        // This simulates an AI quote that has a summary but no leg details
        const aiOption = {
            id: 'ai-1',
            total_amount: 1200,
            currency: 'USD',
            price_breakdown: {
                total: 1200,
                base_fare: 1000,
                surcharges: { 'Fuel': 150 },
                fees: { 'Doc': 50 },
                taxes: 0,
                currency: 'USD'
            },
            legs: [ { id: 'leg1', origin: 'A', destination: 'B' } ] // No charges in leg
        };

        const result = mapOptionToQuote(aiOption);
        
        // Verify charges array is populated
        expect(result.charges).toBeDefined();
        expect(result.charges).toHaveLength(3); // Base, Fuel, Doc
        
        const baseCharge = result.charges.find((c: any) => c.category === 'Freight');
        expect(baseCharge).toBeDefined();
        expect(baseCharge.amount).toBe(1000);

        const fuelCharge = result.charges.find((c: any) => c.name === 'Fuel');
        expect(fuelCharge).toBeDefined();
        expect(fuelCharge.amount).toBe(150);
    });

    it('correctly maps Quick Quote RateOption format', () => {
        const quickQuoteOption = {
            id: 'qq-1',
            carrier: 'Maersk',
            name: 'Ocean - FCL',
            price: 2000,
            currency: 'USD',
            transitTime: '25 Days',
            tier: 'fastest',
            legs: []
        };

        const result = mapOptionToQuote(quickQuoteOption);

        expect(result.carrier.name).toBe('Maersk');
        expect(result.transport_mode).toBe('Ocean - FCL');
        expect(result.transit_time.details).toBe('25 Days');
        expect(result.total_amount).toBe(2000);
        expect(result.price_breakdown.total).toBe(2000);
        // It should default all to base_fare if no breakdown provided
        expect(result.price_breakdown.base_fare).toBe(2000);
        
        // And synthesize charges
        expect(result.charges).toHaveLength(1);
        expect(result.charges[0].amount).toBe(2000);
        expect(result.charges[0].category).toBe('Freight');
    });

    it('adds balancing charge if parts do not sum to total', () => {
        const unbalancedOption = {
            id: 'u-1',
            total_amount: 1000,
            currency: 'USD',
            price_breakdown: {
                total: 1000,
                base_fare: 800,
                taxes: 50,
                surcharges: {},
                fees: {}
            },
            legs: []
        };
        // 800 + 50 = 850. Missing 150.

        const result = mapOptionToQuote(unbalancedOption);
        
        expect(result.charges).toBeDefined();
        const adjustment = result.charges.find((c: any) => c.category === 'Adjustment');
        expect(adjustment).toBeDefined();
        expect(adjustment.name).toBe('Ancillary Fees');
        expect(adjustment.amount).toBe(150);
    });
});
