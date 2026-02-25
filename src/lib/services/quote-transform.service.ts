import { QuoteTransferData, QuoteTransferSchema, RateOption } from '@/lib/schemas/quote-transfer';
import { QuoteFormValues, QuoteItem } from '@/components/sales/quote-form/types';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeModeCode, type ModeCarrierTypeMap, DEFAULT_MODE_CARRIER_TYPE_MAP, carrierValidationMessages } from '@/lib/mode-utils';

interface MasterData {
    serviceTypes: { id: string; name: string; code: string }[];
    carriers: { id: string; carrier_name: string; scac?: string; carrier_type?: string | null }[];
    ports?: { id: string; location_name: string; location_code?: string; country?: string }[];
    containerTypes?: { id: string; name: string; code: string }[];
    containerSizes?: { id: string; name: string; code: string }[];
    shippingTerms?: { id: string; code: string; name: string }[];
}

interface RetryOptions {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
}

export class QuoteTransformService {

    /**
     * Logs transfer events to the audit_logs table.
     */
    static async logTransferEvent(
        supabase: SupabaseClient, 
        event: {
            action: string;
            status: 'success' | 'failure';
            userId: string;
            resourceId?: string;
            details?: any;
        }
    ) {
        try {
            await supabase.from('audit_logs').insert({
                user_id: event.userId,
                action: event.action,
                resource_type: 'quote_transfer',
                resource_id: event.resourceId,
                details: {
                    status: event.status,
                    timestamp: new Date().toISOString(),
                    ...event.details
                }
            });
        } catch (error) {
            // Fail silently to avoid interrupting the user flow, but log to console
            console.error('Failed to write audit log', error);
        }
    }

    /**
     * Validates the payload against the Zod schema.
     * Throws detailed ZodError if validation fails.
     */
    static validatePayload(payload: unknown): QuoteTransferData {
        try {
            return QuoteTransferSchema.parse(payload);
        } catch (error) {
            logger.error('Quote Transfer Validation Failed', { error });
            throw error;
        }
    }

    /**
     * Validates that a carrier is compatible with the specified transport mode.
     * Uses the ModeCarrierTypeMap as the authoritative mapping.
     */
    public static validateCarrierMode(
        carrierId: string | null | undefined,
        mode: string | null | undefined,
        carriers: { id: string; carrier_name: string; carrier_type?: string | null }[],
        modeCarrierMap: ModeCarrierTypeMap = DEFAULT_MODE_CARRIER_TYPE_MAP
    ): { valid: boolean; error?: string } {
        if (!carrierId) {
            return { valid: true };
        }

        const carrier = carriers.find(c => c.id === carrierId);
        if (!carrier) {
            return { valid: false, error: `Carrier not found: ${carrierId}` };
        }

        const normalizedMode = normalizeModeCode(mode || '');
        const allowedTypes = modeCarrierMap[normalizedMode] || [];

        if (allowedTypes.length === 0) {
            return { valid: true };
        }

        const carrierType = String(carrier.carrier_type || '').toLowerCase();
        if (!carrierType || !allowedTypes.includes(carrierType)) {
            return {
                valid: false,
                error: carrierValidationMessages.carrierModeMismatch(
                    carrier.carrier_name,
                    carrierType || null,
                    normalizedMode,
                    allowedTypes
                ),
            };
        }

        return { valid: true };
    }

    /**
     * Executes an async operation with exponential backoff retry logic.
     */
    static async retryOperation<T>(
        operation: () => Promise<T>,
        options: RetryOptions = {}
    ): Promise<T> {
        const {
            maxAttempts = 3,
            initialDelay = 1000,
            maxDelay = 10000,
            backoffFactor = 2
        } = options;

        let attempt = 1;
        let delay = initialDelay;

        while (attempt <= maxAttempts) {
            try {
                return await operation();
            } catch (error) {
                if (attempt === maxAttempts) {
                    logger.error(`Operation failed after ${maxAttempts} attempts`, { error });
                    throw error;
                }

                logger.warn(`Operation failed (Attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`, { error });
                
                await new Promise(resolve => setTimeout(resolve, delay));
                
                delay = Math.min(delay * backoffFactor, maxDelay);
                attempt++;
            }
        }

        throw new Error('Operation failed after max retries');
    }

