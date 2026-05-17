"""Portfolio rebalancing rules, drift analysis, and alert management.

GET    /v1/rebalancing/{portfolio_id}/rules                  — list rules
POST   /v1/rebalancing/{portfolio_id}/rules                  — upsert rule for a symbol
DELETE /v1/rebalancing/{portfolio_id}/rules/{rule_id}        — delete rule
GET    /v1/rebalancing/{portfolio_id}/analysis               — full drift + trade recommendations
POST   /v1/rebalancing/{portfolio_id}/alerts/acknowledge     — acknowledge alert IDs
"""
from __future__ import annotations

import asyncio
import math
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/rebalancing", tags=["rebalancing"])

_DRIFT_THRESHOLD_PCT = 5.0

# ── LTP helpers ───────────────────────────────────────────────────────────────

_reb_executor = ThreadPoolExecutor(max_workers=8)


def _ltp_sync(symbol: str) -> float | None:
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


async def _ltp(symbol: str) -> float | None:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_reb_executor, _ltp_sync, symbol)


# ── Pydantic models ───────────────────────────────────────────────────────────

class RuleBody(BaseModel):
    symbol: str
    target_weight: float          # 0–100 (percent)
    min_weight: float = 0.0
    max_weight: float = 100.0
    alert_enabled: bool = True
    notes: str = ""


class AcknowledgeBody(BaseModel):
    alert_ids: list[str]


# ── Ownership check helper ────────────────────────────────────────────────────

def _check_ownership(db: Any, portfolio_id: str, auth: "AuthContext") -> None:  # type: ignore[name-defined]
    """Raises HTTPException(404/403) if portfolio not found or not owned."""
    port = (
        db.schema("markets")
        .from_("portfolios")
        .select("owner_user_id, user_id")
        .eq("id", portfolio_id)
        .limit(1)
        .execute()
    )
    if not port.data:
        raise HTTPException(404, "Portfolio not found")
    p = port.data[0]
    if not (
        auth.is_service_account
        or p.get("owner_user_id") == auth.user_id
        or p.get("user_id") == auth.user_id
    ):
        raise HTTPException(403, "Not your portfolio")


# ── 1. GET rules ──────────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/rules")
async def list_rules(portfolio_id: str, auth: Auth) -> list[dict[str, Any]]:
    """Return all rebalancing rules for the portfolio."""
    db = get_supabase()

    await asyncio.to_thread(_check_ownership, db, portfolio_id, auth)

    def _fetch() -> list[dict]:
        return (
            db.schema("markets")
            .from_("rebalancing_rules")
            .select("id, symbol, target_weight, min_weight, max_weight, alert_enabled, notes")
            .eq("portfolio_id", portfolio_id)
            .order("symbol", desc=False)
            .execute()
        ).data or []

    rows = await asyncio.to_thread(_fetch)
    logger.info("rebalancing.rules.list", portfolio_id=portfolio_id, count=len(rows))
    return rows


# ── 2. POST rule (upsert) ─────────────────────────────────────────────────────

