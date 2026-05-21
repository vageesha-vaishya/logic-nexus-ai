/**
 * LTCG exemption tracker card — Phase 1 addendum T15.
 *
 * Sits on the retail Portfolio tab. Shows realized long-term capital gains
 * for the current Indian FY against the ₹1,25,000 per-PAN exemption with a
 * progress bar and a single headline: "₹X tax-free room left."
 *
 * The math (FIFO matching, 12-month holding-period classification, post-
 * July-2024 budget rates) lives in the markets-worker; this card just
 * presents the aggregated `summary` block from /v1/tax/user/pnl.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

import { useLtcgTracker } from "../hooks/useLtcgTracker";
import { WhyButton } from "../glossary";

export function LtcgTrackerCard() {
  const { data, isLoading, isError } = useLtcgTracker();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">LTCG tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    // Quiet failure — the worker route can return 401/5xx for legitimate
    // reasons (no session yet, worker restarting). Surfacing a red banner
    // every time would be noisier than the value of the card warrants.
    return null;
  }

  const { equity_ltcg, equity_ltcg_exempt, equity_ltcg_remaining, equity_ltcg_tax_est } = data.summary;
  const pctUsed = equity_ltcg_exempt > 0
    ? Math.min(100, Math.round((equity_ltcg / equity_ltcg_exempt) * 100))
    : 0;
  const exhausted = equity_ltcg_remaining <= 0 && equity_ltcg > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-base">
          LTCG tracker
          <WhyButton term="ltcg" srLabel="What is LTCG?" />
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            FY {data.fy}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-0.5">
          <div className="text-2xl font-semibold tabular-nums">
            {formatCurrency(Math.max(0, equity_ltcg_remaining), { maximumFractionDigits: 0 })}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">tax-free room left</span>
          </div>
          {exhausted ? (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Exemption used. Further LTCG taxed at 12.5% — est. {formatCurrency(equity_ltcg_tax_est, { maximumFractionDigits: 0 })} owed.
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Sell long-term equity worth this much in gain before March 31 to use the exemption.
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Progress value={pctUsed} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Realized:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(equity_ltcg, { maximumFractionDigits: 0 })}
              </span>
            </span>
            <span>
              Limit:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(equity_ltcg_exempt, { maximumFractionDigits: 0 })}
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default LtcgTrackerCard;
