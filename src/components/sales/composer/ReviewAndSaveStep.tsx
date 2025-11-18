import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Leg {
  id: string;
  mode: string;
  origin: string;
  destination: string;
  charges: any[];
}

interface ReviewAndSaveStepProps {
  legs: Leg[];
  quoteData: any;
  currencies: any[];
}

export function ReviewAndSaveStep({ legs, quoteData, currencies }: ReviewAndSaveStepProps) {
  const calculateGrandTotal = () => {
    return legs.reduce((total, leg) => {
      const legTotal = leg.charges.reduce((acc, charge) => {
        return acc + ((charge.sell?.quantity || 0) * (charge.sell?.rate || 0));
      }, 0);
      return total + legTotal;
    }, 0);
  };

  const grandTotal = calculateGrandTotal();
  const currency = currencies.find(c => c.id === quoteData.currencyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Quotation</CardTitle>
        <CardDescription>Review all details before saving</CardDescription>
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
              <p className="text-muted-foreground">Total Legs</p>
              <p className="font-medium">{legs.length}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Legs Summary */}
        <div>
          <h3 className="font-semibold mb-3">Transport Legs</h3>
          <div className="space-y-4">
            {legs.map((leg, idx) => {
              const legTotal = leg.charges.reduce((acc, charge) => 
                acc + ((charge.sell?.quantity || 0) * (charge.sell?.rate || 0)), 0
              );
              
              return (
                <Card key={leg.id} className="border-2">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">Leg {idx + 1} - {leg.mode.toUpperCase()}</p>
                        <p className="text-sm text-muted-foreground">
                          {leg.origin || 'Origin'} → {leg.destination || 'Destination'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Leg Total</p>
                        <p className="font-bold text-lg">{currency?.symbol || ''}{legTotal.toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {leg.charges.length} charge{leg.charges.length !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Grand Total */}
        <div className="bg-primary/10 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Grand Total (Sell Price)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Total of all legs and charges
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {currency?.symbol || ''}{grandTotal.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">{currency?.code || ''}</p>
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
