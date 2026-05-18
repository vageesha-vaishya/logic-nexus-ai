// src/features/markets/retail/behavioral/CoolingOffScreen.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLogBehavioralEvent } from './useBehavioralEvents';

interface CoolingOffScreenProps {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
  drawdownPct: number;
  portfolioId: string;
}

export function CoolingOffScreen({
  open,
  onClose,
  onProceed,
  drawdownPct,
  portfolioId,
}: CoolingOffScreenProps) {
  const { mutate: logEvent } = useLogBehavioralEvent();

  const handleProceed = () => {
    logEvent({
      event_type: 'panic_sell_intercepted',
      severity: 'critical',
      metadata: {
        drawdown_pct: drawdownPct,
        portfolio_id: portfolioId,
        action: 'proceeded',
      },
    });
    onProceed();
  };

  const handleWait = () => {
    logEvent({
      event_type: 'cooling_off_waited',
      severity: 'warning',
      metadata: {
        drawdown_pct: drawdownPct,
        portfolio_id: portfolioId,
        action: 'waited_24h',
      },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive text-base">
            Selling during a {drawdownPct.toFixed(0)}% market decline
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm space-y-3 pt-2 text-left">
              <p className="text-muted-foreground">Before you proceed, consider:</p>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground">
                <li>
                  Investors who sold during COVID (March 2020) and didn&apos;t reinvest
                  missed a 100% recovery in 18 months
                </li>
                <li>
                  Selling now permanently locks in your current loss
                </li>
                <li>
                  Long-term goals may take longer to reach if you exit now
                </li>
              </ul>
              <p className="text-xs text-muted-foreground/70">
                This is for your awareness only — you can always choose to proceed.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button
            variant="outline"
            onClick={handleWait}
            className="w-full"
          >
            Wait 24 hours
          </Button>
          <Button
            variant="destructive"
            onClick={handleProceed}
            className="w-full"
          >
            Proceed anyway
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
