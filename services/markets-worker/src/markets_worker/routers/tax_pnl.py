"""Tax P&L endpoint — Indian FY capital gains computation with FIFO lot matching.

GET /v1/tax/{portfolio_id}/pnl?fy=2024-25
    Computes realized P&L for the given Indian financial year using FIFO lot
    matching, unrealized position gains at current prices, and estimated tax
    liability under post-July-2024 Union Budget rules.
"""
from __future__ import annotations

import asyncio
import math
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor as _TPE
from datetime import date, datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/tax")

# ── Thread pool for blocking yfinance / DB calls ──────────────────────────────

_tax_executor = _TPE(max_workers=8)

# ── Transaction type sets ─────────────────────────────────────────────────────

_BUY_TYPES  = {"BUY", "SIP", "SWITCH_IN", "BONUS"}
_SELL_TYPES = {"SELL", "SWP", "SWITCH_OUT"}

# ── Indian tax constants (post-July 2024 Union Budget) ───────────────────────

_EQUITY_STCG_RATE   = 0.20   # 20 %
_EQUITY_LTCG_RATE   = 0.125  # 12.5 %
_LTCG_EXEMPTION     = 125_000.0  # ₹1,25,000 per FY

# Holding-period thresholds (days)
_EQUITY_LTCG_DAYS   = 365   # ≥ 12 months  → LTCG
_DEBT_LTCG_DAYS     = 730   # ≥ 24 months  → LTCG

_EQUITY_ASSET_CLASSES = {"equity", "stock"}
_DEBT_ASSET_CLASSES   = {"debt", "mf", "mutual_fund", "bond"}


# ── Indian Financial Year helper ──────────────────────────────────────────────

def fy_date_range(fy: str) -> tuple[date, date]:
    """
    fy="2024-25" → (date(2024,4,1), date(2025,3,31))
    """
    start_year = int(fy.split("-")[0])
    return date(start_year, 4, 1), date(start_year + 1, 3, 31)


def _available_fy_options() -> list[str]:
    """Return the last 4 Indian financial year strings relative to today."""
    today = date.today()
    # Current FY starts on April 1; if before April 1, we're in previous FY
    current_fy_start = today.year if today.month >= 4 else today.year - 1
    result: list[str] = []
    for i in range(4):
        y = current_fy_start - i
        result.append(f"{y}-{str(y + 1)[-2:]}")
    return result


# ── yfinance LTP helpers (local, same pattern as other routers) ───────────────

def _ltp_sync(symbol: str) -> float | None:
    """Fetch last traded price for a symbol via yfinance (blocking)."""
    try:
        import yfinance as yf
        # Attempt NSE first, fall back to raw symbol
        for ticker_sym in (f"{symbol}.NS", symbol):
            try:
                fi = yf.Ticker(ticker_sym).fast_info
                v = fi.last_price
                if v is None:
                    continue
                f = float(v)
                if math.isnan(f) or math.isinf(f) or f <= 0:
                    continue
                return round(f, 2)
            except Exception:
                continue
        return None
    except Exception:
        return None


