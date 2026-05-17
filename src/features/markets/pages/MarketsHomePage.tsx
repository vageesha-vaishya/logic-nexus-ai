/**
 * Markets — Home dashboard.
 *
 * Route: /dashboard/markets
 *
 * World-class layout inspired by Zerodha Kite / Dhan / Upstox Pro.
 *
 * Layout:
 *   Header  → title + search bar + live-status badge
 *   Strip   → horizontally scrollable index cards (5 indices)
 *   Body    → lg: 2/3 main + 1/3 sidebar
 *             mobile: stacked sections
 *
 * Main sections (left):
 *   1. Portfolios grid
 *   2. Top Movers (gainers / losers from watchlist)
 *   3. FII/DII today strip with 5-day sparkline
 *   4. Quick Access grid
 *
 * Sidebar sections (right):
 *   A. Watchlist preview with market breadth bar
 *   B. Upcoming Economic Calendar events
 *   C. Active Price Alerts
 */

import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  Eye,
  GitBranch,
  Keyboard,
  Monitor,
  PiggyBank,
  Radar,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wifi,
} from "lucide-react";
import { KeyboardShortcutsHelp } from "../components/KeyboardShortcutsHelp";
import { useMarketKeyboardShortcuts } from "../hooks/useMarketKeyboardShortcuts";

import { useLTP, type LTPQuote } from "../hooks/useLTP";
import { useWatchlists, useWatchlist } from "../hooks/useWatchlists";
import { usePortfolios } from "../hooks/usePortfolios";
import { useEconomicCalendar, type CalendarEvent } from "../hooks/useEconomicCalendar";
import { usePriceAlerts, type PriceAlert } from "../hooks/usePriceAlerts";
import { useFiiDii } from "../hooks/useFiiDii";
import { useScanner } from "../hooks/useScanner";
import { isMarketOpen, marketStatusLabel } from "../utils/market-hours";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/design-system";
import { Skeleton } from "@/components/ui/skeleton";
import type { Portfolio, WatchlistItem } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const INDICES = [
  { symbol: "NIFTY 50",   label: "NIFTY 50",  short: "N50"  },
  { symbol: "SENSEX",     label: "SENSEX",     short: "SENS" },
  { symbol: "NIFTY BANK", label: "NIFTY BANK", short: "BANK" },
  { symbol: "NIFTY IT",   label: "NIFTY IT",   short: "IT"   },
  { symbol: "INDIA VIX",  label: "India VIX",  short: "VIX"  },
] as const;

const INDEX_SYMBOLS = INDICES.map((i) => i.symbol);

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtINR(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtINRCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_00_00_00_000) return `${sign}₹${(abs / 1_00_00_00_000).toFixed(2)}K Cr`;
  if (abs >= 1_00_00_000)    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000)       return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  return `${sign}₹${fmtINR(abs)}`;
}

function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Skeleton primitives ──────────────────────────────────────────────────────

