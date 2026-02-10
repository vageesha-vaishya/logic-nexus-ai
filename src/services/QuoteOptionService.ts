
import { SupabaseClient } from '@supabase/supabase-js';
import { PricingService } from './pricing.service';
import { createDebugLogger } from '@/lib/debug-logger';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { matchLegForCharge } from '@/lib/charge-bifurcation';
import { TransportLeg } from '@/types/quote-breakdown';
import { logger } from '@/lib/logger';

export interface AddOptionParams {
    tenantId: string;
    versionId: string;
    rate: any; // The RateOption object or raw rate
    rateMapper: any; // The logistics plugin rate mapper
    source?: 'quick_quote' | 'smart_quote' | 'ai_generated' | 'manual';
    context?: {
        origin?: string;
        destination?: string;
        originDetails?: any;
        destinationDetails?: any;
    };
}

export class QuoteOptionService {
    private supabase: SupabaseClient;
    private debug;
    private pricingService: PricingService;

    constructor(supabase: SupabaseClient) {
        this.supabase = supabase;
        this.debug = createDebugLogger('Service', 'QuoteOption');
        this.pricingService = new PricingService(supabase);
    }

    /**
     * Adds a quote option to a quotation version.
     * Handles financial calculations, mapping, AI field persistence, legs, and charges.
     */
    async addOptionToVersion(params: AddOptionParams): Promise<string> {
        const { tenantId, versionId, rate: rawRate, rateMapper, source = 'manual', context = {} } = params;

        // 1. Normalize rate using centralized mapper
        const rate = mapOptionToQuote(rawRate);

        // 2. Calculate Financials
        const sellPrice = rate.total_amount || rate.price || 0;
        
        let financials;
        if (rate.buyPrice !== undefined && rate.marginAmount !== undefined) {
            financials = { buyPrice: rate.buyPrice, marginAmount: rate.marginAmount, markupPercent: rate.markupPercent };
        } else {
            // Use default 15% margin as per legacy logic (false = sell price based)
            const calc = await this.pricingService.calculateFinancials(sellPrice, 15, false);
            
            // Calculate markup for backward compatibility
            let markup = 0;
            if (calc.buyPrice > 0) {
                markup = (calc.marginAmount / calc.buyPrice) * 100;
            }

            financials = {
                buyPrice: calc.buyPrice,
                marginAmount: calc.marginAmount,
                markupPercent: Number(markup.toFixed(2))
            };
        }
            
        const { buyPrice, marginAmount, markupPercent } = financials;
        
        if (Math.abs(sellPrice - (rate.total_amount || 0)) > 0.01) {
            this.debug.warn('Discrepancy between sellPrice and rate.total_amount', { sellPrice, rateTotal: rate.total_amount });
        }

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rate.id);

        // Calculate total CO2
        const totalCo2 = rate.co2_kg || (rate.legs?.reduce((acc: number, leg: any) => acc + (Number(leg.co2_emission) || Number(leg.co2) || 0), 0)) || 0;

        // 3. Insert Option Header
        const { data: optionData, error: optionError } = await this.supabase
            .from('quotation_version_options')
            .insert({
                tenant_id: tenantId,
                quotation_version_id: versionId,
                carrier_rate_id: isUUID ? rate.id : null,
                option_name: rate.name || `${rate.carrier} ${rate.tier}`,
                carrier_name: rate.carrier,
                total_amount: sellPrice,
                total_sell: sellPrice,
                total_buy: buyPrice,
                margin_amount: marginAmount,
                margin_percentage: markupPercent,
                quote_currency_id: rateMapper.getCurrId(rate.currency || 'USD'),
                transit_time: rate.transitTime,
                total_transit_days: rate.transitTime ? parseInt(rate.transitTime.match(/\d+/)?.[0] || '0') || null : null,
                valid_until: rate.validUntil ? new Date(rate.validUntil).toISOString() : null,
                
                // AI/Source tracking
                reliability_score: rate.reliability_score || rate.reliability?.score,
                ai_generated: rate.ai_generated || rate.source_attribution === 'AI Smart Engine',
                ai_explanation: rate.ai_explanation,
                source: source || rate.source || 'manual',
                source_attribution: rate.source_attribution || 'manual',
                total_co2_kg: totalCo2,
                
                status: 'active'
            })
            .select('id')
            .single();

