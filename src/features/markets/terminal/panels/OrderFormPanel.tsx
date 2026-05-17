/**
 * OrderFormPanel — compact order entry panel for the terminal workspace.
 * Reads active symbol from SymbolContext. Provides buy/sell toggle,
 * qty/price fields and a submit button.
 */

import { useState } from "react";
import { useSymbol } from "../SymbolContext";
import { useLTP } from "../../hooks/useLTP";
import { Button, Input, Label } from "@/design-system";
import { cn } from "@/lib/utils";

type OrderSide = "buy" | "sell";
type OrderType = "market" | "limit" | "sl";

export function OrderFormPanel({ symbol: propSymbol }: { symbol?: string }) {
  const { symbol: ctxSymbol, exchange } = useSymbol();
  const symbol = propSymbol ?? ctxSymbol;

  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [trigger, setTrigger] = useState("");

  const { data: ltpMap } = useLTP([symbol], exchange);
  const ltp = ltpMap?.[symbol]?.ltp ?? null;

  // Auto-fill price when switching to limit
  function handleOrderTypeChange(t: OrderType) {
    setOrderType(t);
    if (t === "limit" && !price && ltp != null) {
      setPrice(ltp.toFixed(2));
    }
  }

  return (
    <div className="flex flex-col gap-3 p-2 h-full">
      {/* Symbol display */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono font-bold">{symbol}</span>
        {ltp != null && (
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            ₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {/* Buy / Sell toggle */}
      <div className="grid grid-cols-2 rounded-md overflow-hidden border border-border">
        <button
          onClick={() => setSide("buy")}
          className={cn(
            "py-1.5 text-xs font-semibold transition-colors",
            side === "buy"
              ? "bg-emerald-600 text-white"
              : "bg-muted/40 text-muted-foreground hover:bg-muted",
          )}
        >
          BUY
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn(
            "py-1.5 text-xs font-semibold transition-colors",
            side === "sell"
              ? "bg-red-600 text-white"
              : "bg-muted/40 text-muted-foreground hover:bg-muted",
          )}
        >
          SELL
        </button>
      </div>

      {/* Order type pills */}
      <div className="flex gap-1">
        {(["market", "limit", "sl"] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => handleOrderTypeChange(t)}
            className={cn(
              "flex-1 py-1 rounded text-[10px] font-semibold uppercase transition-colors",
              orderType === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Qty field */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
        <Input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-8 text-sm font-mono"
          placeholder="1"
        />
      </div>

      {/* Price field (hidden for market orders) */}
      {orderType !== "market" && (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Price</Label>
          <Input
            type="number"
            step="0.05"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-8 text-sm font-mono"
            placeholder={ltp?.toFixed(2) ?? "0.00"}
          />
        </div>
      )}

      {/* Trigger price for SL orders */}
      {orderType === "sl" && (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Trigger</Label>
          <Input
            type="number"
            step="0.05"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className="h-8 text-sm font-mono"
            placeholder="0.00"
          />
        </div>
      )}

      {/* Place order button */}
      <Button
        className={cn(
          "w-full h-9 font-semibold mt-auto",
          side === "buy"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "bg-red-600 hover:bg-red-700 text-white",
        )}
        onClick={() => undefined}
      >
        Place {side === "buy" ? "Buy" : "Sell"} Order
      </Button>

      <p className="text-[9px] text-muted-foreground text-center">
        Paper trading mode — no real orders placed
      </p>
    </div>
  );
}
