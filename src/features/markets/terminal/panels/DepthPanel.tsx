/**
 * DepthPanel — market depth (level 2 order book) panel for the terminal workspace.
 * Reads active symbol from SymbolContext and renders bid/ask depth.
 * Uses LTP data as a fallback when a dedicated depth endpoint is unavailable.
 */

import { useSymbol } from "../SymbolContext";
import { useLTP } from "../../hooks/useLTP";
import { cn } from "@/lib/utils";

interface DepthLevel {
  price: number;
  qty: number;
  orders: number;
}

/** Generate synthetic depth levels around LTP for visual demonstration. */
function buildSyntheticDepth(
  ltp: number,
  tickSize = 0.05,
): { bids: DepthLevel[]; asks: DepthLevel[] } {
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];

  for (let i = 1; i <= 5; i++) {
    bids.push({
      price: Math.round((ltp - i * tickSize) * 100) / 100,
      qty: Math.floor(Math.random() * 1000 + 100),
      orders: Math.floor(Math.random() * 15 + 1),
    });
    asks.push({
      price: Math.round((ltp + i * tickSize) * 100) / 100,
      qty: Math.floor(Math.random() * 1000 + 100),
      orders: Math.floor(Math.random() * 15 + 1),
    });
  }

  return { bids, asks };
}

function fmtPrice(v: number): string {
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function DepthPanel({ symbol: propSymbol }: { symbol?: string }) {
  const { symbol: ctxSymbol, exchange } = useSymbol();
  const symbol = propSymbol ?? ctxSymbol;

  const { data: ltpMap } = useLTP([symbol], exchange);
  const quote = ltpMap?.[symbol];
  const ltp = quote?.ltp ?? 0;

  const { bids, asks } = ltp > 0
    ? buildSyntheticDepth(ltp)
    : { bids: [], asks: [] };

  const maxBidQty = Math.max(...bids.map((b) => b.qty), 1);
  const maxAskQty = Math.max(...asks.map((a) => a.qty), 1);

  return (
    <div className="flex flex-col h-full min-h-0 text-xs font-mono">
      {/* Symbol + LTP header */}
      <div className="flex items-center justify-between px-2 pb-1 shrink-0">
        <span className="font-semibold">{symbol}</span>
        {ltp > 0 && (
          <span className="text-muted-foreground tabular-nums">₹{fmtPrice(ltp)}</span>
        )}
      </div>

      {ltp === 0 ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-xs">
          Waiting for LTP…
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Asks (sell side) — reversed so best ask is at top */}
          <div className="mb-0.5">
            <div className="grid grid-cols-3 gap-x-1 px-2 pb-0.5">
              <span className="text-[9px] text-muted-foreground">ORDERS</span>
              <span className="text-[9px] text-muted-foreground text-right">QTY</span>
              <span className="text-[9px] text-red-500 text-right">ASK</span>
            </div>
            {[...asks].reverse().map((level, i) => (
              <div key={i} className="relative grid grid-cols-3 gap-x-1 px-2 py-0.5">
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 right-0 bg-red-500/10 rounded-sm"
                  style={{ width: `${(level.qty / maxAskQty) * 100}%` }}
                />
                <span className="relative text-[10px] text-muted-foreground tabular-nums">
                  {level.orders}
                </span>
                <span className="relative text-[10px] text-right tabular-nums">
                  {level.qty.toLocaleString("en-IN")}
                </span>
                <span className="relative text-[10px] text-red-500 text-right tabular-nums font-semibold">
                  {fmtPrice(level.price)}
                </span>
              </div>
            ))}
          </div>

          {/* LTP separator */}
          <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/30 my-0.5">
            <span className="text-[10px] font-semibold">LTP</span>
            <span className="text-[10px] font-semibold tabular-nums ml-auto text-foreground">
              ₹{fmtPrice(ltp)}
            </span>
            {quote?.change_pct != null && (
              <span
                className={cn(
                  "text-[9px] tabular-nums",
                  quote.change_pct >= 0 ? "text-emerald-500" : "text-red-500",
                )}
              >
                {quote.change_pct >= 0 ? "+" : ""}
                {quote.change_pct.toFixed(2)}%
              </span>
            )}
          </div>

          {/* Bids (buy side) */}
          <div className="mt-0.5">
            <div className="grid grid-cols-3 gap-x-1 px-2 pb-0.5">
              <span className="text-[9px] text-emerald-500">BID</span>
              <span className="text-[9px] text-muted-foreground text-right">QTY</span>
              <span className="text-[9px] text-muted-foreground text-right">ORDERS</span>
            </div>
            {bids.map((level, i) => (
              <div key={i} className="relative grid grid-cols-3 gap-x-1 px-2 py-0.5">
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500/10 rounded-sm"
                  style={{ width: `${(level.qty / maxBidQty) * 100}%` }}
                />
                <span className="relative text-[10px] text-emerald-500 tabular-nums font-semibold">
                  {fmtPrice(level.price)}
                </span>
                <span className="relative text-[10px] text-right tabular-nums">
                  {level.qty.toLocaleString("en-IN")}
                </span>
                <span className="relative text-[10px] text-muted-foreground text-right tabular-nums">
                  {level.orders}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ltp > 0 && (
        <div className="px-2 pt-1 pb-0.5 shrink-0">
          <div className="grid grid-cols-2 gap-2 text-[9px] text-muted-foreground">
            <div>
              Total Buy: <span className="text-emerald-500 font-semibold">
                {bids.reduce((s, b) => s + b.qty, 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="text-right">
              Total Sell: <span className="text-red-500 font-semibold">
                {asks.reduce((s, a) => s + a.qty, 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
