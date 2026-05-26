/**
 * Dynamic portfolio risk score — pure compute (Phase 1 Addendum T17).
 *
 * Ported from services/markets-worker/src/markets_worker/jobs/risk_score_compute.py.
 * Identical maths so a sparkline in portfolio_risk_history stays comparable
 * across rows written by the Python worker and rows written by this edge
 * function. Pure-functional: no Supabase, no Deno globals, no I/O — so the
 * unit tests can call compute() directly.
 *
 *   risk_score = 0.30 * concentration  // HHI over tier weights
 *              + 0.30 * tier_skew      // L1 vs target weights
 *              + 0.20 * drawdown       // weighted-avg 6mo drawdown
 *              + 0.20 * beta           // placeholder 5.0 until per-holding betas land
 */

export const WEIGHT_CONCENTRATION = 0.30;
export const WEIGHT_TIER_SKEW     = 0.30;
export const WEIGHT_DRAWDOWN      = 0.20;
export const WEIGHT_BETA          = 0.20;

export const DEFAULT_BETA_SCORE = 5.0;

export const TARGET_BY_RISK_TAG: Record<string, number> = {
  conservative: 3.0,
  moderate:     6.0,
  aggressive:   9.0,
};

export const TARGET_TIER_WEIGHTS: Record<string, Record<number, number>> = {
  conservative: { 1: 70, 2: 25, 3: 5 },
  moderate:     { 1: 55, 2: 35, 3: 10 },
  aggressive:   { 1: 40, 2: 40, 3: 20 },
};

export interface TierObservation {
  tier_number:     number;
  current_value:   number;
  drawdown_pct_6m: number;
}

export interface RiskComponents {
  concentration_score: number;
  tier_skew_score:     number;
  drawdown_score:      number;
  beta_score:          number;
  weights: {
    concentration: number;
    tier_skew:     number;
    drawdown:      number;
    beta:          number;
  };
  note?: string;
}

export interface RiskScoreResult {
  score:        number;
  target_score: number;
  components:   RiskComponents;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function concentrationScore(tiers: TierObservation[]): number {
  const total = tiers.reduce((s, t) => s + t.current_value, 0);
  if (total <= 0) return 1.0;
  const weights = tiers.map(t => t.current_value / total);
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const n = Math.max(1, tiers.length);
  const hhiMin  = 1.0 / n;
  const hhiNorm = Math.max(0, (hhi - hhiMin) / (1.0 - hhiMin));
  return 1.0 + 9.0 * hhiNorm;
}

function tierSkewScore(tiers: TierObservation[], riskTag: string): number {
  const total = tiers.reduce((s, t) => s + t.current_value, 0);
  if (total <= 0) return 1.0;
  const targets = TARGET_TIER_WEIGHTS[riskTag] ?? TARGET_TIER_WEIGHTS.moderate;
  const actuals: Record<number, number> = {};
  for (const t of tiers) actuals[t.tier_number] = (100 * t.current_value) / total;
  let l1 = 0;
  for (const [tierNumberStr, targetPct] of Object.entries(targets)) {
    const actual = actuals[Number(tierNumberStr)] ?? 0;
    l1 += Math.abs(actual - targetPct);
  }
  const skewNorm = Math.min(1.0, l1 / 200.0);
  return 1.0 + 9.0 * skewNorm;
}

function drawdownScore(tiers: TierObservation[]): number {
  const total = tiers.reduce((s, t) => s + t.current_value, 0);
  if (total <= 0) return 1.0;
  const weightedDd = tiers.reduce(
    (s, t) => s + (t.current_value / total) * Math.max(0, t.drawdown_pct_6m),
    0,
  );
  const ddNorm = Math.min(1.0, weightedDd / 30.0);
  return 1.0 + 9.0 * ddNorm;
}

export function computeRiskScore(
  tiers: TierObservation[],
  riskTag: string,
  betaScore: number = DEFAULT_BETA_SCORE,
): RiskScoreResult {
  const target = TARGET_BY_RISK_TAG[riskTag] ?? TARGET_BY_RISK_TAG.moderate;
  const totalValue = tiers.reduce((s, t) => s + t.current_value, 0);

  if (tiers.length === 0 || totalValue <= 0) {
    return {
      score:        target,
      target_score: target,
      components: {
        concentration_score: 1.0,
        tier_skew_score:     1.0,
        drawdown_score:      1.0,
        beta_score:          betaScore,
        weights: {
          concentration: WEIGHT_CONCENTRATION,
          tier_skew:     WEIGHT_TIER_SKEW,
          drawdown:      WEIGHT_DRAWDOWN,
          beta:          WEIGHT_BETA,
        },
        note: 'empty_portfolio_pinned_to_target',
      },
    };
  }

  const c = concentrationScore(tiers);
  const t = tierSkewScore(tiers, riskTag);
  const d = drawdownScore(tiers);

  const raw =
    WEIGHT_CONCENTRATION * c +
    WEIGHT_TIER_SKEW     * t +
    WEIGHT_DRAWDOWN      * d +
    WEIGHT_BETA          * betaScore;

  const score = Math.max(0, Math.min(10, raw));

  return {
    score:        round2(score),
    target_score: target,
    components: {
      concentration_score: round2(c),
      tier_skew_score:     round2(t),
      drawdown_score:      round2(d),
      beta_score:          betaScore,
      weights: {
        concentration: WEIGHT_CONCENTRATION,
        tier_skew:     WEIGHT_TIER_SKEW,
        drawdown:      WEIGHT_DRAWDOWN,
        beta:          WEIGHT_BETA,
      },
    },
  };
}
