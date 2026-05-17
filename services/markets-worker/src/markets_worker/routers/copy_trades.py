"""
Copy-trade endpoints.

Copy relationships
  GET    /v1/copy-trades                           — list current user's copy relationships
  POST   /v1/copy-trades                           — start copying a trader
  PATCH  /v1/copy-trades/{copy_trade_id}           — update status or allocation_pct
  DELETE /v1/copy-trades/{copy_trade_id}           — soft-delete (set status='stopped')

Executions
  GET    /v1/copy-trades/executions                — list user's copy executions (last 50)
  POST   /v1/copy-trades/{copy_trade_id}/execute   — one-tap: mirror an idea into paper portfolio

Public
  GET    /v1/copy-trades/leaderboard               — top traders by follower + idea count (no auth)
"""

from __future__ import annotations

import asyncio
import math
from datetime import datetime, timezone
from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/copy-trades", tags=["copy-trades"])


# ── LTP helpers ───────────────────────────────────────────────────────────────

def _get_ltp_sync(symbol: str) -> float | None:
    try:
        import yfinance as yf  # noqa: PLC0415
        fi = yf.Ticker(f"{symbol}.NS").fast_info
        v = fi.last_price
        if v is None:
            return None
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else round(f, 2)
    except Exception:
        return None


async def _get_ltp(symbol: str) -> float | None:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _get_ltp_sync, symbol)


# ── Pydantic models ───────────────────────────────────────────────────────────

class StartCopyBody(BaseModel):
    trader_id: str
    paper_portfolio_id: str
    allocation_pct: float = Field(default=10.0, gt=0.0, le=100.0)


class UpdateCopyBody(BaseModel):
    status: Literal["active", "paused", "stopped"] | None = None
    allocation_pct: float | None = Field(default=None, gt=0.0, le=100.0)


class ExecuteBody(BaseModel):
    idea_id: str
    side: Literal["BUY", "SELL"]
    quantity: float | None = Field(default=None, gt=0.0)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _load_copy_trade(copy_trade_id: str) -> dict | None:
    db = get_supabase()
    return (
        db.schema("markets").from_("copy_trades")
        .select("*")
        .eq("id", copy_trade_id)
        .maybe_single()
        .execute()
    ).data


def _require_owner(copy_trade: dict | None, user_id: str, copy_trade_id: str) -> dict:
    """Assert the copy_trade exists and belongs to user_id; raise appropriate HTTP errors."""
    if not copy_trade:
        raise HTTPException(404, detail=f"Copy trade {copy_trade_id} not found")
    if copy_trade["copier_id"] != user_id:
        raise HTTPException(403, detail="You do not own this copy trade")
    return copy_trade


