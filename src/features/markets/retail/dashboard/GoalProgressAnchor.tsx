import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';

interface GoalProgressAnchorProps {
  currentValue: number;
  targetValue: number;
  goalLabel: string;
  targetYear: number;
}

/**
 * Compact goal-progress widget for the tier dashboard.
 * Caps the bar at 100% so over-target portfolios don't render off-axis.
 */
export function GoalProgressAnchor({
  currentValue,
  targetValue,
  goalLabel,
  targetYear,
}: GoalProgressAnchorProps) {
  const rawPct = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  const pct    = Math.max(0, Math.min(Math.round(rawPct), 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{goalLabel} goal</span>
        <span>on track for {targetYear}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {pct}% of {formatCurrency(targetValue, 'INR', { minimumFractionDigits: 0 })}
        </span>
        <span className="text-muted-foreground">
          Current: {formatCurrency(currentValue, 'INR', { minimumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