function SkeletonLine({ className = "" }: { className?: string }) {
  return <Skeleton className={`rounded ${className}`} />;
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function MarketsHomePage() {
  const marketOpen = isMarketOpen();
  const statusLabel = marketStatusLabel();
  const { showHelp, setShowHelp } = useMarketKeyboardShortcuts();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-screen-xl space-y-6 p-4 sm:p-6">

        {/* Keyboard shortcuts help modal */}
        <KeyboardShortcutsHelp open={showHelp} onClose={() => setShowHelp(false)} />

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Markets</h1>
              <p className="text-sm text-muted-foreground">
                Live prices, portfolios and watchlist at a glance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Button variant="outline" asChild className="h-9 gap-2 text-sm">
              <Link to="/dashboard/markets/watchlists">
                <Search className="h-4 w-4" />
                Search instruments
              </Link>
            </Button>

            <Button size="sm" asChild className="h-9 gap-2">
              <Link to="/dashboard/markets/portfolios">
                <TrendingUp className="h-4 w-4" />
                New Order
              </Link>
            </Button>

            <Button variant="outline" size="sm" asChild className="h-9 gap-2 border-primary/40 text-primary hover:bg-primary/10">
              <Link to="/dashboard/markets/terminal">
                <Monitor className="h-4 w-4" />
                Open Terminal
              </Link>
            </Button>

            {/* Keyboard shortcuts trigger */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(true)}
              className="h-9 w-9 p-0"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="h-4 w-4" />
            </Button>

            {/* Market status badge */}
            <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
              {marketOpen ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              )}
              <span
                className={`text-xs font-medium ${
                  marketOpen
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </header>

        {/* ── Index strip ───────────────────────────────────────────────── */}
        <IndexStrip />

        {/* ── Two-column body ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* ── Main (left 2/3) ──────────────────────────────────────── */}
          <main className="space-y-8 lg:col-span-2">
            <PortfoliosSection />
            <TopMoversSection />
            <FiiDiiSection />
            <QuickAccessSection />
          </main>

          {/* ── Sidebar (right 1/3) ──────────────────────────────────── */}
          <aside className="space-y-6 lg:col-span-1">
            <WatchlistSidebar />
            <UpcomingEventsSection />
            <PriceAlertsSection />
          </aside>

        </div>
      </div>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEX STRIP
// ─────────────────────────────────────────────────────────────────────────────

function IndexStrip() {
  const { data: ltpMap, isPending } = useLTP(INDEX_SYMBOLS, "NSE");

  return (
    <section aria-label="Market indices">
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isPending
          ? INDEX_SYMBOLS.map((s) => <IndexCardSkeleton key={s} />)
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
  const ltp       = quote?.ltp;
  const change    = quote?.change;
  const changePct = quote?.change_pct;
  const positive  = (change ?? 0) >= 0;
  const hasData   = ltp != null;

  const accentClass = hasData
    ? positive
      ? "border-l-emerald-500"
      : "border-l-rose-500"
    : "border-l-muted";

  return (
    <div
      className={`min-w-[180px] flex-shrink-0 rounded-xl border border-l-4 bg-gradient-to-br from-card to-card/80 p-4 shadow-sm transition-shadow hover:shadow-md ${accentClass}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-xl font-bold tabular-nums">
        {hasData ? fmtINR(ltp) : "—"}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          className={`flex items-center gap-0.5 text-xs tabular-nums font-medium ${
            hasData
              ? positive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500 dark:text-rose-400"
              : "text-muted-foreground"
          }`}
        >
          {hasData ? (
            <>
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {fmtINR(change)}
            </>
          ) : (
            "No data"
          )}
        </span>
        {hasData && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              positive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
            }`}
          >
            {fmtPct(changePct)}
          </span>
        )}
      </div>
    </div>
  );
}

function IndexCardSkeleton() {
  return (
    <div className="min-w-[180px] flex-shrink-0 animate-pulse rounded-xl border bg-card p-4 shadow-sm">
      <SkeletonLine className="h-2.5 w-16" />
      <SkeletonLine className="mt-2 h-7 w-28" />
      <div className="mt-2 flex justify-between">
        <SkeletonLine className="h-3 w-16" />
        <SkeletonLine className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIOS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function PortfoliosSection() {
  const { data: portfolios, isPending, isError } = usePortfolios();
  const navigate = useNavigate();

  return (
    <section aria-labelledby="portfolios-heading">
      <SectionHeader
        id="portfolios-heading"
        title="My Portfolios"
        badge={portfolios?.length}
        linkTo="/dashboard/markets/portfolios"
        linkLabel="View all"
      />

      {isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <PortfolioCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <EmptyPlaceholder icon={<Wallet className="h-8 w-8 text-muted-foreground" />}>
          Failed to load portfolios.
        </EmptyPlaceholder>
      )}

      {!isPending && !isError && (portfolios?.length ?? 0) === 0 && (
        <EmptyPlaceholder icon={<Wallet className="h-8 w-8 text-muted-foreground" />}>
          No portfolios yet.{" "}
          <button
            type="button"
            onClick={() => navigate("/dashboard/markets/portfolios")}
            className="text-primary underline-offset-2 hover:underline"
          >
            Create one
          </button>
          .
        </EmptyPlaceholder>
      )}

      {!isPending && !isError && (portfolios?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {portfolios!.map((p) => (
            <PortfolioCard key={p.id} portfolio={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function PortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  const created = new Date(portfolio.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="rounded-xl shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-sm font-semibold">
            <Link
              to={`/dashboard/markets/portfolios/${portfolio.id}`}
              className="hover:underline focus-visible:underline"
            >
              {portfolio.name}
            </Link>
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {portfolio.base_currency} · Created {created}
          </p>
        </div>
        <Badge
          variant={portfolio.mode === "live" ? "default" : "secondary"}
          className="shrink-0 text-[10px] uppercase tracking-wide"
        >
          {portfolio.mode}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <Link
          to={`/dashboard/markets/portfolios/${portfolio.id}`}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function PortfolioCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonLine className="h-4 w-32" />
          <SkeletonLine className="h-3 w-24" />
        </div>
        <SkeletonLine className="h-5 w-12 rounded-full" />
      </div>
      <SkeletonLine className="mt-4 h-3 w-16" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP MOVERS
// ─────────────────────────────────────────────────────────────────────────────

function TopMoversSection() {
  const watchlists = useWatchlists();
  const defaultWl  = watchlists.data?.find((w) => w.is_default);
  const detail     = useWatchlist(defaultWl?.id);

  const watchlistSymbols: string[] = (detail.data?.items ?? [])
    .map((item) => item.instrument?.symbol)
    .filter((s): s is string => Boolean(s));

  const { data: ltpMap } = useLTP(watchlistSymbols, "NSE");

  const movers = useMemo(() => {
    const quotes = Object.values(ltpMap ?? {}).filter((q) => q.change_pct != null);
    if (quotes.length < 3) return null;
    const sorted = [...quotes].sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
    return {
      gainers: sorted.slice(0, 3),
      losers:  sorted.slice(-3).reverse(),
    };
  }, [ltpMap]);

  if (!movers) return null;

  return (
    <section aria-labelledby="movers-heading">
      <SectionHeader id="movers-heading" title="Top Movers" />
      <div className="grid grid-cols-2 gap-4">
        {/* Gainers */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Gainers
            </span>
          </div>
          <div className="divide-y">
            {movers.gainers.map((q) => (
              <MoverRow key={q.symbol} quote={q} positive />
            ))}
          </div>
        </div>

        {/* Losers */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
            <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">
              Losers
            </span>
          </div>
          <div className="divide-y">
            {movers.losers.map((q) => (
              <MoverRow key={q.symbol} quote={q} positive={false} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MoverRow({ quote, positive }: { quote: LTPQuote; positive: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="font-mono text-xs font-semibold">{quote.symbol}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
          positive
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
        }`}
      >
        {fmtPct(quote.change_pct)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FII / DII STRIP
// ─────────────────────────────────────────────────────────────────────────────

function FiiDiiSection() {
  const { data, isPending, isError } = useFiiDii(5);

  if (isError) return null;

  const latest  = data?.data?.[data.data.length - 1];
  const fiiNet  = latest?.fii_net ?? null;
  const diiNet  = latest?.dii_net ?? null;
  const series5 = data?.data?.map((d) => d.fii_net) ?? [];

  return (
    <section aria-labelledby="fiidii-heading">
      <SectionHeader
        id="fiidii-heading"
        title="FII / DII Flows"
        linkTo="/dashboard/markets/fii-dii"
        linkLabel="View full data"
      />

      {isPending ? (
        <div className="h-16 animate-pulse rounded-xl border bg-card" />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            {/* FII stat */}
            <div className="min-w-[100px]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                FII Net (today)
              </p>
              <p
                className={`mt-1 font-mono text-base font-bold tabular-nums ${
                  (fiiNet ?? 0) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400"
                }`}
              >
                {fmtINRCompact(fiiNet)}
              </p>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-border" />

            {/* DII stat */}
            <div className="min-w-[100px]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                DII Net (today)
              </p>
              <p
                className={`mt-1 font-mono text-base font-bold tabular-nums ${
                  (diiNet ?? 0) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400"
                }`}
              >
                {fmtINRCompact(diiNet)}
              </p>
            </div>
          </div>

          {/* 5-day FII sparkline */}
          {series5.length > 1 && (
            <div className="flex flex-col items-end gap-1">
              <p className="text-[10px] text-muted-foreground">5D FII trend</p>
              <MiniSparkline values={series5} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Inline SVG mini-sparkline — no external lib. */
function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 80;
  const H = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const positive = (values[values.length - 1] ?? 0) >= (values[0] ?? 0);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <polyline
        points={pts.join(" ")}
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={positive ? "stroke-emerald-500" : "stroke-rose-500"}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACCESS GRID
// ─────────────────────────────────────────────────────────────────────────────

function QuickAccessSection() {
  const { data: alerts } = usePriceAlerts();
  const { data: calData } = useEconomicCalendar();
  const { data: scannerData } = useScanner(["strong_buy"]);

  const activeAlertCount = alerts?.filter((a) => a.status === "active").length ?? 0;
  const activeBuySignals = scannerData?.total_matched ?? 0;

  const today = new Date().toISOString().slice(0, 10);
  const nextEvent = (calData?.events ?? [])
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextEventLabel = nextEvent
    ? `in ${daysUntil(nextEvent.date)}d`
    : undefined;

  const QUICK_ACCESS = [
    {
      title:       "Portfolios",
      description: "Holdings, NAV and AI briefs",
      path:        "/dashboard/markets/portfolios",
      Icon:        Wallet,
      badge:       undefined as string | undefined,
    },
    {
      title:       "Watchlists",
      description: "Monitor instruments live",
      path:        "/dashboard/markets/watchlists",
      Icon:        Eye,
      badge:       undefined as string | undefined,
    },
    {
      title:       "Market Scanner",
      description: activeBuySignals > 0 ? `${activeBuySignals} buy signals — Scan now` : "Scan NSE for setups",
      path:        "/dashboard/markets/scanner",
      Icon:        Radar,
      badge:       activeBuySignals > 0 ? String(activeBuySignals) : undefined,
    },
    {
      title:       "F&O Chain",
      description: "Live option chain & greeks",
      path:        "/dashboard/markets/fno",
      Icon:        TrendingUp,
      badge:       undefined as string | undefined,
    },
    {
      title:       "Strategy Builder",
      description: "Build and backtest strategies",
      path:        "/dashboard/markets/strategies",
      Icon:        GitBranch,
      badge:       undefined as string | undefined,
    },
    {
      title:       "Mutual Funds",
      description: "Discover, invest & SIP",
      path:        "/dashboard/markets/mf",
      Icon:        PiggyBank,
      badge:       undefined as string | undefined,
    },
    {
      title:       "Price Alerts",
      description: "Get notified on targets",
      path:        "/dashboard/markets/alerts",
      Icon:        Bell,
      badge:       activeAlertCount > 0 ? String(activeAlertCount) : undefined,
    },
    {
      title:       "Economic Calendar",
      description: nextEventLabel ? `Next event ${nextEventLabel}` : "Macro events & earnings",
      path:        "/dashboard/markets/calendar",
      Icon:        CalendarDays,
      badge:       undefined as string | undefined,
    },
    {
      title:       "FII/DII Flows",
      description: "Institutional flow analysis",
      path:        "/dashboard/markets/fii-dii",
      Icon:        BarChart3,
      badge:       undefined as string | undefined,
    },
    {
      title:       "Risk Controls",
      description: "Position sizing & limits",
      path:        "/dashboard/markets/risk",
      Icon:        ShieldAlert,
      badge:       undefined as string | undefined,
    },
    {
      title:       "Broker Accounts",
      description: "Connect brokers for sync",
      path:        "/dashboard/markets/settings/brokers",
      Icon:        Wifi,
      badge:       undefined as string | undefined,
    },
  ];

  return (
    <section aria-labelledby="quickaccess-heading">
      <SectionHeader id="quickaccess-heading" title="Quick Access" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {QUICK_ACCESS.map(({ title, description, path, Icon, badge }) => (
          <Link
            key={path}
            to={path}
            className="group relative flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-primary/10">
                <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              {badge && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {badge}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{title}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR — WATCHLIST PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

function WatchlistSidebar() {
  const watchlists   = useWatchlists();
  const defaultWl    = watchlists.data?.find((w) => w.is_default);
  const detail       = useWatchlist(defaultWl?.id);

  const watchlistSymbols: string[] = (detail.data?.items ?? [])
    .slice(0, 10)
    .map((item) => item.instrument?.symbol)
    .filter((s): s is string => Boolean(s));

  const { data: ltpMap } = useLTP(watchlistSymbols, "NSE");

  const breadth = useMemo(() => {
    const quotes = Object.values(ltpMap ?? {});
    if (quotes.length === 0) return null;
    const up = quotes.filter((q) => (q.change ?? 0) >= 0).length;
    return { up, down: quotes.length - up, total: quotes.length };
  }, [ltpMap]);

  const isLoading = watchlists.isPending || detail.isPending;

  return (
    <section aria-labelledby="watchlist-sidebar-heading">
      <SectionHeader
        id="watchlist-sidebar-heading"
        title={defaultWl ? defaultWl.name : "Watchlist"}
        linkTo={defaultWl ? `/dashboard/markets/watchlists/${defaultWl.id}` : "/dashboard/markets/watchlists"}
        linkLabel="View all"
      />

      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-0">
          {isLoading && (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <WatchlistRowSkeleton key={i} />
              ))}
            </div>
          )}

          {!isLoading && !defaultWl && (
            <div className="px-4 py-8 text-center">
              <Eye className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No default watchlist.</p>
              <Link
                to="/dashboard/markets/watchlists"
                className="mt-1 text-xs text-primary hover:underline"
              >
                Create one
              </Link>
            </div>
          )}

          {!isLoading && defaultWl && (detail.data?.items ?? []).length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">Watchlist is empty.</p>
              <Link
                to={`/dashboard/markets/watchlists/${defaultWl.id}`}
                className="mt-1 text-xs text-primary hover:underline"
              >
                Add instruments
              </Link>
            </div>
          )}

          {!isLoading && defaultWl && (detail.data?.items ?? []).length > 0 && (
            <>
              <div className="max-h-80 divide-y overflow-y-auto">
                {detail.data!.items.slice(0, 10).map((item) => (
                  <WatchlistSidebarRow
                    key={item.id}
                    item={item}
                    quote={
                      item.instrument
                        ? ltpMap?.[item.instrument.symbol]
                        : undefined
                    }
                    watchlistId={defaultWl.id}
                  />
                ))}
              </div>

              {/* Market breadth bar */}
              {breadth && (
                <div className="border-t px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{breadth.up} up · {breadth.down} down</span>
                    <span>{breadth.total} instruments</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-rose-200 dark:bg-rose-950">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${(breadth.up / breadth.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function WatchlistSidebarRow({
  item,
  quote,
  watchlistId,
}: {
  item: WatchlistItem;
  quote: LTPQuote | undefined;
  watchlistId: string;
}) {
  const symbol    = item.instrument?.symbol ?? "—";
  const exchange  = item.instrument?.exchange ?? "";
  const ltp       = quote?.ltp;
  const changePct = quote?.change_pct;
  const positive  = (changePct ?? 0) >= 0;
  const hasData   = ltp != null;

  const inner = (
    <div className="flex h-10 items-center justify-between gap-3 px-4 transition-colors hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-2">
        <span className="font-mono text-xs font-bold">{symbol}</span>
        {exchange && (
          <span className="hidden rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground sm:inline">
            {exchange}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-xs font-semibold tabular-nums">
          {hasData ? `₹${fmtINR(ltp)}` : "—"}
        </span>
        {hasData && (
          <span
            className={`text-[10px] font-medium tabular-nums ${
              positive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-500 dark:text-rose-400"
            }`}
          >
            {fmtPct(changePct)}
          </span>
        )}
      </div>
    </div>
  );

  if (item.instrument?.id) {
    return (
      <Link
        to={`/dashboard/markets/watchlists/${watchlistId}/instrument/${item.instrument.id}`}
        className="block cursor-pointer"
      >
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function WatchlistRowSkeleton() {
  return (
    <div className="flex h-10 animate-pulse items-center justify-between px-4">
      <SkeletonLine className="h-3 w-20" />
      <div className="flex gap-2">
        <SkeletonLine className="h-3 w-14" />
        <SkeletonLine className="h-3 w-10" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR — UPCOMING EVENTS
// ─────────────────────────────────────────────────────────────────────────────

function UpcomingEventsSection() {
  const { data, isPending } = useEconomicCalendar();
  const today = new Date().toISOString().slice(0, 10);

  const upcoming: CalendarEvent[] = (data?.events ?? [])
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  if (!isPending && upcoming.length === 0) return null;

  return (
    <section aria-labelledby="events-heading">
      <SectionHeader
        id="events-heading"
        title="Upcoming Events"
        linkTo="/dashboard/markets/calendar"
        linkLabel="View calendar"
      />

      <Card className="rounded-xl shadow-sm">
        <CardContent className="divide-y p-0">
          {isPending
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
                  <SkeletonLine className="h-2 w-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonLine className="h-3 w-32" />
                    <SkeletonLine className="h-2.5 w-20" />
                  </div>
                  <SkeletonLine className="h-3 w-8" />
                </div>
              ))
            : upcoming.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
        </CardContent>
      </Card>
    </section>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const dotClass =
    event.importance === "high"
      ? "bg-rose-500"
      : event.importance === "medium"
        ? "bg-amber-400"
        : "bg-muted-foreground/40";

  const days = daysUntil(event.date);
  const daysLabel = days === 0 ? "today" : days === 1 ? "tmrw" : `in ${days}d`;

  const dateLabel = new Date(event.date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-xs font-semibold">{event.title}</p>
        <p className="text-[10px] text-muted-foreground">{dateLabel}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {daysLabel}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR — PRICE ALERTS
// ─────────────────────────────────────────────────────────────────────────────

function PriceAlertsSection() {
  const { data: alerts, isPending } = usePriceAlerts();
  const activeAlerts = (alerts ?? []).filter((a) => a.status === "active");

  return (
    <section aria-labelledby="alerts-heading">
      <SectionHeader
        id="alerts-heading"
        title="Price Alerts"
        badge={activeAlerts.length > 0 ? activeAlerts.length : undefined}
        linkTo="/dashboard/markets/alerts"
        linkLabel="View all"
      />

      <Card className="rounded-xl shadow-sm">
        <CardContent className="divide-y p-0">
          {isPending && (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
                <SkeletonLine className="h-3 w-16" />
                <SkeletonLine className="ml-auto h-3 w-24" />
              </div>
            ))
          )}

          {!isPending && activeAlerts.length === 0 && (
            <div className="px-4 py-6 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No active alerts.</p>
              <Link
                to="/dashboard/markets/watchlists"
                className="mt-1 text-xs text-primary hover:underline"
              >
                Set an alert
              </Link>
            </div>
          )}

          {!isPending &&
            activeAlerts.slice(0, 3).map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
        </CardContent>
      </Card>
    </section>
  );
}

function AlertRow({ alert }: { alert: PriceAlert }) {
  const arrow   = alert.condition === "above" ? "↑" : "↓";
  const label   = alert.condition === "above" ? "above" : "below";
  const colored =
    alert.condition === "above"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-500 dark:text-rose-400";

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-mono text-xs font-bold">{alert.symbol}</p>
        <p className={`text-[10px] tabular-nums ${colored}`}>
          {arrow} {label} ₹{fmtINR(alert.trigger_price)}
        </p>
      </div>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
        {alert.exchange}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  id,
  title,
  badge,
  linkTo,
  linkLabel,
}: {
  id: string;
  title: string;
  badge?: number;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between border-b pb-1">
      <div className="flex items-center gap-2">
        <h2
          id={id}
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70"
        >
          {title}
        </h2>
        {badge != null && badge > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {badge}
          </span>
        )}
      </div>
      {linkTo && linkLabel && (
        <Link
          to={linkTo}
          className="flex items-center gap-0.5 text-[11px] text-primary underline-offset-2 hover:underline"
        >
          {linkLabel}
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function EmptyPlaceholder({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-10 text-center">
      <div className="text-muted-foreground/40">{icon}</div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
