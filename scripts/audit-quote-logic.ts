
// ==========================================
// MOCK TYPES
// ==========================================
type Charge = any;
type TransportLeg = any;
type BifurcatedCharge = any;

// ==========================================
// LOGIC FROM src/lib/charge-bifurcation.ts
// ==========================================

const KEYWORD_RULES = [
    // 1. Specific Charge Types (High Priority) - Override positional keywords
    { keywords: ['thc', 'terminal', 'wharfage', 'baf', 'bunker', 'isf', 'ams', 'imo', 'bl fee', 'doc fee'], legType: 'transport', mode: 'ocean' },
    { keywords: ['air freight', 'fsc', 'myc', 'screening', 'security'], legType: 'transport', mode: 'air' },
    { keywords: ['rail freight'], legType: 'transport', mode: 'rail' },
    
    // 2. Main Freight Keywords
    { keywords: ['ocean freight', 'sea freight', 'freight', 'base fare', 'base rate', 'basic freight'], legType: 'transport', mode: 'ocean' },
    
    // 3. Positional Keywords (Pickup/Delivery)
    { keywords: ['pickup', 'origin', 'export', 'drayage origin', 'cartage origin', 'pre-carriage'], legType: 'pickup', mode: 'road' },
    { keywords: ['delivery', 'destination', 'import', 'drayage dest', 'cartage dest', 'on-carriage'], legType: 'delivery', mode: 'road' },
    
    // 4. Generic/Fallback Keywords
    { keywords: ['trucking', 'haulage', 'road freight'], legType: 'transport', mode: 'road' },
    { keywords: ['customs', 'duty', 'tax', 'vat'], legType: 'delivery', mode: 'road' }, 
    { keywords: ['admin', 'handling'], legType: 'transport', mode: 'ocean' },
];

const areLegTypesEquivalent = (t1: string = '', t2: string = '') => {
    const norm1 = t1.toLowerCase();
    const norm2 = t2.toLowerCase();
    if (norm1 === norm2) return true;
    
    const aliases = [
        ['origin', 'pickup', 'pre-carriage', 'drayage origin'],
        ['destination', 'delivery', 'on-carriage', 'drayage dest'],
        ['main', 'transport', 'freight']
    ];
    return aliases.some(group => group.includes(norm1) && group.includes(norm2));
};

function matchLegForCharge(description: string, legs: TransportLeg[]): TransportLeg | undefined {
    const desc = description.toLowerCase();
    
    const matchedRule = KEYWORD_RULES.find(rule => 
        rule.keywords.some(k => desc.includes(k))
    );

    if (matchedRule) {
        let targetLeg = legs.find((l: any) => 
            areLegTypesEquivalent(l.leg_type, matchedRule.legType) && 
            (!matchedRule.mode || l.mode.toLowerCase().includes(matchedRule.mode))
        );

        if (!targetLeg) {
            targetLeg = legs.find((l: any) => areLegTypesEquivalent(l.leg_type, matchedRule.legType));
        }

        if (!targetLeg && (matchedRule.legType === 'pickup' || matchedRule.legType === 'delivery')) {
            const sortedLegs = [...legs].sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));
            if (sortedLegs.length > 1) {
                if (matchedRule.legType === 'pickup') {
                    const firstLeg = sortedLegs[0];
                    if (firstLeg && firstLeg.mode === 'road') {
                        targetLeg = firstLeg;
                    }
                } else if (matchedRule.legType === 'delivery') {
                    const lastLeg = sortedLegs[sortedLegs.length - 1];
                    if (lastLeg && lastLeg.mode === 'road') {
                        targetLeg = lastLeg;
                    }
                }
            }
        }
        
        return targetLeg;
    }
    return undefined;
}

// ==========================================
// LOGIC FROM src/lib/quote-mapper.ts
// ==========================================

