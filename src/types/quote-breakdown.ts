
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
    carrier_id?: string;
    voyage?: string; // Vessel/Voyage or Flight No
    origin: string;
    destination: string;
    departure_date?: string; // ISO Date
    arrival_date?: string; // ISO Date
    transit_time?: string;
    service_type?: string; // Standard, Express, Saver
    sequence?: number; // Order in route
    charges?: Charge[];
}

export interface RateBreakdown {
    total: number;
    currency: string;
    legs: TransportLeg[];
    global_charges: Charge[]; // Charges not specific to a leg (e.g., Insurance, Admin Fee)
}

export interface RateOption {
    id: string;
    carrier: string;
    name: string;
    price: number;
    total_amount?: number; // Alias for price/total for compatibility
    currency: string;
    transitTime: string;
    tier: 'contract' | 'spot' | 'market' | 'best_value' | 'cheapest' | 'fastest' | 'greenest' | 'reliable' | string;
    legs?: TransportLeg[]; // More specific type than any[]
    price_breakdown?: any;
    reliability?: { score: number; on_time_performance: string };
    environmental?: { co2_emissions: string; rating: string };
    source_attribution?: string;
    ai_explanation?: string;
    transport_mode?: string;
    co2_kg?: number;
    route_type?: 'Direct' | 'Transshipment';
    stops?: number;
    ai_generated?: boolean;
    // Financials
    buyPrice?: number;
    marginAmount?: number;
    markupPercent?: number;
    // Additional fields for compatibility
    charges?: Charge[];
    service_type?: string;
    validUntil?: string | null;
    verified?: boolean;
    verificationTimestamp?: string;
    is_manual?: boolean; // Indicates if this option was manually created
    rank_score?: number;
    rank_details?: Record<string, number>;
    is_recommended?: boolean;
    recommendation_reason?: string;
    regulatory_info?: {
        customs_procedures?: string[];
        restrictions?: string[];
    };
}

// Helper to check if an object is a RateBreakdown
export const isRateBreakdown = (obj: any): obj is RateBreakdown => {
    return obj && Array.isArray(obj.legs) && typeof obj.total === 'number';
};
