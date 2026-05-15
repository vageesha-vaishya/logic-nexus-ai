/**
 * <EmptyState> — placeholder for "no rows yet" / "first-time use" surfaces.
 * ADR-026 §2: illustration/icon slot, title, description, primary action,
 * optional secondary action.
 *
 * Extended 2026-05-15: added secondary action + size variants + role/aria-live.
 * Existing single-action API is preserved (all current callers continue to compile).
 */

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Secondary action — rendered as outline button next to primary (ADR-026 §2). */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Visual density. "compact" for inline placeholders, "default" otherwise. */
  size?: "default" | "compact";
  /** Optional richer illustration replacing the small `icon`. */
  illustration?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  size = "default",
  className,
}: EmptyStateProps) {
  const verticalPad = size === "compact" ? "py-8" : "py-16";
  const titleClass = size === "compact" ? "text-base font-semibold" : "text-lg font-semibold";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("text-center border rounded-lg bg-card", verticalPad, className)}
    >
      {illustration ? (
        <div className="mx-auto mb-4 max-w-[160px]">{illustration}</div>
      ) : icon ? (
        <div className="mx-auto mb-4 h-10 w-10 text-muted-foreground">{icon}</div>
      ) : null}

      <h3 className={titleClass}>{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
