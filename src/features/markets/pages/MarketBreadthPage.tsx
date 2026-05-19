/**
 * Market Breadth & Sector Heatmap page.
 *
 * Route: /dashboard/markets/breadth
 *
 * Layout:
 *   - Header + auto-refresh badge
 *   - Top row: 4 index cards (NIFTY 50, NIFTY Bank, NIFTY IT, India VIX)
 *   - Breadth indicator bar (advance/decline/unchanged)
 *   - Sector heatmap (full-width treemap)
 *   - Sector table sorted by change_pct DESC
 */

import { useMemo } from "react";
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  SkeletonCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";

import { useMarketBreadth, type IndexData, type SectorData } from "../hooks/useMarketBreadth";
import { SectorHeatmap } from "../components/SectorHeatmap";
import { BreadthIndicator } from "../components/BreadthIndicator";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtLtp(v: number | null, name: string): string {
  if (v === null || v === undefined) return "—";
  // VIX is dimensionless; others are index points
  if (name.toLowerCase().includes("vix")) return v.toFixed(2);
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function changePctClass(v: number | null): string {
  if (v === null) return "text-muted-foreground";
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-500 dark:text-red-400";
  return "text-muted-foreground";
}

function changeBadgeVariant(v: number | null): "default" | "outline" {
  return "outline";
}

function changeBadgeClass(v: number | null): string {
  if (v === null) return "text-muted-foreground border-muted";
  if (v > 0) return "text-emerald-600 border-emerald-400 dark:text-emerald-400 dark:border-emerald-600";
  if (v < 0) return "text-red-500 border-red-400 dark:border-red-600";
  return "text-muted-foreground border-muted";
}

function ChangeIcon({ v }: { v: number | null }) {
  if (v === null) return <Minus className="h-3 w-3" />;
  if (v > 0) return <TrendingUp className="h-3 w-3" />;
  if (v < 0) return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

// ── Index Card ─────────────────────────────────────────────────────────────────

function IndexCard({ index }: { index: IndexData }) {
  const isVix = index.name.toLowerCase().includes("vix");

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">{index.name}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <span className="text-lg font-bold tabular-nums text-foreground">
            {fmtLtp(index.ltp, index.name)}
          </span>
          <div className={["flex items-center gap-0.5 text-xs font-semibold tabular-nums", changePctClass(isVix ? null : index.change_pct)].join(" ")}>
            <ChangeIcon v={isVix ? null : index.change_pct} />
            <span>{fmtPct(index.change_pct)}</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{index.ticker}</p>
      </CardContent>
    </Card>
  );
}

// ── Skeleton rows ──────────────────────────────────────────────────────────────

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MarketBreadthPage() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useMarketBreadth();

  const sectors: SectorData[] = useMemo(
    () => data?.sectors ?? [],
    [data],
  );

  const sortedSectors = useMemo(
    () =>
      [...sectors].sort((a, b) => {
        if (a.change_pct === null && b.change_pct === null) return 0;
        if (a.change_pct === null) return 1;
        if (b.change_pct === null) return -1;
        return b.change_pct - a.change_pct;
      }),
    [sectors],
  );

  const indices = data?.indices ?? [];
  const ad = data?.advance_decline ?? { advances: 0, declines: 0, unchanged: 0 };

  const lastUpdated = dataUpdatedAt
    ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })
    : null;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <BarChart2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Market Breadth</h1>
              <p className="text-sm text-muted-foreground">
                NSE sector performance &amp; advance / decline
                {data?.is_stale && (
                  <Badge
                    variant="outline"
                    className="ml-2 text-amber-600 border-amber-400 text-[10px]"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Stale
                  </Badge>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span>Auto-refreshes every 5 min</span>
            {lastUpdated && <span className="text-[10px]">· updated {lastUpdated}</span>}
          </div>
        </div>

        {/* ── Error ── */}
        {isError && (
          <ErrorState
            title="Failed to load breadth data"
            description={(error as Error)?.message}
          />
        )}

        {/* ── Index Cards ── */}
        {isLoading ? (
          <SkeletonRows count={4} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {indices.map((idx) => (
              <IndexCard key={idx.ticker} index={idx} />
            ))}
          </div>
        )}

        {/* ── Breadth Indicator ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sector Advance / Decline</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonCard />
            ) : (
              <BreadthIndicator
                advances={ad.advances}
                declines={ad.declines}
                unchanged={ad.unchanged}
              />
            )}
          </CardContent>
        </Card>

        {/* ── Sector Heatmap ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sector Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="h-[400px] flex items-center justify-center">
                <SkeletonCard />
              </div>
            ) : sectors.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
                No sector data available.
              </div>
            ) : (
              <SectorHeatmap sectors={sectors} height={400} />
            )}
          </CardContent>
        </Card>

        {/* ── Sector Table ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sector Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4">
                <SkeletonCard />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sector</TableHead>
                      <TableHead className="text-right">Change %</TableHead>
                      <TableHead className="text-right">LTP</TableHead>
                      <TableHead>Index</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSectors.map((s) => (
                      <TableRow key={s.ticker}>
                        <TableCell className="font-medium text-sm">{s.sector}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={changeBadgeVariant(s.change_pct)}
                            className={[
                              "text-xs tabular-nums font-semibold inline-flex items-center gap-0.5",
                              changeBadgeClass(s.change_pct),
                            ].join(" ")}
                          >
                            <ChangeIcon v={s.change_pct} />
                            {fmtPct(s.change_pct)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-foreground">
                          {fmtLtp(s.ltp, s.sector)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {s.ticker}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
