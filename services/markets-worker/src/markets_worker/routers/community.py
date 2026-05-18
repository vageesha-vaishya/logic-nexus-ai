"""
Community layer: baskets, strategy marketplace, creator verification.

GET  /v1/community/creator-status            — is current user a verified creator?
GET  /v1/community/baskets                   — list published baskets
POST /v1/community/baskets                   — create basket (verified creators only, 201)
GET  /v1/community/baskets/{id}/holdings     — basket instrument weights
POST /v1/community/baskets/{id}/invest       — one-tap invest in basket
GET  /v1/community/strategies                — list published strategies
POST /v1/community/strategies                — create strategy (verified creators only, 201)
POST /v1/community/strategies/{id}/deploy    — deploy strategy (paper phase blocked)
"""
from __future__ import annotations

from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/community", tags=["community"])


def _is_verified(db, user_id: str) -> bool:
    row = (
        db.schema("markets").from_("risk_profiles")
        .select("verified_creator")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    ).data
    return bool((row or {}).get("verified_creator", False))


def _require_verified(db, user_id: str) -> None:
    if not _is_verified(db, user_id):
        raise HTTPException(403, detail="Only verified creators can perform this action")


@router.get("/creator-status")
async def get_creator_status(auth: Auth):
    db = get_supabase()
    return {"is_verified": _is_verified(db, auth.user_id)}


class CreateBasketRequest(BaseModel):
    name: str
    theme: str
    description: str = ""
    risk_level: Literal["low", "medium", "high"] = "medium"
    rebalance_freq: Literal["monthly", "quarterly", "yearly"] = "quarterly"


class InvestRequest(BaseModel):
    amount: float
    portfolio_id: str | None = None


@router.get("/baskets")
async def list_baskets(auth: Auth, limit: int = 20):
    db = get_supabase()
    result = (
        db.schema("markets").from_("community_baskets")
        .select("id, name, theme, description, risk_level, rebalance_freq, follower_count, total_invested, creator_id, created_at")
        .eq("status", "published")
        .order("follower_count", desc=True)
        .limit(limit)
        .execute()
    )
    return {"baskets": result.data or []}


@router.post("/baskets", status_code=201)
async def create_basket(body: CreateBasketRequest, auth: Auth):
    db = get_supabase()
    _require_verified(db, auth.user_id)
    try:
        result = db.schema("markets").from_("community_baskets").insert({
            "creator_id": auth.user_id,
            "name": body.name,
            "theme": body.theme,
            "description": body.description,
            "risk_level": body.risk_level,
            "rebalance_freq": body.rebalance_freq,
        }).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    rows = result.data or []
    if not rows:
        raise HTTPException(500, detail="Insert returned no data")
    return rows[0]


@router.get("/baskets/{basket_id}/holdings")
async def get_basket_holdings(basket_id: str, auth: Auth):
    db = get_supabase()
    result = (
        db.schema("markets").from_("basket_holdings")
        .select("id, basket_id, weight_pct, instrument_id, instrument:instruments(symbol, exchange, instrument_type)")
        .eq("basket_id", basket_id)
        .execute()
    )
    return {"holdings": result.data or []}


@router.post("/baskets/{basket_id}/invest")
async def invest_in_basket(basket_id: str, body: InvestRequest, auth: Auth):
    if body.amount <= 0:
        raise HTTPException(422, detail="Investment amount must be positive")
    db = get_supabase()
    # Verify basket exists
    basket_check = (
        db.schema("markets").from_("community_baskets")
        .select("id, total_invested")
        .eq("id", basket_id)
        .maybe_single()
        .execute()
    ).data
    if not basket_check:
        raise HTTPException(404, detail="Basket not found")
    try:
        existing = (
            db.schema("markets").from_("basket_user_positions")
            .select("id, invested_amt")
            .eq("user_id", auth.user_id)
            .eq("basket_id", basket_id)
            .maybe_single()
            .execute()
        ).data
        if existing:
            db.schema("markets").from_("basket_user_positions") \
                .update({"invested_amt": existing["invested_amt"] + body.amount}) \
                .eq("id", existing["id"]).execute()
        else:
            db.schema("markets").from_("basket_user_positions").insert({
                "user_id": auth.user_id,
                "basket_id": basket_id,
                "invested_amt": body.amount,
                "portfolio_id": body.portfolio_id,
            }).execute()
        current_total = float((basket_check or {}).get("total_invested", 0) or 0)
        db.schema("markets").from_("community_baskets") \
            .update({"total_invested": current_total + body.amount}) \
            .eq("id", basket_id).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    return {"basket_id": basket_id, "invested": body.amount, "status": "confirmed"}


class CreateStrategyRequest(BaseModel):
    name: str
    description: str = ""
    asset_class: str
    rule_config: dict = {}
    backtest_summary: dict = {}


@router.get("/strategies")
async def list_strategies(auth: Auth, limit: int = 20):
    db = get_supabase()
    result = (
        db.schema("markets").from_("strategy_marketplace")
        .select("id, name, description, asset_class, backtest_summary, live_users, rating, paper_required_days, creator_id, created_at")
        .eq("status", "published")
        .order("rating", desc=True)
        .limit(limit)
        .execute()
    )
    return {"strategies": result.data or []}


@router.post("/strategies", status_code=201)
async def create_strategy(body: CreateStrategyRequest, auth: Auth):
    db = get_supabase()
    _require_verified(db, auth.user_id)
    try:
        result = db.schema("markets").from_("strategy_marketplace").insert({
            "creator_id": auth.user_id,
            "name": body.name,
            "description": body.description,
            "asset_class": body.asset_class,
            "rule_config": body.rule_config,
            "backtest_summary": body.backtest_summary,
        }).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    rows = result.data or []
    if not rows:
        raise HTTPException(500, detail="Insert returned no data")
    return rows[0]


@router.post("/strategies/{strategy_id}/deploy")
async def deploy_strategy(strategy_id: str, auth: Auth):
    db = get_supabase()
    progress = (
        db.schema("markets").from_("autonomy_progress")
        .select("current_phase")
        .eq("user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    current_phase = (progress or {}).get("current_phase", "paper")
    if current_phase == "paper":
        raise HTTPException(400, detail="Complete paper trading phase before deploying community strategies")
    try:
        db.schema("markets").from_("behavioral_events").insert({
            "user_id": auth.user_id,
            "event_type": "education_shown",
            "severity": "info",
            "metadata": {"action": "strategy_deployed", "strategy_id": strategy_id},
        }).execute()
    except Exception:
        pass
    return {"strategy_id": strategy_id, "status": "deployed", "phase": current_phase}
