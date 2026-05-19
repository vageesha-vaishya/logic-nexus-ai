"""Drift-based rebalance recommendations (Phase 1 Addendum T21).

GET  /v1/retail/rebalance/pending
    Run the drift detector for the authenticated user.
    - Expire any prior pending row with expires_at < now (status → expired).
    - If drift is detected and the user has no live pending row, insert one.
    - If drift is detected and a pending row already exists, return it as-is
      (no churn from multi-day repeated breaches).
    - If drift is NOT detected, return null. Caller renders nothing.

POST /v1/retail/rebalance/{id}/dismiss
    Marks status = dismissed. No SEBI audit trail beyond the timestamp.

POST /v1/retail/rebalance/{id}/execute
    Marks status = executed. Records confirm_method + executed_at for the
    SEBI audit trail (addendum §4). The actual broker submission is deferred
    to a follow-up — this endpoint is the user's "I authorise this trade"
    confirmation step; the broker leg can pick up the row by status.
"""
from __future__ import annotations

from typing import Any, Literal

import structlog
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.jobs.drift_detector import (
    SuggestedHolding,
    TemplateHint,
    compute_drift,
)
from markets_worker.jobs.risk_score_compute import TierObservation
from markets_worker.routers.retail import _require_user_id

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail/rebalance", tags=["retail-rebalance"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class ExecuteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm_method: Literal["biometric", "password", "web"] = "web"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _tier_market_value(portfolio_id: str | None) -> float:
    """Latest snapshot NAV — same logic as the risk-score router."""
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
    except Exception as exc:  # noqa: BLE001 — soft-fail so endpoint never 500s
        logger.warning(
            "rebalance.nav_fetch_failed", portfolio_id=portfolio_id, error=str(exc)
        )
        return 0.0


def _template_hint_for(risk_tag: str) -> TemplateHint | None:
    """Pull the matching template row so the detector can suggest holdings.

    Lookup is by template.risk_tag = user.risk_tag — i.e. a 'moderate' user
    gets the 'Balanced' template. Returns None on miss so the detector falls
    back to generic placeholders.
    """
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("portfolio_templates")
            .select("risk_tag, tier_allocations")
            .eq("risk_tag", risk_tag)
            .eq("is_active", True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        if not res or not res.data:
            return None
        row = res.data
        suggestions: dict[int, list[SuggestedHolding]] = {}
        for tier_alloc in row.get("tier_allocations") or []:
            tier_n = int(tier_alloc.get("tier_number"))
            picks: list[SuggestedHolding] = []
            for h in tier_alloc.get("suggested_holdings") or []:
                picks.append(
                    SuggestedHolding(
                        symbol=str(h.get("symbol", "")),
                        exchange=str(h.get("exchange", "NSE")),
                        name=str(h.get("name", "")),
                        weight_pct=float(h.get("weight_pct") or 0.0),
                    )
                )
            suggestions[tier_n] = picks
        return TemplateHint(risk_tag=risk_tag, suggestions_by_tier=suggestions)
    except Exception as exc:  # noqa: BLE001
        logger.warning("rebalance.template_fetch_failed", error=str(exc))
        return None


def _expire_stale_pending(user_id: str) -> None:
    """Flip any past-expiry pending row to 'expired' before checking for new ones."""
    sb = get_supabase()
    try:
        (
            sb.schema("markets")
            .from_("rebalance_recommendations")
            .update({"status": "expired"})
            .eq("user_id", user_id)
            .eq("status", "pending")
            .lt("expires_at", "now()")
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("rebalance.expire_failed", user_id=user_id, error=str(exc))


def _fetch_pending(user_id: str) -> dict[str, Any] | None:
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("rebalance_recommendations")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/pending")
def get_pending(auth: Auth) -> dict[str, Any] | None:
    user_id = _require_user_id(auth)
    _expire_stale_pending(user_id)

    existing = _fetch_pending(user_id)
    if existing:
        return existing

    # No live pending row — run the detector. Requires risk_profile + tiers.
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
    if not risk_tag:
        # Don't block the endpoint; just return null so the UI hides the card.
        return None

    tiers_res = (
        sb.schema("markets")
        .from_("portfolio_tiers")
        .select("tier_number, portfolio_id")
        .eq("user_id", user_id)
        .order("tier_number")
        .execute()
    )
    observations = [
        TierObservation(
            tier_number=int(row["tier_number"]),
            current_value=_tier_market_value(row.get("portfolio_id")),
            drawdown_pct_6m=0.0,
        )
        for row in (tiers_res.data or [])
    ]

    payload = compute_drift(
        observations,
        risk_tag=risk_tag,
        template_hint=_template_hint_for(risk_tag),
    )
    if payload is None:
        return None

    inserted = (
        sb.schema("markets")
        .from_("rebalance_recommendations")
        .insert(
            {
                "user_id": user_id,
                "payload": payload,
                "status":  "pending",
            }
        )
        .select("*")
        .single()
        .execute()
    )

    # Fire an in-app + system push so users see the rec without having to
    # open the app. notify_user_sync soft-fails everything internally — a
    # missing FCM credential or stale token never breaks the rec creation.
    try:
        from markets_worker.notifications import notify_user_sync  # noqa: PLC0415
        notify_user_sync(
            user_id,
            category="rebalance",
            title="Time to rebalance",
            body=str(payload.get("reason") or "Your portfolio drifted from plan."),
            severity="warning",
            data={"rec_id": (inserted.data or {}).get("id", "")},
            link_url="/dashboard/markets/retail/home",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("rebalance.notify_failed", error=str(exc))

    return inserted.data


@router.post("/{rec_id}/dismiss")
def dismiss(rec_id: str, auth: Auth) -> dict[str, Any]:
    user_id = _require_user_id(auth)
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("rebalance_recommendations")
        .update({"status": "dismissed"})
        .eq("id", rec_id)
        .eq("user_id", user_id)
        .eq("status", "pending")
        .select("*")
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found or already settled",
        )
    return res.data


@router.post("/{rec_id}/execute")
def execute(rec_id: str, body: ExecuteRequest, auth: Auth) -> dict[str, Any]:
    """Record the SEBI-audit confirmation. Actual broker submission lands
    in a follow-up — it picks up rows by status='executed'."""
    user_id = _require_user_id(auth)
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("rebalance_recommendations")
        .update(
            {
                "status":          "executed",
                "executed_at":     "now()",
                "confirm_method":  body.confirm_method,
            }
        )
        .eq("id", rec_id)
        .eq("user_id", user_id)
        .eq("status", "pending")
        .select("*")
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found or already settled",
        )
    logger.info(
        "rebalance.executed",
        rec_id=rec_id,
        user_id=user_id,
        confirm_method=body.confirm_method,
    )
    return res.data
