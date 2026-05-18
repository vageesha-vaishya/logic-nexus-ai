"""
Retail behavioral support — market stress + behavioral event log.

Routes (all under /v1/retail/behavioral):
  GET   /market-stress              — Nifty50 + India VIX stress summary
  POST  /events                     — Log a behavioral event
  PATCH /events/{event_id}/acknowledge — Mark an event as seen
  GET   /events                     — Recent unacknowledged events for user

The stress endpoint reads the in-process LTP cache populated by
routers.ltp.refresh_ltp(); we never block on a live broker call here.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Literal

import structlog
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.routers.ltp import _ltp_cache  # shared in-process cache

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail/behavioral", tags=["retail-behavioral"])

# ── Tunables ─────────────────────────────────────────────────────────────────

_NIFTY_STRESS_THRESHOLD_PCT = -2.0  # intraday fall in % → "high" stress
_NIFTY_MEDIUM_THRESHOLD_PCT = -1.0  # intraday fall in % → "medium" stress
_VIX_SPIKE_MULTIPLIER       = 1.25  # VIX 25% above prev close → "high"
_VIX_ELEVATED_LEVEL         = 20.0  # absolute VIX > 20 → at least "medium"
_CACHE_STALE_SECONDS        = 60    # LTP entries older than this are ignored

VALID_EVENT_TYPES: set[str] = {
    "yellow_alert", "orange_alert", "red_alert", "cooling_off",
    "education_shown", "panic_sell_intercepted", "cooling_off_waited",
}


# ── Pydantic models ──────────────────────────────────────────────────────────

class LogEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_type: Literal[
        "yellow_alert", "orange_alert", "red_alert", "cooling_off",
        "education_shown", "panic_sell_intercepted", "cooling_off_waited",
    ]
    severity: Literal["info", "warning", "critical"]
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _require_user_id(auth: Auth) -> str:
    if not auth.user_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Behavioral endpoints require a user-authenticated request",
        )
    return auth.user_id


def _get_cached_quote(symbol: str, exchange: str) -> dict | None:
    """Return the cached quote dict for symbol:exchange if fresh, else None.

    The cache is keyed `"SYMBOL:EXCHANGE"` (upper) and stores
    `(time.monotonic(), quote_dict)`. We compare against the monotonic clock
    so wall-clock drift can't make entries appear stale or fresh by accident.
    """
    key = f"{symbol}:{exchange}".upper()
    entry = _ltp_cache.get(key)
    if not entry:
        return None
    ts, quote = entry
    if (time.monotonic() - ts) > _CACHE_STALE_SECONDS:
        return None
    return quote


def _compute_stress(nifty_quote: dict | None, vix_quote: dict | None) -> dict:
    nifty_change_pct = 0.0
    vix_current = 0.0
    vix_prev = 0.0
    nifty_ltp_value: float | None = None

    if nifty_quote:
        ltp  = float(nifty_quote.get("ltp")  or nifty_quote.get("close")      or 0)
        prev = float(nifty_quote.get("prev_price") or nifty_quote.get("prev_close") or ltp)
        if prev:
            nifty_change_pct = ((ltp - prev) / prev) * 100
        nifty_ltp_value = ltp or None

    if vix_quote:
        vix_current = float(vix_quote.get("ltp")  or vix_quote.get("close")      or 0)
        vix_prev    = float(vix_quote.get("prev_price") or vix_quote.get("prev_close") or vix_current)

    vix_spiked = vix_prev > 0 and vix_current > vix_prev * _VIX_SPIKE_MULTIPLIER

    if nifty_change_pct <= _NIFTY_STRESS_THRESHOLD_PCT or vix_spiked:
        stress_level = "high"
    elif nifty_change_pct <= _NIFTY_MEDIUM_THRESHOLD_PCT or vix_current > _VIX_ELEVATED_LEVEL:
        stress_level = "medium"
    else:
        stress_level = "low"

    return {
        "nifty_change_pct": round(nifty_change_pct, 2),
        "vix_current":      round(vix_current,     2),
        "vix_prev":         round(vix_prev,        2),
        "stress_level":     stress_level,
        "nifty_ltp":        nifty_ltp_value,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/market-stress")
def get_market_stress(auth: Auth) -> dict[str, Any]:
    _require_user_id(auth)
    nifty = _get_cached_quote("NIFTY 50", "NSE")
    vix   = _get_cached_quote("INDIA VIX", "NSE")
    return _compute_stress(nifty, vix)


@router.post("/events", status_code=status.HTTP_201_CREATED)
def log_behavioral_event(body: LogEventRequest, auth: Auth) -> dict[str, Any] | list[dict[str, Any]] | None:
    user_id = _require_user_id(auth)
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .insert({
                "user_id":    user_id,
                "event_type": body.event_type,
                "severity":   body.severity,
                "metadata":   body.metadata,
            })
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral.event.insert_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")
    return res.data


@router.patch("/events/{event_id}/acknowledge")
def acknowledge_event(event_id: str, auth: Auth) -> dict[str, Any] | list[dict[str, Any]] | None:
    user_id = _require_user_id(auth)
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .update({"acknowledged_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", event_id)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral.event.ack_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")
    return res.data


@router.get("/events")
def get_recent_events(auth: Auth, limit: int = 10) -> list[dict[str, Any]]:
    user_id = _require_user_id(auth)
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .select("*")
            .eq("user_id", user_id)
            .is_("acknowledged_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral.events.fetch_failed", user_id=user_id, error=str(exc))
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")
    return res.data or []