    /**
     * Transforms validated QuoteTransferData into QuoteFormValues for the Quote Editor.
     * Handles all ID resolutions, cargo unification, and structured note generation.
     */
    static transformToQuoteForm(data: QuoteTransferData, masterData: MasterData): Partial<QuoteFormValues> {
        const rates = data.selectedRates || (data.selectedRate ? [data.selectedRate] : []);
        const primaryRate = Array.isArray(rates) && rates.length > 0 ? rates[0] : undefined;

        const tradeDirection = data.trade_direction || 'export';
        const serviceTypeId = this.resolveServiceTypeId(data.mode, data.service_type_id, masterData.serviceTypes);
        const carrierId = this.resolveCarrierId(primaryRate, masterData.carriers);
        const hasCarrierType = Array.isArray(masterData.carriers) && masterData.carriers.some(c => c.carrier_type);
        if (carrierId && hasCarrierType) {
            const carrierValidation = this.validateCarrierMode(
                carrierId,
                data.mode,
                masterData.carriers as any
            );
            if (!carrierValidation.valid && carrierValidation.error) {
                throw new Error(carrierValidation.error);
            }
        }
        const originPortId = this.resolvePortId(
            data.origin, 
            masterData.ports, 
            data.originDetails?.code, 
            data.originDetails?.id
        );
        const destinationPortId = this.resolvePortId(
            data.destination, 
            masterData.ports, 
            data.destinationDetails?.code, 
            data.destinationDetails?.id
        );
        
        // Resolve Shipping Term ID (Incoterms)
        // The form expects an ID for the Select component, but falls back to code if needed
        let shippingTermId = undefined;
        const incotermCode = data.incoterms || (tradeDirection === 'export' ? 'CIF' : 'FOB');
        if (masterData.shippingTerms) {
             const term = masterData.shippingTerms.find(t => t.code === incotermCode);
             if (term) shippingTermId = term.id;
        }

        // Pass normalized rates to helpers
        const items = this.generateQuoteItems(data, primaryRate, masterData);
        const notes = this.generateStructuredNotes({ ...data, selectedRates: rates });
        
        // Map selected rates to form options
        const options = this.mapToQuoteOptions(rates, masterData, data);
        const fallbackCarrierId = (options?.[0]?.legs?.[0]?.carrier_id) as string | undefined;

        return {
            title: `Quote for ${data.commodity || 'General Cargo'} (${data.origin} -> ${data.destination})`,
            commodity: data.commodity,
            total_weight: data.weight?.toString(),
            total_volume: data.volume?.toString(),
            
            // Context
            account_id: data.accountId,
            contact_id: data.contactId, // Map Contact ID if present
            trade_direction: tradeDirection,
            
            // Logistics
            origin_port_id: originPortId,
            destination_port_id: destinationPortId,
            service_type_id: serviceTypeId,
            carrier_id: carrierId || fallbackCarrierId,
            
            // Dates & Requirements
            valid_until: primaryRate?.validUntil ? new Date(primaryRate.validUntil).toISOString().split('T')[0] : undefined,
            pickup_date: data.pickupDate ? new Date(data.pickupDate).toISOString().split('T')[0] : undefined,
            delivery_deadline: data.deliveryDeadline ? new Date(data.deliveryDeadline).toISOString().split('T')[0] : undefined,
            vehicle_type: data.vehicleType,
            special_handling: data.specialHandling,
            
            // Commercial
            // We pass the ID if resolved, otherwise the code. The form should handle the ID.
            incoterms: shippingTermId || incotermCode,
            shipping_amount: primaryRate?.price?.toString(),
            
            // Content
                items: items,
                notes: notes,
                description: notes, // Map to description for QuoteHeader
                options: options,
            
            // Deprecated but required by types until fully removed
            cargo_configurations: [] 
        };
    }

