
export interface Charge {
    id?: string;
    category: string; // e.g., 'Freight', 'Surcharge', 'Fee', 'Tax'
    name: string;
    amount: number;
    currency: string;
    basis?: string; // e.g., 'per_container', 'per_kg'
    unit?: string;
    quantity?: number;
    rate?: number;
    note?: string;
    rate_reference?: string; // Optional reference ID/code from carrier
    is_modified?: boolean; // For tracking edits
    leg_id?: string; // Optional link to a specific leg
    charge_categories?: { name: string; code: string }; // Optional relation
    mode?: string; // Optional explicit mode
}

export interface TransportLeg {
    id: string;
    mode: 'air' | 'ocean' | 'road' | 'rail' | string;
    leg_type?: 'origin' | 'main' | 'destination' | 'pickup' | 'delivery' | 'transport'; // Bifurcation role
    carrier?: string;
    origin: string;
    destination: string;
    transit_time?: string;
    sequence: number;
    charges: Charge[];
}

export interface RateBreakdown {
    total: number;
    currency: string;
    legs: TransportLeg[];
    global_charges: Charge[]; // Charges not specific to a leg (e.g., Insurance, Admin Fee)
}

// Helper to check if an object is a RateBreakdown
export const isRateBreakdown = (obj: any): obj is RateBreakdown => {
    return obj && Array.isArray(obj.legs) && typeof obj.total === 'number';
};