def _verify_portfolio_ownership(portfolio_id: str, user_id: str) -> None:
    """Verify paper_portfolio_id exists and belongs to the given user."""
    db = get_supabase()
    row = (
        db.schema("markets").from_("portfolios")
        .select("id, owner_user_id")
        .eq("id", portfolio_id)
        .eq("owner_user_id", user_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(404, detail="Portfolio not found or does not belong to you")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_copy_trades(
    auth: Auth,
    status: str = Query(default="active"),
) -> list[dict]:
    """List the current user's copy relationships with idea/execution counts."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    db = get_supabase()

    q = (
        db.schema("markets").from_("copy_trades")
        .select("id, trader_id, paper_portfolio_id, status, allocation_pct, created_at")
        .eq("copier_id", auth.user_id)
    )
    if status != "all":
        q = q.eq("status", status)

    copy_trades = q.order("created_at", desc=True).execute().data or []

    if not copy_trades:
        return []

    # Collect trader ids for idea count lookup
    trader_ids = list({ct["trader_id"] for ct in copy_trades})
    copy_trade_ids = [ct["id"] for ct in copy_trades]

    # Idea counts per trader
    idea_rows = (
        db.schema("markets").from_("ideas")
        .select("user_id")
        .in_("user_id", trader_ids)
        .execute()
    ).data or []
    idea_count_map: dict[str, int] = {}
    for row in idea_rows:
        tid = row["user_id"]
        idea_count_map[tid] = idea_count_map.get(tid, 0) + 1

    # Execution counts per copy_trade
    exec_rows = (
        db.schema("markets").from_("copy_executions")
        .select("copy_trade_id")
        .in_("copy_trade_id", copy_trade_ids)
        .execute()
    ).data or []
    exec_count_map: dict[str, int] = {}
    for row in exec_rows:
        cid = row["copy_trade_id"]
        exec_count_map[cid] = exec_count_map.get(cid, 0) + 1

    result = []
    for ct in copy_trades:
        result.append({
            "id":                  ct["id"],
            "trader_id":           ct["trader_id"],
            "paper_portfolio_id":  ct["paper_portfolio_id"],
            "status":              ct["status"],
            "allocation_pct":      ct["allocation_pct"],
            "created_at":          ct["created_at"],
            "trader_idea_count":   idea_count_map.get(ct["trader_id"], 0),
            "execution_count":     exec_count_map.get(ct["id"], 0),
        })

    logger.info(
        "copy_trades.list",
        user_id=auth.user_id,
        status_filter=status,
        count=len(result),
    )
    return result


@router.post("", status_code=201)
async def start_copy_trade(body: StartCopyBody, auth: Auth) -> dict:
    """Start copying a trader (upserts on conflict)."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    if body.trader_id == auth.user_id:
        raise HTTPException(403, detail="You cannot copy yourself")

    _verify_portfolio_ownership(body.paper_portfolio_id, auth.user_id)

    db = get_supabase()

    # Check if a record already exists for this (copier, trader) pair
    existing = (
        db.schema("markets").from_("copy_trades")
        .select("*")
        .eq("copier_id", auth.user_id)
        .eq("trader_id", body.trader_id)
        .maybe_single()
        .execute()
    ).data

    now = _now_iso()

    if existing:
        # Reactivate if stopped, otherwise just update allocation/portfolio
        updated = (
            db.schema("markets").from_("copy_trades")
            .update({
                "status":              "active",
                "allocation_pct":      body.allocation_pct,
                "paper_portfolio_id":  body.paper_portfolio_id,
                "updated_at":          now,
            })
            .eq("id", existing["id"])
            .execute()
        ).data
        row = updated[0] if updated else existing
        logger.info(
            "copy_trades.reactivated",
            copy_trade_id=existing["id"],
            user_id=auth.user_id,
            trader_id=body.trader_id,
        )
        return row

    # Insert new row
    inserted = (
        db.schema("markets").from_("copy_trades")
        .insert({
            "copier_id":           auth.user_id,
            "trader_id":           body.trader_id,
            "paper_portfolio_id":  body.paper_portfolio_id,
            "status":              "active",
            "allocation_pct":      body.allocation_pct,
            "created_at":          now,
            "updated_at":          now,
        })
        .execute()
    ).data

    row = inserted[0] if inserted else {}
    logger.info(
        "copy_trades.created",
        copy_trade_id=row.get("id"),
        user_id=auth.user_id,
        trader_id=body.trader_id,
    )
    return row


@router.patch("/{copy_trade_id}")
async def update_copy_trade(copy_trade_id: str, body: UpdateCopyBody, auth: Auth) -> dict:
    """Update status (pause/resume/stop) or allocation_pct for a copy trade."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    ct = _load_copy_trade(copy_trade_id)
    _require_owner(ct, auth.user_id, copy_trade_id)

    updates: dict = {"updated_at": _now_iso()}
    if body.status is not None:
        updates["status"] = body.status
    if body.allocation_pct is not None:
        updates["allocation_pct"] = body.allocation_pct

    if len(updates) == 1:
        # Only updated_at — nothing meaningful to change
        raise HTTPException(400, detail="Provide at least one field to update (status or allocation_pct)")

    db = get_supabase()
    updated = (
        db.schema("markets").from_("copy_trades")
        .update(updates)
        .eq("id", copy_trade_id)
        .execute()
    ).data

    row = updated[0] if updated else ct
    logger.info(
        "copy_trades.updated",
        copy_trade_id=copy_trade_id,
        updates=updates,
        user_id=auth.user_id,
    )
    return row


@router.delete("/{copy_trade_id}", status_code=204)
async def delete_copy_trade(copy_trade_id: str, auth: Auth) -> None:
    """Soft-delete a copy trade by setting its status to 'stopped'."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    ct = _load_copy_trade(copy_trade_id)
    _require_owner(ct, auth.user_id, copy_trade_id)

    db = get_supabase()
    db.schema("markets").from_("copy_trades").update({
        "status":     "stopped",
        "updated_at": _now_iso(),
    }).eq("id", copy_trade_id).execute()

    logger.info(
        "copy_trades.stopped",
        copy_trade_id=copy_trade_id,
        user_id=auth.user_id,
    )


@router.get("/executions")
async def list_copy_executions(auth: Auth) -> list[dict]:
    """List the current user's copy executions, most recent first (limit 50)."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    db = get_supabase()
    rows = (
        db.schema("markets").from_("copy_executions")
        .select("id, copy_trade_id, idea_id, symbol, side, quantity, price, amount, executed_at")
        .eq("copier_id", auth.user_id)
        .order("executed_at", desc=True)
        .limit(50)
        .execute()
    ).data or []

    return rows


@router.post("/{copy_trade_id}/execute")
async def execute_copy_trade(copy_trade_id: str, body: ExecuteBody, auth: Auth) -> dict:
    """One-tap execute: mirror an idea into the paper portfolio."""
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")

    db = get_supabase()

    # 1. Load and validate the copy trade
    ct = _load_copy_trade(copy_trade_id)
    _require_owner(ct, auth.user_id, copy_trade_id)

    if ct["status"] != "active":
        raise HTTPException(400, detail=f"Copy trade is '{ct['status']}', must be 'active' to execute")

    # 2. Load the idea
    idea = (
        db.schema("markets").from_("ideas")
        .select("id, user_id, symbol, direction, entry_price, target_price, stop_loss")
        .eq("id", body.idea_id)
        .maybe_single()
        .execute()
    ).data

    if not idea:
        raise HTTPException(404, detail=f"Idea {body.idea_id} not found")

    symbol: str = idea.get("symbol") or ""
    if not symbol:
        raise HTTPException(400, detail="Idea does not have a symbol set")

    # 3. Fetch LTP
    ltp = await _get_ltp(symbol)

    if ltp is None:
        # Fallback to idea's entry_price
        entry_price = idea.get("entry_price")
        if entry_price is not None:
            try:
                ltp = float(entry_price)
            except (TypeError, ValueError):
                ltp = None
        if ltp is None or math.isnan(ltp) or ltp <= 0:
            raise HTTPException(
                400,
                detail=f"Could not fetch LTP for {symbol} and idea has no valid entry_price fallback",
            )
        logger.warning(
            "copy_trades.ltp_fallback",
            symbol=symbol,
            fallback_price=ltp,
            idea_id=body.idea_id,
        )

    # 4. Resolve quantity
    quantity = body.quantity
    paper_portfolio_id: str = ct["paper_portfolio_id"]
    allocation_pct: float = float(ct["allocation_pct"])

    if quantity is None:
        # Auto-compute from allocation_pct and available cash
        capital_row = (
            db.schema("markets").from_("paper_capital")
            .select("cash_balance, initial_capital")
            .eq("portfolio_id", paper_portfolio_id)
            .maybe_single()
            .execute()
        ).data

        if not capital_row:
            raise HTTPException(
                400,
                detail="Paper capital not seeded for this portfolio. Call POST /v1/paper/portfolio/seed first.",
            )

        cash_balance = float(capital_row["cash_balance"])
        alloc_cash = (allocation_pct / 100.0) * cash_balance
        quantity = math.floor(alloc_cash / ltp)

    quantity = float(quantity)

    if quantity < 1:
        raise HTTPException(
            400,
            detail=(
                f"Insufficient paper funds: computed quantity is 0. "
                f"Allocation {allocation_pct}% of available cash cannot buy even 1 share at ₹{ltp:,.2f}."
            ),
        )

    # 5. Compute amount
    amount = round(quantity * ltp, 2)
    side: str = body.side
    executed_at = _now_iso()

    # 6. Insert transaction into markets.transactions
    db.schema("markets").from_("transactions").insert({
        "portfolio_id":   paper_portfolio_id,
        "user_id":        auth.user_id,
        "instrument_id":  None,
        "symbol":         symbol,
        "exchange":       "NSE",
        "transaction_type": side,        # "BUY" or "SELL"
        "quantity":       quantity,
        "price":          ltp,
        "amount":         amount,
        "notes":          f"Copy trade from idea {body.idea_id}",
    }).execute()

    # 7. Update paper_capital cash balance
    # Re-read current cash to avoid stale reads in case of concurrent requests
    capital_row = (
        db.schema("markets").from_("paper_capital")
        .select("cash_balance")
        .eq("portfolio_id", paper_portfolio_id)
        .maybe_single()
        .execute()
    ).data

    if capital_row:
        current_cash = float(capital_row["cash_balance"])
        new_cash = (current_cash - amount) if side == "BUY" else (current_cash + amount)
        db.schema("markets").from_("paper_capital").update({
            "cash_balance": round(new_cash, 2),
            "updated_at":   executed_at,
        }).eq("portfolio_id", paper_portfolio_id).execute()

    # 8. Insert into copy_executions
    exec_row = db.schema("markets").from_("copy_executions").insert({
        "copy_trade_id":    copy_trade_id,
        "idea_id":          body.idea_id,
        "copier_id":        auth.user_id,
        "symbol":           symbol,
        "side":             side,
        "quantity":         quantity,
        "price":            ltp,
        "amount":           amount,
        "paper_portfolio_id": paper_portfolio_id,
        "executed_at":      executed_at,
    }).execute().data

    logger.info(
        "copy_trades.executed",
        copy_trade_id=copy_trade_id,
        idea_id=body.idea_id,
        symbol=symbol,
        side=side,
        quantity=quantity,
        price=ltp,
        amount=amount,
        user_id=auth.user_id,
    )

    return {
        "status":      "executed",
        "symbol":      symbol,
        "side":        side,
        "quantity":    quantity,
        "price":       ltp,
        "amount":      amount,
        "executed_at": executed_at,
    }


@router.get("/leaderboard")
async def get_leaderboard() -> list[dict]:
    """Public leaderboard: top 20 traders by follower count, then idea count."""
    db = get_supabase()

    # Fetch all ideas with entry_price and target_price for potential return calc
    idea_rows = (
        db.schema("markets").from_("ideas")
        .select("user_id, entry_price, target_price")
        .execute()
    ).data or []

    # Aggregate idea counts and potential return per user
    user_ideas: dict[str, list[dict]] = {}
    for row in idea_rows:
        uid = row["user_id"]
        user_ideas.setdefault(uid, []).append(row)

    # Fetch follower counts from idea_follows (following_id = the trader being followed)
    follow_rows = (
        db.schema("markets").from_("idea_follows")
        .select("following_id")
        .execute()
    ).data or []

    follower_count_map: dict[str, int] = {}
    for row in follow_rows:
        fid = row["following_id"]
        follower_count_map[fid] = follower_count_map.get(fid, 0) + 1

    # Build leaderboard entries for all users with at least one idea
    entries: list[dict] = []
    for uid, ideas in user_ideas.items():
        idea_count = len(ideas)

        # Compute avg_potential_return_pct for ideas that have both entry and target price
        returns: list[float] = []
        for idea in ideas:
            ep = idea.get("entry_price")
            tp = idea.get("target_price")
            try:
                if ep is not None and tp is not None:
                    ep_f = float(ep)
                    tp_f = float(tp)
                    if ep_f > 0:
                        returns.append((tp_f - ep_f) / ep_f * 100.0)
            except (TypeError, ValueError):
                pass

        avg_return = round(sum(returns) / len(returns), 2) if returns else None

        entries.append({
            "user_id":                 uid,
            "idea_count":              idea_count,
            "follower_count":          follower_count_map.get(uid, 0),
            "avg_potential_return_pct": avg_return,
        })

    # Sort: follower_count DESC, then idea_count DESC
    entries.sort(key=lambda x: (-x["follower_count"], -x["idea_count"]))

    return entries[:20]
