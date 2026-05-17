"""
Mutual Fund endpoints.

GET  /v1/mf/funds                        — search/list funds from DB
GET  /v1/mf/funds/{scheme_code}          — fund detail + current NAV + returns
GET  /v1/mf/portfolio                    — user's MF holdings enriched with live NAV
POST /v1/mf/orders                       — place buy/redeem via broker
GET  /v1/mf/sips                         — user's active SIPs (holdings where sip_amount > 0)
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.brokers import build_adapter, decrypt_credentials
from markets_worker.db import get_supabase
from markets_worker.mf.mfapi_client import (
    compute_returns, get_nav_history, get_nav_latest, search_funds,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/mf")


# ── Models ────────────────────────────────────────────────────────────────────

class MfOrderRequest(BaseModel):
    connection_id: str           # broker_connection id
    amfi_code:     str           # scheme code (= instruments.symbol)
    isin:          str
    scheme_name:   str
    order_type:    str           # PURCHASE | REDEMPTION | SIP
    amount:        float | None = None   # for PURCHASE / SIP
    units:         float | None = None   # for REDEMPTION
    folio_number:  str | None = None
    # SIP-specific
    sip_amount:    float | None = None
    sip_date:      int   | None = None   # day of month 1-28
    portfolio_id:  str   | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/funds")
async def search_fund_list(
    q:        str  = Query("", description="Search query"),
    category: str  = Query("", description="mf_equity | mf_debt | mf_hybrid | mf_index"),
    limit:    int  = Query(30, le=100),
    offset:   int  = Query(0),
):
    """Search MF schemes from DB. Optionally enrich top results with live NAV."""
    db = get_supabase()

    query = (
        db.schema("markets").from_("instruments")
        .select("id, symbol, isin, instrument_type, metadata, asset_class")
        .order("symbol")
        .limit(limit)
        .offset(offset)
    )
    if category:
        query = query.eq("instrument_type", category)
    else:
        query = query.in_("instrument_type", ["mf_equity", "mf_debt", "mf_hybrid", "mf_index"])

    if q:
        # Search by scheme name in metadata JSONB
        query = query.ilike("metadata->>scheme_name", f"%{q}%")

    result = query.execute()
    funds = result.data or []

    # Enrich first page (offset=0) with live NAV for top 10 results
    if offset == 0 and funds:
        enriched = await asyncio.gather(
            *[_enrich_with_nav(f) for f in funds[:10]],
            return_exceptions=True,
        )
        for i, item in enumerate(enriched):
            if isinstance(item, dict):
                funds[i] = item

    return {"funds": funds, "total": len(funds)}


@router.get("/funds/{scheme_code}")
async def get_fund_detail(scheme_code: str):
    """Return fund metadata + current NAV + return history."""
    db = get_supabase()
    row = (
        db.schema("markets").from_("instruments")
        .select("id, symbol, isin, instrument_type, metadata")
        .eq("symbol", scheme_code)
        .maybe_single()
        .execute()
    ).data

    if not row:
        raise HTTPException(404, detail="Fund not found")

    try:
        hist = await get_nav_history(scheme_code)
        meta = hist.get("meta", {})
        nav_data = hist.get("data", [])
        current_nav = float(nav_data[0]["nav"]) if nav_data else None
        returns = compute_returns(nav_data)
    except Exception as exc:
        logger.warning("mf.nav_fetch_failed", scheme_code=scheme_code, error=str(exc))
        meta, current_nav, returns, nav_data = {}, None, {}, []

    return {
        "id":             row["id"],
        "amfi_code":      scheme_code,
        "isin":           row["isin"],
        "instrument_type": row["instrument_type"],
        "scheme_name":    (row.get("metadata") or {}).get("scheme_name", ""),
        "fund_house":     meta.get("fund_house"),
        "scheme_type":    meta.get("scheme_type"),
        "scheme_category": meta.get("scheme_category"),
        "current_nav":    current_nav,
        "nav_date":       nav_data[0]["date"] if nav_data else None,
        "returns":        returns,
        # Last 12 months of history for sparkline
        "nav_history":    nav_data[:252],
    }


@router.get("/portfolio")
async def get_mf_portfolio(auth: Auth):
    """Return user's MF holdings enriched with live NAV."""
    db = get_supabase()
    rows = (
        db.schema("markets").from_("holdings")
        .select(
            "id, qty, avg_cost, realized_pnl, folio_number, sip_amount, sip_date, "
            "last_updated_at, metadata, "
            "instrument:instrument_id(id, symbol, isin, instrument_type, metadata)"
        )
        .eq("owner_user_id", auth.user_id)
        .eq("asset_class", "mutual_fund")
        .execute()
    ).data or []

    # Enrich each holding with current NAV
    enriched = await asyncio.gather(
        *[_enrich_holding(h) for h in rows],
        return_exceptions=True,
    )
    holdings = [h for h in enriched if isinstance(h, dict)]

    # Portfolio summary
    total_invested = sum(float(h.get("invested_value") or 0) for h in holdings)
    total_current  = sum(float(h.get("current_value") or 0) for h in holdings)
    total_gain     = total_current - total_invested
    return_pct     = round(total_gain / total_invested * 100, 2) if total_invested > 0 else 0.0

    return {
        "holdings": holdings,
        "summary": {
            "total_invested": round(total_invested, 2),
            "total_current":  round(total_current, 2),
            "total_gain":     round(total_gain, 2),
            "return_pct":     return_pct,
            "fund_count":     len(holdings),
        },
    }


