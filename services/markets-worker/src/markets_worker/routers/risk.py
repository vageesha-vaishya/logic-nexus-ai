"""Dynamic portfolio risk score (Phase 1 Addendum T17).

GET /v1/retail/risk-score
    Computes the current 0-10 risk score for the authenticated user from
    their portfolio_tiers + risk_profile, persists the snapshot to
    portfolio_risk_history, and returns:

        {
          "current": { "score", "target_score", "components", "computed_at" },
          "history": [ ...last 30 snapshots, newest first ]
        }

    Computation is on-demand today. T19's nightly Portfolio Health Diagnostic
    job will write rows directly so the read path becomes a pure DB lookup.

The compute logic itself lives in markets_worker.jobs.risk_score_compute and
is pure-functional so the maths can be unit-tested without DB stubs.
"""
from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, status

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.jobs.risk_score_compute import (
    TierObservation,
    compute_risk_score,
)
from markets_worker.routers.retail import _require_user_id

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail", tags=["retail-risk"])


def _fetch_user_state(user_id: str) -> tuple[str | None, list[dict[str, Any]]]:
    """Pull risk_tag + tiers in two minimal queries. RLS already scopes by
    user_id; the .eq() is defence-in-depth so a future RLS relaxation can't
    accidentally leak rows here."""
    sb = get_supabase()

    profile_res = (
        sb.schema("markets")
        .from_("risk_profiles")
        .select("risk_tag")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    risk_tag = (profile_res.data or {}).get("risk_tag") if profile_res else None

    tiers_res = (
        sb.schema("markets")
        .from_("portfolio_tiers")
        .select("tier_number, portfolio_id, target_amount")
        .eq("user_id", user_id)
        .order("tier_number")
        .execute()
    )
    return risk_tag, tiers_res.data or []


def _tier_market_value(portfolio_id: str | None) -> float:
    """Latest snapshot NAV for the linked portfolio. Falls back to 0 when:
       - tier has no linked portfolio
       - portfolio has no snapshot rows yet (new account)
       - query errors (we never want this endpoint to 500 on a soft failure)."""
    if not portfolio_id:
        return 0.0
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("portfolio_snapshots")
            .select("total_nav")
            .eq("portfolio_id", portfolio_id)
            .order("snapshot_date", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return 0.0
        return float(rows[0].get("total_nav") or 0.0)
    except Exception as exc:  # noqa: BLE001 — soft-fail per docstring above
        logger.warning("risk_score.nav_fetch_failed", portfolio_id=portfolio_id, error=str(exc))
        return 0.0


@router.get("/risk-score")
def get_risk_score(auth: Auth) -> dict[str, Any]:
    user_id = _require_user_id(auth)

    risk_tag, tier_rows = _fetch_user_state(user_id)
    if not risk_tag:
        raise HTTPException(
            status.HTTP_412_PRECONDITION_FAILED,
            detail="Risk profile not set; complete onboarding first",
        )

    observations: list[TierObservation] = [
        TierObservation(
            tier_number=int(row["tier_number"]),
            current_value=_tier_market_value(row.get("portfolio_id")),
            # Drawdown is stubbed at 0 in Phase 1 — T19's nightly diagnostic
            # job will compute it from portfolio_nav_history and overwrite
            # the components blob.
            drawdown_pct_6m=0.0,
        )
        for row in tier_rows
    ]

    result = compute_risk_score(observations, risk_tag=risk_tag)

    sb = get_supabase()
    # Persist snapshot. We deliberately don't dedupe — every GET appends so
    # a sparkline reflects user behaviour (refreshing the dashboard often
    # IS a behavioural signal).
    inserted = (
        sb.schema("markets")
        .from_("portfolio_risk_history")
        .insert(
            {
                "user_id":      user_id,
                "score":        result.score,
                "target_score": result.target_score,
                "components":   result.components,
            }
        )
        .select("computed_at")
        .execute()
    )
    # postgrest 2.x: .single() not available after insert
    inserted_row = (inserted.data[0] if isinstance(inserted.data, list) and inserted.data else inserted.data) or {}
    computed_at = inserted_row.get("computed_at")

    history_res = (
        sb.schema("markets")
        .from_("portfolio_risk_history")
        .select("computed_at, score, target_score, components")
        .eq("user_id", user_id)
        .order("computed_at", desc=True)
        .limit(30)
        .execute()
    )

    return {
        "current": {
            "score":        result.score,
            "target_score": result.target_score,
            "components":   result.components,
            "computed_at":  computed_at,
        },
        "history": history_res.data or [],
    }
