import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIER_DEFAULTS, type TierDraft } from '../types';
import { usePortfolios } from '../../hooks/usePortfolios';

interface TierSetupProps {
  tiers: TierDraft[];
  onChange: (
    tierNumber: 1 | 2 | 3,
    field: 'portfolio_id' | 'target_amount',
    value: string | number | null,
  ) => void;
}

export function TierSetup({ tiers, onChange }: TierSetupProps) {
  const { data: portfolios = [] } = usePortfolios();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Assign each tier to a portfolio and set a target amount. You can change these anytime.
      </p>
      {TIER_DEFAULTS.map((def) => {
        const tier = tiers.find((t) => t.tier_number === def.tier_number);
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
                  value={tier?.portfolio_id ?? ''}
                  onValueChange={(v) =>
                    onChange(def.tier_number, 'portfolio_id', v || null)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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
                  className="h-8 text-xs"
                  placeholder="e.g. 500000"
                  value={tier?.target_amount ?? ''}
                  onChange={(e) =>
                    onChange(
                      def.tier_number,
                      'target_amount',
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
