import { describe, it, expect } from 'vitest';

// Replicating the logic from UnifiedQuoteComposer.tsx
const groupCharges = (charges: any[]) => {
    const pairs: any[] = [];
    const pendingBuys: any[] = [];
    const pendingSells: any[] = [];
    
    charges.forEach(c => {
        const sideCode = c.side?.code?.toLowerCase() || 'buy';
        if (sideCode === 'buy') pendingBuys.push(c);
        else pendingSells.push(c);
    });

    // Match sells to buys based on category/basis/leg
    pendingSells.forEach(sell => {
        const matchIndex = pendingBuys.findIndex(buy => 
            buy.category_id === sell.category_id && 
            buy.basis_id === sell.basis_id && 
            buy.leg_id === sell.leg_id
        );
        
        if (matchIndex >= 0) {
            const buy = pendingBuys[matchIndex];
            pairs.push({
                id: buy.id, // Use buy ID as primary
                leg_id: buy.leg_id,
                legId: buy.leg_id, // Ensure legId is present
                category_id: buy.category_id,
                basis_id: buy.basis_id,
                currency_id: buy.currency_id,
                buy_rate: buy.rate,
                sell_rate: sell.rate,
            });
            pendingBuys.splice(matchIndex, 1);
        } else {
            // Sell only
            pairs.push({
                id: sell.id,
                leg_id: sell.leg_id,
                legId: sell.leg_id, // Ensure legId is present
                category_id: sell.category_id,
                basis_id: sell.basis_id,
                currency_id: sell.currency_id,
                buy_rate: 0,
                sell_rate: sell.rate,
            });
        }
    });
    
    // Remaining buys
    pendingBuys.forEach(buy => {
        pairs.push({
            id: buy.id,
            leg_id: buy.leg_id,
            legId: buy.leg_id, // Ensure legId is present
            category_id: buy.category_id,
            basis_id: buy.basis_id,
            currency_id: buy.currency_id,
            buy_rate: buy.rate,
            sell_rate: 0,
        });
    });
    
    return pairs;
};

describe('Charge Grouping Logic', () => {
    it('should preserve leg association when grouping charges', () => {
        const mockCharges = [
            {
                id: 'charge-1',
                leg_id: 'leg-123',
                category_id: 'cat-1',
                basis_id: 'basis-1',
                currency_id: 'cur-1',
                side: { code: 'sell' },
                rate: 1000,
            }
        ];

        const grouped = groupCharges(mockCharges);
        
        // Verify legId is present
        expect(grouped).toHaveLength(1);
        expect(grouped[0].legId).toBe('leg-123');
        expect(grouped[0].leg_id).toBe('leg-123');
    });

    it('should correctly distribute charges to leg arrays vs combined', () => {
        const allCharges = [
            { id: 'c1', legId: 'leg-1' },
            { id: 'c2', legId: null }, // combined
            { id: 'c3', leg_id: 'leg-2' }, // legacy field style
        ];

        const chargesByLegId: Record<string, any[]> = {};
        const combinedCharges: any[] = [];

        allCharges.forEach(c => {
            const legKey = c.legId || c.leg_id || 'combined';
            if (legKey === 'combined' || (!c.legId && !c.leg_id)) {
                combinedCharges.push(c);
            } else {
                if (!chargesByLegId[legKey]) chargesByLegId[legKey] = [];
                chargesByLegId[legKey].push(c);
            }
        });

        expect(combinedCharges).toHaveLength(1);
        expect(combinedCharges[0].id).toBe('c2');

        expect(Object.keys(chargesByLegId)).toHaveLength(2);
        expect(chargesByLegId['leg-1']).toHaveLength(1);
        expect(chargesByLegId['leg-2']).toHaveLength(1);
    });
});
