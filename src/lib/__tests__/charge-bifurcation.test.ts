
import { describe, it, expect } from 'vitest';
import { matchLegForCharge, bifurcateCharges } from '../charge-bifurcation';
import { TransportLeg, Charge } from '@/types/quote-breakdown';

describe('Charge Bifurcation Logic', () => {
    
    // Mock Legs similar to QuoteNew.tsx structure
    const mockLegsMulti: TransportLeg[] = [
        {
            id: 'leg_pickup',
            leg_type: 'pickup',
            mode: 'road',
            origin: 'Factory',
            destination: 'Port A',
            sequence: 1,
            charges: []
        },
        {
            id: 'leg_main',
            leg_type: 'transport',
            mode: 'ocean',
            origin: 'Port A',
            destination: 'Port B',
            sequence: 2,
            charges: []
        },
        {
            id: 'leg_delivery',
            leg_type: 'delivery',
            mode: 'road',
            origin: 'Port B',
            destination: 'Warehouse',
            sequence: 3,
            charges: []
        }
    ];

    const mockLegsSingle: TransportLeg[] = [
        {
            id: 'leg_main',
            leg_type: 'transport',
            mode: 'ocean',
            origin: 'Port A',
            destination: 'Port B',
            sequence: 1,
            charges: []
        }
    ];

    const mockLegsAir: TransportLeg[] = [
        {
            id: 'leg_air_main',
            leg_type: 'transport',
            mode: 'air',
            origin: 'Airport A',
            destination: 'Airport B',
            sequence: 1,
            charges: []
        }
    ];

    describe('matchLegForCharge', () => {
        it('should match pickup charges to pickup leg', () => {
            const leg = matchLegForCharge('Pickup Charge', mockLegsMulti);
            expect(leg?.id).toBe('leg_pickup');
        });

        it('should match delivery charges to delivery leg', () => {
            const leg = matchLegForCharge('Destination Delivery', mockLegsMulti);
            expect(leg?.id).toBe('leg_delivery');
        });

        it('should match freight charges to main/transport leg', () => {
            const leg = matchLegForCharge('Ocean Freight', mockLegsMulti);
            expect(leg?.id).toBe('leg_main');
        });

        it('should match specific mode keywords (Air vs Ocean)', () => {
            // Note: mockLegsMulti has Ocean main leg
            const legOcean = matchLegForCharge('Ocean Freight', mockLegsMulti);
            expect(legOcean?.id).toBe('leg_main');

            // If we had mixed modes, it would pick correct one. 
            // Here 'Air Freight' might default to 'transport' leg if no 'air' mode found, 
            // but let's test with Air legs.
            const legAir = matchLegForCharge('Air Freight', mockLegsAir);
            expect(legAir?.id).toBe('leg_air_main');
        });

        it('should fallback correctly if specific leg type missing', () => {
            // "Pickup" charge but only Single Main Leg exists
            const leg = matchLegForCharge('Pickup Charge', mockLegsSingle);
            // matchLegForCharge looks for 'pickup' legType. If not found, it returns undefined.
            // The caller (QuoteNew) handles fallback to legData[0].
            expect(leg).toBeUndefined();
        });
    });

    describe('bifurcateCharges', () => {
        it('should assign explicit legs if provided', () => {
            const charges: Charge[] = [
                { category: 'General', name: 'Fixed Charge', amount: 100, currency: 'USD', leg_id: 'leg_delivery' }
            ];
            const result = bifurcateCharges(charges, mockLegsMulti);
            expect(result[0].assignedLegId).toBe('leg_delivery');
            expect(result[0].isBifurcated).toBe(false);
        });

        it('should auto-assign based on keywords if no leg_id', () => {
            const charges: Charge[] = [
                { category: 'Pickup', name: 'Drayage Origin', amount: 100, currency: 'USD' },
                { category: 'Freight', name: 'Ocean Freight', amount: 500, currency: 'USD' }
            ];
            const result = bifurcateCharges(charges, mockLegsMulti);
            
            expect(result[0].assignedLegId).toBe('leg_pickup');
            expect(result[0].assignedLegType).toBe('pickup');
            expect(result[0].isBifurcated).toBe(true);

            expect(result[1].assignedLegId).toBe('leg_main');
            expect(result[1].assignedLegType).toBe('transport');
        });

        it('should fallback to main leg if no match found', () => {
             const charges: Charge[] = [
                { category: 'General', name: 'Mystery Fee', amount: 100, currency: 'USD' }
            ];
            const result = bifurcateCharges(charges, mockLegsMulti);
            // Fallback logic in bifurcateCharges defaults to Main Leg
            expect(result[0].assignedLegId).toBe('leg_main');
        });
    });
});
