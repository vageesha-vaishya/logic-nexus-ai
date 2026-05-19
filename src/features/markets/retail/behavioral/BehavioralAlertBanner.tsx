import { useState } from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

import { WhyButton } from '../glossary';
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

// ── Per-tier dismissal persistence ──────────────────────────────────────────
//
// Dismissal is keyed by (user, portfolio, tier). A 24h TTL means a user who
// said "I understand" doesn't get re-prompted on every navigation, but if
// the alert escalates (yellow → orange) or the period passes, the banner
// re-engages. Tier escalation re-triggers because the key includes the tier.

const ACK_TTL_MS = 24 * 60 * 60 * 1000;

function ackStorageKey(userId: string, portfolioId: string): string {
  return `lnai_drawdown_ack_${userId}_${portfolioId || 'none'}`;
}

function isAckedForTier(userId: string, portfolioId: string, tier: AlertTier): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    const raw = window.localStorage.getItem(ackStorageKey(userId, portfolioId));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { tier?: AlertTier; ackedAt?: number };
    if (parsed.tier !== tier) return false;
    if (typeof parsed.ackedAt !== 'number') return false;
    return Date.now() - parsed.ackedAt < ACK_TTL_MS;
  } catch {
    return false;
  }
}

function persistAck(userId: string, portfolioId: string, tier: AlertTier): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(
      ackStorageKey(userId, portfolioId),
      JSON.stringify({ tier, ackedAt: Date.now() }),
    );
  } catch {
    // storage quota / private mode — ignore
  }
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
  const { user } = useAuth();
  const { mutate: logEvent } = useLogBehavioralEvent();
  // Track which tier was dismissed so a yellow→orange escalation re-prompts.
  const [dismissedTier, setDismissedTier] = useState<AlertTier>(null);

  if (!alertTier || alertTier === 'red') return null;
  if (dismissedTier === alertTier) return null;
  if (user?.id && isAckedForTier(user.id, portfolioId, alertTier)) return null;

  const variant = alertTier === 'orange'
    ? orangeVariant(drawdownPct)
    : yellowVariant(drawdownPct);

  const handleDismiss = () => {
    setDismissedTier(alertTier);
    if (user?.id) persistAck(user.id, portfolioId, alertTier);
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
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          {variant.title}
          <WhyButton term="drawdown" srLabel="What is a drawdown?" />
        </p>
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
