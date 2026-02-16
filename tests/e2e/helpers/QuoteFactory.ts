
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseHelper } from './SupabaseHelper';

export interface QuoteParams {
    originPortId?: string;
    destPortId?: string;
    accountId?: string;
    tenantId: string;
}

export interface OptionParams {
    carrierName: string;
    transitDays: number;
    containerSizeCode: string; // e.g., '20GP'
    charges: {
        name: string;
        amount: number;
        currency?: string;
        legIndex?: number; // 0 for first leg, 1 for second...
        side?: 'Buy' | 'Sell';
    }[];
    legs: {
        mode: 'ocean' | 'road' | 'air';
        originId: string;
        destId: string;
    }[];
}

export class QuoteFactory {
    private supabase: SupabaseClient;
    private tenantId: string = '';
    
    // Cache for metadata
    private containerSizes: Record<string, string> = {};
    private chargeCategories: Record<string, string> = {};
    private currencies: Record<string, string> = {};
    private chargeBases: Record<string, string> = {};
    private chargeSides: Record<string, string> = {};

    constructor() {
        this.supabase = SupabaseHelper.getClient();
    }

    async init(tenantId?: string) {
        if (tenantId) {
            this.tenantId = tenantId;
        } else {
            const { data } = await this.supabase.from('tenants').select('id').limit(1).single();
            this.tenantId = data?.id || '';
        }
        await this.loadMetadata();
    }

    private async loadMetadata() {
        // Container Sizes
        const { data: sizes, error } = await this.supabase.from('container_sizes').select('id, code');
        if (error) console.error('Error loading container_sizes:', error);
        
        sizes?.forEach(s => this.containerSizes[s.code] = s.id);
        // Add mappings for standard names if needed
        if (this.containerSizes['20_std']) this.containerSizes['20GP'] = this.containerSizes['20_std'];
        if (this.containerSizes['40_std']) this.containerSizes['40GP'] = this.containerSizes['40_std'];
        
        if (this.containerSizes['20GP']) this.containerSizes['standard_20'] = this.containerSizes['20GP'];
        if (this.containerSizes['40GP']) this.containerSizes['standard_40'] = this.containerSizes['40GP'];

        // Currencies
        const { data: curs } = await this.supabase.from('currencies').select('id, code');
        curs?.forEach(c => this.currencies[c.code] = c.id);

        // Bases
        const { data: bases } = await this.supabase.from('charge_bases').select('id, code');
        bases?.forEach(b => this.chargeBases[b.code] = b.id);
        
        // Sides
        const { data: sides } = await this.supabase.from('charge_sides').select('id, code');
        sides?.forEach(s => this.chargeSides[s.code] = s.id);
        
        // Categories (Simplified mapping)
        // In a real app, we might need robust lookup. Here we just pick one generic one if not found.
        const { data: cats } = await this.supabase.from('charge_categories').select('id, name, code').limit(50);
        cats?.forEach(c => this.chargeCategories[c.code || c.name] = c.id);
        // Fallback generic
        this.chargeCategories['generic'] = cats?.[0]?.id || '';
    }

