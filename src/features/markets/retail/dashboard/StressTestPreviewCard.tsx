/**
 * StressTestPreviewCard — Phase 1 addendum T18 surface upgrade.
 *
 * The full stress-test machinery already exists (useStressTest hook +
 * StressTestPanel sheet + /v1/retail/stress-test worker route with three
 * historical scenarios). What was missing: discoverability. The panel was
 * only reachable via a CTA on RiskScoreCard, so a user who'd never opened
 * the Risk Score sheet never knew the stress test existed.
 *
 * This card teases the worst-case drawdown directly on the Portfolio tab.
 * It shares the same react-query cache key as the panel, so opening the
 * "See breakdown" sheet from here is instant — no second fetch.
 */
import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

import { useStressTest } from "../hooks/useStressTest";
import { StressTestPanel } from "./StressTestPanel";

export function StressTestPreviewCard() {
  const [panelOpen, setPanelOpen] = useState(false);
  // Pre-fetch on mount so the headline reads immediately and tapping
  // "See breakdown" opens the panel from cache.
  const { data, isLoading, isError } = useStressTest(true);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Worst-case scenario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Quiet null on error / no-holdings — same posture as LtcgTrackerCard:
  // a portfolio page that intermittently shows or hides this card is
  // less jarring than a permanent red banner on transient worker hiccups.
  if (isError || !data || data.holdings_count === 0 || data.scenarios.length === 0) {
    return null;
  }

  // Worst (most-negative) scenario is the headline — that's the one the
  // user emotionally needs to see, the rest are explored in the sheet.
  const worst = [...data.scenarios].sort((a, b) => a.loss_inr - b.loss_inr)[0];

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
            Worst-case scenario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-0.5">
            <div className="text-2xl font-semibold tabular-nums text-destructive">
              {formatCurrency(worst.loss_inr, { showSign: true, maximumFractionDigits: 0 })}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                ({worst.loss_pct.toFixed(1)}%)
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              If <span className="font-medium">{worst.label}</span> repeated today,
              your portfolio could drop to{" "}
              {formatCurrency(worst.portfolio_value_post, { maximumFractionDigits: 0 })}.
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="-mx-2 h-8 justify-between px-2 text-xs"
            onClick={() => setPanelOpen(true)}
          >
            See breakdown across {data.scenarios.length} scenarios
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </CardContent>
      </Card>

      <StressTestPanel open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  );
}

export default StressTestPreviewCard;
