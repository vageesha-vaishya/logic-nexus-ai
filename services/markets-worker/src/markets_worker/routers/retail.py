"""Retail investment profile and portfolio tier management.

GET    /v1/retail/profile           — fetch user's risk profile
POST   /v1/retail/profile           — upsert risk profile
GET    /v1/retail/tiers             — list portfolio tiers (1-3)
POST   /v1/retail/tiers/{tier_number} — upsert a portfolio tier
GET    /v1/retail/signals           — retail-grade signal feed
"""
from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail", tags=["retail"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class Goal(BaseModel):
    goal: str
    years: int


class UpsertProfileRequest(BaseModel):
    experience_level: str
    risk_tag: str
    goals: list[Goal] = []
    behavioral_flags: dict[str, Any] = {}
    quiz_answers: dict[str, Any] = {}
    onboarding_complete: bool = False


class UpsertTierRequest(BaseModel):
    tier_number: int
    name: str
    portfolio_id: str | None = None
    target_amount: float | None = None
    goals: list[str] = []


# ── Risk profile ──────────────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(auth: Auth):
    """Fetch the authenticated user's risk/experience profile."""
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("risk_profiles")
        .select("*")
        .eq("user_id", auth.user_id)
        .maybe_single()
        .execute()
    )
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    if not res.data:
        raise HTTPException(status_code=404, detail="Risk profile not found")
    return res.data


@router.post("/profile", status_code=201)
async def upsert_profile(
    body: UpsertProfileRequest,
    auth: Auth,
):
    """Create or update the authenticated user's risk/experience profile."""
    sb = get_supabase()
    payload = {
        **body.model_dump(exclude={"goals"}),
        "goals": [g.model_dump() for g in body.goals],
        "user_id": auth.user_id,
    }
    res = (
        sb.schema("markets")
        .from_("risk_profiles")
        .upsert(payload, on_conflict="user_id")
        .select()
        .single()
        .execute()
    )
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    return res.data


# ── Portfolio tiers ───────────────────────────────────────────────────────────

@router.get("/tiers")
async def get_tiers(auth: Auth):
    """List the user's portfolio tiers ordered by tier_number."""
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("portfolio_tiers")
        .select("*")
        .eq("user_id", auth.user_id)
        .order("tier_number")
        .execute()
    )
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    return res.data or []


@router.post("/tiers/{tier_number}", status_code=201)
async def upsert_tier(
    tier_number: int,
    body: UpsertTierRequest,
    auth: Auth,
):
    """Create or update a portfolio tier (1 = Foundation, 2 = Core, 3 = Satellite)."""
    if tier_number not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="tier_number must be 1, 2, or 3")
    sb = get_supabase()
    payload = {**body.model_dump(), "tier_number": tier_number, "user_id": auth.user_id}
    res = (
        sb.schema("markets")
        .from_("portfolio_tiers")
        .upsert(payload, on_conflict="user_id,tier_number")
        .select()
        .single()
        .execute()
    )
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    return res.data


# ── Retail signal feed ────────────────────────────────────────────────────────

@router.get("/signals")
async def get_retail_signals(
    auth: Auth,
    limit: int = 20,
    asset_class: str | None = None,
    horizon: str | None = None,
    min_confidence: float = 0.60,
):
    """Return active signals filtered for retail investors (equity + MF by default)."""
    sb = get_supabase()
    asset_classes = [asset_class] if asset_class else ["equity", "mutual_fund"]
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
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    return res.data or []
