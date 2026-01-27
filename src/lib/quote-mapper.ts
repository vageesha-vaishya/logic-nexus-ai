export const calculateQuoteFinancials = (sellPrice: number) => {
    // Business Logic: 15% Profit Margin by default
    const marginPercent = 15;
    const marginAmount = Number((sellPrice * (marginPercent / 100)).toFixed(2));
    const buyPrice = Number((sellPrice - marginAmount).toFixed(2));
    
    // Markup = (Profit / Cost) * 100
    const markupPercent = buyPrice > 0 ? Number(((marginAmount / buyPrice) * 100).toFixed(2)) : 0;
    
    return {
        sellPrice,
        buyPrice,
        marginAmount,
        marginPercent, // Explicit Margin %
        markupPercent  // Explicit Markup % (Cost basis)
    };
};

export const mapOptionToQuote = (opt: any) => {
    if (!opt) return null;
    
    // Idempotency check: We no longer return early. 
    // Instead, we allow the object to flow through to ensure balancing, deduplication, and allocation logic 
    // is always applied, even to already mapped objects. This fixes data inconsistencies in historical quotes.
    
    // Normalize input keys to support different source formats (Smart Quote vs Quick Quote)
    const normalized = {
        ...opt,
        carrier_name: opt.carrier_name || (typeof opt.carrier === 'object' ? opt.carrier?.name : opt.carrier) || 'Unknown Carrier',
        option_name: opt.option_name || opt.name,
        total_amount: opt.total_amount || opt.price,
        mode: opt.mode || opt.transport_mode || opt.name, // Fallback chain
        transit_time: typeof opt.transitTime === 'string' ? { details: opt.transitTime } : (opt.transit_time || {}),
        currency: typeof opt.currency === 'object' ? opt.currency?.code : opt.currency,
        // Financial mappings (DB -> App)
        // Ensure that if we recalculate total later, these old financials don't mislead us.
        // We will recalculate them if needed in the return statement.
        buyPrice: opt.buyPrice ?? opt.total_buy ?? opt.buy_price,
        marginAmount: opt.marginAmount ?? opt.margin_amount,
        marginPercent: opt.marginPercent ?? opt.margin_percent, // Prioritize Margin
        markupPercent: opt.markupPercent ?? opt.markup_percent ?? opt.margin_percentage, // Fallback
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
                        const amount = charge.sell?.amount || charge.amount || 0;
                        const name = (charge.charge_categories?.name || charge.name || '').toLowerCase();
                        if (name.includes('tax') || name.includes('duty')) {
                            taxes += amount;
                        } else if (name.includes('fuel') || name.includes('surcharge')) {
                            surcharges[charge.charge_categories?.name || 'Surcharge'] = amount;
                        } else if (name.includes('fee')) {
                            fees[charge.charge_categories?.name || 'Fee'] = amount;
                        } else {
                            base_fare += amount;
                        }
                    });
                }
            });
        }
        
        // Recalculate total if it's 0 but we have components
        const surchargeTotal = Object.values(surcharges).reduce((sum: number, val: any) => sum + Number(val || 0), 0);
        const feeTotal = Object.values(fees).reduce((sum: number, val: any) => sum + Number(val || 0), 0);
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
            charges: leg.charges || []
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

    // Intelligent Global Charge Allocation (if any remain)
    // Try to move global charges to specific legs based on keywords
    if (charges.length > 0 && legs.length > 0) {
        const remainingGlobalCharges: any[] = [];
        const mainLeg = legs.find((l: any) => l.bifurcation_role === 'main') || legs[0];
        const originLeg = legs.find((l: any) => l.bifurcation_role === 'origin');
        const destLeg = legs.find((l: any) => l.bifurcation_role === 'destination');

        charges.forEach((c: any) => {
            const name = (c.name || c.charge_categories?.name || '').toLowerCase();
            let allocated = false;
            let targetLeg: any = null;

            if (originLeg && (name.includes('pickup') || name.includes('origin') || name.includes('export'))) {
                targetLeg = originLeg;
            } else if (destLeg && (name.includes('delivery') || name.includes('destination') || name.includes('import'))) {
                targetLeg = destLeg;
            } else if (name.includes('freight') || name.includes('bunker') || name.includes('fuel')) {
                // Default freight charges to main leg
                targetLeg = mainLeg;
            } else if (legs.length === 1) {
                // If single leg, everything goes there
                targetLeg = mainLeg;
            }

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
    
    if (price_breakdown) {
        if (duplicatesRemoved) {
             // If we removed duplicates, the original header total was likely double-counted.
             // We MUST overwrite it with the true calculated sum.
             price_breakdown.total = calculatedTotal;
             // Adjust base_fare if needed (simplified)
             if (price_breakdown.base_fare > calculatedTotal) price_breakdown.base_fare = calculatedTotal;
        } else if (Math.abs(price_breakdown.total - calculatedTotal) > 0.01) {
             // If mismatch exists but NO duplicates were found, it might be an incomplete breakdown.
             // Add balancing charge ONLY if the discrepancy is positive (Header > Components)
             const discrepancy = price_breakdown.total - calculatedTotal;
             if (discrepancy > 0) {
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

    // Recalculate Financials if Total Amount Changed significantly
    // This handles the case where historical data had wrong total (12000) but correct components (4256)
    // If we kept the old buyPrice (e.g. 10200), we'd have negative margin.
    let finalBuyPrice = normalized.buyPrice;
    let finalMarginAmount = normalized.marginAmount;
    let finalMarkupPercent = normalized.markupPercent;

    if (Math.abs((normalized.total_amount || 0) - price_breakdown.total) > 0.01) {
        // Total has changed! Recalculate financials based on the new total.
        
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
