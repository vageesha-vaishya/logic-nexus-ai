"""Pure-function tests for the risk-score compute (Addendum T17)."""
from __future__ import annotations

import pytest

from markets_worker.jobs.risk_score_compute import (
    TARGET_BY_RISK_TAG,
    TierObservation,
    compute_risk_score,
)


def _balanced_tiers(values=(55, 35, 10), drawdowns=(0.0, 0.0, 0.0)) -> list[TierObservation]:
    """Helper: build 3 observations with the supplied ₹ values + drawdowns."""
    return [
        TierObservation(tier_number=i + 1, current_value=v * 1000.0, drawdown_pct_6m=d)
        for i, (v, d) in enumerate(zip(values, drawdowns, strict=True))
    ]


def test_empty_portfolio_returns_target_pinned():
    """A user with no investments yet shouldn't be flagged as 'off-plan'."""
    result = compute_risk_score([], risk_tag="moderate")
    assert result.score == TARGET_BY_RISK_TAG["moderate"]
    assert result.target_score == TARGET_BY_RISK_TAG["moderate"]
    assert result.components.get("note") == "empty_portfolio_pinned_to_target"


def test_perfectly_balanced_moderate_portfolio_is_low_score():
    """55/35/10 split for a moderate user → no skew, no concentration, no drawdown."""
    result = compute_risk_score(_balanced_tiers(), risk_tag="moderate")
    # Concentration of (55/35/10) is HHI≈0.425, normalised low. Tier skew = 0.
    # Drawdown = 0 → 1. Beta = 5 (default).
    # Expected score is in the low-to-mid range:
    assert 2.0 <= result.score <= 4.5
    assert result.components["tier_skew_score"] == pytest.approx(1.0, abs=0.01)


def test_single_concentrated_tier_pushes_concentration_to_max():
    """All money in tier 1 → HHI = 1.0 → concentration_score = 10."""
    tiers = [
        TierObservation(tier_number=1, current_value=100_000.0, drawdown_pct_6m=0.0),
        TierObservation(tier_number=2, current_value=0.0,       drawdown_pct_6m=0.0),
        TierObservation(tier_number=3, current_value=0.0,       drawdown_pct_6m=0.0),
    ]
    result = compute_risk_score(tiers, risk_tag="moderate")
    assert result.components["concentration_score"] == pytest.approx(10.0, abs=0.01)


def test_off_plan_aggressive_user_in_safety_only_has_high_tier_skew():
    """Aggressive plan = 40/40/20. Putting everything in tier 1 = max skew."""
    tiers = [
        TierObservation(tier_number=1, current_value=100_000.0, drawdown_pct_6m=0.0),
        TierObservation(tier_number=2, current_value=0.0,       drawdown_pct_6m=0.0),
        TierObservation(tier_number=3, current_value=0.0,       drawdown_pct_6m=0.0),
    ]
    result = compute_risk_score(tiers, risk_tag="aggressive")
    # 100/0/0 vs target 40/40/20 → L1 = |60|+|40|+|20| = 120 / 200 = 0.60 normalised
    # → tier_skew_score = 1 + 9*0.60 = 6.4
    assert result.components["tier_skew_score"] == pytest.approx(6.4, abs=0.1)


def test_drawdown_pushes_score_up():
    """30% weighted drawdown maxes the drawdown component to 10."""
    tiers = _balanced_tiers(drawdowns=(30.0, 30.0, 30.0))
    result = compute_risk_score(tiers, risk_tag="moderate")
    assert result.components["drawdown_score"] == pytest.approx(10.0, abs=0.01)


def test_target_score_matches_risk_tag():
    for tag, expected in TARGET_BY_RISK_TAG.items():
        result = compute_risk_score(_balanced_tiers(), risk_tag=tag)
        assert result.target_score == expected


def test_score_is_clamped_to_zero_ten_envelope():
    """Even with maxed-out inputs, the final score never escapes 0-10."""
    tiers = [
        TierObservation(tier_number=1, current_value=1_000_000.0, drawdown_pct_6m=100.0),
        TierObservation(tier_number=2, current_value=0.0,         drawdown_pct_6m=100.0),
        TierObservation(tier_number=3, current_value=0.0,         drawdown_pct_6m=100.0),
    ]
    result = compute_risk_score(tiers, risk_tag="conservative")
    assert 0.0 <= result.score <= 10.0


def test_components_blob_includes_weights_for_audit():
    result = compute_risk_score(_balanced_tiers(), risk_tag="moderate")
    weights = result.components["weights"]
    assert isinstance(weights, dict)
    assert pytest.approx(weights["concentration"] + weights["tier_skew"]
                         + weights["drawdown"] + weights["beta"]) == 1.0
