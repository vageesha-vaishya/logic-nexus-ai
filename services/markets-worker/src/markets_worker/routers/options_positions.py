"""
Options Positions P&L and Greeks endpoint.

GET /v1/options/positions/{portfolio_id}
    Auth required. Fetches all option holdings (CE/PE) for a portfolio,
    computes Black-Scholes Greeks, IV, P&L, moneyness and theta decay.
"""
from __future__ import annotations

import asyncio
import re
from datetime import date, datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.fno.greeks import greeks as compute_greeks, implied_volatility
from markets_worker.routers.ltp import _fetch_one, _suffix

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/options")

_RISK_FREE_RATE = 0.065  # RBI repo rate
_OPTION_TYPES = {"ce", "pe", "call", "put", "option"}

# Lot sizes for common F&O underlyings
_LOT_SIZES: dict[str, int] = {
    "NIFTY":      75,
    "BANKNIFTY":  30,
    "FINNIFTY":   65,
    "MIDCPNIFTY": 120,
    "RELIANCE":   500,
    "TCS":        175,
    "HDFCBANK":   550,
    "INFY":       600,
    "ICICIBANK":  700,
    "SBIN":       1500,
    "WIPRO":      3000,
    "AXISBANK":   1200,
}

# Regex to parse option symbols like NIFTY24500CE, BANKNIFTY2605291500PE
_SYMBOL_RE = re.compile(
    r"^(?P<underlying>[A-Z]+)"       # e.g. NIFTY, BANKNIFTY
    r"(?:\d{2}[A-Z]\d{2}|\d{6})?"   # optional short expiry like 26M29 or 260529
    r"(?P<strike>\d+)"               # strike price
    r"(?P<opt_type>CE|PE)$",
    re.IGNORECASE,
)


def _parse_symbol(symbol: str) -> tuple[str, float, str]:
    """
    Best-effort parse of an option symbol.
    Returns (underlying, strike, option_type).
    Falls back to (symbol, 0.0, "CE") if unparseable.
    """
    m = _SYMBOL_RE.match(symbol.upper())
    if m:
        return (
            m.group("underlying"),
            float(m.group("strike")),
            m.group("opt_type").upper(),
        )
    # Fallback: strip last 2 chars if CE/PE
    if symbol.upper().endswith(("CE", "PE")):
        ot = symbol[-2:].upper()
        rest = symbol[:-2]
        # Try to extract trailing digits as strike
        digit_m = re.search(r"(\d+)$", rest)
        if digit_m:
            strike_str = digit_m.group(1)
            underlying = rest[: len(rest) - len(strike_str)]
            return underlying.upper(), float(strike_str), ot
    return symbol.upper(), 0.0, "CE"


def _moneyness(S: float, K: float, option_type: str) -> str:
    """ITM / ATM / OTM classification with 0.5% ATM band."""
    if K <= 0 or S <= 0:
        return "OTM"
    pct = (S - K) / K
    atm_band = 0.005
    if option_type.upper() == "CE":
        if pct > atm_band:
            return "ITM"
        if pct < -atm_band:
            return "OTM"
        return "ATM"
    else:
        if pct < -atm_band:
            return "ITM"
        if pct > atm_band:
            return "OTM"
        return "ATM"


def _days_to_expiry(expiry_str: str | None) -> int:
    """Days from today until expiry. Returns 0 if unknown/expired."""
    if not expiry_str:
        return 0
    try:
        exp = date.fromisoformat(str(expiry_str)[:10])
        delta = (exp - date.today()).days
        return max(delta, 0)
    except Exception:
        return 0


async def _get_spot_price(underlying: str) -> float | None:
    """Fetch LTP for an underlying from yfinance via the existing ltp module."""
    try:
        suffix = _suffix("NSE")
        _, data = await asyncio.get_event_loop().run_in_executor(
            None, _fetch_one, underlying, suffix, "NSE"
        )
        ltp = data.get("ltp")
        return float(ltp) if ltp is not None else None
    except Exception:
        return None


