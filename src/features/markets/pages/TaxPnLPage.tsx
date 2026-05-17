/**
 * Markets — Tax P&L Report Page
 *
 * Route: /dashboard/markets/portfolios/:id/tax
 *
 * Displays:
 * - Financial year selector
 * - Summary cards (Realized Gains, STCG, LTCG, Est. Tax, Harvesting Opportunity)
 * - Pie chart breakdown (STCG/LTCG gains + tax estimates)
 * - Realized trades table with filter chips
 * - Unrealized positions table with harvest candidates highlighted
 * - CSV export
 */

import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ArrowLeft,
  Download,
  Info,
  TrendingUp,
  TrendingDown,
  Leaf,
  Receipt,
  AlertCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  SkeletonCard,
  ErrorState,
  EmptyState,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/design-system";
import { useTaxPnL, type RealizedTrade, type UnrealizedPosition } from "../hooks/useTaxPnL";

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_FY = "2025-26";

const PIE_COLORS = {
  stcgGain:  "#3b82f6", // blue-500
  ltcgGain:  "#22c55e", // green-500
  stcgTax:   "#fca5a5", // red-300
  ltcgTax:   "#ef4444", // red-500
} as const;

type TradeFilter = "all" | "stcg" | "ltcg" | "losses";

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtINR(value: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
    if (abs >= 1_00_000)    return `₹${(value / 1_00_000).toFixed(2)}L`;
    if (abs >= 1_000)       return `₹${(value / 1_000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  }
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function gainClass(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-500 dark:text-red-400";
  return "text-foreground";
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(trades: RealizedTrade[], fy: string): void {
  const header =
    "Symbol,Buy Date,Sell Date,Qty,Buy Price,Sell Price,Gain,Holding Days,Type,Tax Rate%";
  const rows = trades.map((t) =>
    [
      t.symbol,
      t.buy_date,
      t.sell_date,
      t.qty,
      t.buy_price,
      t.sell_price,
      t.gain,
      t.holding_days,
      t.gain_type,
      t.tax_rate_pct,
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tax_pnl_${fy}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  valueClass?: string;
  subtext?: string;
  tooltip?: string;
  icon?: React.ReactNode;
}

function SummaryCard({ label, value, valueClass, subtext, tooltip, icon }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 shrink-0 cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className={`mt-1.5 text-xl font-semibold tabular-nums ${valueClass ?? ""}`}>
              {value}
            </p>
            {subtext && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>
            )}
          </div>
          {icon && (
            <div className="shrink-0 rounded-lg bg-muted p-2 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Realized Trades Table ────────────────────────────────────────────────────

function RealizedTradesTable({ trades }: { trades: RealizedTrade[] }) {
  const [filter, setFilter] = useState<TradeFilter>("all");

  const filtered = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => new Date(b.sell_date).getTime() - new Date(a.sell_date).getTime(),
    );
    if (filter === "stcg")   return sorted.filter((t) => t.gain_type === "STCG");
    if (filter === "ltcg")   return sorted.filter((t) => t.gain_type === "LTCG");
    if (filter === "losses") return sorted.filter((t) => t.gain < 0);
    return sorted;
  }, [trades, filter]);

  const chips: { id: TradeFilter; label: string }[] = [
    { id: "all",    label: "All" },
    { id: "stcg",   label: "STCG only" },
    { id: "ltcg",   label: "LTCG only" },
    { id: "losses", label: "Losses only" },
  ];

  if (trades.length === 0) {
    return (
      <EmptyState
        title="No realized trades"
        description="No trades were closed in this financial year."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <FilterChip
            key={c.id}
            label={c.label}
            active={filter === c.id}
            onClick={() => setFilter(c.id)}
          />
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {filtered.length} trade{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-semibold">Symbol</TableHead>
                <TableHead className="font-semibold">Buy Date</TableHead>
                <TableHead className="font-semibold">Sell Date</TableHead>
                <TableHead className="text-right font-semibold">Qty</TableHead>
                <TableHead className="text-right font-semibold">Buy ₹</TableHead>
                <TableHead className="text-right font-semibold">Sell ₹</TableHead>
                <TableHead className="text-right font-semibold">Days</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="text-right font-semibold">Gain ₹</TableHead>
                <TableHead className="text-right font-semibold">Tax Est ₹</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t, i) => {
                const taxEst = (t.gain * t.tax_rate_pct) / 100;
                return (
                  <TableRow key={`${t.symbol}-${t.sell_date}-${i}`} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-mono font-medium py-2">
                      {t.symbol}
                      {t.asset_class && t.asset_class !== "equity" && (
                        <span className="ml-1 text-muted-foreground">
                          ({t.asset_class})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDate(t.buy_date)}
                    </TableCell>
                    <TableCell className="py-2 text-muted-foreground whitespace-nowrap">
                      {fmtDate(t.sell_date)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{t.qty}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                      ₹{fmtINR(t.buy_price)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                      ₹{fmtINR(t.sell_price)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                      {t.holding_days}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant="outline"
                        className={
                          t.gain_type === "STCG"
                            ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                        }
                      >
                        {t.gain_type}
                      </Badge>
                    </TableCell>
                    <TableCell className={`py-2 text-right tabular-nums font-medium ${gainClass(t.gain)}`}>
                      {t.gain >= 0 ? "+" : ""}₹{fmtINR(t.gain)}
                      {taxEst > 0 && (
                        <div className="text-xs font-normal text-muted-foreground">
                          tax ~₹{fmtINR(taxEst)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                      {taxEst > 0 ? `₹${fmtINR(taxEst)}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Unrealized Positions Table ───────────────────────────────────────────────

function UnrealizedPositionsTable({ positions }: { positions: UnrealizedPosition[] }) {
  if (positions.length === 0) {
    return (
      <EmptyState
        title="No open positions"
        description="No unrealized positions found for this portfolio."
      />
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="font-semibold">Symbol</TableHead>
              <TableHead className="text-right font-semibold">Qty</TableHead>
              <TableHead className="text-right font-semibold">Avg Buy ₹</TableHead>
              <TableHead className="text-right font-semibold">Current ₹</TableHead>
              <TableHead className="text-right font-semibold">Days</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="text-right font-semibold">Unrealized Gain ₹</TableHead>
              <TableHead className="font-semibold" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((pos, i) => {
              const isHarvestCandidate =
                pos.gain_type === "LTCG" && pos.unrealized_gain > 0;
              return (
                <TableRow
                  key={`${pos.symbol}-${i}`}
                  className={`text-xs hover:bg-muted/30 ${
                    isHarvestCandidate
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                      : ""
                  }`}
                >
                  <TableCell className="py-2 font-mono font-medium">
                    {pos.symbol}
                    {pos.asset_class && pos.asset_class !== "equity" && (
                      <span className="ml-1 text-muted-foreground">
                        ({pos.asset_class})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{pos.qty}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                    ₹{fmtINR(pos.avg_buy_price)}
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums">
                    ₹{fmtINR(pos.current_price)}
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums text-muted-foreground">
                    {pos.holding_days}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant="outline"
                      className={
                        pos.gain_type === "STCG"
                          ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                      }
                    >
                      {pos.gain_type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`py-2 text-right tabular-nums font-medium ${gainClass(pos.unrealized_gain)}`}
                  >
                    {pos.unrealized_gain >= 0 ? "+" : ""}₹
                    {fmtINR(pos.unrealized_gain)}
                  </TableCell>
                  <TableCell className="py-2">
                    {isHarvestCandidate && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <Leaf className="h-3 w-3" />
                              Harvest
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            This position qualifies as LTCG — booking profit within ₹1.25L
                            limit is tax-free
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Tax Breakdown Pie Chart ──────────────────────────────────────────────────

interface TaxPieProps {
  stcgGain: number;
  ltcgGain: number;
  stcgTax: number;
  ltcgTax: number;
}

function TaxBreakdownChart({ stcgGain, ltcgGain, stcgTax, ltcgTax }: TaxPieProps) {
  const data = [
    { name: "STCG Gains",    value: Math.max(0, stcgGain), color: PIE_COLORS.stcgGain },
    { name: "LTCG Gains",    value: Math.max(0, ltcgGain), color: PIE_COLORS.ltcgGain },
    { name: "STCG Tax Est.", value: Math.max(0, stcgTax),  color: PIE_COLORS.stcgTax  },
    { name: "LTCG Tax Est.", value: Math.max(0, ltcgTax),  color: PIE_COLORS.ltcgTax  },
  ].filter((d) => d.value > 0);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Tax Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value: number, name: string) => [
                `₹${fmtINR(value)}`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={10}
              formatter={(value) => (
                <span className="text-xs text-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── FY Selector ──────────────────────────────────────────────────────────────

function FySelector({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (fy: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
      {options.map((fy) => (
        <button
          key={fy}
          type="button"
          onClick={() => onSelect(fy)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            selected === fy
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {fy}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaxPnLPage() {
  const { id } = useParams<{ id: string }>();
  const portfolioId = id ?? "";

  const [fy, setFy] = useState<string>(CURRENT_FY);

  const { data, isPending, isError, error, refetch } = useTaxPnL(portfolioId, fy);

  // Once data loads, if selected FY isn't in the options list, snap to the latest available
  const availableFyOptions = data?.available_fy_options ?? [];

  const portfolioLabel = `Portfolio ${portfolioId.slice(-6)}`;

  if (isPending) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <SkeletonCard withHeader lines={4} />
          <SkeletonCard lines={6} />
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-7xl p-6">
          <ErrorState
            title="Failed to load Tax P&L"
            message={error?.message ?? "Unknown error"}
            onRetry={() => refetch()}
          />
        </div>
      </DashboardLayout>
    );
  }

  const s = data!.summary;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Back nav */}
        <Link
          to={`/dashboard/markets/portfolios/${portfolioId}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to {portfolioLabel}
        </Link>

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tax P&L Report</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {portfolioLabel} &middot; FY {fy} &middot; as of{" "}
              {data?.as_of ? fmtDate(data.as_of) : "—"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* FY Selector */}
            {availableFyOptions.length > 0 && (
              <FySelector
                options={availableFyOptions}
                selected={fy}
                onSelect={setFy}
              />
            )}

            {/* Export CSV */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(data!.realized_trades, fy)}
              disabled={!data?.realized_trades?.length}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            label="Total Realized"
            value={`${s.total_realized_gain >= 0 ? "+" : ""}₹${fmtINR(s.total_realized_gain)}`}
            valueClass={gainClass(s.total_realized_gain)}
            icon={s.total_realized_gain >= 0
              ? <TrendingUp className="h-4 w-4" />
              : <TrendingDown className="h-4 w-4" />
            }
          />
          <SummaryCard
            label="Short-Term (equity)"
            value={`₹${fmtINR(s.equity_stcg)}`}
            subtext="STCG @ 20%"
            valueClass={gainClass(s.equity_stcg)}
          />
          <SummaryCard
            label="Long-Term (equity)"
            value={`₹${fmtINR(s.equity_ltcg)}`}
            subtext="LTCG @ 12.5%"
            valueClass={gainClass(s.equity_ltcg)}
            tooltip={`₹1.25L exempt. Taxable LTCG: ₹${fmtINR(s.equity_ltcg_taxable)}`}
          />
          <SummaryCard
            label="Estimated Tax Liability"
            value={`₹${fmtINR(s.total_tax_est)}`}
            valueClass={s.total_tax_est > 0 ? "text-red-500 dark:text-red-400" : ""}
            icon={<Receipt className="h-4 w-4" />}
          />
          <SummaryCard
            label="Harvesting Opportunity"
            value={`₹${fmtINR(s.harvesting_opportunity)}`}
            icon={<Leaf className="h-4 w-4" />}
            tooltip="LTCG gains within exemption limit — consider booking to reset cost basis"
          />
        </div>

        {/* Tax Breakdown Chart */}
        {s.total_realized_gain !== 0 && (
          <TaxBreakdownChart
            stcgGain={s.equity_stcg}
            ltcgGain={s.equity_ltcg}
            stcgTax={s.equity_stcg_tax_est}
            ltcgTax={s.equity_ltcg_tax_est}
          />
        )}

        {/* Realized Trades */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Realized Trades</h2>
          <RealizedTradesTable trades={data!.realized_trades} />
        </section>

        {/* Unrealized Positions */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Unrealized Positions</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Leaf className="h-3 w-3" />
                    Green rows = harvest candidates
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Rows highlighted in green are LTCG positions with unrealized gains —
                  booking profit within ₹1.25L is tax-free
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <UnrealizedPositionsTable positions={data!.unrealized_positions} />
        </section>

        {/* Indian Tax Disclaimer */}
        <footer className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="font-medium text-foreground">Disclaimer:</strong>{" "}
            Tax estimates are indicative only. STCG rate: 20% (equity, post Jul 2024). LTCG
            rate: 12.5% above ₹1.25L exemption. Consult your CA for filing.
          </p>
        </footer>
      </div>
    </DashboardLayout>
  );
}
