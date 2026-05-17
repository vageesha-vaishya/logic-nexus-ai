/**
 * MfOrderSheet — Slide-out sheet for placing mutual fund orders.
 *
 * Supports Buy (Lump Sum) / SIP / Redeem tabs.
 * Width: 440px. Uses the same workerFetch/auth pattern as OrderFormSheet.
 */

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/design-system";
import { Separator } from "@/components/ui/separator";
import {
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Sheet,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  usePlaceMfOrder,
  type MfFund,
  type MfFundDetail,
  type MfHolding,
} from "../hooks/useMf";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MfOrderSheetProps {
  open:              boolean;
  onOpenChange:      (v: boolean) => void;
  fund:              MfFundDetail | MfFund | null;
  connectionId:      string;
  connectionName:    string;
  defaultOrderType?: "PURCHASE" | "REDEMPTION" | "SIP";
  holding?:          MfHolding | null;
}

type TabKey = "buy" | "sip" | "redeem";

type RedeemMode = "units" | "amount";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtINR = (value: number | null | undefined): string => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
};

const fmtNav = (value: number | null | undefined): string => {
  if (value == null) return "—";
  return `₹${value.toFixed(4)}`;
};

function orderTypeToTab(ot: "PURCHASE" | "REDEMPTION" | "SIP"): TabKey {
  if (ot === "REDEMPTION") return "redeem";
  if (ot === "SIP")        return "sip";
  return "buy";
}

const SIP_DATES = Array.from({ length: 28 }, (_, i) => i + 1);

// ── Component ─────────────────────────────────────────────────────────────────

