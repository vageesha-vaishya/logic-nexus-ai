import { AlertTriangle, TrendingDown } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { useLogBehavioralEvent } from './useBehavioralEvents';
import type { AlertTier } from './types';

interface BehavioralAlertBannerProps {
  alertTier: AlertTier;
  drawdownPct: number;
  portfolioId: string;
}

interface BannerVariant {
  title: string;
  message: string;
  action: string;
  /** Tailwind classes tuned for yellow/orange — the base Alert primitive only ships default + destructive. */
  classes: string;
  Icon: typeof AlertTriangle;
  eventType: 'yellow_alert' | 'orange_alert';
  severity: 'info' | 'warning';
}

function yellowVariant(pct: number): BannerVariant {
  return {
    title: 'Markets are moving today',
    message:
      `Your portfolio is down ${pct.toFixed(1)}% from its recent high. ` +
      'This is normal for a long-term portfolio. No action needed.',
    action: 'Understood',
    classes:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    Icon: AlertTriangle,
    eventType: 'yellow_alert',
    severity: 'info',
  };
}

function orangeVariant(pct: number): BannerVariant {
  return {
    title: 'Portfolio down from peak',
    message:
      `Your portfolio is down ${pct.toFixed(1)}% from its peak. In the last 20 years, ` +
      'Indian equity portfolios recovered from similar drawdowns within ~14 months on average. ' +
      'Selling now locks in this loss permanently.',
    action: 'I understand, keep holding',
    classes:
      'border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-100',
    Icon: TrendingDown,
    eventType: 'orange_alert',
    severity: 'warning',
  };
}

/**
 * Yellow / Orange drawdown alerts. Non-blocking — purely informative.
 * Red drawdowns route to CoolingOffScreen instead; this banner returns null.
 */
export function BehavioralAlertBanner({
  alertTier,
  drawdownPct,
  portfolioId,
}: BehavioralAlertBannerProps) {
  const { mutate: logEvent } = useLogBehavioralEvent();

  if (!alertTier || alertTier === 'red') return null;

  const variant = alertTier === 'orange'
    ? orangeVariant(drawdownPct)
    : yellowVariant(drawdownPct);

  const handleDismiss = () => {
    logEvent({
      event_type: variant.eventType,
      severity:   variant.severity,
      metadata: {
        drawdown_pct: Number(drawdownPct.toFixed(2)),
        portfolio_id: portfolioId,
        action: 'dismissed',
      },
    });
  };

  return (
    <Alert className={`${variant.classes} [&>svg]:text-current`}>
      <variant.Icon className="h-4 w-4" />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{variant.title}</p>
        <AlertDescription className="text-xs leading-relaxed">
          {variant.message}
        </AlertDescription>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          onClick={handleDismiss}
        >
          {variant.action}
        </Button>
      </div>
    </Alert>
  );
}
