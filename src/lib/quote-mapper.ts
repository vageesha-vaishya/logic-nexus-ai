import { matchLegForCharge } from '@/lib/charge-bifurcation';

export const mapOptionToQuote = (opt: any) => {
    if (!opt) return null;
    
    const safeNumber = (val: any) => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'string') {
            val = val.replace(/,/g, '');
        }
        const num = Number(val);
        return isFinite(num) ? num : 0;
    };

    const normalizeTransportMode = (val: any): string | undefined => {
        const str = String(val || '').trim().toLowerCase();
        if (!str) return undefined;
        if (str.includes('air')) return 'air';
        if (str.includes('ocean') || str.includes('sea')) return 'ocean';
        if (str.includes('courier') || str.includes('express') || str.includes('parcel')) return 'courier';
        if (str.includes('moving') || str.includes('movers') || str.includes('packers')) return 'movers_packers';
        if (
            str.includes('road') ||
            str.includes('truck') ||
            str.includes('trucking') ||
            str.includes('ground') ||
            str.includes('inland') ||
            str.includes('rail')
        ) {
            return 'inland_trucking';
        }
        return undefined;
    };

    const canonicalMode =
        normalizeTransportMode(opt.mode) ||
        normalizeTransportMode(opt.transport_mode) ||
        normalizeTransportMode(opt.name) ||
        'ocean';

    const modeLabel =
        opt.transport_mode ||
        opt.name ||
        opt.mode ||
        canonicalMode;
    
    const normalized = {
        ...opt,
        carrier_id: opt.carrier_id || (typeof opt.carrier === 'object' ? opt.carrier?.id : undefined),
        carrier_name: opt.carrier_name || (typeof opt.carrier === 'object' ? opt.carrier?.name : opt.carrier) || 'Unknown Carrier',
        option_name: opt.option_name || opt.name,
        total_amount: safeNumber(opt.total_amount) || safeNumber(opt.price),
        mode: canonicalMode,
        transport_mode: canonicalMode,
        raw_transport_mode: modeLabel,
        transit_time: typeof opt.transitTime === 'string' ? { details: opt.transitTime } : (opt.transit_time || {}),
        currency: typeof opt.currency === 'object' ? opt.currency?.code : opt.currency,
        sellPrice: safeNumber(opt.sellPrice) || safeNumber(opt.total_amount) || safeNumber(opt.price),
        buyPrice: safeNumber(opt.buyPrice ?? opt.total_buy ?? opt.buy_price),
        marginAmount: safeNumber(opt.marginAmount ?? opt.margin_amount),
        marginPercent: safeNumber(opt.marginPercent ?? opt.margin_percent),
        markupPercent: safeNumber(opt.markupPercent ?? opt.markup_percent ?? opt.margin_percentage),
        
        source: opt.source || 'manual',
        source_attribution: opt.source_attribution || 'manual',
        ai_generated: opt.ai_generated === true || opt.source === 'ai_generated' || opt.source_attribution === 'AI Smart Engine',
        ai_explanation: opt.ai_explanation || null,
        reliability_score: safeNumber(opt.reliability_score ?? opt.reliability?.score)
    };
    
    // Calculate price breakdown if not present
    let price_breakdown = normalized.price_breakdown;
    if (!price_breakdown) {
        let total = normalized.total_amount || 0;
        let base_fare = 0;
        let taxes = 0;
        const surcharges: any = {};
        const fees: any = {};

        if (normalized.legs) {
            normalized.legs.forEach((leg: any) => {
                if (leg.charges) {
                    leg.charges.forEach((charge: any) => {
                        const amount = safeNumber(charge.sell?.amount) || safeNumber(charge.amount);
                        const name = (charge.charge_categories?.name || charge.name || '').toLowerCase();
                        if (name.includes('tax') || name.includes('duty')) {
                            taxes += amount;
                        } else if (name.includes('fuel') || name.includes('surcharge')) {
                            surcharges[charge.charge_categories?.name || 'Surcharge'] = (surcharges[charge.charge_categories?.name || 'Surcharge'] || 0) + amount;
                        } else if (name.includes('fee')) {
                            fees[charge.charge_categories?.name || 'Fee'] = (fees[charge.charge_categories?.name || 'Fee'] || 0) + amount;
                        } else {
                            base_fare += amount;
                        }
                    });
                }
            });
        }
        
        // Recalculate total if it's 0 but we have components
        const surchargeTotal = Object.values(surcharges).reduce((sum: number, val: any) => sum + Number(val || 0), 0) as number;
        const feeTotal = Object.values(fees).reduce((sum: number, val: any) => sum + Number(val || 0), 0) as number;
        const componentsSum = Number((base_fare + taxes + surchargeTotal + feeTotal).toFixed(2));

        if (total === 0 && componentsSum > 0) {
            total = componentsSum;
        }
        
        if (base_fare === 0 && taxes === 0 && Object.keys(surcharges).length === 0) {
            base_fare = total;
        }
        
        price_breakdown = {
            total,
            currency: normalized.currency || 'USD',
            base_fare,
            taxes,
            surcharges,
            fees
        };
    }

    let charges = normalized.charges || [];
    if ((!normalized.charges || normalized.charges.length === 0) && (!normalized.legs || !normalized.legs.some((l: any) => l.charges && l.charges.length > 0))) {
        const currency = price_breakdown.currency || normalized.currency || 'USD';
        
        if (price_breakdown.base_fare > 0) {
            charges = [...charges, { category: 'Freight', name: 'Base Freight', amount: price_breakdown.base_fare, currency, unit: 'per_shipment', note: 'Base Freight' }];
        }
        if (price_breakdown.taxes > 0) {
            charges = [...charges, { category: 'Tax', name: 'Taxes & Duties', amount: price_breakdown.taxes, currency, unit: 'per_shipment', note: 'Taxes & Duties' }];
        }
        if (price_breakdown.surcharges) {
            Object.entries(price_breakdown.surcharges).forEach(([key, val]: any) => {
                if (val > 0) charges = [...charges, { category: 'Surcharge', name: key, amount: val, currency, unit: 'per_shipment', note: key }];
            });
        }
        if (price_breakdown.fees) {
            Object.entries(price_breakdown.fees).forEach(([key, val]: any) => {
                if (val > 0) charges = [...charges, { category: 'Fee', name: key, amount: val, currency, unit: 'per_shipment', note: key }];
            });
        }
    }

    let duplicatesRemoved = false;

    let legs = normalized.legs || [];
    if (legs.length === 0 && charges.length > 0) {
        legs = [{
            id: 'generated-leg-1',
            mode: normalized.mode || 'unknown',
            origin: normalized.origin || 'Origin',
            destination: normalized.destination || 'Destination',
            sequence: 1,
            charges: charges
        }];
        charges = []; 
    } else {
        legs = legs.map((leg: any, index: number) => ({
            ...leg,
            id: leg.id || `leg-${index}-${Date.now()}`,
            mode: leg.mode || normalized.mode || 'unknown',
            origin: leg.origin || (index === 0 ? normalized.origin : undefined) || 'Origin',
            destination: leg.destination || (index === legs.length - 1 ? normalized.destination : undefined) || 'Destination',
            charges: (leg.charges || []).map((c: any) => {
                if (!c.category && !c.charge_categories?.name) {
                    const name = (c.name || '').toLowerCase();
                    if (name.includes('freight')) c.category = 'Freight';
                    else if (name.includes('fuel') || name.includes('baf')) c.category = 'Surcharge';
                    else if (name.includes('doc') || name.includes('fee')) c.category = 'Fee';
                    else if (name.includes('tax') || name.includes('duty') || name.includes('vat')) c.category = 'Tax';
                    else if (name.includes('pickup') || name.includes('delivery') || name.includes('haulage')) c.category = 'Transport';
                }
                return c;
            })
        }));

        if (charges.length > 0) {
            const initialCount = charges.length;
            const legChargeSignatures = new Set();
            legs.forEach((leg: any) => {
                if (leg.charges) {
                    leg.charges.forEach((c: any) => {
                        const name = (c.name || c.charge_categories?.name || '').toLowerCase().trim();
                        const sig = `${name}|${c.amount}|${c.currency || ''}`;
                        legChargeSignatures.add(sig);
                    });
                }
            });

            charges = charges.filter((c: any) => {
                const name = (c.name || c.charge_categories?.name || '').toLowerCase().trim();
                const sig = `${name}|${c.amount}|${c.currency || ''}`;
                
                // Also check for "Total" keywords in the name which indicates a summary charge
                const isTotalSummary = name === 'total' || name === 'total amount' || name === 'total price';
                if (isTotalSummary && c.amount === normalized.total_amount) {
                    return false;
                }

                return !legChargeSignatures.has(sig);
            });
            
            if (charges.length < initialCount) duplicatesRemoved = true;
        }
    }

    if (legs.length === 1) {
        legs[0].bifurcation_role = 'main';
        if (!legs[0].leg_type) legs[0].leg_type = 'transport';
    } else if (legs.length > 1) {
        legs.forEach((leg: any, index: number) => {
            if (!leg.leg_type) leg.leg_type = 'transport';
            
            if (index === 0) {
                leg.bifurcation_role = 'origin';
            } else if (index === legs.length - 1) {
                leg.bifurcation_role = 'destination';
            } else {
                leg.bifurcation_role = 'main';
            }
        });
    }

    // Intelligent Global Charge Allocation (using unified matchLegForCharge logic)
    if (charges.length > 0 && legs.length > 0) {
        const remainingGlobalCharges: any[] = [];

        charges.forEach((c: any) => {
            const name = (c.name || c.charge_categories?.name || '').toLowerCase();
            
            // Use shared bifurcation logic to find the best leg
            // We cast legs to any[] because matchLegForCharge expects TransportLeg[] but our legs are still being built
            const targetLeg = matchLegForCharge(name, legs as any[]);

            let allocated = false;
            if (targetLeg) {
                // DUPLICATE DETECTION: Check if this charge already exists in the target leg
                // This prevents double-counting when global charges are just summaries of leg charges
                const isDuplicate = targetLeg.charges.some((existing: any) => {
                    const amountMatch = Math.abs((existing.amount || 0) - (c.amount || 0)) < 0.01;
                    const currencyMatch = (existing.currency || 'USD') === (c.currency || 'USD');
                    const existingName = (existing.name || existing.charge_categories?.name || '').toLowerCase();
                    // Loose name matching
                    const nameMatch = existingName.includes(name) || name.includes(existingName) || 
                                      (existingName.includes('freight') && name.includes('freight')) ||
                                      (existingName.includes('fee') && name.includes('fee'));
                    return amountMatch && currencyMatch && nameMatch;
                });

                if (isDuplicate) {
                    // It's a duplicate, so we mark it as allocated (removed from global) 
                    // but DO NOT add it to the leg (effectively discarding it)
                    allocated = true;
                    duplicatesRemoved = true;
                } else {
                    if (!targetLeg.charges) targetLeg.charges = [];
                    targetLeg.charges.push(c);
                    allocated = true;
                }
            }

            if (!allocated) {
                remainingGlobalCharges.push(c);
            }
        });
        
        charges = remainingGlobalCharges;
    }

    const legsTotal = legs.reduce((sum: number, leg: any) => 
        sum + (leg.charges?.reduce((s: number, c: any) => s + Number(c.amount || 0), 0) || 0), 0);
    const globalTotal = charges.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
    const calculatedTotal = Number((legsTotal + globalTotal).toFixed(2));
    
    const isAiGenerated = normalized.source_attribution?.includes("AI") || normalized.ai_generated || (opt.source_attribution?.includes("AI"));

    if (price_breakdown) {
        if (duplicatesRemoved) {
             price_breakdown.total = calculatedTotal;
             if (price_breakdown.base_fare > calculatedTotal) price_breakdown.base_fare = calculatedTotal;
        } else if (Math.abs(price_breakdown.total - calculatedTotal) > 0.01) {
             if (isAiGenerated && calculatedTotal > 0) {
                 price_breakdown.total = calculatedTotal;
             } else {
                 const discrepancy = price_breakdown.total - calculatedTotal;
                 if (discrepancy > 0.01) {
                     const currency = price_breakdown.currency || normalized.currency || 'USD';
                    charges.push({
                         category: 'Adjustment', 
                         name: 'Ancillary Fees', 
                         amount: Number(discrepancy.toFixed(2)), 
                         currency, 
                         unit: 'per_shipment', 
                         note: 'Unitemized surcharges' 
                     });
                 } else {
                     price_breakdown.total = calculatedTotal;
                 }
             }
        }
    }

    let finalBuyPrice = normalized.buyPrice;
    let finalMarginAmount = normalized.marginAmount;
    let finalMarkupPercent = normalized.markupPercent;

    const totalChanged = Math.abs((normalized.total_amount || 0) - price_breakdown.total) > 0.01;
    const financialsMissing = !finalBuyPrice || finalBuyPrice <= 0;

    if (totalChanged || financialsMissing) {
        const targetMargin = normalized.marginPercent || 15;
        
        const buyMultiplier = 1 - (targetMargin / 100);
        finalBuyPrice = Number((price_breakdown.total * buyMultiplier).toFixed(2));
        finalMarginAmount = Number((price_breakdown.total - finalBuyPrice).toFixed(2));
        
        // Recalculate Markup % (Profit / Cost) for consistency
        finalMarkupPercent = finalBuyPrice > 0 ? Number(((finalMarginAmount / finalBuyPrice) * 100).toFixed(2)) : 0;
    }

    return {
        ...normalized,
        total_amount: price_breakdown.total,
        buyPrice: finalBuyPrice,
        marginAmount: finalMarginAmount,
        marginPercent: normalized.marginPercent || 15,
        markupPercent: finalMarkupPercent,
        transport_mode: normalized.raw_transport_mode || normalized.mode,
        carrier: normalized.carrier_name,
        transit_time: typeof normalized.transit_time === 'string' ? { details: normalized.transit_time } : (normalized.transit_time?.details ? normalized.transit_time : { details: normalized.transit_time }),
        price_breakdown,
        legs,
        charges,
        reliability: { score: normalized.reliability_score || normalized.reliability?.score || 0 },
        tier: normalized.tier || 'standard',
        environmental: normalized.environmental || (normalized.total_co2_kg ? { co2_emissions: `${normalized.total_co2_kg} kg` } : undefined),
        ai_generated: normalized.ai_generated || (normalized.source_attribution && normalized.source_attribution.includes("AI"))
    };
};

