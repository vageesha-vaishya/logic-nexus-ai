import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  AreaSeries,
  LineSeries,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, SkeletonCard } from "@/design-system";
import { usePortfolioPnL } from "../hooks/usePortfolioPnL";
import type { PnLPoint } from "../hooks/usePortfolioPnL";

// ── Timeframe presets ────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { label: "1M",  days: 30   },
  { label: "3M",  days: 91   },
  { label: "6M",  days: 182  },
  { label: "1Y",  days: 365  },
  { label: "All", days: 1825 },
] as const;

type TFLabel = (typeof TIMEFRAMES)[number]["label"];

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function pnlClass(v: number) {
  return v >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface PortfolioPnLChartProps {
  portfolioId: string | undefined;
  className?: string;
}

export function PortfolioPnLChart({ portfolioId, className }: PortfolioPnLChartProps) {
  const [selectedLookback, setSelectedLookback] = useState(365);
  const selectedTF = TIMEFRAMES.find((t) => t.days === selectedLookback)?.label ?? "1Y";

  const { data, isLoading, isError } = usePortfolioPnL(portfolioId, selectedLookback);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const navSeriesRef  = useRef<ISeriesApi<"Area"> | null>(null);
  const costSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // ── Chart init (mount once) ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = document.documentElement.classList.contains("dark");

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#94a3b8" : "#64748b",
      },
      grid: {
        vertLines: { color: isDark ? "#1e293b" : "#f1f5f9" },
        horzLines: { color: isDark ? "#1e293b" : "#f1f5f9" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false },
      height: 280,
      width: containerRef.current.clientWidth,
    });

    const navSeries = chart.addSeries(AreaSeries, {
      lineColor: "#3b82f6",
      topColor: "rgba(59,130,246,0.3)",
      bottomColor: "rgba(59,130,246,0.02)",
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        minMove: 1,
        formatter: (v: number) => `₹${v.toLocaleString("en-IN")}`,
      },
    });

    const costSeries = chart.addSeries(LineSeries, {
      color: "#94a3b8",
      lineWidth: 1,
      lineStyle: 2,
      priceFormat: {
        type: "custom",
        minMove: 1,
        formatter: (v: number) => `₹${v.toLocaleString("en-IN")}`,
      },
    });

    chartRef.current      = chart;
    navSeriesRef.current  = navSeries;
    costSeriesRef.current = costSeries;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current      = null;
      navSeriesRef.current  = null;
      costSeriesRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data update effect ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !navSeriesRef.current || !costSeriesRef.current) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedLookback);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const filtered: PnLPoint[] = data.series
      .filter((p) => p.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    navSeriesRef.current.setData(
      filtered.map((p) => ({ time: p.date as `${number}-${number}-${number}`, value: p.nav })),
    );
    costSeriesRef.current.setData(
      filtered.map((p) => ({ time: p.date as `${number}-${number}-${number}`, value: p.invested })),
    );

    chartRef.current?.timeScale().fitContent();
  }, [data, selectedLookback]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const s = data?.summary;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <SkeletonCard withHeader lines={3} />;
  }

  if (isError || !data) {
    return null;
  }

  if (data.series.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No price history available yet. Add transactions and sync prices to see performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Portfolio Performance</CardTitle>
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.label}
                type="button"
                onClick={() => setSelectedLookback(tf.days)}
                className={cn(
                  "h-6 rounded px-2 text-xs font-medium transition-colors",
                  selectedTF === tf.label
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        {s && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1">
            <StatCell label="Current Value">
              <span className="font-semibold tabular-nums">{fmtINR(s.current_nav)}</span>
            </StatCell>
            <StatCell label="Invested">
              <span className="tabular-nums text-muted-foreground">{fmtINR(s.total_invested)}</span>
            </StatCell>
            <StatCell label="Total P&L">
              <span className={cn("font-semibold tabular-nums", pnlClass(s.total_pnl))}>
                {s.total_pnl >= 0 ? "+" : ""}
                {fmtINR(Math.abs(s.total_pnl))}
              </span>
            </StatCell>
            <StatCell label="P&L %">
              <span className={cn("font-semibold tabular-nums", pnlClass(s.pnl_pct))}>
                {s.pnl_pct >= 0 ? "+" : ""}
                {s.pnl_pct.toFixed(2)}%
              </span>
            </StatCell>
            <StatCell label="Realized">
              <span className={cn("tabular-nums", pnlClass(s.realized_pnl))}>
                {fmtINR(s.realized_pnl)}
              </span>
            </StatCell>
            <StatCell label="Unrealized">
              <span className={cn("tabular-nums", pnlClass(s.unrealized_pnl))}>
                {fmtINR(s.unrealized_pnl)}
              </span>
            </StatCell>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 pb-3 px-3">
        <div
          ref={containerRef}
          style={{ width: "100%", height: 280 }}
        />
      </CardContent>
    </Card>
  );
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