@router.post("/{portfolio_id}/rules", status_code=201)
async def upsert_rule(portfolio_id: str, body: RuleBody, auth: Auth) -> dict[str, Any]:
    """Create or update the rule for a symbol in this portfolio."""
    db = get_supabase()

    await asyncio.to_thread(_check_ownership, db, portfolio_id, auth)

    symbol_upper = body.symbol.strip().upper()

    # Fetch existing rules so we can validate the total target weight.
    def _fetch_existing() -> list[dict]:
        return (
            db.schema("markets")
            .from_("rebalancing_rules")
            .select("id, symbol, target_weight")
            .eq("portfolio_id", portfolio_id)
            .execute()
        ).data or []

    existing = await asyncio.to_thread(_fetch_existing)

    # Find existing rule for this symbol (if any)
    existing_rule: dict | None = next(
        (r for r in existing if r["symbol"].upper() == symbol_upper), None
    )

    # Compute projected sum of target weights after this upsert
    current_total = sum(
        float(r["target_weight"])
        for r in existing
        if r["symbol"].upper() != symbol_upper   # exclude the one being overwritten
    )
    projected_total = current_total + body.target_weight

    if projected_total > 100.0 + 1e-9:  # small epsilon for float rounding
        raise HTTPException(
            400,
            f"Target weights exceed 100%: current other rules sum to "
            f"{current_total:.2f}%, adding {body.target_weight:.2f}% would total "
            f"{projected_total:.2f}%",
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    if existing_rule:
        # UPDATE
        rule_id = existing_rule["id"]

        def _update() -> dict:
            return (
                db.schema("markets")
                .from_("rebalancing_rules")
                .update(
                    {
                        "target_weight": body.target_weight,
                        "min_weight": body.min_weight,
                        "max_weight": body.max_weight,
                        "alert_enabled": body.alert_enabled,
                        "notes": body.notes,
                        "updated_at": now_iso,
                    }
                )
                .eq("id", rule_id)
                .execute()
            ).data[0]

        rule = await asyncio.to_thread(_update)
    else:
        # INSERT
        rule_id = str(uuid.uuid4())

        def _insert() -> dict:
            return (
                db.schema("markets")
                .from_("rebalancing_rules")
                .insert(
                    {
                        "id": rule_id,
                        "portfolio_id": portfolio_id,
                        "symbol": symbol_upper,
                        "target_weight": body.target_weight,
                        "min_weight": body.min_weight,
                        "max_weight": body.max_weight,
                        "alert_enabled": body.alert_enabled,
                        "notes": body.notes,
                        "created_at": now_iso,
                        "updated_at": now_iso,
                    }
                )
                .execute()
            ).data[0]

        rule = await asyncio.to_thread(_insert)

    logger.info(
        "rebalancing.rule.upsert",
        portfolio_id=portfolio_id,
        symbol=symbol_upper,
        target_weight=body.target_weight,
        action="update" if existing_rule else "insert",
    )
    return rule


# ── 3. DELETE rule ────────────────────────────────────────────────────────────

@router.delete("/{portfolio_id}/rules/{rule_id}", status_code=204)
async def delete_rule(portfolio_id: str, rule_id: str, auth: Auth) -> None:
    """Delete a rebalancing rule by ID."""
    db = get_supabase()

    await asyncio.to_thread(_check_ownership, db, portfolio_id, auth)

    def _delete() -> None:
        db.schema("markets").from_("rebalancing_rules").delete().eq("id", rule_id).eq(
            "portfolio_id", portfolio_id
        ).execute()

    await asyncio.to_thread(_delete)
    logger.info("rebalancing.rule.delete", portfolio_id=portfolio_id, rule_id=rule_id)


# ── 4. GET analysis ───────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/analysis")
async def get_analysis(portfolio_id: str, auth: Auth) -> dict[str, Any]:
    """
    Full rebalancing analysis: current weights, drift, trade recommendations,
    and alert insertion for out-of-band positions.
    """
    db = get_supabase()
    now_utc = datetime.now(timezone.utc)

    await asyncio.to_thread(_check_ownership, db, portfolio_id, auth)

    # ── Step 1: load holdings (quantity > 0) ─────────────────────────────────

    def _fetch_holdings() -> list[dict]:
        return (
            db.schema("markets")
            .from_("holdings")
            .select("id, symbol, quantity, avg_cost, instrument_id")
            .eq("portfolio_id", portfolio_id)
            .gt("quantity", 0)
            .execute()
        ).data or []

    # ── Step 2 (parallel): load rules alongside holdings ──────────────────────

    def _fetch_rules() -> list[dict]:
        return (
            db.schema("markets")
            .from_("rebalancing_rules")
            .select(
                "id, symbol, target_weight, min_weight, max_weight, alert_enabled, notes"
            )
            .eq("portfolio_id", portfolio_id)
            .execute()
        ).data or []

    holdings_rows, rules_rows = await asyncio.gather(
        asyncio.to_thread(_fetch_holdings),
        asyncio.to_thread(_fetch_rules),
    )

    if not holdings_rows:
        return {
            "portfolio_id": portfolio_id,
            "total_value": 0.0,
            "as_of": now_utc.isoformat(),
            "positions": [],
            "unallocated_weight": 100.0
            - sum(float(r["target_weight"]) for r in rules_rows),
            "drift_threshold_pct": _DRIFT_THRESHOLD_PCT,
            "alerts": [],
        }

    # ── Step 2 cont: fetch LTPs concurrently ─────────────────────────────────

    symbols = [h["symbol"] for h in holdings_rows]
    ltp_results: list[float | None] = await asyncio.gather(
        *[_ltp(sym) for sym in symbols]
    )

    # ── Step 3: compute current values ───────────────────────────────────────

    current_values: dict[str, float] = {}
    ltp_map: dict[str, float] = {}

    for holding, price in zip(holdings_rows, ltp_results):
        sym = holding["symbol"]
        qty = float(holding.get("quantity") or 0)
        avg_cost = float(holding.get("avg_cost") or 0)
        effective_price = price if price is not None else avg_cost
        ltp_map[sym] = effective_price
        current_values[sym] = qty * effective_price

    # ── Step 4: total portfolio value ─────────────────────────────────────────

    total_value = sum(current_values.values())

    # ── Step 5: current weight per holding ───────────────────────────────────

    current_weights: dict[str, float] = {}
    for sym, val in current_values.items():
        current_weights[sym] = (val / total_value * 100) if total_value > 0 else 0.0

    # ── Step 6: build rule lookup by symbol ───────────────────────────────────

    rules_by_symbol: dict[str, dict] = {
        r["symbol"].upper(): r for r in rules_rows
    }

    # ── Steps 7–9: build positions with drift + trade recommendations ─────────

    positions: list[dict] = []

    for holding in holdings_rows:
        sym = holding["symbol"].upper()
        qty = float(holding.get("quantity") or 0)
        avg_cost = float(holding.get("avg_cost") or 0)
        current_price = ltp_map.get(sym, avg_cost)
        c_val = current_values.get(sym, 0.0)
        c_weight = current_weights.get(sym, 0.0)

        rule = rules_by_symbol.get(sym)
        has_rule = rule is not None

        target_weight: float | None = float(rule["target_weight"]) if rule else None
        min_weight: float | None = float(rule["min_weight"]) if rule else None
        max_weight: float | None = float(rule["max_weight"]) if rule else None

        drift: float | None = None
        trade_action: str | None = None
        trade_qty: int | None = None
        trade_value: float | None = None
        status: str = "no_rule"

        if rule is not None and target_weight is not None:
            drift = round(c_weight - target_weight, 4)

            target_val = target_weight / 100.0 * total_value
            trade_val = target_val - c_val
            trade_value = round(trade_val, 2)

            if abs(drift) <= _DRIFT_THRESHOLD_PCT:
                status = "on_target"
            elif drift > 0:
                status = "overweight"
            else:
                status = "underweight"

            if current_price and current_price > 0:
                if trade_val > 0:
                    trade_action = "BUY"
                    trade_qty = math.floor(trade_val / current_price)
                elif trade_val < 0:
                    trade_action = "SELL"
                    trade_qty = math.floor(abs(trade_val) / current_price)
                else:
                    trade_action = "HOLD"
                    trade_qty = 0
            else:
                trade_action = "HOLD"
                trade_qty = 0

        positions.append(
            {
                "symbol": sym,
                "quantity": qty,
                "avg_cost": round(avg_cost, 4),
                "current_price": round(current_price, 4),
                "current_value": round(c_val, 4),
                "current_weight": round(c_weight, 4),
                "has_rule": has_rule,
                "target_weight": target_weight,
                "min_weight": min_weight,
                "max_weight": max_weight,
                "drift": drift,
                "status": status,
                "trade_action": trade_action,
                "trade_qty": trade_qty,
                "trade_value": trade_value,
            }
        )

    # ── Step 10: alert insertion ───────────────────────────────────────────────

    async def _maybe_insert_alert(rule: dict, c_weight: float) -> dict | None:
        """Insert an unacknowledged alert if threshold is breached and none exists."""
        if not rule.get("alert_enabled"):
            return None

        min_w = float(rule.get("min_weight") or 0.0)
        max_w = float(rule.get("max_weight") or 100.0)
        target_w = float(rule.get("target_weight") or 0.0)

        if c_weight < min_w:
            direction = "under"
        elif c_weight > max_w:
            direction = "over"
        else:
            return None  # within bounds, no alert needed

        rule_id = rule["id"]
        sym = rule["symbol"]

        # Check for existing unacknowledged alert for this rule
        def _existing() -> bool:
            resp = (
                db.schema("markets")
                .from_("rebalancing_alerts")
                .select("id")
                .eq("rule_id", rule_id)
                .eq("acknowledged", False)
                .limit(1)
                .execute()
            )
            return bool(resp.data)

        already_exists = await asyncio.to_thread(_existing)
        if already_exists:
            return None

        # Insert new alert
        alert_id = str(uuid.uuid4())
        triggered_at = now_utc.isoformat()

        def _insert() -> dict:
            return (
                db.schema("markets")
                .from_("rebalancing_alerts")
                .insert(
                    {
                        "id": alert_id,
                        "rule_id": rule_id,
                        "portfolio_id": portfolio_id,
                        "symbol": sym,
                        "current_weight": round(c_weight, 4),
                        "target_weight": target_w,
                        "direction": direction,
                        "triggered_at": triggered_at,
                        "acknowledged": False,
                    }
                )
                .execute()
            ).data[0]

        try:
            inserted = await asyncio.to_thread(_insert)
            logger.info(
                "rebalancing.alert.inserted",
                portfolio_id=portfolio_id,
                symbol=sym,
                direction=direction,
                current_weight=c_weight,
            )
            return inserted
        except Exception as exc:
            logger.warning("rebalancing.alert.insert_failed", error=str(exc), symbol=sym)
            return None

    alert_tasks = [
        _maybe_insert_alert(rule, current_weights.get(rule["symbol"].upper(), 0.0))
        for rule in rules_rows
    ]
    alert_results = await asyncio.gather(*alert_tasks)
    new_alerts = [a for a in alert_results if a is not None]

    # ── Fetch all unacknowledged alerts for response ───────────────────────────

    def _fetch_alerts() -> list[dict]:
        return (
            db.schema("markets")
            .from_("rebalancing_alerts")
            .select(
                "id, rule_id, portfolio_id, symbol, current_weight, "
                "target_weight, direction, triggered_at, acknowledged"
            )
            .eq("portfolio_id", portfolio_id)
            .eq("acknowledged", False)
            .order("triggered_at", desc=True)
            .limit(50)
            .execute()
        ).data or []

    unacknowledged_alerts = await asyncio.to_thread(_fetch_alerts)

    # ── Unallocated weight ─────────────────────────────────────────────────────

    total_target_weight = sum(float(r["target_weight"]) for r in rules_rows)
    unallocated_weight = round(100.0 - total_target_weight, 4)

    logger.info(
        "rebalancing.analysis",
        portfolio_id=portfolio_id,
        position_count=len(positions),
        total_value=round(total_value, 2),
        new_alerts=len(new_alerts),
        unacknowledged_alerts=len(unacknowledged_alerts),
    )

    return {
        "portfolio_id": portfolio_id,
        "total_value": round(total_value, 4),
        "as_of": now_utc.isoformat(),
        "positions": positions,
        "unallocated_weight": unallocated_weight,
        "drift_threshold_pct": _DRIFT_THRESHOLD_PCT,
        "alerts": unacknowledged_alerts,
    }


# ── 5. POST acknowledge alerts ────────────────────────────────────────────────

@router.post("/{portfolio_id}/alerts/acknowledge")
async def acknowledge_alerts(
    portfolio_id: str,
    body: AcknowledgeBody,
    auth: Auth,
) -> dict[str, int]:
    """Set acknowledged=true on the supplied alert IDs (must belong to this portfolio)."""
    db = get_supabase()

    await asyncio.to_thread(_check_ownership, db, portfolio_id, auth)

    if not body.alert_ids:
        return {"acknowledged": 0}

    def _ack() -> int:
        resp = (
            db.schema("markets")
            .from_("rebalancing_alerts")
            .update({"acknowledged": True})
            .in_("id", body.alert_ids)
            .eq("portfolio_id", portfolio_id)  # safety: only own portfolio
            .execute()
        )
        return len(resp.data) if resp.data else 0

    count = await asyncio.to_thread(_ack)
    logger.info(
        "rebalancing.alerts.acknowledged",
        portfolio_id=portfolio_id,
        requested=len(body.alert_ids),
        updated=count,
    )
    return {"acknowledged": count}
