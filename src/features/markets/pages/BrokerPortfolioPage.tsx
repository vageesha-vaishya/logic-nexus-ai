/**
 * Markets — Broker Portfolio drill-down page.
 *
 * /dashboard/markets/settings/brokers/:connectionId
 *
 * Tabs: Holdings | Positions | Orders
 * Displays live data from a connected broker account with sync controls.
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Badge,
  Button,
  Card,
  CardContent,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/design-system";

import {
  useBrokerConnections,
  useSupportedBrokers,
  useTriggerBrokerSync,
  type BrokerConnection,
} from "../hooks/useBrokerConnections";
import {
  useConnectionHoldings,
  useConnectionPositions,
  useConnectionOrders,
  useCancelOrder,
  type BrokerHolding,
  type BrokerPosition,
  type BrokerOrder,
} from "../hooks/useBrokerPortfolio";
import { OrderFormSheet } from "@/features/markets/components/OrderFormSheet";
import { marketsKeys } from "../hooks/queryKeys";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtINR = (value: number | null | undefined): string => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
};

const fmtQty = (value: number | null | undefined): string => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
};

function fmtTime(isoString: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "—";
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

function ConnectionStatusBadge({ status }: { status: BrokerConnection["status"] }) {
  const map: Record<
    string,
    { label: string; className: string }
  > = {
    active:  { label: "Active",  className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    expired: { label: "Expired", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    error:   { label: "Error",   className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    pending: { label: "Pending", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    revoked: { label: "Revoked", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ── Order status badge ────────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "complete") {
    return <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-600">Complete</Badge>;
  }
  if (s === "open" || s === "trigger pending") {
    return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100">{status}</Badge>;
  }
  if (s === "rejected") {
    return <Badge variant="destructive" className="text-xs">{status}</Badge>;
  }
  if (s === "cancelled") {
    return <Badge variant="outline" className="text-xs text-muted-foreground">{status}</Badge>;
  }
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

// ── P&L cell ──────────────────────────────────────────────────────────────────

function PnLCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
      {positive ? "+" : ""}{fmtINR(value)}
    </span>
  );
}

// ── Holdings tab ──────────────────────────────────────────────────────────────

function HoldingsTab({
  holdings,
  isLoading,
  isError,
  error,
  refetch,
  onOrder,
}: {
  holdings: BrokerHolding[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  onOrder?: (symbol: string, exchange: string, side: "BUY" | "SELL") => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Failed to load holdings</p>
            <p className="text-xs text-muted-foreground truncate">{error?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const totalInvested = holdings.reduce((sum, h) => sum + h.qty * h.avg_cost, 0);
  const totalCurrent = holdings.reduce((sum, h) => {
    const ltp = h.metadata?.last_price;
    return sum + (ltp != null ? h.qty * ltp : h.qty * h.avg_cost);
  }, 0);
  const totalPnL = totalCurrent - totalInvested;

  return (
    <div className="space-y-4 mt-2">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Holdings</p>
            <p className="text-lg font-semibold">{holdings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Invested</p>
            <p className="text-sm font-semibold">{fmtINR(totalInvested)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="text-sm font-semibold">{fmtINR(totalCurrent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Unrealised P&L</p>
            <p className={`text-sm font-semibold ${totalPnL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {totalPnL >= 0 ? "+" : ""}{fmtINR(totalPnL)}
            </p>
          </CardContent>
        </Card>
      </div>

      {holdings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No holdings found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sync your account to pull the latest holdings.
          </p>
        </div>
      ) : (
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Exchange</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">T+1</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">LTP</TableHead>
                <TableHead className="text-right">Unrealised P&L</TableHead>
                <TableHead className="text-right">P&L %</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => {
                const symbol   = h.instrument?.symbol ?? h.metadata?.tradingsymbol ?? "—";
                const exchange = h.instrument?.exchange ?? h.metadata?.exchange ?? "—";
                const type     = h.asset_class ?? h.instrument?.instrument_type ?? "equity";
                const t1Qty    = h.metadata?.t1_quantity ?? 0;
                const ltp      = h.metadata?.last_price ?? null;
                const pnl      = h.metadata?.pnl ?? null;
                const pnlPct   = ltp != null && h.avg_cost > 0
                  ? ((ltp - h.avg_cost) / h.avg_cost * 100).toFixed(2)
                  : null;

                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{symbol}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{exchange}</TableCell>
                    <TableCell className="text-xs capitalize">{type}</TableCell>
                    <TableCell className="text-right">{fmtQty(h.qty)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtQty(t1Qty)}</TableCell>
                    <TableCell className="text-right">{fmtINR(h.avg_cost)}</TableCell>
                    <TableCell className="text-right">{ltp != null ? fmtINR(ltp) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right"><PnLCell value={pnl} /></TableCell>
                    <TableCell className="text-right">
                      {pnlPct != null ? (
                        <span className={parseFloat(pnlPct) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                          {parseFloat(pnlPct) >= 0 ? "+" : ""}{pnlPct}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => onOrder?.(symbol, exchange, "BUY")}
                        >
                          Buy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => onOrder?.(symbol, exchange, "SELL")}
                        >
                          Sell
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}

// ── Positions tab ─────────────────────────────────────────────────────────────

function PositionsTab({
  positions,
  isLoading,
  isError,
  error,
  refetch,
}: {
  positions: BrokerPosition[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Failed to load positions</p>
            <p className="text-xs text-muted-foreground truncate">{error?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center mt-2">
        <TrendingDown className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No open positions</p>
        <p className="text-xs text-muted-foreground mt-1">
          Intraday positions will appear here once the market opens.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full mt-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Exchange</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Avg Price</TableHead>
            <TableHead className="text-right">LTP</TableHead>
            <TableHead className="text-right">P&L</TableHead>
            <TableHead className="text-right">M2M</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.tradingsymbol}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{p.exchange}</TableCell>
              <TableCell className="text-xs">{p.product}</TableCell>
              <TableCell className={`text-right font-medium ${p.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : p.quantity < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {fmtQty(p.quantity)}
              </TableCell>
              <TableCell className="text-right">{fmtINR(p.avg_price)}</TableCell>
              <TableCell className="text-right">{p.last_price != null ? fmtINR(p.last_price) : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="text-right"><PnLCell value={p.pnl} /></TableCell>
              <TableCell className="text-right"><PnLCell value={p.m2m} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// ── Orders tab ────────────────────────────────────────────────────────────────

function OrdersTab({
  orders,
  isLoading,
  isError,
  error,
  refetch,
  onCancel,
  isCancelling,
}: {
  orders: BrokerOrder[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  onCancel?: (brokerOrderId: string) => void;
  isCancelling?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Failed to load orders</p>
            <p className="text-xs text-muted-foreground truncate">{error?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center mt-2">
        <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No orders today</p>
        <p className="text-xs text-muted-foreground mt-1">
          Orders placed during today's session will appear here.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full mt-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Filled</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Time</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const isBuy       = o.transaction_type.toUpperCase() === "BUY";
            const isCancellable = o.status === "open" || o.status === "trigger pending";
            return (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.tradingsymbol}</TableCell>
                <TableCell className="text-xs">{o.order_type}</TableCell>
                <TableCell className="text-xs">{o.product}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      isBuy
                        ? "border-blue-400 text-blue-700 dark:text-blue-400"
                        : "border-red-400 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {o.transaction_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{fmtQty(o.quantity)}</TableCell>
                <TableCell className="text-right">{o.price != null ? fmtINR(o.price) : <span className="text-muted-foreground">MKT</span>}</TableCell>
                <TableCell className="text-right">{fmtQty(o.filled_quantity)}</TableCell>
                <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                <TableCell className="text-right font-mono text-xs">{fmtTime(o.placed_at)}</TableCell>
                <TableCell className="text-right">
                  {isCancellable && o.broker_order_id ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-600 hover:text-red-700"
                      onClick={() => onCancel?.(o.broker_order_id!)}
                      disabled={isCancelling}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrokerPortfolioPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [orderSheet, setOrderSheet] = useState<{
    open:     boolean;
    symbol:   string;
    exchange: string;
    side:     "BUY" | "SELL";
  }>({ open: false, symbol: "", exchange: "NSE", side: "BUY" });

  const { data: connections = [] } = useBrokerConnections();
  const { data: supported = [] }   = useSupportedBrokers();

  const conn   = connections.find(c => c.id === connectionId) ?? null;
  const broker = conn ? supported.find(b => b.id === conn.broker) : null;

  const triggerSync  = useTriggerBrokerSync();
  const cancelOrder  = useCancelOrder(connectionId!);

  const holdingsQuery  = useConnectionHoldings(connectionId ?? null);
  const positionsQuery = useConnectionPositions(connectionId ?? null);
  const ordersQuery    = useConnectionOrders(connectionId ?? null);

  const holdings  = holdingsQuery.data  ?? [];
  const positions = positionsQuery.data ?? [];
  const orders    = ordersQuery.data    ?? [];

  const hasEverSynced = Boolean(conn?.last_synced_at);
  const isSyncing     = triggerSync.isPending;

  async function handleSync() {
    if (!connectionId) return;
    try {
      await triggerSync.mutateAsync(connectionId);
      toast.success("Sync started — data will refresh shortly");
      // Invalidate all three data sets + the connections list after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.holdings(connectionId) });
        queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.positions(connectionId) });
        queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.orders(connectionId) });
        queryClient.invalidateQueries({ queryKey: marketsKeys.brokers.connections() });
      }, 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      toast.error(msg);
    }
  }

  // Broker logo initials fallback
  const brokerName    = broker?.name ?? conn?.broker ?? "??";
  const logoInitials  = brokerName.slice(0, 2).toUpperCase();
  const logoUrl       = broker?.logo;

  const displayName   = conn?.display_name ?? brokerName;
  const clientId      = conn?.broker_client_id ?? "";
  const connStatus    = conn?.status ?? "pending";

  const lastSyncedText = conn?.last_synced_at
    ? `Last synced ${formatDistanceToNow(new Date(conn.last_synced_at), { addSuffix: true })}`
    : "Never synced";

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">

          {/* ── Back link ───────────────────────────────────────────── */}
          <button
            onClick={() => navigate("/dashboard/markets/settings/brokers")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Broker Accounts
          </button>

          {/* ── Header row ──────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {/* Logo / avatar */}
              <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={brokerName}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) parent.setAttribute("data-initials", logoInitials);
                    }}
                  />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">{logoInitials}</span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold">{displayName}</h1>
                  {conn && <ConnectionStatusBadge status={connStatus} />}
                </div>
                {clientId && (
                  <p className="text-sm text-muted-foreground mt-0.5">Client ID: {clientId}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {conn?.can_trade && (
                <Button
                  size="sm"
                  onClick={() => setOrderSheet({ open: true, symbol: "", exchange: "NSE", side: "BUY" })}
                >
                  New Order
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Syncing…" : "Sync Now"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pull the latest data from your broker</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ── Sync metadata row ───────────────────────────────────── */}
          <div>
            <p className="text-xs text-muted-foreground">{lastSyncedText}</p>
            {!hasEverSynced && (
              <Card className="mt-3 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                <CardContent className="flex items-center gap-3 p-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    No data yet — click <strong>Sync Now</strong> to pull your portfolio from the broker.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Tabs ────────────────────────────────────────────────── */}
          <Tabs defaultValue="holdings">
            <TabsList>
              <TabsTrigger value="holdings" className="gap-1.5">
                Holdings
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium">
                  {holdings.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="positions" className="gap-1.5">
                Positions
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium">
                  {positions.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5">
                Orders
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium">
                  {orders.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="holdings">
              <HoldingsTab
                holdings={holdings}
                isLoading={holdingsQuery.isPending}
                isError={holdingsQuery.isError}
                error={holdingsQuery.error}
                refetch={holdingsQuery.refetch}
                onOrder={(sym, exch, side) =>
                  setOrderSheet({ open: true, symbol: sym, exchange: exch, side })
                }
              />
            </TabsContent>

            <TabsContent value="positions">
              <PositionsTab
                positions={positions}
                isLoading={positionsQuery.isPending}
                isError={positionsQuery.isError}
                error={positionsQuery.error}
                refetch={positionsQuery.refetch}
              />
            </TabsContent>

            <TabsContent value="orders">
              <OrdersTab
                orders={orders}
                isLoading={ordersQuery.isPending}
                isError={ordersQuery.isError}
                error={ordersQuery.error}
                refetch={ordersQuery.refetch}
                onCancel={(brokerOrderId) => cancelOrder.mutate(brokerOrderId)}
                isCancelling={cancelOrder.isPending}
              />
            </TabsContent>
          </Tabs>

        </div>
      </TooltipProvider>

      {/* ── Order form sheet ─────────────────────────────────────────────── */}
      {conn && (
        <OrderFormSheet
          open={orderSheet.open}
          onOpenChange={(open) => setOrderSheet(prev => ({ ...prev, open }))}
          connectionId={connectionId!}
          connectionName={conn.display_name}
          brokerName={conn.broker}
          canTrade={conn.can_trade}
          defaultSymbol={orderSheet.symbol}
          defaultExchange={orderSheet.exchange}
          defaultTransactionType={orderSheet.side}
        />
      )}
    </DashboardLayout>
  );
}
