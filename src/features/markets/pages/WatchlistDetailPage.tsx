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
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Eye,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

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

export default function WatchlistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const watchlist = useWatchlist(id);

  return (
    <DashboardLayout>
    <div className="mx-auto max-w-7xl space-y-6 p-6">
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <ItemsTable
                watchlistId={watchlist.data.id}
                items={watchlist.data.items}
              />
            </div>
            <aside>
              <NewsPanel limit={10} />
            </aside>
          </div>
        </>
      )}
    </div>
    </DashboardLayout>
  );
}

// ─── Items table ───────────────────────────────────────────────────────

function ItemsTable({
  watchlistId,
  items,
}: {
  watchlistId: string;
  items: import("../types").WatchlistItem[];
}) {
  const remove = useRemoveWatchlistItem(watchlistId);

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Instruments</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Exchange</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const inst = item.instrument;
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
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {inst?.exchange ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">
                    {inst?.instrument_type ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-sm text-muted-foreground">
                    {item.note ?? <span className="italic">—</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(item.added_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
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