export function MfOrderSheet({
  open,
  onOpenChange,
  fund,
  connectionId,
  connectionName,
  defaultOrderType = "PURCHASE",
  holding = null,
}: MfOrderSheetProps) {
  const [activeTab,    setActiveTab]    = useState<TabKey>(orderTypeToTab(defaultOrderType));

  // Buy form state
  const [buyAmount,    setBuyAmount]    = useState<string>("");
  const [buyFolio,     setBuyFolio]     = useState<string>("new");
  const [buyFolioText, setBuyFolioText] = useState<string>("");

  // SIP form state
  const [sipAmount,    setSipAmount]    = useState<string>("");
  const [sipDate,      setSipDate]      = useState<string>("1");
  const [sipFolio,     setSipFolio]     = useState<string>("new");
  const [sipFolioText, setSipFolioText] = useState<string>("");

  // Redeem form state
  const [redeemMode,   setRedeemMode]   = useState<RedeemMode>("units");
  const [redeemUnits,  setRedeemUnits]  = useState<string>("");
  const [redeemAmount, setRedeemAmount] = useState<string>("");

  const placeMfOrder = usePlaceMfOrder();

  // Re-seed tab when defaultOrderType changes (e.g. clicking different buttons)
  useEffect(() => {
    if (open) {
      setActiveTab(orderTypeToTab(defaultOrderType));
      // Pre-fill redemption units if holding provided
      if (defaultOrderType === "REDEMPTION" && holding) {
        setRedeemUnits(holding.qty > 0 ? String(holding.qty) : "");
      }
    }
  }, [open, defaultOrderType, holding]);

  function resetAll() {
    setBuyAmount("");
    setBuyFolio("new");
    setBuyFolioText("");
    setSipAmount("");
    setSipDate("1");
    setSipFolio("new");
    setSipFolioText("");
    setRedeemMode("units");
    setRedeemUnits("");
    setRedeemAmount("");
  }

  const currentNav   = fund?.current_nav ?? null;
  const schemeName   = fund?.scheme_name ?? fund?.metadata?.scheme_name ?? "—";
  const amfiCode     = fund?.symbol ?? "";
  const isin         = fund?.isin ?? "";

  // ── Estimated unit hints ──────────────────────────────────────────────────────

  const buyEstUnits: string | null = (() => {
    const amt = Number(buyAmount);
    if (!amt || !currentNav || currentNav <= 0) return null;
    return (amt / currentNav).toFixed(4);
  })();

  const sipEstUnits: string | null = (() => {
    const amt = Number(sipAmount);
    if (!amt || !currentNav || currentNav <= 0) return null;
    return (amt / currentNav).toFixed(4);
  })();

  const redeemEstValue: string | null = (() => {
    if (redeemMode === "units") {
      const units = Number(redeemUnits);
      if (!units || !currentNav || currentNav <= 0) return null;
      return fmtINR(units * currentNav);
    } else {
      const amt = Number(redeemAmount);
      if (!amt || !currentNav || currentNav <= 0) return null;
      const units = (amt / currentNav).toFixed(4);
      return `≈ ${units} units`;
    }
  })();

  // ── Submit handlers ───────────────────────────────────────────────────────────

  function handleBuy() {
    const amt = Number(buyAmount);
    if (!amt || amt < 500) { toast.error("Minimum investment amount is ₹500."); return; }
    if (!amfiCode)         { toast.error("Fund details not loaded yet."); return; }

    const folio = buyFolio === "new" ? null : (buyFolioText.trim() || null);

    placeMfOrder.mutate(
      {
        connection_id: connectionId,
        amfi_code:     amfiCode,
        isin:          isin,
        scheme_name:   schemeName,
        order_type:    "PURCHASE",
        amount:        amt,
        folio_number:  folio,
      },
      {
        onSuccess: () => {
          toast.success("Order placed successfully");
          onOpenChange(false);
          resetAll();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleSip() {
    const amt = Number(sipAmount);
    if (!amt || amt < 500) { toast.error("Minimum SIP amount is ₹500."); return; }
    if (!amfiCode)         { toast.error("Fund details not loaded yet."); return; }

    const folio = sipFolio === "new" ? null : (sipFolioText.trim() || null);

    placeMfOrder.mutate(
      {
        connection_id: connectionId,
        amfi_code:     amfiCode,
        isin:          isin,
        scheme_name:   schemeName,
        order_type:    "SIP",
        sip_amount:    amt,
        sip_date:      Number(sipDate),
        folio_number:  folio,
      },
      {
        onSuccess: () => {
          toast.success("Order placed successfully");
          onOpenChange(false);
          resetAll();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleRedeem() {
    if (!amfiCode) { toast.error("Fund details not loaded yet."); return; }

    const units  = redeemMode === "units"  ? Number(redeemUnits)  : undefined;
    const amount = redeemMode === "amount" ? Number(redeemAmount) : undefined;

    if (redeemMode === "units" && (!units || units <= 0)) {
      toast.error("Enter units to redeem.");
      return;
    }
    if (redeemMode === "amount" && (!amount || amount <= 0)) {
      toast.error("Enter amount to redeem.");
      return;
    }
    if (redeemMode === "units" && holding && units! > holding.qty) {
      toast.error(`You only hold ${holding.qty} units.`);
      return;
    }

    placeMfOrder.mutate(
      {
        connection_id: connectionId,
        amfi_code:     amfiCode,
        isin:          isin,
        scheme_name:   schemeName,
        order_type:    "REDEMPTION",
        units:         units ?? null,
        amount:        amount ?? null,
        folio_number:  holding?.folio_number ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Order placed successfully");
          onOpenChange(false);
          resetAll();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[440px] sm:w-[440px] flex flex-col p-0 overflow-hidden"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-base">Mutual Fund Order</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {connectionName}
          </SheetDescription>
        </SheetHeader>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">

            {/* Fund name + NAV */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fund</p>
              <p className="text-sm font-medium leading-snug line-clamp-2">{schemeName}</p>
              <p className="text-xs text-muted-foreground">
                Current NAV: <span className="font-mono">{fmtNav(currentNav)}</span>
                {fund?.nav_date && (
                  <span> · as of {fund.nav_date}</span>
                )}
              </p>
            </div>

            <Separator />

            {/* ── Tabs ─────────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
              <TabsList className="w-full">
                <TabsTrigger value="buy"    className="flex-1">Buy (Lump Sum)</TabsTrigger>
                <TabsTrigger value="sip"    className="flex-1">SIP</TabsTrigger>
                <TabsTrigger value="redeem" className="flex-1">Redeem</TabsTrigger>
              </TabsList>

              {/* ── Buy tab ────────────────────────────────────────── */}
              <TabsContent value="buy" className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mf-buy-amount">Investment Amount (₹)</Label>
                  <Input
                    id="mf-buy-amount"
                    type="number"
                    min={500}
                    step={100}
                    placeholder="e.g. 5000"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                  />
                  {buyEstUnits && (
                    <p className="text-xs text-muted-foreground">
                      Estimated units: <span className="font-mono">{buyEstUnits}</span>
                    </p>
                  )}
                </div>

                {/* Folio */}
                <div className="space-y-1.5">
                  <Label htmlFor="mf-buy-folio-type">Folio</Label>
                  <Select value={buyFolio} onValueChange={setBuyFolio}>
                    <SelectTrigger id="mf-buy-folio-type">
                      <SelectValue placeholder="Select folio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New Folio</SelectItem>
                      <SelectItem value="existing">Existing Folio</SelectItem>
                    </SelectContent>
                  </Select>
                  {buyFolio === "existing" && (
                    <Input
                      placeholder="Enter folio number"
                      value={buyFolioText}
                      onChange={(e) => setBuyFolioText(e.target.value)}
                    />
                  )}
                </div>

                <Card>
                  <CardContent className="p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">{buyAmount ? fmtINR(Number(buyAmount)) : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Units</span>
                      <span className="font-mono">{buyEstUnits ?? "—"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleBuy}
                  disabled={placeMfOrder.isPending}
                >
                  {placeMfOrder.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Placing…</>
                  ) : (
                    "Place Order"
                  )}
                </Button>
              </TabsContent>

              {/* ── SIP tab ────────────────────────────────────────── */}
              <TabsContent value="sip" className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mf-sip-amount">SIP Amount (₹ / month)</Label>
                  <Input
                    id="mf-sip-amount"
                    type="number"
                    min={500}
                    step={100}
                    placeholder="e.g. 2000"
                    value={sipAmount}
                    onChange={(e) => setSipAmount(e.target.value)}
                  />
                  {sipEstUnits && (
                    <p className="text-xs text-muted-foreground">
                      Estimated units/month: <span className="font-mono">{sipEstUnits}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mf-sip-date">SIP Date (day of month)</Label>
                  <Select value={sipDate} onValueChange={setSipDate}>
                    <SelectTrigger id="mf-sip-date">
                      <SelectValue placeholder="Select date" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIP_DATES.map(d => (
                        <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Folio */}
                <div className="space-y-1.5">
                  <Label htmlFor="mf-sip-folio-type">Folio</Label>
                  <Select value={sipFolio} onValueChange={setSipFolio}>
                    <SelectTrigger id="mf-sip-folio-type">
                      <SelectValue placeholder="Select folio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New Folio</SelectItem>
                      <SelectItem value="existing">Existing Folio</SelectItem>
                    </SelectContent>
                  </Select>
                  {sipFolio === "existing" && (
                    <Input
                      placeholder="Enter folio number"
                      value={sipFolioText}
                      onChange={(e) => setSipFolioText(e.target.value)}
                    />
                  )}
                </div>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSip}
                  disabled={placeMfOrder.isPending}
                >
                  {placeMfOrder.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Placing…</>
                  ) : (
                    "Place SIP"
                  )}
                </Button>
              </TabsContent>

              {/* ── Redeem tab ─────────────────────────────────────── */}
              <TabsContent value="redeem" className="space-y-4 mt-4">
                {holding && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    Holdings: <span className="font-mono font-medium">{holding.qty} units</span>
                    {holding.folio_number && (
                      <span className="text-muted-foreground ml-2">· Folio: {holding.folio_number}</span>
                    )}
                  </div>
                )}

                {/* Redeem type toggle */}
                <div className="space-y-1.5">
                  <Label>Redeem by</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRedeemMode("units")}
                      className={`rounded-md py-2 text-sm font-medium border transition-colors ${
                        redeemMode === "units"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"
                      }`}
                    >
                      Units
                    </button>
                    <button
                      type="button"
                      onClick={() => setRedeemMode("amount")}
                      className={`rounded-md py-2 text-sm font-medium border transition-colors ${
                        redeemMode === "amount"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-transparent hover:border-muted-foreground/30"
                      }`}
                    >
                      Amount
                    </button>
                  </div>
                </div>

                {redeemMode === "units" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="mf-redeem-units">Units to Redeem</Label>
                    <Input
                      id="mf-redeem-units"
                      type="number"
                      min={0.001}
                      step={0.001}
                      max={holding?.qty}
                      placeholder="e.g. 10"
                      value={redeemUnits}
                      onChange={(e) => setRedeemUnits(e.target.value)}
                    />
                    {redeemEstValue && (
                      <p className="text-xs text-muted-foreground">
                        Estimated value: <span className="font-medium">{redeemEstValue}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="mf-redeem-amount">Amount (₹)</Label>
                    <Input
                      id="mf-redeem-amount"
                      type="number"
                      min={100}
                      step={100}
                      placeholder="e.g. 5000"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                    />
                    {redeemEstValue && (
                      <p className="text-xs text-muted-foreground">
                        {redeemEstValue}
                      </p>
                    )}
                  </div>
                )}

                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleRedeem}
                  disabled={placeMfOrder.isPending}
                >
                  {placeMfOrder.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Placing…</>
                  ) : (
                    "Redeem"
                  )}
                </Button>
              </TabsContent>
            </Tabs>

          </div>
        </ScrollArea>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <SheetFooter className="px-6 py-3 border-t">
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
