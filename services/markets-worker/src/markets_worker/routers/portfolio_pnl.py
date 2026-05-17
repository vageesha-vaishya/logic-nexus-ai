"""Portfolio P&L history endpoint.

GET /v1/portfolio/pnl/{portfolio_id}?lookback=365

Replays transactions chronologically against price history to produce a daily
NAV / invested / P&L time-series without requiring a snapshots table.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/portfolio")

_BUY_TYPES  = {"buy", "sip", "transfer_in", "bonus"}
_SELL_TYPES = {"sell", "redemption", "transfer_out"}


# ── Response models (plain dicts — fast, no Pydantic overhead) ────────────────

def _pnl_response(portfolio_id: str, series: list[dict], realized_total: float) -> dict:
    if not series:
        return {
            "portfolio_id": portfolio_id,
            "series": [],
            "summary": {
                "current_nav": 0.0,
                "total_invested": 0.0,
                "total_pnl": 0.0,
                "pnl_pct": 0.0,
                "realized_pnl": 0.0,
                "unrealized_pnl": 0.0,
            },
        }

    last = series[-1]
    unrealized = last["pnl"] - realized_total
    return {
        "portfolio_id": portfolio_id,
        "series": series,
        "summary": {
            "current_nav":    last["nav"],
            "total_invested": last["invested"],
            "total_pnl":      last["pnl"],
            "pnl_pct":        last["pnl_pct"],
            "realized_pnl":   round(realized_total, 4),
            "unrealized_pnl": round(unrealized, 4),
        },
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/pnl/{portfolio_id}")
async def get_portfolio_pnl(
    portfolio_id: str,
    auth: Auth,
    lookback: int = Query(365, ge=1, le=1825),
) -> dict[str, Any]:
    import asyncio

    user_id = auth.user_id or auth.service_account_id
    if not user_id and not auth.is_service_account:
        raise HTTPException(401, detail="Authentication required")

    db = get_supabase()

    # 1. Verify portfolio ownership
    def _fetch_portfolio():
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

    # 2. Fetch all transactions for this portfolio
    def _fetch_transactions():
        return (
            db.schema("markets")
            .from_("transactions")
            .select("txn_date, instrument_id, txn_type, qty, price, charges")
            .eq("portfolio_id", portfolio_id)
            .order("txn_date", desc=False)
            .execute()
        ).data or []

    txns = await asyncio.to_thread(_fetch_transactions)

    if not txns:
        return _pnl_response(portfolio_id, [], 0.0)

    # 3. Collect unique instrument_ids
    instrument_ids = list({t["instrument_id"] for t in txns if t.get("instrument_id")})
    if not instrument_ids:
        return _pnl_response(portfolio_id, [], 0.0)

    # 4. Fetch price history for those instruments within lookback window
    start_date = (date.today() - timedelta(days=lookback)).isoformat()

    def _fetch_prices():
        return (
            db.schema("markets")
            .from_("price_history")
            .select("instrument_id, ts, close")
            .in_("instrument_id", instrument_ids)
            .gte("ts", start_date)
            .order("ts", desc=False)
            .execute()
        ).data or []

    price_rows = await asyncio.to_thread(_fetch_prices)

    if not price_rows:
        return _pnl_response(portfolio_id, [], 0.0)

    # 5. Build price lookup: (instrument_id, "YYYY-MM-DD") -> close
    price_dict: dict[tuple[str, str], float] = {}
    price_dates_set: set[str] = set()
    for row in price_rows:
        ts_str = str(row["ts"])[:10]  # truncate ISO datetime to date
        key = (row["instrument_id"], ts_str)
        price_dict[key] = float(row["close"])
        price_dates_set.add(ts_str)

    price_dates = sorted(price_dates_set)

    # 6. Pre-parse and sort transactions
    parsed_txns: list[dict] = []
    for t in txns:
        txn_date = str(t["txn_date"])[:10]
        parsed_txns.append({
            "txn_date":      txn_date,
            "instrument_id": t.get("instrument_id") or "",
            "txn_type":      (t.get("txn_type") or "").lower(),
            "qty":           float(t.get("qty") or 0),
            "price":         float(t.get("price") or 0),
            "charges":       float(t.get("charges") or 0),
        })
    parsed_txns.sort(key=lambda x: x["txn_date"])

    # 7. Replay transactions day by day
    # holdings: instrument_id -> {qty, total_cost, realized_pnl}
    holdings: dict[str, dict[str, float]] = {}
    txn_idx = 0
    n_txns = len(parsed_txns)
    series: list[dict] = []
    total_realized = 0.0

    for price_date in price_dates:
        # Apply all transactions whose txn_date <= price_date
        while txn_idx < n_txns and parsed_txns[txn_idx]["txn_date"] <= price_date:
            t = parsed_txns[txn_idx]
            txn_idx += 1
            iid = t["instrument_id"]
            if not iid:
                continue

            if iid not in holdings:
                holdings[iid] = {"qty": 0.0, "total_cost": 0.0, "realized_pnl": 0.0}

            h = holdings[iid]
            txn_type = t["txn_type"]
            qty = t["qty"]
            price = t["price"]
            charges = t["charges"]

            if txn_type in _BUY_TYPES:
                h["qty"] += qty
                h["total_cost"] += qty * price + charges

            elif txn_type in _SELL_TYPES and h["qty"] > 0:
                qty_sold = min(qty, h["qty"])
                avg = h["total_cost"] / h["qty"] if h["qty"] > 0 else 0.0
                realized = qty_sold * (price - avg) - charges
                h["realized_pnl"] += realized
                total_realized += realized
                h["total_cost"] -= qty_sold * avg
                h["qty"] -= qty_sold
                if h["qty"] <= 0:
                    h["qty"] = 0.0
                    h["total_cost"] = 0.0

        # Only emit if there are any open positions
        if not holdings:
            continue

        nav = 0.0
        invested = 0.0
        realized_sum = 0.0
        has_position = False

        for iid, h in holdings.items():
            if h["qty"] <= 0:
                continue
            close = price_dict.get((iid, price_date))
            if close is None:
                # Use total_cost as fallback (NAV == invested, no PnL)
                close = h["total_cost"] / h["qty"] if h["qty"] > 0 else 0.0
            nav += h["qty"] * close
            invested += h["total_cost"]
            realized_sum += h["realized_pnl"]
            has_position = True

        if not has_position:
            continue

        pnl = nav - invested + realized_sum
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0.0

        series.append({
            "date":     price_date,
            "nav":      round(nav, 4),
            "invested": round(invested, 4),
            "pnl":      round(pnl, 4),
            "pnl_pct":  round(pnl_pct, 4),
        })

    logger.info(
        "portfolio.pnl",
        portfolio_id=portfolio_id,
        lookback=lookback,
        series_len=len(series),
    )

    return _pnl_response(portfolio_id, series, total_realized)
