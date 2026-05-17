/**
 * Markets — Portfolio Attribution Tab
 * Displays performance attribution analysis: sector allocation, top/bottom
 * contributors, monthly flows, and per-position breakdown.
 */

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { AlertCircle } from "lucide-react";

import { usePortfolioAttribution } from "../hooks/usePortfolioAttribution";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  SkeletonCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";

// ─── Currency formatter ────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000) {
    return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  }
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number, decimals = 2): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

function pnlCls(v: number) {
  return v >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";
}

// ─── Sector colour palette ──────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  "Financial Services": "#93c5fd",
  "IT":                 "#67e8f9",
  "Technology":         "#67e8f9",
  "Energy":             "#fdba74",
  "Healthcare":         "#86efac",
  "Pharma":             "#86efac",
  "Consumer":           "#f9a8d4",
  "FMCG":               "#f9a8d4",
  "Automobile":         "#fde68a",
  "Auto":               "#fde68a",
  "Metals":             "#c4b5fd",
  "Realty":             "#a5b4fc",
  "Others":             "#d1d5db",
};

function sectorColor(name: string): string {
  return (
    SECTOR_COLORS[name] ??
    SECTOR_COLORS[Object.keys(SECTOR_COLORS).find((k) => name.includes(k)) ?? ""] ??
    SECTOR_COLORS["Others"]
  );
}

// ─── Lookback selector ─────────────────────────────────────────────────────

const LOOKBACK_OPTIONS = [
  { label: "30D",  value: 30  },
  { label: "90D",  value: 90  },
  { label: "180D", value: 180 },
  { label: "365D", value: 365 },
];

interface LookbackSelectorProps {
  value: number;
  onChange: (v: number) => void;
}

function LookbackSelector({ value, onChange }: LookbackSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {LOOKBACK_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Custom pie label ───────────────────────────────────────────────────────

function renderPieLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  name,
  weight_pct,
}: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 24;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if ((weight_pct ?? 0) < 3) return null; // skip tiny slices
  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="fill-foreground text-[10px]"
      fontSize={10}
    >
      {name} {(weight_pct ?? 0).toFixed(1)}%
    </text>
  );
}

// ─── Month label formatter ─────────────────────────────────────────────────

function fmtMonth(m: string): string {
  // Expects "YYYY-MM" or "2025-01"
  try {
    const d = new Date(`${m}-01`);
    return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  } catch {
    return m;
  }
}

// ─── Main component ────────────────────────────────────────────────────────

interface Props {
  portfolioId: string;
}

