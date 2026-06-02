// Chi-square auto-promote evaluator. Pure functions — no I/O.
// Per design §5.6.
//
// Algorithm:
//   Build a 2×2 contingency table of (variant, outcome) where outcome
//   collapses to {accepted, rejected}. `ignored` outcomes are dropped
//   per the design (no signal). Apply Yates' continuity correction for
//   small-sample reliability:
//     χ² = N(|ad - bc| - N/2)² / ((a+b)(c+d)(a+c)(b+d))
//   df=1, so p-value = erfc(sqrt(χ²/2)) — closed-form for chi-sq survival.
//
// Decision rules:
//   - inconclusive when total invocations < target_invocations (if set)
//   - inconclusive when fewer than MIN_PER_VARIANT outcomes per variant
//   - inconclusive when p ≥ pThreshold (default 0.05)
//   - otherwise winner = whichever variant has the higher accept rate

export const DEFAULT_MIN_PER_VARIANT = 30;
export const DEFAULT_P_THRESHOLD = 0.05;

export interface ContingencyCounts {
  experiment_id: string;
  prompt_key: string;
  variant_a_version_id: string;
  variant_b_version_id: string;
  traffic_split: number;
  status: string;
  target_invocations: number | null;
  invocations_a: number;
  invocations_b: number;
  accepted_a: number;
  accepted_b: number;
  rejected_a: number;
  rejected_b: number;
  ignored_a: number;
  ignored_b: number;
  total_outcomes_a: number;
  total_outcomes_b: number;
}

export type EvalVerdict =
  | { kind: 'insufficient_invocations'; have: number; need: number }
  | { kind: 'insufficient_outcomes_per_variant'; have_a: number; have_b: number; need: number }
  | { kind: 'inconclusive'; chi2: number; p_value: number; accept_rate_a: number; accept_rate_b: number }
  | {
      kind: 'significant';
      chi2: number;
      p_value: number;
      accept_rate_a: number;
      accept_rate_b: number;
      winner_label: 'a' | 'b';
      winner_version_id: string;
      loser_version_id: string;
    };

export interface EvalOptions {
  /** Significance threshold; default 0.05. */
  p_threshold?: number;
  /** Minimum decided outcomes per variant before we'll judge; default 30. */
  min_per_variant?: number;
}

/** Complementary error function (Abramowitz & Stegun 7.1.26). ~1.5e-7 accurate. */
export function erfc(x: number): number {
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.5 * ax);
  const tau =
    t *
    Math.exp(
      -ax * ax -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? tau : 2 - tau;
}

/** P-value for chi-square with df=1 via erfc(sqrt(chi2/2)). */
export function chi2PValueDf1(chi2: number): number {
  if (!Number.isFinite(chi2) || chi2 <= 0) return 1;
  return erfc(Math.sqrt(chi2 / 2));
}

/**
 * Yates-corrected chi-square for a 2×2 table:
 *           accepted    rejected
 * variant_a   a            b
 * variant_b   c            d
 */
export function chi2Yates(a: number, b: number, c: number, d: number): number {
  const N = a + b + c + d;
  if (N === 0) return 0;
  const rowA = a + b;
  const rowB = c + d;
  const colAcc = a + c;
  const colRej = b + d;
  if (rowA === 0 || rowB === 0 || colAcc === 0 || colRej === 0) return 0;
  const num = N * Math.pow(Math.abs(a * d - b * c) - N / 2, 2);
  const den = rowA * rowB * colAcc * colRej;
  return num / den;
}

export function evaluate(stats: ContingencyCounts, opts: EvalOptions = {}): EvalVerdict {
  const p_threshold = opts.p_threshold ?? DEFAULT_P_THRESHOLD;
  const min_per_variant = opts.min_per_variant ?? DEFAULT_MIN_PER_VARIANT;

  const totalInv = stats.invocations_a + stats.invocations_b;
  if (stats.target_invocations && totalInv < stats.target_invocations) {
    return { kind: 'insufficient_invocations', have: totalInv, need: stats.target_invocations };
  }

  const decided_a = stats.accepted_a + stats.rejected_a;
  const decided_b = stats.accepted_b + stats.rejected_b;
  if (decided_a < min_per_variant || decided_b < min_per_variant) {
    return {
      kind: 'insufficient_outcomes_per_variant',
      have_a: decided_a,
      have_b: decided_b,
      need: min_per_variant,
    };
  }

  const accept_rate_a = decided_a > 0 ? stats.accepted_a / decided_a : 0;
  const accept_rate_b = decided_b > 0 ? stats.accepted_b / decided_b : 0;

  const chi2 = chi2Yates(stats.accepted_a, stats.rejected_a, stats.accepted_b, stats.rejected_b);
  const p_value = chi2PValueDf1(chi2);

  if (p_value >= p_threshold) {
    return { kind: 'inconclusive', chi2, p_value, accept_rate_a, accept_rate_b };
  }

  const winner_label: 'a' | 'b' = accept_rate_a >= accept_rate_b ? 'a' : 'b';
  return {
    kind: 'significant',
    chi2,
    p_value,
    accept_rate_a,
    accept_rate_b,
    winner_label,
    winner_version_id: winner_label === 'a' ? stats.variant_a_version_id : stats.variant_b_version_id,
    loser_version_id: winner_label === 'a' ? stats.variant_b_version_id : stats.variant_a_version_id,
  };
}
