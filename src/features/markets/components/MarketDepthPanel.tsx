/**
 * Level 2 market depth panel — classic bid/ask order book layout.
 *
 * Props: { symbol: string, exchange?: string }
 *
 * Layout:
 *   BIDS              ASKS
 *   Qty    Price     Price   Qty
 *   2,345  1,336.40  1,336.50  1,200
 *   ...
 *
 * - Green background bars for bids, red for asks
 * - Bar width proportional to qty vs max qty in the book
 * - Total bid/ask quantity ratio bar at bottom
 * - "Simulated" badge when real depth is unavailable
 * - Dimmed outside market hours
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import { Badge } from "@/design-system";
import { Loader2 } from "lucide-react";
import { type DepthLevel, useMarketDepth } from "../hooks/useMarketDepth";
import { isMarketOpen } from "../utils/market-hours";
import { cn } from "@/lib/utils";

interface MarketDepthPanelProps {
  symbol: string;
  exchange?: string;
}

function fmtPrice(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtQty(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

interface LevelRowProps {
  level: DepthLevel;
  maxQty: number;
  side: "bid" | "ask";
  marketClosed: boolean;
}

function LevelRow({ level, maxQty, side, marketClosed }: LevelRowProps) {
  const pct = maxQty > 0 ? (level.qty / maxQty) * 100 : 0;
  const isBid = side === "bid";

  return (
    <tr
      className={cn(
        "relative text-sm",
        marketClosed && "opacity-50",
      )}
    >
      {/* Bid side: qty left, price right */}
      {isBid && (
        <>
          <td className="relative w-1/2 overflow-hidden py-1 pr-3 text-right font-mono text-xs text-foreground">
            {/* Green bar grows from right */}
            <span
              className="absolute inset-y-0 right-0 bg-emerald-500/15 dark:bg-emerald-500/20"
              style={{ width: `${pct}%` }}
              aria-hidden="true"
            />
            <span className="relative">{fmtQty(level.qty)}</span>
          </td>
          <td className="py-1 pl-3 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400">
            {fmtPrice(level.price)}
          </td>
        </>
      )}

      {/* Ask side: price left, qty right */}
      {!isBid && (
        <>
          <td className="py-1 pr-3 text-left font-mono font-medium text-rose-600 dark:text-rose-400">
            {fmtPrice(level.price)}
          </td>
          <td className="relative w-1/2 overflow-hidden py-1 pl-3 text-left font-mono text-xs text-foreground">
            {/* Red bar grows from left */}
            <span
              className="absolute inset-y-0 left-0 bg-rose-500/15 dark:bg-rose-500/20"
              style={{ width: `${pct}%` }}
              aria-hidden="true"
            />
            <span className="relative">{fmtQty(level.qty)}</span>
          </td>
        </>
      )}
    </tr>
  );
}

export function MarketDepthPanel({ symbol, exchange = "NSE" }: MarketDepthPanelProps) {
  const { data, isPending, isError } = useMarketDepth(symbol, exchange);
  const marketClosed = !isMarketOpen();

  const maxQty = data
    ? Math.max(
        ...data.bids.map((b) => b.qty),
        ...data.asks.map((a) => a.qty),
        1,
      )
    : 1;

  const bidRatioPct =
    data && data.total_bid_qty + data.total_ask_qty > 0
      ? (data.total_bid_qty / (data.total_bid_qty + data.total_ask_qty)) * 100
      : 50;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Market Depth</CardTitle>
        <div className="flex items-center gap-2">
          {data?.is_simulated && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
              Simulated
            </Badge>
          )}
          {isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
          {marketClosed && (
            <span className="text-xs text-muted-foreground">Market closed</span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isError && (
          <p className="text-sm text-muted-foreground">
            Unable to load market depth.
          </p>
        )}

        {!isError && data && (
          <>
            {/* Column headers */}
            <div className="mb-1 grid grid-cols-2 gap-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <div className="flex justify-between pr-3">
                <span>Qty (B)</span>
                <span>Bid</span>
              </div>
              <div className="flex justify-between pl-3">
                <span>Ask</span>
                <span>Qty (A)</span>
              </div>
            </div>

            {/* Bid / Ask rows side-by-side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Bids */}
              <table className="w-full table-fixed">
                <tbody>
                  {data.bids.map((level, i) => (
                    <LevelRow
                      key={i}
                      level={level}
                      maxQty={maxQty}
                      side="bid"
                      marketClosed={marketClosed}
                    />
                  ))}
                </tbody>
              </table>

              {/* Asks */}
              <table className="w-full table-fixed">
                <tbody>
                  {data.asks.map((level, i) => (
                    <LevelRow
                      key={i}
                      level={level}
                      maxQty={maxQty}
                      side="ask"
                      marketClosed={marketClosed}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total qty ratio bar */}
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {fmtQty(data.total_bid_qty)} bid
                </span>
                <span className="text-rose-600 dark:text-rose-400">
                  ask {fmtQty(data.total_ask_qty)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-rose-200 dark:bg-rose-900/40">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${bidRatioPct}%` }}
                  aria-label={`Bid pressure: ${bidRatioPct.toFixed(1)}%`}
                />
              </div>
            </div>

            {/* LTP reference */}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              LTP ₹{fmtPrice(data.ltp)}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
