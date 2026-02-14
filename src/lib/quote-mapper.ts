import { matchLegForCharge } from '@/lib/charge-bifurcation';

export const mapOptionToQuote = (opt: any) => {
    if (!opt) return null;
    
    // Helper to safely parse numbers
    const safeNumber = (val: any) => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'string') {
            // Remove commas which break Number() parsing
            val = val.replace(/,/g, '');
        }
        const num = Number(val);
        return isFinite(num) ? num : 0;
    };
    
    // Idempotency check: We no longer return early. 
    // Instead, we allow the object to flow through to ensure balancing, deduplication, and allocation logic 
    // is always applied, even to already mapped objects. This fixes data inconsistencies in historical quotes.
    
    // Normalize input keys to support different source formats (Smart Quote vs Quick Quote)
    const normalized = {
        ...opt,
        carrier_id: opt.carrier_id || (typeof opt.carrier === 'object' ? opt.carrier?.id : undefined),
        carrier_name: opt.carrier_name || (typeof opt.carrier === 'object' ? opt.carrier?.name : opt.carrier) || 'Unknown Carrier',
        option_name: opt.option_name || opt.name,
        total_amount: safeNumber(opt.total_amount) || safeNumber(opt.price),
        mode: opt.mode || opt.transport_mode || opt.name, // Fallback chain
        transport_mode: opt.transport_mode || opt.mode || (['air', 'ocean', 'road', 'rail'].includes((opt.name || '').toLowerCase()) ? opt.name.toLowerCase() : undefined),
        transit_time: typeof opt.transitTime === 'string' ? { details: opt.transitTime } : (opt.transit_time || {}),
        currency: typeof opt.currency === 'object' ? opt.currency?.code : opt.currency,
        // Financial mappings (DB -> App)
        // Ensure that if we recalculate total later, these old financials don't mislead us.
        // We will recalculate them if needed in the return statement.
        sellPrice: safeNumber(opt.sellPrice) || safeNumber(opt.total_amount) || safeNumber(opt.price), // Explicit Sell Price
        buyPrice: safeNumber(opt.buyPrice ?? opt.total_buy ?? opt.buy_price),
        marginAmount: safeNumber(opt.marginAmount ?? opt.margin_amount),
        marginPercent: safeNumber(opt.marginPercent ?? opt.margin_percent), // Prioritize Margin
        markupPercent: safeNumber(opt.markupPercent ?? opt.markup_percent ?? opt.margin_percentage), // Fallback
        
        // AI/Source Metadata
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
        let surcharges: any = {};
        let fees: any = {};

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

    // Synchronize charges for ChargeBreakdown component
    // If we have a breakdown but no explicit charges array (e.g. AI quote), synthesize charges for display
    let charges = normalized.charges || [];
    if ((!normalized.charges || normalized.charges.length === 0) && (!normalized.legs || !normalized.legs.some((l: any) => l.charges && l.charges.length > 0))) {
        // Only synthesize if we don't have detailed leg charges either
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

    // Flag to track if we removed duplicates. If so, we should trust the sum of components over the header total.
    let duplicatesRemoved = false;

    // Retrofitting: Ensure we have at least one leg for the breakdown graph
    let legs = normalized.legs || [];
    if (legs.length === 0 && charges.length > 0) {
        // Create a synthetic leg for flat quotes
        legs = [{
            id: 'generated-leg-1',
            mode: normalized.mode || 'unknown',
            origin: normalized.origin || 'Origin',
            destination: normalized.destination || 'Destination',
            sequence: 1,
            charges: charges // Move global synthesized charges to this leg
        }];
        // Clear global charges as they are now assigned to the leg
        charges = []; 
    } else {
        // Ensure existing legs have modes and IDs
        legs = legs.map((leg: any, index: number) => ({
            ...leg,
            id: leg.id || `leg-${index}-${Date.now()}`, // Ensure ID exists for mapping
            mode: leg.mode || normalized.mode || 'unknown',
            // Fallback to quote-level origin/destination if missing on leg
            origin: leg.origin || (index === 0 ? normalized.origin : undefined) || 'Origin',
            destination: leg.destination || (index === legs.length - 1 ? normalized.destination : undefined) || 'Destination',
            charges: (leg.charges || []).map((c: any) => {
                // Infer category if missing
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

        // Deduplicate charges: If a charge exists in a leg, remove it from global charges to prevent double-display
        // This handles cases where the API returns a flattened 'charges' array that includes leg-specific charges
        if (charges.length > 0) {
            const initialCount = charges.length;
            const legChargeSignatures = new Set();
            legs.forEach((leg: any) => {
                if (leg.charges) {
                    leg.charges.forEach((c: any) => {
                        // Create a signature based on amount and name/category
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
                    // This is definitely a duplicate summary charge
                    return false;
                }

                return !legChargeSignatures.has(sig);
            });
            
            if (charges.length < initialCount) duplicatesRemoved = true;
        }
    }

    // Bifurcation Logic: Assign bifurcation_role (Origin, Main, Destination)
    // database constraint requires leg_type to be 'transport' or 'service'
    if (legs.length === 1) {
        legs[0].bifurcation_role = 'main'; // Direct transport is main carriage
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

    // Final Reconciliation: Calculate true total from components
    // This fixes the "Double Counting" issue where header total is inflated ($12k) but components are correct ($4k)
    // AND ensures we balance correctly by considering ALL charges (legs + global)
    const legsTotal = legs.reduce((sum: number, leg: any) => 
        sum + (leg.charges?.reduce((s: number, c: any) => s + Number(c.amount || 0), 0) || 0), 0);
    const globalTotal = charges.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
    const calculatedTotal = Number((legsTotal + globalTotal).toFixed(2));
    
    // Check if this is an AI quote - they are notoriously bad at summing totals (hallucination)
    // but usually good at listing specific line items.
    const isAiGenerated = normalized.source_attribution?.includes("AI") || normalized.ai_generated || (opt.source_attribution?.includes("AI"));

    if (price_breakdown) {
        if (duplicatesRemoved) {
             // If we removed duplicates, the original header total was likely double-counted.
             // We MUST overwrite it with the true calculated sum.
             price_breakdown.total = calculatedTotal;
             // Adjust base_fare if needed (simplified)
             if (price_breakdown.base_fare > calculatedTotal) price_breakdown.base_fare = calculatedTotal;
        } else if (Math.abs(price_breakdown.total - calculatedTotal) > 0.01) {
             // If mismatch exists...
             
             if (isAiGenerated && calculatedTotal > 0) {
                 // AI HALLUCINATION FIX:
                 // AI often returns a "Total" that is mathematically incorrect (e.g. 4x multiplier or just random).
                 // We trust the sum of the generated line items (Components) over the hallucinated Header Total.
                 // This ensures the displayed price matches the breakdown.
                 price_breakdown.total = calculatedTotal;
             } else {
                 // For standard API quotes (e.g. Rate Engine), we assume the Header is the "Truth" 
                 // and we might be missing hidden fees/surcharges in the line items.
                 // Add balancing charge ONLY if the discrepancy is positive (Header > Components)
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
                     // Header < Components (Discount? Or Header is wrong?)
                     // We trust components because they are explicit line items.
                     price_breakdown.total = calculatedTotal;
                 }
             }
        }
    }

    // Recalculate Financials if Total Amount Changed significantly OR if financials are missing
    // This handles the case where historical data had wrong total (12000) but correct components (4256)
    // AND handles the case where backend didn't provide financials (legacy/external sources)
    let finalBuyPrice = normalized.buyPrice;
    let finalMarginAmount = normalized.marginAmount;
    let finalMarkupPercent = normalized.markupPercent;

    const totalChanged = Math.abs((normalized.total_amount || 0) - price_breakdown.total) > 0.01;
    const financialsMissing = !finalBuyPrice || finalBuyPrice <= 0;

    if (totalChanged || financialsMissing) {
        // Recalculate financials based on the (potentially new) total.
        
        // Prioritize explicit Margin %, fallback to 15%
        const targetMargin = normalized.marginPercent || 15;
        
        // Calculate Buy Price based on Margin % (Profit / Sell)
        // Buy = Sell * (1 - Margin%)
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
        transport_mode: normalized.mode,
        carrier: normalized.carrier_name,
        transit_time: typeof normalized.transit_time === 'string' ? { details: normalized.transit_time } : (normalized.transit_time?.details ? normalized.transit_time : { details: normalized.transit_time }), 
        price_breakdown,
        legs, // Return the enhanced/synthetic legs
        charges, // Return remaining global charges (if any)
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
