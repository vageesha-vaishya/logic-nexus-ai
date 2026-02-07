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

interface ChargesManagementStepProps {
  // Handlers for side effects not in store (e.g., fetching rates)
  onFetchRates?: (legId: string) => void;
  onConfigureBasis?: (legId: string, chargeIdx: number) => void;
  onConfigureCombinedBasis?: (chargeIdx: number) => void;
}

export function ChargesManagementStep({
  onFetchRates,
  onConfigureBasis,
  onConfigureCombinedBasis,
}: ChargesManagementStepProps) {
  const { state, dispatch } = useQuoteStore();
  const { 
    legs, 
    charges: combinedCharges, 
    quoteData, 
    validationErrors,
    isLoading: isPricingCalculating, // Assuming isLoading covers pricing calc for now, or add specific state
    referenceData
  } = state;

  const {
    chargeCategories,
    chargeBases,
    currencies,
    tradeDirections,
    containerTypes,
    containerSizes,
    serviceTypes
  } = referenceData;

  const autoMargin = quoteData.autoMargin || false;
  const marginPercent = quoteData.marginPercent || 15;

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

    const newCharge = {
      id: crypto.randomUUID(),
      category: '',
      basis: 'Per Shipment',
      unit: 'Shipment',
      currency: 'USD',
      buy: { quantity: 1, rate: 0, amount: 0, currency: 'USD' },
      sell: { quantity: 1, rate: 0, amount: 0, currency: 'USD' }
    };

    const updatedCharges = [...(leg.charges || []), newCharge];
    dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: updatedCharges } } });
  };

  const handleUpdateCharge = (legId: string, chargeIdx: number, field: string, value: any) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    const updatedCharges = [...(leg.charges || [])];
    if (updatedCharges[chargeIdx]) {
      updatedCharges[chargeIdx] = { ...updatedCharges[chargeIdx], [field]: value };
      
      // Auto-calc amounts if quantity/rate changes
      // This logic might be complex if nested fields (buy.rate) are passed as field path
      // But VirtualChargesList usually passes 'buy' or 'sell' object, or top level field.
      // If VirtualChargesList passes nested updates, we need to handle them.
      // Based on typical usage, it might be passing the whole modified charge or handling field updates specifically.
      // Let's assume field is top-level or handled by caller, but if field is 'buy' or 'sell', we might need to recalc totals.
      // For now, trust the value passed is correct.
      
      dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: updatedCharges } } });
    }
  };

  const handleRemoveCharge = (legId: string, chargeIdx: number) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    const updatedCharges = leg.charges.filter((_, i) => i !== chargeIdx);
    dispatch({ type: 'UPDATE_LEG', payload: { id: legId, updates: { charges: updatedCharges } } });
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
                    {onFetchRates && (
                      <Button onClick={() => onFetchRates(leg.id)} size="sm" variant="outline">
                        <Globe className="mr-2 h-4 w-4" />
                        Fetch Rates
                      </Button>
                    )}
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
                      onConfigureBasis={(idx) => onConfigureBasis?.(leg.id, idx)}
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
                        onConfigureBasis={() => onConfigureCombinedBasis?.(idx)}
                        showBuySell={true}
                      />
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 font-semibold border-t-2">
                    <tr>
                      <td colSpan={6} className="p-3 text-right">Totals:</td>
                      <td className="p-3 text-right">{calculateTotals(combinedCharges).buy.toFixed(2)}</td>
                      <td colSpan={2} className="p-3"></td>
                      <td className="p-3 text-right">{calculateTotals(combinedCharges).sell.toFixed(2)}</td>
                      <td className={`p-3 text-right font-bold ${(calculateTotals(combinedCharges).sell - calculateTotals(combinedCharges).buy) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                        {(calculateTotals(combinedCharges).sell - calculateTotals(combinedCharges).buy).toFixed(2)} 
                        {calculateTotals(combinedCharges).sell > 0 ? ` (${(( (calculateTotals(combinedCharges).sell - calculateTotals(combinedCharges).buy) / calculateTotals(combinedCharges).sell ) * 100).toFixed(2)}%)` : ' (0.00%)'}
                      </td>
                      <td></td>
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
