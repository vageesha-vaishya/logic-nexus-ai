import { Badge } from '@/components/ui/badge';

interface Filters {
  assetClass: string | undefined;
  horizon: string | undefined;
  minConfidence: number;
}

interface SignalFilterProps {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const ASSET_CLASSES = [
  { value: undefined,       label: 'All' },
  { value: 'equity',        label: 'Stocks' },
  { value: 'mutual_fund',   label: 'MF' },
  { value: 'crypto',        label: 'Crypto' },
  { value: 'derivative',    label: 'F&O' },
  { value: 'commodity',     label: 'Commodity' },
  { value: 'fixed_income',  label: 'Bonds' },
  { value: 'forex',         label: 'Forex' },
];

const HORIZONS = [
  { value: undefined,       label: 'All' },
  { value: 'intraday',      label: 'Intraday' },
  { value: 'short_term',    label: 'Swing' },
  { value: 'medium_term',   label: 'Positional' },
  { value: 'long_term',     label: 'Long-term' },
];

export function SignalFilter({ filters, onChange }: SignalFilterProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {ASSET_CLASSES.map(({ value, label }) => (
          <Badge
            key={label}
            variant={filters.assetClass === value ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => onChange({ ...filters, assetClass: value })}
          >
            {label}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {HORIZONS.map(({ value, label }) => (
          <Badge
            key={label}
            variant={filters.horizon === value ? 'secondary' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => onChange({ ...filters, horizon: value })}
          >
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
