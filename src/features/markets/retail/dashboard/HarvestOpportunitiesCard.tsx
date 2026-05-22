/**
 * HarvestOpportunitiesCard — Phase 1 addendum T15.
 *
 * Sits on the retail Portfolio tab just below LtcgTrackerCard. Lists the
 * user's long-term (≥ 12 month) unrealized positions in profit, ranked by
 * gain, and partitions them across the remaining ₹1.25L LTCG exemption.
 *
 * Intent: drive a Mar 31 sell-then-rebuy action to lock in tax-free gains
 * before the FY rollover resets the exemption.
 *
 * No tax math lives here — partitioning is in `../lib/harvest` (pure +
 * tested) and the underlying gain_type classification is the worker's.
 */
import { Sprout } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

import { useHarvestCandidates } from "../hooks/useHarvestCandidates";
import { useLtcgTracker } from "../hooks/useLtcgTracker";
import { selectHarvestCandidates, splitByExemption, type HarvestCandidate } from "../lib/harvest";
import { WhyButton } from "../glossary";

const LTCG_TAX_RATE = 0.125;

function holdingYearsLabel(holdingDays: number): string {
  const years = holdingDays / 365.25;
  if (years < 1.1) return `Held ${holdingDays}d`;
  return `Held ${years.toFixed(1)}y`;
}

function CandidateRow({
  candidate,
  status,
  gainShown,
}: {
  candidate: HarvestCandidate;
  status:    "within" | "straddle" | "above";
  gainShown: number;
}) {
  const gainPct = candidate.avg_buy_price > 0
    ? ((candidate.current_price - candidate.avg_buy_price) / candidate.avg_buy_price) * 100
    : 0;
  const dotClass =
    status === "within"   ? "bg-emerald-500" :
    status === "straddle" ? "bg-amber-500"   :
                            "bg-muted-foreground";
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 truncate">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <span className="truncate font-medium">{candidate.symbol}</span>
        <span className="text-xs text-muted-foreground">
          {candidate.qty} · {holdingYearsLabel(candidate.holding_days)}
        </span>
      </div>
      <div className="text-right tabular-nums">
        <div className="font-medium">
          {formatCurrency(gainShown, { maximumFractionDigits: 0 })}
        </div>
        <div className="text-xs text-muted-foreground">+{gainPct.toFixed(1)}%</div>
      </div>
    </div>
  );
}

export function HarvestOpportunitiesCard() {
  const harvest = useHarvestCandidates();
  const ltcg    = useLtcgTracker();

  if (harvest.isLoading || ltcg.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Harvest opportunities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Quiet null when either backend leg failed — the LtcgTrackerCard above
  // does the same, so the user sees the section blank rather than a red
  // banner on transient worker hiccups.
  if (harvest.isError || ltcg.isError || !harvest.data || !ltcg.data) {
    return null;
  }

  if (!harvest.data.hasPortfolios) return null;

  const candidates = selectHarvestCandidates(harvest.data.candidates);
  const remaining  = Math.max(0, ltcg.data.summary.equity_ltcg_remaining);
  const split      = splitByExemption(candidates, remaining);
  const isEmpty    = candidates.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Sprout className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Harvest opportunities
          <WhyButton term="ltcg" srLabel="What is the LTCG exemption?" />
          <span className="ml-auto text-xs font-normal text-muted-foreground">FY {harvest.data.fy}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEmpty ? (
          <p className="text-xs text-muted-foreground">
            No long-term lots in profit yet. Lots become long-term after 12 months —
            once they do, this card will show how much you can sell tax-free.
          </p>
        ) : remaining <= 0 ? (
          <>
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Exemption used.</div>
              <div className="text-xs text-muted-foreground">
                Any further LTCG you book this year is taxed at 12.5%. Holding past
                Mar 31 resets your exemption.
              </div>
            </div>
            <div className="space-y-1.5">
              {candidates.slice(0, 5).map((c) => (
                <CandidateRow
                  key={`${c.portfolio_id}-${c.symbol}`}
                  candidate={c}
                  status="above"
                  gainShown={c.unrealized_gain}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-0.5">
              <div className="text-2xl font-semibold tabular-nums">
                {formatCurrency(split.totalTaxFreeGain, { maximumFractionDigits: 0 })}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  tax-free if you sell before Mar 31
                </span>
              </div>
              {split.totalTaxableGain > 0 && (
                <div className="text-xs text-muted-foreground">
                  Plus {formatCurrency(split.totalTaxableGain, { maximumFractionDigits: 0 })}{" "}
                  above the exemption (12.5% LTCG = est.{" "}
                  {formatCurrency(split.totalTaxableGain * LTCG_TAX_RATE, { maximumFractionDigits: 0 })}
                  ).
                </div>
              )}
            </div>

            {split.withinExemption.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Within exemption
                </div>
                {split.withinExemption.map((c) => (
                  <CandidateRow
                    key={`${c.portfolio_id}-${c.symbol}`}
                    candidate={c}
                    status="within"
                    gainShown={c.unrealized_gain}
                  />
                ))}
              </div>
            )}

            {split.straddle && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Partial — straddles the exemption
                </div>
                <CandidateRow
                  candidate={split.straddle.position}
                  status="straddle"
                  gainShown={split.straddle.gainWithin + split.straddle.gainAbove}
                />
                <div className="pl-3.5 text-xs text-muted-foreground">
                  {formatCurrency(split.straddle.gainWithin, { maximumFractionDigits: 0 })} tax-free,{" "}
                  {formatCurrency(split.straddle.gainAbove, { maximumFractionDigits: 0 })} taxable.
                </div>
              </div>
            )}

            {split.aboveExemption.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Above exemption — taxed at 12.5%
                </div>
                {split.aboveExemption.slice(0, 5).map((c) => (
                  <CandidateRow
                    key={`${c.portfolio_id}-${c.symbol}`}
                    candidate={c}
                    status="above"
                    gainShown={c.unrealized_gain}
                  />
                ))}
              </div>
            )}

            <p className="text-[11px] leading-snug text-muted-foreground">
              Harvesting means selling now to lock in the gain, then optionally
              rebuying. Prices may move between sell and rebuy. This card shows
              opportunities, not advice — confirm tax treatment with your CA.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default HarvestOpportunitiesCard;