const calculateFinancials = (amount: number, marginPercent: number = 15, isCostBased: boolean = true) => {
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

const mapOptionToQuote = (opt: any) => {
    if (!opt) return null;
    
    const safeNumber = (val: any) => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'string') {
            val = val.replace(/,/g, '');
        }
        const num = Number(val);
        return isFinite(num) ? num : 0;
    };
    
    const normalized: any = {
        ...opt,
        carrier_name: opt.carrier_name || (typeof opt.carrier === 'object' ? opt.carrier?.name : opt.carrier) || 'Unknown Carrier',
        option_name: opt.option_name || opt.name,
        total_amount: safeNumber(opt.total_amount || opt.price),
        mode: opt.mode || opt.transport_mode || opt.name, 
        transit_time: typeof opt.transitTime === 'string' ? { details: opt.transitTime } : (opt.transit_time || {}),
        currency: typeof opt.currency === 'object' ? opt.currency?.code : opt.currency,
        buyPrice: safeNumber(opt.buyPrice ?? opt.total_buy ?? opt.buy_price),
        marginAmount: safeNumber(opt.marginAmount ?? opt.margin_amount),
        marginPercent: safeNumber(opt.marginPercent ?? opt.margin_percent), 
        markupPercent: safeNumber(opt.markupPercent ?? opt.markup_percent ?? opt.margin_percentage), 
    };
    
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
            charges: leg.charges || []
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
                targetLeg = mainLeg;
            } else if (legs.length === 1) {
                targetLeg = mainLeg;
            }

            if (targetLeg) {
                const isDuplicate = targetLeg.charges.some((existing: any) => {
                    const amountMatch = Math.abs((existing.amount || 0) - (c.amount || 0)) < 0.01;
                    const currencyMatch = (existing.currency || 'USD') === (c.currency || 'USD');
                    const existingName = (existing.name || existing.charge_categories?.name || '').toLowerCase();
                    const nameMatch = existingName.includes(name) || name.includes(existingName) || 
                                      (existingName.includes('freight') && name.includes('freight')) ||
                                      (existingName.includes('fee') && name.includes('fee'));
                    return amountMatch && currencyMatch && nameMatch;
                });

                if (isDuplicate) {
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
        legs, 
        charges, 
        reliability: { score: normalized.reliability_score || normalized.reliability?.score || 0 },
        tier: normalized.tier || 'standard',
        environmental: normalized.environmental || (normalized.total_co2_kg ? { co2_emissions: `${normalized.total_co2_kg} kg` } : undefined),
        ai_generated: normalized.ai_generated || (normalized.source_attribution && normalized.source_attribution.includes("AI"))
    };
};

// ==========================================
// TEST EXECUTION
// ==========================================

// Mock Data from AI Advisor
const mockAiResponse = {
  options: [
    {
      id: "ai-generated-1",
      transport_mode: "Ocean - FCL",
      carrier: { name: "Maersk", service_level: "Direct" },
      legs: [
        {
          sequence: 1,
          mode: "road",
          charges: [
            { name: "Pickup Haulage", amount: 450, currency: "USD", unit: "per_trip" }
          ]
        },
        {
          sequence: 2,
          mode: "ocean",
          charges: [
            { name: "Ocean Freight", amount: 2000, currency: "USD", unit: "per_container" }
          ]
        }
      ],
      price_breakdown: {
        base_fare: 2000,
        surcharges: {},
        fees: { pickup: 450 },
        total: 2450,
        currency: "USD"
      },
      source_attribution: "AI Advisor"
    }
  ]
};

