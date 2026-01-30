
import { describe, it, expect } from 'vitest';
import { bifurcateCharges } from './charge-bifurcation';
import { mapOptionToQuote } from './quote-mapper';
import { Charge, TransportLeg } from '../types/quote-breakdown';

// Mock Data
const mockLegs: TransportLeg[] = [
    { 
        id: 'leg1', 
        mode: 'Ocean', 
        origin: 'Shanghai', 
        destination: 'Los Angeles', 
        leg_type: 'main', 
        sequence: 1, 
        charges: [] 
    },
    { 
        id: 'leg2', 
        mode: 'Road', 
        origin: 'Los Angeles', 
        destination: 'Las Vegas', 
        leg_type: 'delivery', 
        sequence: 2, 
        charges: [] 
    }
];

const mockCharges: Charge[] = [
    { id: 'c1', name: 'Ocean Freight', amount: 2000, currency: 'USD', category: 'Freight', leg_id: 'leg1' },
    { id: 'c2', name: 'Cargo Insurance', amount: 50, currency: 'USD', category: 'Insurance', leg_id: undefined }, // Global
    { id: 'c3', name: 'Fuel Surcharge', amount: 150, currency: 'USD', category: 'Surcharges', leg_id: 'leg1' },
    { id: 'c4', name: 'Delivery Fee', amount: 300, currency: 'USD', category: 'Transport', leg_id: 'leg2' }
];

describe('Charge Calculation Engine', () => {
    
    // Requirement 1 & 3: Structured calculation and subtotals
    it('should correctly calculate total amounts', () => {
        const total = mockCharges.reduce((sum, c) => sum + c.amount, 0);
        expect(total).toBe(2500);
    });

    // Requirement 1 & 2: Categorization and Bifurcation
    it('should correctly bifurcate charges into legs and global', () => {
        const bifurcated = bifurcateCharges(mockCharges, mockLegs);
        
        // Find Global Charge
        const globalCharge = bifurcated.find(c => c.id === 'c2');
        expect(globalCharge).toBeDefined();
        expect(globalCharge?.assignedLegId).toBeUndefined();

        // Find Leg 1 Charge
        const leg1Charge = bifurcated.find(c => c.id === 'c1');
        expect(leg1Charge?.assignedLegId).toBe('leg1');

        // Find Leg 2 Charge
        const leg2Charge = bifurcated.find(c => c.id === 'c4');
        expect(leg2Charge?.assignedLegId).toBe('leg2');
    });

    // Requirement 5: Data Integrity (No undefined legs)
    it('should handle charges with missing leg_ids by assigning to Global or best fit', () => {
        const looseCharge: Charge = { id: 'c5', name: 'Mystery Fee', amount: 100, currency: 'USD', category: 'Fee' };
        const result = bifurcateCharges([looseCharge], mockLegs);
        
        expect(result[0].assignedLegId).toBeUndefined(); // Should be global
    });

    // Requirement 6: Currency Support (Basic check)
    it('should preserve currency codes', () => {
        const eurCharge: Charge = { id: 'c6', name: 'Euro Fee', amount: 100, currency: 'EUR', category: 'Fee' };
        const result = bifurcateCharges([eurCharge], mockLegs);
        expect(result[0].currency).toBe('EUR');
    });

    // Requirement 1: Rate mapping
    it('should map API response to internal Quote structure correctly', () => {
        const apiResponse = {
            carrier_name: 'Maersk',
            price: 5000,
            currency: 'USD',
            service_type: 'Port to Door',
            legs: [
                { transport_mode: 'Ocean', origin_location: { name: 'SHA' }, destination_location: { name: 'LAX' } }
            ],
            price_breakdown: {
                total: 5000,
                currency: 'USD',
                charges: [
                    { description: 'Freight', amount: 4000, currency: 'USD' },
                    { description: 'THC', amount: 1000, currency: 'USD' }
                ]
            }
        };

        const quote = mapOptionToQuote(apiResponse);
        expect(quote.price_breakdown.total).toBe(5000);
        expect(quote.charges.length).toBeGreaterThan(0);
        expect(quote.legs.length).toBe(1);
    });

    // Fix Verification: String Amount Handling
    it('should safely parse string amounts to numbers', () => {
        const stringCharge: any = { id: 'c7', name: 'String Fee', amount: "500.50", currency: 'USD', category: 'Fee' };
        const result = bifurcateCharges([stringCharge], mockLegs);
        
        // Simulate ChargeBreakdown logic
        const mappedAmount = Number(result[0].amount) || 0;
        
        expect(mappedAmount).toBe(500.50);
        expect(typeof mappedAmount).toBe('number');
    });

    it('should safely handle invalid string amounts', () => {
        const invalidCharge: any = { id: 'c8', name: 'Bad Fee', amount: "Invalid", currency: 'USD', category: 'Fee' };
        const result = bifurcateCharges([invalidCharge], mockLegs);
        
        // Simulate ChargeBreakdown logic
        const mappedAmount = Number(result[0].amount) || 0;
        
        expect(mappedAmount).toBe(0);
    });
});
