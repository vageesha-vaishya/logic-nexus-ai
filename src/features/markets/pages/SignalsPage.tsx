/**
 * Markets — Signals page.
 *
 * Displays AI-generated signals from markets.signals (written by the LangGraph
 * worker). Supports:
 *   - Filtering by portfolio and triggering a new signal run
 *   - "Compute Signals" panel: instrument search → compute RSI/MACD/SuperTrend
 *     via the Phase-2 /v1/signals/compute endpoint
 *   - Indicator columns (RSI, MACD trend, SuperTrend) from signal.metadata
 *   - Legend explaining what each indicator value means
 */

import { useState } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  Activity,
  Database,
  HelpCircle,
  Loader2,
  Play,
  RefreshCw,
  Zap,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

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
  Input,
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

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? "http://localhost:8001";

// ─── Signal badge (internal — for legacy DB signals) ──────────────────────────

const SIGNAL_CONFIG: Record<
  SignalType,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  buy:  { label: "Buy",  variant: "default",     icon: <TrendingUp  className="h-3 w-3" /> },
  sell: { label: "Sell", variant: "destructive",  icon: <TrendingDown className="h-3 w-3" /> },
  hold: { label: "Hold", variant: "secondary",    icon: null },
};

function SignalTypeBadge({ type }: { type: SignalType }) {
  const cfg = SIGNAL_CONFIG[type] ?? SIGNAL_CONFIG.hold;
  return (
    <Badge variant={cfg.variant} className="flex w-16 items-center justify-center gap-1 capitalize">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ─── Confidence bar ───────────────────────────────────────────────────────────

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

// ─── Expires cell ─────────────────────────────────────────────────────────────

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

// ─── Rationale cell ───────────────────────────────────────────────────────────

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

// ─── RSI indicator cell ───────────────────────────────────────────────────────

function RsiCell({ rsi }: { rsi: number | null | undefined }) {
  if (rsi == null) return <span className="text-xs text-muted-foreground">—</span>;
  const color =
    rsi < 30 ? "text-emerald-600 dark:text-emerald-400" :
    rsi > 70 ? "text-rose-500 dark:text-rose-400"       :
               "text-muted-foreground";
  const label =
    rsi < 30 ? "Oversold" :
    rsi > 70 ? "Overbought" :
               "Neutral";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-xs tabular-nums font-medium ${color}`}>{rsi.toFixed(1)}</span>
        </TooltipTrigger>
        <TooltipContent>{label} (RSI {rsi.toFixed(1)})</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── MACD trend cell ──────────────────────────────────────────────────────────

interface MacdData {
  macd:      number;
  signal:    number;
  histogram: number;
  crossover: string;
}

function MacdCell({ macd }: { macd: MacdData | null | undefined }) {
  if (!macd) return <span className="text-xs text-muted-foreground">—</span>;
  const isPositive = macd.histogram >= 0;
  const isCross    = macd.crossover !== "none";
  const color      = isPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-500 dark:text-rose-400";
  const label      = isCross
    ? `${macd.crossover === "bullish" ? "Bullish" : "Bearish"} crossover`
    : `Histogram ${isPositive ? "+" : ""}${macd.histogram.toFixed(3)}`;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-xs font-medium ${color}`}>
            {isCross ? (macd.crossover === "bullish" ? "↑ Cross" : "↓ Cross") : (isPositive ? "+" : "") + macd.histogram.toFixed(3)}
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── SuperTrend cell ──────────────────────────────────────────────────────────

interface SuperTrendData {
  direction:  string;
  upper_band: number;
  lower_band: number;
  signal:     string;
}

function SuperTrendCell({ st }: { st: SuperTrendData | null | undefined }) {
  if (!st) return <span className="text-xs text-muted-foreground">—</span>;
  const isBull = st.signal === "buy";
  const color  = isBull
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-500 dark:text-rose-400";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-xs font-medium ${color}`}>
            {isBull ? "↑ Bull" : "↓ Bear"}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isBull
            ? `Bullish — above support ₹${st.lower_band.toLocaleString("en-IN")}`
            : `Bearish — below resistance ₹${st.upper_band.toLocaleString("en-IN")}`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Helper: extract indicators from metadata ─────────────────────────────────

function getIndicators(sig: Signal): {
  rsi: number | null;
  macd: MacdData | null;
  supertrend: SuperTrendData | null;
} {
  const meta = sig.metadata as Record<string, unknown> | null;
  const inds  = (meta?.indicators ?? meta?.["indicators"]) as Record<string, unknown> | undefined;
  if (!inds) return { rsi: null, macd: null, supertrend: null };
  return {
    rsi:        typeof inds.rsi === "number" ? inds.rsi : null,
    macd:       (inds.macd as MacdData | null) ?? null,
    supertrend: (inds.supertrend as SuperTrendData | null) ?? null,
  };
}

// ─── Signals table ────────────────────────────────────────────────────────────

function SignalsTable({ signals }: { signals: Signal[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Symbol</TableHead>
          <TableHead className="w-20">Signal</TableHead>
          <TableHead className="w-28">Confidence</TableHead>
          <TableHead className="w-24 text-right">Price</TableHead>
          <TableHead className="w-16 text-right hidden lg:table-cell">RSI</TableHead>
          <TableHead className="w-24 hidden lg:table-cell">MACD</TableHead>
          <TableHead className="w-20 hidden lg:table-cell">SuperTrend</TableHead>
          <TableHead>Rationale</TableHead>
          <TableHead className="w-32 hidden md:table-cell">Expires</TableHead>
          <TableHead className="w-20 text-right hidden md:table-cell">When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {signals.map((sig) => {
          const symbol   = sig.instrument?.symbol   ?? "—";
          const exchange = sig.instrument?.exchange ?? "";
          const inds     = getIndicators(sig);

          return (
            <TableRow key={sig.id}>
              <TableCell>
                <div className="font-medium">{symbol}</div>
                {exchange && (
                  <div className="text-xs text-muted-foreground">{exchange}</div>
                )}
              </TableCell>

              <TableCell>
                <SignalTypeBadge type={sig.signal_type} />
              </TableCell>

              <TableCell>
                <ConfidenceBar value={sig.confidence} />
              </TableCell>

              <TableCell className="text-right tabular-nums">
                {sig.price_at_signal != null
                  ? `₹${Number(sig.price_at_signal).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                  : "—"}
              </TableCell>

              <TableCell className="text-right hidden lg:table-cell">
                <RsiCell rsi={inds.rsi} />
              </TableCell>

              <TableCell className="hidden lg:table-cell">
                <MacdCell macd={inds.macd} />
              </TableCell>

              <TableCell className="hidden lg:table-cell">
                <SuperTrendCell st={inds.supertrend} />
              </TableCell>

              <TableCell className="max-w-xs">
                <RationaleCell text={sig.rationale} />
              </TableCell>

              <TableCell className="hidden md:table-cell">
                <ExpiresCell expiresAt={sig.expires_at} />
              </TableCell>

              <TableCell className="text-right text-xs text-muted-foreground hidden md:table-cell">
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

// ─── Compute signals panel ────────────────────────────────────────────────────

interface ComputeResult {
  symbol:      string;
  direction:   string;
  confidence:  number;
  score:       number;
  rationale:   string;
  indicators: {
    rsi:        number | null;
    macd:       MacdData | null;
    supertrend: SuperTrendData | null;
  };
}

function ComputeSignalsPanel() {
  const [symbol,   setSymbol]   = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<ComputeResult | null>(null);

  const handleCompute = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) { toast.error("Enter a symbol first"); return; }
    setLoading(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ exchange });
      const res = await fetch(`${WORKER_URL}/v1/signals/compute/${sym}?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Worker error ${res.status}: ${text}`);
      }
      const data: ComputeResult = await res.json();
      setResult(data);
      toast.success(`Signal computed for ${sym}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to compute signal";
      if (msg.includes("fetch") || msg.includes("NetworkError")) {
        toast.error("Markets worker is offline. Start it with: uv run python -m markets_worker.worker");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const dirColor =
    result?.direction === "buy"  ? "text-emerald-600 dark:text-emerald-400" :
    result?.direction === "sell" ? "text-rose-500 dark:text-rose-400"       :
                                   "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
          Compute Technical Signals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Symbol
            </label>
            <Input
              placeholder="e.g. RELIANCE"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleCompute()}
              className="font-mono uppercase"
            />
          </div>
          <div className="w-28">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Exchange
            </label>
            <Select value={exchange} onValueChange={setExchange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NSE">NSE</SelectItem>
                <SelectItem value="BSE">BSE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCompute} disabled={loading || !symbol.trim()}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Computing…</>
            ) : (
              <><Zap className="mr-1.5 h-4 w-4" />Compute</>
            )}
          </Button>
        </div>

        {result && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono font-semibold text-lg">{result.symbol}</p>
                <p className={`text-sm font-medium mt-0.5 ${dirColor}`}>
                  {result.direction.toUpperCase()} · {result.score}% confidence
                </p>
              </div>
              <ConfidenceBar value={result.confidence} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{result.rationale}</p>
            <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5">RSI (14)</p>
                <RsiCell rsi={result.indicators.rsi} />
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">MACD</p>
                <MacdCell macd={result.indicators.macd} />
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">SuperTrend</p>
                <SuperTrendCell st={result.indicators.supertrend} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Legend card ──────────────────────────────────────────────────────────────

function IndicatorLegend() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Indicator Guide
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 text-xs sm:grid-cols-3">
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">RSI (14-period)</p>
            <ul className="space-y-1 text-muted-foreground">
              <li><span className="font-medium text-emerald-600 dark:text-emerald-400">RSI &lt; 30</span> — Oversold: strong buy signal (2 pts)</li>
              <li><span className="font-medium text-emerald-500">RSI 30–45</span> — Approaching oversold (1 pt)</li>
              <li><span className="text-foreground/70">RSI 45–55</span> — Neutral zone</li>
              <li><span className="font-medium text-amber-500">RSI 55–70</span> — Approaching overbought (1 pt)</li>
              <li><span className="font-medium text-rose-500">RSI &gt; 70</span> — Overbought: strong sell signal (2 pts)</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">MACD (12/26/9)</p>
            <ul className="space-y-1 text-muted-foreground">
              <li><span className="font-medium text-emerald-600 dark:text-emerald-400">Bullish crossover</span> — Histogram crosses above 0 (2 pts)</li>
              <li><span className="font-medium text-rose-500">Bearish crossover</span> — Histogram crosses below 0 (2 pts)</li>
              <li><span className="font-medium text-emerald-500">Histogram &gt; 0</span> — Momentum positive (1 pt)</li>
              <li><span className="font-medium text-rose-400">Histogram &lt; 0</span> — Momentum negative (1 pt)</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">SuperTrend (10, 3×ATR)</p>
            <ul className="space-y-1 text-muted-foreground">
              <li><span className="font-medium text-emerald-600 dark:text-emerald-400">Bullish (↑ Bull)</span> — Price above lower band (2 pts)</li>
              <li><span className="font-medium text-rose-500">Bearish (↓ Bear)</span> — Price below upper band (2 pts)</li>
              <li className="pt-1 text-foreground/60">Score = weighted sum of all signals (max 6 pts buy / 6 pts sell)</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [ingestJobId,         setIngestJobId]         = useState<string | null>(null);

  const portfolios   = usePortfolios();
  const signals      = useSignals({ portfolioId: selectedPortfolioId });
  const runSignals   = useRunPortfolioSignals();
  const ingestPrices = useIngestPrices();
  const ingestJob    = usePriceIngestJob(ingestJobId);

  const ingestDone = ingestJob.data?.status === "finished";
  const ingestBusy = ingestPrices.isPending ||
    (ingestJobId != null && !ingestDone && ingestJob.data?.status !== "failed");

  const handleFetchPrices = async () => {
    if (!selectedPortfolioId) { toast.error("Select a portfolio first"); return; }
    try {
      const result = await ingestPrices.mutateAsync({ portfolioId: selectedPortfolioId });
      setIngestJobId(result.job_id);
      toast.info("Fetching price history from Yahoo Finance… (may take ~1 min for 30+ stocks)");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to start price fetch");
    }
  };

  if (ingestDone && ingestJob.data?.result) {
    const r = ingestJob.data.result;
    const msg = `Price data loaded: ${r.ingested}/${r.total} stocks, ${r.total_rows.toLocaleString()} rows`;
    if (r.failed === 0) toast.success(msg);
    else toast.warning(`${msg} (${r.failed} failed: ${r.failures.map((f: { symbol: string }) => f.symbol).join(", ")})`);
    setIngestJobId(null);
  }

  const handleRun = async () => {
    if (!selectedPortfolioId) {
      toast.error("Select a portfolio first");
      return;
    }
    try {
      const result = await runSignals.mutateAsync({ portfolioId: selectedPortfolioId });
      toast.success(`Signal job queued (${result.job_id.slice(0, 16)}). Results appear in ~5s.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to queue signal job";
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Portfolio filter */}
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

            {/* Refresh list */}
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

            {/* Run AI signals */}
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

        {/* Phase-2: Compute single-symbol technical signals */}
        <ComputeSignalsPanel />

        {/* Signals table */}
        <Card>
          <CardContent className="p-0">
            {signals.isPending && (
              <div className="space-y-0 divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3">
                    <SkeletonRow columns={9} />
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

        {/* Indicator legend */}
        <IndicatorLegend />
      </div>
    </DashboardLayout>
  );
}

// ─── Summary counts ───────────────────────────────────────────────────────────

function SignalsSummary({ signals }: { signals: Signal[] }) {
  const now    = new Date();
  const active = signals.filter((s) => !s.expires_at || new Date(s.expires_at) > now);
  const buys   = active.filter((s) => s.signal_type === "buy").length;
  const sells  = active.filter((s) => s.signal_type === "sell").length;
  const holds  = active.filter((s) => s.signal_type === "hold").length;

  return (
    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
      <span>{active.length} active signal{active.length !== 1 ? "s" : ""}</span>
      <span className="font-medium text-emerald-600 dark:text-emerald-400">{buys} buy</span>
      <span className="font-medium text-rose-500 dark:text-rose-400">{sells} sell</span>
      <span className="font-medium">{holds} hold</span>
    </div>
  );
}
