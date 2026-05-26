/**
 * Goals tab — deepened in 2026-05-26 to show target amounts, tier
 * funding, and a plain-English SIP calculator. Still no edit/add
 * mutations (T8b / T7 in the addendum); those land when the goal-
 * calculator + lumpsum-solver work picks up.
 *
 * Data sources:
 *   - profile.goals     — captured during onboarding (Goal[])
 *   - portfolio tiers   — each tier carries goals: string[]
 *                          cross-reference shows which tiers fund each
 *                          goal + sums tier.target_amount as the goal's
 *                          aggregate target.
 */
import { useMemo, useState } from "react";
import { Target, TrendingUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { usePortfolioTiers } from "../hooks/usePortfolioTiers";
import { useRiskProfile } from "../hooks/useRiskProfile";
import { GOALS, TIER_DEFAULTS, type Goal, type PortfolioTier } from "../types";
import { WhyButton } from "../glossary";

const GOAL_LABEL: Record<string, string> = Object.fromEntries(
  GOALS.map((g) => [g.id, g.label]),
);

function fmtINR(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/**
 * SIP future-value formula. P = monthly contribution, r = annual rate
 * (decimal), n = years. Standard end-of-period contribution with monthly
 * compounding.
 *   FV = P × ((1 + r/12)^(12n) - 1) / (r/12)
 */
function sipFutureValue(monthly: number, annualRatePct: number, years: number): number {
  if (monthly <= 0 || years <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  const months = years * 12;
  if (monthlyRate === 0) return monthly * months;
  return monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

interface GoalCardProps {
  goal:        Goal;
  fundingTiers: PortfolioTier[];
}

function GoalCard({ goal, fundingTiers }: GoalCardProps) {
  const label  = GOAL_LABEL[goal.goal] ?? goal.goal.replace(/_/g, " ");
  const target = goal.target_amount
    ?? fundingTiers.reduce((sum, t) => sum + (t.target_amount ?? 0), 0);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-medium capitalize">
            <Target className="h-4 w-4 text-sthira-copper shrink-0" aria-hidden="true" />
            {label}
          </h3>
          {goal.priority != null && (
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Priority {goal.priority}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {goal.years}y
        </span>
      </div>
      {target > 0 && (
        <p className="text-base font-semibold tabular-nums">{fmtINR(target)}</p>
      )}
      {fundingTiers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {fundingTiers.map((t) => {
            const def = TIER_DEFAULTS.find((d) => d.tier_number === t.tier_number);
            return (
              <span
                key={t.id}
                className="inline-flex items-center rounded-full border border-sthira-navy/15 bg-sthira-cream/40 px-2 py-0.5 text-[11px]"
              >
                {def?.name ?? t.name}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          No tier assigned yet — set this in Portfolio.
        </p>
      )}
    </div>
  );
}

function SipCalculator({ defaultYears }: { defaultYears: number }) {
  const [monthly, setMonthly] = useState<number>(5000);
  const [years,   setYears]   = useState<number>(defaultYears > 0 ? defaultYears : 10);
  const [ratePct, setRatePct] = useState<number>(12);

  const corpus       = useMemo(() => sipFutureValue(monthly, ratePct, years), [monthly, ratePct, years]);
  const contributed  = monthly * 12 * years;
  const gains        = Math.max(0, corpus - contributed);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <header className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-sthira-copper" aria-hidden="true" />
        <h3 className="text-sm font-medium">SIP calculator</h3>
        <WhyButton term="sip" srLabel="What is a SIP?" />
      </header>
      <p className="text-xs text-muted-foreground">
        How much you&apos;d build if you invest the same amount every month at the
        return rate you set. Indicative only — actual returns vary year to year.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="sip-monthly" className="text-[11px] uppercase tracking-wide text-muted-foreground">Monthly ₹</Label>
          <Input
            id="sip-monthly"
            type="number"
            min={500}
            step={500}
            inputMode="numeric"
            value={monthly}
            onChange={(e) => setMonthly(Math.max(0, Number(e.target.value)))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sip-years" className="text-[11px] uppercase tracking-wide text-muted-foreground">Years</Label>
          <Input
            id="sip-years"
            type="number"
            min={1}
            max={50}
            step={1}
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(Math.max(1, Math.min(50, Number(e.target.value))))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sip-rate" className="text-[11px] uppercase tracking-wide text-muted-foreground">Return %</Label>
          <Input
            id="sip-rate"
            type="number"
            min={0}
            max={30}
            step={0.5}
            inputMode="decimal"
            value={ratePct}
            onChange={(e) => setRatePct(Math.max(0, Math.min(30, Number(e.target.value))))}
          />
        </div>
      </div>
      <div className="pt-1 space-y-1 tabular-nums">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Projected corpus</span>
          <span className="font-sthiraSerif text-lg">{fmtINR(corpus)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>You invest</span>
          <span>{fmtINR(contributed)}</span>
        </div>
        <div className="flex justify-between text-xs text-sthira-sage">
          <span>Growth</span>
          <span>+{fmtINR(gains)}</span>
        </div>
      </div>
    </div>
  );
}

export default function RetailGoalsPage() {
  const { data: profile } = useRiskProfile();
  const { data: tiers = [] } = usePortfolioTiers();
  const goals = profile?.goals ?? [];

  // For each goal, find which tiers fund it (tier.goals is string[] of
  // goal ids). Defaults to all tiers if no explicit assignment, matching
  // the legacy data model where the user picked tiers but not goal-level
  // mapping.
  const goalsWithTiers = useMemo(
    () => goals.map((g) => ({
      goal: g,
      fundingTiers: tiers.filter((t) => (t.goals ?? []).includes(g.goal)),
    })),
    [goals, tiers],
  );

  const defaultCalcYears = goals[0]?.years ?? 10;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <header>
        <h2 className="text-lg font-semibold">Goals</h2>
        <p className="text-xs text-muted-foreground">
          What you&apos;re investing for. Tap any goal to see which portfolio
          tier is funding it. Inflation-adjusted projections in a later release.
        </p>
      </header>

      {goals.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No goals selected during onboarding. You can update them from More →
          Settings.
        </div>
      ) : (
        <section aria-label="Your goals" className="space-y-2">
          {goalsWithTiers.map(({ goal, fundingTiers }) => (
            <GoalCard key={goal.goal} goal={goal} fundingTiers={fundingTiers} />
          ))}
        </section>
      )}

      <SipCalculator defaultYears={defaultCalcYears} />
    </div>
  );
}
