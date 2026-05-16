/**
 * Markets — Backtests page.
 *
 * Table view of all backtests with per-row metrics, status badges, auto-refresh
 * when any job is queued/running, and a sheet for full metrics detail.
 */

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  BarChart3,
  ChevronRight,
  Loader2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SkeletonRow,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/design-system";

import { useBacktests } from "../hooks/useBacktests";
import { useStrategies } from "../hooks/useStrategies";
import type { Backtest, BacktestMetrics, BacktestStatus } from "../types";

// ─── Status badge config ──────────────────────────────────────────────────

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_CONFIG: Record<
  BacktestStatus,
  { label: string; variant: BadgeVariant; color?: string }
> = {
  queued:    { label: "Queued",    variant: "secondary"   },
  running:   { label: "Running",   variant: "default",  color: "bg-blue-500 text-white" },
  completed: { label: "Completed", variant: "default",  color: "bg-emerald-600 text-white" },
  failed:    { label: "Failed",    variant: "destructive" },
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default function BacktestsPage() {
  const strategies = useStrategies();

  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [detailBacktest, setDetailBacktest] = useState<Backtest | null>(null);

  const backtests = useBacktests(
    strategyFilter !== "all" ? { strategyId: strategyFilter } : undefined,
  );

  // Strategy name lookup map
  const strategyNames: Record<string, string> = {};
  (strategies.data ?? []).forEach((s) => {
    strategyNames[s.id] = s.name;
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Backtests
            </h1>
            <p className="text-sm text-muted-foreground">
              Historical simulations of your strategies. Results include CAGR, Sharpe, max drawdown and more.
            </p>
          </div>

          {/* Strategy filter */}
          <div className="w-56">
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All strategies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All strategies</SelectItem>
                {(strategies.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Content */}
        {backtests.isError && (
          <ErrorState
            title="Failed to load backtests"
            message={backtests.error?.message ?? "Unknown error"}
            onRetry={() => backtests.refetch()}
          />
        )}

        {!backtests.isError && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">CAGR</TableHead>
                  <TableHead className="text-right">Sharpe</TableHead>
                  <TableHead className="text-right">Max DD</TableHead>
                  <TableHead className="text-right">Total Return</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {backtests.isPending && (
                  Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonRow key={i} columns={10} />
                  ))
                )}

                {backtests.isSuccess && backtests.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-16">
                      <EmptyState
                        icon={<BarChart3 className="h-10 w-10" />}
                        title="No backtests yet"
                        description="Create a strategy and run a backtest from the Strategies page."
                      />
                    </TableCell>
                  </TableRow>
                )}

                {backtests.isSuccess && backtests.data.map((bt) => (
                  <BacktestRow
                    key={bt.id}
                    backtest={bt}
                    strategyName={strategyNames[bt.strategy_id] ?? bt.strategy_id.slice(0, 8)}
                    onOpenDetail={() => setDetailBacktest(bt)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Metrics detail sheet */}
        <Sheet open={Boolean(detailBacktest)} onOpenChange={(o) => { if (!o) setDetailBacktest(null); }}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Backtest Results
              </SheetTitle>
            </SheetHeader>
            {detailBacktest && (
              <BacktestDetailPanel
                backtest={detailBacktest}
                strategyName={strategyNames[detailBacktest.strategy_id] ?? "Strategy"}
                onClose={() => setDetailBacktest(null)}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
}

// ─── Backtest table row ───────────────────────────────────────────────────

function BacktestRow({
  backtest,
  strategyName,
  onOpenDetail,
}: {
  backtest: Backtest;
  strategyName: string;
  onOpenDetail: () => void;
}) {
  const cfg = STATUS_CONFIG[backtest.status] ?? STATUS_CONFIG.queued;
  const m   = backtest.metrics;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/40"
      onClick={onOpenDetail}
    >
      {/* Strategy name */}
      <TableCell className="font-medium">{strategyName}</TableCell>

      {/* Period */}
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {backtest.period_from && backtest.period_to
          ? `${backtest.period_from} → ${backtest.period_to}`
          : "—"}
      </TableCell>

      {/* Capital */}
      <TableCell className="text-right text-sm font-mono">
        {new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(backtest.initial_capital)}
      </TableCell>

      {/* Status */}
      <TableCell>
        <StatusCell backtest={backtest} cfg={cfg} />
      </TableCell>

      {/* CAGR */}
      <TableCell className="text-right">
        {m ? <MetricPct value={m.cagr} /> : <Dash />}
      </TableCell>

      {/* Sharpe */}
      <TableCell className="text-right">
        {m ? <SharpeValue value={m.sharpe} /> : <Dash />}
      </TableCell>

      {/* Max DD */}
      <TableCell className="text-right">
        {m ? (
          <span className="font-mono text-sm text-red-500">
            {m.max_drawdown.toFixed(1)}%
          </span>
        ) : <Dash />}
      </TableCell>

      {/* Total Return */}
      <TableCell className="text-right">
        {m ? <MetricPct value={m.total_return} /> : <Dash />}
      </TableCell>

      {/* When */}
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDistanceToNow(new Date(backtest.started_at), { addSuffix: true })}
      </TableCell>

      {/* Expand button */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="View details"
          onClick={onOpenDetail}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ─── Status cell ──────────────────────────────────────────────────────────

function StatusCell({
  backtest,
  cfg,
}: {
  backtest: Backtest;
  cfg: { label: string; variant: BadgeVariant; color?: string };
}) {
  if (backtest.status === "running") {
    return (
      <div className="space-y-1 min-w-[100px]">
        <Badge className={cfg.color ?? ""}>
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          {backtest.progress}%
        </Badge>
        <Progress value={backtest.progress} className="h-1" />
      </div>
    );
  }

  if (backtest.status === "failed" && backtest.error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="cursor-help">
              Failed
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs break-words">
            {backtest.error}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (cfg.color) {
    return <Badge className={cfg.color}>{cfg.label}</Badge>;
  }

  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Metrics detail panel (inside Sheet) ─────────────────────────────────

function BacktestDetailPanel({
  backtest,
  strategyName,
  onClose,
}: {
  backtest: Backtest;
  strategyName: string;
  onClose: () => void;
}) {
  const m = backtest.metrics;
  const cfg = STATUS_CONFIG[backtest.status] ?? STATUS_CONFIG.queued;

  return (
    <div className="mt-4 space-y-6">
      {/* Meta */}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{strategyName}</span>
          {cfg.color
            ? <Badge className={cfg.color}>{cfg.label}</Badge>
            : <Badge variant={cfg.variant}>{cfg.label}</Badge>
          }
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <MetaRow label="Period from" value={backtest.period_from ?? "—"} />
          <MetaRow label="Period to"   value={backtest.period_to   ?? "—"} />
          <MetaRow
            label="Initial capital"
            value={new Intl.NumberFormat("en-IN", {
              style: "currency", currency: "INR", maximumFractionDigits: 0,
            }).format(backtest.initial_capital)}
          />
          <MetaRow
            label="Started"
            value={format(new Date(backtest.started_at), "d MMM yyyy, HH:mm")}
          />
          {backtest.finished_at && (
            <MetaRow
              label="Finished"
              value={format(new Date(backtest.finished_at), "d MMM yyyy, HH:mm")}
            />
          )}
          {backtest.worker_job_id && (
            <MetaRow label="Job ID" value={backtest.worker_job_id.slice(0, 12) + "…"} />
          )}
        </div>

        {backtest.status === "running" && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Progress: {backtest.progress}%</p>
            <Progress value={backtest.progress} className="h-2" />
          </div>
        )}

        {backtest.status === "failed" && backtest.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium mb-1">Error</p>
            <p className="font-mono text-xs">{backtest.error}</p>
          </div>
        )}
      </div>

      {/* Metrics */}
      {m && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Performance metrics
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="CAGR"
              value={`${m.cagr >= 0 ? "+" : ""}${m.cagr.toFixed(2)}%`}
              positive={m.cagr >= 0}
              icon={m.cagr >= 0
                ? <TrendingUp className="h-4 w-4" />
                : <TrendingDown className="h-4 w-4" />}
            />
            <MetricCard
              label="Total Return"
              value={`${m.total_return >= 0 ? "+" : ""}${m.total_return.toFixed(2)}%`}
              positive={m.total_return >= 0}
              icon={m.total_return >= 0
                ? <TrendingUp className="h-4 w-4" />
                : <TrendingDown className="h-4 w-4" />}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={m.sharpe.toFixed(2)}
              positive={m.sharpe >= 1}
              neutral={m.sharpe >= 0.5 && m.sharpe < 1}
            />
            <MetricCard
              label="Sortino Ratio"
              value={m.sortino.toFixed(2)}
              positive={m.sortino >= 1}
              neutral={m.sortino >= 0.5 && m.sortino < 1}
            />
            <MetricCard
              label="Max Drawdown"
              value={`${m.max_drawdown.toFixed(2)}%`}
              positive={false}
              alwaysRed
            />
            <MetricCard
              label="Calmar Ratio"
              value={m.calmar.toFixed(2)}
              positive={m.calmar >= 0.5}
            />
            <MetricCard
              label="Volatility (ann.)"
              value={`${m.volatility_annualised.toFixed(2)}%`}
              neutral
            />
            <MetricCard
              label="Trading Days"
              value={m.n_trading_days.toString()}
              neutral
            />
          </div>

          {/* Universe symbols */}
          {m.symbols.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Symbols backtested ({m.n_assets})
              </p>
              <div className="flex flex-wrap gap-1">
                {m.symbols.map((sym) => (
                  <Badge key={sym} variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                    {sym}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Strategy type: <span className="font-mono">{m.strategy_type}</span>
          </div>
        </div>
      )}

      {!m && backtest.status === "completed" && (
        <p className="text-sm text-muted-foreground italic">
          Metrics not yet available.
        </p>
      )}

      {(backtest.status === "queued" || backtest.status === "running") && (
        <div className="flex items-center gap-2 rounded-md border bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Backtest is {backtest.status}. Results will appear here automatically.
        </div>
      )}

      <Button variant="outline" onClick={onClose} className="w-full gap-2">
        <X className="h-4 w-4" />
        Close
      </Button>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function MetricPct({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={["font-mono text-sm font-medium", positive ? "text-emerald-600" : "text-red-500"].join(" ")}>
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function SharpeValue({ value }: { value: number }) {
  const cls =
    value >= 1   ? "text-emerald-600" :
    value >= 0.5 ? "text-amber-500"   :
                   "text-red-500";
  return (
    <span className={["font-mono text-sm font-medium", cls].join(" ")}>
      {value.toFixed(2)}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  positive,
  neutral,
  alwaysRed,
  icon,
}: {
  label: string;
  value: string;
  positive?: boolean;
  neutral?: boolean;
  alwaysRed?: boolean;
  icon?: React.ReactNode;
}) {
  const valueColor = alwaysRed
    ? "text-red-500"
    : neutral
      ? "text-foreground"
      : positive
        ? "text-emerald-600"
        : "text-red-500";

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={["text-lg font-semibold font-mono flex items-center gap-1.5", valueColor].join(" ")}>
        {icon}
        {value}
      </p>
    </div>
  );
}

