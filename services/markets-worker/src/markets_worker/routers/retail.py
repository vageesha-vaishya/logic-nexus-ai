"""Retail investment profile, tier, and signal-feed endpoints.

All endpoints require an authenticated Supabase user (or service account with
appropriate scope). Database access is RLS-protected on the markets schema —
the API stamps `user_id` from the verified auth context, never from the
request body, so users can only read/write their own rows.
"""
from __future__ import annotations

from typing import Any, Literal

import structlog
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail", tags=["retail"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class Goal(BaseModel):
    goal: str
    years: int
    target_amount: float | None = None


class UpsertProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experience_level: Literal["beginner", "casual", "self_directed"]
    risk_tag:         Literal["conservative", "moderate", "aggressive"]
    goals:            list[Goal]               = Field(default_factory=list)
    behavioral_flags: dict[str, Any]           = Field(default_factory=dict)
    quiz_answers:     dict[str, Any]           = Field(default_factory=dict)
    onboarding_complete: bool                  = False


class UpsertTierRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name:          Literal["Safety Net", "Core Portfolio", "Experimental"]
    portfolio_id:  str | None      = None
    target_amount: float | None    = None
    goals:         list[str]       = Field(default_factory=list)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_user_id(auth: Auth) -> str:
    """Resolve the calling user id. Service-account calls are rejected here —
    retail endpoints are inherently per-user. If we add ops/admin endpoints
    later they should live on a separate router with its own auth check."""
    if not auth.user_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Retail endpoints require a user-authenticated request",
        )
    return auth.user_id


# ── Risk profile ──────────────────────────────────────────────────────────────

@router.get("/profile")
def get_profile(auth: Auth) -> dict[str, Any]:
    user_id = _require_user_id(auth)
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("risk_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Risk profile not found")
    return res.data


@router.post("/profile", status_code=status.HTTP_201_CREATED)
def upsert_profile(body: UpsertProfileRequest, auth: Auth) -> dict[str, Any]:
    user_id = _require_user_id(auth)
    sb = get_supabase()

    payload = body.model_dump()
    payload["goals"] = [g if isinstance(g, dict) else g.model_dump() for g in payload["goals"]]
    payload["user_id"] = user_id

    res = (
        sb.schema("markets")
        .from_("risk_profiles")
        .upsert(payload, on_conflict="user_id")
        .select()
        .execute()
    )
    # postgrest 2.x: .single() not available after upsert; unwrap first row
    return (res.data[0] if isinstance(res.data, list) and res.data else res.data) or {}


# ── Portfolio tiers ───────────────────────────────────────────────────────────

@router.get("/tiers")
def get_tiers(auth: Auth) -> list[dict[str, Any]]:
    user_id = _require_user_id(auth)
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("portfolio_tiers")
        .select("*")
        .eq("user_id", user_id)
        .order("tier_number")
        .execute()
    )
    return res.data or []


@router.post("/tiers/{tier_number}", status_code=status.HTTP_201_CREATED)
def upsert_tier(
    tier_number: int,
    body: UpsertTierRequest,
    auth: Auth,
) -> dict[str, Any]:
    if tier_number not in (1, 2, 3):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="tier_number must be 1, 2, or 3")

    user_id = _require_user_id(auth)
    sb = get_supabase()
    payload = {**body.model_dump(), "tier_number": tier_number, "user_id": user_id}

    res = (
        sb.schema("markets")
        .from_("portfolio_tiers")
        .upsert(payload, on_conflict="user_id,tier_number")
        .select()
        .execute()
    )
    # postgrest 2.x: .single() not available after upsert; unwrap first row
    return (res.data[0] if isinstance(res.data, list) and res.data else res.data) or {}


# ── Retail signal feed ────────────────────────────────────────────────────────
#
# Surfaces a curated slice of markets.signals: only asset classes the retail
# product supports (equity + mutual_fund by default), only signals above a
# minimum confidence threshold, only those still inside their validity window.
# Each row is returned with its raw `metadata` (Task 5 populates an
# `explanations` block keyed by experience_level).

@router.get("/signals")
def get_retail_signals(
    auth: Auth,
    limit:          int   = Query(20, ge=1, le=100),
    asset_class:    str | None = Query(None, pattern=r"^(equity|mf|fo|fx|bond|commodity)$"),
    horizon:        str | None = Query(None, pattern=r"^(intraday|short_term|medium_term|long_term)$"),
    min_confidence: float = Query(0.60, ge=0.0, le=1.0),
) -> list[dict[str, Any]]:
    _require_user_id(auth)
    sb = get_supabase()

    # Phase 2: default to every asset class the signal generator emits.
    # Vocabulary mirrors _derive_asset_class() in jobs/signal_generator.py.
    asset_classes = [asset_class] if asset_class else [
        "equity", "mf", "fo", "fx", "bond", "commodity",
    ]

    q = (
        sb.schema("markets")
        .from_("signals")
        .select(
            "id, ts, instrument_id, signal_type, direction, confidence, "
            "rationale, price_at_signal, expires_at, metadata, horizon, "
            "asset_class, risk_params, score, "
            "instrument:instruments(symbol, exchange, instrument_type)"
        )
        .gte("confidence", min_confidence)
        .in_("asset_class", asset_classes)
        .not_.is_("expires_at", "null")
        .gte("expires_at", "now()")
        .order("ts", desc=True)
        .limit(limit)
    )
    if horizon:
        q = q.eq("horizon", horizon)
    res = q.execute()
    return res.data or []
