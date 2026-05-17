"""
Paper trading endpoints.

POST /v1/paper/order
  Simulates an order fill at current LTP for a paper portfolio.
  Inserts a transaction into markets.transactions and updates paper_capital.

POST /v1/paper/portfolio/seed
  Seeds a paper portfolio with initial ₹10L capital (idempotent — skips if already exists).

GET /v1/paper/capital/{portfolio_id}
  Returns the available cash balance for a paper portfolio.
"""

from __future__ import annotations

import asyncio
import math
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timezone, datetime
from typing import Literal

import structlog
import yfinance as yf
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.routers.ltp import _ltp_cache, _CACHE_TTL, _suffix, _safe_float

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/paper")

_executor = ThreadPoolExecutor(max_workers=4)

INITIAL_CAPITAL = 1_000_000.00  # ₹10,00,000


# ── Brokerage charges (simplified) ───────────────────────────────────────────
# 0.1% of trade value, min ₹20, max ₹100 per order.

def _compute_charges(trade_value: float) -> float:
    raw = trade_value * 0.001
    return round(min(max(raw, 20.0), 100.0), 2)


# ── LTP fetch (with in-memory cache fallback) ─────────────────────────────────

def _fetch_ltp_sync(symbol: str, exchange: str) -> float | None:
    suffix = _suffix(exchange)
    try:
        fi = yf.Ticker(f"{symbol}{suffix}").fast_info
        return _safe_float(fi.last_price)
    except Exception:
        return None


async def _get_ltp(symbol: str, exchange: str) -> float:
    sym_key = f"{symbol.upper()}:{exchange.upper()}"
    now = time.monotonic()
    entry = _ltp_cache.get(sym_key)
    if entry and (now - entry[0]) < _CACHE_TTL:
        ltp = entry[1].get("ltp")
        if ltp is not None:
            return float(ltp)

    loop = asyncio.get_event_loop()
    ltp = await loop.run_in_executor(_executor, _fetch_ltp_sync, symbol.upper(), exchange.upper())
    if ltp is None or math.isnan(ltp) or ltp <= 0:
        raise HTTPException(422, detail=f"Could not fetch LTP for {symbol}. Market may be closed.")
    return ltp


# ── Request / Response models ─────────────────────────────────────────────────

class PaperOrderRequest(BaseModel):
    portfolio_id:  str
    instrument_id: str
    symbol:        str
    exchange:      str
    txn_type:      Literal["buy", "sell"]
    qty:           int


class PaperOrderResponse(BaseModel):
    fill_price:     float
    qty:            int
    total_value:    float
    charges:        float
    remaining_cash: float
    message:        str


class SeedRequest(BaseModel):
    portfolio_id: str


class PaperCapitalResponse(BaseModel):
    portfolio_id:    str
    initial_capital: float
    available_cash:  float
    used_capital:    float
    return_pct:      float


# ── Helpers ───────────────────────────────────────────────────────────────────

