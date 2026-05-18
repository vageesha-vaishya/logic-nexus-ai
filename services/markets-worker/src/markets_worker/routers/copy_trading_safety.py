"""
Extended copy trading safety limits.

POST /v1/copy-trades/safety/{copy_trade_id}  — set safety limits
GET  /v1/copy-trades/safety/{copy_trade_id}  — get current safety limits
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/copy-trades/safety", tags=["copy-trades"])


class SetSafetyLimitsRequest(BaseModel):
    budget_cap: float | None = None
    max_drawdown_pct: float | None = None
    target_tier_number: int = 3


@router.post("/{copy_trade_id}", status_code=201)
async def set_safety_limits(copy_trade_id: str, body: SetSafetyLimitsRequest, auth: Auth):
    if body.target_tier_number != 3:
        raise HTTPException(422, detail="Copy trading is only allowed in Experimental tier (tier_number=3)")
    db = get_supabase()
    try:
        result = db.schema("markets").from_("copy_trading_extended").insert({
            "copy_trade_id": copy_trade_id,
            "target_tier_number": 3,
            "budget_cap": body.budget_cap,
            "max_drawdown_pct": body.max_drawdown_pct,
        }).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    return (result.data or [{}])[0]


@router.get("/{copy_trade_id}")
async def get_safety_limits(copy_trade_id: str, auth: Auth):
    db = get_supabase()
    row = (
        db.schema("markets").from_("copy_trading_extended")
        .select("copy_trade_id, target_tier_number, budget_cap, max_drawdown_pct, auto_unfollowed_at")
        .eq("copy_trade_id", copy_trade_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(404, detail="No safety limits set for this copy relationship")
    return row
