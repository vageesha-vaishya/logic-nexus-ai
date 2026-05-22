/**
 * LTCG-harvest selection helpers (T15).
 *
 * Pure functions over the UnrealizedPosition shape returned by
 * `/v1/tax/{portfolioId}/pnl`. The worker already tags each position with
 * `gain_type` ("LTCG" | "STCG") and `unrealized_gain` (qty * (current -
 * avg_buy)). This module narrows the list to "candidates worth harvesting
 * before March 31" and partitions them across the remaining ₹1.25L
 * per-PAN exemption.
 *
 * No worker math is duplicated here — the rules for what counts as LTCG
 * (≥ 12 months for listed equity) live in markets-worker.
 */

import type { UnrealizedPosition } from "../../hooks/useTaxPnL";

export interface HarvestCandidate extends UnrealizedPosition {
  /** Source portfolio id — same position symbol may appear in multiple. */
  portfolio_id: string;
}

/**
 * From a merged list of unrealized positions across portfolios, keep only
 * positions that are:
 *   - long-term (gain_type === "LTCG") — the harvest only matters for these
 *   - in profit (unrealized_gain > 0) — losses are tax-loss harvesting, a
 *     separate problem with different mechanics
 *
 * Sorted by absolute gain descending so the biggest-value lots are first.
 */
export function selectHarvestCandidates(
  positions: HarvestCandidate[],
): HarvestCandidate[] {
  return positions
    .filter((p) => p.gain_type === "LTCG" && p.unrealized_gain > 0)
    .sort((a, b) => b.unrealized_gain - a.unrealized_gain);
}

export interface ExemptionSplit {
  withinExemption: HarvestCandidate[];
  /** Fully above the exemption — every rupee of gain is taxable. */
  aboveExemption:  HarvestCandidate[];
  /**
   * The straddling position — partially within, partially above. Null
   * when the candidates either fit entirely within or fall entirely above
   * the remaining headroom. The split is reported as gain rupees, not qty,
   * because the user thinks in "how much gain" not "how many shares".
   */
  straddle: {
    position:     HarvestCandidate;
    gainWithin:   number;
    gainAbove:    number;
  } | null;
  /** Sum of LTCG-eligible gain that fits inside the exemption headroom. */
  totalTaxFreeGain: number;
  /** Sum of LTCG-eligible gain that would be taxed at 12.5%. */
  totalTaxableGain: number;
}

/**
 * Walk pre-sorted candidates and partition them around the remaining
 * exemption headroom. Caller passes candidates already filtered + sorted
 * by `selectHarvestCandidates`. If `remainingExemption` is ≤ 0, every
 * candidate is classified as above-exemption.
 */
export function splitByExemption(
  candidates:         HarvestCandidate[],
  remainingExemption: number,
): ExemptionSplit {
  const within: HarvestCandidate[] = [];
  const above:  HarvestCandidate[] = [];
  let straddle: ExemptionSplit["straddle"] = null;

  let headroom = Math.max(0, remainingExemption);

  for (const c of candidates) {
    if (headroom <= 0) {
      above.push(c);
      continue;
    }
    if (c.unrealized_gain <= headroom) {
      within.push(c);
      headroom -= c.unrealized_gain;
      continue;
    }
    // Straddles: first slice fits, the rest is taxable.
    straddle = {
      position:   c,
      gainWithin: headroom,
      gainAbove:  c.unrealized_gain - headroom,
    };
    headroom = 0;
  }

  const totalTaxFreeGain =
    within.reduce((acc, c) => acc + c.unrealized_gain, 0) +
    (straddle?.gainWithin ?? 0);
  const totalTaxableGain =
    above.reduce((acc, c) => acc + c.unrealized_gain, 0) +
    (straddle?.gainAbove ?? 0);

  return {
    withinExemption: within,
    aboveExemption:  above,
    straddle,
    totalTaxFreeGain,
    totalTaxableGain,
  };
}