def _verify_portfolio_owner(portfolio_id: str, user_id: str) -> dict:
    """Verify the portfolio exists and belongs to the user."""
    db = get_supabase()
    row = (
        db.schema("markets").from_("portfolios")
        .select("id, mode, base_currency, owner_user_id, tenant_id, franchise_id")
        .eq("id", portfolio_id)
        .eq("owner_user_id", user_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(404, detail="Portfolio not found or access denied")
    return row


def _get_paper_capital(portfolio_id: str) -> dict | None:
    db = get_supabase()
    return (
        db.schema("markets").from_("paper_capital")
        .select("id, portfolio_id, initial_capital, available_cash")
        .eq("portfolio_id", portfolio_id)
        .maybe_single()
        .execute()
    ).data


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/portfolio/seed", status_code=201)
async def seed_paper_portfolio(body: SeedRequest, auth: Auth):
    """Seed a paper portfolio with ₹10L initial capital (idempotent)."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    portfolio = _verify_portfolio_owner(body.portfolio_id, auth.user_id)

    db = get_supabase()
    existing = _get_paper_capital(body.portfolio_id)
    if existing:
        return {
            "portfolio_id":    body.portfolio_id,
            "initial_capital": float(existing["initial_capital"]),
            "available_cash":  float(existing["available_cash"]),
            "seeded":          False,
            "message":         "Paper capital already exists",
        }

    db.schema("markets").from_("paper_capital").insert({
        "portfolio_id":    body.portfolio_id,
        "initial_capital": INITIAL_CAPITAL,
        "available_cash":  INITIAL_CAPITAL,
        "updated_at":      datetime.now(timezone.utc).isoformat(),
    }).execute()

    logger.info("paper.seeded", portfolio_id=body.portfolio_id, user_id=auth.user_id)
    return {
        "portfolio_id":    body.portfolio_id,
        "initial_capital": INITIAL_CAPITAL,
        "available_cash":  INITIAL_CAPITAL,
        "seeded":          True,
        "message":         "Paper portfolio seeded with ₹10,00,000",
    }


@router.get("/capital/{portfolio_id}", response_model=PaperCapitalResponse)
async def get_paper_capital(portfolio_id: str, auth: Auth):
    """Return available cash balance and summary for a paper portfolio."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    _verify_portfolio_owner(portfolio_id, auth.user_id)

    capital = _get_paper_capital(portfolio_id)
    if not capital:
        raise HTTPException(404, detail="Paper capital not seeded. Call POST /v1/paper/portfolio/seed first.")

    initial   = float(capital["initial_capital"])
    available = float(capital["available_cash"])
    used      = initial - available
    return_pct = ((available - initial) / initial * 100) if initial > 0 else 0.0

    return PaperCapitalResponse(
        portfolio_id=portfolio_id,
        initial_capital=initial,
        available_cash=available,
        used_capital=used,
        return_pct=round(return_pct, 4),
    )


@router.post("/order", response_model=PaperOrderResponse)
async def place_paper_order(body: PaperOrderRequest, auth: Auth):
    """Simulate an order fill at current LTP for a paper portfolio."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    if body.qty <= 0:
        raise HTTPException(400, detail="qty must be a positive integer")

    portfolio = _verify_portfolio_owner(body.portfolio_id, auth.user_id)

    # Fetch current LTP
    ltp = await _get_ltp(body.symbol, body.exchange)

    trade_value = ltp * body.qty
    charges     = _compute_charges(trade_value)
    net_amount  = trade_value + charges  # cost for buy; proceeds for sell

    db = get_supabase()

    # Ensure paper_capital row exists
    capital = _get_paper_capital(body.portfolio_id)
    if not capital:
        raise HTTPException(400, detail="Paper capital not seeded. Call POST /v1/paper/portfolio/seed first.")

    available_cash = float(capital["available_cash"])

    if body.txn_type == "buy":
        if available_cash < net_amount:
            raise HTTPException(400, detail=(
                f"Insufficient paper cash. Need ₹{net_amount:,.2f} "
                f"but only ₹{available_cash:,.2f} available."
            ))
        new_cash = available_cash - net_amount

    else:  # sell
        # Check holdings
        holding = (
            db.schema("markets").from_("holdings")
            .select("id, qty")
            .eq("portfolio_id", body.portfolio_id)
            .eq("instrument_id", body.instrument_id)
            .eq("owner_user_id", auth.user_id)
            .maybe_single()
            .execute()
        ).data

        if not holding or float(holding["qty"]) < body.qty:
            held = float(holding["qty"]) if holding else 0
            raise HTTPException(400, detail=(
                f"Insufficient holdings. Trying to sell {body.qty} but only {held:.0f} held."
            ))
        # Sell proceeds credited (minus charges)
        sell_proceeds = trade_value - charges
        new_cash = available_cash + sell_proceeds

    # Insert transaction
    txn_date = date.today().isoformat()
    asset_class = "equity"  # default; can be extended

    db.schema("markets").from_("transactions").insert({
        "portfolio_id":  body.portfolio_id,
        "instrument_id": body.instrument_id,
        "txn_type":      body.txn_type,
        "txn_date":      txn_date,
        "qty":           body.qty,
        "price":         ltp,
        "charges":       charges,
        "net_amount":    net_amount,
        "currency":      "INR",
        "fx_rate":       1.0,
        "asset_class":   asset_class,
        "source":        "paper_trade",
        "owner_user_id": auth.user_id,
        "tenant_id":     portfolio["tenant_id"],
        "franchise_id":  portfolio["franchise_id"],
    }).execute()

    # Update paper_capital
    db.schema("markets").from_("paper_capital").update({
        "available_cash": new_cash,
        "updated_at":     datetime.now(timezone.utc).isoformat(),
    }).eq("portfolio_id", body.portfolio_id).execute()

    action  = "bought" if body.txn_type == "buy" else "sold"
    message = (
        f"Paper order {action}: {body.qty} × {body.symbol} @ ₹{ltp:,.2f}. "
        f"Charges ₹{charges:,.2f}. Remaining cash ₹{new_cash:,.2f}."
    )

    logger.info(
        "paper.order_filled",
        symbol=body.symbol,
        txn_type=body.txn_type,
        qty=body.qty,
        ltp=ltp,
        charges=charges,
        new_cash=new_cash,
        user_id=auth.user_id,
    )

    return PaperOrderResponse(
        fill_price=ltp,
        qty=body.qty,
        total_value=trade_value,
        charges=charges,
        remaining_cash=new_cash,
        message=message,
    )
