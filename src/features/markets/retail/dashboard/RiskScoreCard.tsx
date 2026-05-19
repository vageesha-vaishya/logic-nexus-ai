import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { WhyButton } from "../glossary";
import { usePendingRebalance } from "../hooks/useRebalanceRecommendation";
import { useRiskScore } from "../hooks/useRiskScore";
import { RebalanceSheet } from "./RebalanceSheet";

const SCORE_BAND = (score: number): string => {
  if (score <= 3) return "Low";
  if (score <= 6) return "Moderate";
  if (score <= 8) return "Elevated";
  return "High";
};

/**
 * RiskScoreCard (Phase 1 Addendum T17 §5b).
 *
 * Single-card surface on Home. Renders the headline 0-10 score, the user's
 * onboarded target, and a one-line breakdown of the components that drove
 * the result. When `current - target > 2`, the card upgrades into an
 * elevated yellow state with a "Rebalance" CTA — the rebalance flow itself
 * is T21, so the CTA today links to /portfolio (where the user can adjust
 * tier allocations manually). When T21 lands, this link swaps in place.
 */
export function RiskScoreCard() {
  const { data, isLoading, isError, error } = useRiskScore();
  // The "How to fix this" CTA opens the same RebalanceSheet that RebalanceCard
  // owns, so the user doesn't have to scroll up to find it. TanStack Query
  // dedupes the pending fetch across the two callsites.
  const { data: pendingRec } = usePendingRebalance();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing your risk score…
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    // 412 means "onboarding not complete" — render nothing rather than scare
    // a new user with an error banner before they've even finished signup.
    const msg = String(error?.message ?? "");
    if (msg.includes(": 412")) return null;
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">
          Couldn&apos;t load risk score. {msg ? `(${msg})` : ""}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { score, target_score, components } = data.current;
  const delta = score - target_score;
  const elevated = delta > 2;

  return (
    <>
    <Card
      className={cn(
        elevated &&
          "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {elevated ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              Risk score
              <WhyButton
                title="What is the risk score?"
                srLabel="What is the risk score?"
              >
                A daily 0-10 number combining how concentrated your portfolio
                is, how far it&apos;s drifted from your plan, recent drawdown,
                and your overall market exposure. Closer to your target = on
                plan; far above target = it&apos;s time to rebalance.
              </WhyButton>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {score.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                / 10 · {SCORE_BAND(score)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              Target {target_score.toFixed(1)}
              {delta !== 0 && (
                <span
                  className={cn(
                    "ml-1",
                    elevated ? "text-amber-700 dark:text-amber-300" : "",
                  )}
                >
                  ({delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} vs plan)
                </span>
              )}
            </p>
          </div>

          {elevated && (
            pendingRec ? (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100"
                aria-label="Review rebalance recommendation"
              >
                How to fix this
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              // Elevated score but no pending rebalance recommendation
              // (transient — detector hasn't run yet or thresholds disagree).
              // Fall back to the Portfolio tab so the user can adjust manually.
              <Link
                to="/dashboard/markets/retail/portfolio"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100"
              >
                Open Portfolio
                <ArrowRight className="h-3 w-3" />
              </Link>
            )
          )}
        </div>

        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums sm:grid-cols-4">
          <li className="flex justify-between sm:flex-col sm:gap-0">
            <span>Concentration</span>
            <span className="text-foreground">{components.concentration_score.toFixed(1)}</span>
          </li>
          <li className="flex justify-between sm:flex-col sm:gap-0">
            <span>Plan drift</span>
            <span className="text-foreground">{components.tier_skew_score.toFixed(1)}</span>
          </li>
          <li className="flex justify-between sm:flex-col sm:gap-0">
            <span>Drawdown</span>
            <span className="text-foreground">{components.drawdown_score.toFixed(1)}</span>
          </li>
          <li className="flex justify-between sm:flex-col sm:gap-0">
            <span>Market beta</span>
            <span className="text-foreground">{components.beta_score.toFixed(1)}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
    <RebalanceSheet
      recommendation={pendingRec ?? null}
      open={sheetOpen}
      onOpenChange={setSheetOpen}
    />
    </>
  );
}
