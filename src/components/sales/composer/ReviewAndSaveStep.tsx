import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DocumentPreview } from './DocumentPreview';

interface Leg {
  id: string;
  mode: string;
  origin: string;
  destination: string;
  charges: any[];
  legType?: 'transport' | 'service';
  serviceOnlyCategory?: string;
}

interface ReviewAndSaveStepProps {
  legs: Leg[];
  quoteData: any;
  currencies: any[];
  combinedCharges?: any[];
}

export function ReviewAndSaveStep({ legs, quoteData, currencies, combinedCharges = [] }: ReviewAndSaveStepProps) {
  const calculateLegTotal = (leg: Leg, side: 'buy' | 'sell' = 'sell') => {
    return leg.charges.reduce((acc, charge) => {
      const qty = charge[side]?.quantity || 0;
      const rate = charge[side]?.rate || 0;
      return acc + (qty * rate);
    }, 0);
  };

  const calculateCombinedTotal = (side: 'buy' | 'sell' = 'sell') => {
    return combinedCharges.reduce((acc, charge) => {
      const qty = charge[side]?.quantity || 0;
      const rate = charge[side]?.rate || 0;
      return acc + (qty * rate);
    }, 0);
  };

  const calculateGrandTotal = (side: 'buy' | 'sell' = 'sell') => {
    const legsTotal = legs.reduce((total, leg) => total + calculateLegTotal(leg, side), 0);
    const combinedTotal = calculateCombinedTotal(side);
    return legsTotal + combinedTotal;
  };

  const grandTotalSell = calculateGrandTotal('sell');
  const grandTotalBuy = calculateGrandTotal('buy');
  const profit = grandTotalSell - grandTotalBuy;
  // Use Profit Margin (Profit / Sell) for standard enterprise reporting
  const marginPercent = grandTotalSell > 0 ? ((profit / grandTotalSell) * 100) : 0;
  
  const currency = currencies.find(c => c.id === quoteData.currencyId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Review Quotation</CardTitle>
            <CardDescription>Review all details before saving</CardDescription>
        </div>
        <DocumentPreview quoteData={quoteData} legs={legs} combinedCharges={combinedCharges} />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quote Summary */}
        <div>
          <h3 className="font-semibold mb-3">Quote Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Reference</p>
              <p className="font-medium">{quoteData.reference || 'Auto-generated'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Valid Until</p>
              <p className="font-medium">{quoteData.validUntil || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="font-medium">{currency?.code || 'Not selected'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Incoterms</p>
              <p className="font-medium">{quoteData.incoterms || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Commodity</p>
              <p className="font-medium">{quoteData.commodity || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Weight / Volume</p>
              <p className="font-medium">
                {quoteData.total_weight ? `${quoteData.total_weight} kg` : '-'} / {quoteData.total_volume ? `${quoteData.total_volume} cbm` : '-'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Legs</p>
              <p className="font-medium">{legs.length}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Legs Summary */}
        <div>
          <h3 className="font-semibold mb-3">Transport Legs & Services</h3>
          <div className="space-y-4">
            {legs.map((leg, idx) => {
              const legTotalSell = calculateLegTotal(leg, 'sell');
              const legTotalBuy = calculateLegTotal(leg, 'buy');
              const legProfit = legTotalSell - legTotalBuy;
              const isServiceLeg = leg.legType === 'service';
              const legRole = leg.legType === 'pickup' ? 'Pickup Leg' : 
                             leg.legType === 'delivery' ? 'Delivery Leg' : 
                             leg.legType === 'main' ? 'Main Leg' :
                             isServiceLeg ? 'Service' : 'Leg';

              return (
                <Card key={leg.id} className="border-2">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold">
                          {(() => {
                             // Logic synchronized with quote-mapper.ts/charge-bifurcation.ts
                             // DB requires 'transport'/'service' so we infer display role from position
                             if (leg.legType === 'service') return `Service: ${leg.serviceOnlyCategory || 'General'}`;
                             
                             if (legs.length === 1) return `Main Leg ${idx + 1} - ${leg.mode.toUpperCase()}`;
                             
                             if (idx === 0) return `Pickup Leg - ${leg.mode.toUpperCase()}`;
                             if (idx === legs.length - 1) return `Delivery Leg - ${leg.mode.toUpperCase()}`;
                             return `Main Leg ${idx + 1} - ${leg.mode.toUpperCase()}`;
                          })()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isServiceLeg 
                            ? `Service: ${getSafeName(leg.serviceOnlyCategory) || 'Not specified'}`
                            : `${leg.origin || 'Origin'} → ${leg.destination || 'Destination'}`
                          }
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Sell Price</p>
                        <p className="font-bold text-lg">{currency?.symbol || ''}{legTotalSell.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs bg-muted/50 p-2 rounded">
                      <div>
                        <p className="text-muted-foreground">Buy Cost</p>
                        <p className="font-medium">{currency?.symbol || ''}{legTotalBuy.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Profit</p>
                        <p className="font-medium text-primary">{currency?.symbol || ''}{legProfit.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Charges</p>
                        <p className="font-medium">{leg.charges.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {combinedCharges.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-3">Combined Charges</h3>
              <Card className="border-2">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold">Charges Across All Legs</p>
                      <p className="text-sm text-muted-foreground">
                        {combinedCharges.length} combined charge{combinedCharges.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="font-bold text-lg">{currency?.symbol || ''}{calculateCombinedTotal('sell').toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 p-2 rounded">
                    <div>
                      <p className="text-muted-foreground">Buy Cost</p>
                      <p className="font-medium">{currency?.symbol || ''}{calculateCombinedTotal('buy').toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Profit</p>
                      <p className="font-medium text-primary">
                        {currency?.symbol || ''}{(calculateCombinedTotal('sell') - calculateCombinedTotal('buy')).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <Separator />

        {/* Grand Total */}
        <div className="bg-primary/10 p-6 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Total Buy Cost</p>
              <p className="text-xs text-muted-foreground">Your cost from suppliers</p>
            </div>
            <p className="text-xl font-bold">{currency?.symbol || ''}{grandTotalBuy.toFixed(2)}</p>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Total Sell Price</p>
              <p className="text-xs text-muted-foreground">Price quoted to customer</p>
            </div>
            <p className="text-2xl font-bold text-primary">{currency?.symbol || ''}{grandTotalSell.toFixed(2)}</p>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background p-3 rounded">
              <p className="text-xs text-muted-foreground mb-1">Total Profit</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {currency?.symbol || ''}{profit.toFixed(2)}
              </p>
            </div>
            <div className="bg-background p-3 rounded">
              <p className="text-xs text-muted-foreground mb-1">Margin %</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {marginPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {quoteData.notes && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quoteData.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
