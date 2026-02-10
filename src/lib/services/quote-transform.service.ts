import { QuoteTransferData, QuoteTransferSchema, RateOption } from '@/lib/schemas/quote-transfer';
import { QuoteFormValues, QuoteItem } from '@/components/sales/quote-form/types';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';

interface MasterData {
    serviceTypes: { id: string; name: string; code: string }[];
    carriers: { id: string; carrier_name: string; scac?: string }[];
    containerTypes?: { id: string; name: string; code: string }[];
    containerSizes?: { id: string; name: string; code: string }[];
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
        // Normalize selectedRates for backward compatibility
        const rates = data.selectedRates || (data.selectedRate ? [data.selectedRate] : []);
        
        // If no rates, we can still proceed with partial data, or return early. 
        // But let's try to map what we can.
        const primaryRate = rates[0];

        const tradeDirection = data.trade_direction || 'export';
        const serviceTypeId = this.resolveServiceTypeId(data.mode, data.service_type_id, masterData.serviceTypes);
        const carrierId = this.resolveCarrierId(primaryRate, masterData.carriers);
        
        // Pass normalized rates to helpers
        const items = this.generateQuoteItems(data, primaryRate, masterData);
        const notes = this.generateStructuredNotes({ ...data, selectedRates: rates });

        return {
            title: `Quote for ${data.commodity || 'General Cargo'} (${data.origin} -> ${data.destination})`,
            commodity: data.commodity,
            total_weight: data.weight?.toString(),
            total_volume: data.volume?.toString(),
            
            // Context
            account_id: data.accountId,
            trade_direction: tradeDirection,
            
            // Logistics
            origin_port_id: data.originId || data.originDetails?.id,
            destination_port_id: data.destinationId || data.destinationDetails?.id,
            service_type_id: serviceTypeId,
            carrier_id: carrierId,
            
            // Dates & Requirements
            valid_until: primaryRate?.validUntil ? new Date(primaryRate.validUntil).toISOString().split('T')[0] : undefined,
            pickup_date: data.pickupDate,
            delivery_deadline: data.deliveryDeadline,
            vehicle_type: data.vehicleType,
            special_handling: data.specialHandling,
            
            // Commercial
            incoterms: data.incoterms || (tradeDirection === 'export' ? 'CIF' : 'FOB'),
            shipping_amount: primaryRate?.price?.toString(),
            
            // Content
            items: items,
            notes: notes,
            
            // Deprecated but required by types until fully removed
            cargo_configurations: [] 
        };
    }

    private static resolveServiceTypeId(mode: string, explicitId: string | undefined, serviceTypes: MasterData['serviceTypes']): string | undefined {
        if (explicitId) return explicitId;

        const modeMap: Record<string, string> = {
            'ocean': 'Sea', 'sea': 'Sea',
            'air': 'Air',
            'road': 'Road', 'truck': 'Road',
            'rail': 'Rail'
        };

        const targetMode = modeMap[mode?.toLowerCase()] || mode;
        if (!targetMode || !serviceTypes.length) return undefined;

        return serviceTypes.find(
            st => st.name.toLowerCase().includes(targetMode.toLowerCase()) || 
                  st.code.toLowerCase() === targetMode.toLowerCase()
        )?.id;
    }

    private static resolveCarrierId(rate: RateOption | undefined, carriers: MasterData['carriers']): string | undefined {
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
                ].filter(Boolean).join(' - ');

                return {
                    type: 'container',
                    container_type_id: resolvedContainerTypeId,
                    container_size_id: resolvedContainerSizeId,
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
        parts.push(`- **Destination**: ${data.destination}`);
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
