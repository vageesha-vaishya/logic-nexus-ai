/**
 * OrderFormSheet — Slide-out panel for placing broker orders.
 *
 * Supports BUY / SELL for MARKET, LIMIT, SL, SL-M order types with
 * real-time margin display and client-side validation.
 *
 * Order modes:
 *   Regular — standard single-leg order (original behaviour)
 *   Bracket — entry + target (take-profit) + stop-loss in one ticket
 *   Cover   — market entry with mandatory stop-loss
 */

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Lock, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePlanGate } from "@/hooks/usePlanGate";
import { useTradingMode } from "@/hooks/useTradingMode";

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
  type OrderMode,
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

const ORDER_MODE_LABELS: Record<OrderMode, string> = {
  regular: "Regular",
  bracket: "Bracket",
  cover:   "Cover",
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

  // Bracket / Cover extension fields
  const [orderMode,      setOrderMode]        = useState<OrderMode>("regular");
  const [bracketTarget,  setBracketTarget]    = useState<string>("");
  const [bracketSl,      setBracketSl]        = useState<string>("");

  // Re-seed when defaults change (e.g. clicking Buy on a holdings row)
  useEffect(() => {
    if (open) {
      setTransactionType(defaultTransactionType);
      setSymbol(defaultSymbol.toUpperCase());
      setExchange(defaultExchange);
      setOrderMode("regular");
      setBracketTarget("");
      setBracketSl("");
    }
  }, [open, defaultSymbol, defaultExchange, defaultTransactionType]);

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const margins      = useConnectionMargins(connectionId);
  const placeOrder   = usePlaceOrder(connectionId);
  const tradingGate  = usePlanGate("live_trading");
  const navigate     = useNavigate();
  const [tradingMode, setTradingMode] = useTradingMode();
  const isNovice = tradingMode === "novice";

  // ── Derived values ───────────────────────────────────────────────────────
  const showPrice        = orderMode === "regular" && (orderType === "LIMIT" || orderType === "SL");
  const showTriggerPrice = orderMode === "regular" && (orderType === "SL" || orderType === "SL-M");

  const entryPrice = Number(price) > 0 ? Number(price) : null;
  const qty        = Number(quantity) >= 1 ? Number(quantity) : null;
  const target     = Number(bracketTarget) > 0 ? Number(bracketTarget) : null;
  const sl         = Number(bracketSl) > 0 ? Number(bracketSl) : null;

  // P&L preview (bracket mode)
  const maxProfit = qty && target && entryPrice
    ? qty * (transactionType === "BUY" ? target - entryPrice : entryPrice - target)
    : null;
  const maxLoss = qty && sl && entryPrice
    ? qty * Math.abs(entryPrice - sl)
    : null;
  const rrRatio = maxProfit && maxLoss && maxLoss > 0
    ? (maxProfit / maxLoss).toFixed(2)
    : null;

  // Cover risk
  const coverRisk = qty && sl && entryPrice
    ? qty * Math.abs(entryPrice - sl)
    : null;

  // ── Validation ──────────────────────────────────────────────────────────────
  const validationErrors: string[] = [];
  if (!symbol.trim())                                                       validationErrors.push("Symbol is required.");
  if (!quantity || Number(quantity) < 1)                                    validationErrors.push("Quantity must be at least 1.");
  if (showPrice && (!price || Number(price) <= 0))                          validationErrors.push("Price must be greater than 0.");
  if (showTriggerPrice && (!triggerPrice || Number(triggerPrice) <= 0))     validationErrors.push("Trigger price must be greater than 0.");

  if (orderMode === "bracket") {
    if (!price || Number(price) <= 0)                                       validationErrors.push("Entry price is required for Bracket orders.");
    if (!bracketTarget || Number(bracketTarget) <= 0)                       validationErrors.push("Target price is required.");
    if (!bracketSl || Number(bracketSl) <= 0)                               validationErrors.push("Stop loss is required.");
    if (entryPrice && target && sl) {
      if (transactionType === "BUY") {
        if (target <= entryPrice)  validationErrors.push("BUY bracket: Target must be above entry price.");
        if (sl >= entryPrice)      validationErrors.push("BUY bracket: Stop loss must be below entry price.");
      } else {
        if (target >= entryPrice)  validationErrors.push("SELL bracket: Target must be below entry price.");
        if (sl <= entryPrice)      validationErrors.push("SELL bracket: Stop loss must be above entry price.");
      }
    }
  }

  if (orderMode === "cover") {
    if (!bracketSl || Number(bracketSl) <= 0) validationErrors.push("Stop loss is required for Cover orders.");
  }

  const isValid = validationErrors.length === 0 && canTrade && tradingGate.allowed;

  // ── Margin / cost display ───────────────────────────────────────────────────
  const availableCash = margins.data?.available_cash ?? null;
  const estimatedCost: number | null = (() => {
    if (!qty || qty < 1) return null;
    if (orderMode === "bracket" && entryPrice) return qty * entryPrice;
    if (showPrice && price && Number(price) > 0) return qty * Number(price);
    return null;
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
    setOrderMode("regular");
    setBracketTarget("");
    setBracketSl("");
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!isValid) return;

    const isBracket = orderMode === "bracket";
    const isCover   = orderMode === "cover";

    placeOrder.mutate(
      {
        tradingsymbol:    symbol.trim().toUpperCase(),
        exchange,
        transaction_type: transactionType,
        // Bracket forces LIMIT entry; Cover forces MARKET
        order_type:       isBracket ? "LIMIT" : isCover ? "MARKET" : orderType,
        product,
        quantity:         Number(quantity),
        price:            isBracket ? Number(price) : showPrice ? Number(price) : null,
        trigger_price:    showTriggerPrice ? Number(triggerPrice) : null,
        validity,
        order_mode:       orderMode,
        ...(isBracket && {
          bracket_target: Number(bracketTarget),
          bracket_sl:     Number(bracketSl),
        }),
        ...(isCover && {
          bracket_sl: Number(bracketSl),
        }),
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

              {/* ── Novice mode hint ──────────────────────────────────── */}
              {isNovice && (
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">ℹ</span>
                  <span>
                    Switch to{" "}
                    <button
                      type="button"
                      className="underline font-semibold"
                      onClick={() => setTradingMode("expert")}
                    >
                      Expert mode
                    </button>
                    {" "}to access bracket orders and limit prices.
                  </span>
                </div>
              )}

              {/* ── Order mode toggle: Regular | Bracket | Cover ───────── */}
              {!isNovice && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Order Mode</Label>
                  <div className="flex gap-1.5">
                    {(["regular", "bracket", "cover"] as OrderMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setOrderMode(mode);
                          setBracketTarget("");
                          setBracketSl("");
                        }}
                        className={`flex-1 rounded-md py-2 text-xs font-semibold border transition-colors ${
                          orderMode === mode
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"
                        }`}
                      >
                        {ORDER_MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                  {orderMode === "bracket" && (
                    <p className="text-[11px] text-muted-foreground">
                      Single ticket: entry limit + take-profit + stop-loss legs.
                    </p>
                  )}
                  {orderMode === "cover" && (
                    <p className="text-[11px] text-muted-foreground">
                      Market entry with a mandatory stop-loss. Higher leverage allowed.
                    </p>
                  )}
                </div>
              )}

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

                {/* Order type — hidden for bracket/cover (forced by mode); hidden in novice */}
                {!isNovice && orderMode === "regular" && (
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
                )}

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

                {/* Entry price — LIMIT for regular LIMIT/SL, or bracket entry */}
                {(showPrice || orderMode === "bracket") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="order-price">
                      {orderMode === "bracket" ? "Entry Price (₹)" : "Price (₹)"}
                    </Label>
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

                {/* Trigger price — only for regular SL and SL-M */}
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

                {/* ── Bracket-only: Target + SL ────────────────────────── */}
                {orderMode === "bracket" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="bracket-target">
                        Target Price (₹){" "}
                        <span className="text-xs text-muted-foreground">
                          {isBuy ? "above entry" : "below entry"}
                        </span>
                      </Label>
                      <Input
                        id="bracket-target"
                        type="number"
                        min={0}
                        step="0.05"
                        placeholder="0.00"
                        value={bracketTarget}
                        onChange={(e) => setBracketTarget(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bracket-sl">
                        Stop Loss (₹){" "}
                        <span className="text-xs text-muted-foreground">
                          {isBuy ? "below entry" : "above entry"}
                        </span>
                      </Label>
                      <Input
                        id="bracket-sl"
                        type="number"
                        min={0}
                        step="0.05"
                        placeholder="0.00"
                        value={bracketSl}
                        onChange={(e) => setBracketSl(e.target.value)}
                      />
                    </div>

                    {/* P&L preview card */}
                    {(maxProfit !== null || maxLoss !== null) && (
                      <Card className="border-0 bg-muted/50">
                        <CardContent className="p-3 space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Risk / Reward Preview
                          </p>
                          {maxProfit !== null && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-3 w-3" />
                                Max Profit
                              </span>
                              <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {fmtINR(maxProfit)}{" "}
                                <span className="text-[10px] text-muted-foreground">
                                  ↑ to {fmtINR(target)}
                                </span>
                              </span>
                            </div>
                          )}
                          {maxLoss !== null && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                                <TrendingDown className="h-3 w-3" />
                                Max Loss
                              </span>
                              <span className="font-semibold tabular-nums text-red-500 dark:text-red-400">
                                {fmtINR(maxLoss)}{" "}
                                <span className="text-[10px] text-muted-foreground">
                                  ↓ to {fmtINR(sl)}
                                </span>
                              </span>
                            </div>
                          )}
                          {rrRatio !== null && (
                            <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
                              <span className="text-muted-foreground font-medium">R:R Ratio</span>
                              <span className={`font-bold tabular-nums ${
                                Number(rrRatio) >= 2
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : Number(rrRatio) >= 1
                                    ? "text-amber-500"
                                    : "text-red-500"
                              }`}>
                                {rrRatio} : 1
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* ── Cover-only: SL ────────────────────────────────────── */}
                {orderMode === "cover" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="cover-sl">
                        Stop Loss (₹) <span className="text-destructive text-xs">required</span>
                      </Label>
                      <Input
                        id="cover-sl"
                        type="number"
                        min={0}
                        step="0.05"
                        placeholder="0.00"
                        value={bracketSl}
                        onChange={(e) => setBracketSl(e.target.value)}
                      />
                    </div>
                    {coverRisk !== null && (
                      <div className="flex items-center justify-between rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs">
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <TrendingDown className="h-3 w-3" />
                          Max Risk
                        </span>
                        <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                          {fmtINR(coverRisk)}
                        </span>
                      </div>
                    )}
                  </>
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
                  Place {orderMode !== "regular" ? ORDER_MODE_LABELS[orderMode] : ""} Order
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