def _enrich_position(
    holding: dict[str, Any],
    instrument: dict[str, Any],
    spot_price: float | None,
) -> dict[str, Any]:
    """Compute all option analytics for a single holding."""
    symbol = instrument.get("symbol") or holding.get("instrument_id", "")
    underlying, strike, opt_type = _parse_symbol(symbol)

    # Use instrument metadata if available
    meta = instrument.get("metadata") or {}
    expiry_str: str | None = (
        meta.get("expiry")
        or meta.get("expiry_date")
        or instrument.get("expiry_date")
        or None
    )
    if not expiry_str:
        # Try parsing from symbol — look for date-like segment after underlying
        date_m = re.search(r"(\d{2})(\d{2})(\d{2})", symbol[len(underlying):])
        if date_m:
            yy, mm, dd = date_m.groups()
            expiry_str = f"20{yy}-{mm}-{dd}"

    # Lot size: prefer instrument metadata, else lookup table, else qty
    lot_size: int = (
        int(meta.get("lot_size", 0))
        or _LOT_SIZES.get(underlying.upper(), 1)
    )

    dte = _days_to_expiry(expiry_str)
    T = dte / 365.0  # years to expiry

    qty = float(holding.get("qty") or 0)
    avg_cost = float(holding.get("avg_cost") or 0)

    # Current premium: use spot price as a proxy for now;
    # ideally fetched from LTP of the option itself. We use spot as fallback.
    # If the instrument has its own LTP in the price cache, that would be in
    # holding['last_price'] if the caller added it.
    current_premium: float | None = holding.get("last_price")
    if current_premium is not None:
        current_premium = float(current_premium)

    # Greeks + IV
    greek_vals: dict[str, float] = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    iv_val: float | None = None

    if spot_price and spot_price > 0 and strike > 0 and T > 0:
        # Compute IV from avg_cost (what the user paid)
        iv_val = implied_volatility(opt_type, spot_price, strike, T, _RISK_FREE_RATE, avg_cost)
        sigma = iv_val if (iv_val and iv_val > 0) else 0.25  # fallback to 25% IV
        greek_vals = compute_greeks(opt_type, spot_price, strike, T, _RISK_FREE_RATE, sigma)

        # If no market price from LTP, use BS theoretical price
        if current_premium is None:
            from markets_worker.fno.greeks import bs_price
            try:
                current_premium = round(
                    bs_price(opt_type, spot_price, strike, T, _RISK_FREE_RATE, sigma), 2
                )
            except Exception:
                current_premium = None

    # P&L
    pnl: float | None = None
    pnl_pct: float | None = None
    if current_premium is not None and avg_cost > 0:
        pnl = round((current_premium - avg_cost) * qty, 2)
        pnl_pct = round((current_premium - avg_cost) / avg_cost * 100, 2)

    # Theta in INR per day (theta per contract × qty)
    theta_inr_per_day: float | None = None
    if greek_vals["theta"] != 0.0:
        theta_inr_per_day = round(greek_vals["theta"] * qty, 2)

    return {
        "symbol":            symbol,
        "underlying":        underlying,
        "option_type":       opt_type,
        "strike":            strike,
        "expiry":            expiry_str,
        "days_to_expiry":    dte,
        "qty":               qty,
        "avg_cost":          avg_cost,
        "current_premium":   current_premium,
        "pnl":               pnl,
        "pnl_pct":           pnl_pct,
        "delta":             greek_vals["delta"],
        "gamma":             greek_vals["gamma"],
        "theta":             greek_vals["theta"],
        "vega":              greek_vals["vega"],
        "iv":                round(iv_val, 4) if iv_val else None,
        "moneyness":         _moneyness(spot_price or 0, strike, opt_type) if spot_price else None,
        "underlying_spot":   round(spot_price, 2) if spot_price else None,
        "theta_inr_per_day": theta_inr_per_day,
        "lot_size":          lot_size,
    }


