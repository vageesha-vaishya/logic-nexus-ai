"""Drift-based rebalancing detector (Phase 1 Addendum T21).

Pure-functional. Takes the user's tier state + risk_tag (+ optional template
suggestions) and returns a recommendation when ANY tier drifts more than
``DRIFT_THRESHOLD_PCT`` from the template-weight target.

Phase 1 rule set:
  * Tier-level only — no within-tier stock rotation.
  * Cash-neutral baskets: for each underweight tier we suggest BUYs; for each
    overweight tier we suggest informational SELLs.
  * Suggested holdings reuse the matching ``markets.portfolio_templates``
    row so a user adopting the "Balanced" template gets BUYs of NIFTYBEES /
    BANKBEES / MAFANG when their core tier is light.

The router stitches DB I/O around this function so the maths is testable
in isolation.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from markets_worker.jobs.risk_score_compute import (
    TARGET_TIER_WEIGHTS,
    TierObservation,
)

DRIFT_THRESHOLD_PCT = 5.0
# Rough proxy for retail-broker brokerage (₹) per order. Real per-broker
# costs land when the execute path wires through to T10's broker submission.
PER_ORDER_BROKERAGE = 20.0


@dataclass(frozen=True)
class SuggestedHolding:
    symbol:     str
    exchange:   str
    name:       str
    weight_pct: float


@dataclass(frozen=True)
class TemplateHint:
    """Subset of markets.portfolio_templates we need for basket generation.
    Pass an empty list per tier to fall back to generic placeholders."""
    risk_tag: str
    suggestions_by_tier: dict[int, list[SuggestedHolding]]


def _generic_holding(tier_number: int) -> SuggestedHolding:
    # Reasonable defaults when no template is available — keeps the
    # detector usable for unit tests and brand-new accounts.
    if tier_number == 1:
        return SuggestedHolding("LIQUIDBEES", "NSE", "Nippon Liquid ETF",  100.0)
    if tier_number == 2:
        return SuggestedHolding("NIFTYBEES",  "NSE", "Nippon Nifty 50 ETF", 100.0)
    return SuggestedHolding("MOM50", "NSE", "Mirae Momentum 30 ETF", 100.0)


def compute_drift(
    tiers: list[TierObservation],
    risk_tag: str,
    template_hint: TemplateHint | None = None,
) -> dict[str, Any] | None:
    """Return a recommendation payload if any tier drifts > 5%, else None.

    Payload shape matches the addendum spec:
        {
          "reason": "Foundation tier 47% (target 55%)",
          "orders": [
              {"action": "buy", "symbol": "NIFTYBEES", "tier_to": 2,
               "amount_inr": 12500, "name": "Nippon Nifty 50 ETF"},
              {"action": "sell", "symbol": "—", "tier_from": 3,
               "amount_inr": 12500, "name": "Trim from tier 3"}
          ],
          "net_cash_impact": 0,
          "estimated_brokerage": 40,
          "drifts": [ {tier_number, target_pct, actual_pct, drift_pct} ],
          "threshold_pct": 5.0
        }
    """
    total = sum(t.current_value for t in tiers)
    if total <= 0:
        return None  # Nothing invested → nothing to rebalance.

    targets = TARGET_TIER_WEIGHTS.get(risk_tag, TARGET_TIER_WEIGHTS["moderate"])
    drifts: list[dict[str, float]] = []
    breached = False

    for t in tiers:
        target_pct  = float(targets.get(t.tier_number, 0.0))
        actual_pct  = 100.0 * t.current_value / total
        drift_pct   = actual_pct - target_pct  # +ve = overweight, -ve = underweight
        if abs(drift_pct) > DRIFT_THRESHOLD_PCT:
            breached = True
        drifts.append(
            {
                "tier_number": t.tier_number,
                "target_pct":  round(target_pct, 2),
                "actual_pct":  round(actual_pct, 2),
                "drift_pct":   round(drift_pct, 2),
            }
        )

    if not breached:
        return None

    # Pick the worst-underweight tier as the "destination" and the worst-
    # overweight tier as the "source". Single source→single dest keeps the
    # Phase 1 UX simple — multi-leg baskets land with broker integration.
    overweight  = max(drifts, key=lambda d: d["drift_pct"])
    underweight = min(drifts, key=lambda d: d["drift_pct"])

    # Amount to move: ½ of the absolute drift (split keeps both tiers near
    # target without over-correcting in either direction).
    pct_to_move = min(abs(overweight["drift_pct"]), abs(underweight["drift_pct"])) / 2.0
    amount_inr  = round(total * pct_to_move / 100.0, 2)

    # Pick the heaviest-weight suggested holding from the destination tier
    # (the BUY) — that's the basket leg the user can click through to
    # execute later. The SELL side stays generic in Phase 1 because we don't
    # know which specific holdings the user owns in the source tier.
    dest_tier = int(underweight["tier_number"])
    src_tier  = int(overweight["tier_number"])
    dest_suggestions = (
        template_hint.suggestions_by_tier.get(dest_tier, [])
        if template_hint
        else []
    )
    if dest_suggestions:
        dest_pick = max(dest_suggestions, key=lambda s: s.weight_pct)
    else:
        dest_pick = _generic_holding(dest_tier)

    orders = [
        {
            "action":     "buy",
            "symbol":     dest_pick.symbol,
            "exchange":   dest_pick.exchange,
            "name":       dest_pick.name,
            "tier_to":    dest_tier,
            "amount_inr": amount_inr,
        },
        {
            "action":     "sell",
            "symbol":     None,
            "name":       f"Trim ₹{amount_inr:,.0f} from tier {src_tier}",
            "tier_from":  src_tier,
            "amount_inr": amount_inr,
        },
    ]

    return {
        "reason": (
            f"Tier {dest_tier} is "
            f"{underweight['actual_pct']:.0f}% (target {underweight['target_pct']:.0f}%); "
            f"tier {src_tier} is {overweight['actual_pct']:.0f}% (target {overweight['target_pct']:.0f}%)."
        ),
        "orders":              orders,
        "net_cash_impact":     0.0,
        "estimated_brokerage": PER_ORDER_BROKERAGE * len(orders),
        "drifts":              drifts,
        "threshold_pct":       DRIFT_THRESHOLD_PCT,
    }
