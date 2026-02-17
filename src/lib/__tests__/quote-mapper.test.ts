import { describe, it, expect } from 'vitest';
import { mapOptionToQuote } from '../quote-mapper';

describe('mapOptionToQuote', () => {
    it('returns null if input is null', () => {
        expect(mapOptionToQuote(null)).toBeNull();
    });

    it('returns a mapped option while preserving core fields', () => {
        const mappedOption = {
            id: '1',
            price_breakdown: { total: 100 },
            transit_time: { details: '5 days' },
            charges: [{ amount: 100 }]
        };
        const result = mapOptionToQuote(mappedOption);

        expect(result.id).toBe('1');
        expect(result.price_breakdown.total).toBe(100);
        expect(result.transit_time.details).toBe('5 days');
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

    it('synthesizes charges from price_breakdown when leg charges are missing', () => {
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
            legs: [{ id: 'leg1', origin: 'A', destination: 'B' }]
        };

        const result = mapOptionToQuote(aiOption);
        const allCharges = [
            ...(result.charges || []),
            ...((result.legs || []).flatMap((l: any) => l.charges || []))
        ];

        expect(allCharges.length).toBeGreaterThan(0);
        const baseCharge = allCharges.find((c: any) => c.category === 'Freight');
        expect(baseCharge).toBeDefined();
        expect(baseCharge.amount).toBe(1000);
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

        expect(result.carrier).toBe('Maersk');
        expect(result.mode).toBe('ocean');
        expect(result.transport_mode).toBe('Ocean - FCL');
        expect(result.raw_transport_mode).toBe('Ocean - FCL');
        expect(result.transit_time.details).toBe('25 Days');
        expect(result.total_amount).toBe(2000);
        expect(result.price_breakdown.total).toBe(2000);
        // It should default all to base_fare if no breakdown provided
        expect(result.price_breakdown.base_fare).toBe(2000);
        
        // And synthesize charges in leg
        expect(result.legs[0].charges).toHaveLength(1);
        expect(result.legs[0].charges[0].amount).toBe(2000);
        expect(result.legs[0].charges[0].category).toBe('Freight');
    });

    it('does not use option name as transport mode when name is not a mode', () => {
        const option = {
            id: 'opt-best-value',
            carrier: 'Test Line',
            name: 'Best Value',
            price: 1000,
            currency: 'USD',
            legs: []
        };

        const result = mapOptionToQuote(option);

        expect(result.mode).toBe('ocean');
        expect(result.transport_mode).toBe('Best Value');
        expect(result.raw_transport_mode).toBe('Best Value');
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
        const adjustment = result.charges.find((c: any) => c.category === 'Adjustment');
        expect(adjustment).toBeDefined();
        expect(adjustment.name).toBe('Ancillary Fees');
        expect(adjustment.amount).toBe(150);
    });

    it('adds balancing charge for small floating point discrepancies > 0.01', () => {
        const floatOption = {
            id: 'f-1',
            total_amount: 100.50,
            currency: 'USD',
            price_breakdown: {
                total: 100.50,
                base_fare: 50.00,
                taxes: 50.00,
                surcharges: {},
                fees: {}
            },
            legs: []
        };
        // 50 + 50 = 100. Missing 0.50.
        // Old logic (> 1) would ignore this. New logic (> 0.01) should catch it.

        const result = mapOptionToQuote(floatOption);
        const adjustment = result.charges.find((c: any) => c.category === 'Adjustment');
        expect(adjustment).toBeDefined();
        expect(adjustment.amount).toBe(0.50);
    });

    it('normalizes rail mode from descriptive name', () => {
        const option = {
            id: 'rail-1',
            carrier: 'Rail Line',
            name: 'Rail Service',
            price: 1500,
            currency: 'USD',
            legs: []
        };

        const result = mapOptionToQuote(option);

        expect(result.mode).toBe('rail');
        expect(result.transport_mode).toBe('Rail Service');
        expect(result.raw_transport_mode).toBe('Rail Service');
    });

    it('normalizes road mode from trucking keywords', () => {
        const option = {
            id: 'road-1',
            carrier: 'Truck Co',
            name: 'Premium Trucking',
            price: 800,
            currency: 'USD',
            legs: []
        };

        const result = mapOptionToQuote(option);

        expect(result.mode).toBe('road');
        expect(result.transport_mode).toBe('Premium Trucking');
        expect(result.raw_transport_mode).toBe('Premium Trucking');
    });
});
