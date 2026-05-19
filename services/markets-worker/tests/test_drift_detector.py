"""Pure-function tests for the drift detector (Addendum T21)."""
from __future__ import annotations

from markets_worker.jobs.drift_detector import (
    DRIFT_THRESHOLD_PCT,
    SuggestedHolding,
    TemplateHint,
    compute_drift,
)
from markets_worker.jobs.risk_score_compute import TierObservation


def _tiers(values: tuple[int, int, int]) -> list[TierObservation]:
    return [
        TierObservation(tier_number=i + 1, current_value=float(v), drawdown_pct_6m=0.0)
        for i, v in enumerate(values)
    ]


def test_balanced_portfolio_returns_no_recommendation():
    """A moderate user with exactly 55/35/10 stays at zero drift."""
    out = compute_drift(_tiers((55_000, 35_000, 10_000)), risk_tag="moderate")
    assert out is None


def test_within_threshold_returns_no_recommendation():
    """Drift of ±5% exactly is the boundary — anything <= 5% absolute is OK."""
    # Slightly off: 58/33/9 ≈ 58 / 33 / 9 — biggest drift = +3% on tier 1.
    out = compute_drift(_tiers((58_000, 33_000, 9_000)), risk_tag="moderate")
    assert out is None


def test_breach_triggers_recommendation():
    """80/15/5 vs target 55/35/10 → tier 1 drifts +25%, tier 2 -20%."""
    out = compute_drift(_tiers((80_000, 15_000, 5_000)), risk_tag="moderate")
    assert out is not None
    assert "Tier 2" in out["reason"] or "tier 2" in out["reason"]
    assert out["threshold_pct"] == DRIFT_THRESHOLD_PCT


def test_payload_orders_have_buy_into_underweight_and_sell_from_overweight():
    """Cash-neutral basket: one BUY into the worst-underweight tier, one
    SELL trimming the worst-overweight tier."""
    out = compute_drift(_tiers((80_000, 15_000, 5_000)), risk_tag="moderate")
    assert out is not None
    actions = [o["action"] for o in out["orders"]]
    assert "buy" in actions and "sell" in actions

    buy  = next(o for o in out["orders"] if o["action"] == "buy")
    sell = next(o for o in out["orders"] if o["action"] == "sell")
    # Tier 2 is underweight (15 vs 35); tier 1 is overweight (80 vs 55).
    assert buy["tier_to"]   == 2
    assert sell["tier_from"] == 1
    # Cash-neutral means equal amounts in both legs.
    assert buy["amount_inr"] == sell["amount_inr"] > 0


def test_net_cash_impact_is_zero_for_cash_neutral_basket():
    out = compute_drift(_tiers((80_000, 15_000, 5_000)), risk_tag="moderate")
    assert out is not None
    assert out["net_cash_impact"] == 0.0


def test_empty_portfolio_returns_none():
    out = compute_drift(_tiers((0, 0, 0)), risk_tag="moderate")
    assert out is None


def test_template_hint_picks_heaviest_suggestion_for_buy_leg():
    hint = TemplateHint(
        risk_tag="moderate",
        suggestions_by_tier={
            2: [
                SuggestedHolding("BANKBEES",  "NSE", "Bank ETF",   10.0),
                SuggestedHolding("NIFTYBEES", "NSE", "Nifty 50",   18.0),
                SuggestedHolding("MAFANG",    "NSE", "FANG+",       7.0),
            ],
        },
    )
    out = compute_drift(_tiers((80_000, 15_000, 5_000)), risk_tag="moderate", template_hint=hint)
    assert out is not None
    buy = next(o for o in out["orders"] if o["action"] == "buy")
    # Picked the heaviest weight (NIFTYBEES @ 18) over BANKBEES (10) and MAFANG (7).
    assert buy["symbol"] == "NIFTYBEES"
    assert buy["name"]   == "Nifty 50"


def test_template_hint_falls_back_to_generic_when_tier_missing():
    """A template that only covers tier 2 still works for a buy-into-tier-3 leg."""
    hint = TemplateHint(risk_tag="aggressive", suggestions_by_tier={2: []})
    # 40/40/0 — aggressive target is 40/40/20 → tier 3 is -20% underweight.
    out = compute_drift(_tiers((40_000, 40_000, 0)), risk_tag="aggressive", template_hint=hint)
    assert out is not None
    buy = next(o for o in out["orders"] if o["action"] == "buy")
    assert buy["tier_to"] == 3
    # Generic fallback for tier 3 is MOM50.
    assert buy["symbol"] == "MOM50"


def test_drifts_table_includes_all_three_tiers():
    out = compute_drift(_tiers((80_000, 15_000, 5_000)), risk_tag="moderate")
    assert out is not None
    tier_numbers = sorted(d["tier_number"] for d in out["drifts"])
    assert tier_numbers == [1, 2, 3]


def test_estimated_brokerage_scales_with_order_count():
    out = compute_drift(_tiers((80_000, 15_000, 5_000)), risk_tag="moderate")
    assert out is not None
    assert out["estimated_brokerage"] > 0
    # Two orders (buy + sell) at ₹20/order.
    assert out["estimated_brokerage"] == 40.0