async function runAudit() {
  console.log("=== Starting Quote Logic Audit ===\n");

  const rawOption = mockAiResponse.options[0];
  console.log("1. Input (AI Response Mock):");
  console.log(JSON.stringify(rawOption, null, 2));

  // Step 1: Map Option
  console.log("\n2. Running mapOptionToQuote...");
  const mapped = mapOptionToQuote(rawOption);
  console.log("Mapped Result (Partial):");
  console.log(JSON.stringify({
    total_amount: mapped.total_amount,
    buyPrice: mapped.buyPrice,
    marginAmount: mapped.marginAmount,
    charges: mapped.charges,
    legs: mapped.legs
  }, null, 2));

  // Step 2: Simulate QuoteNew.tsx Financial Calculation
  console.log("\n3. Simulating QuoteNew.tsx Financial Logic...");
  const sellPrice = mapped.total_amount || 0;
  let financials;
  
  if (mapped.buyPrice !== undefined && mapped.marginAmount !== undefined && mapped.buyPrice !== 0) {
      console.log("Using Mapped Financials");
      financials = { buyPrice: mapped.buyPrice, marginAmount: mapped.marginAmount, markupPercent: mapped.markupPercent };
  } else {
      console.log("Calculating Default Financials (Treating Input as Sell Price)");
      financials = calculateFinancials(sellPrice, 15, false);
  }
  console.log("Financials (Legacy Mode):", financials);

  // Test New Financial Logic
  const costFinancials = calculateFinancials(sellPrice, 15, true);
  console.log("Financials (Cost-Plus Mode):", costFinancials);

  // Analysis of Financials
  console.log("\n[Analysis] Financial Logic:");
  if (financials.buyPrice < sellPrice) {
      console.log(`⚠️  System treated input ($${sellPrice}) as SELL PRICE.`);
      console.log(`   Calculated Cost: $${financials.buyPrice}`);
      console.log(`   Implied Margin: $${financials.marginAmount} (${financials.marginPercent || 15}%)`);
      console.log(`   Risk: If input was actually Carrier Cost ($${sellPrice}), we are underestimating cost by $${(sellPrice - financials.buyPrice).toFixed(2)}.`);
  }

  // Step 3: Simulate QuoteNew.tsx Charge Insertion Logic
  console.log("\n4. Simulating Charge Insertion & Duplication Check...");
  const insertedCharges: any[] = [];
  const rateLegs = mapped.legs || [];
  const globalCharges = mapped.charges || [];

  // Priority 1: Leg Charges
  rateLegs.forEach((leg: any, i: number) => {
      if (leg.charges) {
          leg.charges.forEach((c: any) => {
              insertedCharges.push({ source: `Leg ${i}`, name: c.name, amount: c.amount });
          });
      }
  });

  // Priority 2: Global Charges
  globalCharges.forEach((c: any) => {
      insertedCharges.push({ source: 'Global', name: c.name, amount: c.amount });
  });

  console.log("Inserted Charges:");
  console.table(insertedCharges);

  const totalInserted = insertedCharges.reduce((sum, c) => sum + c.amount, 0);
  console.log(`Total Inserted Amount: ${totalInserted}`);
  console.log(`Original Total: ${sellPrice}`);

  if (totalInserted > sellPrice) {
      console.log(`❌ DUPLICATION DETECTED: Inserted ($${totalInserted}) > Total ($${sellPrice})`);
  } else if (totalInserted === sellPrice) {
      console.log(`✅ Sum Matches Total: No obvious duplication.`);
  } else {
      console.log(`⚠️  Sum < Total: Missing charges?`);
  }

  // Step 4: Bifurcation Check
  console.log("\n5. Checking Charge Bifurcation Logic...");
  const testCharges = ["Pickup Haulage", "Ocean Freight", "Destination THC", "Unknown Fee"];
  testCharges.forEach(name => {
      const mockLegs: any[] = [
          { id: 'l1', leg_type: 'pickup', mode: 'road', sequence: 1 },
          { id: 'l2', leg_type: 'transport', mode: 'ocean', sequence: 2 },
          { id: 'l3', leg_type: 'delivery', mode: 'road', sequence: 3 }
      ];
      const result = matchLegForCharge(name, mockLegs);
      console.log(`Charge "${name}" mapped to: ${result ? `${result.leg_type} (${result.mode})` : 'None'}`);
  });
}

runAudit().catch(console.error);
