import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ChargeRow } from '@/components/sales/composer/ChargeRow';
import { ManagedCharge } from '@/hooks/useChargesManager';

interface ChargeTableProps {
  charges: ManagedCharge[];
  legId: string | null;
  onUpdateCharge: (chargeId: string, field: string, value: any) => void;
  onRemoveCharge: (chargeId: string) => void;
  onAddCharge: (legId: string | null) => void;
  referenceData: {
    chargeCategories: any[];
    chargeBases: any[];
    currencies: any[];
  };
}

const MemoizedChargeRow = memo(({ charge, onUpdate, onRemove, referenceData }: any) => {
  const handleUpdate = useCallback((field: string, value: any) => {
    onUpdate(charge.id, field, value);
  }, [charge.id, onUpdate]);

  const handleRemove = useCallback(() => {
    onRemove(charge.id);
  }, [charge.id, onRemove]);

  return (
    <ChargeRow
      charge={charge}
      categories={referenceData.chargeCategories}
      bases={referenceData.chargeBases}
      currencies={referenceData.currencies}
      onUpdate={handleUpdate}
      onRemove={handleRemove}
      onConfigureBasis={() => {}} 
      showBuySell={true}
    />
  );
});

export const ChargeTable = memo(function ChargeTable({
  charges,
  legId,
  onUpdateCharge,
  onRemoveCharge,
  onAddCharge,
  referenceData
}: ChargeTableProps) {
  return (
    <div className="space-y-2">
      {charges.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs">
                <th className="text-left p-2 font-medium">Category</th>
                <th className="text-left p-2 font-medium">Basis</th>
                <th className="text-left p-2 font-medium">Unit</th>
                <th className="text-left p-2 font-medium">Currency</th>
                <th className="text-right p-2 font-medium">Buy Qty</th>
                <th className="text-right p-2 font-medium">Buy Rate</th>
                <th className="text-right p-2 font-medium">Buy Amt</th>
                <th className="text-center p-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <MemoizedChargeRow
                  key={charge.id}
                  charge={charge}
                  onUpdate={onUpdateCharge}
                  onRemove={onRemoveCharge}
                  referenceData={referenceData}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No charges yet. Click "Add Charge" to start.
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onAddCharge(legId)}
        className="mt-1"
      >
        <Plus className="w-3 h-3 mr-1" /> Add Charge
      </Button>
    </div>
  );
});
