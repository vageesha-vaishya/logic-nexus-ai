import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_SEBI_DISCLAIMER =
  "Past performance is not indicative of future results. This information is for educational purposes only and does not constitute investment advice. Invest only what you can afford to lose. Mutual funds and securities are subject to market risks.";

export interface SebiDisclaimerProps {
  /** Disclaimer text. Defaults to the SEBI-aligned boilerplate. */
  text?: string;
  /**
   * If set, the component starts a countdown on mount and exposes the
   * remaining seconds. Per SEBI ad code, audio-visual surfaces must show
   * the disclaimer for at least 5 seconds — pass `minVisibleMs={5000}`.
   */
  minVisibleMs?: number;
  /** Fires once the timer reaches zero. */
  onTimerComplete?: () => void;
  /**
   * Render-prop. When provided, receives `{ canProceed, secondsRemaining }`
   * so the caller can gate their action button on the timer. The disclaimer
   * text is rendered above the render-prop output.
   */
  children?: (state: SebiDisclaimerState) => React.ReactNode;
  className?: string;
}

export type SebiDisclaimerState = {
  canProceed: boolean;
  secondsRemaining: number;
};

export function SebiDisclaimer({
  text = DEFAULT_SEBI_DISCLAIMER,
  minVisibleMs,
  onTimerComplete,
  children,
  className,
}: SebiDisclaimerProps): JSX.Element {
  const { canProceed, secondsRemaining } = useSebiDisclaimerTimer({
    minVisibleMs,
    onTimerComplete,
  });

  return (
    <div
      className={cn(
        "rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
      role="region"
      aria-label="Regulatory disclaimer"
    >
      <p className="flex items-start gap-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{text}</span>
      </p>
      {minVisibleMs != null && !canProceed && (
        <p
          className="mt-2 text-[11px] text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Please review for {secondsRemaining}s before continuing.
        </p>
      )}
      {children && <div className="mt-3">{children({ canProceed, secondsRemaining })}</div>}
    </div>
  );
}

export interface UseSebiDisclaimerTimerOptions {
  minVisibleMs?: number;
  onTimerComplete?: () => void;
}

/**
 * Hook variant for callers who render the disclaimer themselves but still
 * need to gate a button on the SEBI 5-second timer. When `minVisibleMs` is
 * omitted the gate is open immediately (canProceed=true).
 */
export function useSebiDisclaimerTimer({
  minVisibleMs,
  onTimerComplete,
}: UseSebiDisclaimerTimerOptions): SebiDisclaimerState {
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    minVisibleMs != null ? Math.ceil(minVisibleMs / 1000) : 0,
  );

  useEffect(() => {
    if (minVisibleMs == null || minVisibleMs <= 0) {
      setSecondsRemaining(0);
      return;
    }
    setSecondsRemaining(Math.ceil(minVisibleMs / 1000));
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((minVisibleMs - elapsed) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        clearInterval(tick);
        onTimerComplete?.();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [minVisibleMs, onTimerComplete]);

  const canProceed = minVisibleMs == null || secondsRemaining === 0;
  return { canProceed, secondsRemaining };
}
