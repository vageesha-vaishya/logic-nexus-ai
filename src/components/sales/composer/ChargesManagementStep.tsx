import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { ChargeRow } from './ChargeRow';
import { HelpTooltip } from './HelpTooltip';

interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
  legType?: 'transport' | 'service';
  serviceOnlyCategory?: string;
}

interface ChargesManagementStepProps {
  legs: Leg[];
  combinedCharges?: any[];
  chargeCategories: any[];
  chargeBases: any[];
  currencies: any[];
  tradeDirections: any[];
  containerTypes: any[];
  containerSizes: any[];
  serviceTypes: any[];
  autoMargin: boolean;
  marginPercent: number;
  onAutoMarginChange: (enabled: boolean) => void;
  onMarginPercentChange: (percent: number) => void;
  onAddCharge: (legId: string) => void;
  onUpdateCharge: (legId: string, chargeIdx: number, field: string, value: any) => void;
  onRemoveCharge: (legId: string, chargeIdx: number) => void;
  onConfigureBasis: (legId: string, chargeIdx: number) => void;
  onAddCombinedCharge?: () => void;
  onUpdateCombinedCharge?: (chargeIdx: number, field: string, value: any) => void;
  onRemoveCombinedCharge?: (chargeIdx: number) => void;
  onConfigureCombinedBasis?: (chargeIdx: number) => void;
}

export function ChargesManagementStep({
  legs,
  combinedCharges = [],
  chargeCategories,
  chargeBases,
  currencies,
  tradeDirections,
  containerTypes,
  containerSizes,
  serviceTypes,
  autoMargin,
  marginPercent,
  onAutoMarginChange,
  onMarginPercentChange,
  onAddCharge,
  onUpdateCharge,
  onRemoveCharge,
  onConfigureBasis,
  onAddCombinedCharge,
  onUpdateCombinedCharge,
  onRemoveCombinedCharge,
  onConfigureCombinedBasis
}: ChargesManagementStepProps) {
  const calculateTotals = (charges: any[]) => {
    return charges.reduce((acc, charge) => ({
      buy: acc.buy + ((charge.buy?.quantity || 0) * (charge.buy?.rate || 0)),
      sell: acc.sell + ((charge.sell?.quantity || 0) * (charge.sell?.rate || 0))
    }), { buy: 0, sell: 0 });
  };

  if (legs.length === 0) {
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
              onChange={(e) => onAutoMarginChange(e.target.checked)}
              id="auto-margin"
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="auto-margin" className="font-semibold cursor-pointer flex items-center gap-2">
              Auto Calculate Margin
              <HelpTooltip content="When enabled, sell rates will automatically be calculated based on buy rates plus the margin percentage." />
            </Label>
          </div>
          {autoMargin && (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
              <Label className="text-sm font-medium">Margin %:</Label>
              <Input
                type="number"
                value={marginPercent}
                onChange={(e) => onMarginPercentChange(Number(e.target.value))}
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
              const serviceType = serviceTypes.find(st => st.id === leg.serviceTypeId);
              const legName = serviceType?.name || leg.mode.toUpperCase();
              
              return (
                <TabsTrigger key={leg.id} value={leg.id}>
                  Leg {idx + 1} - {legName}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {legs.map((leg, legIdx) => {
            const totals = calculateTotals(leg.charges);
            const margin = totals.sell - totals.buy;
            const marginPercent = totals.buy > 0 ? ((margin / totals.buy) * 100).toFixed(2) : '0.00';
            const serviceType = serviceTypes.find(st => st.id === leg.serviceTypeId);

            return (
              <TabsContent key={leg.id} value={leg.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-lg">
                      Leg {legIdx + 1}: {serviceType?.name || leg.mode.toUpperCase()}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {leg.origin || 'Origin'} → {leg.destination || 'Destination'}
                    </p>
                  </div>
                  <Button onClick={() => onAddCharge(leg.id)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Charge
                  </Button>
                </div>

                {leg.charges.length > 0 ? (
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
                        {leg.charges.map((charge, idx) => (
                          <ChargeRow
                            key={charge.id || idx}
                            charge={charge}
                            categories={chargeCategories}
                            bases={chargeBases}
                            currencies={currencies}
                            onUpdate={(field, value) => onUpdateCharge(leg.id, idx, field, value)}
                            onRemove={() => onRemoveCharge(leg.id, idx)}
                            onConfigureBasis={() => onConfigureBasis(leg.id, idx)}
                            showBuySell={true}
                          />
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 font-semibold border-t">
                        <tr>
                          <td colSpan={5} className="p-3 text-right">Totals:</td>
                          {/* Below Buy Rate */}
                          <td className="p-3 text-right">{totals.buy.toFixed(2)}</td>
                          {/* Below Buy Amt / Sell Amt */}
                          <td className="p-3 text-right">{totals.sell.toFixed(2)}</td>
                          {/* Margin total with percent */}
                          <td className={`p-3 text-right font-bold ${margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}> 
                            {margin.toFixed(2)} ({marginPercent}%)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
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
            {onAddCombinedCharge && (
              <Button onClick={() => onAddCombinedCharge?.()} size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Combined Charge
              </Button>
            )}
          </div>

          {combinedCharges.length > 0 ? (
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
                      onUpdate={(field, value) => onUpdateCombinedCharge?.(idx, field, value)}
                      onRemove={() => onRemoveCombinedCharge?.(idx)}
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
