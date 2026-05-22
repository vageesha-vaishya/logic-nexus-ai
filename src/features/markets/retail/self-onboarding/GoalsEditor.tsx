/**
 * GoalsEditor — picks up to 3 goals from the catalogue, then per-goal:
 *   - re-orders (up/down arrows; primary = most important)
 *   - sets horizon (1–40 years, slider)
 *   - sets optional target amount (₹)
 *   - removes
 *
 * Drag-and-drop reordering deliberately skipped — the up/down arrow
 * pattern is more touch-reliable on the Sthira mobile shell and accessible
 * by default. We can revisit once we have an accessible DnD primitive in
 * the design system.
 */
import { ArrowDown, ArrowUp, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { GOALS, type Goal } from '../types';

import {
  MAX_GOALS,
  MIN_YEARS,
  MAX_YEARS,
  addGoal,
  bumpDown,
  bumpUp,
  priorityLabel,
  removeGoal,
  sortByPriority,
  updateTargetAmount,
  updateYears,
} from './goals';

interface Props {
  goals:    readonly Goal[];
  onChange: (next: Goal[]) => void;
}

const goalLabel = (id: string) =>
  GOALS.find((g) => g.id === id)?.label ?? id.replace(/_/g, ' ');

export function GoalsEditor({ goals, onChange }: Props) {
  const sorted = sortByPriority(goals);
  const atCap  = sorted.length >= MAX_GOALS;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Pick 1 – {MAX_GOALS} goals</p>
        <div className="flex flex-wrap gap-2">
          {GOALS.map(({ id, label }) => {
            const selected = sorted.some((g) => g.goal === id);
            const disabled = !selected && atCap;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    selected ? removeGoal(sorted, id) : addGoal(sorted, id),
                  )
                }
                className={
                  'rounded-full border px-3 py-1.5 text-xs transition-colors ' +
                  (selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed')
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        {atCap && (
          <p className="text-xs text-muted-foreground">
            Maximum {MAX_GOALS} goals — remove one to pick another.
          </p>
        )}
      </div>

      {sorted.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Order them by importance — Primary gets the most attention.
          </p>
          {sorted.map((g, idx) => {
            const isFirst = idx === 0;
            const isLast  = idx === sorted.length - 1;
            const priority = g.priority ?? idx + 1;
            return (
              <div key={g.goal} className="rounded-md border p-3 space-y-3">
                <header className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm leading-tight">{goalLabel(g.goal)}</p>
                    <p className="text-xs text-muted-foreground">{priorityLabel(priority)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isFirst}
                      onClick={() => onChange(bumpUp(sorted, g.goal))}
                      aria-label={`Move ${goalLabel(g.goal)} up`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={isLast}
                      onClick={() => onChange(bumpDown(sorted, g.goal))}
                      aria-label={`Move ${goalLabel(g.goal)} down`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onChange(removeGoal(sorted, g.goal))}
                      aria-label={`Remove ${goalLabel(g.goal)}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </header>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Time horizon</Label>
                    <span className="text-xs tabular-nums">
                      {g.years} yr{g.years === 1 ? '' : 's'}
                    </span>
                  </div>
                  <Slider
                    min={MIN_YEARS}
                    max={MAX_YEARS}
                    step={1}
                    value={[g.years]}
                    onValueChange={([v]) => onChange(updateYears(sorted, g.goal, v))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`target-${g.goal}`} className="text-xs">
                    Target amount (optional)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      id={`target-${g.goal}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={10000}
                      value={g.target_amount ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n   = raw === '' ? undefined : Number(raw);
                        onChange(updateTargetAmount(sorted, g.goal, n));
                      }}
                      placeholder="e.g. 5000000"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