        if (optionError) {
            this.debug.error('Option Insert Error:', optionError);
            throw optionError;
        }

        const optionId = optionData.id;

        // 4. Insert Legs
        const legData = await this.insertLegs(tenantId, optionId, rate, rateMapper, context);
        
        // 5. Insert Charges
        await this.insertCharges(tenantId, optionId, versionId, rate, legData, rateMapper, financials);

        return optionId;
    }

    private async insertLegs(tenantId: string, optionId: string, rate: any, rateMapper: any, context: any) {
        const legsToInsert: any[] = [];
        const rateLegs = (rate.legs && rate.legs.length > 0) ? rate.legs : [{ mode: rate.transport_mode || rate.mode || 'ocean' }];

        const parseDurationToHours = (duration: string | number | undefined) => {
            if (typeof duration === 'number') return duration; 
            if (!duration) return null;
            const str = String(duration).toLowerCase();
            const val = parseFloat(str);
            if (isNaN(val)) return null;
            if (str.includes('day')) return Math.round(val * 24);
            return Math.round(val);
        };

        if (rateLegs.length > 1 && rateLegs.every((l: any) => typeof l.sequence === 'number' || typeof l.leg_order === 'number')) {
            rateLegs.sort((a: any, b: any) => (a.sequence || a.leg_order || 0) - (b.sequence || b.leg_order || 0));
        }

        rateLegs.forEach((leg: any, index: number) => {
            const legMode = leg.mode || rate.transport_mode || rate.mode || 'ocean';
            const carrierName = leg.carrier || rate.carrier_name || rate.carrier || rate.provider;
            const serviceTypeId = rateMapper.getServiceTypeId(legMode, rate.tier);
            
            const isFirstLeg = index === 0;
            const isLastLeg = index === rateLegs.length - 1;

            let origin = leg.from || leg.origin || leg.pol;
            if (!origin && isFirstLeg) {
                origin = context.originDetails?.formatted_address || context.origin;
            }

            let destination = leg.to || leg.destination || leg.pod;
            if (!destination && isLastLeg) {
                destination = context.destinationDetails?.formatted_address || context.destination;
            }

            if (!origin && !isFirstLeg && legsToInsert[index - 1]?.destination_location) {
                origin = legsToInsert[index - 1].destination_location;
            }
            
            // Database constraint relies on default 'transport'
            const legType = 'transport';

            legsToInsert.push({
                quotation_version_option_id: optionId,
                tenant_id: tenantId,
                mode_id: rateMapper.getModeId(legMode),
                mode: legMode,
                service_type_id: serviceTypeId,
                provider_id: rateMapper.getProviderId(carrierName),
                origin_location: origin || (isFirstLeg ? context.origin : null),
                destination_location: destination || (isLastLeg ? context.destination : null),
                sort_order: index + 1,
                leg_type: legType,
                transit_time_hours: parseDurationToHours(leg.transit_time),
                co2_kg: leg.co2_emission || leg.co2 || null,
                voyage_number: leg.voyage_number || leg.voyage || null
            });
        });

        const { data: legData, error: legError } = await this.supabase
            .from('quotation_version_option_legs')
            .insert(legsToInsert)
            .select('id, mode_id, leg_type, sort_order, service_type_id, mode');

        if (legError) throw legError;

        legData?.sort((a: any, b: any) => a.sort_order - b.sort_order);
        return legData;
    }

    private async insertCharges(
        tenantId: string, 
        optionId: string, 
        versionId: string,
        rate: any, 
        legData: any[], 
        rateMapper: any,
        financials: any
    ) {
        const legsToInsert = legData.map(l => ({
            id: l.id,
            leg_type: l.leg_type || 'transport',
            mode: l.mode || 'ocean', // We don't have mode here, need to infer or fetch. Assuming ocean for fallback.
            // Actually, we need to map back to get the mode.
            // But matchLegForCharge mainly needs leg_type.
            sequence: l.sort_order,
            charges: []
        }));

        // To do this properly, we should have preserved the mode in legData or map it back.
        // For now, we will trust matchLegForCharge works with partial data or we can try to enrich it if needed.
        // But wait, matchLegForCharge uses leg.mode to filter rules. 
        // legData returned from insert has mode_id. We need to look up mode code.
        // Or we can assume the order matches the input `rate.legs` (which we sorted).
        
        const rateLegs = (rate.legs && rate.legs.length > 0) ? rate.legs : [{ mode: rate.transport_mode || 'ocean' }];
        if (rateLegs.length > 1 && rateLegs.every((l: any) => typeof l.sequence === 'number' || typeof l.leg_order === 'number')) {
            rateLegs.sort((a: any, b: any) => (a.sequence || a.leg_order || 0) - (b.sequence || b.leg_order || 0));
        }

        const legsForMatching: TransportLeg[] = legData.map((l: any, i: number) => {
            const originalLeg = rateLegs[i];
            return {
                id: l.id,
                leg_type: l.leg_type || 'transport',
                mode: originalLeg?.mode || rate.transport_mode || 'ocean',
                origin: '', // Not critical for matching
                destination: '',
                sequence: l.sort_order,
                charges: []
            } as TransportLeg;
        });

        let targetModeId = rateMapper.getModeId(rate.transport_mode || 'ocean');
        
        // If the target mode doesn't match any leg, try to infer the main mode from the legs
        // This handles cases where transport_mode is default (ocean) but legs are Air/Road
        if (!legData?.some((l: any) => l.mode_id === targetModeId)) {
            // Find the most significant leg (Air > Ocean > Rail > Road)
            // Or simply find a leg marked as 'main' or 'transport'
            const mainLegCandidate = legData?.find((l: any) => 
                l.leg_type === 'main' || 
                l.leg_type === 'transport' || 
                (l.mode && ['air', 'ocean', 'rail'].includes(l.mode.toLowerCase()))
            );
            
            if (mainLegCandidate) {
                targetModeId = mainLegCandidate.mode_id;
            }
        }

        const mainLeg = legData?.find((l: any) => 
            (l.mode_id === targetModeId) && 
            (l.leg_type === 'transport' || l.leg_type === 'main')
        ) || legData?.find((l: any) => l.leg_type === 'main') || legData?.[0];
        
        const mainLegId = mainLeg?.id;

        const chargesToInsert: any[] = [];
        let totalInsertedSellAmount = 0;
        
        const buySideId = rateMapper.getSideId('buy') || rateMapper.getSideId('cost');
        const sellSideId = rateMapper.getSideId('sell') || rateMapper.getSideId('revenue');

        const addChargePair = async (categoryKey: string, amount: number, note: string, targetLegId: string | null, basisCode?: string, chargeUnit?: string): Promise<boolean> => {
            const catId = rateMapper.getCatId(categoryKey);
            const basisId = rateMapper.getBasisId(basisCode || '') || rateMapper.getBasisId('PER_SHIPMENT');
            const currId = rateMapper.getCurrId(rate.currency || 'USD');
            if (!catId) return false;
            
            const finalLegId = targetLegId || mainLegId || legData?.[0]?.id;
            
            if (!finalLegId) {
                this.debug.warn('Skipping charge insertion: No valid leg ID found', { categoryKey, amount });
                return false;
            }

            const marginPercent = Number(rate.marginPercent || rate.margin_percent || 15);
            // Use PricingService for centralized calculation (Sell-Based Model: isCostBased = false)
            const chargeFinancials = await this.pricingService.calculateFinancials(amount, marginPercent, false);
            const buyAmount = chargeFinancials.buyPrice;
            const sellAmount = chargeFinancials.sellPrice;

            chargesToInsert.push(
                { tenant_id: tenantId, quote_option_id: optionId, leg_id: finalLegId, category_id: catId, basis_id: basisId, charge_side_id: buySideId, quantity: 1, rate: buyAmount, amount: buyAmount, currency_id: currId, note: note, unit: chargeUnit },
                { tenant_id: tenantId, quote_option_id: optionId, leg_id: finalLegId, category_id: catId, basis_id: basisId, charge_side_id: sellSideId, quantity: 1, rate: sellAmount, amount: sellAmount, currency_id: currId, note: note, unit: chargeUnit }
            );
            
            totalInsertedSellAmount += sellAmount;
            return true;
        };

        const getLegIdForCharge = (chargeKey: string, explicitLegIndex?: number) => {
            if (!legData?.length) return null;
            
            if (typeof explicitLegIndex === 'number' && legData[explicitLegIndex]) {
                return legData[explicitLegIndex].id;
            }

            const matchedLeg = matchLegForCharge(chargeKey, legsForMatching);
            if (matchedLeg) return matchedLeg.id;

            const key = chargeKey.toLowerCase();
            if (key.includes('pickup') || key.includes('origin') || key.includes('pre_carriage') || key.includes('export')) return legData[0].id;
            if (key.includes('delivery') || key.includes('destination') || key.includes('on_carriage') || key.includes('import')) return legData[legData.length - 1].id;
            
            return mainLegId || legData[0].id;
        };

        let chargesFound = false;

        // Priority 1: Process Leg-Specific Charges
        if (rateLegs && rateLegs.length > 0) {
             for (const [index, leg] of rateLegs.entries()) {
                if (leg.charges && Array.isArray(leg.charges) && leg.charges.length > 0) {
                    const targetLegId = legData?.[index]?.id; 
                    
                    if (targetLegId) {
                        for (const charge of leg.charges) {
                            const amount = Number(charge.amount || charge.price || charge.total || 0);
                            if (amount !== 0) {
                                const desc = charge.description || charge.name || charge.code || charge.category || 'Charge';
                                const unit = charge.unit || charge.basis;
                                const note = charge.note || desc;

                                if (await addChargePair(desc, amount, note, targetLegId, unit, unit)) {
                                    chargesFound = true;
                                }
                            }
                        }
                    }
                }
             }
        }

        // Priority 2: Process Global/Remaining Charges
        if (Array.isArray(rate.charges) && rate.charges.length > 0) {
            for (const charge of rate.charges) {
                const amount = Number(charge.amount || charge.price || charge.total || 0);
                if (amount !== 0) {
                    const desc = charge.description || charge.name || charge.code || charge.category || 'Charge';
                    const legId = getLegIdForCharge(desc);
                    const unit = charge.unit || charge.basis;
                    const note = charge.note || desc;
                    
                    if (await addChargePair(desc, amount, note, legId, unit, unit)) {
                        chargesFound = true;
                    }
                }
            }
        } 

        // Priority 3: Fallback to 'price_breakdown' object
        if (!chargesFound) {
            const breakdown = rate.price_breakdown || { base_fare: rate.total_amount || rate.price || 0 };
            
            const processCharge = async (key: string, value: any, parentKey: string = '') => {
                if (['total', 'total_amount', 'total_price', 'subtotal', 'currency', 'currency_code', 'exchange_rate', 'symbol'].includes(key.toLowerCase())) {
                    return;
                }

                if (typeof value === 'number' && value !== 0) {
                    const compositeKey = parentKey ? `${parentKey}_${key}` : key;
                    let explicitIndex: number | undefined = undefined;
                    if (parentKey.match(/legs?_?\[?(\d+)\]?/i)) {
                        const match = parentKey.match(/legs?_?\[?(\d+)\]?/i);
                        if (match) explicitIndex = parseInt(match[1]);
                    }

                    const legId = getLegIdForCharge(compositeKey, explicitIndex);
                    const formatNote = (str: string) => str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    await addChargePair(key, value, formatNote(compositeKey), legId);
                    return;
                } 
                
                if (typeof value === 'object' && value !== null) {
                    const amountKey = ['amount', 'price', 'value', 'total'].find(k => typeof value[k] === 'number');
                    const codeKey = ['code', 'name', 'type', 'description', 'id', 'charge_code'].find(k => typeof value[k] === 'string');

                    if (amountKey) {
                        const amount = value[amountKey];
                        const code = codeKey ? value[codeKey] : key;
                        const unitKey = ['unit', 'basis', 'per'].find(k => typeof value[k] === 'string');
                        const unit = unitKey ? value[unitKey] : undefined;
                        
                        const legIndexKey = ['leg_index', 'leg_id', 'segment_index'].find(k => typeof value[k] === 'number');
                        const explicitIndex = legIndexKey ? value[legIndexKey] : undefined;

                        const compositeKey = parentKey ? `${parentKey}_${code}` : code;
                        const legId = getLegIdForCharge(compositeKey, explicitIndex);
                        const formatNote = (str: string) => str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        
                        await addChargePair(code, amount, formatNote(compositeKey), legId, unit, unit);
                        return;
                    }

                    const newParentKey = parentKey ? `${parentKey}_${key}` : key;
                    for (const [k, v] of Object.entries(value)) {
                        await processCharge(k, v, newParentKey);
                    }
                }
            };

            for (const [key, val] of Object.entries(breakdown)) {
                await processCharge(key, val);
            }
        }

        // 4. BALANCING CHARGE
        const sellPrice = financials.sellPrice || rate.total_amount || 0;
        const discrepancy = sellPrice - totalInsertedSellAmount;
        if (Math.abs(discrepancy) > 0.01) {
             const chargeName = discrepancy > 0 ? 'Ancillary Fees' : 'Discount / Adjustment';
             const chargeNote = discrepancy > 0 ? 'Unitemized surcharges' : 'Bundle discount adjustment';
             await addChargePair(chargeName, Number(discrepancy.toFixed(2)), chargeNote, mainLegId);
             this.debug.info('Added balancing charge', { discrepancy, sellPrice, totalInsertedSellAmount });
        }

        // Fallback: If no charges found, add total freight
        if (chargesToInsert.length === 0) await addChargePair('FREIGHT', sellPrice, 'Total Freight', mainLegId);

        if (chargesToInsert.length > 0) {
            await this.supabase.from('quote_charges').insert(chargesToInsert);

            // RECONCILIATION
            const finalTotalBuy = chargesToInsert
                .filter((c: any) => c.charge_side_id === buySideId)
                .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
                
            const finalTotalSell = chargesToInsert
                .filter((c: any) => c.charge_side_id === sellSideId)
                .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
                
            const finalMargin = finalTotalSell - finalTotalBuy;
            const finalMarkup = finalTotalBuy > 0 ? (finalMargin / finalTotalBuy) * 100 : 0;
            
            await this.supabase
                .from('quotation_version_options')
                .update({
                    total_buy: Number(finalTotalBuy.toFixed(2)),
                    total_sell: Number(finalTotalSell.toFixed(2)),
                    total_amount: Number(finalTotalSell.toFixed(2)),
                    margin_amount: Number(finalMargin.toFixed(2)),
                    margin_percentage: Number(finalMarkup.toFixed(2))
                })
                .eq('id', optionId);

            // VALIDATION
            const transferDiff = Math.abs(sellPrice - finalTotalSell);
            if (transferDiff > 0.01) {
                const errorMsg = `[Data Integrity Failure] Transfer Mismatch: Incoming ${sellPrice} vs Stored ${finalTotalSell} (Diff: ${transferDiff})`;
                this.debug.error(errorMsg, { optionId, sellPrice, finalTotalSell });
                logger.error(errorMsg, { optionId, sellPrice, finalTotalSell });
                
                // Record anomaly to Version level (best effort)
                const { data: vData } = await this.supabase
                    .from('quotation_versions')
                    .select('anomalies')
                    .eq('id', versionId)
                    .single();
                    
                const currentAnomalies = Array.isArray(vData?.anomalies) ? vData.anomalies : [];
                await this.supabase.from('quotation_versions').update({
                    anomalies: [...currentAnomalies, {
                        type: 'TRANSFER_MISMATCH',
                        severity: 'CRITICAL',
                        message: errorMsg,
                        timestamp: new Date().toISOString(),
                        option_id: optionId
                    }]
                }).eq('id', versionId);
            }
        }
    }
}
