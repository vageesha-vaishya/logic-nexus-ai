
import { Charge, TransportLeg } from '@/types/quote-breakdown';

export interface BifurcatedCharge extends Charge {
    assignedMode: string;
    assignedLegType: string;
    assignedLegId?: string;
    isBifurcated: boolean; // True if logic was applied, False if it had explicit leg_id
}

type LegType = 'origin' | 'main' | 'destination' | 'pickup' | 'delivery' | 'transport';

interface BifurcationRule {
    keywords: string[];
    legType: LegType;
    mode?: string;
}

/**
 * Rules for mapping charge categories to Leg Types / Modes
 */
const KEYWORD_RULES: BifurcationRule[] = [
    { keywords: ['pickup', 'origin', 'export', 'drayage origin', 'cartage origin', 'pre-carriage'], legType: 'pickup', mode: 'road' },
    { keywords: ['delivery', 'destination', 'import', 'drayage dest', 'cartage dest', 'on-carriage'], legType: 'delivery', mode: 'road' },
    { keywords: ['air', 'aft', 'fsc', 'security', 'screening', 'myc', 'air freight'], legType: 'transport', mode: 'air' },
    { keywords: ['rail', 'train', 'rail freight'], legType: 'transport', mode: 'rail' },
    { keywords: ['trucking', 'haulage', 'road freight'], legType: 'transport', mode: 'road' },
    { keywords: ['freight', 'ocean', 'sea', 'baf', 'fuel', 'bunker', 'imo', 'ams', 'isf', 'base fare', 'base rate', 'basic freight'], legType: 'transport', mode: 'ocean' },
    { keywords: ['customs', 'duty', 'tax', 'vat'], legType: 'delivery', mode: 'road' }, // Default to dest/delivery for customs
    { keywords: ['doc', 'admin', 'handling', 'bl fee'], legType: 'transport', mode: 'ocean' }, // Default to main leg
];

/**
 * Helper to check if two leg types are equivalent (aliases)
 */
const areLegTypesEquivalent = (t1: string = '', t2: string = '') => {
    const norm1 = t1.toLowerCase();
    const norm2 = t2.toLowerCase();
    if (norm1 === norm2) return true;
    
    const aliases = [
        ['origin', 'pickup', 'pre-carriage', 'drayage origin'],
        ['destination', 'delivery', 'on-carriage', 'drayage dest'],
        ['main', 'transport', 'freight']
    ];
    return aliases.some(group => group.includes(norm1) && group.includes(norm2));
};

/**
 * Helper to determine the best leg for a given charge description/category
 */
export function matchLegForCharge(description: string, legs: TransportLeg[]): TransportLeg | undefined {
    const desc = description.toLowerCase();
    
    const matchedRule = KEYWORD_RULES.find(rule => 
        rule.keywords.some(k => desc.includes(k))
    );

    if (matchedRule) {
        // Find leg that matches the rule's legType (and mode if possible)
        let targetLeg = legs.find(l => 
            areLegTypesEquivalent(l.leg_type, matchedRule.legType) && 
            (!matchedRule.mode || l.mode.toLowerCase().includes(matchedRule.mode))
        );

        // Fallback: Find any leg with the matched legType
        if (!targetLeg) {
            targetLeg = legs.find(l => areLegTypesEquivalent(l.leg_type, matchedRule.legType));
        }
        
        return targetLeg;
    }
    return undefined;
}

/**
 * Bifurcates a flat list of charges into Modes and Legs based on rules.
 * If a charge already has a leg_id, it respects it.
 * Otherwise, it attempts to match based on keywords.
 */
export function bifurcateCharges(charges: Charge[], legs: TransportLeg[]): BifurcatedCharge[] {
    // Find Main Leg using robust matching (handles 'Transport', 'Main', 'Freight' aliases)
    const mainLeg = legs.find(l => areLegTypesEquivalent(l.leg_type, 'transport')) || legs[0];
    
    return charges.map(charge => {
        // 1. If explicitly linked to a leg
        if (charge.leg_id) {
            const leg = legs.find(l => String(l.id) === String(charge.leg_id));
            if (leg) {
                return {
                    ...charge,
                    assignedMode: leg.mode,
                    assignedLegType: leg.leg_type || 'transport',
                    assignedLegId: leg.id,
                    isBifurcated: false
                };
            }
        }

        // 2. If not linked, try to match by name/category
        const desc = (charge.name || charge.category || charge.charge_categories?.name || '').toLowerCase();
        const targetLeg = matchLegForCharge(desc, legs);

        if (targetLeg) {
             return {
                ...charge,
                assignedMode: targetLeg.mode,
                assignedLegType: targetLeg.leg_type || 'transport',
                assignedLegId: targetLeg.id,
                isBifurcated: true
            };
        }

        // 3. Fallback to Main Leg (or first leg)
        if (mainLeg) {
             return {
                ...charge,
                assignedMode: mainLeg.mode,
                assignedLegType: mainLeg.leg_type || 'transport',
                assignedLegId: mainLeg.id,
                isBifurcated: true
            };
        }

        // 4. Absolute Fallback
        return {
            ...charge,
            assignedMode: 'Other',
            assignedLegType: 'General',
            isBifurcated: true
        };
    });
}
