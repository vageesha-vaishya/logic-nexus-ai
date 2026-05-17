/**
 * GTTFormSheet — right-side sheet for creating GTT (Good Till Triggered) orders.
 *
 * Supports two trigger types:
 *   - Single: one leg, any transaction type
 *   - OCO (One Cancels Other): upper take-profit + lower stop-loss pair
 */

import { useState, useEffect } from "react";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/design-system";

import { useCreateGtt, type CreateGTTInput } from "../hooks/useBrokerPortfolio";

// ── Props ─────────────────────────────────────────────────────────────────────

interface GTTFormSheetProps {
  open:             boolean;
  onOpenChange:     (v: boolean) => void;
  connectionId:     string;
  connectionName:   string;
  brokerName:       string;
  defaultSymbol?:   string;
  defaultExchange?: string;
  defaultLtp?:      number;
  defaultQty?:      number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtINR = (v: number | string) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function GTTFormSheet({
  open,
  onOpenChange,
  connectionId,
  connectionName,
  brokerName,
  defaultSymbol  = "",
  defaultExchange = "NSE",
  defaultLtp     = 0,
  defaultQty     = 1,
}: GTTFormSheetProps) {
  const createGtt = useCreateGtt(connectionId);

  // ── Single GTT state
  const [sSymbol,          setSSymbol]          = useState(defaultSymbol.toUpperCase());
  const [sExchange,        setSExchange]        = useState(defaultExchange);
  const [sLtp,             setSLtp]             = useState(defaultLtp > 0 ? String(defaultLtp) : "");
  const [sSide,            setSSide]            = useState<"BUY" | "SELL">("SELL");
  const [sTriggerPrice,    setSTriggerPrice]    = useState("");
  const [sLimitPrice,      setSLimitPrice]      = useState("");
  const [sQty,             setSQty]             = useState(defaultQty > 0 ? String(defaultQty) : "1");
  const [sProduct,         setSProduct]         = useState("CNC");

  // ── OCO state
  const [oSymbol,          setOSymbol]          = useState(defaultSymbol.toUpperCase());
  const [oExchange,        setOExchange]        = useState(defaultExchange);
  const [oLtp,             setOLtp]             = useState(defaultLtp > 0 ? String(defaultLtp) : "");
  const [oQty,             setOQty]             = useState(defaultQty > 0 ? String(defaultQty) : "1");
  const [oProduct,         setOProduct]         = useState("CNC");
  const [oUpperTrigger,    setOUpperTrigger]    = useState("");
  const [oUpperPrice,      setOUpperPrice]      = useState("");
  const [oUpperSide,       setOUpperSide]       = useState<"BUY" | "SELL">("SELL");
  const [oLowerTrigger,    setOLowerTrigger]    = useState("");
  const [oLowerPrice,      setOLowerPrice]      = useState("");
  const [oLowerSide,       setOLowerSide]       = useState<"BUY" | "SELL">("SELL");

  const [errors,           setErrors]           = useState<Record<string, string>>({});

  // Sync defaults when props change (e.g. opened from different holding rows)
  useEffect(() => {
    setSSymbol(defaultSymbol.toUpperCase());
    setSExchange(defaultExchange);
    setSLtp(defaultLtp > 0 ? String(defaultLtp) : "");
    setSQty(defaultQty > 0 ? String(defaultQty) : "1");
    setOSymbol(defaultSymbol.toUpperCase());
    setOExchange(defaultExchange);
    setOLtp(defaultLtp > 0 ? String(defaultLtp) : "");
    setOQty(defaultQty > 0 ? String(defaultQty) : "1");
    setErrors({});
  }, [defaultSymbol, defaultExchange, defaultLtp, defaultQty, open]);

  // ── Validation ────────────────────────────────────────────────────────────

  function validateSingle(): boolean {
    const e: Record<string, string> = {};
    if (!sSymbol.trim())                      e.sSymbol = "Symbol is required";
    if (parseInt(sQty, 10) < 1)               e.sQty = "Quantity must be at least 1";
    if (parseFloat(sTriggerPrice) <= 0)       e.sTrigger = "Trigger price must be > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateOco(): boolean {
    const e: Record<string, string> = {};
    const ltp    = parseFloat(oLtp);
    const upper  = parseFloat(oUpperTrigger);
    const lower  = parseFloat(oLowerTrigger);

    if (!oSymbol.trim())                     e.oSymbol = "Symbol is required";
    if (parseInt(oQty, 10) < 1)              e.oQty = "Quantity must be at least 1";
    if (upper <= 0)                          e.oUpperTrigger = "Upper trigger must be > 0";
    if (lower <= 0)                          e.oLowerTrigger = "Lower trigger must be > 0";
    if (!isNaN(ltp) && ltp > 0) {
      if (upper <= ltp || lower >= ltp) {
        e.oOco = "Take profit must be above LTP; stop loss must be below LTP";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmitSingle() {
    if (!validateSingle()) return;

    const input: CreateGTTInput = {
      tradingsymbol:    sSymbol.trim().toUpperCase(),
      exchange:         sExchange,
      ltp:              parseFloat(sLtp) || 0,
      trigger_type:     "single",
      transaction_type: sSide,
      quantity:         parseInt(sQty, 10),
      trigger_price:    parseFloat(sTriggerPrice),
      price:            sLimitPrice ? parseFloat(sLimitPrice) : parseFloat(sTriggerPrice),
      product:          sProduct,
      order_type:       "LIMIT",
    };

    createGtt.mutate(input, {
      onSuccess: () => {
        toast.success("GTT order set — will trigger when price is reached");
        onOpenChange(false);
        resetForm();
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function handleSubmitOco() {
    if (!validateOco()) return;

    const input: CreateGTTInput = {
      tradingsymbol:           oSymbol.trim().toUpperCase(),
      exchange:                oExchange,
      ltp:                     parseFloat(oLtp) || 0,
      trigger_type:            "oco",
      quantity:                parseInt(oQty, 10),
      product:                 oProduct,
      upper_trigger_price:     parseFloat(oUpperTrigger),
      upper_price:             oUpperPrice ? parseFloat(oUpperPrice) : parseFloat(oUpperTrigger),
      upper_quantity:          parseInt(oQty, 10),
      upper_transaction_type:  oUpperSide,
      lower_trigger_price:     parseFloat(oLowerTrigger),
      lower_price:             oLowerPrice ? parseFloat(oLowerPrice) : parseFloat(oLowerTrigger),
      lower_quantity:          parseInt(oQty, 10),
      lower_transaction_type:  oLowerSide,
    };

    createGtt.mutate(input, {
      onSuccess: () => {
        toast.success("GTT order set — will trigger when price is reached");
        onOpenChange(false);
        resetForm();
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function resetForm() {
    setSTriggerPrice(""); setSLimitPrice(""); setErrors({});
    setOUpperTrigger(""); setOUpperPrice(""); setOLowerTrigger(""); setOLowerPrice("");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[460px] max-w-full flex flex-col overflow-y-auto"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Set GTT Order</SheetTitle>
          <SheetDescription>
            {connectionName}
            <Badge variant="outline" className="ml-2 text-[10px] capitalize">{brokerName}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <Tabs defaultValue="single">
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1">Single</TabsTrigger>
              <TabsTrigger value="oco"    className="flex-1">OCO</TabsTrigger>
            </TabsList>

            {/* ── Single GTT ─────────────────────────────────────────── */}
            <TabsContent value="single" className="space-y-4 mt-4">

              {/* Symbol + Exchange */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="s-symbol">Symbol</Label>
                  <Input
                    id="s-symbol"
                    placeholder="RELIANCE"
                    value={sSymbol}
                    onChange={(e) => setSSymbol(e.target.value.toUpperCase())}
                    className={errors.sSymbol ? "border-destructive" : ""}
                  />
                  {errors.sSymbol && <p className="text-[11px] text-destructive">{errors.sSymbol}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-exchange">Exchange</Label>
                  <Select value={sExchange} onValueChange={setSExchange}>
                    <SelectTrigger id="s-exchange">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NSE">NSE</SelectItem>
                      <SelectItem value="BSE">BSE</SelectItem>
                      <SelectItem value="NFO">NFO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* LTP */}
              <div className="space-y-1.5">
                <Label htmlFor="s-ltp">Current LTP</Label>
                <Input
                  id="s-ltp"
                  placeholder="0.00"
                  value={sLtp}
                  onChange={(e) => setSLtp(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {sLtp && parseFloat(sLtp) > 0
                    ? `Current price: ${fmtINR(parseFloat(sLtp))}`
                    : "Enter last traded price"}
                </p>
              </div>

              {/* Transaction type */}
              <div className="space-y-1.5">
                <Label>Transaction Type</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSSide("BUY")}
                    className={`flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors ${
                      sSide === "BUY"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-input bg-background hover:bg-muted"
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setSSide("SELL")}
                    className={`flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors ${
                      sSide === "SELL"
                        ? "bg-red-600 text-white border-red-600"
                        : "border-input bg-background hover:bg-muted"
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>

              {/* Trigger price */}
              <div className="space-y-1.5">
                <Label htmlFor="s-trigger">Trigger Price (₹)</Label>
                <Input
                  id="s-trigger"
                  type="number"
                  min="0"
                  step="0.05"
                  placeholder="0.00"
                  value={sTriggerPrice}
                  onChange={(e) => setSTriggerPrice(e.target.value)}
                  className={errors.sTrigger ? "border-destructive" : ""}
                />
                <p className="text-[11px] text-muted-foreground">
                  Order fires when LTP crosses this price
                </p>
                {errors.sTrigger && <p className="text-[11px] text-destructive">{errors.sTrigger}</p>}
              </div>

              {/* Limit price */}
              <div className="space-y-1.5">
                <Label htmlFor="s-limit">Limit Price (₹)</Label>
                <Input
                  id="s-limit"
                  type="number"
                  min="0"
                  step="0.05"
                  placeholder={sTriggerPrice || "0.00"}
                  value={sLimitPrice}
                  onChange={(e) => setSLimitPrice(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Usually same as trigger price for market orders
                </p>
              </div>

              {/* Quantity + Product */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="s-qty">Quantity</Label>
                  <Input
                    id="s-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={sQty}
                    onChange={(e) => setSQty(e.target.value)}
                    className={errors.sQty ? "border-destructive" : ""}
                  />
                  {errors.sQty && <p className="text-[11px] text-destructive">{errors.sQty}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-product">Product</Label>
                  <Select value={sProduct} onValueChange={setSProduct}>
                    <SelectTrigger id="s-product">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNC">CNC</SelectItem>
                      <SelectItem value="MIS">MIS</SelectItem>
                      <SelectItem value="NRML">NRML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Info card */}
              {sSymbol && sTriggerPrice && parseInt(sQty, 10) >= 1 && (
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="flex gap-2 p-3">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      When LTP hits {fmtINR(parseFloat(sTriggerPrice) || 0)}, a{" "}
                      <strong>{sSide}</strong> order for <strong>{sQty} shares</strong> of{" "}
                      <strong>{sSymbol}</strong> at{" "}
                      {fmtINR(parseFloat(sLimitPrice || sTriggerPrice) || 0)} will be placed automatically.
                    </p>
                  </CardContent>
                </Card>
              )}

              <SheetFooter className="flex flex-row gap-2 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={createGtt.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={handleSubmitSingle}
                  disabled={createGtt.isPending}
                >
                  {createGtt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Set GTT
                </Button>
              </SheetFooter>
            </TabsContent>

            {/* ── OCO GTT ────────────────────────────────────────────── */}
            <TabsContent value="oco" className="space-y-4 mt-4">

              {/* Symbol + Exchange */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-symbol">Symbol</Label>
                  <Input
                    id="o-symbol"
                    placeholder="RELIANCE"
                    value={oSymbol}
                    onChange={(e) => setOSymbol(e.target.value.toUpperCase())}
                    className={errors.oSymbol ? "border-destructive" : ""}
                  />
                  {errors.oSymbol && <p className="text-[11px] text-destructive">{errors.oSymbol}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-exchange">Exchange</Label>
                  <Select value={oExchange} onValueChange={setOExchange}>
                    <SelectTrigger id="o-exchange">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NSE">NSE</SelectItem>
                      <SelectItem value="BSE">BSE</SelectItem>
                      <SelectItem value="NFO">NFO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* LTP */}
              <div className="space-y-1.5">
                <Label htmlFor="o-ltp">Current LTP</Label>
                <Input
                  id="o-ltp"
                  placeholder="0.00"
                  value={oLtp}
                  onChange={(e) => setOLtp(e.target.value)}
                />
                {oLtp && parseFloat(oLtp) > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Current price: {fmtINR(parseFloat(oLtp))}
                  </p>
                )}
              </div>

              {/* Shared qty + product */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-qty">Quantity</Label>
                  <Input
                    id="o-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={oQty}
                    onChange={(e) => setOQty(e.target.value)}
                    className={errors.oQty ? "border-destructive" : ""}
                  />
                  {errors.oQty && <p className="text-[11px] text-destructive">{errors.oQty}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-product">Product</Label>
                  <Select value={oProduct} onValueChange={setOProduct}>
                    <SelectTrigger id="o-product">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNC">CNC</SelectItem>
                      <SelectItem value="MIS">MIS</SelectItem>
                      <SelectItem value="NRML">NRML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Take profit leg */}
              <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">
                      Take Profit
                    </p>
                    <div className="flex gap-1.5">
                      {(["BUY", "SELL"] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setOUpperSide(side)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                            oUpperSide === side
                              ? side === "BUY"
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-red-600 text-white border-red-600"
                              : "border-input bg-background hover:bg-muted"
                          }`}
                        >
                          {side}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Trigger Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.05"
                        placeholder="0.00"
                        value={oUpperTrigger}
                        onChange={(e) => setOUpperTrigger(e.target.value)}
                        className={`h-8 text-sm ${errors.oUpperTrigger ? "border-destructive" : ""}`}
                      />
                      <p className="text-[10px] text-muted-foreground">Above current LTP for SELL</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Limit Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.05"
                        placeholder={oUpperTrigger || "0.00"}
                        value={oUpperPrice}
                        onChange={(e) => setOUpperPrice(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {errors.oUpperTrigger && <p className="text-[11px] text-destructive">{errors.oUpperTrigger}</p>}
                </CardContent>
              </Card>

              {/* Stop loss leg */}
              <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-400 uppercase tracking-wide">
                      Stop Loss
                    </p>
                    <div className="flex gap-1.5">
                      {(["BUY", "SELL"] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setOLowerSide(side)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                            oLowerSide === side
                              ? side === "BUY"
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-red-600 text-white border-red-600"
                              : "border-input bg-background hover:bg-muted"
                          }`}
                        >
                          {side}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Trigger Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.05"
                        placeholder="0.00"
                        value={oLowerTrigger}
                        onChange={(e) => setOLowerTrigger(e.target.value)}
                        className={`h-8 text-sm ${errors.oLowerTrigger ? "border-destructive" : ""}`}
                      />
                      <p className="text-[10px] text-muted-foreground">Below current LTP for SELL</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Limit Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.05"
                        placeholder={oLowerTrigger || "0.00"}
                        value={oLowerPrice}
                        onChange={(e) => setOLowerPrice(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {errors.oLowerTrigger && <p className="text-[11px] text-destructive">{errors.oLowerTrigger}</p>}
                </CardContent>
              </Card>

              {/* OCO validation error */}
              {errors.oOco && (
                <p className="text-[11px] text-destructive font-medium">{errors.oOco}</p>
              )}

              {/* OCO preview */}
              {oSymbol && oUpperTrigger && oLowerTrigger && parseInt(oQty, 10) >= 1 && (
                <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                  <CardContent className="flex gap-2 p-3">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                      If LTP hits {fmtINR(parseFloat(oUpperTrigger) || 0)},{" "}
                      {oUpperSide.toLowerCase()}s <strong>{oQty} shares</strong> at{" "}
                      {fmtINR(parseFloat(oUpperPrice || oUpperTrigger) || 0)}.
                      {" "}If LTP hits {fmtINR(parseFloat(oLowerTrigger) || 0)},{" "}
                      {oLowerSide.toLowerCase()}s <strong>{oQty} shares</strong> at{" "}
                      {fmtINR(parseFloat(oLowerPrice || oLowerTrigger) || 0)}.
                    </p>
                  </CardContent>
                </Card>
              )}

              <SheetFooter className="flex flex-row gap-2 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={createGtt.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={handleSubmitOco}
                  disabled={createGtt.isPending}
                >
                  {createGtt.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Set GTT
                </Button>
              </SheetFooter>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
