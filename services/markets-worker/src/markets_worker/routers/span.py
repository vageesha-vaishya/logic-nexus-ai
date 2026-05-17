"""
SPAN Margin Calculator — simplified SEBI approximation.

POST /v1/span/calculate
  Body: { positions: [{symbol, exchange, instrument_type, expiry, option_type,
                       strike, qty, direction, premium?}] }
  Returns: { positions: [{...margin_per_position}],
             summary: {span_margin, exposure_margin, portfolio_offset,
                       total_margin, net_margin} }

Note: This is a simplified SPAN model (SEBI approximation).
Actual SPAN requires exchange-published risk parameter files.
"""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/span")

# ── Lot sizes (NSE standard, updated 2024-25) ─────────────────────────────────

LOT_SIZES: dict[str, int] = {
    "NIFTY":       75,
    "BANKNIFTY":   30,
    "FINNIFTY":    40,
    "SENSEX":      20,
    "MIDCPNIFTY":  75,
    "BANKEX":      20,
    # Single-stock futures default
    "DEFAULT_EQUITY_FUT": 500,
}


def _get_lot_size(symbol: str) -> int:
    return LOT_SIZES.get(symbol.upper(), LOT_SIZES["DEFAULT_EQUITY_FUT"])


# ── LTP cache (re-use from ltp module in-process) ────────────────────────────

def _get_ltp_from_cache(symbol: str, exchange: str = "NSE") -> float | None:
    """
    Pull the last-seen LTP from the LTP router's in-process cache.
    Returns None if not cached (caller will use a fallback price).
    """
    try:
        from markets_worker.routers.ltp import _ltp_cache  # type: ignore[attr-defined]
        entry = _ltp_cache.get(f"{symbol.upper()}:{exchange.upper()}")
        if entry:
            ts, data = entry
            if time.monotonic() - ts < 60.0:   # accept up to 60 s old
                return data.get("ltp")
    except Exception:
        pass
    return None


# ── Margin computation ────────────────────────────────────────────────────────

def _calculate_position_margin(pos: dict[str, Any], ltp_price: float) -> dict[str, Any]:
    symbol          = pos["symbol"].upper()
    qty_lots        = abs(int(pos.get("qty", 1)))
    lot_size        = _get_lot_size(symbol)
    total_qty       = qty_lots * lot_size
    direction       = pos.get("direction", "buy").lower()
    instrument_type = pos.get("instrument_type", "future").lower()

    contract_value = round(ltp_price * total_qty, 2)

    if "call" in instrument_type or "put" in instrument_type or "option" in instrument_type:
        premium = float(pos.get("premium") or ltp_price)
        if direction == "buy":
            # Long option: only premium paid
            span     = round(premium * total_qty, 2)
            exposure = 0.0
        else:
            # Short option: higher of 10% contract value OR 3× premium
            span_pct = round(contract_value * 0.10, 2)
            span_3x  = round(premium * total_qty * 3, 2)
            span     = max(span_pct, span_3x)
            exposure = round(contract_value * 0.05, 2)
    else:
        # Futures
        span     = round(contract_value * 0.10, 2)
        exposure = (
            round(contract_value * 0.05, 2)
            if direction in ("sell", "short")
            else round(contract_value * 0.03, 2)
        )

    return {
        **pos,
        "contract_value":  contract_value,
        "span_margin":     span,
        "exposure_margin": exposure,
        "total_margin":    round(span + exposure, 2),
        "lot_size":        lot_size,
        "total_qty":       total_qty,
        "ltp_used":        round(ltp_price, 2),
    }


def _apply_spread_credit(positions: list[dict[str, Any]]) -> float:
    """
    Apply 0.5% portfolio offset credit for hedged positions
    (holding near + far month of same symbol).
    SEBI also allows reduced margin for hedged portfolios.
    """
    from collections import defaultdict

    symbol_expiry: dict[str, set] = defaultdict(set)
    for pos in positions:
        sym    = pos["symbol"].upper()
        expiry = pos.get("expiry", "")
        if expiry:
            symbol_expiry[sym].add(expiry)

    spread_pairs = sum(1 for v in symbol_expiry.values() if len(v) >= 2)
    total_margin = sum(p.get("total_margin", 0.0) for p in positions)
    credit       = round(total_margin * 0.005 * spread_pairs, 2)
    return credit


# ── Pydantic models ────────────────────────────────────────────────────────────

class PositionInput(BaseModel):
    symbol:          str
    exchange:        str                                   = "NSE"
    instrument_type: str                                   = "future"  # future|call|put
    expiry:          str | None                            = None
    option_type:     str | None                            = None
    strike:          float | None                          = None
    qty:             int                                   = Field(1, ge=1)
    direction:       str                                   = "buy"     # buy|sell
    premium:         float | None                          = None
    ltp_override:    float | None                          = None       # caller-supplied price


class SpanRequest(BaseModel):
    positions: list[PositionInput] = Field(..., min_length=1)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/calculate")
async def calculate_span(body: SpanRequest):
    """
    Compute simplified SPAN + exposure margins for a basket of F&O positions.

    LTP is fetched from the in-process LTP cache when available.
    If not cached, the caller can supply `ltp_override`; otherwise a
    conservative fallback of 1.0 is used (margin will be understated —
    callers should always supply a live price for accuracy).
    """
    logger.info("span.calculate", position_count=len(body.positions))

    computed: list[dict[str, Any]] = []
    for pos in body.positions:
        pos_dict = pos.model_dump()
        sym      = pos.symbol.upper()
        exchange = pos.exchange.upper()

        ltp: float = (
            pos.ltp_override
            or _get_ltp_from_cache(sym, exchange)
            or 1.0
        )

        result = _calculate_position_margin(pos_dict, ltp)
        computed.append(result)

    # ── Summary ───────────────────────────────────────────────────────────────
    total_span     = round(sum(p["span_margin"]     for p in computed), 2)
    total_exposure = round(sum(p["exposure_margin"] for p in computed), 2)
    total_gross    = round(total_span + total_exposure, 2)

    # Portfolio offset: spread credit + 10% portfolio-level hedge benefit
    spread_credit      = _apply_spread_credit(computed)
    portfolio_offset   = round(spread_credit + total_gross * 0.10, 2)
    net_margin         = round(max(total_gross - portfolio_offset, total_gross * 0.50), 2)

    return {
        "positions": computed,
        "summary": {
            "span_margin":        total_span,
            "exposure_margin":    total_exposure,
            "total_margin":       total_gross,
            "portfolio_offset":   portfolio_offset,
            "net_margin":         net_margin,
        },
    }
