import { memo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Globe, Loader2 } from 'lucide-react';
import { VirtualChargesList } from './VirtualChargesList';
import { Leg } from './store/types';

interface LegChargesTabContentProps {
  leg: Leg;
  legIndex: number;
  serviceType: any;
  chargeCategories: any[];
  chargeBases: any[];
  currencies: any[];
  isFetching: boolean;
  onFetchRates: (legId: string) => void;
  onAddCharge: (legId: string) => void;
  onUpdateCharge: (legId: string, idx: number, field: string, value: any) => void;
  onRemoveCharge: (legId: string, idx: number) => void;
  onOpenBasisModal: (legId: string, idx: number) => void;
  calculateTotals: (charges: any[]) => { buy: number; sell: number };
  renderTotals: (totals: { buy: number; sell: number }, margin: number, marginPercent: string) => React.ReactNode;
  getSafeName: (name: any) => string;
}

export const LegChargesTabContent = memo(function LegChargesTabContent({
  leg,
  legIndex,
  serviceType,
  chargeCategories,
  chargeBases,
  currencies,
  isFetching,
  onFetchRates,
  onAddCharge,
  onUpdateCharge,
  onRemoveCharge,
  onOpenBasisModal,
  calculateTotals,
  renderTotals,
  getSafeName
}: LegChargesTabContentProps) {
  // We don't strictly need refs here if the parent passes stable handlers that use refs.
  // But if the parent passes (legId, ...) handlers, we need to adapt them to (idx, ...) handlers.
  // The adapter functions must be stable.
  
  const handleUpdate = useCallback((idx: number, field: string, value: any) => {
    onUpdateCharge(leg.id, idx, field, value);
  }, [leg.id, onUpdateCharge]);

  const handleRemove = useCallback((idx: number) => {
    onRemoveCharge(leg.id, idx);
  }, [leg.id, onRemoveCharge]);

  const handleConfigureBasis = useCallback((idx: number) => {
    onOpenBasisModal(leg.id, idx);
  }, [leg.id, onOpenBasisModal]);

  const totals = calculateTotals(leg.charges || []);
  const margin = totals.sell - totals.buy;
  const marginPercentVal = totals.sell > 0 ? ((margin / totals.sell) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-lg">
            Leg {legIndex + 1}: {getSafeName(serviceType?.name) || leg.mode.toUpperCase()}
          </h4>
          <p className="text-sm text-muted-foreground">
            {leg.origin || 'Origin'} → {leg.destination || 'Destination'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => onFetchRates(leg.id)} 
            size="sm" 
            variant="outline"
            disabled={isFetching}
          >
            {isFetching ? (
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
          <Button onClick={() => onAddCharge(leg.id)} size="sm">
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
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            onConfigureBasis={handleConfigureBasis}
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
    </div>
  );
});