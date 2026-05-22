/**
 * TierSliders — three sliders (Safety / Core / Experimental) that sum to
 * 100%. Moving one redistributes the delta across the other two
 * proportionally; see `redistribute` in ./tiers.ts.
 *
 * Stateless — parent owns the triple. ₹ values are derived from the
 * triple × budget, displayed alongside each slider so the user sees
 * what their default ₹1,00,000 paper capital maps to.
 */
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

import {
  DEFAULT_BUDGET,
  MAX_TIER_PCT,
  MIN_TIER_PCT,
  TIER_DESCRIPTIONS,
  TIER_LABELS,
  formatINR,
  redistribute,
  toRupees,
  type TierIdx,
  type TierTriple,
} from './tiers';

interface Props {
  value:    TierTriple;
  onChange: (next: TierTriple) => void;
  budget?:  number;
}

const ORDER: readonly TierIdx[] = [0, 1, 2] as const;

export function TierSliders({ value, onChange, budget = DEFAULT_BUDGET }: Props) {
  const rupees = toRupees(value, budget);
  const sum    = value[0] + value[1] + value[2];

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Of every ₹100 you invest, how much should sit in each bucket? Defaults
        are picked from your risk profile and goals — adjust freely.
      </p>

      {ORDER.map((idx) => {
        const pct = value[idx];
        return (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-start justify-between">
              <div>
                <Label className="text-sm font-medium">{TIER_LABELS[idx]}</Label>
                <p className="text-xs text-muted-foreground leading-snug">
                  {TIER_DESCRIPTIONS[idx]}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="text-sm font-semibold">{pct}%</p>
                <p className="text-xs text-muted-foreground">{formatINR(rupees[idx])}</p>
              </div>
            </div>
            <Slider
              min={MIN_TIER_PCT}
              max={MAX_TIER_PCT}
              step={1}
              value={[pct]}
              onValueChange={([v]) => onChange(redistribute(value, idx, v))}
              aria-label={`${TIER_LABELS[idx]} allocation`}
            />
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground text-right tabular-nums">
        Sum: {sum}% · Budget shown: {formatINR(budget)}
      </p>
    </div>
  );
}
