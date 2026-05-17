/**
 * Markets — FII/DII Flow Dashboard.
 *
 * Route: /dashboard/markets/fii-dii
 *
 * Layout:
 *   - Header + date range selector (30D / 90D / 1Y)
 *   - KPI row: FII Net, DII Net, Combined Net
 *   - ComposedChart: FII bars (blue/red), DII bars (green/amber), cumulative net line
 *   - Table: last 20 days
 */

import { useState, useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { format } from "date-fns";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";

import { useFiiDii, type FiiDiiPoint } from "../hooks/useFiiDii";

// ── Constants ──────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y",  days: 252 },
] as const;

type RangeLabel = (typeof RANGE_OPTIONS)[number]["label"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCr(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${(n / 10_000).toFixed(1)}T`;
  return `${n.toFixed(0)} Cr`;
}

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso + "T00:00:00"), "dd MMM");
  } catch {
    return iso;
  }
}

function deltaClass(v: number): string {
  return v >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  subtitle?: string;
}

function KpiCard({ label, value, subtitle }: KpiCardProps) {
  const positive = value >= 0;
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {positive ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span className={["text-xl font-bold tabular-nums", deltaClass(value)].join(" ")}>
            {positive ? "+" : ""}
            {fmtCr(value)}
          </span>
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg p-3 shadow-md text-xs space-y-1 min-w-[140px]">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-3">
          <span className="text-muted-foreground">{entry.name}</span>
          <span
            className={[
              "font-medium tabular-nums",
              entry.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
            ].join(" ")}
          >
            {entry.value >= 0 ? "+" : ""}{entry.value.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FiiDiiPage() {
  const [range, setRange] = useState<RangeLabel>("30D");
  const days = RANGE_OPTIONS.find((r) => r.label === range)?.days ?? 30;

  const { data, isLoading, isError, error } = useFiiDii(days);

  const points: FiiDiiPoint[] = data?.data ?? [];

  // Compute cumulative net for line overlay
  const chartData = useMemo(() => {
    let cumulative = 0;
    return points.map((p) => {
      cumulative += p.total_net;
      return {
        date: fmtDate(p.date),
        fii_net: p.fii_net,
        dii_net: p.dii_net,
        total_net: p.total_net,
        cumulative_net: Math.round(cumulative),
      };
    });
  }, [points]);

  // Period aggregates for KPI
  const fiiPeriodNet = useMemo(
    () => points.reduce((s, p) => s + p.fii_net, 0),
    [points],
  );
  const diiPeriodNet = useMemo(
    () => points.reduce((s, p) => s + p.dii_net, 0),
    [points],
  );
  const combinedNet = fiiPeriodNet + diiPeriodNet;

  // Last 20 for table
  const tableRows = useMemo(() => [...points].reverse().slice(0, 20), [points]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">FII / DII Flows</h1>
              <p className="text-sm text-muted-foreground">
                Daily institutional net buy/sell activity (NSE)
                {data?.is_stale && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-400 text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Sample data
                  </Badge>
                )}
              </p>
            </div>
          </div>

          {/* Range selector */}
          <div className="flex gap-1.5">
            {RANGE_OPTIONS.map(({ label }) => (
              <Button
                key={label}
                variant={range === label ? "default" : "outline"}
                size="sm"
                onClick={() => setRange(label)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {isError && (
          <ErrorState
            title="Failed to load FII/DII data"
            description={(error as Error)?.message}
          />
        )}

        {/* KPI Row */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard
              label={`FII Net (${range})`}
              value={fiiPeriodNet}
              subtitle="Foreign Institutional Investors"
            />
            <KpiCard
              label={`DII Net (${range})`}
              value={diiPeriodNet}
              subtitle="Domestic Institutional Investors"
            />
            <KpiCard
              label={`Combined Net (${range})`}
              value={combinedNet}
              subtitle="FII + DII aggregate flow"
            />
          </div>
        )}

        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily FII / DII Net Flows (₹ Cr)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <SkeletonCard />
            ) : chartData.length === 0 ? (
              <EmptyState
                title="No data"
                description="No flow data available for the selected period."
              />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 4, right: 50, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    interval={Math.max(1, Math.floor(chartData.length / 8))}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="square"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                  <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />

                  {/* FII Net bars — blue (positive) / red (negative) */}
                  <Bar yAxisId="left" dataKey="fii_net" name="FII Net" radius={[2, 2, 0, 0]} maxBarSize={12}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`fii-${index}`}
                        fill={entry.fii_net >= 0 ? "#3b82f6" : "#ef4444"}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>

                  {/* DII Net bars — green (positive) / amber (negative) */}
                  <Bar yAxisId="left" dataKey="dii_net" name="DII Net" radius={[2, 2, 0, 0]} maxBarSize={12}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`dii-${index}`}
                        fill={entry.dii_net >= 0 ? "#22c55e" : "#f59e0b"}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>

                  {/* Cumulative net line — right axis */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative_net"
                    name="Cumulative Net"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Table — last 20 days */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Last 20 Sessions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4">
                <SkeletonCard />
              </div>
            ) : tableRows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No data" description="No sessions available." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">FII Net (₹ Cr)</TableHead>
                      <TableHead className="text-right">DII Net (₹ Cr)</TableHead>
                      <TableHead className="text-right">Total Net (₹ Cr)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell className="text-sm tabular-nums">
                          {fmtDate(row.date)}
                        </TableCell>
                        <TableCell
                          className={[
                            "text-right text-sm tabular-nums font-medium",
                            deltaClass(row.fii_net),
                          ].join(" ")}
                        >
                          {row.fii_net >= 0 ? "+" : ""}{row.fii_net.toFixed(0)}
                        </TableCell>
                        <TableCell
                          className={[
                            "text-right text-sm tabular-nums font-medium",
                            deltaClass(row.dii_net),
                          ].join(" ")}
                        >
                          {row.dii_net >= 0 ? "+" : ""}{row.dii_net.toFixed(0)}
                        </TableCell>
                        <TableCell
                          className={[
                            "text-right text-sm tabular-nums font-medium",
                            deltaClass(row.total_net),
                          ].join(" ")}
                        >
                          {row.total_net >= 0 ? "+" : ""}{row.total_net.toFixed(0)}
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
