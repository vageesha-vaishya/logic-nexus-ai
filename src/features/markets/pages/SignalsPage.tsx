/**
 * Markets — Signals page.
 *
 * Displays AI-generated signals from markets.signals (written by the LangGraph
 * worker). Supports filtering by portfolio and triggering a new signal run.
 */

import { useState } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { Activity, Database, Loader2, Play, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

import { useSignals, useRunPortfolioSignals } from "../hooks/useSignals";
import { usePortfolios } from "../hooks/usePortfolios";
import { useIngestPrices, usePriceIngestJob } from "../hooks/usePriceIngest";
import type { Signal, SignalType } from "../types";

// ─── Signal badge ──────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<
  SignalType,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  buy:  { label: "Buy",  variant: "default",     icon: <TrendingUp  className="h-3 w-3" /> },
  sell: { label: "Sell", variant: "destructive",  icon: <TrendingDown className="h-3 w-3" /> },
  hold: { label: "Hold", variant: "secondary",    icon: null },
};

function SignalBadge({ type }: { type: SignalType }) {
  const cfg = SIGNAL_CONFIG[type] ?? SIGNAL_CONFIG.hold;
  return (
    <Badge variant={cfg.variant} className="flex w-16 items-center justify-center gap-1 capitalize">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ─── Confidence bar ───────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "bg-emerald-500" :
    pct >= 40 ? "bg-amber-400"   :
                "bg-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

// ─── Expires cell ─────────────────────────────────────────────────────────

function ExpiresCell({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="text-xs text-muted-foreground">—</span>;
  const expired = isPast(new Date(expiresAt));
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-xs ${expired ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {expired ? "Expired" : formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}
          </span>
        </TooltipTrigger>
        <TooltipContent>{format(new Date(expiresAt), "dd MMM yyyy, HH:mm")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Rationale cell ───────────────────────────────────────────────────────

function RationaleCell({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-xs text-muted-foreground">—</span>;
  const truncated = text.length > 120 && !expanded;
  return (
    <span className="text-xs leading-relaxed">
      {truncated ? `${text.slice(0, 120)}…` : text}
      {text.length > 120 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 text-xs text-primary hover:underline"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </span>
  );
}

// ─── Signals table ────────────────────────────────────────────────────────

function SignalsTable({ signals }: { signals: Signal[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Symbol</TableHead>
          <TableHead className="w-20">Signal</TableHead>
          <TableHead className="w-28">Confidence</TableHead>
          <TableHead className="w-24 text-right">Price</TableHead>
          <TableHead className="w-20 text-right">Score</TableHead>
          <TableHead>Rationale</TableHead>
          <TableHead className="w-32">Expires</TableHead>
          <TableHead className="w-20 text-right">When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {signals.map((sig) => {
          const symbol   = sig.instrument?.symbol   ?? "—";
          const exchange = sig.instrument?.exchange ?? "";
          const scoreNum = typeof sig.score === "number" ? sig.score : null;
          const scoreColor =
            scoreNum == null    ? ""                           :
            scoreNum > 0.1      ? "text-emerald-600 dark:text-emerald-400" :
            scoreNum < -0.1     ? "text-rose-500 dark:text-rose-400"       :
                                  "text-muted-foreground";

          return (
            <TableRow key={sig.id}>
              <TableCell>
                <div className="font-medium">{symbol}</div>
                {exchange && (
                  <div className="text-xs text-muted-foreground">{exchange}</div>
                )}
              </TableCell>

              <TableCell>
                <SignalBadge type={sig.signal_type} />
              </TableCell>

              <TableCell>
                <ConfidenceBar value={sig.confidence} />
              </TableCell>

              <TableCell className="text-right tabular-nums">
                {sig.price_at_signal != null
                  ? `₹${Number(sig.price_at_signal).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                  : "—"}
              </TableCell>

              <TableCell className={`text-right tabular-nums text-xs font-medium ${scoreColor}`}>
                {scoreNum != null ? (scoreNum >= 0 ? "+" : "") + scoreNum.toFixed(2) : "—"}
              </TableCell>

              <TableCell className="max-w-xs">
                <RationaleCell text={sig.rationale} />
              </TableCell>

              <TableCell>
                <ExpiresCell expiresAt={sig.expires_at} />
              </TableCell>

              <TableCell className="text-right text-xs text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{formatDistanceToNow(new Date(sig.ts), { addSuffix: true })}</span>
                    </TooltipTrigger>
                    <TooltipContent>{format(new Date(sig.ts), "dd MMM yyyy, HH:mm:ss")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [ingestJobId, setIngestJobId]                 = useState<string | null>(null);

  const portfolios  = usePortfolios();
  const signals     = useSignals({ portfolioId: selectedPortfolioId });
  const runSignals  = useRunPortfolioSignals();
  const ingestPrices = useIngestPrices();
  const ingestJob   = usePriceIngestJob(ingestJobId);

  // Auto-clear job poll once finished
  const ingestDone  = ingestJob.data?.status === "finished";
  const ingestBusy  = ingestPrices.isPending ||
    (ingestJobId != null && !ingestDone && ingestJob.data?.status !== "failed");

  const handleFetchPrices = async () => {
    if (!selectedPortfolioId) { toast.error("Select a portfolio first"); return; }
    try {
      const result = await ingestPrices.mutateAsync({ portfolioId: selectedPortfolioId });
      setIngestJobId(result.job_id);
      toast.info("Fetching price history from Yahoo Finance… (may take ~1 min for 30+ stocks)");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start price fetch");
    }
  };

  // Show completion toast when ingest job finishes
  if (ingestDone && ingestJob.data?.result) {
    const r = ingestJob.data.result;
    const msg = `Price data loaded: ${r.ingested}/${r.total} stocks, ${r.total_rows.toLocaleString()} rows`;
    if (r.failed === 0) toast.success(msg);
    else toast.warning(`${msg} (${r.failed} failed: ${r.failures.map(f => f.symbol).join(", ")})`);
    setIngestJobId(null);   // stop polling
  }

  const handleRun = async () => {
    if (!selectedPortfolioId) {
      toast.error("Select a portfolio first");
      return;
    }
    try {
      const result = await runSignals.mutateAsync({ portfolioId: selectedPortfolioId });
      toast.success(`Signal job queued (${result.job_id.slice(0, 16)}). Results appear in ~5s.`);
    } catch (e: any) {
      const msg: string = e?.message ?? "Failed to queue signal job";
      if (msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        toast.error("Markets worker is not running. Start it with: uv run python -m markets_worker.worker");
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Signals
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-generated buy, sell, and hold signals from the LangGraph research engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Portfolio filter / run target */}
            <Select
              value={selectedPortfolioId ?? "__all__"}
              onValueChange={(v) => setSelectedPortfolioId(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All portfolios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All portfolios</SelectItem>
                {(portfolios.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Refresh signals list */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => signals.refetch()}
              disabled={signals.isFetching}
              aria-label="Refresh signals"
            >
              <RefreshCw className={`h-4 w-4 ${signals.isFetching ? "animate-spin" : ""}`} />
            </Button>

            {/* Fetch price history */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleFetchPrices}
                    disabled={ingestBusy || !selectedPortfolioId}
                  >
                    {ingestBusy ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching…</>
                    ) : (
                      <><Database className="mr-1.5 h-4 w-4" />Fetch Prices</>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!selectedPortfolioId
                    ? "Select a portfolio first"
                    : "Download 2 years of price history from Yahoo Finance for all holdings"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Run signals */}
            <Button
              onClick={handleRun}
              disabled={runSignals.isPending || !selectedPortfolioId}
              title={!selectedPortfolioId ? "Select a portfolio to run signals" : undefined}
            >
              {runSignals.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Queuing…</>
              ) : (
                <><Play className="mr-1.5 h-4 w-4" />Run Signals</>
              )}
            </Button>
          </div>
        </header>

        {/* Content */}
        <Card>
          <CardContent className="p-0">
            {signals.isPending && (
              <div className="space-y-0 divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3">
                    <SkeletonRow columns={7} />
                  </div>
                ))}
              </div>
            )}

            {signals.isError && (
              <div className="p-6">
                <ErrorState
                  title="Failed to load signals"
                  message={signals.error?.message ?? "Unknown error"}
                  onRetry={() => signals.refetch()}
                />
              </div>
            )}

            {signals.isSuccess && signals.data.length === 0 && (
              <div className="p-6">
                <EmptyState
                  title="No signals yet"
                  description={
                    selectedPortfolioId
                      ? "No signals for this portfolio. Select it above and click Run Signals."
                      : "Signals are generated by the AI research engine. Select a portfolio and click Run Signals to start."
                  }
                />
              </div>
            )}

            {signals.isSuccess && signals.data.length > 0 && (
              <SignalsTable signals={signals.data} />
            )}
          </CardContent>
        </Card>

        {/* Summary strip */}
        {signals.isSuccess && signals.data.length > 0 && (
          <SignalsSummary signals={signals.data} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Summary counts ───────────────────────────────────────────────────────

function SignalsSummary({ signals }: { signals: Signal[] }) {
  const now   = new Date();
  const active = signals.filter((s) => !s.expires_at || new Date(s.expires_at) > now);
  const buys   = active.filter((s) => s.signal_type === "buy").length;
  const sells  = active.filter((s) => s.signal_type === "sell").length;
  const holds  = active.filter((s) => s.signal_type === "hold").length;

  return (
    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
      <span>{active.length} active signal{active.length !== 1 ? "s" : ""}</span>
      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{buys} buy</span>
      <span className="text-rose-500 dark:text-rose-400 font-medium">{sells} sell</span>
      <span className="font-medium">{holds} hold</span>
    </div>
  );
}
