/**
 * PaperOrderSheet — slide-out panel for placing paper trades.
 *
 * Props: { symbol, exchange, instrumentId, open, onOpenChange }
 *
 * Shows LTP, available paper cash, buy/sell toggle, qty input,
 * computed order value + charges, and executes via usePaperOrder.
 */

import { useState, useEffect } from "react";
import { FlaskConical, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/design-system";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { useLTP } from "../hooks/useLTP";
import { usePaperCapital, usePaperOrder, useSeedPaperPortfolio } from "../hooks/usePaperTrading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaperOrderSheetProps {
  symbol:        string;
  exchange:      string;
  instrumentId:  string;
  portfolioId:   string;
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeCharges(tradeValue: number): number {
  const raw = tradeValue * 0.001;
  return Math.round(Math.min(Math.max(raw, 20), 100) * 100) / 100;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PaperOrderSheet({
  symbol,
  exchange,
  instrumentId,
  portfolioId,
  open,
  onOpenChange,
}: PaperOrderSheetProps) {
  const [side, setSide]   = useState<"buy" | "sell">("buy");
  const [qty,  setQty]    = useState<string>("1");

  const ltpQuery    = useLTP(symbol ? [symbol] : [], exchange);
  const capitalQuery = usePaperCapital(portfolioId);
  const placeOrder  = usePaperOrder();
  const seedPortfolio = useSeedPaperPortfolio();

  // Reset qty when sheet opens or symbol changes
  useEffect(() => {
    if (open) {
      setQty("1");
      setSide("buy");
    }
  }, [open, symbol]);

  const ltp      = ltpQuery.data?.[symbol]?.ltp ?? null;
  const qtyNum   = parseInt(qty, 10);
  const validQty = !isNaN(qtyNum) && qtyNum > 0;

  const tradeValue    = ltp != null && validQty ? ltp * qtyNum : null;
  const charges       = tradeValue != null ? computeCharges(tradeValue) : null;
  const totalCost     = tradeValue != null && charges != null ? tradeValue + charges : null;
  const totalProceeds = tradeValue != null && charges != null ? tradeValue - charges : null;

  const availableCash   = capitalQuery.data?.available_cash ?? null;
  const insufficientCash =
    side === "buy" &&
    totalCost != null &&
    availableCash != null &&
    availableCash < totalCost;

  const canSubmit =
    validQty &&
    ltp != null &&
    !insufficientCash &&
    !placeOrder.isPending &&
    capitalQuery.isSuccess;

  const handleSeed = async () => {
    try {
      const result = await seedPortfolio.mutateAsync({ portfolio_id: portfolioId });
      toast.success(result.message);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to seed paper capital");
    }
  };

  const handleSubmit = async () => {
    if (!validQty || ltp == null) return;
    try {
      const result = await placeOrder.mutateAsync({
        portfolio_id:  portfolioId,
        instrument_id: instrumentId,
        symbol,
        exchange,
        txn_type: side,
        qty: qtyNum,
      });
      toast.success(`Paper order filled at ₹${fmtINR(result.fill_price)}`, {
        description: `Remaining cash: ₹${fmtINR(result.remaining_cash)}`,
      });
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Paper order failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-500" />
            Paper Trade · {symbol}
            <Badge className="ml-auto bg-amber-500 text-white hover:bg-amber-600 text-xs font-semibold tracking-wide">
              PAPER
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* LTP */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Current LTP · {exchange}
            </p>
            {ltpQuery.isPending ? (
              <Skeleton className="h-7 w-28" />
            ) : ltp != null ? (
              <p className="text-2xl font-bold tabular-nums">₹{fmtINR(ltp)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Price unavailable</p>
            )}
            {ltpQuery.data?.[symbol]?.change_pct != null && (
              <p
                className={`text-xs mt-0.5 tabular-nums ${
                  (ltpQuery.data[symbol].change_pct ?? 0) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                }`}
              >
                {(ltpQuery.data[symbol].change_pct ?? 0) >= 0 ? "+" : ""}
                {ltpQuery.data[symbol].change_pct?.toFixed(2)}% today
              </p>
            )}
          </div>

          {/* Paper cash balance */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-0.5 font-medium">
              Available paper cash
            </p>
            {capitalQuery.isPending ? (
              <Skeleton className="h-5 w-32" />
            ) : capitalQuery.isError ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">No paper capital yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSeed}
                  disabled={seedPortfolio.isPending}
                  className="h-7 text-xs"
                >
                  {seedPortfolio.isPending ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <FlaskConical className="mr-1.5 h-3 w-3" />
                  )}
                  Seed ₹10,00,000 paper capital
                </Button>
              </div>
            ) : (
              <p className="font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                ₹{fmtINR(availableCash ?? 0)}
              </p>
            )}
          </div>

          <Separator />

          {/* Buy / Sell toggle */}
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Side
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide("buy")}
                className={`rounded-md border py-2 text-sm font-semibold transition-colors ${
                  side === "buy"
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setSide("sell")}
                className={`rounded-md border py-2 text-sm font-semibold transition-colors ${
                  side === "sell"
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          {/* Qty input */}
          <div>
            <Label htmlFor="paper-qty" className="mb-1.5 block">
              Quantity (shares)
            </Label>
            <Input
              id="paper-qty"
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="1"
            />
          </div>

          {/* Order value breakdown */}
          {ltp != null && validQty && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trade value</span>
                <span className="tabular-nums font-medium">
                  ₹{fmtINR(tradeValue ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. charges</span>
                <span className="tabular-nums text-muted-foreground">
                  + ₹{fmtINR(charges ?? 0)}
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>{side === "buy" ? "Total cost" : "Net proceeds"}</span>
                <span className="tabular-nums">
                  ₹{fmtINR(side === "buy" ? (totalCost ?? 0) : (totalProceeds ?? 0))}
                </span>
              </div>
            </div>
          )}

          {/* Insufficient cash warning */}
          {insufficientCash && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Insufficient paper cash. Need ₹{fmtINR(totalCost ?? 0)} but only ₹
                {fmtINR(availableCash ?? 0)} available.
              </span>
            </div>
          )}

          {/* Execute button */}
          <Button
            className="w-full"
            disabled={!canSubmit || capitalQuery.isError}
            onClick={handleSubmit}
          >
            {placeOrder.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing…
              </>
            ) : (
              <>
                <FlaskConical className="mr-2 h-4 w-4" />
                Execute Paper Trade
              </>
            )}
          </Button>

          {/* Disclaimer */}
          <p className="text-center text-xs text-muted-foreground">
            Paper trading — no real money involved
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