export function PortfolioAttributionTab({ portfolioId }: Props) {
  const [lookback, setLookback] = useState(365);
  const { data, isPending, isError, error } = usePortfolioAttribution(portfolioId, lookback);

  return (
    <div className="space-y-6">
      {/* Header with lookback selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Performance Attribution</h3>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">
              As of {new Date(data.as_of).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              {" "}&middot; {data.lookback_days}d lookback
            </p>
          )}
        </div>
        <LookbackSelector value={lookback} onChange={setLookback} />
      </div>

      {/* Loading state */}
      {isPending && (
        <div className="space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard withHeader lines={6} />
          <SkeletonCard withHeader lines={4} />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Failed to load attribution data</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error?.message ?? "Unknown error"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data loaded */}
      {data && (
        <>
          {/* ── Card 1: Summary bar ────────────────────────────────────── */}
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <SummaryMetric label="Total Invested" value={fmtCurrency(data.summary.total_invested)} />
                <SummaryMetric label="Current Value"  value={fmtCurrency(data.summary.total_current_value)} />
                <SummaryMetric
                  label="P&L"
                  value={fmtCurrency(data.summary.total_pnl)}
                  className={pnlCls(data.summary.total_pnl)}
                />
                <SummaryMetric
                  label="Return"
                  value={fmtPct(data.summary.total_pnl_pct)}
                  className={pnlCls(data.summary.total_pnl_pct)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Card 2: Sector Allocation ──────────────────────────────── */}
          {data.sectors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Pie chart */}
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={data.sectors}
                          dataKey="weight_pct"
                          nameKey="sector"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          labelLine={false}
                          label={renderPieLabel}
                        >
                          {data.sectors.map((s) => (
                            <Cell key={s.sector} fill={sectorColor(s.sector)} />
                          ))}
                        </Pie>
                        <ReTooltip
                          formatter={(value: number, name: string) => [
                            `${value.toFixed(1)}%`,
                            name,
                          ]}
                          contentStyle={{ fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Sector table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>Sector</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                          <TableHead className="text-right">P&amp;L</TableHead>
                          <TableHead className="text-right">Return</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.sectors
                          .slice()
                          .sort((a, b) => b.weight_pct - a.weight_pct)
                          .map((s) => (
                            <TableRow key={s.sector} className="text-xs">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ background: sectorColor(s.sector) }}
                                  />
                                  <span className="truncate max-w-[120px]">{s.sector}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {s.weight_pct.toFixed(1)}%
                              </TableCell>
                              <TableCell className={`text-right tabular-nums ${pnlCls(s.pnl)}`}>
                                {fmtCurrency(s.pnl)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant={s.pnl_pct >= 0 ? "default" : "destructive"}
                                  className="text-xs font-mono"
                                >
                                  {fmtPct(s.pnl_pct, 1)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Card 3: Contributors ───────────────────────────────────── */}
          {(data.top_contributors.length > 0 || data.bottom_contributors.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Top &amp; Bottom Contributors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Top contributors */}
                  <div>
                    <p className="mb-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Top Contributors
                    </p>
                    {data.top_contributors.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                          data={data.top_contributors.slice(0, 5)}
                          layout="vertical"
                          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                          <YAxis type="category" dataKey="symbol" tick={{ fontSize: 11 }} width={72} />
                          <ReTooltip
                            formatter={(v: number) => [`${v.toFixed(2)}%`, "Contribution"]}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Bar dataKey="contribution_pct" fill="#10b981" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-xs text-muted-foreground">No data available</p>
                    )}
                  </div>

                  {/* Bottom contributors */}
                  <div>
                    <p className="mb-3 text-xs font-medium text-red-500 dark:text-red-400">
                      Bottom Contributors
                    </p>
                    {data.bottom_contributors.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                          data={data.bottom_contributors.slice(0, 5)}
                          layout="vertical"
                          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                          <YAxis type="category" dataKey="symbol" tick={{ fontSize: 11 }} width={72} />
                          <ReTooltip
                            formatter={(v: number) => [`${v.toFixed(2)}%`, "Contribution"]}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Bar dataKey="contribution_pct" fill="#ef4444" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-xs text-muted-foreground">No data available</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Card 4: Monthly Flows ──────────────────────────────────── */}
          {data.monthly_flows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Monthly Flows</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.monthly_flows.map((m) => ({
                      ...m,
                      month: fmtMonth(m.month),
                    }))}
                    margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtCurrency(v)} />
                    <ReTooltip
                      formatter={(value: number, name: string) => [
                        fmtCurrency(value),
                        name === "buy_amount" ? "Buys" : name === "sell_amount" ? "Sells" : "Net Flow",
                      ]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend formatter={(v) => (v === "buy_amount" ? "Buys" : v === "sell_amount" ? "Sells" : "Net Flow")} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="buy_amount"  fill="#3b82f6" name="buy_amount"  radius={[3, 3, 0, 0]} />
                    <Bar dataKey="sell_amount" fill="#f97316" name="sell_amount" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── Card 5: Position Table ─────────────────────────────────── */}
          {data.positions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Position Breakdown
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    {data.positions.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Symbol</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Avg Cost</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">P&amp;L</TableHead>
                        <TableHead className="text-right">Return%</TableHead>
                        <TableHead className="text-right">Contribution%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.positions
                        .slice()
                        .sort((a, b) => b.contribution_pct - a.contribution_pct)
                        .map((pos) => {
                          const maxContrib = Math.max(
                            ...data.positions.map((p) => Math.abs(p.contribution_pct))
                          );
                          const barWidth = maxContrib > 0
                            ? Math.round((Math.abs(pos.contribution_pct) / maxContrib) * 100)
                            : 0;

                          return (
                            <TableRow key={pos.symbol} className="text-xs hover:bg-muted/30">
                              <TableCell className="font-mono font-semibold py-2">
                                {pos.symbol}
                              </TableCell>
                              <TableCell className="text-muted-foreground py-2 max-w-[120px] truncate">
                                {pos.sector}
                              </TableCell>
                              <TableCell className="text-right tabular-nums py-2">
                                {pos.quantity.toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell className="text-right tabular-nums py-2 text-muted-foreground">
                                {fmtCurrency(pos.avg_cost)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums py-2">
                                {fmtCurrency(pos.current_price)}
                              </TableCell>
                              <TableCell className={`text-right tabular-nums py-2 ${pnlCls(pos.pnl)}`}>
                                {fmtCurrency(pos.pnl)}
                              </TableCell>
                              <TableCell className={`text-right tabular-nums py-2 ${pnlCls(pos.pnl_pct)}`}>
                                {fmtPct(pos.pnl_pct, 1)}
                              </TableCell>
                              <TableCell className="text-right py-2">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={`tabular-nums ${pnlCls(pos.contribution_pct)}`}>
                                    {fmtPct(pos.contribution_pct, 2)}
                                  </span>
                                  {/* Inline contribution bar */}
                                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${
                                        pos.contribution_pct >= 0 ? "bg-emerald-500" : "bg-red-500"
                                      }`}
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Summary metric cell ────────────────────────────────────────────────────

function SummaryMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${className ?? ""}`}>{value}</p>
    </div>
  );
}
