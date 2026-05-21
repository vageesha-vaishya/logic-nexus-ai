/**
 * SthiraTradeSheet — bottom-sheet quick-trade form for the Sthira mobile app.
 *
 * Flow:
 *   1. User taps the Trade FAB (in MobileShell, only when ≥1 broker has
 *      can_trade=true). The host opens this sheet.
 *   2. User fills symbol, qty, buy/sell. Defaults: MARKET / CNC / DAY.
 *      Limit price input appears when order_type="LIMIT".
 *   3. Submit calls `requireBiometric` (real Face ID / fingerprint via
 *      @aparajita/capacitor-biometric-auth; pass-through on web). On
 *      success, calls `usePlaceOrder(connectionId)` against the worker.
 *   4. Success → toast + close sheet; error → inline message, sheet stays
 *      so the user can adjust and retry.
 *
 * PR 4 scope: single broker assumption (uses the user's first active
 * broker connection). PR 4.1 will add broker-picker chip when ≥2 active
 * brokers exist.
 *
 * Brand: cream sheet, copper primary action, sage/terracotta for the
 * BUY/SELL toggle. Serif numerals for the price/qty inputs.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { requireBiometric } from "@/lib/biometric";
import {
  PlaceOrderInput,
  usePlaceOrder,
} from "@/features/markets/hooks/useBrokerPortfolio";
import { useBrokerConnections } from "@/features/markets/hooks/useBrokerConnections";

export interface SthiraTradeSheetProps {
  open: boolean;
  onClose: () => void;
}

type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

export function SthiraTradeSheet({ open, onClose }: SthiraTradeSheetProps) {
  // Pick the user's first trade-enabled broker. Multi-broker selector
  // lands in PR 4.1.
  const connections = useBrokerConnections();
  const activeBroker = useMemo(
    () => (connections.data ?? []).find((c) => c.status === "active" && c.can_trade) ?? null,
    [connections.data],
  );
  const placeOrder = usePlaceOrder(activeBroker?.id ?? "");

  const [symbol, setSymbol]       = useState("");
  const [exchange, setExchange]   = useState<"NSE" | "BSE">("NSE");
  const [side, setSide]           = useState<Side>("BUY");
  const [qty, setQty]             = useState<string>("");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [price, setPrice]         = useState<string>("");
  const [product, setProduct]     = useState<"CNC" | "MIS">("CNC");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const reset = () => {
    setSymbol("");
    setExchange("NSE");
    setSide("BUY");
    setQty("");
    setOrderType("MARKET");
    setPrice("");
    setProduct("CNC");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canSubmit =
    Boolean(activeBroker) &&
    symbol.trim().length > 0 &&
    Number(qty) > 0 &&
    (orderType === "MARKET" || Number(price) > 0) &&
    !submitting;

  async function handleSubmit() {
    if (!activeBroker) {
      setError("No active broker. Connect one from the Brokers page.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Native biometric gate (pass-through on web). Per addendum §2 this
      // is a local re-confirmation, not a fresh sign-in.
      const bio = await requireBiometric({
        reason: `Confirm ${side} ${qty} ${symbol.toUpperCase()}`,
      });
      if (!bio.ok) {
        setError(bio.message);
        return;
      }

      const payload: PlaceOrderInput = {
        tradingsymbol:    symbol.trim().toUpperCase(),
        exchange,
        transaction_type: side,
        order_type:       orderType,
        product,
        quantity:         Number(qty),
        validity:         "DAY",
      };
      if (orderType === "LIMIT") payload.price = Number(price);

      const res = await placeOrder.mutateAsync(payload);
      toast.success(`Order placed`, {
        description: `${res.order_id} · ${res.status}`,
      });
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="bottom"
        className="bg-sthira-cream text-sthira-ink font-sthiraSans rounded-t-2xl border-t border-sthira-navy/15 max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-sthiraSerif text-2xl">Place a trade</SheetTitle>
          <SheetDescription>
            {activeBroker
              ? `Routing via ${activeBroker.display_name}`
              : "No active broker — connect one first."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          {/* Buy / Sell toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["BUY", "SELL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                disabled={submitting}
                className={cn(
                  "py-3 rounded-lg text-sm font-medium border transition-colors",
                  side === s
                    ? s === "BUY"
                      ? "bg-sthira-sage/15 border-sthira-sage text-sthira-sage"
                      : "bg-sthira-terracotta/15 border-sthira-terracotta text-sthira-terracotta"
                    : "border-sthira-navy/15 text-sthira-fog hover:text-sthira-ink",
                )}
                aria-pressed={side === s}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="trade-symbol">Symbol</Label>
              <Input
                id="trade-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. HDFCBANK"
                autoCapitalize="characters"
                spellCheck={false}
                autoComplete="off"
                className="font-sthiraSerif tracking-wide"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trade-exchange">Exchange</Label>
              <Select value={exchange} onValueChange={(v) => setExchange(v as "NSE" | "BSE")}>
                <SelectTrigger id="trade-exchange"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trade-qty">Quantity</Label>
              <Input
                id="trade-qty"
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                className="font-sthiraSerif tabular-nums text-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trade-order-type">Order type</Label>
              <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
                <SelectTrigger id="trade-order-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKET">Market</SelectItem>
                  <SelectItem value="LIMIT">Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {orderType === "LIMIT" && (
            <div className="space-y-1.5">
              <Label htmlFor="trade-price">Limit price (₹)</Label>
              <Input
                id="trade-price"
                type="number"
                inputMode="decimal"
                step={0.05}
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="font-sthiraSerif tabular-nums"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="trade-product">Product</Label>
            <Select value={product} onValueChange={(v) => setProduct(v as "CNC" | "MIS")}>
              <SelectTrigger id="trade-product"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CNC">CNC — Delivery</SelectItem>
                <SelectItem value="MIS">MIS — Intraday</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-sthira-fog">
              CNC settles to your demat. MIS auto-squares off at end of day.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-sthira-terracotta/10 border border-sthira-terracotta/30 px-3 py-2 text-xs text-sthira-terracotta">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn(
                "flex-1 text-sthira-cream",
                side === "BUY"
                  ? "bg-sthira-sage hover:bg-sthira-sage/90"
                  : "bg-sthira-terracotta hover:bg-sthira-terracotta/90",
              )}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Authorising…</>
              ) : (
                `${side} ${symbol ? symbol.toUpperCase() : ""}`
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
