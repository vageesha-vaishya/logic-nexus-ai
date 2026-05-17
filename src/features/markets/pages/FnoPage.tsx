/**
 * FnoPage — F&O Option Chain viewer.
 *
 * NSE-style live option chain for selected underlying + expiry.
 * Supports quick Buy/Sell order placement via OrderFormSheet.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, TrendingUp, AlertCircle, Clock, GitBranch } from "lucide-react";
import { TradingChart } from "../components/TradingChart";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { useFnoUnderlyings, useOptionChain } from "../hooks/useFno";
import { useBrokerConnections } from "../hooks/useBrokerConnections";
import { OptionChainTable } from "../components/OptionChainTable";
import { OrderFormSheet } from "../components/OrderFormSheet";
import { PlanGate } from "@/components/system/PlanGate";
import { useTradingMode } from "@/hooks/useTradingMode";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtSpot = (v: number): string =>
  `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Summary cards ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label:    string;
  value:    string;
  sub?:     string;
  subColor?: string;
}

function SummaryCard({ label, value, sub, subColor }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {sub && (
          <p className={`text-xs mt-0.5 ${subColor ?? "text-muted-foreground"}`}>{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function pcrLabel(pcr: number | null): { text: string; color: string } {
  if (pcr == null) return { text: "—",            color: "text-muted-foreground" };
  if (pcr > 1.05)  return { text: "Bearish bias",  color: "text-red-600 dark:text-red-400" };
  if (pcr < 0.95)  return { text: "Bullish bias",  color: "text-green-600 dark:text-green-400" };
  return            { text: "Neutral",             color: "text-muted-foreground" };
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ChainSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 flex-1" />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FnoPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY");
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [showGreeks,     setShowGreeks]     = useState(false);
  const [showChart,      setShowChart]      = useState(false);
  const [orderSheet,     setOrderSheet]     = useState<{
    open:   boolean;
    strike: number;
    type:   "CE" | "PE";
    side:   "BUY" | "SELL";
    symbol: string;
  }>({ open: false, strike: 0, type: "CE", side: "BUY", symbol: "NIFTY" });

  // ── Data ────────────────────────────────────────────────────────────────────
  const underlyings = useFnoUnderlyings();
  const chain       = useOptionChain(selectedSymbol, selectedExpiry);
  const connections = useBrokerConnections();
  const [tradingMode, setTradingMode] = useTradingMode();
  const isNovice = tradingMode === "novice";

  // Auto-select first expiry when chain loads
  useEffect(() => {
    if (chain.data?.expiries?.length && !selectedExpiry) {
      setSelectedExpiry(chain.data.expiries[0]);
    }
  }, [chain.data?.expiries, selectedExpiry]);

  // Reset expiry when symbol changes
  useEffect(() => {
    setSelectedExpiry("");
  }, [selectedSymbol]);

  // ── F&O connection ──────────────────────────────────────────────────────────
  const fnoConnection = connections.data?.find(
    c => c.can_trade && c.segments?.includes("fno"),
  ) ?? null;

  // ── Trade handlers ──────────────────────────────────────────────────────────
  function handleTrade(strike: number, type: "CE" | "PE", side: "BUY" | "SELL") {
    if (!fnoConnection) {
      toast.error(
        "No F&O-enabled broker connection found. Connect one in Settings → Broker Accounts.",
      );
      return;
    }
    setOrderSheet({ open: true, strike, type, side, symbol: selectedSymbol });
  }

  const handleBuy  = (strike: number, type: "CE" | "PE") => handleTrade(strike, type, "BUY");
  const handleSell = (strike: number, type: "CE" | "PE") => handleTrade(strike, type, "SELL");

  // ── PCR info ────────────────────────────────────────────────────────────────
  const pcr = chain.data?.pcr ?? null;
  const { text: pcrText, color: pcrColor } = pcrLabel(pcr);

  // ── Novice early return ──────────────────────────────────────────────────
  if (isNovice) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">

          {/* ── Page header ────────────────────────────────────────────── */}
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                F&amp;O — Option Chain
              </h1>
              <p className="text-sm text-muted-foreground">NSE live data · updated every 60s</p>
            </div>
            <Link to="/dashboard/markets/strategy-builder">
              <Button variant="outline" size="sm" className="gap-1.5">
                <GitBranch className="h-4 w-4" />
                Strategy Builder
              </Button>
            </Link>
          </header>

          {/* ── Novice mode banner ─────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-blue-500" aria-hidden="true" />
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-200">You&apos;re in Novice mode</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Switch to Expert to access F&amp;O options chain and order placement.
              </p>
            </div>
            <Button
              onClick={() => setTradingMode("expert")}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Switch to Expert
            </Button>
          </div>

        </div>
      </DashboardLayout>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              F&amp;O — Option Chain
            </h1>
            <p className="text-sm text-muted-foreground">NSE live data · updated every 60s</p>
          </div>
          <Link to="/dashboard/markets/strategy-builder">
            <Button variant="outline" size="sm" className="gap-1.5">
              <GitBranch className="h-4 w-4" />
              Strategy Builder
            </Button>
          </Link>
        </header>

        {/* ── Control bar ──────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Underlying selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">Underlying</span>
                <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Select underlying" />
                  </SelectTrigger>
                  <SelectContent>
                    {underlyings.isLoading && (
                      <SelectItem value="__loading__" disabled>Loading…</SelectItem>
                    )}
                    {(underlyings.data ?? []).map(u => (
                      <SelectItem key={u.symbol} value={u.symbol}>
                        {u.name} ({u.symbol})
                      </SelectItem>
                    ))}
                    {/* Fallback defaults when worker is not available */}
                    {!underlyings.isLoading && (underlyings.data ?? []).length === 0 && (
                      <>
                        <SelectItem value="NIFTY">NIFTY 50</SelectItem>
                        <SelectItem value="BANKNIFTY">BANKNIFTY</SelectItem>
                        <SelectItem value="FINNIFTY">FINNIFTY</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Expiry selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">Expiry</span>
                <Select
                  value={selectedExpiry}
                  onValueChange={setSelectedExpiry}
                  disabled={!chain.data?.expiries?.length}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder={chain.isLoading ? "Loading…" : "Select expiry"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(chain.data?.expiries ?? []).map(exp => (
                      <SelectItem key={exp} value={exp}>{exp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Greeks toggle */}
              <Button
                variant={showGreeks ? "default" : "outline"}
                size="sm"
                onClick={() => setShowGreeks(v => !v)}
              >
                δ Greeks
              </Button>

              {/* Chart toggle */}
              <button
                onClick={() => setShowChart(v => !v)}
                className={cn(
                  "h-7 px-2 rounded text-xs font-medium transition-colors",
                  showChart
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted border",
                )}
              >
                Chart
              </button>

              {/* Refresh */}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => chain.refetch()}
                disabled={chain.isFetching}
                aria-label="Refresh option chain"
              >
                <RefreshCw className={`h-4 w-4 ${chain.isFetching ? "animate-spin" : ""}`} />
              </Button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* PCR & Max Pain badges */}
              {chain.data && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">PCR</span>
                    <Badge variant="outline" className={pcrColor}>
                      {pcr != null ? pcr.toFixed(2) : "—"}
                    </Badge>
                    <span className={`text-xs ${pcrColor}`}>{pcrText}</span>
                  </div>
                  <Separator orientation="vertical" className="h-5" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Max Pain</span>
                    <Badge variant="outline">
                      {chain.data.max_pain != null
                        ? `₹${chain.data.max_pain.toLocaleString("en-IN")}`
                        : "—"}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Stale data banner ────────────────────────────────────────── */}
        {chain.data?.is_stale && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              Showing last available data
              {chain.data.cached_at
                ? ` · fetched ${new Date(chain.data.cached_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} IST`
                : ""}
              . Live data resumes Mon–Fri 09:15–15:30 IST.
            </span>
          </div>
        )}

        {/* ── Underlying price chart — toggled via "Chart" button ────── */}
        {showChart && (
          <TradingChart
            symbol={selectedSymbol}
            exchange="NSE"
            height={320}
            showVolume
            title={`${selectedSymbol} · NSE`}
            className="mt-0"
          />
        )}

        {/* ── Summary cards + Option chain — gated by fno_access plan ── */}
        <PlanGate feature="fno_access" mode="overlay">
          <div className="space-y-4">
            {/* Summary cards */}
            {chain.data && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard
                  label="Spot"
                  value={fmtSpot(chain.data.spot)}
                />
                <SummaryCard
                  label="ATM Strike"
                  value={`₹${chain.data.atm_strike.toLocaleString("en-IN")}`}
                />
                <SummaryCard
                  label="PCR"
                  value={pcr != null ? pcr.toFixed(2) : "—"}
                  sub={pcrText}
                  subColor={pcrColor}
                />
                <SummaryCard
                  label="Max Pain"
                  value={
                    chain.data.max_pain != null
                      ? `₹${chain.data.max_pain.toLocaleString("en-IN")}`
                      : "—"
                  }
                  sub={`Lot size: ${chain.data.lot_size}`}
                />
              </div>
            )}

            {/* Option chain */}
            <Card>
              <CardContent className="p-0">
                {chain.isLoading && <ChainSkeleton />}

                {chain.isError && (() => {
                  const msg = chain.error?.message ?? "";
                  const isMarketClosed = msg.includes("closed") || msg.includes("trading hours") || msg.includes("temporarily unavailable");
                  return (
                    <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
                      {isMarketClosed
                        ? <Clock className="h-8 w-8 text-amber-500" />
                        : <AlertCircle className="h-8 w-8 text-destructive" />}
                      <div>
                        <p className="font-medium">
                          {isMarketClosed ? "Market data unavailable" : "Failed to load option chain"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{msg}</p>
                      </div>
                      <Button variant="outline" onClick={() => chain.refetch()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {isMarketClosed ? "Check again" : "Retry"}
                      </Button>
                    </div>
                  );
                })()}

                {chain.isSuccess && chain.data && (
                  <OptionChainTable
                    chain={chain.data}
                    showGreeks={showGreeks}
                    onBuy={handleBuy}
                    onSell={handleSell}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </PlanGate>

      </div>

      {/* ── Order form sheet ─────────────────────────────────────────────── */}
      {fnoConnection && (
        <OrderFormSheet
          open={orderSheet.open}
          onOpenChange={(open) => setOrderSheet(prev => ({ ...prev, open }))}
          connectionId={fnoConnection.id}
          connectionName={fnoConnection.display_name}
          brokerName={fnoConnection.broker}
          canTrade={fnoConnection.can_trade}
          defaultSymbol={orderSheet.symbol}
          defaultExchange="NFO"
          defaultTransactionType={orderSheet.side}
        />
      )}
    </DashboardLayout>
  );
}
