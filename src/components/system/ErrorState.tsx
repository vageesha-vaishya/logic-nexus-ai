/**
 * <ErrorState> — typed error card.
 * ADR-026 §2: replaces freeform red text. Always actionable.
 *
 *   <ErrorState
 *     title="Failed to load portfolios"
 *     message={error.message}
 *     code={error.code}
 *     onRetry={() => refetch()}
 *     learnMoreUrl="https://docs.example.com/errors/portfolio-load"
 *   />
 */

import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  /** Machine code shown muted alongside the message — helps in support tickets. */
  code?: string | number;
  /** Visual severity. Drives icon + accent color. */
  severity?: "error" | "warning";
  /** Click handler for a retry button. Omit if there's nothing to retry. */
  onRetry?: () => void;
  /** Optional "Learn more" link to docs / support runbook. */
  learnMoreUrl?: string;
  /** Layout density. */
  size?: "default" | "compact";
  /** Hide the icon column (e.g. when nested inside another card with its own header). */
  hideIcon?: boolean;
  className?: string;
}

export function ErrorState({
  title,
  message,
  code,
  severity = "error",
  onRetry,
  learnMoreUrl,
  size = "default",
  hideIcon = false,
  className,
}: ErrorStateProps) {
  const containerClass =
    severity === "error"
      ? "border-destructive/40 bg-destructive/5"
      : "border-warning/40 bg-warning/5";
  const iconClass =
    severity === "error" ? "text-destructive" : "text-warning";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        containerClass,
        size === "compact" && "p-3 text-sm",
        className,
      )}
    >
      {!hideIcon && (
        <AlertTriangle
          className={cn("mt-0.5 h-5 w-5 flex-shrink-0", iconClass)}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        {title && (
          <p className="font-medium text-foreground">{title}</p>
        )}
        <p className={cn("text-foreground/90", title && "mt-0.5")}>{message}</p>
        {code != null && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            code: {String(code)}
          </p>
        )}
        {(onRetry || learnMoreUrl) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </Button>
            )}
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Learn more
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
