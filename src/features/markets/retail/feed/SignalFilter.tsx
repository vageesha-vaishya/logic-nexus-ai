import { Badge } from '@/components/ui/badge';

import type {
  RetailAssetClass,
  RetailHorizon,
  RetailSignalFilters,
} from '../hooks/useRetailSignals';

export type SignalFilterState = Pick<
  RetailSignalFilters,
  'assetClass' | 'horizon' | 'minConfidence'
>;

interface SignalFilterProps {
  filters: SignalFilterState;
  onChange: (next: SignalFilterState) => void;
}

// Phase 2: surface every asset class the worker emits. Labels are
// user-facing names; values stay in the worker's vocabulary (equity/mf/fo/
// fx/bond/commodity) so they map straight to markets.signals.asset_class.
const ASSET_CLASSES: Array<{ value: RetailAssetClass | undefined; label: string }> = [
  { value: undefined,   label: 'All' },
  { value: 'equity',    label: 'Stocks' },
  { value: 'mf',        label: 'MF' },
  { value: 'fo',        label: 'F&O' },
  { value: 'fx',        label: 'Forex' },
  { value: 'bond',      label: 'Bonds' },
  { value: 'commodity', label: 'Commodity' },
];

const HORIZONS: Array<{ value: RetailHorizon | undefined; label: string }> = [
  { value: undefined,     label: 'All' },
  { value: 'intraday',    label: 'Intraday' },
  { value: 'short_term',  label: 'Swing' },
  { value: 'medium_term', label: 'Positional' },
  { value: 'long_term',   label: 'Long-term' },
];

export function SignalFilter({ filters, onChange }: SignalFilterProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Asset class">
        {ASSET_CLASSES.map(({ value, label }) => {
          const active = filters.assetClass === value;
          return (
            <Badge
              key={label}
              variant={active ? 'default' : 'outline'}
              className="cursor-pointer text-xs px-2.5 py-0.5"
              role="button"
              tabIndex={0}
              onClick={() => onChange({ ...filters, assetClass: value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange({ ...filters, assetClass: value });
                }
              }}
            >
              {label}
            </Badge>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Horizon">
        {HORIZONS.map(({ value, label }) => {
          const active = filters.horizon === value;
          return (
            <Badge
              key={label}
              variant={active ? 'secondary' : 'outline'}
              className="cursor-pointer text-xs px-2.5 py-0.5"
              role="button"
              tabIndex={0}
              onClick={() => onChange({ ...filters, horizon: value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange({ ...filters, horizon: value });
                }
              }}
            >
              {label}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
