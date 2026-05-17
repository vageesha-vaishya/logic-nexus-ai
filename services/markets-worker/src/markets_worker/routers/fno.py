"""
F&O (Futures & Options) endpoints.

GET /v1/fno/underlyings           — list of F&O underlying symbols with spot prices
GET /v1/fno/chain?symbol=NIFTY&expiry=29-May-2026  — full option chain + Greeks
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query

from markets_worker.fno.greeks import greeks as compute_greeks, implied_volatility
from markets_worker.fno.nse_client import fetch_option_chain, get_cached_chain, INDEX_SYMBOLS

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/fno")

_RISK_FREE_RATE = 0.065  # RBI repo rate

# Curated list of F&O underlyings shown in the UI
_UNDERLYINGS = [
    {"symbol": "NIFTY",      "name": "Nifty 50",           "type": "index",  "lot_size": 75},
    {"symbol": "BANKNIFTY",  "name": "Nifty Bank",         "type": "index",  "lot_size": 30},
    {"symbol": "FINNIFTY",   "name": "Nifty Financial",    "type": "index",  "lot_size": 65},
    {"symbol": "MIDCPNIFTY", "name": "Nifty MidCap Select","type": "index",  "lot_size": 120},
    {"symbol": "RELIANCE",   "name": "Reliance Industries", "type": "equity", "lot_size": 500},
    {"symbol": "TCS",        "name": "TCS",                "type": "equity", "lot_size": 175},
    {"symbol": "HDFCBANK",   "name": "HDFC Bank",          "type": "equity", "lot_size": 550},
    {"symbol": "INFY",       "name": "Infosys",            "type": "equity", "lot_size": 600},
    {"symbol": "ICICIBANK",  "name": "ICICI Bank",         "type": "equity", "lot_size": 700},
    {"symbol": "SBIN",       "name": "SBI",                "type": "equity", "lot_size": 1500},
    {"symbol": "WIPRO",      "name": "Wipro",              "type": "equity", "lot_size": 3000},
    {"symbol": "AXISBANK",   "name": "Axis Bank",          "type": "equity", "lot_size": 1200},
]


@router.get("/underlyings")
async def list_underlyings():
    """Return the curated list of F&O underlying symbols."""
    return {"underlyings": _UNDERLYINGS}


@router.get("/chain")
async def get_option_chain(
    symbol:  str = Query(..., description="Underlying symbol, e.g. NIFTY"),
    expiry:  str = Query("", description="Expiry date string as returned by NSE, e.g. 29-May-2026"),
):
    """
    Fetch option chain from NSE + compute Black-Scholes Greeks for each strike.

    If expiry is blank, returns the nearest expiry's chain.
    """
    sym = symbol.upper()
    is_stale = False
    cached_at: str | None = None

    try:
        raw = await fetch_option_chain(sym)
    except Exception as exc:
        logger.error("fno.chain_fetch_failed", symbol=sym, error=str(exc))
        raw = {}

    records = raw.get("records", {})
    spot: float = records.get("underlyingValue", 0.0) or 0.0
    expiry_dates: list[str] = records.get("expiryDates", [])

    if not expiry_dates:
        # Live data empty (weekend / holiday / rate-limited) — try last-known-good cache
        cached = get_cached_chain(sym)
        if cached:
            cached_at, raw = cached
            records = raw.get("records", {})
            spot = records.get("underlyingValue", 0.0) or 0.0
            expiry_dates = records.get("expiryDates", [])
            is_stale = True
            logger.info("fno.serving_stale_chain", symbol=sym, cached_at=cached_at)
        else:
            # No cache either — inform the user clearly
            _IST = timezone(timedelta(hours=5, minutes=30))
            weekday = datetime.now(_IST).weekday()
            if weekday >= 5:
                detail = "Markets are closed on weekends. Open the page on a trading day (Mon–Fri 09:15–15:30 IST) to load live data."
            else:
                detail = "NSE option chain data temporarily unavailable. Please try again in a few minutes."
            raise HTTPException(503, detail=detail)

    # Choose expiry: requested or nearest
    chosen_expiry = expiry if expiry in expiry_dates else expiry_dates[0]

    # Filter data for the chosen expiry
    all_data: list[dict] = records.get("data", [])
    chain_data = [d for d in all_data if d.get("expiryDate") == chosen_expiry]

    if not chain_data:
        raise HTTPException(404, detail=f"No option data for {sym} expiry {chosen_expiry}")

    # Compute days to expiry → T in years
    try:
        exp_dt = datetime.strptime(chosen_expiry, "%d-%b-%Y").replace(tzinfo=timezone.utc)
        now_dt = datetime.now(timezone.utc)
        T = max((exp_dt - now_dt).days / 365.0, 1 / 365.0)
    except ValueError:
        T = 30 / 365.0  # fallback

    # Find ATM strike
    atm_strike = round(spot / _strike_interval(sym)) * _strike_interval(sym) if spot > 0 else 0.0

    # Process each strike
    strikes_out: list[dict] = []
    total_ce_oi = 0
    total_pe_oi = 0

    for row in chain_data:
        strike = float(row.get("strikePrice", 0))
        ce_raw = row.get("CE", {}) or {}
        pe_raw = row.get("PE", {}) or {}

        ce = _process_leg("CE", ce_raw, spot, strike, T)
        pe = _process_leg("PE", pe_raw, spot, strike, T)

        total_ce_oi += ce.get("oi") or 0
        total_pe_oi += pe.get("oi") or 0

        strikes_out.append({
            "strike":   strike,
            "is_atm":   abs(strike - atm_strike) < 0.01,
            "itm_call": spot > strike if spot > 0 else False,
            "itm_put":  spot < strike if spot > 0 else False,
            "ce":       ce,
            "pe":       pe,
        })

    # Sort by strike ascending
    strikes_out.sort(key=lambda x: x["strike"])

    pcr = round(total_pe_oi / total_ce_oi, 3) if total_ce_oi > 0 else None
    max_pain = _compute_max_pain(strikes_out)

    return {
        "symbol":      sym,
        "spot":        round(spot, 2),
        "atm_strike":  atm_strike,
        "expiry":      chosen_expiry,
        "expiries":    expiry_dates,
        "pcr":         pcr,
        "max_pain":    max_pain,
        "lot_size":    next((u["lot_size"] for u in _UNDERLYINGS if u["symbol"] == sym), 1),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "is_stale":    is_stale,
        "cached_at":   cached_at,
        "strikes":     strikes_out,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strike_interval(symbol: str) -> float:
    """Return the standard strike interval for rounding ATM."""
    intervals = {
        "NIFTY": 50, "BANKNIFTY": 100, "FINNIFTY": 50,
        "MIDCPNIFTY": 25, "SENSEX": 100, "BANKEX": 100,
    }
    return intervals.get(symbol.upper(), 50)


def _process_leg(
    option_type: str,
    raw: dict[str, Any],
    spot: float,
    strike: float,
    T: float,
) -> dict[str, Any]:
    """Convert a raw NSE CE/PE dict into our normalised format + add Greeks."""
    ltp      = float(raw.get("lastPrice") or 0)
    bid      = float(raw.get("bidprice")  or 0)
    ask      = float(raw.get("askPrice")  or 0)
    oi       = int(raw.get("openInterest", 0) or 0)
    oi_chg   = int(raw.get("changeinOpenInterest", 0) or 0)
    volume   = int(raw.get("totalTradedVolume", 0) or 0)
    nse_iv   = float(raw.get("impliedVolatility", 0) or 0)

    # IV: use NSE's value if available, else back-solve from LTP
    iv_frac: float | None = nse_iv / 100 if nse_iv > 0 else None
    if iv_frac is None and ltp > 0 and spot > 0:
        iv_frac = implied_volatility(option_type, spot, strike, T, _RISK_FREE_RATE, ltp)

    g: dict = {}
    if iv_frac and spot > 0 and strike > 0:
        try:
            g = compute_greeks(option_type, spot, strike, T, _RISK_FREE_RATE, iv_frac)
        except Exception:
            g = {}

    return {
        "ltp":       round(ltp, 2) if ltp else None,
        "bid":       round(bid, 2) if bid else None,
        "ask":       round(ask, 2) if ask else None,
        "iv":        round(nse_iv, 2) if nse_iv else (round(iv_frac * 100, 2) if iv_frac else None),
        "oi":        oi or None,
        "oi_change": oi_chg or None,
        "volume":    volume or None,
        "delta":     g.get("delta"),
        "gamma":     g.get("gamma"),
        "theta":     g.get("theta"),
        "vega":      g.get("vega"),
    }


def _compute_max_pain(strikes: list[dict]) -> float | None:
    """
    Max pain = strike price at which total option buyer losses are maximised.
    Computed as the strike with minimum total OI x intrinsic value.
    """
    if not strikes:
        return None
    results: list[tuple[float, float]] = []
    for s in strikes:
        sk = s["strike"]
        pain = 0.0
        for row in strikes:
            r_sk = row["strike"]
            ce_oi = (row["ce"] or {}).get("oi") or 0
            pe_oi = (row["pe"] or {}).get("oi") or 0
            # At settlement price = sk:
            pain += ce_oi * max(0.0, sk - r_sk)   # CE intrinsic
            pain += pe_oi * max(0.0, r_sk - sk)   # PE intrinsic
        results.append((sk, pain))
    if not results:
        return None
    return min(results, key=lambda x: x[1])[0]
