/**
 * WatchlistPanel — compact watchlist for the terminal workspace.
 * Shows the default watchlist with LTP and change% in a dense table.
 * Symbol click syncs all linked panels via SymbolContext.
 */

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useWatchlists, useWatchlist } from "../../hooks/useWatchlists";
import { useLTP } from "../../hooks/useLTP";
import { useSymbol } from "../SymbolContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function WatchlistPanel() {
  const { symbol: activeSymbol, setSymbol } = useSymbol();
  const { data: watchlists, isLoading: listsLoading } = useWatchlists();

  // Use the first default watchlist, or first available
  const defaultWatchlist = watchlists?.find((w) => w.is_default) ?? watchlists?.[0];
  const { data: watchlistDetail, isLoading: detailLoading } = useWatchlist(defaultWatchlist?.id);

  // Items can be missing from a partial response; default to [] so the
  // map/length/etc. downstream don't crash.
  const items = Array.isArray(watchlistDetail?.items) ? watchlistDetail.items : [];
  const symbols = items
    .map((item) => item.instrument?.symbol)
    .filter((s): s is string => Boolean(s));

  const { data: ltpMap, isLoading: ltpLoading } = useLTP(symbols);

  const isLoading = listsLoading || detailLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 p-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full rounded" />
        ))}
      </div>
    );
  }

  if (!defaultWatchlist || !watchlistDetail) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-4 text-center">
        No watchlist found. Create one in Watchlists.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Watchlist name */}
      <div className="flex items-center justify-between px-2 pb-1 shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {defaultWatchlist.name}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {symbols.length} symbols
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-1 px-2 pb-0.5 shrink-0">
        <span className="text-[9px] text-muted-foreground font-medium">SYMBOL</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right">LTP</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right w-16">CHG%</span>
      </div>

      {/* Scrollable rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {items.map((item) => {
          const sym = item.instrument?.symbol;
          if (!sym) return null;
          const quote = ltpMap?.[sym];
          const changePct = quote?.change_pct ?? null;
          const isUp = changePct != null && changePct > 0;
          const isDown = changePct != null && changePct < 0;
          const isActive = activeSymbol === sym;

          return (
            <button
              key={item.id}
              onClick={() => setSymbol(sym, item.instrument?.exchange ?? "NSE")}
              className={cn(
                "w-full grid grid-cols-[1fr_auto_auto] gap-x-1 px-2 py-1 rounded transition-colors text-left",
                isActive
                  ? "bg-primary/15 text-foreground"
                  : "hover:bg-muted/50 text-foreground",
              )}
            >
              <span className="text-xs font-mono font-medium truncate">{sym}</span>
              <span className="text-xs font-mono tabular-nums text-right">
                {ltpLoading ? "…" : fmtPrice(quote?.ltp ?? null)}
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono tabular-nums text-right w-16 flex items-center justify-end gap-0.5",
                  isUp ? "text-emerald-500" : isDown ? "text-red-500" : "text-muted-foreground",
                )}
              >
                {isUp && <ArrowUpRight className="h-3 w-3 shrink-0" />}
                {isDown && <ArrowDownRight className="h-3 w-3 shrink-0" />}
                {ltpLoading ? "…" : fmtPct(changePct)}
              </span>
            </button>
          );
        })}

        {items.length === 0 && (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            Watchlist is empty
          </div>
        )}
      </div>
    </div>
  );
}
