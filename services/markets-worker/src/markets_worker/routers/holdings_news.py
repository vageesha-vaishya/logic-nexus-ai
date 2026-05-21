"""Holdings-aware market commentary — Phase 1 Addendum T20.

GET /v1/retail/holdings-news

Returns the last-24h headlines for the user's top-3 holdings (ranked by
current market value). Designed as the *ingestion + display* slice — the
addendum spec also calls for an LLM summarization layer on each headline
bundle (`holdings_news_summaries` table, Haiku model, SEBI-vetted prompt),
which depends on LLM API keys being provisioned for the worker; that lands
in a follow-up once keys are unblocked.

The data source is `markets.news_events`, already populated by the
existing news pipeline. We just read from it here.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail", tags=["retail"])


# ── Constants ────────────────────────────────────────────────────────────────

_TOP_HOLDINGS    = 3       # number of largest positions to surface news for
_HEADLINES_LIMIT = 5       # per-symbol headline cap
_LOOKBACK_HOURS  = 24      # news freshness window


# ── Holdings aggregation (mirrors stress_test pattern) ───────────────────────

async def _fetch_top_holdings(db: Any, user_id: str, limit: int) -> list[dict]:
    """
    Aggregate user's holdings across portfolios by symbol, attach latest
    price, and return the top `limit` ranked by current market value.
    """
    def _q_portfolios() -> list[dict]:
        return (
            db.schema("markets")
            .from_("portfolios")
            .select("id")
            .eq("owner_user_id", user_id)
            .execute()
        ).data or []

    portfolios = await asyncio.to_thread(_q_portfolios)
    portfolio_ids = [p["id"] for p in portfolios if p.get("id")]
    if not portfolio_ids:
        return []

    def _q_holdings(pid: str) -> list[dict]:
        return (
            db.schema("markets")
            .from_("holdings")
            .select("instrument_id, qty, instruments(symbol)")
            .eq("portfolio_id", pid)
            .gt("qty", 0)
            .execute()
        ).data or []

    holdings_lists = await asyncio.gather(*[
        asyncio.to_thread(_q_holdings, pid) for pid in portfolio_ids
    ])

    agg: dict[str, dict[str, Any]] = {}
    for rows in holdings_lists:
        for row in rows:
            iid = row.get("instrument_id") or ""
            if not iid:
                continue
            instr = row.get("instruments") or {}
            symbol = (instr.get("symbol") or iid).upper()
            qty = float(row.get("qty") or 0)
            if qty <= 0:
                continue
            slot = agg.setdefault(iid, {"symbol": symbol, "qty": 0.0})
            slot["qty"] += qty

    if not agg:
        return []

    def _q_last_price(iid: str) -> float | None:
        try:
            r = (
                db.schema("markets")
                .from_("price_history")
                .select("close")
                .eq("instrument_id", iid)
                .order("ts", desc=True)
                .limit(1)
                .maybe_single()
                .execute()
            )
            return float(r.data["close"]) if r.data else None
        except Exception:
            return None

    prices = await asyncio.gather(*[
        asyncio.to_thread(_q_last_price, iid) for iid in agg
    ])

    enriched: list[dict] = []
    for (iid, slot), price in zip(agg.items(), prices):
        if price is None or price <= 0:
            continue
        enriched.append({
            "symbol":     slot["symbol"],
            "qty":        slot["qty"],
            "last_price": price,
            "value":      slot["qty"] * price,
        })

    # Largest market value first
    enriched.sort(key=lambda h: h["value"], reverse=True)
    return enriched[:limit]


# ── News query ───────────────────────────────────────────────────────────────

async def _fetch_news_for_symbols(
    db: Any, symbols: list[str], since_iso: str, per_symbol_limit: int,
) -> dict[str, list[dict]]:
    """
    Returns a {symbol -> [news_event, ...]} map. One query covers all symbols
    via `overlaps`; we bucket client-side so the per-symbol cap is enforceable.
    """
    if not symbols:
        return {}

    def _q() -> list[dict]:
        return (
            db.schema("markets")
            .from_("news_events")
            .select("id, ts, source, title, sentiment_score, raw_url, instruments")
            .gte("ts", since_iso)
            .overlaps("instruments", symbols)
            .order("ts", desc=True)
            # Pull enough to fill per-symbol caps even if one symbol dominates.
            .limit(per_symbol_limit * len(symbols) * 3)
            .execute()
        ).data or []

    rows = await asyncio.to_thread(_q)

    buckets: dict[str, list[dict]] = {s: [] for s in symbols}
    for row in rows:
        tagged = [s.upper() for s in (row.get("instruments") or [])]
        for sym in symbols:
            if sym in tagged and len(buckets[sym]) < per_symbol_limit:
                buckets[sym].append({
                    "id":              row.get("id"),
                    "ts":              row.get("ts"),
                    "source":          row.get("source"),
                    "title":           row.get("title"),
                    "sentiment_score": row.get("sentiment_score"),
                    "raw_url":         row.get("raw_url"),
                })
    return buckets


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/holdings-news")
async def get_holdings_news(auth: Auth) -> dict[str, Any]:
    """
    Surface last-24h headlines for the user's top-3 holdings.

    Response shape:
        {
          "as_of": "2026-05-21T10:30:00+00:00",
          "lookback_hours": 24,
          "holdings": [
            {
              "symbol": "RELIANCE",
              "value": 250000.0,
              "news": [{"id": "...", "ts": "...", "title": "...", ...}, ...]
            },
            ...
          ]
        }
    """
    if not auth.user_id and not auth.is_service_account:
        raise HTTPException(401, detail="User authentication required")

    db = get_supabase()
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=_LOOKBACK_HOURS)

    top = await _fetch_top_holdings(db, auth.user_id, _TOP_HOLDINGS)
    symbols = [h["symbol"] for h in top]

    news_by_symbol = await _fetch_news_for_symbols(
        db, symbols, since.isoformat(), _HEADLINES_LIMIT,
    )

    holdings_out = [
        {
            "symbol":     h["symbol"],
            "value":      round(h["value"], 2),
            "news":       news_by_symbol.get(h["symbol"], []),
        }
        for h in top
    ]

    logger.info(
        "holdings_news.served",
        user_id=auth.user_id,
        symbols=symbols,
        headlines_total=sum(len(h["news"]) for h in holdings_out),
    )

    return {
        "as_of":          now.isoformat(),
        "lookback_hours": _LOOKBACK_HOURS,
        "holdings":       holdings_out,
    }
