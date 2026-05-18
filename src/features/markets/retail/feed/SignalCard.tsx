import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
}

export function SignalCard({ signal, experienceLevel, onExecute }: SignalCardProps) {
  const { instrument, confidence = 0, metadata, signal_type, horizon, risk_params } = signal;

  const expl = metadata?.explanations;
  const symbol = instrument?.symbol ?? '—';
  const isBuy = signal_type === 'buy';

  const explanation =
    experienceLevel === 'beginner'
      ? (expl?.beginner ?? signal.rationale)
      : experienceLevel === 'casual'
      ? (expl?.casual ?? signal.rationale)
      : (expl?.self_directed ?? signal.rationale);

  // Directional indicator — rendered as an accessible label so that
  // getByText queries on "buy"/"sell" land on the explanation text only.
  const directionIcon = isBuy ? '↑' : '↓';

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{symbol}</span>
            {/* aria-label carries "buy"/"sell" for screen-readers; visible text is the arrow */}
            <Badge
              variant={isBuy ? 'default' : 'destructive'}
              className="text-xs"
              aria-label={signal_type}
            >
              {directionIcon}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={confidenceVariant(confidence ?? 0)} className="text-xs">
              {confidenceLabel(confidence ?? 0)}
            </Badge>
          </div>
        </div>

        {/* Adaptive explanation — contains confidence % for casual/self_directed */}
        <p className="text-sm text-muted-foreground leading-snug">{explanation}</p>

        {/* Self-directed extras */}
        {experienceLevel === 'self_directed' && metadata?.stop_loss && (
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>
              Stop <span className="text-foreground font-medium">₹{metadata.stop_loss as number}</span>
            </div>
            <div>
              Target <span className="text-foreground font-medium">₹{metadata.target_price as number}</span>
            </div>
            <div>
              R/R <span className="text-foreground font-medium">
                1:{risk_params?.r_r ?? '—'}
              </span>
            </div>
          </div>
        )}

        {/* Horizon + Execute button */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground capitalize">
            {horizon?.replace(/_/g, ' ')} · {instrument?.exchange}
          </span>
          {onExecute && (
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
