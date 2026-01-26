export const calculateQuoteFinancials = (sellPrice: number) => {
    const marginAmount = Number((sellPrice * 0.15).toFixed(2));
    const buyPrice = Number((sellPrice - marginAmount).toFixed(2));
    const markupPercent = buyPrice > 0 ? Number(((marginAmount / buyPrice) * 100).toFixed(2)) : 0;
    
    return {
        sellPrice,
        buyPrice,
        marginAmount,
        markupPercent
    };
};

export const mapOptionToQuote = (opt: any) => {
    if (!opt) return null;
    
    // Idempotency check: if already mapped (has nested structure), return as is
    if (opt.price_breakdown && typeof opt.transit_time === 'object' && opt.transit_time?.details && opt.charges) {
        return opt;
    }
    
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
        buyPrice: opt.buyPrice ?? opt.total_buy ?? opt.buy_price,
        marginAmount: opt.marginAmount ?? opt.margin_amount,
        markupPercent: opt.markupPercent ?? opt.markup_percent ?? opt.margin_percentage,
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
        const surchargeTotal = Object.values(surcharges).reduce((sum: number, val: any) => sum + val, 0);
        const feeTotal = Object.values(fees).reduce((sum: number, val: any) => sum + val, 0);
        const componentsSum = base_fare + taxes + surchargeTotal + feeTotal;

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

    // Balancing Charge: Ensure total matches the quoted price
    // This mirrors the logic in QuoteNew.tsx to prevent discrepancies
    // Now applied universally to catch mismatches in both Smart and Quick quotes
    if (price_breakdown && price_breakdown.total > 0) {
        const chargesTotal = charges.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
        const discrepancy = price_breakdown.total - chargesTotal;
        
        // Use a tighter threshold (0.01) to catch floating point errors and ensure precision
        if (Math.abs(discrepancy) > 0.01) {
             const name = discrepancy > 0 ? 'Ancillary Fees' : 'Discount / Adjustment';
             const note = discrepancy > 0 ? 'Unitemized surcharges' : 'Bundle discount adjustment';
             
             // Only add if not already present (simple check)
             const hasAdjustment = charges.some((c: any) => c.category === 'Adjustment' && Math.abs(c.amount - discrepancy) < 0.01);
             if (!hasAdjustment) {
                const currency = price_breakdown.currency || normalized.currency || 'USD';
                charges = [...charges, { category: 'Adjustment', name, amount: Number(discrepancy.toFixed(2)), currency, unit: 'per_shipment', note }];
             }
        }
    }

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
                return !legChargeSignatures.has(sig);
            });
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

            if (originLeg && (name.includes('pickup') || name.includes('origin') || name.includes('export'))) {
                originLeg.charges.push(c);
                allocated = true;
            } else if (destLeg && (name.includes('delivery') || name.includes('destination') || name.includes('import'))) {
                destLeg.charges.push(c);
                allocated = true;
            } else if (name.includes('freight') || name.includes('bunker') || name.includes('fuel')) {
                // Default freight charges to main leg
                mainLeg.charges.push(c);
                allocated = true;
            } else if (legs.length === 1) {
                // If single leg, everything goes there
                mainLeg.charges.push(c);
                allocated = true;
            }

            if (!allocated) {
                remainingGlobalCharges.push(c);
            }
        });
        
        charges = remainingGlobalCharges;
    }

    return {
        ...normalized,
        total_amount: price_breakdown.total,
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
