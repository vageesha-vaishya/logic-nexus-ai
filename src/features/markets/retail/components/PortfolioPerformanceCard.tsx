/**
 * PortfolioPerformanceCard — compact NAV-trend trigger on the mobile
 * detail page. Inline SVG sparkline (no chart library cost beyond what
 * usePortfolioPnL already loads). Tap → opens the full-screen
 * PortfolioChartsModal.
 *
 * Why SVG and not lightweight-charts here:
 *   - The sparkline is tiny (~140×40 logical px); rendering an entire
 *     chart engine for that is wasteful and would push the lazy-chunk
 *     boundary into the page-load critical path.
 *   - The full chart inside the modal IS lightweight-charts (via the
 *     existing PortfolioPnLChart), so the heavy dep loads only on tap.
 */
import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

import { Numeric } from "@/components/system/Numeric";
import { Skeleton } from "@/components/ui/skeleton";

import { usePortfolioPnL } from "../../hooks/usePortfolioPnL";

export interface PortfolioPerformanceCardProps {
  portfolioId: string | undefined;
  currency?: string;
  /** Days of history. Default 90 — keeps the sparkline meaningful but light. */
  lookback?: number;
  onOpen?: () => void;
}

export function PortfolioPerformanceCard({
  portfolioId, currency = "INR", lookback = 90, onOpen,
}: PortfolioPerformanceCardProps) {
  const { data, isLoading, isError } = usePortfolioPnL(portfolioId, lookback);

  const series   = data?.series ?? [];
  const summary  = data?.summary;
  const lastNav  = series.at(-1)?.nav ?? summary?.current_nav ?? 0;
  const firstNav = series[0]?.nav ?? lastNav;
  const deltaAbs = lastNav - firstNav;
  const deltaPct = firstNav > 0 ? deltaAbs / firstNav : 0;
  const isUp     = deltaAbs >= 0;

  const path = useMemo(() => buildSparkPath(series.map((p) => p.nav)), [series]);

  if (isLoading) {
    return (
      <div className="rounded-md border bg-card p-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-10 w-full" />
      </div>
    );
  }

  if (isError || series.length < 2) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between rounded-md border bg-card p-3 text-left text-xs text-muted-foreground hover:bg-accent"
      >
        <span>Performance chart</span>
        <span>Open →</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Open performance chart"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isUp
            ? <TrendingUp  className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            : <TrendingDown className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />}
          <span className="text-sm font-medium">
            Performance · {lookback}d
          </span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-2 text-xs tabular-nums">
          <Numeric value={deltaAbs} format="pnl" currency={currency} colorBySign className="font-medium" />
          <Numeric value={deltaPct} format="percent" colorBySign className="text-[11px]" />
        </div>
      </div>
      <Sparkline path={path} up={isUp} />
    </button>
  );
}

// ── Inline SVG sparkline ──────────────────────────────────────────────────────

function Sparkline({ path, up }: { path: string; up: boolean }) {
  const stroke = up ? "rgb(16 185 129)" : "rgb(239 68 68)";   // emerald-500 / red-500
  return (
    <svg
      viewBox="0 0 100 28"
      className="h-10 w-28 shrink-0"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildSparkPath(values: number[]): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 100 / (values.length - 1);
  // Invert y so higher values render UP.
  return values
    .map((v, i) => {
      const x = +(i * stepX).toFixed(2);
      const y = +((1 - (v - min) / range) * 28).toFixed(2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}