    private static mapToQuoteOptions(rates: RateOption[], masterData: MasterData, transferData: QuoteTransferData): any[] {
        return rates.map((rate, index) => {
            const isPrimary = index === 0;
            const carrierId = this.resolveCarrierId(rate, masterData.carriers);
            
            // Parse transit time days from string (e.g. "25 Days" -> 25)
            let transitDays = 0;
            if (rate.transitTime) {
                const match = rate.transitTime.match(/(\d+)/);
                if (match) transitDays = parseInt(match[1], 10);
            }

            // Map Charges if present (flattened structure often used in Quick Quote)
            // If rate has specific charges array, use it. Otherwise, create a single 'Freight' charge.
            const charges = rate.charges?.map(c => {
                // Map common codes to standard DB codes
                let code = c.code || 'freight';
                if (code === 'FRT') code = 'freight';
                
                return {
                    description: c.description || 'Freight',
                    amount: Number(c.amount) || 0,
                    currency: c.currency || rate.currency || 'USD',
                    charge_code: code,
                    charge_type: 'freight', // logical type
                    basis: 'flat', // Default
                    unit_price: Number(c.amount) || 0,
                    quantity: 1
                };
            }) || [{
                description: 'Base Freight',
                amount: Number(rate.price ?? rate.total_amount ?? 0),
                currency: rate.currency || 'USD',
                charge_code: 'freight',
                charge_type: 'freight',
                basis: 'flat',
                unit_price: Number(rate.price ?? rate.total_amount ?? 0),
                quantity: 1
            }];

            // Create a default leg if none exist
            const legs = rate.legs?.length ? rate.legs.map((leg, i) => ({
                id: leg.id,
                sequence_number: i + 1,
                transport_mode: (leg.mode || transferData.mode || 'ocean').toLowerCase(),
                carrier_id: (leg as any).carrier ? this.resolveCarrierId({ carrier_name: (leg as any).carrier } as any, masterData.carriers) : carrierId,
                origin_location_name: leg.origin 
                    || (i === 0 ? (transferData.originDetails?.name || transferData.origin) : undefined),
                destination_location_name: leg.destination 
                    || (i === (rate.legs?.length || 0) - 1 ? (transferData.destinationDetails?.name || transferData.destination) : undefined),
                origin_location_id: this.resolvePortId(
                    leg.origin, 
                    masterData.ports, 
                    i === 0 ? transferData.originDetails?.code : undefined, 
                    i === 0 ? transferData.originDetails?.id : undefined
                ),
                destination_location_id: this.resolvePortId(
                    leg.destination, 
                    masterData.ports, 
                    i === (rate.legs?.length || 0) - 1 ? transferData.destinationDetails?.code : undefined, 
                    i === (rate.legs?.length || 0) - 1 ? transferData.destinationDetails?.id : undefined
                ),
                transit_time: leg.transit_time,
                charges: [] // Legs might have their own charges, but usually we attach to the option or the first leg
            })) : [{
                sequence_number: 1,
                transport_mode: (transferData.mode || 'ocean').toLowerCase(),
                carrier_id: carrierId,
                origin_location_name: transferData.originDetails?.name || transferData.origin,
                destination_location_name: transferData.destinationDetails?.name || transferData.destination,
                origin_location_id: this.resolvePortId(
                    transferData.origin, 
                    masterData.ports, 
                    transferData.originDetails?.code, 
                    transferData.originDetails?.id
                ),
                destination_location_id: this.resolvePortId(
                    transferData.destination, 
                    masterData.ports, 
                    transferData.destinationDetails?.code, 
                    transferData.destinationDetails?.id
                ),
                transit_time: rate.transitTime,
                transit_time_days: transitDays,
                charges: charges // Attach charges to the single leg
            }];
            
            // If multiple legs, attach charges to the first leg for now (simplification)
            if (rate.legs?.length && legs.length > 0 && charges.length > 0) {
                 legs[0].charges = charges;
            }

            return {
                id: rate.id, // Preserve ID if possible, though new quote might generate new IDs
                is_primary: isPrimary,
                total_amount: rate.price ?? rate.total_amount ?? 0,
                currency: rate.currency || 'USD',
                transit_time_days: transitDays,
                legs: legs
            };
        });
    }

    public static resolveServiceTypeId(mode: string, explicitId: string | undefined, serviceTypes: MasterData['serviceTypes']): string | undefined {
        if (explicitId) return explicitId;
        if (!serviceTypes?.length) return undefined;

        const normalizeModeKey = (value: string | undefined | null) => {
            const v = (value || '').toLowerCase();
            if (!v) return '';
            if (v.includes('ocean') || v.includes('sea') || v.includes('maritime')) return 'ocean';
            if (v.includes('air')) return 'air';
            if (v.includes('rail')) return 'rail';
            if (v.includes('truck') || v.includes('road') || v.includes('inland')) return 'road';
            if (v.includes('courier') || v.includes('express') || v.includes('parcel')) return 'courier';
            if (v.includes('move') || v.includes('mover') || v.includes('packer')) return 'moving';
            return v;
        };

        const targetKey = normalizeModeKey(mode);
        if (!targetKey) return undefined;

        for (const st of serviceTypes) {
            const tm = (st as any).transport_modes;
            const codeKey = normalizeModeKey(tm?.code);
            if (codeKey && codeKey === targetKey) {
                return st.id;
            }
        }

        const modeMap: Record<string, string[]> = {
            'ocean': ['Sea', 'Ocean'], 
            'sea': ['Sea', 'Ocean'],
            'air': ['Air'],
            'road': ['Road', 'Truck'], 
            'truck': ['Road', 'Truck'],
            'rail': ['Rail']
        };

        const targetModes = modeMap[mode?.toLowerCase()] || [mode];
        if (!targetModes.length) return undefined;

        for (const targetMode of targetModes) {
            const match = serviceTypes.find(
                st => st.name.toLowerCase().includes(targetMode.toLowerCase()) || 
                      st.code.toLowerCase() === targetMode.toLowerCase()
            );
            if (match) return match.id;
        }
        
        return undefined;
    }

