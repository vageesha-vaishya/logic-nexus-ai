import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { QuoteFormRefactored as QuoteForm } from '@/components/sales/quote-form/QuoteFormRefactored';
import { MultiModalQuoteComposer } from '@/components/sales/MultiModalQuoteComposer';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from '@/components/ui/breadcrumb';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { QuoteTemplateList } from '@/components/sales/templates/QuoteTemplateList';
import { QuoteTemplate } from '@/components/sales/templates/types';
import { FileText, Loader2 } from 'lucide-react';
import { QuoteFormValues } from '@/components/sales/quote-form/types';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { QuoteTransferSchema } from '@/lib/schemas/quote-transfer';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { matchLegForCharge } from '@/lib/charge-bifurcation';
import { TransportLeg } from '@/types/quote-breakdown';

export default function QuoteNew() {
  const { supabase, context, scopedDb } = useCRM();
  const location = useLocation();
  const [createdQuoteId, setCreatedQuoteId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateData, setTemplateData] = useState<Partial<QuoteFormValues> | undefined>(undefined);
  const [generatedOptionIds, setGeneratedOptionIds] = useState<string[]>([]);

  const [optionsInserted, setOptionsInserted] = useState(false);
  const [isInsertingOptions, setIsInsertingOptions] = useState(false);
  const [insertionError, setInsertionError] = useState<string | null>(null);
  const [insertionProgress, setInsertionProgress] = useState({ current: 0, total: 0 });
  const [insertionStartTime, setInsertionStartTime] = useState<number | null>(null);

  // Timeout monitor
  useEffect(() => {
    if (isInsertingOptions && insertionStartTime) {
      const timeoutId = setTimeout(() => {
        if (isInsertingOptions) {
          console.error('[QuoteNew] Insertion timed out after 30s');
          setInsertionError('Operation timed out. Please try again.');
          setIsInsertingOptions(false);
          // Allow user to proceed even if incomplete
          setOptionsInserted(true); 
          toast.error('Quote generation timed out. Some options may be missing.');
        }
      }, 30000);
      return () => clearTimeout(timeoutId);
    }
  }, [isInsertingOptions, insertionStartTime]);
  
  // Cache for master data to populate form
  const [masterData, setMasterData] = useState<{
    serviceTypes: any[];
    carriers: any[];
  }>({ serviceTypes: [], carriers: [] });

  // Fetch master data on mount
  useEffect(() => {
    const fetchMasterData = async () => {
        try {
            const { data: st, error: stError } = await scopedDb.from('service_types').select('id, name, code');
            if (stError) console.error('[QuoteNew] Error fetching service types:', stError);

            const { data: c, error: cError } = await scopedDb.from('carriers').select('id, carrier_name, scac');
            if (cError) console.error('[QuoteNew] Error fetching carriers:', cError);

            setMasterData({
                serviceTypes: st || [],
                carriers: c || []
            });
        } catch (error) {
            console.error('[QuoteNew] Unexpected error fetching master data:', error);
        }
    };
    fetchMasterData();
  }, [scopedDb]);

  useEffect(() => {
    if (location.state) {
      let state = location.state as any;
      try {
          // Attempt to validate, but don't block execution to support legacy data/partial states
          const validated = QuoteTransferSchema.safeParse(location.state);
          if (validated.success) {
             state = validated.data;
             logger.info('QuoteNew received valid transfer data', { origin: state.origin, mode: state.mode });
          } else {
             logger.warn('QuoteNew received transfer data with validation issues', { errors: validated.error.errors });
             // We proceed with 'any' cast state but log the warning
          }
      } catch (e) {
          console.error("Validation crash:", e);
      }

      const selectedRates = state.selectedRates || (state.selectedRate ? [state.selectedRate] : []);
      
      let notesContent = `Quick Quote Conversion:
Origin: ${state.origin}
Destination: ${state.destination}
Mode: ${state.mode}`;

      if (selectedRates.length > 0) {
        notesContent += `\n\nSelected Options (${selectedRates.length}):`;
        selectedRates.forEach((rate: any, index: number) => {
             notesContent += `\n\nOption ${index + 1}: ${rate.carrier} - ${rate.name}
Price: ${rate.price} (${rate.currency})
Tier: ${rate.tier?.toUpperCase() || 'N/A'}
Transit: ${rate.transitTime}
Route: ${rate.route_type || 'Standard'}
CO2: ${rate.co2_kg ? rate.co2_kg + ' kg' : 'N/A'}`;
        });
      }

      // Determine Trade Direction (heuristic)
      let tradeDirection: 'export' | 'import' | undefined = 'export';
      if (state.trade_direction) {
          tradeDirection = state.trade_direction;
      }

      // Resolve IDs
      const modeMap: Record<string, string> = {
          'ocean': 'Sea',
          'sea': 'Sea',
          'air': 'Air',
          'road': 'Road',
          'truck': 'Road',
          'rail': 'Rail'
      };
      
      const targetMode = modeMap[state.mode?.toLowerCase()] || state.mode;
      const serviceTypeId = masterData.serviceTypes?.length > 0 ? masterData.serviceTypes.find(
          st => st.name.toLowerCase().includes(targetMode?.toLowerCase()) || 
                st.code.toLowerCase() === targetMode?.toLowerCase()
      )?.id : undefined;

      const primaryRate = selectedRates[0];
      let carrierId = undefined;
      if (primaryRate && masterData.carriers?.length > 0) {
          carrierId = masterData.carriers.find(
              c => c.carrier_name.toLowerCase().includes(primaryRate.carrier.toLowerCase()) || 
                   c.scac?.toLowerCase() === primaryRate.carrier.toLowerCase()
          )?.id;
      }

      setTemplateData(prev => ({
        ...prev,
        total_weight: state.weight?.toString(),
        commodity: state.commodity,
        account_id: state.accountId,
        valid_until: primaryRate?.validUntil ? new Date(primaryRate.validUntil).toISOString().split('T')[0] : undefined,
        notes: notesContent,
        title: `Quote for ${state.commodity || 'General Cargo'} (${state.origin} -> ${state.destination})`,
        trade_direction: tradeDirection,
        origin_port_id: state.originId || state.originDetails?.id,
        destination_port_id: state.destinationId || state.destinationDetails?.id,
        service_type_id: serviceTypeId,
        carrier_id: carrierId,
        shipping_amount: primaryRate?.price?.toString(),
        // Default Incoterms if usually Export
        incoterms: tradeDirection === 'export' ? 'CIF' : 'FOB' 
      }));
    }
  }, [location.state, masterData]);

  // ... (handleTemplateSelect and handleSuccess remain the same) ...

  // Insert selected options once version is created
  useEffect(() => {
    const insertOptions = async () => {
      // Requirements: Version created, Tenant ID known, Options available, Not yet inserted
      if (!versionId || !tenantId || optionsInserted || isInsertingOptions || !location.state) return;

      const state = location.state as any;
      const selectedRates = state.selectedRates; 

      if (!selectedRates || !Array.isArray(selectedRates) || selectedRates.length === 0) return;

      logger.info('[QuoteNew] Starting option insertion', { count: selectedRates.length, versionId });
      setIsInsertingOptions(true);
      setInsertionStartTime(performance.now());
      setInsertionProgress({ current: 0, total: selectedRates.length });
      setInsertionError(null);

      try {
        const startTime = performance.now();

        // 0. Update Version with AI Analysis (if available)
        if (state.marketAnalysis || state.confidenceScore) {
             const { error: versionUpdateError } = await scopedDb.from('quotation_versions').update({
                 market_analysis: state.marketAnalysis,
                 confidence_score: state.confidenceScore,
                 anomalies: state.anomalies ? (Array.isArray(state.anomalies) ? state.anomalies : []) : []
             }).eq('id', versionId);
             
             if (versionUpdateError) {
                 console.warn('[QuoteNew] Failed to save AI analysis to version:', versionUpdateError);
             }
        }

        // 1. Fetch Master Data in Parallel
        const [
            { data: categories },
            { data: sides },
            { data: bases },
            { data: currencies },
            { data: serviceTypes },
            { data: serviceModes },
            { data: carriers }
        ] = await Promise.all([
            scopedDb.from('charge_categories', true).select('id, code, name'),
            scopedDb.from('charge_sides', true).select('id, code, name'),
            scopedDb.from('charge_bases', true).select('id, code, name'),
            scopedDb.from('currencies', true).select('id, code'),
            scopedDb.from('service_types', true).select('id, code, name, transport_modes(code)'),
            scopedDb.from('service_modes', true).select('id, code, name'),
            scopedDb.from('carriers', true).select('id, carrier_name, scac')
        ]);

        // Helpers
        const getCatId = (code: string) => {
            const normalizedCode = code.toUpperCase().replace(/_/g, ' ');
            const exact = categories?.find((c: any) => c.code === code || c.name.toUpperCase() === normalizedCode)?.id;
            if (exact) return exact;
            
            const mappings: Record<string, string> = {
                'BASE_FARE': 'FREIGHT', 'FREIGHT': 'FREIGHT', 'TAXES': 'TAXES',
                'SURCHARGES': 'SURCHARGE', 'FUEL': 'FUEL_SURCHARGE',
                'PICKUP': 'PICKUP', 'DELIVERY': 'DELIVERY',
                'DOCUMENTATION': 'DOCUMENTATION', 'CUSTOMS': 'CUSTOMS_CLEARANCE',
                'INSURANCE': 'INSURANCE', 'HANDLING': 'HANDLING',
                'THC': 'TERMINAL_HANDLING', 'BUNKER': 'BUNKER_ADJUSTMENT'
            };
            const mappedCode = mappings[code] || mappings[normalizedCode];
            if (mappedCode) {
                 const mapped = categories?.find((c: any) => c.code === mappedCode || c.name.toUpperCase() === mappedCode)?.id;
                 if (mapped) return mapped;
            }
            const keywordMatch = categories?.find((c: any) => c.name.toUpperCase().includes(normalizedCode) || c.code.includes(code))?.id;
            if (keywordMatch) return keywordMatch;
            return categories?.find((c: any) => c.code === 'SURCHARGE')?.id || categories?.[0]?.id;
        };

        const getSideId = (code: string) => sides?.find((s: any) => s.code?.toLowerCase() === code.toLowerCase() || s.name?.toLowerCase() === code.toLowerCase())?.id;
        const getBasisId = (code: string) => bases?.find((b: any) => b.code?.toLowerCase() === code.toLowerCase())?.id || bases?.find((b: any) => b.code === 'shipment' || b.name === 'Per Shipment')?.id;
        const getCurrId = (code: string) => currencies?.find((c: any) => c.code === code)?.id || currencies?.find((c: any) => c.code === 'USD')?.id;
        
        const getServiceTypeId = (mode: string, tier?: string) => {
            if (!serviceTypes) return null;
            
            const modeKey = (mode || '').toLowerCase();
            const tierKey = (tier || '').toLowerCase();

            if (tierKey) {
                const tierMatch = serviceTypes.find((st: any) => 
                    st.code?.toLowerCase() === tierKey || 
                    st.name?.toLowerCase() === tierKey
                );
                if (tierMatch) return tierMatch.id;
            }

            // Try exact mode match
            let modeMatch = serviceTypes.find((st: any) => st.transport_modes?.code?.toLowerCase() === modeKey);
            if (modeMatch) return modeMatch.id;

            // Try split mode match (e.g. "Ocean - FCL" -> "sea")
            const splitMode = modeKey.split(/[\s-]+/)[0];
            const map: Record<string, string> = { 'ocean': 'sea', 'truck': 'road' };
            const target = map[splitMode] || splitMode;

            modeMatch = serviceTypes.find((st: any) => st.transport_modes?.code?.toLowerCase() === target);
            return modeMatch?.id || serviceTypes[0]?.id;
        };

        const getModeId = (modeName: string) => {
             if (!modeName) return null;
             const normalized = modeName.toLowerCase();
             // Map common terms
             const map: Record<string, string> = { 'ocean': 'sea', 'truck': 'road', 'air': 'air' };
             
             // 1. Try exact/mapped match
             let target = map[normalized] || normalized;
             let match = serviceModes?.find((m: any) => m.code.toLowerCase() === target || m.name.toLowerCase() === target);
             if (match) return match.id;
             
             // 2. Try split match
             const split = normalized.split(/[\s-]+/)[0];
             target = map[split] || split;
             match = serviceModes?.find((m: any) => m.code.toLowerCase() === target || m.name.toLowerCase() === target);
             if (match) return match.id;

             // 3. Fallback to sea/ocean if reasonable default needed, or null
             return serviceModes?.find((m: any) => m.code.toLowerCase() === 'sea')?.id || null;
        };

        const getProviderId = (carrierName: string) => {
             if (!carrierName) return null;
             const normalized = carrierName.toLowerCase();
             return carriers?.find((c: any) => c.carrier_name.toLowerCase().includes(normalized) || c.scac?.toLowerCase() === normalized)?.id;
        };

        const buySideId = getSideId('buy') || getSideId('cost');
        const sellSideId = getSideId('sell') || getSideId('revenue');

        if (!buySideId || !sellSideId) {
             console.error('[QuoteNew] Master Data Missing: Sides', { sides });
             throw new Error(`Missing charge sides configuration. Found ${sides?.length} sides.`);
        }

        // Process each rate concurrently
        const newOptionIds: string[] = [];

        const processRate = async (rawRate: any) => {
            try {
                // Normalize rate using centralized mapper to ensure consistency with Quick Quote/Smart Quote UI
                // This handles charge synthesis, balancing charges, and field normalization
                const rate = mapOptionToQuote(rawRate);

                // Insert Option
                const sellPrice = rate.total_amount || rate.price || 0;
                const marginAmount = Number((sellPrice * 0.15).toFixed(2));
                const buyPrice = Number((sellPrice - marginAmount).toFixed(2));
                const markupPercent = buyPrice > 0 ? Number(((marginAmount / buyPrice) * 100).toFixed(2)) : 0;
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rate.id);

                // Calculate total CO2
                const totalCo2 = rate.co2_kg || (rate.legs?.reduce((acc: number, leg: any) => acc + (Number(leg.co2_emission) || Number(leg.co2) || 0), 0)) || 0;

                const { data: optionData, error: optionError } = await scopedDb
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
                    quote_currency_id: getCurrId(rate.currency || 'USD'),
                    transit_time: rate.transitTime,
                    total_transit_days: rate.transitTime ? parseInt(rate.transitTime.match(/\d+/)?.[0] || '0') || null : null,
                    valid_until: rate.validUntil ? new Date(rate.validUntil).toISOString() : null,
                    
                    // New fields for AI/Source tracking
                    reliability_score: rate.reliability_score || rate.reliability?.score,
                    ai_generated: rate.ai_generated || rate.source_attribution === 'AI Smart Engine',
                    ai_explanation: rate.ai_explanation,
                    source: rate.source_attribution || 'quick_quote',
                    total_co2_kg: totalCo2,
                    
                    status: 'active'
                  })
                  .select('id')
                  .single();

                if (optionError) {
                   console.error('[QuoteNew] Option Insert Error:', optionError);
                   throw optionError;
                }
                const optionId = optionData.id;
                newOptionIds.push(optionId);

                // Insert Legs
                const legsToInsert: any[] = [];
                const rateLegs = (rate.legs && rate.legs.length > 0) ? rate.legs : [{ mode: rate.transport_mode || 'ocean' }];

                const parseDurationToHours = (duration: string | number | undefined) => {
                    if (typeof duration === 'number') return duration; 
                    if (!duration) return null;
                    const str = String(duration).toLowerCase();
                    const val = parseFloat(str);
                    if (isNaN(val)) return null;
                    if (str.includes('day')) return Math.round(val * 24);
                    return Math.round(val);
                };

                // Ensure legs are sorted if they have a sequence number
                if (rateLegs.length > 1 && rateLegs.every((l: any) => typeof l.sequence === 'number' || typeof l.leg_order === 'number')) {
                    rateLegs.sort((a: any, b: any) => (a.sequence || a.leg_order || 0) - (b.sequence || b.leg_order || 0));
                }

                rateLegs.forEach((leg: any, index: number) => {
                    const legMode = leg.mode || rate.transport_mode || 'ocean';
                    const carrierName = leg.carrier || rate.carrier_name || rate.carrier || rate.provider;
                    const serviceTypeId = getServiceTypeId(legMode, rate.tier);
                    
                    // Smart location fallback
                    // Only use main origin/destination for the first/last legs respectively
                    const isFirstLeg = index === 0;
                    const isLastLeg = index === rateLegs.length - 1;

                    let origin = leg.from || leg.origin || leg.pol;
                    if (!origin && isFirstLeg) {
                        origin = state.originDetails?.formatted_address || state.origin;
                    }

                    let destination = leg.to || leg.destination || leg.pod;
                    if (!destination && isLastLeg) {
                        destination = state.destinationDetails?.formatted_address || state.destination;
                    }

                    // Validation: If not first leg, try to fill origin from previous leg's destination if missing
                    if (!origin && !isFirstLeg && legsToInsert[index - 1]?.destination_location) {
                        origin = legsToInsert[index - 1].destination_location;
                    }
                    
                    // Determine Leg Type dynamically
                    let legType = 'transport';
                    const modeLower = legMode.toLowerCase();
                    if (rateLegs.length > 1) {
                        if (isFirstLeg && (modeLower.includes('road') || modeLower.includes('truck'))) legType = 'pickup';
                        else if (isLastLeg && (modeLower.includes('road') || modeLower.includes('truck'))) legType = 'delivery';
                    }

                    legsToInsert.push({
                        quotation_version_option_id: optionId,
                        tenant_id: tenantId,
                        mode_id: getModeId(legMode),
                        mode: legMode,
                        service_type_id: serviceTypeId,
                        provider_id: getProviderId(carrierName),
                        origin_location: origin || (isFirstLeg ? state.origin : null), // Fallback for safety
                        destination_location: destination || (isLastLeg ? state.destination : null),
                        sort_order: index + 1,
                        leg_type: legType,
                        transit_time_hours: parseDurationToHours(leg.transit_time),
                        co2_kg: leg.co2_emission || leg.co2 || null,
                        voyage_number: leg.voyage_number || leg.voyage || null
                    });
                });

                const { data: legData, error: legError } = await scopedDb
                    .from('quotation_version_option_legs')
                    .insert(legsToInsert)
                    .select('id, mode_id, leg_type, sort_order, service_type_id');

                if (legError) throw legError;

                // Sort legData by order to ensure correct mapping
                legData?.sort((a: any, b: any) => a.sort_order - b.sort_order);

                // Create rich leg objects for matching logic (combining DB IDs with Mode strings)
                const legsForMatching: TransportLeg[] = (legData || []).map((l: any) => {
                    const original = legsToInsert.find(i => i.sort_order === l.sort_order);
                    return {
                        id: l.id,
                        leg_type: l.leg_type || 'transport',
                        mode: original?.mode || 'ocean',
                        origin: original?.origin_location || '',
                        destination: original?.destination_location || '',
                        sequence: l.sort_order,
                        charges: [] // Mock for interface satisfaction
                    } as TransportLeg;
                });

                // Determine Main Leg
                const targetModeId = getModeId(rate.transport_mode || 'ocean');
                const mainLeg = legData?.find((l: any) => l.mode_id === targetModeId && l.leg_type === 'transport') || legData?.[0];
                const mainLegId = mainLeg?.id;

                // Insert Charges
                const chargesToInsert: any[] = [];
                
                const addChargePair = (categoryKey: string, amount: number, note: string, targetLegId: string | null, basisCode?: string, chargeUnit?: string): boolean => {
                    const catId = getCatId(categoryKey);
                    const basisId = getBasisId(basisCode || '') || getBasisId('PER_SHIPMENT');
                    const currId = getCurrId(rate.currency || 'USD');
                    if (!catId) return false;
                    
                    // Fallback to mainLegId if targetLegId is null, ensuring we never send null for leg_id
                    const finalLegId = targetLegId || mainLegId || legData?.[0]?.id;
                    
                    if (!finalLegId) {
                        console.warn('[QuoteNew] Skipping charge insertion: No valid leg ID found', { categoryKey, amount });
                        return false;
                    }

                    chargesToInsert.push(
                        { tenant_id: tenantId, quote_option_id: optionId, leg_id: finalLegId, category_id: catId, basis_id: basisId, charge_side_id: buySideId, quantity: 1, rate: Number((amount * 0.85).toFixed(2)), amount: Number((amount * 0.85).toFixed(2)), currency_id: currId, note: note, unit: chargeUnit },
                        { tenant_id: tenantId, quote_option_id: optionId, leg_id: finalLegId, category_id: catId, basis_id: basisId, charge_side_id: sellSideId, quantity: 1, rate: Number(amount.toFixed(2)), amount: Number(amount.toFixed(2)), currency_id: currId, note: note, unit: chargeUnit }
                    );
                    return true;
                };

                const getLegIdForCharge = (chargeKey: string, explicitLegIndex?: number) => {
                    if (!legData?.length) return null;
                    
                    // Priority 1: Explicit Index
                    if (typeof explicitLegIndex === 'number' && legData[explicitLegIndex]) {
                        return legData[explicitLegIndex].id;
                    }

                    // Priority 2: Use shared bifurcation logic
                    // matchLegForCharge uses keywords like 'pickup', 'freight', 'delivery' to find the best leg
                    const matchedLeg = matchLegForCharge(chargeKey, legsForMatching);
                    if (matchedLeg) return matchedLeg.id;

                    // Priority 3: Fallback to old hardcoded checks if shared logic misses (unlikely but safe)
                    const key = chargeKey.toLowerCase();
                    if (key.includes('pickup') || key.includes('origin') || key.includes('pre_carriage') || key.includes('export')) return legData[0].id;
                    if (key.includes('delivery') || key.includes('destination') || key.includes('on_carriage') || key.includes('import')) return legData[legData.length - 1].id;
                    
                    // Priority 4: Main Leg (Ocean/Air) or First Leg
                    return mainLegId || legData[0].id;
                };

                // Priority 1: Handle explicit 'charges' array (common in carrier APIs)
                if (Array.isArray(rate.charges) && rate.charges.length > 0) {
                    rate.charges.forEach((charge: any) => {
                        const amount = Number(charge.amount || charge.price || charge.total || 0);
                        if (amount === 0) return;

                        const desc = charge.description || charge.name || charge.code || 'Charge';
                        const legId = getLegIdForCharge(desc);
                        const unit = charge.unit || charge.basis;
                        
                        addChargePair(desc, amount, desc, legId, unit, unit);
                    });
                } 
                // Priority 2: Handle 'price_breakdown' object (AI/Recursive structure)
                else {
                    const breakdown = rate.price_breakdown || { base_fare: sellPrice };
                    let totalBreakdownAmount = 0;
                    
                    const processCharge = (key: string, value: any, parentKey: string = '') => {
                        // 1. GLOBAL FILTER: Skip reserved keys at ANY level
                        // This prevents double counting when AI returns both itemized charges and their totals
                        if (['total', 'total_amount', 'total_price', 'subtotal', 'currency', 'currency_code', 'exchange_rate', 'symbol'].includes(key.toLowerCase())) {
                            return;
                        }

                        if (typeof value === 'number' && value !== 0) {
                            const compositeKey = parentKey ? `${parentKey}_${key}` : key;
                            // Check if parent key implies a specific leg (e.g., legs[0])
                            let explicitIndex: number | undefined = undefined;
                            if (parentKey.match(/legs?_?\[?(\d+)\]?/i)) {
                                const match = parentKey.match(/legs?_?\[?(\d+)\]?/i);
                                if (match) explicitIndex = parseInt(match[1]);
                            }

                            const legId = getLegIdForCharge(compositeKey, explicitIndex);
                            const formatNote = (str: string) => str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            if (addChargePair(key, value, formatNote(compositeKey), legId)) {
                                totalBreakdownAmount += value;
                            }
                            return;
                        } 
                        
                        if (typeof value === 'object' && value !== null) {
                            // Check if it is a "Charge Object" (has amount + identifier)
                            const amountKey = ['amount', 'price', 'value', 'total'].find(k => typeof value[k] === 'number');
                            const codeKey = ['code', 'name', 'type', 'description', 'id', 'charge_code'].find(k => typeof value[k] === 'string');
    
                            if (amountKey) {
                                // It's a charge object!
                                const amount = value[amountKey];
                                const code = codeKey ? value[codeKey] : key;
                                const unitKey = ['unit', 'basis', 'per'].find(k => typeof value[k] === 'string');
                                const unit = unitKey ? value[unitKey] : undefined;
                                
                                // Check for explicit leg assignment in object
                                const legIndexKey = ['leg_index', 'leg_id', 'segment_index'].find(k => typeof value[k] === 'number');
                                const explicitIndex = legIndexKey ? value[legIndexKey] : undefined;

                                const compositeKey = parentKey ? `${parentKey}_${code}` : code;
                                const legId = getLegIdForCharge(compositeKey, explicitIndex);
                                const formatNote = (str: string) => str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                
                                // Use the found code as the category key and pass unit/basis if found
                                if (addChargePair(code, amount, formatNote(compositeKey), legId, unit, unit)) {
                                    totalBreakdownAmount += amount;
                                }
                                return;
                            }
    
                            // Otherwise recurse
                            const newParentKey = parentKey ? `${parentKey}_${key}` : key;
                            Object.entries(value).forEach(([k, v]) => processCharge(k, v, newParentKey));
                        }
                    };
    
                    Object.entries(breakdown).forEach(([key, val]) => {
                        processCharge(key, val);
                    });

                    // 2. BALANCING CHARGE: Ensure total matches the quoted price
                    // If parts < total, add adjustment. If parts > total, add discount.
                    const discrepancy = sellPrice - totalBreakdownAmount;
                    if (Math.abs(discrepancy) > 1) {
                         const chargeName = discrepancy > 0 ? 'Ancillary Fees' : 'Discount / Adjustment';
                         const chargeNote = discrepancy > 0 ? 'Unitemized surcharges from Smart Quote' : 'Bundle discount adjustment';
                         addChargePair(chargeName, discrepancy, chargeNote, mainLegId);
                         logger.info('[QuoteNew] Added balancing charge', { discrepancy, sellPrice, totalBreakdownAmount });
                    }
                }

                // Fallback: If no charges found, add total freight
                if (chargesToInsert.length === 0) addChargePair('FREIGHT', sellPrice, 'Total Freight', mainLegId);

                if (chargesToInsert.length > 0) {
                    await scopedDb.from('quote_charges').insert(chargesToInsert);
                }

                // Update progress
                setInsertionProgress(prev => ({ ...prev, current: prev.current + 1 }));

            } catch (err: any) {
                const carrierName = rawRate.carrier || rawRate.carrier_name || rawRate.provider || 'Unknown Carrier';
                console.error(`[QuoteNew] Error processing rate ${carrierName}:`, err);
                toast.error(`Failed to process rate for ${carrierName}: ${err.message || 'Unknown error'}`);
            }
        };

        // Run concurrently
        await Promise.all(selectedRates.map(processRate));

        const duration = performance.now() - startTime;
        logger.info(`[QuoteNew] Option insertion completed`, { duration: `${duration.toFixed(2)}ms`, count: selectedRates.length });
        
        if (newOptionIds.length > 0) {
            setGeneratedOptionIds(newOptionIds);
            setOptionsInserted(true);
            toast.success(`Successfully imported ${newOptionIds.length} options from Quick Quote`);
        } else {
             // If all failed, we should probably set insertion error to prompt user
             setInsertionError("Failed to import any options. Please check the error messages.");
             toast.error("Failed to import any options.");
        }

      } catch (err: any) {
          logger.error('[QuoteNew] Critical error inserting options', { error: err });
          
          let errorMessage = err.message || 'Failed to save options';
          if (err.message?.includes('column') && err.message?.includes('does not exist')) {
             errorMessage = 'Database schema mismatch: Missing columns. Please run the latest migration.';
          }
          if (err.details) {
             errorMessage += ` (${err.details})`;
          }
          if (err.hint) {
             errorMessage += ` Hint: ${err.hint}`;
          }
          
          setInsertionError(errorMessage);
          toast.error(`Failed to save options: ${errorMessage}`);
      } finally {
          setIsInsertingOptions(false);
          setInsertionStartTime(null);
      }
    };

    insertOptions();
  }, [versionId, tenantId, location.state, optionsInserted, isInsertingOptions, scopedDb]);

  const handleTemplateSelect = (template: QuoteTemplate) => {
    try {
      // Parse content if string, or use as is if object
      const content = typeof template.content === 'string' 
        ? JSON.parse(template.content) 
        : template.content;
      
      // Map template content to form values
      // We explicitly exclude system fields
      const { id, created_at, updated_at, tenant_id, quote_number, ...rest } = content as any;
      
      setTemplateData(rest);
      setTemplateDialogOpen(false);
      toast.success(`Template "${template.name}" applied`);
    } catch (e) {
      console.error('Error applying template', e);
      toast.error('Failed to apply template');
    }
  };

  const handleSuccess = (quoteId: string) => {
    // Instead of navigating immediately, create initial version and show composer inline
    setCreatedQuoteId(quoteId);
    // Fetch tenant_id for the created quote to ensure version insert works
    (async () => {
      const { data } = await scopedDb
        .from('quotes')
        .select('tenant_id')
        .eq('id', quoteId)
        .single();
      setTenantId((data as any)?.tenant_id ?? null);
    })();
  };

  const handleRetryInsertion = () => {
    setIsInsertingOptions(false);
    setInsertionError(null);
    setInsertionProgress({ current: 0, total: 0 });
    // This will trigger the useEffect again because dependencies (isInsertingOptions) change
    // But we need to make sure we don't get stuck in a loop.
    // Actually, the useEffect runs when optionsInserted is false and versionId/tenantId are present.
    // If we just clear error, it might not re-trigger if nothing else changed.
    // We might need a trigger. But wait, useEffect depends on [versionId, tenantId, location.state, optionsInserted, isInsertingOptions].
    // If we set isInsertingOptions to false, the effect *might* run again if we don't block it.
    // The effect checks: if (!versionId || !tenantId || optionsInserted || isInsertingOptions || !location.state) return;
    // So if isInsertingOptions is false, and optionsInserted is false, it WILL run again.
    // So simply resetting state is enough.
  };

  const handleContinueAnyway = () => {
    setOptionsInserted(true);
    setInsertionError(null);
  };

  useEffect(() => {
    const ensureVersion = async () => {
      if (!createdQuoteId) return;
      
      console.log('[QuoteNew] Ensuring version exists for quote:', createdQuoteId);
      setVersionError(null);
      
      try {
        // Check if version already exists
        const { data: existing, error: queryError } = await (scopedDb
          .from('quotation_versions')
          .select('id, version_number') as any)
          .eq('quote_id', createdQuoteId)
          .order('version_number', { ascending: false })
          .limit(1);
        
        if (queryError) {
          console.error('[QuoteNew] Error querying versions:', queryError);
          setVersionError('Failed to check existing versions: ' + queryError.message);
          return;
        }
        
        if (Array.isArray(existing) && existing.length && (existing[0] as any)?.id) {
          console.log('[QuoteNew] Found existing version:', (existing[0] as any).id);
          setVersionId(String((existing[0] as any).id));
          return;
        }
        
        // Create initial version only if none exists
        console.log('[QuoteNew] No version found, creating version 1');
        
        // Resolve Tenant ID with multiple fallbacks
        let finalTenantId = tenantId;
        
        // 1. Check Context
        if (!finalTenantId) {
            finalTenantId = context?.tenantId ?? null;
        }

        // 2. Check User Metadata
        if (!finalTenantId) {
            const { data: userData } = await supabase.auth.getUser();
            finalTenantId = (userData?.user?.user_metadata as any)?.tenant_id;
        }

        // 3. Check Quote Record (last resort)
        if (!finalTenantId) {
             const { data: quoteData } = await scopedDb.from('quotes').select('tenant_id').eq('id', createdQuoteId).single();
             if (quoteData) finalTenantId = quoteData.tenant_id;
        }
        
        if (!finalTenantId) {
          console.error('[QuoteNew] Cannot create version: no tenant_id available');
          setVersionError('Missing Tenant ID - cannot create quotation version');
          return;
        }

        // Update state if we found it externally
        if (!tenantId) setTenantId(finalTenantId);
        
        const { data: v, error: insertError } = await scopedDb
          .from('quotation_versions')
          .insert({ quote_id: createdQuoteId, tenant_id: finalTenantId, version_number: 1 })
          .select('id')
          .maybeSingle();
        
        if (insertError) {
          console.error('[QuoteNew] Error creating version:', insertError);
          // Check if version was created by another process
          const { data: retry } = await (scopedDb
            .from('quotation_versions')
            .select('id') as any)
            .eq('quote_id', createdQuoteId)
            .limit(1)
            .maybeSingle();
          
          if ((retry as any)?.id) {
            console.log('[QuoteNew] Version found on retry:', (retry as any).id);
            setVersionId(String((retry as any).id));
            return;
          }
          setVersionError('Failed to create quotation version: ' + insertError.message);
          return;
        }
        
        if ((v as any)?.id) {
          console.log('[QuoteNew] Created version:', (v as any).id);
          setVersionId(String((v as any).id));
        }
      } catch (error: any) {
        console.error('[QuoteNew] Unexpected error in ensureVersion:', error);
        setVersionError('Unexpected error: ' + error.message);
      }
    };
    
    ensureVersion();
  }, [createdQuoteId, tenantId, context.tenantId, scopedDb, supabase]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/quotes">Quotes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/quotes/new">New</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold">New Quote</h1>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Use Template
            </Button>
          </div>
        </div>
        
        {/* Version Initialization Error */}
        {versionError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start justify-between">
            <div>
              <h4 className="font-bold flex items-center gap-2">
                 Initialization Error
              </h4>
              <p className="mt-1 text-sm">{versionError}</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="bg-white hover:bg-red-50 text-red-700 border-red-200">
                  Reload Page
                </Button>
            </div>
          </div>
        )}

        {/* Main Quote Form - Hidden after successful save to focus on Composer */}
        {!createdQuoteId ? (
            <QuoteForm 
                onSuccess={handleSuccess} 
                initialData={templateData} 
                autoSave={!!location.state?.selectedRates}
            />
        ) : (
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">Quote Header Saved</h3>
                            <p className="text-xs text-muted-foreground">You are now in the Route Composer to finalize carrier details.</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCreatedQuoteId(null)}>
                        Edit Header
                    </Button>
                </CardContent>
            </Card>
        )}
        
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select a Quote Template</DialogTitle>
            </DialogHeader>
            <QuoteTemplateList onSelect={handleTemplateSelect} />
          </DialogContent>
        </Dialog>
        
        {createdQuoteId && versionId && (!location.state?.selectedRates || optionsInserted) && (
          <div className="mt-6">
            <MultiModalQuoteComposer 
              quoteId={createdQuoteId} 
              versionId={versionId} 
              optionId={generatedOptionIds.length > 0 ? generatedOptionIds[0] : undefined}
            />
          </div>
        )}
        
        {createdQuoteId && location.state?.selectedRates && !optionsInserted && !versionError && (
             <div className="mt-6 p-8 border rounded-lg bg-muted/20 flex flex-col items-center justify-center text-center">
                {insertionError ? (
                    <div className="space-y-4 max-w-md">
                        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                             <FileText className="h-6 w-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-red-700">Generation Failed</h3>
                        <p className="text-sm text-muted-foreground">{insertionError}</p>
                        <div className="flex gap-3 justify-center pt-2">
                            <Button onClick={handleRetryInsertion} variant="outline">Retry</Button>
                            <Button onClick={handleContinueAnyway} variant="default">Continue Anyway</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-pulse">
                        <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
                        <h3 className="text-lg font-semibold">Generating Quote Options...</h3>
                        <p className="text-sm text-muted-foreground">
                            Processing rate {insertionProgress.current} of {insertionProgress.total}
                        </p>
                        {insertionProgress.total > 0 && (
                             <div className="w-64 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
                                 <div 
                                    className="h-full bg-primary transition-all duration-300" 
                                    style={{ width: `${(insertionProgress.current / insertionProgress.total) * 100}%` }}
                                 />
                             </div>
                        )}
                        <p className="text-xs text-muted-foreground pt-2">Please wait while we configure your selected carrier rates.</p>
                    </div>
                )}
             </div>
        )}
      </div>
    </DashboardLayout>
  );
}
