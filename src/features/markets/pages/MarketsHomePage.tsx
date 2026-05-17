/**
 * Markets — Home dashboard page.
 *
 * Route: /dashboard/markets
 *
 * Sections:
 *   A — Market Pulse strip (live index LTP)
 *   B — Portfolio summary cards
 *   C — Default watchlist preview
 *   D — Quick-nav shortcuts
 */

import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Bell,
  Eye,
  LayoutDashboard,
  PiggyBank,
  TrendingUp,
  Wallet,
  Wifi,
} from "lucide-react";

import { useLTP, type LTPQuote } from "../hooks/useLTP";
import { useWatchlists, useWatchlist } from "../hooks/useWatchlists";
import { usePortfolios } from "../hooks/usePortfolios";
import { isMarketOpen } from "../utils/market-hours";

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
} from "@/design-system";
import type { Portfolio, WatchlistItem } from "../types";
import { logger } from "@/lib/logger";

// ─── Index symbols ───────────────────────────────────────────────────────────

const INDICES = [
  { symbol: "NIFTY 50",   label: "NIFTY 50"   },
  { symbol: "NIFTY BANK", label: "NIFTY BANK" },
  { symbol: "INDIA VIX",  label: "India VIX"  },
] as const;

const INDEX_SYMBOLS = INDICES.map((i) => i.symbol);

// ─── Currency format ─────────────────────────────────────────────────────────

function fmtINR(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarketsHomePage() {
  const marketOpen = isMarketOpen();

  logger.debug("[MarketsHome] render", { marketOpen });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-8 p-6">

        {/* Page header */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
              <p className="text-sm text-muted-foreground">
                Live prices, portfolio overview and watchlist at a glance.
              </p>
            </div>
          </div>
          <MarketStatusBadge open={marketOpen} />
        </header>

        {/* Section A — Market Pulse strip */}
        <MarketPulse />

        {/* Section B — Portfolio summary */}
        <PortfolioSummary />

        {/* Section C — Default watchlist preview */}
        <WatchlistPreview />

        {/* Section D — Quick-nav cards */}
        <QuickNav />

      </div>
    </DashboardLayout>
  );
}

// ─── Market status badge ─────────────────────────────────────────────────────

function MarketStatusBadge({ open }: { open: boolean }) {
  if (open) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">NSE Live</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
      <span className="text-sm text-muted-foreground">NSE Closed · Opens Mon 9:15 AM IST</span>
    </div>
  );
}

// ─── Section A: Market Pulse ─────────────────────────────────────────────────

