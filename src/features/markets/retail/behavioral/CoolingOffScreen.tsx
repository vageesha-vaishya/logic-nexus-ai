import { AlertOctagon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useLogBehavioralEvent } from './useBehavioralEvents';

interface CoolingOffScreenProps {
  open: boolean;
  /** Called when the user picks "Wait 24 hours" (or otherwise closes the dialog). */
  onClose: () => void;
  /** Called when the user confirms they want to proceed with the panic sell. */
  onProceed: () => void;
  drawdownPct: number;
  portfolioId: string;
}

/**
 * Red-tier cooling-off prompt. Triggered before a user can sell the entire
 * Core Portfolio during a ≥20% drawdown.
 *
 * Important: this NEVER blocks the user. SEBI guidance is that informational
 * friction is fine; preventing trades is not. Both buttons log to
 * markets.behavioral_events so we can measure the intervention's effect.
 */
export function CoolingOffScreen({
  open,
  onClose,
  onProceed,
  drawdownPct,
  portfolioId,
}: CoolingOffScreenProps) {
  const { mutate: logEvent } = useLogBehavioralEvent();

  const baseMeta = {
    drawdown_pct: Number(drawdownPct.toFixed(2)),
    portfolio_id: portfolioId,
  };

  const handleProceed = () => {
    logEvent({
      event_type: 'panic_sell_intercepted',
      severity: 'critical',
      metadata: { ...baseMeta, action: 'proceeded' },
    });
    onProceed();
  };

  const handleWait = () => {
    logEvent({
      event_type: 'cooling_off_waited',
      severity: 'warning',
      metadata: { ...baseMeta, action: 'waited' },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleWait(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="h-5 w-5" />
            Selling during a {drawdownPct.toFixed(0)}% drawdown
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2 text-left text-sm">
              <p>You&apos;re about to sell during a significant market decline. Consider:</p>
              <ul className="list-disc space-y-1 pl-4 text-xs">
                <li>
                  Investors who sold during COVID (Mar 2020) missed a ~100% recovery in 18 months.
                </li>
                <li>
                  Selling now locks in this {drawdownPct.toFixed(0)}% loss permanently.
                </li>
                <li>
                  Your long-term goals may need more time to recover if you exit now.
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                You can always choose to proceed — this screen is informational only.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2">
          <Button variant="outline" onClick={handleWait} className="w-full">
            Wait 24 hours
          </Button>
          <Button variant="destructive" onClick={handleProceed} className="w-full">
            Proceed anyway
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
