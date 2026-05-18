import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';

interface GoalProgressAnchorProps {
  currentValue: number;
  targetValue: number;
  goalLabel: string;
  targetYear: number;
}

export function GoalProgressAnchor({
  currentValue,
  targetValue,
  goalLabel,
  targetYear,
}: GoalProgressAnchorProps) {
  const pct = Math.min(Math.round((currentValue / targetValue) * 100), 100);
  const fmtTarget = formatCurrency(targetValue, 'INR', { minimumFractionDigits: 0 });
  const fmtCurrent = formatCurrency(currentValue, 'INR', { minimumFractionDigits: 0 });

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{goalLabel} goal</span>
        <span>on track for {targetYear}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{pct}% of {fmtTarget}</span>
        <span className="text-muted-foreground">Current: {fmtCurrent}</span>
      </div>
    </div>
  );
}