function MarketPulse() {
  const { data: ltpMap, isPending, isError } = useLTP(INDEX_SYMBOLS, "NSE");

  return (
    <section aria-labelledby="pulse-heading">
      <h2 id="pulse-heading" className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Market Pulse
      </h2>

      {isError && (
        <p className="text-sm text-muted-foreground">Index data unavailable — prices shown when market is live.</p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {isPending
          ? INDICES.map((idx) => (
              <div key={idx.symbol} className="min-w-[160px] animate-pulse rounded-lg border bg-card p-4">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="mt-2 h-6 w-28 rounded bg-muted" />
                <div className="mt-1.5 h-3 w-16 rounded bg-muted" />
              </div>
            ))
          : INDICES.map((idx) => (
              <IndexCard
                key={idx.symbol}
                label={idx.label}
                quote={ltpMap?.[idx.symbol]}
              />
            ))}
      </div>
    </section>
  );
}

function IndexCard({ label, quote }: { label: string; quote: LTPQuote | undefined }) {
  const ltp        = quote?.ltp;
  const change     = quote?.change;
  const changePct  = quote?.change_pct;
  const isPositive = (change ?? 0) >= 0;
  const hasData    = ltp != null;

  return (
    <div className="min-w-[160px] rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">
        {hasData ? fmtINR(ltp) : "—"}
      </p>
      <p
        className={`mt-0.5 text-xs font-medium tabular-nums ${
          hasData
            ? isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500 dark:text-red-400"
            : "text-muted-foreground"
        }`}
      >
        {hasData
          ? `${isPositive ? "↑" : "↓"} ${fmtINR(change)} (${fmtPct(changePct)})`
          : "No data"}
      </p>
      {/* Coloured bar indicating direction */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            hasData
              ? isPositive
                ? "bg-emerald-500"
                : "bg-red-500"
              : "bg-muted"
          }`}
          style={{ width: hasData ? "60%" : "0%" }}
        />
      </div>
    </div>
  );
}

// ─── Section B: Portfolio summary ────────────────────────────────────────────

function PortfolioSummary() {
  const portfolios = usePortfolios();

  return (
    <section aria-labelledby="portfolios-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="portfolios-heading" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Portfolios
        </h2>
        <Link
          to="/dashboard/markets/portfolios"
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>

      {portfolios.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      )}

      {portfolios.isError && (
        <ErrorState
          title="Failed to load portfolios"
          message={portfolios.error?.message ?? "Unknown error"}
          onRetry={() => portfolios.refetch()}
        />
      )}

      {portfolios.isSuccess && portfolios.data.length === 0 && (
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="No portfolios yet"
          description="Create your first portfolio to start tracking holdings."
          actionLabel="Create a portfolio"
          onAction={() => { window.location.href = "/dashboard/markets/portfolios"; }}
        />
      )}

      {portfolios.isSuccess && portfolios.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.data.map((p) => (
            <PortfolioSummaryCard key={p.id} portfolio={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function PortfolioSummaryCard({ portfolio }: { portfolio: Portfolio }) {
  const createdDate = new Date(portfolio.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base">
            <Link
              to={`/dashboard/markets/portfolios/${portfolio.id}`}
              className="outline-none hover:underline focus-visible:underline"
            >
              {portfolio.name}
            </Link>
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Created {createdDate}</p>
        </div>
        <Badge
          variant={portfolio.mode === "live" ? "default" : "secondary"}
          className="shrink-0 capitalize text-xs"
        >
          {portfolio.mode}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to={`/dashboard/markets/portfolios/${portfolio.id}`}>
            View portfolio
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Section C: Default watchlist preview ────────────────────────────────────

function WatchlistPreview() {
  const watchlists       = useWatchlists();
  const defaultWatchlist = watchlists.data?.find((w) => w.is_default);
  const detail           = useWatchlist(defaultWatchlist?.id);

  // Symbols to query LTP for (top 8 items only)
  const watchlistSymbols: string[] = (detail.data?.items ?? [])
    .slice(0, 8)
    .map((item) => item.instrument?.symbol)
    .filter((s): s is string => Boolean(s));

  const { data: ltpMap } = useLTP(watchlistSymbols, "NSE");

  return (
    <section aria-labelledby="watchlist-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="watchlist-heading" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Watchlist
          {defaultWatchlist && (
            <span className="ml-2 font-normal normal-case text-foreground/70">
              — {defaultWatchlist.name}
            </span>
          )}
        </h2>
        {defaultWatchlist && (
          <Link
            to={`/dashboard/markets/watchlists/${defaultWatchlist.id}`}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        )}
      </div>

      {(watchlists.isPending || detail.isPending) && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex h-10 animate-pulse items-center gap-3 rounded-md border bg-card px-4">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="ml-auto h-3 w-16 rounded bg-muted" />
              <div className="h-3 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {watchlists.isSuccess && !defaultWatchlist && (
        <EmptyState
          icon={<Eye className="h-8 w-8" />}
          title="No default watchlist"
          description="Create a watchlist and mark it as default to see it here."
          actionLabel="Go to Watchlists"
          onAction={() => { window.location.href = "/dashboard/markets/watchlists"; }}
        />
      )}

      {defaultWatchlist && detail.isSuccess && detail.data.items.length === 0 && (
        <EmptyState
          icon={<Eye className="h-8 w-8" />}
          title="Watchlist is empty"
          description="Add instruments to your default watchlist to see live prices here."
          actionLabel="Add instruments"
          onAction={() => { window.location.href = `/dashboard/markets/watchlists/${defaultWatchlist.id}`; }}
        />
      )}

      {defaultWatchlist && detail.isSuccess && detail.data.items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {detail.data.items.slice(0, 8).map((item) => (
                <WatchlistRow key={item.id} item={item} quote={item.instrument ? ltpMap?.[item.instrument.symbol] : undefined} />
              ))}
            </div>
            {detail.data.items.length > 8 && (
              <div className="border-t px-4 py-3 text-center">
                <Link
                  to={`/dashboard/markets/watchlists/${defaultWatchlist.id}`}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  +{detail.data.items.length - 8} more instruments
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function WatchlistRow({ item, quote }: { item: WatchlistItem; quote: LTPQuote | undefined }) {
  const symbol     = item.instrument?.symbol ?? "—";
  const exchange   = item.instrument?.exchange ?? "";
  const ltp        = quote?.ltp;
  const changePct  = quote?.change_pct;
  const isPositive = (changePct ?? 0) >= 0;
  const hasData    = ltp != null;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{symbol}</p>
        {exchange && <p className="text-xs text-muted-foreground">{exchange}</p>}
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">
          {hasData ? fmtINR(ltp) : "—"}
        </p>
        <p
          className={`text-xs tabular-nums ${
            hasData
              ? isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
              : "text-muted-foreground"
          }`}
        >
          {hasData ? `${isPositive ? "↑" : "↓"} ${fmtPct(changePct)}` : "—"}
        </p>
      </div>
    </div>
  );
}

// ─── Section D: Quick nav cards ───────────────────────────────────────────────

const QUICK_NAV = [
  {
    title: "Portfolios",
    description: "Track holdings, NAV and AI briefs",
    path: "/dashboard/markets/portfolios",
    icon: Wallet,
  },
  {
    title: "Watchlists",
    description: "Monitor instruments across asset classes",
    path: "/dashboard/markets/watchlists",
    icon: Eye,
  },
  {
    title: "F&O Chain",
    description: "Live option chain with greeks",
    path: "/dashboard/markets/fno",
    icon: TrendingUp,
  },
  {
    title: "Mutual Funds",
    description: "Discover, invest, SIP and manage",
    path: "/dashboard/markets/mf",
    icon: PiggyBank,
  },
  {
    title: "Price Alerts",
    description: "Get notified when prices cross targets",
    path: "/dashboard/markets/alerts",
    icon: Bell,
  },
  {
    title: "Broker Accounts",
    description: "Connect brokers for live sync",
    path: "/dashboard/markets/settings/brokers",
    icon: Wifi,
  },
] as const;

function QuickNav() {
  return (
    <section aria-labelledby="quicknav-heading">
      <h2 id="quicknav-heading" className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Quick Access
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {QUICK_NAV.map(({ title, description, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="group rounded-lg border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="mb-2 h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

