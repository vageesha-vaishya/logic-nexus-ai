import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { ChargeRow } from './ChargeRow';

interface Leg {
  id: string;
  mode: string;
  origin: string;
  destination: string;
  charges: any[];
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
        <CardTitle>Manage Charges</CardTitle>
        <CardDescription>Add and configure charges for each leg</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto Margin Settings */}
        <div className="flex items-center gap-4 p-4 bg-accent/20 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoMargin}
              onChange={(e) => onAutoMarginChange(e.target.checked)}
              id="auto-margin"
              className="h-4 w-4"
            />
            <Label htmlFor="auto-margin" className="font-semibold">Auto Calculate Margin</Label>
          </div>
          {autoMargin && (
            <div className="flex items-center gap-2">
              <Label>Margin %:</Label>
              <Input
                type="number"
                value={marginPercent}
                onChange={(e) => onMarginPercentChange(Number(e.target.value))}
                className="w-24"
                min={0}
                max={100}
              />
            </div>
          )}
        </div>

        {/* Legs Tabs */}
        <Tabs defaultValue={legs[0]?.id}>
          <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${legs.length}, 1fr)` }}>
            {legs.map((leg, idx) => (
              <TabsTrigger key={leg.id} value={leg.id}>
                Leg {idx + 1} - {leg.mode}
              </TabsTrigger>
            ))}
          </TabsList>

          {legs.map((leg, legIdx) => {
            const totals = calculateTotals(leg.charges);
            const margin = totals.sell - totals.buy;
            const marginPercent = totals.buy > 0 ? ((margin / totals.buy) * 100).toFixed(2) : '0.00';

            return (
              <TabsContent key={leg.id} value={leg.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">
                      {leg.origin || 'Origin'} → {leg.destination || 'Destination'}
                    </h4>
                    <p className="text-sm text-muted-foreground">{leg.mode.toUpperCase()} Transport</p>
                  </div>
                  <Button onClick={() => onAddCharge(leg.id)} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Charge
                  </Button>
                </div>

                {leg.charges.length > 0 ? (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Category</th>
                          <th className="p-2 text-left">Basis</th>
                          <th className="p-2 text-left">Unit</th>
                          <th className="p-2 text-left">Currency</th>
                          <th className="p-2 text-right">Buy Qty</th>
                          <th className="p-2 text-right">Buy Rate</th>
                          <th className="p-2 text-right">Buy Amt</th>
                          <th className="p-2 text-right">Sell Qty</th>
                          <th className="p-2 text-right">Sell Rate</th>
                          <th className="p-2 text-right">Sell Amt</th>
                          <th className="p-2 text-right">Margin</th>
                          <th className="p-2 text-left">Notes</th>
                          <th className="p-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leg.charges.map((charge, idx) => (
                          <ChargeRow
                            key={charge.id}
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
                      <tfoot className="bg-muted font-bold">
                        <tr>
                          <td colSpan={6} className="p-2 text-right">Totals:</td>
                          <td className="p-2 text-right">{totals.buy.toFixed(2)}</td>
                          <td colSpan={2} className="p-2"></td>
                          <td className="p-2 text-right">{totals.sell.toFixed(2)}</td>
                          <td className={`p-2 text-right ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {margin.toFixed(2)} ({marginPercent}%)
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border rounded-lg">
                    <p>No charges added yet. Click "Add Charge" to begin.</p>
                  </div>
                )}
              </TabsContent>
            );
          })}
      </Tabs>

      {/* Combined Charges */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Combined Charges</CardTitle>
          <CardDescription>Charges not tied to a specific leg</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Apply charges across the whole option</p>
            </div>
            {onAddCombinedCharge && (
              <Button onClick={() => onAddCombinedCharge?.()} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Combined Charge
              </Button>
            )}
          </div>

          {combinedCharges.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-left">Basis</th>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2 text-left">Currency</th>
                    <th className="p-2 text-right">Buy Qty</th>
                    <th className="p-2 text-right">Buy Rate</th>
                    <th className="p-2 text-right">Buy Amt</th>
                    <th className="p-2 text-right">Sell Qty</th>
                    <th className="p-2 text-right">Sell Rate</th>
                    <th className="p-2 text-right">Sell Amt</th>
                    <th className="p-2 text-right">Margin</th>
                    <th className="p-2 text-left">Notes</th>
                    <th className="p-2 text-center">Actions</th>
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
                <tfoot className="bg-muted font-bold">
                  <tr>
                    <td colSpan={6} className="p-2 text-right">Totals:</td>
                    <td className="p-2 text-right">{calculateTotals(combinedCharges).buy.toFixed(2)}</td>
                    <td colSpan={2} className="p-2"></td>
                    <td className="p-2 text-right">{calculateTotals(combinedCharges).sell.toFixed(2)}</td>
                    <td className="p-2 text-right">
                      {(calculateTotals(combinedCharges).sell - calculateTotals(combinedCharges).buy).toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <p>No combined charges. Click "Add Combined Charge" to begin.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </CardContent>
  </Card>
  );
}
