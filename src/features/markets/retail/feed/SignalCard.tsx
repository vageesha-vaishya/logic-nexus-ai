import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { InlineEducation } from '../behavioral/InlineEducation';
import type { EducationId } from '../behavioral/types';
import { useLogBehavioralEvent } from '../behavioral/useBehavioralEvents';
import type { ExperienceLevel, RetailSignal } from '../types';

function confidenceLabel(c: number): string {
  if (c >= 0.85) return 'High Conviction';
  if (c >= 0.70) return 'Strong';
  return 'Moderate';
}

function confidenceVariant(c: number): 'default' | 'secondary' | 'outline' {
  if (c >= 0.85) return 'default';
  if (c >= 0.70) return 'secondary';
  return 'outline';
}

interface SignalCardProps {
  signal: RetailSignal;
  experienceLevel: ExperienceLevel;
  onExecute?: (signal: RetailSignal) => void;
  /** Toggle for high-VIX education trigger. From useMarketStress. */
  isHighStress?: boolean;
  /** Education IDs the user has already dismissed (from behavioral_events). */
  seenEducationIds?: Set<string>;
}

export function SignalCard({
  signal,
  experienceLevel,
  onExecute,
  isHighStress = false,
  seenEducationIds,
}: SignalCardProps) {
  const { instrument, metadata, signal_type } = signal;
  const confidence = signal.confidence ?? 0;
  const horizon   = metadata?.horizon ?? signal.metadata?.horizon;
  const expl      = metadata?.explanations;
  const symbol    = instrument?.symbol ?? '—';

  const isBuy = signal_type === 'buy';
  const isSell = signal_type === 'sell';
  const showAction = isBuy || isSell;

  // Pick the most specific education trigger that hasn't been seen yet. At
  // most one education card per signal — high-conviction wins over high-VIX
  // wins over intraday wins over F&O, since those are the most "this signal
  // is unusually risky" warnings.
  const { mutate: logEvent } = useLogBehavioralEvent();
  const seen = seenEducationIds;
  const educationToShow: EducationId | null = (() => {
    if (!seen) return null;
    if (confidence >= 0.85 && !seen.has('high_conviction_signal')) return 'high_conviction_signal';
    if (isHighStress         && !seen.has('high_vix_execution'))    return 'high_vix_execution';
    if (horizon === 'intraday' && !seen.has('first_intraday'))      return 'first_intraday';
    if (signal.metadata?.asset_class === 'fo' && !seen.has('fo_enable')) return 'fo_enable';
    return null;
  })();

  const handleEducationDismiss = (id: EducationId) => {
    logEvent({
      event_type: 'education_shown',
      severity: 'info',
      metadata: { education_id: id, signal_id: signal.id },
    });
  };

  // The explanation layer (Task 5) is the canonical source; rationale is a
  // robust fallback so a missing/partial LLM response still renders something.
  const explanation = (() => {
    const key: keyof NonNullable<typeof expl> =
      experienceLevel === 'beginner' ? 'beginner'
      : experienceLevel === 'casual' ? 'casual'
      : 'self_directed';
    return expl?.[key] || signal.rationale || '';
  })();

  // Risk params block (self_directed only).
  const risk = signal.risk_params as
    | { stop_loss_pct?: number; target_pct?: number; r_r?: number }
    | null
    | undefined;
  const stop   = metadata?.stop_loss   ?? null;
  const target = metadata?.target_price ?? null;
  const showRiskRow =
    experienceLevel === 'self_directed' &&
    (stop != null || target != null || risk?.stop_loss_pct != null || risk?.target_pct != null);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-sm">{symbol}</span>
            <Badge variant={isBuy ? 'default' : isSell ? 'destructive' : 'outline'} className="text-xs uppercase">
              {signal_type}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {experienceLevel !== 'beginner' && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(confidence * 100)}%
              </span>
            )}
            <Badge variant={confidenceVariant(confidence)} className="text-xs">
              {confidenceLabel(confidence)}
            </Badge>
          </div>
        </div>

        {explanation && (
          <p className="text-sm leading-snug text-muted-foreground">{explanation}</p>
        )}

        {educationToShow && (
          <InlineEducation
            educationId={educationToShow}
            experienceLevel={experienceLevel}
            onDismiss={handleEducationDismiss}
          />
        )}

        {showRiskRow && (
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>
              Stop{' '}
              <span className="font-medium text-foreground">
                {stop != null
                  ? `₹${stop.toLocaleString('en-IN')}`
                  : risk?.stop_loss_pct != null
                  ? `${risk.stop_loss_pct}%`
                  : '—'}
              </span>
            </div>
            <div>
              Target{' '}
              <span className="font-medium text-foreground">
                {target != null
                  ? `₹${target.toLocaleString('en-IN')}`
                  : risk?.target_pct != null
                  ? `${risk.target_pct}%`
                  : '—'}
              </span>
            </div>
            <div>
              R/R{' '}
              <span className="font-medium text-foreground">
                {risk?.r_r != null ? `1:${risk.r_r}` : '—'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs capitalize text-muted-foreground">
            {horizon ? horizon.replace(/_/g, ' ') : 'no horizon'}
            {instrument?.exchange ? ` · ${instrument.exchange}` : ''}
          </span>
          {showAction && onExecute && (
            <Button
              size="sm"
              variant={isBuy ? 'default' : 'destructive'}
              className="h-7 px-3 text-xs"
              onClick={() => onExecute(signal)}
            >
              {isBuy ? 'Buy' : 'Sell'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
