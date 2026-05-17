/**
 * OrderFormSheet — Slide-out panel for placing broker orders.
 *
 * Supports BUY / SELL for MARKET, LIMIT, SL, SL-M order types with
 * real-time margin display and client-side validation.
 */

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePlanGate } from "@/hooks/usePlanGate";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/design-system";
import {
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import {
  usePlaceOrder,
  useConnectionMargins,
} from "../hooks/useBrokerPortfolio";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderFormSheetProps {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  connectionId:   string;
  connectionName: string;
  brokerName:     string;
  canTrade:       boolean;
  defaultSymbol?:          string;
  defaultExchange?:        string;
  defaultTransactionType?: "BUY" | "SELL";
}

type OrderType   = "MARKET" | "LIMIT" | "SL" | "SL-M";
type ProductType = "CNC" | "MIS" | "NRML";
type Validity    = "DAY" | "IOC";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtINR = (value: number | null | undefined): string => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
};

const PRODUCT_TOOLTIPS: Record<ProductType, string> = {
  CNC:  "Delivery — hold overnight",
  MIS:  "Intraday — squared off at 3:20 PM",
  NRML: "F&O positions held overnight",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderFormSheet({
  open,
  onOpenChange,
  connectionId,
  connectionName,
  canTrade,
  defaultSymbol          = "",
  defaultExchange        = "NSE",
  defaultTransactionType = "BUY",
}: OrderFormSheetProps) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [transactionType, setTransactionType] = useState<"BUY" | "SELL">(defaultTransactionType);
  const [symbol,         setSymbol]           = useState(defaultSymbol.toUpperCase());
  const [exchange,       setExchange]         = useState(defaultExchange);
  const [product,        setProduct]          = useState<ProductType>("CNC");
  const [orderType,      setOrderType]        = useState<OrderType>("MARKET");
  const [quantity,       setQuantity]         = useState<string>("");
  const [price,          setPrice]            = useState<string>("");
  const [triggerPrice,   setTriggerPrice]     = useState<string>("");
  const [validity,       setValidity]         = useState<Validity>("DAY");

  // Re-seed when defaults change (e.g. clicking Buy on a holdings row)
  useEffect(() => {
    if (open) {
      setTransactionType(defaultTransactionType);
      setSymbol(defaultSymbol.toUpperCase());
      setExchange(defaultExchange);
    }
  }, [open, defaultSymbol, defaultExchange, defaultTransactionType]);

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const margins      = useConnectionMargins(connectionId);
  const placeOrder   = usePlaceOrder(connectionId);
  const tradingGate  = usePlanGate("live_trading");
  const navigate     = useNavigate();

  // ── Validation ──────────────────────────────────────────────────────────────
  const showPrice        = orderType === "LIMIT" || orderType === "SL";
  const showTriggerPrice = orderType === "SL" || orderType === "SL-M";

  const validationErrors: string[] = [];
  if (!symbol.trim())                                             validationErrors.push("Symbol is required.");
  if (!quantity || Number(quantity) < 1)                          validationErrors.push("Quantity must be at least 1.");
  if (showPrice && (!price || Number(price) <= 0))                validationErrors.push("Price must be greater than 0.");
  if (showTriggerPrice && (!triggerPrice || Number(triggerPrice) <= 0))
                                                                  validationErrors.push("Trigger price must be greater than 0.");

  const isValid = validationErrors.length === 0 && canTrade && tradingGate.allowed;

  // ── Margin / cost display ───────────────────────────────────────────────────
  const availableCash = margins.data?.available_cash ?? null;
  const estimatedCost: number | null = (() => {
    const qty = Number(quantity);
    if (!qty || qty < 1) return null;
    if (showPrice && price && Number(price) > 0) return qty * Number(price);
    return null; // MARKET — unknown without LTP
  })();

  // ── Reset helpers ───────────────────────────────────────────────────────────
  function resetForm() {
    setSymbol("");
    setExchange("NSE");
    setProduct("CNC");
    setOrderType("MARKET");
    setQuantity("");
    setPrice("");
    setTriggerPrice("");
    setValidity("DAY");
    setTransactionType("BUY");
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!isValid) return;

    placeOrder.mutate(
      {
        tradingsymbol:    symbol.trim().toUpperCase(),
        exchange,
        transaction_type: transactionType,
        order_type:       orderType,
        product,
        quantity:         Number(quantity),
        price:            showPrice ? Number(price) : null,
        trigger_price:    showTriggerPrice ? Number(triggerPrice) : null,
        validity,
      },
      {
        onSuccess: (result) => {
          toast.success(`Order placed — ${result.order_id}`);
          onOpenChange(false);
          resetForm();
        },
        onError: (err) => {
          toast.error(err.message);
        },
      },
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isBuy     = transactionType === "BUY";
  const accentCls = isBuy ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white";

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-[420px] sm:w-[480px] flex flex-col p-0 overflow-hidden"
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>Place Order</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {connectionName}
            </SheetDescription>
          </SheetHeader>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-6">

              {/* Trading disabled warning */}
              {!canTrade && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Trading is not enabled for this connection. Enable it in Settings.
                  </p>
                </div>
              )}

              {/* Plan gate warning — live trading requires upgraded plan */}
              {!tradingGate.allowed && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>Live trading requires an upgraded plan.</span>
                  <Button size="sm" variant="outline" className="ml-auto h-7 text-xs"
                    onClick={() => navigate("/dashboard/billing")}>Upgrade</Button>
                </div>
              )}

              {/* ── Section 1: Transaction type ────────────────────────── */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransactionType("BUY")}
                  className={`rounded-md py-3 text-sm font-semibold transition-colors border ${
                    transactionType === "BUY"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-muted text-muted-foreground border-transparent hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType("SELL")}
                  className={`rounded-md py-3 text-sm font-semibold transition-colors border ${
                    transactionType === "SELL"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-muted text-muted-foreground border-transparent hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                  }`}
                >
                  SELL
                </button>
              </div>

              <Separator />

              {/* ── Section 2: Symbol & Exchange ──────────────────────── */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="order-symbol">Symbol</Label>
                  <Input
                    id="order-symbol"
                    placeholder="e.g. RELIANCE"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="order-exchange">Exchange</Label>
                  <Select value={exchange} onValueChange={setExchange}>
                    <SelectTrigger id="order-exchange">
                      <SelectValue placeholder="Select exchange" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NSE">NSE</SelectItem>
                      <SelectItem value="BSE">BSE</SelectItem>
                      <SelectItem value="NFO">NFO</SelectItem>
                      <SelectItem value="MCX">MCX</SelectItem>
                      <SelectItem value="CDS">CDS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* ── Section 3: Order parameters ───────────────────────── */}
              <div className="space-y-4">

                {/* Product */}
                <div className="space-y-1.5">
                  <Label>Product</Label>
                  <div className="flex gap-2">
                    {(["CNC", "MIS", "NRML"] as ProductType[]).map((p) => (
                      <Tooltip key={p}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setProduct(p)}
                            className={`flex-1 rounded-md py-2 text-xs font-semibold border transition-colors ${
                              product === p
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"
                            }`}
                          >
                            {p}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs max-w-[180px]">
                          {PRODUCT_TOOLTIPS[p]}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                {/* Order type */}
                <div className="space-y-1.5">
                  <Label htmlFor="order-type">Order Type</Label>
                  <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
                    <SelectTrigger id="order-type">
                      <SelectValue placeholder="Select order type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKET">MARKET</SelectItem>
                      <SelectItem value="LIMIT">LIMIT</SelectItem>
                      <SelectItem value="SL">SL</SelectItem>
                      <SelectItem value="SL-M">SL-M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label htmlFor="order-qty">Quantity</Label>
                  <Input
                    id="order-qty"
                    type="number"
                    min={1}
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                {/* Price — only for LIMIT and SL */}
                {showPrice && (
                  <div className="space-y-1.5">
                    <Label htmlFor="order-price">Price (₹)</Label>
                    <Input
                      id="order-price"
                      type="number"
                      min={0}
                      step="0.05"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                )}

                {/* Trigger price — only for SL and SL-M */}
                {showTriggerPrice && (
                  <div className="space-y-1.5">
                    <Label htmlFor="order-trigger">Trigger Price (₹)</Label>
                    <Input
                      id="order-trigger"
                      type="number"
                      min={0}
                      step="0.05"
                      placeholder="0.00"
                      value={triggerPrice}
                      onChange={(e) => setTriggerPrice(e.target.value)}
                    />
                  </div>
                )}

                {/* Validity */}
                <div className="space-y-1.5">
                  <Label htmlFor="order-validity">Validity</Label>
                  <Select value={validity} onValueChange={(v) => setValidity(v as Validity)}>
                    <SelectTrigger id="order-validity">
                      <SelectValue placeholder="Select validity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAY">DAY</SelectItem>
                      <SelectItem value="IOC">IOC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* ── Section 4: Margin summary ──────────────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Margin Summary
                </p>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Available Cash</span>
                      {margins.isLoading ? (
                        <Skeleton className="h-4 w-24" />
                      ) : (
                        <span className="font-medium">{fmtINR(availableCash)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Estimated Cost</span>
                      {margins.isLoading ? (
                        <Skeleton className="h-4 w-20" />
                      ) : (
                        <span className="font-medium">
                          {estimatedCost != null ? fmtINR(estimatedCost) : "—"}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Inline validation errors */}
              {validationErrors.length > 0 && (
                <ul className="space-y-1">
                  {validationErrors.map((err, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                      <span className="mt-0.5">•</span>
                      {err}
                    </li>
                  ))}
                </ul>
              )}

            </div>
          </ScrollArea>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <SheetFooter className="px-6 py-4 border-t gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              className={`flex-1 ${accentCls}`}
              onClick={handleSubmit}
              disabled={!isValid || placeOrder.isPending}
            >
              {placeOrder.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing…
                </>
              ) : (
                <>
                  <Badge
                    variant="outline"
                    className={`mr-2 text-xs border-white/40 text-white ${isBuy ? "bg-emerald-700" : "bg-red-700"}`}
                  >
                    {transactionType}
                  </Badge>
                  Place Order
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
