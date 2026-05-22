/**
 * DiagnosticCard — Phase 1 Addendum T19.
 *
 * Top-of-Home card. Shows the LLM-generated daily portfolio health
 * diagnostic: one-line headline, 1-3 findings grounded in metric
 * values, and up to 4 suggested_actions that each link to an existing
 * platform feature (no new advice paths invented). When the LLM is
 * unreachable or returns malformed output, the edge function falls
 * back to a templated diagnostic — `source === "fallback"` — which
 * renders identically aside from a small attribution.
 *
 * Actions:
 *   • rebalance         → opens the existing RebalanceSheet (if a
 *                          pending recommendation exists) else /portfolio
 *   • view_harvest      → /portfolio (HarvestOpportunitiesCard lives there)
 *   • view_stress_test  → opens the StressTestPanel
 *   • view_portfolio    → /portfolio
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, AlertCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { useDiagnostic, type DiagnosticSuggestedAction } from "../hooks/useDiagnostic";
import { usePendingRebalance } from "../hooks/useRebalanceRecommendation";
import { RebalanceSheet } from "./RebalanceSheet";
import { StressTestPanel } from "./StressTestPanel";

const ACTION_LABEL: Record<DiagnosticSuggestedAction["type"], string> = {
  rebalance:        "Review rebalance",
  view_harvest:     "View tax harvest",
  view_stress_test: "Run stress test",
  view_portfolio:   "Open portfolio",
};

export function DiagnosticCard() {
  const { data, isLoading, isError } = useDiagnostic();
  const { data: pendingRec } = usePendingRebalance();
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [stressOpen, setStressOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Today's diagnostic
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    // Stay quiet on errors — the diagnostic is informational, not load-bearing.
    return null;
  }

  const { payload, source } = data;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Today's diagnostic
            {source === "fallback" && (
              <Badge variant="outline" className="ml-1 gap-1 text-[10px] font-normal">
                <AlertCircle className="h-3 w-3" />
                Templated
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium leading-snug">{payload.headline}</p>

          {payload.findings.length > 0 && (
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {payload.findings.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          )}

          {payload.suggested_actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {payload.suggested_actions.map((a, i) => (
                <ActionButton
                  key={i}
                  action={a}
                  hasPendingRebalance={!!pendingRec}
                  onRebalanceClick={() => setRebalanceOpen(true)}
                  onStressClick={() => setStressOpen(true)}
                />
              ))}
            </div>
          )}

          <p className="text-[10px] leading-snug text-muted-foreground">
            Informational only. Not investment advice. Confirm any action with your own
            judgement or advisor.
          </p>
        </CardContent>
      </Card>
      <RebalanceSheet
        recommendation={pendingRec ?? null}
        open={rebalanceOpen}
        onOpenChange={setRebalanceOpen}
      />
      <StressTestPanel open={stressOpen} onOpenChange={setStressOpen} />
    </>
  );
}

function ActionButton({
  action,
  hasPendingRebalance,
  onRebalanceClick,
  onStressClick,
}: {
  action:              DiagnosticSuggestedAction;
  hasPendingRebalance: boolean;
  onRebalanceClick:    () => void;
  onStressClick:       () => void;
}) {
  const label = ACTION_LABEL[action.type];
  const cls   =
    "inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  // Rebalance → open the sheet if we have a recommendation; otherwise fall
  // back to /portfolio (same fallback the RiskScoreCard uses).
  if (action.type === "rebalance" && hasPendingRebalance) {
    return (
      <button type="button" onClick={onRebalanceClick} className={cls}>
        {label}
        <ArrowRight className="h-3 w-3" />
      </button>
    );
  }
  if (action.type === "view_stress_test") {
    return (
      <button type="button" onClick={onStressClick} className={cls}>
        {label}
        <ArrowRight className="h-3 w-3" />
      </button>
    );
  }

  // view_harvest, view_portfolio, rebalance-without-pending → link to /portfolio
  return (
    <Link to="/dashboard/markets/retail/portfolio" className={cls}>
      {label}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

export default DiagnosticCard;
