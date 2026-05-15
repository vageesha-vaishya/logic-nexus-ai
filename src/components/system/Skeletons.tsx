/**
 * <SkeletonRow> / <SkeletonCard> — layout-matching loading placeholders.
 * ADR-026 §2: match final layout dimensions to prevent layout shift; never
 * show longer than ~1 second before swapping to real content.
 *
 * Uses the shadcn `Skeleton` primitive under the hood (which animates via
 * tailwindcss-animate). Compose, don't bespoke.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonRowProps {
  /** Number of horizontal "cells" — controls the column rhythm. Default 4. */
  columns?: number;
  /** Visual density. */
  size?: "default" | "compact";
  /** Override per-column width fractions (in CSS sizes). Length must match `columns`. */
  widths?: string[];
  className?: string;
}

/**
 * Single row of skeleton bars. Use inside a list/table while data loads.
 *
 *   {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
 */
export function SkeletonRow({
  columns = 4,
  size = "default",
  widths,
  className,
}: SkeletonRowProps) {
  const cols = Array.from({ length: columns }).map((_, i) => widths?.[i] ?? defaultWidth(i, columns));
  const height = size === "compact" ? "h-3" : "h-4";

  return (
    <div
      className={cn("flex items-center gap-3 py-2", className)}
      aria-hidden="true"
    >
      {cols.map((w, i) => (
        <Skeleton
          key={i}
          className={cn(height, "rounded")}
          style={{ width: w }}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  /** Number of "metric" bars rendered in the card body. Default 3. */
  lines?: number;
  /** Show a header line (heavier weight, ~40% width). Default true. */
  withHeader?: boolean;
  className?: string;
}

/**
 * Block placeholder for card-shaped surfaces (portfolio cards, brief tiles, etc.).
 */
export function SkeletonCard({
  lines = 3,
  withHeader = true,
  className,
}: SkeletonCardProps) {
  return (
    <div
      className={cn("rounded-lg border p-4 space-y-3", className)}
      aria-hidden="true"
    >
      {withHeader && <Skeleton className="h-5 w-2/5 rounded" />}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3 rounded"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

function defaultWidth(i: number, total: number): string {
  // Slight visual variation so rows don't look like a fence.
  if (i === 0) return "32%";
  if (i === total - 1) return "12%";
  return "18%";
}
