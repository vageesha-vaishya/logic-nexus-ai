"""Retail behavioral support router.

GET  /v1/retail/behavioral/market-stress          — real-time market stress indicator
POST /v1/retail/behavioral/events                 — log a behavioral event for the user
PATCH /v1/retail/behavioral/events/{id}/acknowledge — acknowledge a behavioral event
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.routers.ltp import _ltp_cache

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail/behavioral", tags=["retail-behavioral"])

# Staleness threshold in seconds — cache entries older than this are ignored
_STALE_TTL = 60.0

# Allowed behavioral event types
_VALID_EVENT_TYPES = frozenset({
    "yellow_alert",
    "red_alert",
    "green_alert",
    "sip_pause",
    "sip_resume",
    "rebalance_triggered",
    "goal_milestone",
    "drawdown_breach",
    "volatility_spike",
    "panic_sell_risk",
    "overtrading_risk",
})


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_cached_quote(key: str) -> tuple[dict | None, bool]:
    """Return (quote dict, is_stale) from _ltp_cache.

    Returns (None, True) if the key is absent.
    Returns the quote even if stale — callers decide how to surface staleness.
    """
    entry = _ltp_cache.get(key)
    if entry is None:
        return None, True
    ts, quote = entry
    is_stale = time.time() - ts > _STALE_TTL
    return quote, is_stale


def _compute_change_pct(quote: dict) -> float | None:
    """Compute % change from prev_price or prev_close vs ltp."""
    ltp = quote.get("ltp")
    prev = quote.get("prev_price") or quote.get("prev_close")
    if ltp is None or prev is None or prev == 0:
        return None
    return (ltp - prev) / prev * 100


# ── Models ────────────────────────────────────────────────────────────────────

class BehavioralEventRequest(BaseModel):
    event_type: str
    severity: Literal["info", "warning", "critical"]
    metadata: dict[str, Any] = {}

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in _VALID_EVENT_TYPES:
            raise ValueError(
                f"event_type '{v}' is not valid. "
                f"Allowed: {sorted(_VALID_EVENT_TYPES)}"
            )
        return v


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/market-stress")
async def get_market_stress(auth: Auth):
    """Return a real-time market stress indicator based on NIFTY 50 and INDIA VIX."""
    nifty_quote, nifty_stale = _get_cached_quote("NIFTY 50:NSE")
    vix_quote, vix_stale = _get_cached_quote("INDIA VIX:NSE")

    nifty_change_pct: float | None = None
    nifty_current: float | None = None
    vix_current: float | None = None
    vix_prev: float | None = None

    if nifty_quote is not None:
        nifty_current = nifty_quote.get("ltp")
        nifty_change_pct = _compute_change_pct(nifty_quote)

    if vix_quote is not None:
        vix_current = vix_quote.get("ltp")
        vix_prev = vix_quote.get("prev_price") or vix_quote.get("prev_close")

    # Determine stress level
    stress_level = "low"

    # VIX spike check (>25% surge vs prev) → high regardless of NIFTY
    if vix_current is not None and vix_prev and vix_prev > 0:
        if vix_current > vix_prev * 1.25:
            stress_level = "high"

    # NIFTY change overrides if not already high
    if nifty_change_pct is not None:
        if nifty_change_pct <= -2.0:
            stress_level = "high"
        elif nifty_change_pct <= -1.0 and stress_level != "high":
            stress_level = "medium"

    return {
        "nifty_current": nifty_current,
        "nifty_change_pct": nifty_change_pct,
        "vix_current": vix_current,
        "vix_prev": vix_prev,
        "stress_level": stress_level,
        "data_available": nifty_quote is not None,
        "data_stale": nifty_stale,
    }


@router.get("/events")
async def list_behavioral_events(auth: Auth, limit: int = 10):
    """Return recent unacknowledged behavioral events for the current user."""
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .select("*")
            .eq("user_id", auth.user_id)
            .is_("acknowledged_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral_events_fetch_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Database error")
    return res.data or []


@router.post("/events", status_code=201)
async def log_behavioral_event(
    body: BehavioralEventRequest,
    auth: Auth,
):
    """Log a behavioral event (alert, trigger, milestone) for the authenticated user."""
    sb = get_supabase()
    payload = {
        "user_id": auth.user_id,
        "event_type": body.event_type,
        "severity": body.severity,
        "metadata": body.metadata,
        "acknowledged": False,
    }
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .insert(payload)
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral_event_log_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Database error")
    return res.data


@router.patch("/events/{event_id}/acknowledge")
async def acknowledge_event(
    event_id: str,
    auth: Auth,
):
    """Mark a behavioral event as acknowledged by the user."""
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .update({"acknowledged_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", event_id)
            .eq("user_id", auth.user_id)
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral_event_ack_failed", error=str(exc), event_id=event_id)
        raise HTTPException(status_code=500, detail="Database error")
    return res.data