    public static resolveCarrierId(rate: RateOption | undefined, carriers: MasterData['carriers']): string | undefined {
        if (!rate || !carriers.length) return undefined;

        // Priority 1: Direct ID
        if (rate.carrier_id) {
            const match = carriers.find(c => c.id === rate.carrier_id);
            if (match) return match.id;
        }

        // Priority 2: Name Matching (Fuzzy)
        const searchName = (rate.carrier || rate.carrier_name || '').trim().toLowerCase();
        if (!searchName) return undefined;

        // Try exact match first
        let match = carriers.find(c => c.carrier_name.toLowerCase() === searchName);
        
        // Try SCAC match
        if (!match) {
            match = carriers.find(c => c.scac?.toLowerCase() === searchName);
        }

        // Try contains match (both directions)
        if (!match) {
            match = carriers.find(c => 
                c.carrier_name.toLowerCase().includes(searchName) || 
                searchName.includes(c.carrier_name.toLowerCase())
            );
        }

        return match?.id;
    }

    public static resolvePortId(
        name: string | undefined, 
        ports: MasterData['ports'], 
        code?: string, 
        id?: string
    ): string | undefined {
        if (!ports?.length) return undefined;
        
        // 0. Direct ID match against master ports
        if (id) {
            const byId = ports.find(p => String(p.id) === String(id));
            if (byId) return byId.id;
        }
        
        // 1. Code match
        if (code) {
            const codeLower = code.trim().toLowerCase();
            const byCode = ports.find(p => (p.location_code || '').toLowerCase() === codeLower);
            if (byCode) return byCode.id;
        }
        
        // 2. Name-based matching
        if (name) {
            const searchName = name.trim().toLowerCase();
            
            // Exact name
            let match = ports.find(p => (p.location_name || '').toLowerCase() === searchName);
            
            // Code equals name (user typed code into name field)
            if (!match) {
                match = ports.find(p => (p.location_code || '').toLowerCase() === searchName);
            }
            
            // Contains forward
            if (!match) {
                match = ports.find(p => (p.location_name || '').toLowerCase().includes(searchName));
            }
            
            // Contains reverse
            if (!match) {
                match = ports.find(p => searchName.includes((p.location_name || '').toLowerCase()));
            }
            
            if (match) return match.id;
        }
        
        return undefined;
    }

    private static generateQuoteItems(data: QuoteTransferData, primaryRate: RateOption | undefined, masterData?: MasterData): QuoteItem[] {
        let items: QuoteItem[] = [];
        const normalizedMode = (data.mode || 'ocean').toLowerCase();
        const isContainerized = normalizedMode === 'ocean' || normalizedMode === 'rail';

        // A. Containerized Cargo
        if (isContainerized && (data.containerCombos?.length || (data.containerType && data.containerSize))) {
            const combos = data.containerCombos?.length 
                ? data.containerCombos 
                : [{ type: data.containerType!, size: data.containerSize!, qty: data.containerQty || 1 }];
            
            items = combos.map((c) => {
                // Resolve container type ID and Name
                let resolvedContainerTypeId = c.type;
                let resolvedContainerSizeId = c.size;
                let containerTypeName = '';

                if (masterData?.containerTypes) {
                    // Try to find by ID first
                    let typeMatch = masterData.containerTypes.find(t => t.id === c.type);
                    
                    // If not found, try by code (assuming c.type might be a code)
                    if (!typeMatch) {
                        typeMatch = masterData.containerTypes.find(t => t.code === c.type);
                    }
                    
                    if (typeMatch) {
                        resolvedContainerTypeId = typeMatch.id;
                        containerTypeName = typeMatch.name;
                    }
                }

                if (masterData?.containerSizes) {
                    // Try to find by ID first
                    let sizeMatch = masterData.containerSizes.find(s => s.id === c.size);
                    
                    // If not found, try by name (assuming c.size might be '20', '40' etc.)
                    if (!sizeMatch) {
                        // Strict check for name match (e.g. '20', '40', '40HC')
                        sizeMatch = masterData.containerSizes.find(s => s.name === c.size || s.code === c.size);
                    }
                    
                    if (sizeMatch) {
                        resolvedContainerSizeId = sizeMatch.id;
                    }
                }

                const productName = [
                    containerTypeName,
                    data.commodity || 'General Cargo'
                ].filter(Boolean).join(' - ') || 'General Cargo';

                return {
                    type: 'container',
                    container_type_id: resolvedContainerTypeId || undefined, // Ensure undefined if null/empty string
                    container_size_id: resolvedContainerSizeId || undefined,
                    quantity: Number(c.qty) || 1,
                    product_name: productName,
                    unit_price: 0, // Calculated below
                    attributes: {
                        hazmat: data.dangerousGoods ? { is_hazardous: true } : undefined,
                        hs_code: data.htsCode
                    }
                };
            });
        } 
        // B. Loose / Air / LCL Cargo
        else {
            let dimensions = { length: 0, width: 0, height: 0 };
            if (data.dims) {
                // Parse "10x20x30" or similar
                const parts = data.dims.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
                if (parts && parts.length >= 4) {
                    dimensions = { length: Number(parts[1]), width: Number(parts[2]), height: Number(parts[3]) };
                }
            }

            items.push({
                type: 'loose',
                product_name: data.commodity || 'General Cargo',
                aes_hts_id: data.aes_hts_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.aes_hts_id || '') ? data.aes_hts_id : undefined,
                quantity: 1,
                unit_price: 0, // Calculated below
                attributes: {
                    weight: Number(data.weight) || 0,
                    volume: Number(data.volume) || 0,
                    hs_code: data.htsCode,
                    ...dimensions,
                    hazmat: data.dangerousGoods ? { is_hazardous: true } : undefined
                }
            });
        }

