/**
 * BreadthIndicator — horizontal advance/decline/unchanged segmented bar.
 *
 * Shows the ratio of advancing vs declining sectors with counts and labels.
 */

import type { AdvanceDecline } from "../hooks/useMarketBreadth";

interface BreadthIndicatorProps {
  advances: number;
  declines: number;
  unchanged: number;
}

export function BreadthIndicator({ advances, declines, unchanged }: BreadthIndicatorProps) {
  const total = advances + declines + unchanged;
  if (total === 0) return null;

  const advPct = (advances / total) * 100;
  const unchPct = (unchanged / total) * 100;
  const decPct = (declines / total) * 100;

  const sentiment =
    advances > declines ? "Bullish" : declines > advances ? "Bearish" : "Neutral";

  const sentimentColor =
    advances > declines
      ? "text-emerald-600 dark:text-emerald-400"
      : declines > advances
      ? "text-red-500 dark:text-red-400"
      : "text-slate-500 dark:text-slate-400";

  return (
    <div className="space-y-2">
      {/* Legend row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{advances} Advancing</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-400" />
            <span>{unchanged} Unchanged</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" />
            <span className="font-medium text-red-500 dark:text-red-400">{declines} Declining</span>
          </span>
        </div>
        <span className="text-[11px]">
          {total} sector{total !== 1 ? "s" : ""} ·{" "}
          <span className={sentimentColor + " font-semibold"}>{sentiment}</span>
        </span>
      </div>

      {/* Segmented bar */}
      <div className="flex w-full h-5 rounded overflow-hidden gap-px">
        {advPct > 0 && (
          <div
            className="bg-emerald-500 flex items-center justify-center transition-all duration-500"
            style={{ width: `${advPct}%` }}
            title={`${advances} advancing`}
          >
            {advPct >= 12 && (
              <span className="text-[10px] font-bold text-white select-none">
                {advances}
              </span>
            )}
          </div>
        )}
        {unchPct > 0 && (
          <div
            className="bg-slate-400 dark:bg-slate-500 flex items-center justify-center transition-all duration-500"
            style={{ width: `${unchPct}%` }}
            title={`${unchanged} unchanged`}
          >
            {unchPct >= 12 && (
              <span className="text-[10px] font-bold text-white select-none">
                {unchanged}
              </span>
            )}
          </div>
        )}
        {decPct > 0 && (
          <div
            className="bg-red-500 flex items-center justify-center transition-all duration-500"
            style={{ width: `${decPct}%` }}
            title={`${declines} declining`}
          >
            {decPct >= 12 && (
              <span className="text-[10px] font-bold text-white select-none">
                {declines}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Percentage labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span className="text-emerald-600 dark:text-emerald-400">{advPct.toFixed(0)}% up</span>
        {unchPct > 0 && <span>{unchPct.toFixed(0)}% flat</span>}
        <span className="text-red-500 dark:text-red-400">{decPct.toFixed(0)}% down</span>
      </div>
    </div>
  );
}

// Re-export the type for convenience
export type { AdvanceDecline };