    async createQuote(params: QuoteParams) {
        const { data, error } = await this.supabase
            .from('quotes')
            .insert({
                status: 'draft',
                quote_number: `TEST-${Date.now()}`,
                title: 'E2E Test Quote',
                account_id: params.accountId,
                origin_port_id: params.originPortId,
                destination_port_id: params.destPortId,
                tenant_id: this.tenantId
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    async addQuoteItem(quoteId: string, sizeCode: string, quantity: number = 1, lineNumber: number = 1) {
        const sizeId = this.containerSizes[sizeCode] || this.containerSizes['standard_20'];
        if (!sizeId) throw new Error(`Container size ${sizeCode} not found`);

        const { error } = await this.supabase.from('quote_items').insert({
            quote_id: quoteId,
            container_size_id: sizeId,
            quantity,
            weight_kg: 10000,
            tenant_id: this.tenantId,
            description: `Test Cargo ${sizeCode}`,
            line_number: lineNumber,
            product_name: `Product ${sizeCode}`,
            unit_price: 1000,
            line_total: quantity * 1000
        });
        if (error) throw error;
    }

    async createVersion(quoteId: string) {
        const { data, error } = await this.supabase.from('quotation_versions').insert({
            quote_id: quoteId,
            version_number: 1,
            status: 'draft',
            tenant_id: this.tenantId
        }).select().single();
        if (error) throw error;
        return data;
    }

    async addOption(versionId: string, params: OptionParams) {
        // 1. Get/Create Carrier
        const carrierId = await this.getCarrierId(params.carrierName);

        // 2. Create Option
        const sizeId = this.containerSizes[params.containerSizeCode] || this.containerSizes['standard_20'];
        const { data: option, error: optError } = await this.supabase.from('quotation_version_options').insert({
            quotation_version_id: versionId,
            carrier_id: carrierId,
            container_size_id: sizeId,
            is_selected: true,
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            transit_days: params.transitDays,
            tenant_id: this.tenantId
        }).select().single();
        if (optError) throw optError;

        // 3. Create Legs
        const legIds: string[] = [];
        let order = 1;
        for (const leg of params.legs) {
            const { data: legData, error: legError } = await this.supabase.from('quotation_version_option_legs').insert({
                quotation_version_option_id: option.id,
                mode: leg.mode,
                sort_order: order++,
                origin_location_id: leg.originId,
                destination_location_id: leg.destId,
                tenant_id: this.tenantId
            }).select().single();
            if (legError) throw legError;
            legIds.push(legData.id);
        }

        // 4. Create Charges
        const chargeInserts = params.charges.map(chg => {
            const legId = chg.legIndex !== undefined ? legIds[chg.legIndex] : legIds[legIds.length - 1]; // Default to last leg if not specified
            const basisId = this.getBasisId(chg.name); 
            
            return {
                quote_option_id: option.id,
                leg_id: legId,
                category_id: this.getCategoryId(chg.name),
                amount: chg.amount,
                rate: chg.amount,
                quantity: 1,
                currency_id: this.currencies[chg.currency || 'USD'] || this.currencies['USD'],
                basis_id: basisId,
                charge_side_id: this.chargeSides[chg.side?.toLowerCase() || 'sell'] || this.chargeSides['Sell'],
                tenant_id: this.tenantId,
                note: chg.name,
                sort_order: 1
            };
        });

        if (chargeInserts.length > 0) {
            const { error: chgError } = await this.supabase.from('quote_charges').insert(chargeInserts);
            if (chgError) throw chgError;
        }

        return option;
    }

    private async getCarrierId(name: string): Promise<string> {
        const { data } = await this.supabase.from('carriers').select('id').ilike('carrier_name', name).maybeSingle();
        if (data) return data.id;

        const { data: newC } = await this.supabase.from('carriers').insert({
            carrier_name: name,
            scac: name.substring(0, 4).toUpperCase(),
            tenant_id: this.tenantId,
            mode: 'ocean'
        }).select().single();
        return newC!.id;
    }

    private getCategoryId(name: string): string {
        // Simple heuristic mapping
        const n = name.toLowerCase();
        if (n.includes('freight')) return this.chargeCategories['freight'] || this.chargeCategories['generic'];
        if (n.includes('baf') || n.includes('fuel')) return this.chargeCategories['surcharge'] || this.chargeCategories['generic'];
        if (n.includes('trucking') || n.includes('pickup')) return this.chargeCategories['trucking'] || this.chargeCategories['generic'];
        return this.chargeCategories['generic'];
    }

    private getBasisId(name: string): string {
         // Default to per container
         // In real usage, might be per shipment
         const containerBasis = Object.keys(this.chargeBases).find(k => k.includes('container'));
         return this.chargeBases[containerBasis || ''] || Object.values(this.chargeBases)[0];
    }
}