@router.get("/sips")
async def get_sips(auth: Auth):
    """Return user's active SIPs — holdings where sip_amount > 0."""
    db = get_supabase()
    rows = (
        db.schema("markets").from_("holdings")
        .select(
            "id, qty, avg_cost, folio_number, sip_amount, sip_date, last_updated_at, "
            "instrument:instrument_id(id, symbol, isin, instrument_type, metadata)"
        )
        .eq("owner_user_id", auth.user_id)
        .eq("asset_class", "mutual_fund")
        .gt("sip_amount", 0)
        .execute()
    ).data or []

    from datetime import date, timedelta
    today = date.today()

    def _next_sip(sip_day: int | None) -> str | None:
        if not sip_day:
            return None
        try:
            candidate = today.replace(day=sip_day)
            if candidate <= today:
                # Next month
                if today.month == 12:
                    candidate = candidate.replace(year=today.year + 1, month=1)
                else:
                    candidate = candidate.replace(month=today.month + 1)
            return candidate.isoformat()
        except ValueError:
            return None

    sips = []
    for h in rows:
        instr = h.get("instrument") or {}
        sips.append({
            "holding_id":   h["id"],
            "amfi_code":    instr.get("symbol"),
            "isin":         instr.get("isin"),
            "scheme_name":  (instr.get("metadata") or {}).get("scheme_name", ""),
            "folio_number": h.get("folio_number"),
            "sip_amount":   float(h.get("sip_amount") or 0),
            "sip_date":     h.get("sip_date"),
            "next_sip_date": _next_sip(h.get("sip_date")),
            "units_held":   float(h.get("qty") or 0),
        })

    return {"sips": sips}


@router.post("/orders", status_code=201)
async def place_mf_order(body: MfOrderRequest, auth: Auth):
    """Place an MF buy / redeem order via broker."""
    db = get_supabase()

    # Verify connection ownership + MF support
    conn = (
        db.schema("markets").from_("broker_connections")
        .select("id, broker, credentials_enc, tenant_id, franchise_id, portfolio_id, can_trade")
        .eq("id", body.connection_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not conn:
        raise HTTPException(404, detail="Connection not found")
    if not conn.get("can_trade"):
        raise HTTPException(403, detail="Trading not enabled for this connection")

    try:
        creds   = decrypt_credentials(conn["credentials_enc"])
        adapter = build_adapter(conn["broker"], creds)

        if not getattr(adapter, "supports_mf", False):
            raise HTTPException(400, detail=f"{conn['broker']} does not support MF orders via API")

        await adapter.connect()
        result = await adapter.place_mf_order({
            "isin":         body.isin,
            "amfi_code":    body.amfi_code,
            "scheme_name":  body.scheme_name,
            "order_type":   body.order_type,
            "amount":       body.amount,
            "units":        body.units,
            "folio_number": body.folio_number,
        })
        await adapter.disconnect()

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, detail=f"Broker error: {exc}") from exc

    if result.get("status") == "error":
        raise HTTPException(400, detail=result.get("message", "Order failed"))

    # If SIP, update holding record with sip_amount + sip_date
    if body.order_type == "SIP" and body.sip_amount and body.sip_date:
        _upsert_sip(db, body, auth)

    logger.info("mf.order_placed", broker=conn["broker"], amfi_code=body.amfi_code,
                order_type=body.order_type, user_id=auth.user_id)
    return {"order_id": result.get("order_id"), "status": "ok", "message": result.get("message")}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _enrich_with_nav(fund: dict) -> dict:
    """Add current_nav and 1y_return to a fund dict."""
    try:
        scheme_code = fund.get("symbol", "")
        if not scheme_code:
            return fund
        latest = await get_nav_latest(scheme_code)
        nav_rows = latest.get("data", [])
        if nav_rows:
            fund["current_nav"]  = float(nav_rows[0]["nav"])
            fund["nav_date"]     = nav_rows[0]["date"]
        meta = latest.get("meta", {})
        fund["fund_house"]     = meta.get("fund_house")
        fund["scheme_category"] = meta.get("scheme_category")
    except Exception:
        pass
    return fund


async def _enrich_holding(holding: dict) -> dict:
    """Enrich a holdings row with live NAV and computed values."""
    instr = holding.get("instrument") or {}
    scheme_code = instr.get("symbol", "")
    qty = float(holding.get("qty") or 0)
    avg_cost = float(holding.get("avg_cost") or 0)

    invested_value = qty * avg_cost
    current_nav = None
    current_value = None
    return_pct = None

    try:
        if scheme_code:
            latest = await get_nav_latest(scheme_code)
            nav_rows = latest.get("data", [])
            if nav_rows:
                current_nav = float(nav_rows[0]["nav"])
                current_value = qty * current_nav
                if invested_value > 0:
                    return_pct = round((current_value - invested_value) / invested_value * 100, 2)
    except Exception:
        pass

    return {
        **holding,
        "scheme_name":    (instr.get("metadata") or {}).get("scheme_name", ""),
        "amfi_code":      scheme_code,
        "invested_value": round(invested_value, 2),
        "current_nav":    current_nav,
        "current_value":  round(current_value, 2) if current_value is not None else None,
        "gain":           round(current_value - invested_value, 2) if current_value is not None else None,
        "return_pct":     return_pct,
    }


def _upsert_sip(db, body: MfOrderRequest, auth: Auth) -> None:
    """Update or insert a holding record with SIP details."""
    try:
        existing = (
            db.schema("markets").from_("holdings")
            .select("id")
            .eq("owner_user_id", auth.user_id)
            .eq("asset_class", "mutual_fund")
            .execute()
        ).data or []
        # Find by folio or amfi_code via instrument join — simple update if exists
        if existing:
            db.schema("markets").from_("holdings").update({
                "sip_amount": body.sip_amount,
                "sip_date":   body.sip_date,
            }).eq("id", existing[0]["id"]).execute()
    except Exception as exc:
        logger.warning("mf.sip_upsert_failed", error=str(exc))