async def _ltp(symbol: str) -> float | None:
    """Async wrapper around _ltp_sync."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_tax_executor, _ltp_sync, symbol)


# ── Holding-period classification ─────────────────────────────────────────────

def _classify_gain(
    asset_class: str,
    holding_days: int,
) -> tuple[str, float]:
    """
    Returns (gain_type, tax_rate_pct) for a given asset class and holding period.

    Post-July 2024 rules:
    - Equity / Stock STCG (< 12 m): 20 %
    - Equity / Stock LTCG (≥ 12 m): 12.5 %
    - Debt / MF STCG (< 24 m): slab (returned as -1 sentinel)
    - Debt / MF LTCG (≥ 24 m): 12.5 % without indexation
    - F&O / Other: always STCG, slab
    """
    ac = (asset_class or "").lower()
    if ac in _EQUITY_ASSET_CLASSES:
        if holding_days >= _EQUITY_LTCG_DAYS:
            return "LTCG", _EQUITY_LTCG_RATE * 100
        return "STCG", _EQUITY_STCG_RATE * 100
    if ac in _DEBT_ASSET_CLASSES:
        if holding_days >= _DEBT_LTCG_DAYS:
            return "LTCG", _EQUITY_LTCG_RATE * 100  # 12.5 % no indexation
        return "STCG", -1.0  # as per slab
    # F&O / commodity / unknown → STCG slab
    return "STCG", -1.0


# ── Main endpoint ─────────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/pnl")
async def get_tax_pnl(
    portfolio_id: str,
    auth: Auth,
    fy: str = Query("2024-25", description='Indian financial year, e.g. "2024-25"'),
) -> dict[str, Any]:
    """
    GET /v1/tax/{portfolio_id}/pnl?fy=2024-25

    Compute Indian capital-gains tax P&L for the given financial year.
    Uses FIFO lot matching on ALL historical transactions for accurate
    cost-basis computation.
    """
    db = get_supabase()
    now_utc = datetime.now(timezone.utc)
    as_of = now_utc.date().isoformat()

    # ── 1. Verify portfolio ownership ─────────────────────────────────────────
    def _fetch_portfolio() -> dict | None:
        resp = (
            db.schema("markets")
            .from_("portfolios")
            .select("owner_user_id,user_id")
            .eq("id", portfolio_id)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None

    port = await asyncio.to_thread(_fetch_portfolio)
    if not port:
        raise HTTPException(404, detail="Portfolio not found")

    p = port
    if not (
        auth.is_service_account
        or p.get("owner_user_id") == auth.user_id
        or p.get("user_id") == auth.user_id
    ):
        raise HTTPException(403, detail="Access denied")

    # ── 2. Parse FY ───────────────────────────────────────────────────────────
    try:
        fy_start, fy_end = fy_date_range(fy)
    except (ValueError, IndexError):
        raise HTTPException(400, detail=f'Invalid fy format: "{fy}". Expected "YYYY-YY" e.g. "2024-25"')

    # ── 3. Load ALL transactions for this portfolio (full history for FIFO) ───
    def _fetch_all_transactions() -> list[dict]:
        return (
            db.schema("markets")
            .from_("transactions")
            .select(
                "id, instrument_id, txn_type, txn_date, qty, price, "
                "charges, net_amount, currency, asset_class, owner_user_id"
            )
            .eq("portfolio_id", portfolio_id)
            .order("txn_date", desc=False)
            .execute()
        ).data or []

    all_txns = await asyncio.to_thread(_fetch_all_transactions)

    if not all_txns:
        logger.info("tax_pnl.no_transactions", portfolio_id=portfolio_id, fy=fy)
        return _empty_response(portfolio_id, fy, fy_start, fy_end, as_of)

    # ── 4. Normalise and split transactions ───────────────────────────────────
    # Parse txn_date strings to date objects; normalise txn_type to uppercase
    parsed: list[dict] = []
    for t in all_txns:
        raw_date = t.get("txn_date")
        try:
            txn_date_obj = (
                date.fromisoformat(str(raw_date)[:10])
                if raw_date
                else None
            )
        except ValueError:
            txn_date_obj = None
        if txn_date_obj is None:
            continue

        parsed.append({
            "id":           t.get("id"),
            "symbol":       (t.get("instrument_id") or "").upper(),  # instrument_id used as symbol key
            "txn_type":     (t.get("txn_type") or "").upper(),
            "txn_date":     txn_date_obj,
            "qty":          float(t.get("qty") or 0),
            "price":        float(t.get("price") or 0),
            "charges":      float(t.get("charges") or 0),
            "asset_class":  (t.get("asset_class") or "equity").lower(),
        })

    # All BUYs (chronological, all time) — used to build FIFO queue
    all_buys  = [t for t in parsed if t["txn_type"] in _BUY_TYPES]
    # SELLs within FY only
    fy_sells  = [
        t for t in parsed
        if t["txn_type"] in _SELL_TYPES
        and fy_start <= t["txn_date"] <= fy_end
    ]

    # ── 5. Build FIFO buy queue per symbol ────────────────────────────────────
    # Queue entries: (buy_date, qty_remaining, price, asset_class)
    buy_queues: dict[str, deque[list]] = defaultdict(deque)
    for buy in all_buys:
        sym = buy["symbol"]
        buy_queues[sym].append([
            buy["txn_date"],        # 0: buy_date
            buy["qty"],             # 1: remaining_qty
            buy["price"],           # 2: buy_price
            buy["asset_class"],     # 3: asset_class
        ])

    # ── 6. FIFO matching for each FY sell ─────────────────────────────────────
    realized_trades: list[dict] = []

    for sell in fy_sells:
        sym        = sell["symbol"]
        sell_qty   = sell["qty"]
        sell_price = sell["price"]
        sell_date  = sell["txn_date"]
        sell_charges = sell["charges"]

        queue = buy_queues.get(sym)
        if not queue:
            # No matching buys found — skip (short-sell or data gap)
            logger.warning(
                "tax_pnl.no_buy_lots",
                portfolio_id=portfolio_id,
                symbol=sym,
                sell_date=sell_date.isoformat(),
            )
            continue

        remaining_sell = sell_qty

        while remaining_sell > 1e-9 and queue:
            lot = queue[0]  # peek at front of FIFO
            lot_date, lot_qty, lot_price, lot_ac = lot[0], lot[1], lot[2], lot[3]

            matched_qty = min(remaining_sell, lot_qty)

            # Prorate charges proportionally to matched qty
            charges_prorated = sell_charges * (matched_qty / sell_qty) if sell_qty > 0 else 0.0

            holding_days = (sell_date - lot_date).days
            gain_type, tax_rate_pct = _classify_gain(lot_ac, holding_days)
            raw_gain = (sell_price - lot_price) * matched_qty - charges_prorated

            realized_trades.append({
                "symbol":        sym,
                "asset_class":   lot_ac,
                "buy_date":      lot_date.isoformat(),
                "sell_date":     sell_date.isoformat(),
                "qty":           round(matched_qty, 6),
                "buy_price":     round(lot_price, 4),
                "sell_price":    round(sell_price, 4),
                "gain":          round(raw_gain, 4),
                "holding_days":  holding_days,
                "gain_type":     gain_type,
                "tax_rate_pct":  tax_rate_pct,
            })

            remaining_sell -= matched_qty
            lot[1] -= matched_qty  # deplete lot

            if lot[1] <= 1e-9:
                queue.popleft()  # lot exhausted

    # ── 7. Compute unrealized positions from remaining buy-queue lots ──────────
    # Aggregate open lots per symbol: sum qty, weighted avg price, oldest buy date
    open_positions: dict[str, dict] = {}
    for sym, queue in buy_queues.items():
        total_qty  = sum(lot[1] for lot in queue)
        if total_qty <= 1e-9:
            continue
        total_cost = sum(lot[1] * lot[2] for lot in queue)
        oldest_date = queue[0][0]  # deque front = earliest buy
        asset_class = queue[0][3]  # asset_class from earliest lot
        open_positions[sym] = {
            "symbol":         sym,
            "asset_class":    asset_class,
            "qty":            total_qty,
            "avg_buy_price":  total_cost / total_qty if total_qty > 0 else 0.0,
            "oldest_buy_date": oldest_date,
        }

    # Fetch current prices concurrently for open positions
    symbols_open = list(open_positions.keys())
    price_tasks  = [_ltp(sym) for sym in symbols_open]
    prices_list: list[float | None] = await asyncio.gather(*price_tasks)
    price_map: dict[str, float | None] = dict(zip(symbols_open, prices_list))

    unrealized_positions: list[dict] = []
    for sym, pos in open_positions.items():
        current_price = price_map.get(sym)
        avg_buy       = pos["avg_buy_price"]
        qty           = pos["qty"]
        oldest_date   = pos["oldest_buy_date"]
        holding_days  = (now_utc.date() - oldest_date).days
        gain_type, _  = _classify_gain(pos["asset_class"], holding_days)

        unrealized_gain = (
            (current_price - avg_buy) * qty
            if current_price is not None
            else 0.0
        )

        unrealized_positions.append({
            "symbol":          sym,
            "asset_class":     pos["asset_class"],
            "qty":             round(qty, 6),
            "avg_buy_price":   round(avg_buy, 4),
            "current_price":   round(current_price, 4) if current_price is not None else None,
            "unrealized_gain": round(unrealized_gain, 4),
            "oldest_buy_date": oldest_date.isoformat(),
            "holding_days":    holding_days,
            "gain_type":       gain_type,
        })

    # ── 8. Aggregate realized gains by bucket ─────────────────────────────────
    equity_stcg_total = 0.0
    equity_ltcg_total = 0.0
    other_stcg_total  = 0.0
    other_ltcg_total  = 0.0

    for trade in realized_trades:
        ac = (trade["asset_class"] or "").lower()
        gain = trade["gain"]
        gt   = trade["gain_type"]
        if ac in _EQUITY_ASSET_CLASSES:
            if gt == "LTCG":
                equity_ltcg_total += gain
            else:
                equity_stcg_total += gain
        else:
            if gt == "LTCG":
                other_ltcg_total += gain
            else:
                other_stcg_total += gain

    # ── 9. Tax estimates ──────────────────────────────────────────────────────
    equity_ltcg_taxable  = max(0.0, equity_ltcg_total - _LTCG_EXEMPTION)
    equity_stcg_tax_est  = max(0.0, equity_stcg_total) * _EQUITY_STCG_RATE
    equity_ltcg_tax_est  = equity_ltcg_taxable * _EQUITY_LTCG_RATE
    total_tax_est        = equity_stcg_tax_est + equity_ltcg_tax_est

    total_realized_gain   = sum(t["gain"] for t in realized_trades)
    total_unrealized_gain = sum(p["unrealized_gain"] for p in unrealized_positions)

    # Tax-loss harvesting opportunity:
    # LTCG gains that are still below the ₹1.25 L exemption threshold (room to realise more LTCG tax-free)
    remaining_exemption = max(0.0, _LTCG_EXEMPTION - equity_ltcg_total)
    # Among unrealized LTCG positions, how much gain is coverable by remaining exemption
    unrealized_equity_ltcg = sum(
        p["unrealized_gain"]
        for p in unrealized_positions
        if (p["asset_class"] or "").lower() in _EQUITY_ASSET_CLASSES
        and p["gain_type"] == "LTCG"
        and p["unrealized_gain"] > 0
    )
    harvesting_opportunity = min(remaining_exemption, unrealized_equity_ltcg)

    logger.info(
        "tax_pnl.computed",
        portfolio_id=portfolio_id,
        fy=fy,
        realized_trades=len(realized_trades),
        unrealized_positions=len(unrealized_positions),
        equity_stcg=round(equity_stcg_total, 2),
        equity_ltcg=round(equity_ltcg_total, 2),
        total_tax_est=round(total_tax_est, 2),
    )

    return {
        "portfolio_id": portfolio_id,
        "fy":           fy,
        "fy_start":     fy_start.isoformat(),
        "fy_end":       fy_end.isoformat(),
        "as_of":        as_of,
        "summary": {
            "equity_stcg":            round(equity_stcg_total, 4),
            "equity_ltcg":            round(equity_ltcg_total, 4),
            "equity_ltcg_exempt":     _LTCG_EXEMPTION,
            "equity_ltcg_taxable":    round(equity_ltcg_taxable, 4),
            "equity_stcg_tax_est":    round(equity_stcg_tax_est, 4),
            "equity_ltcg_tax_est":    round(equity_ltcg_tax_est, 4),
            "total_tax_est":          round(total_tax_est, 4),
            "total_realized_gain":    round(total_realized_gain, 4),
            "total_unrealized_gain":  round(total_unrealized_gain, 4),
            "harvesting_opportunity": round(harvesting_opportunity, 4),
        },
        "realized_trades":      realized_trades,
        "unrealized_positions": unrealized_positions,
        "available_fy_options": _available_fy_options(),
    }


# ── Empty-response helper ─────────────────────────────────────────────────────

def _empty_response(
    portfolio_id: str,
    fy: str,
    fy_start: date,
    fy_end: date,
    as_of: str,
) -> dict[str, Any]:
    return {
        "portfolio_id": portfolio_id,
        "fy":           fy,
        "fy_start":     fy_start.isoformat(),
        "fy_end":       fy_end.isoformat(),
        "as_of":        as_of,
        "summary": {
            "equity_stcg":            0.0,
            "equity_ltcg":            0.0,
            "equity_ltcg_exempt":     _LTCG_EXEMPTION,
            "equity_ltcg_taxable":    0.0,
            "equity_stcg_tax_est":    0.0,
            "equity_ltcg_tax_est":    0.0,
            "total_tax_est":          0.0,
            "total_realized_gain":    0.0,
            "total_unrealized_gain":  0.0,
            "harvesting_opportunity": 0.0,
        },
        "realized_trades":      [],
        "unrealized_positions": [],
        "available_fy_options": _available_fy_options(),
    }
