import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Globe, Loader2 } from 'lucide-react';
import { VirtualChargesList } from './VirtualChargesList';
import { ChargeRow } from './ChargeRow';
import { HelpTooltip } from './HelpTooltip';
import { useQuoteStore } from './store/QuoteStore';
import { Leg } from './store/types';
import { useCRM } from '@/hooks/useCRM';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';
import { PricingService } from '@/services/pricing.service';
import { mapOptionToQuote } from '@/lib/quote-mapper';
import { calculateChargeableWeight, TransportMode } from '@/utils/freightCalculations';
import { logger } from '@/lib/logger';

interface ChargesManagementStepProps {}

export function ChargesManagementStep({}: ChargesManagementStepProps) {
  const { state, dispatch } = useQuoteStore();
  const { scopedDb } = useCRM();
  const { invokeAiAdvisor } = useAiAdvisor();
  const { toast } = useToast();
  const pricingService = useMemo(() => new PricingService(scopedDb.client), [scopedDb.client]);
  const debounceTimers = useRef(new Map<string, NodeJS.Timeout>());
  
  const [fetchingRatesFor, setFetchingRatesFor] = useState<string | null>(null);

  const { 
    legs, 
    charges: combinedCharges, 
    quoteData, 
    validationErrors,
    isLoading: isGlobalLoading,
    referenceData
  } = state;

  const isPricingCalculating = isGlobalLoading || fetchingRatesFor !== null;

  const {
    chargeCategories,
    chargeBases,
    currencies,
    serviceTypes
  } = referenceData;

  if (!legs || legs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Charges Management</CardTitle>
          <CardDescription>Configure charges for each leg of the journey.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="mb-2 font-medium">No Transport Legs Configured</p>
            <p className="text-sm">Please go back to the "Transport Legs" step and add at least one leg to configure charges.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const autoMargin = quoteData.autoMargin || false;
  const marginPercent = quoteData.marginPercent || 15;

  const handleFetchRates = async (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    setFetchingRatesFor(legId);
    dispatch({ type: 'SET_LOADING', payload: true });
    toast({
      title: "Fetching AI Rates",
      description: "Consulting AI Smart Advisor for real-time market rates...",
    });

    try {
      // 1. Prepare Payload for AI
      // We treat this leg as a mini-shipment to get specific rates
      const payload = {
        origin: leg.origin,
        destination: leg.destination,
        commodity: quoteData.commodity || 'General Cargo',
        mode: leg.mode.toLowerCase(),
        // Add context if available
        container_type: quoteData.container_type,
        weight: quoteData.total_weight,
        volume: quoteData.total_volume
      };

      // 2. Invoke AI Advisor
      const aiResponse = await invokeAiAdvisor({
        action: 'generate_smart_quotes',
        payload
      });

      if (aiResponse.error) {
        throw new Error(aiResponse.error.message || 'AI Advisor failed');
      }

      if (!aiResponse.data?.options || aiResponse.data.options.length === 0) {
        throw new Error('No rates found for this route');
      }

      // 3. Process Result
      // We take the first (best) option returned by AI
      const bestOption = aiResponse.data.options[0];
      const mapped = mapOptionToQuote(bestOption);

      if (!mapped) throw new Error('Failed to process AI rates');

      // 4. Extract Charges
      // Collect charges from all returned legs (in case AI broke it down) and global charges
      let extractedCharges: any[] = [];
      
      if (mapped.legs) {
        mapped.legs.forEach((l: any) => {
          if (l.charges) extractedCharges = [...extractedCharges, ...l.charges];
        });
      }
      if (mapped.charges) {
        extractedCharges = [...extractedCharges, ...mapped.charges];
      }

      if (extractedCharges.length === 0) {
        // Fallback: If AI returned a total but no details, create a lump sum
        if (mapped.total_amount > 0) {
            extractedCharges.push({
                name: 'Freight Charges',
                amount: mapped.total_amount,
                currency: mapped.currency || 'USD',
                unit: 'per_shipment'
            });
        }
      }

      const weight = Number(quoteData.total_weight) || 0;
      const volume = Number(quoteData.total_volume) || 0;
      const chargeableWeight = calculateChargeableWeight(weight, volume, leg.mode as TransportMode);

      // 5. Map to Composer Charge Format
      const newCharges = await Promise.all(extractedCharges.map(async (chg) => {
        // Find matching IDs from master data
        const catName = chg.category || chg.name || 'Freight';
        const cat = chargeCategories.find(c => 
          (c.name && c.name.toLowerCase() === catName.toLowerCase()) || 
          (c.code && c.code.toLowerCase() === catName.toLowerCase())
        ) || chargeCategories.find(c => c.code === 'FRT') || chargeCategories[0];

        // Basis mapping
        const basisName = chg.unit || 'per_shipment';
        // Try to match basis code or name
        let basis = chargeBases.find(b => 
          (b.code && b.code.toLowerCase() === basisName.toLowerCase()) ||
          (b.name && b.name.toLowerCase() === basisName.toLowerCase())
        );
        
        // Fallback for common units
        if (!basis) {
            if (basisName.includes('kg')) basis = chargeBases.find(b => b.code === 'kg');
            else if (basisName.includes('cbm')) basis = chargeBases.find(b => b.code === 'cbm');
            else if (basisName.includes('cont') || basisName.includes('box')) basis = chargeBases.find(b => b.code === 'container');
            else basis = chargeBases.find(b => b.code === 'shipment'); // Default
        }

        const curr = currencies.find(c => c.code === (chg.currency || 'USD')) || currencies[0];
        
        // Calculate Buy/Sell
        // If AI provides specific buy/sell, use them. Otherwise use standard margin logic.
        const sellRate = Number(chg.amount || chg.rate || 0);
        let buyRate = Number(chg.buyRate || chg.cost || 0);
        
        if (buyRate === 0 && sellRate > 0) {
            // Reverse calculate buy rate assuming 15% margin if not provided
            // Use PricingService for consistent financial logic
            const financials = await pricingService.calculateFinancials(sellRate, 15, false);
            buyRate = financials.buyPrice;
        }

        // Determine quantity
        let quantity = Number(chg.quantity || 1);
        // Adjust quantity based on basis if needed (similar to original logic)
        if (basis?.code?.toLowerCase().includes('kg') || basis?.code?.toLowerCase().includes('cbm')) {
             quantity = chargeableWeight > 0 ? chargeableWeight : 1;
        }

        return {
          id: `charge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          category_id: cat?.id || '',
          basis_id: basis?.id || '',
          unit: basis?.code || 'shipment',
          currency_id: curr?.id || '',
          buy: {
            quantity,
            rate: buyRate,
            dbChargeId: null
          },
          sell: {
            quantity,
            rate: sellRate,
            dbChargeId: null
          },
          note: chg.note || `AI Rate: ${chg.name || catName}`
        };
      }));

      // 6. Update State (using smart merge)
      const updatedLegs = legs.map(l => {
        if (l.id === legId) {
          // Merge new charges with existing ones to prevent duplicates
          const updatedCharges = [...l.charges];
          
          newCharges.forEach(newCharge => {
            const existingIndex = updatedCharges.findIndex(c => 
              c.category_id === newCharge.category_id && 
              // Strict matching to prevent duplication
              ((!c.basis_id && !newCharge.basis_id) || c.basis_id === newCharge.basis_id) &&
              ((!c.unit && !newCharge.unit) || c.unit === newCharge.unit)
            );

            if (existingIndex >= 0) {
              // Update existing charge
              const existing = updatedCharges[existingIndex];
              
              updatedCharges[existingIndex] = {
                ...existing,
                buy: {
                  ...existing.buy,
                  rate: newCharge.buy.rate > 0 ? newCharge.buy.rate : existing.buy.rate
                },
                sell: {
                  ...existing.sell,
                  rate: newCharge.sell.rate > 0 ? newCharge.sell.rate : existing.sell.rate
                },
                note: existing.note || newCharge.note
              };
            } else {
              // Add new charge
              updatedCharges.push(newCharge);
            }
          });
          
          return { ...l, charges: updatedCharges };
        }
        return l;
      });

      // Update all legs at once (though we only modified one)
      const targetLeg = updatedLegs.find(l => l.id === legId);
      if (targetLeg) {
         dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: targetLeg.charges } } });
      }

      toast({
        title: "Rates Updated",
        description: `Successfully fetched and applied ${newCharges.length} rate(s) for this leg.`,
      });

    } catch (error: any) {
      logger.error('Error fetching rates:', error);
      toast({
        title: "Rate Fetch Failed",
        description: error.message || "Could not retrieve rates at this time.",
        variant: "destructive"
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      setFetchingRatesFor(null);
    }
  };

  const handleAutoMarginChange = (enabled: boolean) => {
    dispatch({ type: 'UPDATE_QUOTE_DATA', payload: { autoMargin: enabled } });
  };

  const handleMarginPercentChange = (percent: number) => {
    dispatch({ type: 'UPDATE_QUOTE_DATA', payload: { marginPercent: percent } });
  };

  // Leg Charge Handlers
  const handleAddCharge = (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    // Default values from reference data
    const defaultCurrency = currencies.find(c => c.code === 'USD') || currencies[0];
    const defaultCategory = chargeCategories.find(c => c.code === 'FRT') || chargeCategories[0];
    const defaultBasis = chargeBases.find(b => b.code === 'shipment') || chargeBases[0];

    const newCharge = {
      id: crypto.randomUUID(),
      category_id: defaultCategory?.id || '',
      basis_id: defaultBasis?.id || '',
      unit: defaultBasis?.code || 'shipment',
      currency_id: defaultCurrency?.id || '',
      buy: { quantity: 1, rate: 0, amount: 0, currency: 'USD' },
      sell: { quantity: 1, rate: 0, amount: 0, currency: 'USD' },
      note: ''
    };

    const updatedCharges = [...(leg.charges || []), newCharge];
    dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: updatedCharges } } });
  };

  const handleUpdateCharge = (legId: string, chargeIdx: number, field: string, value: any) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    const updatedCharges = [...(leg.charges || [])];
    if (!updatedCharges[chargeIdx]) return;

    const existing = { ...updatedCharges[chargeIdx] };
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const parentObj = { ...(existing as any)[parent] };
      (parentObj as any)[child] = value;
      (existing as any)[parent] = parentObj;
    } else {
      (existing as any)[field] = value;
    }
    updatedCharges[chargeIdx] = existing;

    dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: updatedCharges } } });

    if (autoMargin && marginPercent > 0 && field.startsWith('buy.')) {
      const buyRate = field === 'buy.rate' ? Number(value) : Number(existing?.buy?.rate || 0);
      const timerKey = `leg-${legId}-charge-${chargeIdx}`;
      if (debounceTimers.current.has(timerKey)) {
        clearTimeout(debounceTimers.current.get(timerKey)!);
      }
      const timer = setTimeout(() => {
        pricingService.calculateFinancials(buyRate, Number(marginPercent), true)
          .then(result => {
            const latestLeg = (state.legs || []).find(l => l.id === legId);
            if (!latestLeg) return;
            const nextCharges = [...(latestLeg.charges || [])];
            if (!nextCharges[chargeIdx]) return;
            const nextCharge = { ...nextCharges[chargeIdx] };
            nextCharge.sell = {
              ...(nextCharge.sell || {}),
              quantity: nextCharge.buy?.quantity || 1,
              rate: result.sellPrice
            };
            nextCharges[chargeIdx] = nextCharge;
            dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: nextCharges } } });
          })
          .catch(err => logger.error('Pricing calculation failed', { error: err }))
          .finally(() => {
            debounceTimers.current.delete(timerKey);
          });
      }, 300);
      debounceTimers.current.set(timerKey, timer);
    }
  };

  const handleRemoveCharge = (legId: string, chargeIdx: number) => {
    dispatch({ type: 'REMOVE_LEG_CHARGE', payload: { legId, chargeIdx } });
  };

  // Combined Charge Handlers
  const handleAddCombinedCharge = () => {
    const newCharge = {
      id: crypto.randomUUID(),
      category: '',
      basis: 'Per Shipment',
      unit: 'Shipment',
      currency: 'USD',
      buy: { quantity: 1, rate: 0, amount: 0, currency: 'USD' },
      sell: { quantity: 1, rate: 0, amount: 0, currency: 'USD' }
    };
    dispatch({ type: 'ADD_COMBINED_CHARGE', payload: newCharge });
  };

  const handleUpdateCombinedCharge = (chargeIdx: number, field: string, value: any) => {
    // We need the current charge to update it
    const charge = combinedCharges[chargeIdx];
    if (charge) {
       const updatedCharge = { ...charge, [field]: value };
       dispatch({ type: 'UPDATE_COMBINED_CHARGE', payload: { index: chargeIdx, charge: updatedCharge } });
    }
  };

  const handleRemoveCombinedCharge = (chargeIdx: number) => {
    dispatch({ type: 'REMOVE_COMBINED_CHARGE', payload: chargeIdx });
  };

  // Helper for rendering
  const getSafeName = (name: any) => {
    if (typeof name === 'string') return name;
    return String(name || '');
  };

  const calculateTotals = (charges: any[]) => {
    return charges.reduce((acc, charge) => ({
      buy: acc.buy + ((charge.buy?.quantity || 0) * (charge.buy?.rate || 0)),
      sell: acc.sell + ((charge.sell?.quantity || 0) * (charge.sell?.rate || 0))
    }), { buy: 0, sell: 0 });
  };

  const renderTotals = (totals: { buy: number; sell: number }, margin: number, marginPercent: string) => (
    <div className="bg-muted/30 font-semibold border-t p-2 flex items-center gap-2 text-sm mt-2">
      <div className="flex-1 text-right pr-2">Totals:</div>
      <div className="w-[120px] text-right px-2 border-r border-border/50">
        <span className="text-xs text-muted-foreground mr-1">Buy:</span>
        {totals.buy.toFixed(2)}
      </div>
      <div className="w-[120px] text-right px-2 border-r border-border/50">
        <span className="text-xs text-muted-foreground mr-1">Sell:</span>
        {totals.sell.toFixed(2)}
      </div>
      <div className={`w-[120px] text-right px-2 ${margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
        <span className="text-xs text-muted-foreground mr-1">Margin:</span>
        {margin.toFixed(2)} ({marginPercent}%)
      </div>
    </div>
  );

  if (!legs || legs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Please configure at least one leg before managing charges.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Manage Charges
          <HelpTooltip content="Add buy and sell charges for each transport leg. The system will calculate profit margins automatically if auto margin is enabled." />
        </CardTitle>
        <CardDescription>Add and configure charges for each leg</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto Margin Settings */}
        <div className="flex items-center gap-4 p-4 bg-primary/5 border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={autoMargin}
              onChange={(e) => handleAutoMarginChange(e.target.checked)}
              id="auto-margin"
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="auto-margin" className="font-semibold cursor-pointer flex items-center gap-2">
              Auto Calculate Margin
              <HelpTooltip content="When enabled, sell rates will automatically be calculated based on buy rates plus the margin percentage." />
            </Label>
          </div>
          {isPricingCalculating && (
            <div className="flex items-center gap-2 text-sm text-primary animate-pulse ml-auto">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Updating prices...</span>
            </div>
          )}
          {autoMargin && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
              <Label className="text-sm font-medium">Margin %:</Label>
              <Input
                type="number"
                value={marginPercent}
                onChange={(e) => handleMarginPercentChange(Number(e.target.value))}
                className="w-20"
                min={0}
                max={100}
              />
            </div>
          )}
        </div>

        {/* Legs Tabs */}
        <Tabs defaultValue={legs[0]?.id}>
          <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${legs.length}, 1fr)` }}>
            {legs.map((leg, idx) => {
              const serviceType = serviceTypes.find((st) =>
                st.id === leg.serviceTypeId ||
                st.id === leg.mode ||
                st.code === leg.mode ||
                st.name === leg.mode
              );
              const legName = (typeof serviceType?.name === 'string' ? serviceType.name : String(serviceType?.name || '')) || leg.mode.toUpperCase();
              const hasError = validationErrors.some(e => e.startsWith(`Leg ${idx + 1}`));
              
              return (
                <TabsTrigger key={leg.id} value={leg.id} className={hasError ? "text-destructive" : ""}>
                  Leg {idx + 1} - {legName} {hasError && "*"}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {legs.map((leg, legIdx) => {
            const totals = calculateTotals(leg.charges || []);
            const margin = totals.sell - totals.buy;
            const marginPercentVal = totals.sell > 0 ? ((margin / totals.sell) * 100).toFixed(2) : '0.00';

            const serviceType = serviceTypes.find((st) =>
              st.id === leg.serviceTypeId ||
              st.id === leg.mode ||
              st.code === leg.mode ||
              st.name === leg.mode
            );

            return (
              <TabsContent key={leg.id} value={leg.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-lg">
                      Leg {legIdx + 1}: {getSafeName(serviceType?.name) || leg.mode.toUpperCase()}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {leg.origin || 'Origin'} → {leg.destination || 'Destination'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleFetchRates(leg.id)} 
                      size="sm" 
                      variant="outline"
                      disabled={fetchingRatesFor === leg.id}
                    >
                      {fetchingRatesFor === leg.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <Globe className="mr-2 h-4 w-4" />
                          Fetch Rates
                        </>
                      )}
                    </Button>
                    <Button onClick={() => handleAddCharge(leg.id)} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Charge
                    </Button>
                  </div>
                </div>

                {leg.charges && leg.charges.length > 0 ? (
                  <div>
                    <VirtualChargesList
                      charges={leg.charges}
                      categories={chargeCategories}
                      bases={chargeBases}
                      currencies={currencies}
                      onUpdate={(idx, field, value) => handleUpdateCharge(leg.id, idx, field, value)}
                      onRemove={(idx) => handleRemoveCharge(leg.id, idx)}
                      onConfigureBasis={(idx) => dispatch({ type: 'OPEN_BASIS_MODAL', payload: { target: { type: 'leg', legId: leg.id, chargeIdx: idx } } })}
                      height={400}
                    />
                    {renderTotals(totals, margin, marginPercentVal)}
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
                    <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-base font-medium">No charges added yet</p>
                    <p className="text-sm mt-1">Click "Add Charge" to begin adding costs for this leg</p>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Combined Charges */}
        <Card className="mt-6 border-2">
          <CardHeader className="bg-muted/20">
            <CardTitle>Combined Charges</CardTitle>
            <CardDescription>Charges applicable across all legs (e.g., documentation, insurance)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">These charges apply to the entire shipment</p>
              </div>
              <Button onClick={handleAddCombinedCharge} size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Combined Charge
              </Button>
            </div>

            {combinedCharges && combinedCharges.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-semibold">Category</th>
                      <th className="p-3 text-left font-semibold">Basis</th>
                      <th className="p-3 text-left font-semibold">Unit</th>
                      <th className="p-3 text-left font-semibold">Currency</th>
                      <th className="p-3 text-right font-semibold">Buy Qty</th>
                      <th className="p-3 text-right font-semibold">Buy Rate</th>
                      <th className="p-3 text-right font-semibold">Buy Amt</th>
                      <th className="p-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedCharges.map((charge, idx) => (
                      <ChargeRow
                        key={charge.id || `combined-${idx}`}
                        charge={charge}
                        categories={chargeCategories}
                        bases={chargeBases}
                        currencies={currencies}
                        onUpdate={(field, value) => handleUpdateCombinedCharge(idx, field, value)}
                        onRemove={() => handleRemoveCombinedCharge(idx)}
                        onConfigureBasis={() => dispatch({ type: 'OPEN_BASIS_MODAL', payload: { target: { type: 'combined', chargeIdx: idx } } })}
                        showBuySell={true}
                      />
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 font-semibold border-t-2">
                    <tr>
                      <td colSpan={8} className="p-3">
                        <div className="flex items-center justify-end gap-6">
                          <div className="flex items-center gap-2">
                             <span className="text-muted-foreground">Total Buy:</span>
                             <span>{calculateTotals(combinedCharges).buy.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-muted-foreground">Total Sell:</span>
                             <span>{calculateTotals(combinedCharges).sell.toFixed(2)}</span>
                          </div>
                          <div className={`flex items-center gap-2 ${(calculateTotals(combinedCharges).sell - calculateTotals(combinedCharges).buy) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                             <span className="text-muted-foreground">Margin:</span>
                             <span>
                               {(calculateTotals(combinedCharges).sell - calculateTotals(combinedCharges).buy).toFixed(2)} 
                               {calculateTotals(combinedCharges).sell > 0 ? ` (${(( (calculateTotals(combinedCharges).sell - calculateTotals(combinedCharges).buy) / calculateTotals(combinedCharges).sell ) * 100).toFixed(2)}%)` : ' (0.00%)'}
                             </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
                <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-base font-medium">No combined charges yet</p>
                <p className="text-sm mt-1">Add charges that apply to the entire shipment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
