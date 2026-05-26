/**
 * Markets — watchlist detail page.
 *
 * Route: /dashboard/markets/watchlists/:id
 *
 * Shows the items on a watchlist as a table + an instrument-picker popover
 * for adding new ones. The picker uses the same Command-in-Popover pattern
 * we built for the OpenRouter model selector — local search hits the
 * `markets-watchlists?path=search-instruments` endpoint.
 */

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSthiraShell } from "@/hooks/use-sthira-shell";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  Bell,
  Check,
  ChevronsUpDown,
  Eye,
  Loader2,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PriceAlertSheet } from "../components/PriceAlertSheet";
import { SignalBadge } from "../components/SignalBadge";
import { type LTPQuote } from "../hooks/useLTP";
import { useWebSocketLTP } from "../hooks/useWebSocketLTP";
import { useSignalSummary } from "../hooks/useSignals";
import { isMarketOpen } from "../utils/market-hours";

import {
  useAddWatchlistItem,
  useInstrumentSearch,
  useRemoveWatchlistItem,
  useWatchlist,
} from "../hooks/useWatchlists";
import { NewsPanel } from "../components/NewsPanel";
import { formatDateTime } from "@/lib/format";

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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { QuickTradeButton } from "../components/QuickTradeButton";

export default function WatchlistDetailPage() {
  // Sthira mobile shell: skip DashboardLayout, narrow container, drop the
  // NewsPanel rail. The ItemsTable already collapses some columns at md/sm
  // breakpoints; the mobile card-stack reflow is a follow-up commit.
  const isSthiraShell = useSthiraShell();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const watchlist = useWatchlist(id);

  const content = (
    <div className={`mx-auto ${isSthiraShell ? "max-w-2xl" : "max-w-7xl"} space-y-6 ${isSthiraShell ? "p-4" : "p-6"}`}>
      <div>
        <button
          onClick={() => navigate("/dashboard/markets/watchlists")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All watchlists
        </button>
      </div>

      {watchlist.isPending && (
        <div className="space-y-4">
          <SkeletonCard withHeader lines={2} />
          <SkeletonCard lines={5} />
        </div>
      )}

      {watchlist.isError && (
        <ErrorState
          title="Failed to load watchlist"
          message={watchlist.error?.message ?? "Unknown error"}
          onRetry={() => watchlist.refetch()}
        />
      )}

      {watchlist.isSuccess && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                {watchlist.data.name}
                {watchlist.data.is_default && (
                  <Badge variant="default" className="text-xs">
                    Default
                  </Badge>
                )}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {watchlist.data.items.length}{" "}
                {watchlist.data.items.length === 1 ? "instrument" : "instruments"} · created{" "}
                {formatDateTime(watchlist.data.created_at)}
              </p>
            </div>
            <AddItemPicker watchlistId={watchlist.data.id} />
          </header>

          <div className={isSthiraShell ? "min-w-0" : "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"}>
            <div className="min-w-0">
              <ItemsTable
                watchlistId={watchlist.data.id}
                items={watchlist.data.items}
              />
            </div>
            {!isSthiraShell && (
              <aside>
                <NewsPanel limit={10} />
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (isSthiraShell) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}

// ─── Items table ───────────────────────────────────────────────────────

function fmtINR(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function PriceCell({ quote }: { quote: LTPQuote | undefined }) {
  if (!quote || quote.ltp == null) return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  return <TableCell className="text-right font-mono font-medium">₹{fmtINR(quote.ltp)}</TableCell>;
}

function ChangeCell({ quote }: { quote: LTPQuote | undefined }) {
  if (!quote || quote.change == null || quote.change_pct == null) {
    return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  }
  const positive = quote.change >= 0;
  const color = positive ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <TableCell className={`text-right font-mono text-sm ${color}`}>
      <span className="inline-flex items-center justify-end gap-1">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {positive ? "+" : ""}
        {fmtINR(quote.change)} ({positive ? "+" : ""}
        {quote.change_pct.toFixed(2)}%)
      </span>
    </TableCell>
  );
}

function ItemsTable({
  watchlistId,
  items,
}: {
  watchlistId: string;
  items: import("../types").WatchlistItem[];
}) {
  // Sthira mobile shell uses a card stack instead of the 8-column
  // table — touch-sized actions, no horizontal scroll.
  const isSthiraShell = useSthiraShell();
  const remove = useRemoveWatchlistItem(watchlistId);
  const marketOpen = isMarketOpen();
  const [alertSheet, setAlertSheet] = useState<{ symbol: string; exchange: string; ltp: number | null } | null>(null);

  const nseSymbols = items
    .map((i) => i.instrument?.symbol)
    .filter((s): s is string => Boolean(s));

  const { data: ltpMap, connected: wsConnected, isWebSocket } = useWebSocketLTP(nseSymbols);
  const isFetching = !isWebSocket && nseSymbols.length > 0;
  const { data: signalMap } = useSignalSummary(nseSymbols);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={<Eye className="h-10 w-10" />}
            title="No instruments yet"
            description="Use the picker above to add your first instrument. Search by NSE/BSE symbol or ISIN."
          />
        </CardContent>
      </Card>
    );
  }

  const onRemove = async (itemId: string, symbol: string | undefined) => {
    if (!confirm(`Remove ${symbol ?? "this instrument"} from the watchlist?`)) return;
    try {
      await remove.mutateAsync(itemId);
      toast.success("Removed from watchlist");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove");
    }
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Instruments</CardTitle>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {marketOpen ? (
            wsConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live (WS)
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live (polling)
              </>
            )
          ) : (
            <>
              <Activity className="h-3 w-3" />
              Market closed
            </>
          )}
          {isFetching && <Loader2 className="ml-1 h-3 w-3 animate-spin" aria-hidden="true" />}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        {isSthiraShell ? (
          /* Mobile card stack — symbol + price + change + actions per card.
              Signal/High/Low/Type are omitted on mobile; tap the symbol to
              open the instrument detail for the full view. */
          <div className="space-y-2 p-3">
            {items.map((item) => {
              const inst = item.instrument;
              const quote = inst?.symbol ? ltpMap?.[inst.symbol] : undefined;
              const positive = (quote?.change ?? 0) >= 0;
              return (
                <div key={item.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {inst ? (
                        <Link
                          to={`/dashboard/markets/instruments/${inst.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {inst.symbol}
                        </Link>
                      ) : (
                        <span className="font-mono text-sm text-muted-foreground">unknown</span>
                      )}
                      {item.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.note}</p>
                      )}
                    </div>
                    <SignalBadge signal={inst?.symbol ? signalMap?.[inst.symbol] : undefined} size="sm" />
                  </div>
                  <div className="flex items-end justify-between gap-2 tabular-nums">
                    <span className="font-mono text-base font-semibold">
                      {quote?.ltp != null ? `₹${fmtINR(quote.ltp)}` : "—"}
                    </span>
                    {quote?.change != null && quote?.change_pct != null && (
                      <span className={`text-xs font-medium ${positive ? "text-sthira-sage" : "text-sthira-terracotta"}`}>
                        {positive ? "+" : ""}{fmtINR(quote.change)} · {positive ? "+" : ""}{quote.change_pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {inst?.symbol && (
                      <QuickTradeButton
                        symbol={inst.symbol}
                        exchange={inst.exchange ?? "NSE"}
                        size="sm"
                      />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => setAlertSheet({ symbol: inst?.symbol ?? "", exchange: inst?.exchange ?? "NSE", ltp: quote?.ltp ?? null })}
                      disabled={!inst?.symbol}
                      aria-label="Set price alert"
                    >
                      <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 ml-auto text-destructive hover:text-destructive"
                      onClick={() => onRemove(item.id, inst?.symbol)}
                      disabled={remove.isPending}
                      aria-label="Remove from watchlist"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">LTP</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="hidden xl:table-cell">Signal</TableHead>
              <TableHead className="text-right hidden md:table-cell">High</TableHead>
              <TableHead className="text-right hidden md:table-cell">Low</TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const inst = item.instrument;
              const quote = inst?.symbol ? ltpMap?.[inst.symbol] : undefined;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium">
                    {inst ? (
                      <Link
                        to={`/dashboard/markets/instruments/${inst.id}`}
                        className="hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {inst.symbol}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">unknown</span>
                    )}
                    {item.note && (
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground truncate max-w-[14ch]">
                        {item.note}
                      </p>
                    )}
                  </TableCell>
                  <PriceCell quote={quote} />
                  <ChangeCell quote={quote} />
                  <TableCell className="hidden xl:table-cell">
                    <SignalBadge signal={inst?.symbol ? signalMap?.[inst.symbol] : undefined} size="sm" />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                    {quote?.high != null ? `₹${fmtINR(quote.high)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                    {quote?.low != null ? `₹${fmtINR(quote.low)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground hidden lg:table-cell">
                    {inst?.instrument_type ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {inst?.symbol && (
                        <QuickTradeButton
                          symbol={inst.symbol}
                          exchange={inst.exchange ?? "NSE"}
                          size="sm"
                        />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAlertSheet({ symbol: inst?.symbol ?? "", exchange: inst?.exchange ?? "NSE", ltp: quote?.ltp ?? null })}
                        disabled={!inst?.symbol}
                      >
                        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">Set alert</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(item.id, inst?.symbol)}
                        disabled={remove.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>

    {alertSheet && (
      <PriceAlertSheet
        symbol={alertSheet.symbol}
        exchange={alertSheet.exchange}
        currentLtp={alertSheet.ltp}
        open={Boolean(alertSheet)}
        onOpenChange={(o) => !o && setAlertSheet(null)}
      />
    )}
    </>
  );
}

// ─── Instrument picker (Popover + Command, debounced search) ──────────

function AddItemPicker({ watchlistId }: { watchlistId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useInstrumentSearch(query);
  const add = useAddWatchlistItem(watchlistId);

  // Drop trailing empty option text to avoid an awkward "no match" flash before
  // the user has typed anything substantive.
  const showResults = useMemo(() => query.trim().length > 0, [query]);

  const onPick = async (instrumentId: string, symbol: string) => {
    try {
      await add.mutateAsync({ instrument_id: instrumentId });
      toast.success(`Added ${symbol}`);
      setQuery("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add instrument
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[24rem] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by symbol or ISIN…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-80">
            {!showResults && (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Search className="h-4 w-4" aria-hidden="true" />
                Type at least one character to search.
              </div>
            )}
            {showResults && search.isPending && (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Searching instruments…
              </div>
            )}
            {showResults && search.isError && (
              <div className="space-y-2 p-4 text-sm">
                <p className="text-destructive">Search failed.</p>
                <p className="text-xs text-muted-foreground">
                  {(search.error as Error)?.message ?? "Unknown error"}
                </p>
                <Button size="sm" variant="outline" onClick={() => search.refetch()}>
                  Retry
                </Button>
              </div>
            )}
            {showResults && search.isSuccess && (
              <>
                <CommandEmpty>
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No instruments matched "{query}".
                  </div>
                </CommandEmpty>
                {search.data.length > 0 && (
                  <CommandGroup>
                    {search.data.map((inst) => (
                      <CommandItem
                        key={inst.id}
                        value={inst.id}
                        onSelect={() => onPick(inst.id, inst.symbol)}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="font-mono text-sm">{inst.symbol}</span>
                          <Badge variant="secondary" className="text-xs">
                            {inst.exchange}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span className="capitalize">{inst.instrument_type}</span>
                          {inst.isin && <span className="font-mono">{inst.isin}</span>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
