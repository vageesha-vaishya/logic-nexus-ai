import { Progress } from '@/components/ui/progress';

interface GoalProgressAnchorProps {
  currentValue: number;
  targetValue: number;
  goalLabel: string;
  targetYear: number;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function GoalProgressAnchor({
  currentValue,
  targetValue,
  goalLabel,
  targetYear,
}: GoalProgressAnchorProps) {
  const pct = Math.min(Math.round((currentValue / targetValue) * 100), 100);
  const fmtTarget = fmt(targetValue);
  const fmtCurrent = fmt(currentValue);

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
