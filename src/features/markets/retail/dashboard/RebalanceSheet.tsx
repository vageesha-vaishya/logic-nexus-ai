import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { requireBiometric } from "@/lib/biometric";

import { WhyButton } from "../glossary";
import {
  useDismissRebalance,
  useExecuteRebalance,
  type RebalanceRecommendation,
} from "../hooks/useRebalanceRecommendation";

interface RebalanceSheetProps {
  recommendation: RebalanceRecommendation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatINR = (n: number): string =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Basket variant of ExecutionBottomSheet (Addendum §4).
 *
 * Renders the full rebalance payload — orders, brokerage cost prominently,
 * post-trade tier view via the drift table, single confirm. Biometric is a
 * Capacitor stub (T24); on web we record `confirm_method='web'`.
 *
 * Confirm → `useExecuteRebalance` records the SEBI audit trail; actual
 * broker submission lands in a follow-up that picks up rows by
 * status='executed'. Dismiss closes the sheet without trading.
 */
export function RebalanceSheet({
  recommendation,
  open,
  onOpenChange,
}: RebalanceSheetProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dismissMutation = useDismissRebalance({
    onSuccess: () => onOpenChange(false),
  });
  const executeMutation = useExecuteRebalance({
    onSuccess: () => onOpenChange(false),
  });

  const handleDismiss = () => {
    if (!recommendation) return;
    setErrorMessage(null);
    dismissMutation.mutate(recommendation.id, {
      onError: (err) => setErrorMessage(err.message),
    });
  };

  const handleConfirm = async () => {
    if (!recommendation) return;
    setErrorMessage(null);
    // Per addendum §2: biometric is a LOCAL re-confirmation on top of the
    // active session. On web this no-ops with method='web', so the same
    // call site works in browser preview AND on Android.
    const auth = await requireBiometric({
      reason: "Authorise this rebalance",
      cancelTitle: "Cancel",
    });
    if (!auth.ok) {
      if (auth.reason !== "userCancel") setErrorMessage(auth.message);
      return;
    }
    executeMutation.mutate(
      { recId: recommendation.id, confirmMethod: auth.method },
      { onError: (err) => setErrorMessage(err.message) },
    );
  };

  if (!recommendation) return null;
  const { payload } = recommendation;
  const busy = dismissMutation.isPending || executeMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader className="space-y-1.5 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Rebalance your portfolio
          </SheetTitle>
          <SheetDescription className="text-xs">{payload.reason}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Orders */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              Proposed orders ({payload.orders.length})
              <WhyButton
                title="Why these orders?"
                srLabel="Why these orders?"
              >
                Tier weights have drifted more than 5% from your plan. Moving
                the suggested amount nudges them back toward target without
                fully rebalancing in one step — gentler on taxes and
                brokerage.
              </WhyButton>
            </h3>
            <ul className="space-y-1.5">
              {payload.orders.map((o, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-xs"
                >
                  {o.action === "buy" ? (
                    <ArrowUp className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <ArrowDown className="h-4 w-4 shrink-0 text-rose-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium uppercase">{o.action}</span>
                      {o.symbol && (
                        <span className="font-medium tabular-nums">{o.symbol}</span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        Tier {o.tier_to ?? o.tier_from}
                      </Badge>
                    </div>
                    {o.name && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {o.name}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right font-medium tabular-nums">
                    {formatINR(o.amount_inr)}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Cost summary */}
          <section className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 text-xs">
            <div>
              <div className="text-muted-foreground">Net cash impact</div>
              <div className="font-semibold tabular-nums">
                {formatINR(payload.net_cash_impact)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated brokerage</div>
              <div className="font-semibold tabular-nums">
                {formatINR(payload.estimated_brokerage)}
              </div>
            </div>
          </section>

          {/* Post-trade view (drift table) */}
          <section className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Tier weights today
            </h3>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="font-normal">Tier</th>
                  <th className="text-right font-normal">Now</th>
                  <th className="text-right font-normal">Target</th>
                  <th className="text-right font-normal">Drift</th>
                </tr>
              </thead>
              <tbody>
                {payload.drifts.map((d) => {
                  const breached = Math.abs(d.drift_pct) > payload.threshold_pct;
                  return (
                    <tr key={d.tier_number} className="border-t">
                      <td className="py-1.5">Tier {d.tier_number}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.actual_pct.toFixed(1)}%</td>
                      <td className="py-1.5 text-right tabular-nums">{d.target_pct.toFixed(1)}%</td>
                      <td
                        className={
                          "py-1.5 text-right tabular-nums " +
                          (breached ? "text-amber-700 dark:text-amber-300" : "")
                        }
                      >
                        {d.drift_pct > 0 ? "+" : ""}
                        {d.drift_pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Disclaimer + actions */}
          <p className="rounded-md bg-muted/30 p-2.5 text-[11px] leading-snug text-muted-foreground">
            Tap Confirm to record your authorization. Orders will be submitted
            to your linked broker in a separate step. Past performance does
            not predict future returns; capital is at risk.
          </p>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={handleDismiss}
            >
              {dismissMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Not now"
              )}
            </Button>
            <Button className="flex-1" disabled={busy} onClick={handleConfirm}>
              {executeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm rebalance"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
