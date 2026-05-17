/**
 * PriceAlertSheet — right-side sheet for setting a price alert on a symbol.
 *
 * Shows current LTP, condition toggle (Above/Below), trigger price input,
 * optional notes, and a list of active alerts for the symbol with cancel buttons.
 */

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Badge,
  Button,
  Input,
  Label,
} from "@/design-system";

import {
  usePriceAlerts,
  useCreatePriceAlert,
  useCancelPriceAlert,
  type AlertCondition,
  type PriceAlert,
} from "../hooks/usePriceAlerts";

// ── Props ─────────────────────────────────────────────────────────────────────

interface PriceAlertSheetProps {
  symbol: string;
  exchange: string;
  currentLtp: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActiveAlertRow({ alert }: { alert: PriceAlert }) {
  const cancel = useCancelPriceAlert();

  const handleCancel = () => {
    cancel.mutate(alert.id, {
      onSuccess: () => toast.success("Alert cancelled"),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Badge
          variant={alert.condition === "above" ? "default" : "secondary"}
          className="shrink-0 text-[10px] capitalize"
        >
          {alert.condition}
        </Badge>
        <span className="font-mono font-medium">{fmtINR(alert.trigger_price)}</span>
        {alert.notes && (
          <span className="truncate text-xs text-muted-foreground">{alert.notes}</span>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
        onClick={handleCancel}
        disabled={cancel.isPending}
      >
        {cancel.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <X className="h-3 w-3" />
        )}
        <span className="sr-only">Cancel alert</span>
      </Button>
    </div>
  );
}

function TriggeredAlertRow({ alert }: { alert: PriceAlert }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="shrink-0 text-[10px] capitalize border-amber-400 text-amber-700 dark:text-amber-400">
          {alert.condition} {fmtINR(alert.trigger_price)}
        </Badge>
        {alert.triggered_price != null && (
          <span className="font-mono text-xs text-muted-foreground">
            hit {fmtINR(alert.triggered_price)}
          </span>
        )}
      </div>
      {alert.triggered_at && (
        <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(alert.triggered_at)}</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PriceAlertSheet({
  symbol,
  exchange,
  currentLtp,
  open,
  onOpenChange,
}: PriceAlertSheetProps) {
  const create = useCreatePriceAlert();
  const { data: alerts = [], isLoading } = usePriceAlerts(symbol);

  // Form state
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ triggerPrice?: string }>({});

  // Reset form when sheet opens on a new symbol
  useEffect(() => {
    if (open) {
      setCondition("above");
      setTriggerPrice(currentLtp != null ? String(currentLtp) : "");
      setNotes("");
      setErrors({});
    }
  }, [open, symbol, currentLtp]);

  const activeAlerts = alerts.filter((a) => a.status === "active");
  const triggeredAlerts = alerts.filter((a) => a.status === "triggered");

  function validate(): boolean {
    const price = parseFloat(triggerPrice);
    if (!triggerPrice || isNaN(price) || price <= 0) {
      setErrors({ triggerPrice: "Trigger price must be greater than 0" });
      return false;
    }
    setErrors({});
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;
    create.mutate(
      {
        symbol,
        exchange,
        condition,
        trigger_price: parseFloat(triggerPrice),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Alert set: ${symbol} ${condition} ${fmtINR(parseFloat(triggerPrice))}`);
          setTriggerPrice("");
          setNotes("");
          setErrors({});
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] max-w-full flex flex-col overflow-y-auto">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Price Alert
            <span className="font-mono">{symbol}</span>
            <Badge variant="outline" className="text-[10px]">{exchange}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-4">
          {/* Current LTP */}
          <div className="rounded-md bg-muted/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">Current LTP</p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tracking-tight">
              {currentLtp != null ? fmtINR(currentLtp) : <span className="text-muted-foreground text-base">Not available</span>}
            </p>
          </div>

          {/* Condition toggle */}
          <div className="space-y-1.5">
            <Label>Condition</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCondition("above")}
                className={`flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors ${
                  condition === "above"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-input bg-background hover:bg-muted"
                }`}
              >
                Above
              </button>
              <button
                type="button"
                onClick={() => setCondition("below")}
                className={`flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors ${
                  condition === "below"
                    ? "bg-red-600 text-white border-red-600"
                    : "border-input bg-background hover:bg-muted"
                }`}
              >
                Below
              </button>
            </div>
          </div>

          {/* Trigger price */}
          <div className="space-y-1.5">
            <Label htmlFor="alert-trigger-price">Trigger Price (₹)</Label>
            <Input
              id="alert-trigger-price"
              type="number"
              min="0.01"
              step="0.05"
              placeholder="0.00"
              value={triggerPrice}
              onChange={(e) => {
                setTriggerPrice(e.target.value);
                if (errors.triggerPrice) setErrors({});
              }}
              className={errors.triggerPrice ? "border-destructive" : ""}
            />
            {errors.triggerPrice && (
              <p className="text-[11px] text-destructive">{errors.triggerPrice}</p>
            )}
            {triggerPrice && !errors.triggerPrice && currentLtp != null && (
              <p className="text-[11px] text-muted-foreground">
                Alert fires when LTP goes {condition}{" "}
                <span className="font-mono font-medium">{fmtINR(parseFloat(triggerPrice))}</span>
                {" "}(currently {fmtINR(currentLtp)})
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="alert-notes">Notes (optional)</Label>
            <Input
              id="alert-notes"
              placeholder="e.g. breakout level, resistance zone…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bell className="mr-2 h-4 w-4" />
            )}
            Set Alert
          </Button>

          {/* Active alerts for this symbol */}
          {(isLoading || activeAlerts.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active Alerts
              </p>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading…
                </div>
              ) : (
                activeAlerts.map((a) => <ActiveAlertRow key={a.id} alert={a} />)
              )}
            </div>
          )}

          {/* Triggered alerts for this symbol */}
          {triggeredAlerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recently Triggered
              </p>
              {triggeredAlerts.slice(0, 5).map((a) => (
                <TriggeredAlertRow key={a.id} alert={a} />
              ))}
            </div>
          )}

          {/* Empty state when no alerts at all */}
          {!isLoading && activeAlerts.length === 0 && triggeredAlerts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted-foreground">
              <BellOff className="h-8 w-8 opacity-40" />
              <p>No alerts set for {symbol} yet.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
