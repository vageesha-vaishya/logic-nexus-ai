"""markets-data MCP server — read-only access to instruments, prices, holdings, news.

Exposed via FastMCP over HTTP/SSE, mountable in the FastAPI app.
Claude Agent SDK connects to this server to ground research thread analysis
in live portfolio and market data.

Tools exposed:
  get_portfolio       — portfolio metadata + summary stats
  get_holdings        — full holdings list with current prices + P&L
  get_price_history   — OHLCV candles for an instrument
  search_instruments  — symbol/name search across NSE, BSE, AMFI, MCX
  get_news            — recent news events for given symbols
  get_signals         — active signals for a portfolio or instrument
"""

from datetime import date, timedelta
from typing import Any

import structlog
from mcp.server.fastmcp import FastMCP

from markets_worker.db import fetch_many, fetch_one

logger = structlog.get_logger()

mcp = FastMCP(
    name="markets-data",
    instructions=(
        "You have read-only access to the Logic Nexus AI markets database. "
        "Use these tools to ground your analysis in live data — "
        "never hallucinate prices, quantities, or news events."
    ),
)


# ── Tools ─────────────────────────────────────────────────────────────────────

@mcp.tool(description="Get portfolio metadata and summary statistics.")
async def get_portfolio(portfolio_id: str) -> dict[str, Any]:
    portfolio = await fetch_one(
        "portfolios",
        schema="markets",
        id=portfolio_id,
    )
    if not portfolio:
        return {"error": f"Portfolio {portfolio_id} not found"}

    snapshots = await fetch_many(
        "portfolio_snapshots",
        schema="markets",
        select="snapshot_date,total_nav,invested_value,unrealized_pnl,day_change_pct",
        limit=1,
        order_col="snapshot_date",
        portfolio_id=portfolio_id,
    )

    return {
        "portfolio": {
            "id":            portfolio["id"],
            "name":          portfolio["name"],
            "mode":          portfolio["mode"],
            "base_currency": portfolio["base_currency"],
            "holder_type":   portfolio["holder_type"],
        },
        "latest_snapshot": snapshots[0] if snapshots else None,
    }


@mcp.tool(description="Get current holdings for a portfolio including quantity, avg cost, current price, and unrealised P&L.")
async def get_holdings(portfolio_id: str) -> list[dict[str, Any]]:
    holdings = await fetch_many(
        "holdings",
        schema="markets",
        select=(
            "id, instrument_id, qty, avg_cost, asset_class, folio_number, "
            "instruments(symbol, exchange, instrument_type, isin, metadata)"
        ),
        limit=500,
        order_col="qty",
        portfolio_id=portfolio_id,
    )

    # Enrich with latest price
    result = []
    for h in holdings:
        instr = h.get("instruments") or {}
        prices = await fetch_many(
            "price_history",
            schema="markets",
            select="close,ts",
            limit=1,
            order_col="ts",
            instrument_id=h["instrument_id"],
        )
        latest_price = prices[0]["close"] if prices else None
        avg_cost = float(h["avg_cost"] or 0)
        qty = float(h["qty"] or 0)
        current_value = float(latest_price or 0) * qty
        invested_value = avg_cost * qty
        unrealised_pnl = current_value - invested_value
        unrealised_pct = (unrealised_pnl / invested_value * 100) if invested_value else None

        result.append({
            "instrument_id":    h["instrument_id"],
            "symbol":           instr.get("symbol"),
            "exchange":         instr.get("exchange"),
            "instrument_type":  instr.get("instrument_type"),
            "isin":             instr.get("isin"),
            "asset_class":      h.get("asset_class"),
            "qty":              qty,
            "avg_cost":         avg_cost,
            "latest_price":     float(latest_price) if latest_price else None,
            "invested_value":   round(invested_value, 2),
            "current_value":    round(current_value, 2),
            "unrealised_pnl":   round(unrealised_pnl, 2),
            "unrealised_pct":   round(unrealised_pct, 2) if unrealised_pct is not None else None,
            "folio_number":     h.get("folio_number"),
        })

    return result


@mcp.tool(description="Get OHLCV price history for an instrument. days defaults to 30, max 365.")
async def get_price_history(
    instrument_id: str,
    days: int = 30,
) -> list[dict[str, Any]]:
    days = min(max(days, 1), 365)
    since = (date.today() - timedelta(days=days)).isoformat()

    db_rows = await fetch_many(
        "price_history",
        schema="markets",
        select="ts,open,high,low,close,volume",
        limit=days + 5,
        order_col="ts",
        instrument_id=instrument_id,
    )

    return [
        {
            "date":   r["ts"][:10] if r.get("ts") else None,
            "open":   r.get("open"),
            "high":   r.get("high"),
            "low":    r.get("low"),
            "close":  r.get("close"),
            "volume": r.get("volume"),
        }
        for r in db_rows
        if r.get("ts", "") >= since
    ]


@mcp.tool(description="Search instruments by symbol or name across NSE, BSE, AMFI, MCX. Returns up to 20 matches.")
async def search_instruments(query: str, exchange: str | None = None) -> list[dict[str, Any]]:
    db = __import__("markets_worker.db", fromlist=["get_supabase"]).get_supabase()

    q = (
        db.schema("markets")
        .from_("instruments")
        .select("id, symbol, exchange, instrument_type, asset_class, isin, metadata")
        .or_(f"symbol.ilike.%{query}%,metadata->>name.ilike.%{query}%")
        .eq("is_active", True)
        .limit(20)
    )
    if exchange:
        q = q.eq("exchange", exchange.upper())

    result = q.execute()
    return result.data or []


@mcp.tool(description="Get recent news events for given instrument symbols (comma-separated). Returns up to 20 items from the last 7 days.")
async def get_news(symbols: str, days: int = 7) -> list[dict[str, Any]]:
    since = (date.today() - timedelta(days=min(days, 30))).isoformat()
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    db = __import__("markets_worker.db", fromlist=["get_supabase"]).get_supabase()

    result = (
        db.schema("markets")
        .from_("news_events")
        .select("id,ts,source,title,sentiment_score,raw_url,instruments")
        .gte("ts", since)
        .overlaps("instruments", symbol_list)
        .order("ts", desc=True)
        .limit(20)
        .execute()
    )
    return result.data or []


@mcp.tool(description="Get active signals for a portfolio or instrument. Pass either portfolio_id or instrument_id.")
async def get_signals(
    portfolio_id: str | None = None,
    instrument_id: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    if not portfolio_id and not instrument_id:
        return [{"error": "Provide portfolio_id or instrument_id"}]

    db = __import__("markets_worker.db", fromlist=["get_supabase"]).get_supabase()

    q = (
        db.schema("markets")
        .from_("signals")
        .select("id,ts,instrument_id,signal_type,direction,confidence,score,rationale,generated_by,expires_at")
        .order("ts", desc=True)
        .limit(min(limit, 50))
    )
    if portfolio_id:
        q = q.eq("portfolio_id", portfolio_id)
    if instrument_id:
        q = q.eq("instrument_id", instrument_id)

    result = q.execute()
    return result.data or []