@router.get("/positions/{portfolio_id}")
async def get_options_positions(
    portfolio_id: str,
    auth: Auth,
) -> dict[str, Any]:
    """
    GET /v1/options/positions/{portfolio_id}

    Returns all option holdings enriched with Greeks, IV, P&L, moneyness
    and theta decay for the given portfolio.
    """
    user_id = auth.user_id or auth.service_account_id
    if not user_id and not auth.is_service_account:
        raise HTTPException(401, detail="Authentication required")

    db = get_supabase()

    # 1. Verify portfolio ownership
    def _fetch_portfolio() -> dict | None:
        return (
            db.schema("markets")
            .from_("portfolios")
            .select("id, owner_user_id")
            .eq("id", portfolio_id)
            .maybe_single()
            .execute()
        ).data

    portfolio = await asyncio.to_thread(_fetch_portfolio)
    if not portfolio:
        raise HTTPException(404, detail="Portfolio not found")
    if auth.user_id and portfolio.get("owner_user_id") != auth.user_id:
        raise HTTPException(403, detail="Access denied")

    # 2. Fetch option holdings (join with instruments for type filter)
    def _fetch_holdings() -> list[dict]:
        return (
            db.schema("markets")
            .from_("holdings")
            .select(
                "id, instrument_id, qty, avg_cost, realized_pnl, last_updated_at"
            )
            .eq("portfolio_id", portfolio_id)
            .gt("qty", 0)
            .execute()
        ).data or []

    all_holdings = await asyncio.to_thread(_fetch_holdings)
    if not all_holdings:
        return {"portfolio_id": portfolio_id, "positions": [], "net_greeks": _zero_net_greeks()}

    instrument_ids: list[str] = [h["instrument_id"] for h in all_holdings if h.get("instrument_id")]

    # 3. Fetch instrument metadata
    def _fetch_instruments() -> list[dict]:
        return (
            db.schema("markets")
            .from_("instruments")
            .select("id, symbol, exchange, instrument_type, metadata")
            .in_("id", instrument_ids)
            .execute()
        ).data or []

    instruments = await asyncio.to_thread(_fetch_instruments)
    instr_map: dict[str, dict] = {i["id"]: i for i in instruments}

    # 4. Filter to option holdings only
    option_holdings: list[dict] = []
    for h in all_holdings:
        instr = instr_map.get(h["instrument_id"], {})
        itype = (instr.get("instrument_type") or "").lower()
        # Also detect via symbol suffix if instrument_type is not set
        symbol = (instr.get("symbol") or "").upper()
        is_option = (
            itype in _OPTION_TYPES
            or symbol.endswith("CE")
            or symbol.endswith("PE")
        )
        if is_option:
            option_holdings.append(h)

    if not option_holdings:
        return {"portfolio_id": portfolio_id, "positions": [], "net_greeks": _zero_net_greeks()}

    # 5. Fetch latest price for each option instrument
    option_instr_ids = [h["instrument_id"] for h in option_holdings]

    def _fetch_ltp_prices() -> list[dict]:
        return (
            db.schema("markets")
            .from_("price_history")
            .select("instrument_id, close")
            .in_("instrument_id", option_instr_ids)
            .order("ts", desc=True)
            .limit(len(option_instr_ids) * 3)
            .execute()
        ).data or []

    price_rows = await asyncio.to_thread(_fetch_ltp_prices)
    ltp_map: dict[str, float] = {}
    for p in price_rows:
        iid = p["instrument_id"]
        if iid not in ltp_map:
            ltp_map[iid] = float(p["close"])

    # Attach last_price to holding dicts
    for h in option_holdings:
        h["last_price"] = ltp_map.get(h["instrument_id"])

    # 6. Determine unique underlyings and fetch their spot prices concurrently
    underlying_set: set[str] = set()
    for h in option_holdings:
        instr = instr_map.get(h["instrument_id"], {})
        symbol = instr.get("symbol") or ""
        underlying, _, _ = _parse_symbol(symbol)
        underlying_set.add(underlying)

    spot_tasks = {u: asyncio.create_task(_get_spot_price(u)) for u in underlying_set}
    spot_prices: dict[str, float | None] = {}
    for u, task in spot_tasks.items():
        try:
            spot_prices[u] = await task
        except Exception:
            spot_prices[u] = None

    # 7. Enrich each option holding
    positions: list[dict] = []
    for h in option_holdings:
        instr = instr_map.get(h["instrument_id"], {})
        symbol = instr.get("symbol") or ""
        underlying, _, _ = _parse_symbol(symbol)
        spot = spot_prices.get(underlying)
        enriched = _enrich_position(h, instr, spot)
        positions.append(enriched)

    # 8. Net Greeks summary
    net = _zero_net_greeks()
    for p in positions:
        qty = p["qty"]
        for g in ("delta", "gamma", "theta", "vega"):
            val = p.get(g) or 0.0
            net[g] = round(net[g] + val * qty, 6)
    net["theta_inr_per_day"] = round(
        sum((p.get("theta_inr_per_day") or 0.0) for p in positions), 2
    )

    logger.info(
        "options.positions",
        portfolio_id=portfolio_id,
        count=len(positions),
    )

    return {
        "portfolio_id": portfolio_id,
        "positions":    positions,
        "net_greeks":   net,
    }


def _zero_net_greeks() -> dict[str, float]:
    return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "theta_inr_per_day": 0.0}
