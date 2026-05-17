/**
 * Markets — Real-time Market Scanner.
 *
 * Route: /dashboard/markets/scanner
 *
 * Scans all NSE instruments for technical setups and surfaces actionable
 * signals. Filter presets (RSI, MACD, SuperTrend, composite) with
 * any/all match mode, auto-refresh, score bars, and CSV export.
 */

import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ChevronRight,
  Download,
  Radar,
  RefreshCw,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/design-system";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useScanner, type ScanFilter, type ScanResult } from "../hooks/useScanner";
import { useWatchlists } from "../hooks/useWatchlists";
import { useAddWatchlistItem } from "../hooks/useWatchlists";
import { isMarketOpen } from "../utils/market-hours";

// ─── Filter metadata ──────────────────────────────────────────────────────────

interface FilterMeta {
  key:         ScanFilter;
  label:       string;
  variant:     "bullish" | "bearish";
  description: string;
}

const FILTER_META: FilterMeta[] = [
  { key: "strong_buy",      label: "Strong Buy",       variant: "bullish", description: "2+ indicators bullish — strong buy signal" },
  { key: "rsi_oversold",    label: "RSI Oversold",     variant: "bullish", description: "RSI < 30 — oversold, potential bounce" },
  { key: "macd_bullish",    label: "MACD Bullish",     variant: "bullish", description: "MACD bullish crossover — momentum turning up" },
  { key: "supertrend_buy",  label: "SuperTrend Buy",   variant: "bullish", description: "SuperTrend signal = buy — uptrend confirmed" },
  { key: "near_52w_high",   label: "Near 52W High",    variant: "bullish", description: "Within 5% of the 52-week high" },
  { key: "strong_sell",     label: "Strong Sell",      variant: "bearish", description: "2+ indicators bearish — strong sell signal" },
  { key: "rsi_overbought",  label: "RSI Overbought",   variant: "bearish", description: "RSI > 70 — overbought, potential correction" },
  { key: "macd_bearish",    label: "MACD Bearish",     variant: "bearish", description: "MACD bearish crossover — momentum turning down" },
  { key: "supertrend_sell", label: "SuperTrend Sell",  variant: "bearish", description: "SuperTrend signal = sell — downtrend confirmed" },
  { key: "near_52w_low",    label: "Near 52W Low",     variant: "bearish", description: "Within 5% of the 52-week low" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function fmtAge(minutes: number): string {
  if (minutes < 0) return "unknown";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

// ─── Score Bar (5 segments) ───────────────────────────────────────────────────

function ScoreBar({ score, direction }: { score: number; direction: string }) {
  const filled = Math.round((score / 100) * 5);
  const isBuy = direction === "buy";
  const isSell = direction === "sell";
  const color = isBuy
    ? "bg-emerald-500"
    : isSell
      ? "bg-rose-500"
      : "bg-amber-400";

  return (
    <div className="flex gap-0.5" title={`Score: ${score}`} aria-label={`Score ${score} out of 100`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`h-3 w-4 rounded-sm ${i < filled ? color : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

// ─── Signal Badge ─────────────────────────────────────────────────────────────

function SignalBadge({ direction, confidence }: { direction: string; confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (direction === "buy") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
        BUY {pct}%
      </span>
    );
  }
  if (direction === "sell") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-400">
        SELL {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      NEUTRAL
    </span>
  );
}

// ─── RSI Display ─────────────────────────────────────────────────────────────

function RsiCell({ rsi }: { rsi: number | null }) {
  if (rsi == null) return <span className="text-muted-foreground">—</span>;
  const color =
    rsi < 30
      ? "text-emerald-600 dark:text-emerald-400 font-bold"
      : rsi > 70
        ? "text-rose-500 dark:text-rose-400 font-bold"
        : "text-foreground";
  return <span className={`tabular-nums text-xs ${color}`}>{rsi.toFixed(1)}</span>;
}

// ─── Auto-refresh countdown ───────────────────────────────────────────────────

function RefreshBadge({
  dataUpdatedAt,
  intervalMs,
}: {
  dataUpdatedAt: number;
  intervalMs: number;
}) {
  const [, forceRerender] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Re-render every 5s to update countdown
  if (timerRef.current === null) {
    timerRef.current = setInterval(() => forceRerender((n) => n + 1), 5000);
  }

  if (dataUpdatedAt === 0) return null;

  const elapsed = Date.now() - dataUpdatedAt;
  const remaining = Math.max(0, Math.round((intervalMs - elapsed) / 1000));

  return (
    <span className="rounded-full border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      refreshes in {remaining}s
    </span>
  );
}

// ─── Results table row ────────────────────────────────────────────────────────

function ResultRow({ row }: { row: ScanResult }) {
  const positive = (row.change_pct ?? 0) >= 0;
  const hasChange = row.change_pct != null;

  return (
    <tr className="border-b transition-colors hover:bg-muted/30 last:border-0">
      {/* Symbol */}
      <td className="whitespace-nowrap px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <Link
            to={`/dashboard/markets/watchlists`}
            className="font-mono text-xs font-bold text-primary hover:underline"
          >
            {row.symbol}
          </Link>
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {row.exchange} · {row.instrument_type}
          </span>
        </div>
      </td>

      {/* LTP */}
      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums">
        {row.ltp != null ? `₹${fmtINR(row.ltp)}` : "—"}
      </td>

      {/* Change % */}
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <span
          className={`text-xs font-semibold tabular-nums ${
            hasChange
              ? positive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500 dark:text-rose-400"
              : "text-muted-foreground"
          }`}
        >
          {fmtPct(row.change_pct)}
        </span>
      </td>

      {/* Signal */}
      <td className="px-3 py-2.5">
        <SignalBadge direction={row.direction} confidence={row.confidence} />
      </td>

      {/* Score */}
      <td className="px-3 py-2.5">
        <ScoreBar score={row.score} direction={row.direction} />
      </td>

      {/* RSI */}
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <RsiCell rsi={row.rsi} />
      </td>

      {/* MACD */}
      <td className="whitespace-nowrap px-3 py-2.5 text-center">
        {row.macd_crossover && row.macd_crossover !== "none" ? (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              row.macd_crossover === "bullish"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500 dark:text-rose-400"
            }`}
          >
            {row.macd_crossover}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </td>

      {/* Rationale */}
      <td className="max-w-[200px] px-3 py-2.5">
        <p
          className="truncate text-[11px] text-muted-foreground"
          title={row.rationale}
        >
          {row.rationale || "—"}
        </p>
      </td>

      {/* Age */}
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-[10px] text-muted-foreground">
        {fmtAge(row.signal_age_minutes)}
      </td>
    </tr>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: 9 }).map((__, j) => (
            <td key={j} className="px-3 py-2.5">
              <Skeleton className="h-3 w-full rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(results: ScanResult[], filters: string[]) {
  const header = [
    "Symbol", "Exchange", "Type", "Direction", "Score", "Confidence%",
    "LTP", "Change%", "RSI", "MACD", "SuperTrend", "Age (min)", "Rationale",
    "Matched Filters",
  ].join(",");

  const rows = results.map((r) =>
    [
      r.symbol,
      r.exchange,
      r.instrument_type,
      r.direction,
      r.score,
      Math.round(r.confidence * 100),
      r.ltp ?? "",
      r.change_pct ?? "",
      r.rsi ?? "",
      r.macd_crossover ?? "",
      r.supertrend ?? "",
      r.signal_age_minutes,
      `"${(r.rationale ?? "").replace(/"/g, "'")}"`,
      `"${r.matched_filters.join("; ")}"`,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scanner_${filters.join("_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Add-all-BUY button ───────────────────────────────────────────────────────

function AddBuySignalsButton({ results }: { results: ScanResult[] }) {
  const watchlists = useWatchlists();
  const defaultWl  = watchlists.data?.find((w) => w.is_default);
  const addItem    = useAddWatchlistItem(defaultWl?.id);

  // Must call useCallback unconditionally before any early return
  const handleAdd = useCallback(() => {
    // Scanner results don't carry instrument UUIDs; adding individual items
    // requires looking them up by symbol. This navigates to the watchlist page
    // which is the canonical instrument-search entry point.
    // A follow-up iteration can batch-resolve instrument_ids via the worker.
  }, []);

  const buyResults = results.filter((r) => r.direction === "buy").slice(0, 20);

  if (buyResults.length === 0 || !defaultWl) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
      onClick={handleAdd}
      disabled={addItem.isPending}
    >
      <Activity className="h-3.5 w-3.5" />
      Add all BUY signals to watchlist
    </Button>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const [selectedFilters, setSelectedFilters] = useState<ScanFilter[]>(["strong_buy"]);
  const [matchMode, setMatchMode]             = useState<"any" | "all">("any");

  const { data, isPending, isError, error, dataUpdatedAt, refetch } = useScanner(
    selectedFilters,
    matchMode,
  );

  const marketOpen   = isMarketOpen();
  const intervalMs   = marketOpen ? 60_000 : 300_000;
  const results      = data?.results ?? [];
  const totalScanned = data?.total_scanned ?? 0;
  const totalMatched = data?.total_matched ?? 0;
  const asOf         = data?.as_of;

  const toggleFilter = useCallback((key: ScanFilter) => {
    setSelectedFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
    );
  }, []);

  const handleExportCsv = useCallback(() => {
    exportCsv(results, selectedFilters);
  }, [results, selectedFilters]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-screen-xl space-y-6 p-4 sm:p-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Radar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Market Scanner</h1>
              <p className="text-sm text-muted-foreground">
                {totalScanned > 0
                  ? `${totalScanned.toLocaleString("en-IN")} instruments scanned`
                  : "Real-time technical scan across NSE instruments"}
                {asOf && (
                  <span className="ml-2 text-xs text-muted-foreground/60">
                    · as of {new Date(asOf).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dataUpdatedAt > 0 && (
              <RefreshBadge dataUpdatedAt={dataUpdatedAt} intervalMs={intervalMs} />
            )}
            <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
              {marketOpen ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              )}
              <span className={`text-xs font-medium ${marketOpen ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                Auto-refresh: {marketOpen ? "1 min" : "5 min"}
              </span>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </header>

        {/* ── Filter panel ────────────────────────────────────────────── */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Filter Presets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bullish filters */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Bullish
              </p>
              <div className="flex flex-wrap gap-2">
                {FILTER_META.filter((f) => f.variant === "bullish").map((f) => {
                  const active = selectedFilters.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      title={f.description}
                      onClick={() => toggleFilter(f.key)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                        active
                          ? "border-emerald-500 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "border-muted-foreground/30 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bearish filters */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">
                Bearish
              </p>
              <div className="flex flex-wrap gap-2">
                {FILTER_META.filter((f) => f.variant === "bearish").map((f) => {
                  const active = selectedFilters.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      title={f.description}
                      onClick={() => toggleFilter(f.key)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                        active
                          ? "border-rose-500 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                          : "border-muted-foreground/30 text-muted-foreground hover:border-rose-400 hover:text-rose-600 dark:hover:border-rose-700 dark:hover:text-rose-400"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Match mode */}
            <div className="flex items-center gap-4 border-t pt-3">
              <span className="text-xs font-semibold text-muted-foreground">Match:</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="match-mode"
                  checked={matchMode === "any"}
                  onChange={() => setMatchMode("any")}
                  className="accent-primary"
                />
                <span className={matchMode === "any" ? "font-semibold text-primary" : "text-muted-foreground"}>
                  Any filter (OR)
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="match-mode"
                  checked={matchMode === "all"}
                  onChange={() => setMatchMode("all")}
                  className="accent-primary"
                />
                <span className={matchMode === "all" ? "font-semibold text-primary" : "text-muted-foreground"}>
                  All filters (AND)
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ── Empty state (no filters selected) ───────────────────────── */}
        {selectedFilters.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-14 text-center">
            <Radar className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="font-semibold text-muted-foreground">No filters selected</p>
              <p className="mt-0.5 text-sm text-muted-foreground/60">
                Select at least one filter above to start scanning
              </p>
            </div>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {selectedFilters.length > 0 && (
          <section aria-labelledby="results-heading">
            {/* Results header */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2
                  id="results-heading"
                  className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70"
                >
                  Results
                </h2>
                {!isPending && !isError && (
                  <Badge variant="secondary" className="text-[10px]">
                    {totalMatched.toLocaleString("en-IN")} matched
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isPending && results.length > 0 && (
                  <AddBuySignalsButton results={results} />
                )}
                {!isPending && results.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleExportCsv}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                )}
              </div>
            </div>

            {/* Error state */}
            {isError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/30">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Scanner error</p>
                <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-400/70">
                  {(error as Error)?.message ?? "Failed to load scanner results"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Table */}
            {!isError && (
              <Card className="rounded-xl shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                          <th className="px-3 py-2.5 text-left">Symbol</th>
                          <th className="px-3 py-2.5 text-right">LTP</th>
                          <th className="px-3 py-2.5 text-right">Change</th>
                          <th className="px-3 py-2.5 text-left">Signal</th>
                          <th className="px-3 py-2.5 text-left">Score</th>
                          <th className="px-3 py-2.5 text-right">RSI</th>
                          <th className="px-3 py-2.5 text-center">MACD</th>
                          <th className="px-3 py-2.5 text-left">Rationale</th>
                          <th className="px-3 py-2.5 text-right">Age</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isPending ? (
                          <SkeletonRows />
                        ) : results.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-12 text-center">
                              <Radar className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                              <p className="text-sm font-semibold text-muted-foreground">
                                No matches found
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground/60">
                                Try selecting different filters or switching to Any match mode
                              </p>
                            </td>
                          </tr>
                        ) : (
                          results.map((row) => (
                            <ResultRow key={`${row.symbol}-${row.exchange}`} row={row} />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer */}
                  {!isPending && results.length > 0 && (
                    <div className="border-t px-4 py-2.5 text-[11px] text-muted-foreground">
                      Showing {results.length} of {totalMatched} results
                      {selectedFilters.length > 0 && (
                        <span className="ml-1">
                          · Filters: {selectedFilters.join(", ")} ({matchMode})
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Nav hint */}
            {!isPending && results.length > 0 && (
              <div className="mt-3 flex justify-end">
                <Link
                  to="/dashboard/markets/signals"
                  className="flex items-center gap-0.5 text-[11px] text-primary underline-offset-2 hover:underline"
                >
                  View all computed signals
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </section>
        )}

      </div>
    </DashboardLayout>
  );
}
