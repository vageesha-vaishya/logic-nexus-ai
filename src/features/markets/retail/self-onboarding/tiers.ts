/**
 * Tier-allocation helpers for step 5 of the self-onboarding wizard.
 *
 * Pure functions — kept separate from the React component so they can be
 * unit-tested without DOM scaffolding.
 *
 * Concepts:
 *   - A tier allocation is a triple of integer percentages that sum to 100.
 *     Index 0 = Safety Net, 1 = Core Portfolio, 2 = Experimental.
 *   - Defaults are picked from the user's risk_tag, then adjusted for
 *     goal horizons (short-horizon goals bump Safety Net; long-horizon
 *     goals bump Core).
 *   - When a slider moves, the delta is redistributed across the other
 *     two tiers proportionally to their current weights so neither pops
 *     to zero or saturates unintentionally.
 */
import type { RiskTag, Goal } from '../types';

export type TierIdx = 0 | 1 | 2;
export type TierTriple = [number, number, number];

export const TIER_LABELS: Record<TierIdx, string> = {
  0: 'Safety Net',
  1: 'Core Portfolio',
  2: 'Experimental',
};

export const TIER_DESCRIPTIONS: Record<TierIdx, string> = {
  0: 'Capital you can\'t afford to lose. Cash, FDs, short-duration debt.',
  1: 'Long-term wealth. Diversified equity + index ETFs. High-conviction signals only.',
  2: 'Play money. Active signals, sector bets, options. Separate P&L.',
};

/** Default Safety / Core / Experimental percentages by risk tag. Sum to 100. */
const DEFAULTS_BY_TAG: Record<RiskTag, TierTriple> = {
  conservative: [50, 45,  5],
  moderate:     [25, 60, 15],
  aggressive:   [15, 55, 30],
};

/** Default paper capital used to translate slider % → ₹ amount on display + DB write. */
export const DEFAULT_BUDGET = 100000;

/** Min / max % per tier — guard rails so a slider can't pop another to zero. */
export const MIN_TIER_PCT = 0;
export const MAX_TIER_PCT = 95;

/**
 * Compute starting allocations from risk_tag + goals.
 *
 * The base is the risk-tag default. We then nudge:
 *   - +5% to Safety Net for every goal with horizon ≤ 5y (taken from Experimental, then Core)
 *   - +5% to Core for every goal with horizon ≥ 20y (taken from Experimental, then Safety)
 *
 * Result is always normalised to sum to 100.
 */
export function computeDefaultTiers(
  riskTag: RiskTag | undefined,
  goals: readonly Goal[],
): TierTriple {
  let [safety, core, expl] = DEFAULTS_BY_TAG[riskTag ?? 'moderate'];

  for (const g of goals) {
    if (g.years <= 5) {
      // Pull from Experimental first, then Core.
      const fromExpl = Math.min(5, expl);
      expl   -= fromExpl;
      safety += fromExpl;
      const fromCore = 5 - fromExpl;
      if (fromCore > 0) {
        const take = Math.min(fromCore, core);
        core   -= take;
        safety += take;
      }
    } else if (g.years >= 20) {
      // Pull from Experimental first, then Safety.
      const fromExpl = Math.min(5, expl);
      expl -= fromExpl;
      core += fromExpl;
      const fromSafety = 5 - fromExpl;
      if (fromSafety > 0) {
        const take = Math.min(fromSafety, safety);
        safety -= take;
        core   += take;
      }
    }
  }

  return normalise([safety, core, expl]);
}

/**
 * Redistribute when one slider moves. The moved tier takes `nextValue`;
 * the delta (`nextValue - prevValue`) is subtracted from the other two
 * tiers in proportion to their *current* weights. If both other tiers
 * are zero, the delta is split evenly.
 *
 * All values are clamped to [MIN_TIER_PCT, MAX_TIER_PCT] and the result
 * is normalised back to sum=100 to absorb rounding.
 */
export function redistribute(
  current: TierTriple,
  movedIdx: TierIdx,
  nextValue: number,
): TierTriple {
  const clamped = Math.min(MAX_TIER_PCT, Math.max(MIN_TIER_PCT, Math.round(nextValue)));
  const out: number[] = [...current];
  const delta = clamped - current[movedIdx];

  if (delta === 0) return [...current] as TierTriple;

  out[movedIdx] = clamped;
  const others: TierIdx[] = ([0, 1, 2] as TierIdx[]).filter((i) => i !== movedIdx);
  const othersSum = others.reduce((s, i) => s + current[i], 0);

  if (othersSum <= 0) {
    // Both other tiers are at zero — split the delta evenly.
    const share = -delta / others.length;
    for (const i of others) out[i] = Math.max(0, current[i] + share);
  } else {
    for (const i of others) {
      const share = (current[i] / othersSum) * delta;
      out[i]      = Math.max(0, current[i] - share);
    }
  }

  return normalise([out[0], out[1], out[2]]);
}

/**
 * Round to integers and absorb any drift into the largest tier so the
 * triple always sums to 100. Defensive against accumulated FP errors
 * after multiple redistribute() calls.
 */
export function normalise(t: TierTriple): TierTriple {
  const rounded = t.map((v) => Math.max(0, Math.round(v))) as TierTriple;
  const sum     = rounded[0] + rounded[1] + rounded[2];
  const drift   = 100 - sum;
  if (drift === 0) return rounded;

  const maxIdx = rounded[0] >= rounded[1] && rounded[0] >= rounded[2]
    ? 0
    : rounded[1] >= rounded[2]
      ? 1
      : 2;
  rounded[maxIdx as TierIdx] += drift;
  return rounded;
}

/** Multiply percentages by a budget, round each, push rounding drift into tier 1 (Core). */
export function toRupees(t: TierTriple, budget: number): TierTriple {
  if (budget <= 0) return [0, 0, 0];
  const raw    = t.map((p) => (p / 100) * budget);
  const rupees = raw.map(Math.round) as TierTriple;
  const sum    = rupees[0] + rupees[1] + rupees[2];
  const drift  = budget - sum;
  if (drift !== 0) rupees[1] += drift;
  return rupees;
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Pick the starter-template slug that best matches a tier mix. */
export function suggestedTemplateSlug(t: TierTriple): 'conservative' | 'balanced' | 'growth' {
  const [safety, , expl] = t;
  if (safety >= 40) return 'conservative';
  if (expl   >= 25) return 'growth';
  return 'balanced';
}