/**
 * Calculates financial metrics (Buy/Sell/Margin) based on amount and margin/markup rules.
 * @param amount - The base amount (either Cost or Sell price depending on isCostBased)
 * @param marginPercent - The target margin percentage (default 15%)
 * @param isCostBased - If true, treats 'amount' as Cost (Cost-Plus). If false, treats 'amount' as Sell (Discount).
 */
export const calculateQuoteFinancials = (amount: number, marginPercent: number = 15, isCostBased: boolean = true) => {
    let sellPrice = 0;
    let buyPrice = 0;
    let marginAmount = 0;
    
    // Ensure valid inputs
    const safeCost = Number(amount) || 0;
    const safeMargin = Number(marginPercent) || 0;

    if (isCostBased) {
        // Cost-Plus Model: Sell = Cost / (1 - Margin%)
        buyPrice = safeCost;
        const divisor = 1 - (safeMargin / 100);
        sellPrice = divisor > 0 ? Number((buyPrice / divisor).toFixed(2)) : buyPrice;
        marginAmount = Number((sellPrice - buyPrice).toFixed(2));
    } else {
        // Sell-Based Model (Discount): Buy = Sell * (1 - Margin%)
        sellPrice = safeCost;
        marginAmount = Number((sellPrice * (safeMargin / 100)).toFixed(2));
        buyPrice = Number((sellPrice - marginAmount).toFixed(2));
    }
    
    // Calculate markup for backward compatibility
    let markupPercent = 0;
    if (buyPrice > 0) {
        markupPercent = Number(((marginAmount / buyPrice) * 100).toFixed(2));
    }
    
    return {
        sellPrice,
        buyPrice,
        marginAmount,
        marginPercent: safeMargin, 
        markupPercent 
    };
};