        // C. Price Allocation (Distribute Total Price across Items)
        // This prevents zero-valued items in the quote
        const totalPrice = primaryRate?.price || primaryRate?.total_amount || 0;
        const totalQty = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
        
        if (totalQty > 0 && totalPrice > 0) {
            const unitPrice = Number((totalPrice / totalQty).toFixed(2));
            items = items.map(item => ({
                ...item,
                unit_price: unitPrice,
                // Also calculate line_total implicitly for the DB, though QuoteFormValues doesn't strictly require it
                // (It's calculated on save usually, but good to have)
            }));
        }

        return items;
    }

    private static generateStructuredNotes(data: QuoteTransferData): string {
        const parts: string[] = [];
        parts.push(`**Quick Quote Conversion**`);
        parts.push(`- **Origin**: ${data.origin}`);
        if (data.originDetails && typeof data.originDetails === 'object') {
             // Extract address details if available
             const d = data.originDetails;
             const address = [d.address, d.city, d.state, d.country, d.zipCode].filter(Boolean).join(', ');
             if (address) parts.push(`  *Address*: ${address}`);
        }

        parts.push(`- **Destination**: ${data.destination}`);
        if (data.destinationDetails && typeof data.destinationDetails === 'object') {
             // Extract address details if available
             const d = data.destinationDetails;
             const address = [d.address, d.city, d.state, d.country, d.zipCode].filter(Boolean).join(', ');
             if (address) parts.push(`  *Address*: ${address}`);
        }

        parts.push(`- **Mode**: ${data.mode}`);
        
        // Note: We no longer dump pickupDate/deliveryDeadline etc. here as they are mapped to fields.
        
        if (data.selectedRates.length > 0) {
            parts.push(`\n**Selected Options (${data.selectedRates.length})**`);
            data.selectedRates.forEach((rate, index) => {
                parts.push(`\n*Option ${index + 1}*`);
                const carrierName = rate.carrier || rate.carrier_name || 'Unknown Carrier';
                const rateName = rate.name ? ` - ${rate.name}` : '';
                parts.push(`- Carrier: ${carrierName}${rateName}`);
                
                const price = rate.price ?? rate.total_amount ?? 0;
                const currency = rate.currency || 'USD';
                parts.push(`- Price: ${price} (${currency})`);
                
                if (rate.tier) parts.push(`- Tier: ${rate.tier.toUpperCase()}`);
                if (rate.transitTime) parts.push(`- Transit: ${rate.transitTime}`);
                if (rate.route_type) parts.push(`- Route: ${rate.route_type}`);
                if (rate.co2_kg) parts.push(`- CO2: ${rate.co2_kg} kg`);
                if (rate.ai_generated) parts.push(`- Source: AI Generated`);
            });
        }
        
        if (data.marketAnalysis) {
             parts.push(`\n**AI Market Analysis**`);
             parts.push(data.marketAnalysis);
        }

        return parts.join('\n');
    }
}
