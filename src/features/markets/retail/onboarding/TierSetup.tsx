import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { usePortfolios } from '../../hooks/usePortfolios';
import { TIER_DEFAULTS } from '../types';

// Radix Select rejects an empty-string SelectItem value — use a sentinel for
// the "no portfolio linked" choice and translate it back to null in onChange.
const NONE_VALUE = '__none__';

export interface TierDraft {
  tier_number: 1 | 2 | 3;
  portfolio_id: string | null;
  target_amount: number | null;
}

interface TierSetupProps {
  tiers: TierDraft[];
  onChange: (
    tierNumber: 1 | 2 | 3,
    field: 'portfolio_id' | 'target_amount',
    value: string | number | null,
  ) => void;
}

export function TierSetup({ tiers, onChange }: TierSetupProps) {
  const { data: portfolios = [], isLoading } = usePortfolios();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assign each tier to a portfolio and set a target amount. You can change these anytime.
      </p>

      {TIER_DEFAULTS.map((def) => {
        const tier = tiers.find((t) => t.tier_number === def.tier_number);
        const selectedPortfolio = tier?.portfolio_id ?? null;
        return (
          <div key={def.tier_number} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Tier {def.tier_number}</Badge>
              <span className="font-semibold text-sm">{def.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{def.description}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Portfolio</Label>
                <Select
                  value={selectedPortfolio ?? NONE_VALUE}
                  onValueChange={(v) =>
                    onChange(
                      def.tier_number,
                      'portfolio_id',
                      v === NONE_VALUE ? null : v,
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={isLoading ? 'Loading…' : 'Select portfolio'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Target Amount (₹)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="h-8 text-xs"
                  placeholder="e.g. 500000"
                  value={tier?.target_amount ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    onChange(
                      def.tier_number,
                      'target_amount',
                      raw === '' ? null : Number(raw),
                    );
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
