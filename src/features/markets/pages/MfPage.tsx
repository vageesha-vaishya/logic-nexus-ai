/**
 * MfPage — Mutual Funds hub.
 *
 * /dashboard/markets/mf
 *
 * Tabs: Discover | Portfolio | SIPs
 * Integrates fund search (public), MF portfolio holdings, and active SIPs.
 */

import { useState, useRef } from "react";
import { PiggyBank, AlertTriangle, Info } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";

import { useBrokerConnections }   from "../hooks/useBrokerConnections";
import {
  useMfFunds,
  useMfPortfolio,
  useMfFundDetail,
  type MfFund,
  type MfHolding,
} from "../hooks/useMf";
import { MfOrderSheet }       from "../components/MfOrderSheet";
import { MfScreener }         from "../components/MfScreener";
import { SipTrackerPanel }    from "../components/SipTrackerPanel";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtINR = (value: number | null | undefined): string => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
};

const fmtPct = (value: number | null | undefined): string => {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
};

const fmtUnits = (value: number | null | undefined): string => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(value);
};

// ── Category badge color ──────────────────────────────────────────────────────

function categoryBadge(instrumentType: string): JSX.Element {
  const map: Record<string, { label: string; cls: string }> = {
    mf_equity: { label: "Equity",  cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200" },
    mf_debt:   { label: "Debt",    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200" },
    mf_hybrid: { label: "Hybrid",  cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200" },
    mf_index:  { label: "Index",   cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200" },
  };
  const entry = map[instrumentType] ?? { label: instrumentType, cls: "" };
  return (
    <Badge variant="outline" className={`text-xs ${entry.cls}`}>
      {entry.label}
    </Badge>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label:     string;
  value:     string;
  valueColor?: string;
}

function SummaryCard({ label, value, valueColor }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-xl font-semibold tabular-nums ${valueColor ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ── Fund card (inline, no separate file) ─────────────────────────────────────

interface FundCardProps {
  fund:      MfFund;
  onInvest:  (fund: MfFund) => void;
}

function FundCard({ fund, onInvest }: FundCardProps) {
  const name     = fund.scheme_name ?? fund.metadata?.scheme_name ?? fund.symbol;
  const nav      = fund.current_nav ?? null;
  // returns is only on MfFundDetail, not MfFund — safe cast
  const returns  = (fund as { returns?: { "1y"?: number | null } }).returns;
  const ret1y    = returns?.["1y"] ?? null;

  return (
    <Card className="flex flex-col gap-0 hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex-1 space-y-2">
        <p className="text-sm font-medium leading-snug line-clamp-2 text-foreground">{name}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryBadge(fund.instrument_type)}
          {fund.fund_house && (
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">{fund.fund_house}</span>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground">NAV</p>
            <p className="text-sm font-mono font-medium">
              {nav != null ? `₹${nav.toFixed(4)}` : "—"}
            </p>
          </div>
          {ret1y != null && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">1Y Return</p>
              <p className={`text-sm font-medium ${ret1y >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {fmtPct(ret1y)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <div className="px-4 pb-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full border border-border hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
          onClick={() => onInvest(fund)}
        >
          Invest
        </Button>
      </div>
    </Card>
  );
}

// ── Skeleton cards for loading ────────────────────────────────────────────────

function FundCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-8 w-full mt-2" />
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MfPage() {
  const [searchQ,   setSearchQ]   = useState("");
  const [category,  setCategory]  = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // debounce
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(val: string) {
    setSearchQ(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQ(val), 400);
  }

  // Order sheet state
  const [selectedFundCode, setSelectedFundCode] = useState<string | null>(null);
  const [orderSheet, setOrderSheet] = useState<{
    open:      boolean;
    fund:      MfFund | null;
    orderType: "PURCHASE" | "REDEMPTION" | "SIP";
    holding?:  MfHolding | null;
  }>({ open: false, fund: null, orderType: "PURCHASE" });

  // Data hooks
  const funds     = useMfFunds(debouncedQ, category);
  const portfolio = useMfPortfolio();
  const fundDetail = useMfFundDetail(selectedFundCode);
  const connections = useBrokerConnections();

  // Find a tradeable broker connection
  const tradeConnection = connections.data?.find(c => c.can_trade) ?? null;

  // ── Order sheet helpers ───────────────────────────────────────────────────

  function openPurchaseSheet(fund: MfFund) {
    setSelectedFundCode(fund.symbol);
    setOrderSheet({ open: true, fund, orderType: "PURCHASE" });
  }

  function openRedeemSheet(holding: MfHolding) {
    const fundProxy: MfFund = {
      symbol:          holding.instrument?.symbol ?? holding.amfi_code ?? "",
      isin:            holding.instrument?.isin ?? null,
      instrument_type: holding.instrument?.instrument_type ?? "mf_equity",
      metadata:        holding.instrument?.metadata ?? null,
      scheme_name:     holding.scheme_name ?? holding.instrument?.metadata?.scheme_name ?? "",
      current_nav:     holding.current_nav ?? null,
    };
    setSelectedFundCode(fundProxy.symbol);
    setOrderSheet({ open: true, fund: fundProxy, orderType: "REDEMPTION", holding });
  }

  function openTopUpSheet(holding: MfHolding) {
    const fundProxy: MfFund = {
      symbol:          holding.instrument?.symbol ?? holding.amfi_code ?? "",
      isin:            holding.instrument?.isin ?? null,
      instrument_type: holding.instrument?.instrument_type ?? "mf_equity",
      metadata:        holding.instrument?.metadata ?? null,
      scheme_name:     holding.scheme_name ?? holding.instrument?.metadata?.scheme_name ?? "",
      current_nav:     holding.current_nav ?? null,
    };
    setSelectedFundCode(fundProxy.symbol);
    setOrderSheet({ open: true, fund: fundProxy, orderType: "PURCHASE" });
  }

  // Merge fundDetail into sheet fund if available
  const sheetFund = (fundDetail.data && fundDetail.data.symbol === orderSheet.fund?.symbol)
    ? fundDetail.data
    : orderSheet.fund;

  // ── Summary numbers ───────────────────────────────────────────────────────

  const summary = portfolio.data?.summary;
  const holdings = portfolio.data?.holdings ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 lg:p-6">

        {/* ── Page header ───────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <PiggyBank className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              Mutual Funds
            </h1>
            <p className="text-sm text-muted-foreground">Direct plans · Live NAV via AMFI</p>
          </div>
        </header>

        {/* ── Broker connection banner ───────────────────────────────── */}
        {!connections.isLoading && !tradeConnection && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                No broker connection found
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                Connect a broker account to place MF orders. Angel One and Dhan support direct MF ordering.
              </p>
            </div>
          </div>
        )}

        {/* ── Main tabs ─────────────────────────────────────────────── */}
        <Tabs defaultValue="discover">
          <TabsList>
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="screener">Screener</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="sips">SIPs</TabsTrigger>
          </TabsList>

          {/* ── Discover tab ────────────────────────────────────────── */}
          <TabsContent value="discover" className="space-y-4 mt-4">

            {/* Control bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Search funds…"
                className="w-60"
                value={searchQ}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <Select value={category || "__all__"} onValueChange={(v) => setCategory(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  <SelectItem value="mf_equity">Equity</SelectItem>
                  <SelectItem value="mf_debt">Debt</SelectItem>
                  <SelectItem value="mf_hybrid">Hybrid</SelectItem>
                  <SelectItem value="mf_index">Index</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fund grid */}
            {funds.isLoading && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <FundCardSkeleton key={i} />)}
              </div>
            )}

            {funds.isError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <Info className="h-4 w-4 shrink-0" />
                {funds.error?.message ?? "Failed to load funds."}
              </div>
            )}

            {funds.isSuccess && (funds.data ?? []).length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <PiggyBank className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No funds found. Try a different search.
                </p>
              </div>
            )}

            {funds.isSuccess && (funds.data ?? []).length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(funds.data ?? []).map((fund) => (
                  <FundCard
                    key={fund.symbol}
                    fund={fund}
                    onInvest={openPurchaseSheet}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Screener tab ────────────────────────────────────────── */}
          <TabsContent value="screener" className="mt-4">
            <MfScreener />
          </TabsContent>

          {/* ── Portfolio tab ───────────────────────────────────────── */}
          <TabsContent value="portfolio" className="space-y-4 mt-4">

            {/* Summary row */}
            {portfolio.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><Skeleton className="h-6 w-3/4 mt-1" /></CardContent></Card>
                ))}
              </div>
            ) : summary ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Total Invested"
                  value={fmtINR(summary.total_invested)}
                />
                <SummaryCard
                  label="Current Value"
                  value={fmtINR(summary.total_current)}
                />
                <SummaryCard
                  label="Total Gain / Loss"
                  value={fmtINR(summary.total_gain)}
                  valueColor={summary.total_gain >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"}
                />
                <SummaryCard
                  label="Return %"
                  value={fmtPct(summary.return_pct)}
                  valueColor={summary.return_pct >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"}
                />
              </div>
            ) : null}

            {/* Holdings table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Holdings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {portfolio.isLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : holdings.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
                    <PiggyBank className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No MF holdings found. Import from CAMS/NSDL or buy your first fund in Discover.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fund</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                          <TableHead className="text-right">Avg NAV</TableHead>
                          <TableHead className="text-right">Current NAV</TableHead>
                          <TableHead className="text-right">Invested</TableHead>
                          <TableHead className="text-right">Current Value</TableHead>
                          <TableHead className="text-right">Gain</TableHead>
                          <TableHead className="text-right">Return %</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdings.map((h) => {
                          const name = h.scheme_name ?? h.instrument?.metadata?.scheme_name ?? h.instrument?.symbol ?? "—";
                          return (
                            <TableRow key={h.id}>
                              <TableCell>
                                <p className="font-medium text-sm max-w-[200px] truncate" title={name}>{name}</p>
                                {h.folio_number && (
                                  <p className="text-xs text-muted-foreground">Folio: {h.folio_number}</p>
                                )}
                              </TableCell>
                              <TableCell>{categoryBadge(h.instrument?.instrument_type ?? "mf_equity")}</TableCell>
                              <TableCell className="text-right font-mono">{fmtUnits(h.qty)}</TableCell>
                              <TableCell className="text-right font-mono">{h.avg_cost != null ? `₹${h.avg_cost.toFixed(4)}` : "—"}</TableCell>
                              <TableCell className="text-right font-mono">{h.current_nav != null ? `₹${h.current_nav.toFixed(4)}` : "—"}</TableCell>
                              <TableCell className="text-right">{fmtINR(h.invested_value)}</TableCell>
                              <TableCell className="text-right">{fmtINR(h.current_value)}</TableCell>
                              <TableCell className={`text-right font-medium ${(h.gain ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                {fmtINR(h.gain)}
                              </TableCell>
                              <TableCell className={`text-right font-medium ${(h.return_pct ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                {fmtPct(h.return_pct)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => openTopUpSheet(h)}
                                  >
                                    Buy More
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                    onClick={() => openRedeemSheet(h)}
                                  >
                                    Redeem
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SIPs tab ────────────────────────────────────────────── */}
          <TabsContent value="sips" className="space-y-4 mt-4">
            <SipTrackerPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── MF Order Sheet ───────────────────────────────────────────────── */}
      <MfOrderSheet
        open={orderSheet.open}
        onOpenChange={(v) => setOrderSheet(prev => ({ ...prev, open: v }))}
        fund={sheetFund}
        connectionId={tradeConnection?.id ?? ""}
        connectionName={tradeConnection?.display_name ?? "No broker connected"}
        defaultOrderType={orderSheet.orderType}
        holding={orderSheet.holding}
      />
    </DashboardLayout>
  );
}
