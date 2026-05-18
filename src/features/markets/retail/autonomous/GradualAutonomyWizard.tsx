// src/features/markets/retail/autonomous/GradualAutonomyWizard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAutonomyProgress, useAdvancePhase } from './hooks/useAutonomyProgress';
import { computePhaseProgress, PHASE_LABELS, PHASE_ORDER, type AutonomyPhase } from './types';

const PHASE_CAPS: Record<AutonomyPhase, string> = {
  paper: 'Simulated — no real money',
  micro: 'Max 2% of portfolio per trade',
  pilot: 'Max 25% of portfolio',
  full: 'No cap — full autonomy',
};

export function GradualAutonomyWizard() {
  const { data: progress, isLoading } = useAutonomyProgress();
  const { mutate: advance, isPending } = useAdvancePhase();

  if (isLoading || !progress) {
    return <div className="h-48 rounded-lg bg-muted animate-pulse" />;
  }

  const currentIdx = PHASE_ORDER.indexOf(progress.current_phase);
  const phaseProgress = computePhaseProgress(progress);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Autonomy Phases</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {PHASE_ORDER.map((phase, idx) => {
          const isCurrent = phase === progress.current_phase;
          const isPast = idx < currentIdx;
          return (
            <div
              key={phase}
              className={`flex items-start justify-between rounded-lg border p-3 ${
                isCurrent ? 'border-primary bg-primary/5' : isPast ? 'border-border opacity-60' : 'border-border'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{PHASE_LABELS[phase]}</span>
                  {isCurrent && <Badge className="text-xs h-4 px-1.5">Current</Badge>}
                  {isPast && <Badge variant="secondary" className="text-xs h-4 px-1.5">Done</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{PHASE_CAPS[phase]}</p>
                {isCurrent && phaseProgress.required > 0 && (
                  <p className="text-xs text-primary font-medium">
                    {phaseProgress.done} of {phaseProgress.required} {phaseProgress.label}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {progress.current_phase !== 'full' && (
          <Button
            size="sm"
            className="w-full"
            disabled={!phaseProgress.canAdvance || isPending}
            onClick={() => advance()}
          >
            {isPending ? 'Advancing…' : `Advance to ${PHASE_LABELS[PHASE_ORDER[currentIdx + 1]]}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
