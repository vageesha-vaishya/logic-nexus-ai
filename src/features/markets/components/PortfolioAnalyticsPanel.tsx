/**
 * Portfolio Analytics Panel
 *
 * Computes XIRR, Sharpe ratio, max drawdown, and annualised volatility from
 * the portfolio's P&L series (usePortfolioPnL).  Also renders:
 *   - A drawdown area chart over time
 *   - A daily-returns histogram
 */

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, SkeletonCard, EmptyState } from "@/design-system";
import { usePortfolioPnL } from "../hooks/usePortfolioPnL";
import type { PnLPoint } from "../hooks/usePortfolioPnL";
import { xirr, formatXirr } from "../utils/xirr";

// ── Analytics helpers ─────────────────────────────────────────────────────────

function computeSharpe(series: PnLPoint[], riskFreeRate = 0.065): number | null {
  if (series.length < 30) return null;
  const returns = series.slice(1).map((p, i) => {
    const prev = series[i].nav;
    return prev > 0 ? (p.nav - prev) / prev : 0;
  });
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  return ((avg - riskFreeRate / 252) / std) * Math.sqrt(252);
}

function computeMaxDrawdown(series: PnLPoint[]): number {
  let maxDD = 0;
  let peak = -Infinity;
  for (const p of series) {
    if (p.nav > peak) peak = p.nav;
    const dd = peak > 0 ? (peak - p.nav) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function computeVolatility(series: PnLPoint[]): number | null {
  if (series.length < 30) return null;
  const returns = series.slice(1).map((p, i) => {
    const prev = series[i].nav;
    return prev > 0 ? (p.nav - prev) / prev : 0;
  });
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance * 252) * 100; // annualised, as percentage
}

function computeXirrFromSeries(series: PnLPoint[]): number | null {
  if (series.length < 2) return null;
  const cashflows: Array<{ amount: number; date: Date }> = [];
  let prevInvested = 0;
  for (const p of series) {
    const delta = p.invested - prevInvested;
    if (Math.abs(delta) > 100) {
      cashflows.push({ amount: -delta, date: new Date(p.date) });
    }
    prevInvested = p.invested;
  }
  const last = series[series.length - 1];
  cashflows.push({ amount: last.nav, date: new Date(last.date) });
  return xirr(cashflows);
}

// ── Drawdown series ───────────────────────────────────────────────────────────

interface DrawdownPoint {
  date: string;
  drawdown: number; // negative percentage
}

function buildDrawdownSeries(series: PnLPoint[]): DrawdownPoint[] {
  let peak = -Infinity;
  return series.map((p) => {
    if (p.nav > peak) peak = p.nav;
    const dd = peak > 0 ? -((peak - p.nav) / peak) * 100 : 0;
    return { date: p.date, drawdown: dd };
  });
}

// ── Daily-returns histogram buckets ──────────────────────────────────────────

interface ReturnBucket {
  label: string;
  count: number;
}

function buildReturnHistogram(series: PnLPoint[]): ReturnBucket[] {
  if (series.length < 2) return [];
  const returns = series.slice(1).map((p, i) => {
    const prev = series[i].nav;
    return prev > 0 ? ((p.nav - prev) / prev) * 100 : 0;
  });

  // Buckets: < -3%, -3 to -2%, -2 to -1%, -1 to 0%, 0 to 1%, 1 to 2%, 2 to 3%, > 3%
  const buckets = [
    { label: "<-3%", min: -Infinity, max: -3 },
    { label: "-3–-2%", min: -3, max: -2 },
    { label: "-2–-1%", min: -2, max: -1 },
    { label: "-1–0%", min: -1, max: 0 },
    { label: "0–1%", min: 0, max: 1 },
    { label: "1–2%", min: 1, max: 2 },
    { label: "2–3%", min: 2, max: 3 },
    { label: ">3%", min: 3, max: Infinity },
  ];

  return buckets.map((b) => ({
    label: b.label,
    count: returns.filter((r) => r >= b.min && r < b.max).length,
  }));
}

// ── Metric tile ───────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-semibold tabular-nums ${valueClass ?? ""}`}>{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface PortfolioAnalyticsPanelProps {
  portfolioId: string | undefined;
}

export function PortfolioAnalyticsPanel({ portfolioId }: PortfolioAnalyticsPanelProps) {
  const { data, isLoading, isError } = usePortfolioPnL(portfolioId, 365);

  const analytics = useMemo(() => {
    if (!data || data.series.length < 2) return null;
    const series = [...data.series].sort((a, b) => a.date.localeCompare(b.date));
    return {
      xirr: computeXirrFromSeries(series),
      sharpe: computeSharpe(series),
      maxDrawdown: computeMaxDrawdown(series),
      volatility: computeVolatility(series),
      drawdownSeries: buildDrawdownSeries(series),
      histogram: buildReturnHistogram(series),
      sufficient: series.length >= 30,
    };
  }, [data]);

  if (isLoading) return <SkeletonCard withHeader lines={5} />;

  if (isError || !data) {
    return (
      <EmptyState
        title="Analytics unavailable"
        description="Could not load P&L data. Please try again later."
      />
    );
  }

  if (!analytics || !analytics.sufficient) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Need at least 30 days of data to compute analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { xirr: xirrRate, sharpe, maxDrawdown, volatility, drawdownSeries, histogram } = analytics;

  // Sharpe colour: > 1 green, 0.5-1 amber, < 0.5 red/muted
  const sharpeClass =
    sharpe === null
      ? ""
      : sharpe >= 1
        ? "text-emerald-600 dark:text-emerald-400"
        : sharpe >= 0.5
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-500 dark:text-red-400";

  // XIRR colour: positive → green, negative → red
  const xirrClass =
    xirrRate === null
      ? ""
      : xirrRate >= 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-500 dark:text-red-400";

  return (
    <div className="space-y-6">
      {/* ── Metric tiles ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile
          label="XIRR"
          value={formatXirr(xirrRate)}
          sub="Annualised return"
          valueClass={xirrClass}
        />
        <MetricTile
          label="Sharpe Ratio"
          value={sharpe !== null ? sharpe.toFixed(2) : "—"}
          sub="Risk-adj return"
          valueClass={sharpeClass}
        />
        <MetricTile
          label="Max Drawdown"
          value={`-${(maxDrawdown * 100).toFixed(1)}%`}
          sub="Peak-to-trough"
          valueClass="text-red-500 dark:text-red-400"
        />
        <MetricTile
          label="Volatility"
          value={volatility !== null ? `${volatility.toFixed(1)}%` : "—"}
          sub="Std dev p.a."
        />
      </div>

      {/* ── Drawdown chart ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drawdown over Time</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={drawdownSeries} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(0, 7)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                domain={["auto", 0]}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                fill="url(#ddGrad)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Daily returns histogram ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Returns Distribution</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={histogram} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                formatter={(v: number) => [`${v} days`, "Count"]}
              />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
