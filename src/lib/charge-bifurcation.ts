
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
 * ORDER MATTERS: Rules are evaluated top-to-bottom.
 */
export const KEYWORD_RULES: BifurcationRule[] = [
    // 1. Specific Charge Types (High Priority) - Override positional keywords
    { keywords: ['thc', 'terminal', 'wharfage', 'baf', 'bunker', 'isf', 'ams', 'imo', 'bl fee', 'doc fee'], legType: 'transport', mode: 'ocean' },
    { keywords: ['air freight', 'fsc', 'fuel surcharge', 'myc', 'screening', 'security'], legType: 'transport', mode: 'air' },
    { keywords: ['rail freight'], legType: 'transport', mode: 'rail' },
    
    // 2. Main Freight Keywords
    { keywords: ['ocean freight', 'sea freight', 'freight', 'base fare', 'base rate', 'basic freight'], legType: 'transport', mode: 'ocean' },
    
    // 3. Positional Keywords (Pickup/Delivery)
    { keywords: ['pickup', 'origin', 'export', 'drayage origin', 'cartage origin', 'pre-carriage'], legType: 'pickup', mode: 'road' },
    { keywords: ['delivery', 'destination', 'import', 'drayage dest', 'cartage dest', 'on-carriage'], legType: 'delivery', mode: 'road' },
    
    // 4. Generic/Fallback Keywords
    { keywords: ['trucking', 'haulage', 'road freight'], legType: 'transport', mode: 'road' },
    { keywords: ['customs', 'duty', 'tax', 'vat'], legType: 'delivery', mode: 'road' }, 
    { keywords: ['admin', 'handling'], legType: 'transport', mode: 'ocean' },
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

        // 3. Fallback for "Transport" legs that are actually Pickup/Delivery by position
        if (!targetLeg && (matchedRule.legType === 'pickup' || matchedRule.legType === 'delivery')) {
            const sortedLegs = [...legs].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
            if (sortedLegs.length > 1) {
                if (matchedRule.legType === 'pickup') {
                    // Check first leg
                    const firstLeg = sortedLegs[0];
                    if (firstLeg && firstLeg.mode === 'road') {
                        targetLeg = firstLeg;
                    }
                } else if (matchedRule.legType === 'delivery') {
                    // Check last leg
                    const lastLeg = sortedLegs[sortedLegs.length - 1];
                    if (lastLeg && lastLeg.mode === 'road') {
                        targetLeg = lastLeg;
                    }
                }
            }
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

        // 3. No Match - Return as Global/Unassigned
        return {
            ...charge,
            assignedMode: 'N/A',
            assignedLegType: 'Global',
            assignedLegId: undefined,
            isBifurcated: false
        };
    });
}
