// src/features/markets/retail/autonomous/PaperTradingPhase.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAutonomyProgress, useAdvancePhase } from './hooks/useAutonomyProgress';
import { computePhaseProgress, PHASE_LABELS } from './types';

export function PaperTradingPhase() {
  const { data: progress, isLoading } = useAutonomyProgress();
  const { mutate: advance, isPending } = useAdvancePhase();

  if (isLoading || !progress) {
    return <div className="h-24 rounded-lg bg-muted animate-pulse" />;
  }

  const phaseProgress = computePhaseProgress(progress);
  const pct = phaseProgress.required > 0
    ? Math.min(100, (phaseProgress.done / phaseProgress.required) * 100)
    : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {PHASE_LABELS[progress.current_phase]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{phaseProgress.label}</span>
            <span>{phaseProgress.done} of {phaseProgress.required}</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <p className="text-xs text-muted-foreground">
          Paper trades are simulated with live market prices. No real money is used.
          Complete {phaseProgress.required} trades to advance to Micro-Live.
        </p>

        <Button
          size="sm"
          disabled={!phaseProgress.canAdvance || isPending}
          onClick={() => advance()}
          className="w-full"
        >
          {isPending ? 'Advancing…' : `Advance to ${PHASE_LABELS['micro']}`}
        </Button>
      </CardContent>
    </Card>
  );
}
