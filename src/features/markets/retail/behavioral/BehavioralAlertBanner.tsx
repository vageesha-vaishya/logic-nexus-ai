// src/features/markets/retail/behavioral/BehavioralAlertBanner.tsx
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogBehavioralEvent } from './useBehavioralEvents';
import type { AlertTier } from './types';

interface BehavioralAlertBannerProps {
  alertTier: AlertTier;
  drawdownPct: number;
  portfolioId: string;
}

export function BehavioralAlertBanner({
  alertTier,
  drawdownPct,
  portfolioId,
}: BehavioralAlertBannerProps) {
  const { mutate: logEvent } = useLogBehavioralEvent();

  // Red tier is handled by CoolingOffScreen, not this banner
  if (!alertTier || alertTier === 'red') return null;

  const isOrange = alertTier === 'orange';
  const pctStr = drawdownPct.toFixed(1);

  const message = isOrange
    ? `Your portfolio is down ${pctStr}% from its peak. Portfolios at this level have historically recovered within 14 months on average. Selling now locks in this loss permanently.`
    : `Your portfolio is down ${pctStr}% from its recent high. This is normal for a long-term portfolio. No action needed.`;

  const actionLabel = isOrange ? 'I understand, keep holding' : 'Understood';

  const handleDismiss = () => {
    logEvent({
      event_type: alertTier === 'orange' ? 'orange_alert' : 'yellow_alert',
      severity: isOrange ? 'warning' : 'info',
      metadata: { drawdown_pct: drawdownPct, portfolio_id: portfolioId, action: 'dismissed' },
    });
  };

  const borderColor = isOrange
    ? 'border-orange-300 dark:border-orange-700'
    : 'border-yellow-300 dark:border-yellow-700';
  const bgColor = isOrange
    ? 'bg-orange-50 dark:bg-orange-950'
    : 'bg-yellow-50 dark:bg-yellow-950';
  const textColor = isOrange
    ? 'text-orange-800 dark:text-orange-200'
    : 'text-yellow-800 dark:text-yellow-200';

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4 mb-4`}>
      <div className="flex items-start gap-3">
        {isOrange
          ? <TrendingDown className={`h-4 w-4 mt-0.5 shrink-0 ${textColor}`} />
          : <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${textColor}`} />
        }
        <div className="flex-1 space-y-2">
          <p className={`text-sm leading-relaxed ${textColor}`}>{message}</p>
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 px-2 text-xs ${textColor} hover:bg-transparent`}
            onClick={handleDismiss}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
