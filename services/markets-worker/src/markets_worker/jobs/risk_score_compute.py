"""Dynamic portfolio risk score (Phase 1 Addendum T17).

The score is a 0-10 scalar combining four pillars:

    risk_score = w_c * concentration_score    # ─┐ 0.3
               + w_t * tier_skew_score        #   ├ how aligned with the plan
               + w_d * drawdown_score         #   ├─ how much pain in the last 6mo
               + w_b * beta_score             # ─┘ proxy for systemic exposure

Each pillar is normalised to a 1-10 sub-score so the weighted sum lands in
the same range. `beta_score` is a constant 5.0 today — we'll wire in
weighted-average beta once instrument-level betas land. Persisting the
weighted-sum components lets us evolve the formula without losing history.

The function is pure: it takes already-fetched inputs and returns a result
dict. The router stitches the DB I/O around it so we can unit-test the
maths in isolation.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

# Component weights — tunable via env if we ever need to.
WEIGHT_CONCENTRATION = 0.30
WEIGHT_TIER_SKEW     = 0.30
WEIGHT_DRAWDOWN      = 0.20
WEIGHT_BETA          = 0.20

# Until we have real per-holding betas, hold the beta component at the
# neutral midpoint. Documented in the components blob so a UI breakdown
# can call out that this pillar is a placeholder today.
DEFAULT_BETA_SCORE = 5.0

# Target risk score by onboarded risk_tag (see addendum §5b).
TARGET_BY_RISK_TAG: dict[str, float] = {
    "conservative": 3.0,
    "moderate":     6.0,
    "aggressive":   9.0,
}

# Target tier-weight allocations by risk_tag. Drives tier_skew_score: how
# far the user's actual ₹ split is from the plan. Mirrors the templates
# seeded in markets.portfolio_templates so a freshly-onboarded user with
# zero skew on day one scores low here.
TARGET_TIER_WEIGHTS: dict[str, dict[int, float]] = {
    "conservative": {1: 70, 2: 25, 3: 5},
    "moderate":     {1: 55, 2: 35, 3: 10},
    "aggressive":   {1: 40, 2: 40, 3: 20},
}


@dataclass(frozen=True)
class TierObservation:
    """One tier's current state as inputs to the risk model."""
    tier_number: int
    current_value: float      # ₹ market value today
    drawdown_pct_6m: float    # Max peak-to-trough drop in the last ~6mo (positive %)


@dataclass(frozen=True)
class RiskScoreResult:
    score: float
    target_score: float
    components: dict[str, float | dict[str, float]]


def _concentration_score(tiers: list[TierObservation]) -> float:
    """Herfindahl-Hirschman Index over tier-level weights, mapped to 1-10.

    HHI = sum(weight_i^2). With 3 tiers:
      - Perfectly balanced (33/33/33): HHI ≈ 0.33  → low concentration → 1
      - One tier holds everything (100/0/0): HHI = 1.0 → max concentration → 10

    Linear map: HHI ∈ [0.33, 1.0] → score ∈ [1, 10].
    """
    total = sum(t.current_value for t in tiers)
    if total <= 0:
        return 1.0
    weights = [t.current_value / total for t in tiers]
    hhi = sum(w * w for w in weights)
    # Normalise HHI from its min (1/n = 0.333 for 3 tiers) to its max (1.0).
    n_tiers = max(1, len(tiers))
    hhi_min = 1.0 / n_tiers
    hhi_norm = max(0.0, (hhi - hhi_min) / (1.0 - hhi_min))
    return 1.0 + 9.0 * hhi_norm


def _tier_skew_score(
    tiers: list[TierObservation],
    risk_tag: str,
) -> float:
    """L1 distance between actual and target tier weights, mapped to 1-10.

    Maximum possible L1 distance between two 3-weight distributions is 2.0
    (100% in tier A vs 100% in tier B). 0 = perfectly on-plan → 1, 2.0 → 10.
    """
    total = sum(t.current_value for t in tiers)
    if total <= 0:
        return 1.0
    targets = TARGET_TIER_WEIGHTS.get(risk_tag, TARGET_TIER_WEIGHTS["moderate"])
    actuals = {t.tier_number: 100.0 * t.current_value / total for t in tiers}
    l1 = 0.0
    for tier_number, target_pct in targets.items():
        actual_pct = actuals.get(tier_number, 0.0)
        l1 += abs(actual_pct - target_pct)
    # L1 between two 100-summing distributions is in [0, 200]; normalise to [0, 1].
    skew_norm = min(1.0, l1 / 200.0)
    return 1.0 + 9.0 * skew_norm


def _drawdown_score(tiers: list[TierObservation]) -> float:
    """Weighted-average 6-month drawdown across tiers, mapped to 1-10.

    0% drawdown → 1, 30%+ drawdown → 10 (clipped). The 30% ceiling matches
    the "red" drawdown alert tier — anything that severe is already
    maximally risky from the user's perspective.
    """
    total = sum(t.current_value for t in tiers)
    if total <= 0:
        return 1.0
    weighted_dd = sum(
        (t.current_value / total) * max(0.0, t.drawdown_pct_6m) for t in tiers
    )
    dd_norm = min(1.0, weighted_dd / 30.0)
    return 1.0 + 9.0 * dd_norm


def compute_risk_score(
    tiers: Iterable[TierObservation],
    risk_tag: str,
    beta_score: float = DEFAULT_BETA_SCORE,
) -> RiskScoreResult:
    """Combine pillars into a 0-10 scalar plus a per-component breakdown.

    Empty portfolio (no tiers, or zero total value) collapses to the
    target score: a brand-new user shouldn't be flagged as "off-plan" on
    day one.
    """
    tier_list = list(tiers)
    target = TARGET_BY_RISK_TAG.get(risk_tag, TARGET_BY_RISK_TAG["moderate"])

    total_value = sum(t.current_value for t in tier_list)
    if not tier_list or total_value <= 0:
        # Empty portfolio: pin to target so the dashboard shows "on plan"
        # rather than alarming the user with a fake skew before they invest.
        return RiskScoreResult(
            score=target,
            target_score=target,
            components={
                "concentration_score": 1.0,
                "tier_skew_score":     1.0,
                "drawdown_score":      1.0,
                "beta_score":          beta_score,
                "weights": {
                    "concentration": WEIGHT_CONCENTRATION,
                    "tier_skew":     WEIGHT_TIER_SKEW,
                    "drawdown":      WEIGHT_DRAWDOWN,
                    "beta":          WEIGHT_BETA,
                },
                "note": "empty_portfolio_pinned_to_target",
            },
        )

    c = _concentration_score(tier_list)
    t_skew = _tier_skew_score(tier_list, risk_tag)
    d = _drawdown_score(tier_list)

    score = (
        WEIGHT_CONCENTRATION * c
        + WEIGHT_TIER_SKEW * t_skew
        + WEIGHT_DRAWDOWN * d
        + WEIGHT_BETA * beta_score
    )
    # Clamp into the 0-10 envelope. Maths can produce 1.0-10.0 naturally;
    # the clamp guards against future formula changes.
    score = max(0.0, min(10.0, score))

    return RiskScoreResult(
        score=round(score, 2),
        target_score=target,
        components={
            "concentration_score": round(c, 2),
            "tier_skew_score":     round(t_skew, 2),
            "drawdown_score":      round(d, 2),
            "beta_score":          beta_score,
            "weights": {
                "concentration": WEIGHT_CONCENTRATION,
                "tier_skew":     WEIGHT_TIER_SKEW,
                "drawdown":      WEIGHT_DRAWDOWN,
                "beta":          WEIGHT_BETA,
            },
        },
    )
