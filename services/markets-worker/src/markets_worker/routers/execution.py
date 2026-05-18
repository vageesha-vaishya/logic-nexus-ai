# services/markets-worker/src/markets_worker/routers/execution.py
"""
Autonomous execution: rules CRUD, order submission with Layer 0 validation,
autonomy phase enforcement, and SEBI audit trail logging.

POST /v1/execution/rules           — save an auto-execution rule
GET  /v1/execution/rules           — list user's rules
DELETE /v1/execution/rules/{id}    — soft-delete a rule
POST /v1/execution/orders          — submit an order (paper or live, phase-gated)
GET  /v1/execution/audit           — user's audit log (most recent 50)
GET  /v1/execution/progress        — current autonomy phase + kill switch state
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from markets_worker.auth import Auth
from markets_worker.autonomous.data_validator import run_all_checks, all_passed
from markets_worker.db import get_supabase
from markets_worker.routers.ltp import _ltp_cache

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/execution")

PAPER_TRADES_REQUIRED = 10
MICRO_TRADES_REQUIRED = 5


class CreateRuleRequest(BaseModel):
    name: str
    description: str = ""
    asset_class: str
    instrument_id: str | None = None
    signal_type: Literal["buy", "sell", "both"]
    order_type: Literal["MARKET", "LIMIT", "SL", "SL-M"] = "MARKET"
    product: Literal["CNC", "MIS", "NRML"] = "CNC"
    max_order_value: float = 10_000.0
    algo_id: str | None = None


class PlaceOrderRequest(BaseModel):
    rule_id: str
    signal_id: str
    tradingsymbol: str
    exchange: str
    side: Literal["BUY", "SELL"]
    quantity: int
    order_value: float
    portfolio_nav: float
    price: float | None = None
    trigger_price: float | None = None

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v


def _get_progress(db: Any, user_id: str) -> dict:
    row = (
        db.schema("markets").from_("autonomy_progress")
        .select("current_phase, kill_switch_level, paper_trades_done, micro_trades_done")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        try:
            db.schema("markets").from_("autonomy_progress").insert({"user_id": user_id}).execute()
        except Exception:
            pass
        return {"current_phase": "paper", "kill_switch_level": "none",
                "paper_trades_done": 0, "micro_trades_done": 0}
    return row


def _log_audit(db: Any, user_id: str, body: PlaceOrderRequest, phase: str,
               checks: dict, status: str, broker_order_id: str | None = None,
               rejection_reason: str | None = None) -> None:
    try:
        db.schema("markets").from_("execution_audit_log").insert({
            "user_id": user_id,
            "rule_id": body.rule_id,
            "signal_id": body.signal_id,
            "tradingsymbol": body.tradingsymbol,
            "exchange": body.exchange,
            "side": body.side,
            "order_type": "MARKET",
            "quantity": body.quantity,
            "price": body.price,
            "order_value": body.order_value,
            "portfolio_nav_at_order": body.portfolio_nav,
            "phase": phase,
            "pre_trade_checks": {k: v.to_dict() for k, v in checks.items()},
            "status": status,
            "broker_order_id": broker_order_id,
            "rejection_reason": rejection_reason,
            "kill_switch_active": False,
        }).execute()
    except Exception as exc:
        logger.error("audit_log_failed", error=str(exc))


def _submit_paper_order(tradingsymbol: str, exchange: str, side: str,
                        quantity: int, user_id: str) -> dict:
    db = get_supabase()
    progress = (
        db.schema("markets").from_("autonomy_progress")
        .select("paper_trades_done")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    ).data
    count = (progress or {}).get("paper_trades_done", 0) + 1
    db.schema("markets").from_("autonomy_progress").update({"paper_trades_done": count}) \
        .eq("user_id", user_id).execute()
    return {"order_id": f"paper-{tradingsymbol}-{quantity}", "phase": "paper"}


@router.post("/rules", status_code=201)
async def create_rule(body: CreateRuleRequest, auth: Auth):
    db = get_supabase()
    try:
        result = db.schema("markets").from_("execution_rules").insert({
            "user_id": auth.user_id,
            "name": body.name,
            "description": body.description,
            "asset_class": body.asset_class,
            "instrument_id": body.instrument_id,
            "signal_type": body.signal_type,
            "order_type": body.order_type,
            "product": body.product,
            "max_order_value": body.max_order_value,
            "algo_id": body.algo_id,
        }).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    rows = result.data or []
    if not rows:
        raise HTTPException(500, detail="Insert returned no data")
    return rows[0]


@router.get("/rules")
async def list_rules(auth: Auth):
    db = get_supabase()
    result = (
        db.schema("markets").from_("execution_rules")
        .select("id, name, description, asset_class, signal_type, order_type, product, max_order_value, algo_id, is_active, created_at")
        .eq("user_id", auth.user_id)
        .eq("is_active", True)
        .order("created_at", desc=False)
        .execute()
    )
    return {"rules": result.data or []}


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: str, auth: Auth):
    db = get_supabase()
    db.schema("markets").from_("execution_rules") \
        .update({"is_active": False}) \
        .eq("id", rule_id).eq("user_id", auth.user_id).execute()


@router.get("/progress")
async def get_autonomy_progress(auth: Auth):
    db = get_supabase()
    return _get_progress(db, auth.user_id)


@router.get("/audit")
async def get_audit_log(auth: Auth, limit: int = 50):
    db = get_supabase()
    result = (
        db.schema("markets").from_("execution_audit_log")
        .select("id, tradingsymbol, exchange, side, quantity, order_value, phase, status, rejection_reason, created_at")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"entries": result.data or []}


@router.post("/orders")
async def submit_order(body: PlaceOrderRequest, auth: Auth):
    db = get_supabase()

    progress = _get_progress(db, auth.user_id)
    if progress["kill_switch_level"] in ("all_pause", "flatten_positions", "revoke_api_key"):
        ks_level = progress["kill_switch_level"]
        # Log the rejection to audit trail before raising
        try:
            db.schema("markets").from_("execution_audit_log").insert({
                "user_id": auth.user_id,
                "rule_id": body.rule_id,
                "signal_id": body.signal_id,
                "tradingsymbol": body.tradingsymbol,
                "exchange": body.exchange,
                "side": body.side,
                "order_type": "MARKET",
                "quantity": body.quantity,
                "order_value": body.order_value,
                "portfolio_nav_at_order": body.portfolio_nav,
                "phase": progress["current_phase"],
                "pre_trade_checks": {},
                "status": "rejected",
                "rejection_reason": f"kill_switch active: {ks_level}",
                "kill_switch_active": True,
            }).execute()
        except Exception as exc:
            logger.error("kill_switch_audit_failed", error=str(exc))
        raise HTTPException(409, detail=f"kill_switch active: {ks_level}")

    symbol_key = f"{body.tradingsymbol}:{body.exchange}"
    checks = run_all_checks(
        symbol_key=symbol_key,
        ltp_cache=_ltp_cache,
        order_value=body.order_value,
        portfolio_nav=body.portfolio_nav,
        side=body.side,
    )
    passed, reason = all_passed(checks)
    if not passed:
        _log_audit(db, auth.user_id, body, progress["current_phase"], checks,
                   "rejected", rejection_reason=reason)
        raise HTTPException(422, detail=reason)

    phase = progress["current_phase"]

    if phase == "paper":
        result = _submit_paper_order(body.tradingsymbol, body.exchange, body.side,
                                     body.quantity, auth.user_id)
        _log_audit(db, auth.user_id, body, "paper", checks, "paper",
                   broker_order_id=result.get("order_id"))
        return {"phase": "paper", "order_id": result["order_id"], "status": "simulated"}

    if phase == "micro" and body.order_value > body.portfolio_nav * 0.02:
        reason = f"Micro-Live cap: order_value {body.order_value} exceeds 2% of NAV {body.portfolio_nav}"
        _log_audit(db, auth.user_id, body, phase, checks, "rejected", rejection_reason=reason)
        raise HTTPException(422, detail=reason)

    if phase == "pilot" and body.order_value > body.portfolio_nav * 0.25:
        reason = f"Pilot cap: order_value {body.order_value} exceeds 25% of NAV {body.portfolio_nav}"
        _log_audit(db, auth.user_id, body, phase, checks, "rejected", rejection_reason=reason)
        raise HTTPException(422, detail=reason)

    _log_audit(db, auth.user_id, body, phase, checks, "submitted")
    return {"phase": phase, "status": "submitted", "message": "Order queued for broker submission"}
