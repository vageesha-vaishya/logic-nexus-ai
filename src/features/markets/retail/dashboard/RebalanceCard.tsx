import { useState } from "react";
import { ArrowRight, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { usePendingRebalance } from "../hooks/useRebalanceRecommendation";
import { RebalanceSheet } from "./RebalanceSheet";

/**
 * RebalanceCard (Addendum §4).
 *
 * Renders on Home only when the markets-worker has a live pending
 * recommendation for the current user. Click → opens RebalanceSheet with
 * the full order list + confirm/dismiss. Silent when no pending row
 * exists (the common case) so we don't add noise to a balanced portfolio.
 */
export function RebalanceCard() {
  const { data: rec, isLoading } = usePendingRebalance();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) return null;       // Quietly waits; nothing to show yet.
  if (!rec) return null;            // No drift → no card. Best-case UX.

  const { payload } = rec;
  const buyCount  = payload.orders.filter((o) => o.action === "buy").length;
  const sellCount = payload.orders.filter((o) => o.action === "sell").length;

  return (
    <>
      <Card className="border-primary/40 bg-primary/[0.04]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold">Time to rebalance</p>
              <p className="text-xs leading-snug text-muted-foreground">
                {payload.reason}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {buyCount} buy{buyCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {sellCount} sell{sellCount === 1 ? "" : "s"}
            </Badge>
            <span>·</span>
            <span className="tabular-nums">
              ~₹{payload.estimated_brokerage.toLocaleString("en-IN", { maximumFractionDigits: 0 })} brokerage
            </span>
          </div>

          <Button
            size="sm"
            className="w-full"
            onClick={() => setSheetOpen(true)}
            aria-label="Review and confirm rebalance"
          >
            Review &amp; confirm
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      <RebalanceSheet
        recommendation={rec}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
