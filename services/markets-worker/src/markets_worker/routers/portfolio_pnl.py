"""Portfolio P&L history + AI Advisor endpoints.

GET  /v1/portfolio/pnl/{portfolio_id}?lookback=365
    Replays transactions chronologically against price history to produce a daily
    NAV / invested / P&L time-series without requiring a snapshots table.

POST /v1/portfolio/advisor/{portfolio_id}
    Generate a Claude-powered AI brief covering portfolio health, risks,
    opportunities and suggested actions. Cached in markets.ai_briefs with
    scope="portfolio_advisor".

GET  /v1/portfolio/attribution/{portfolio_id}?lookback=365
    Compute position-level performance attribution: sector grouping, top/bottom
    contributors, and monthly cash-flow series.
"""
from __future__ import annotations

import asyncio
import math
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor as _TPE
from datetime import date, datetime, timedelta, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.llm_gateway import invoke as llm_invoke

# ── yfinance price helpers (used by attribution endpoint) ─────────────────────

_pnl_executor = _TPE(max_workers=8)


def _fetch_yf_price(symbol: str) -> float | None:
    try:
        import yfinance as yf
        suffix = ".NS"
        fi = yf.Ticker(f"{symbol}{suffix}").fast_info
        v = fi.last_price
        if v is None:
            return None
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else round(f, 2)
    except Exception:
        return None


async def _get_price_async(symbol: str) -> float | None:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_pnl_executor, _fetch_yf_price, symbol)

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/portfolio")

# ── Sector map (mirrors frontend nse-sectors.ts) ──────────────────────────────

_NSE_SECTOR_MAP: dict[str, str] = {
    # Financial Services
    "HDFCBANK": "Financial Services", "ICICIBANK": "Financial Services",
    "KOTAKBANK": "Financial Services", "SBIN": "Financial Services",
    "AXISBANK": "Financial Services", "BAJFINANCE": "Financial Services",
    "BAJAJFINSV": "Financial Services", "HDFCLIFE": "Financial Services",
    "SBILIFE": "Financial Services", "ICICIGI": "Financial Services",
    "SHRIRAMFIN": "Financial Services", "CHOLAFIN": "Financial Services",
    # IT
    "TCS": "Information Technology", "INFY": "Information Technology",
    "WIPRO": "Information Technology", "HCLTECH": "Information Technology",
    "TECHM": "Information Technology", "LTIM": "Information Technology",
    "MPHASIS": "Information Technology", "COFORGE": "Information Technology",
    "PERSISTENT": "Information Technology",
    # Energy
    "RELIANCE": "Energy", "ONGC": "Energy", "NTPC": "Energy",
    "POWERGRID": "Energy", "BPCL": "Energy", "IOC": "Energy",
    "GAIL": "Energy", "TATAPOWER": "Energy", "ADANIGREEN": "Energy",
    "ADANIPORTS": "Energy",
    # Consumer Staples
    "ITC": "Consumer Staples", "HINDUNILVR": "Consumer Staples",
    "NESTLEIND": "Consumer Staples", "BRITANNIA": "Consumer Staples",
    "DABUR": "Consumer Staples", "MARICO": "Consumer Staples",
    # Automobile
    "MARUTI": "Automobile", "MM": "Automobile", "TATAMOTORS": "Automobile",
    "BAJAJ_AUTO": "Automobile", "HEROMOTOCO": "Automobile",
    "EICHERMOT": "Automobile", "ASHOKLEY": "Automobile",
    # Healthcare
    "SUNPHARMA": "Healthcare", "DRREDDY": "Healthcare", "CIPLA": "Healthcare",
    "APOLLOHOSP": "Healthcare", "DIVISLAB": "Healthcare",
    "AUROPHARMA": "Healthcare", "TORNTPHARM": "Healthcare",
    # Metals & Mining
    "TATASTEEL": "Metals & Mining", "JSWSTEEL": "Metals & Mining",
    "HINDALCO": "Metals & Mining", "VEDL": "Metals & Mining",
    "COALINDIA": "Metals & Mining", "NMDC": "Metals & Mining",
    # Telecom
    "BHARTIARTL": "Telecom", "IDEA": "Telecom",
    # Cement
    "ULTRACEMCO": "Cement", "SHREECEM": "Cement",
    "AMBUJACEM": "Cement", "ACC": "Cement",
    # Consumer Discretionary
    "TITAN": "Consumer Discretionary", "ASIANPAINT": "Consumer Discretionary",
    "PIDILITIND": "Consumer Discretionary", "DMART": "Consumer Discretionary",
    "TRENT": "Consumer Discretionary", "HAVELLS": "Consumer Discretionary",
    # Capital Goods
    "LT": "Capital Goods", "SIEMENS": "Capital Goods",
    "ABB": "Capital Goods", "BHEL": "Capital Goods",
    # Consumer Internet
    "ZOMATO": "Consumer Internet", "NYKAA": "Consumer Internet",
    "POLICYBZR": "Consumer Internet",
}


def _get_sector(symbol: str) -> str:
    return _NSE_SECTOR_MAP.get((symbol or "").upper(), "Other")

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


# ─────────────────────────────────────────────────────────────────────────────
# AI Portfolio Advisor
# ─────────────────────────────────────────────────────────────────────────────

def _build_advisor_prompt(
    portfolio_name: str,
    holdings: list[dict],
    pnl_summary: dict,
    signals: list[dict],
    sector_weights: dict[str, float],
) -> str:
    holdings_text = "\n".join([
        f"- {h.get('symbol', h.get('instrument_id', '?'))}: "
        f"{h.get('qty', 0)} shares @ avg ₹{float(h.get('avg_cost', 0)):.2f}, "
        f"current ₹{h.get('last_price', h.get('latest_price', 'N/A'))}, "
        f"P&L: ₹{float(h.get('unrealized_pnl', h.get('unrealised_pnl', 0))):+,.0f} "
        f"({float(h.get('pnl_pct', h.get('unrealised_pct', 0) or 0)):+.1f}%)"
        for h in holdings[:20]
    ]) or "No holdings data available."

    sector_text = "\n".join([
        f"- {sector}: {pct:.1f}%"
        for sector, pct in sorted(sector_weights.items(), key=lambda x: -x[1])[:8]
    ]) or "No sector data."

    signal_text = "\n".join([
        f"- {s.get('symbol', '?')}: {(s.get('direction') or 'neutral').upper()} signal "
        f"(confidence {float(s.get('confidence', 0)):.0%}) — {s.get('rationale', 'N/A')}"
        for s in signals[:10]
    ]) or "No active signals for held stocks."

    return f"""You are an expert Indian equity market advisor. Analyse this portfolio and provide a concise, actionable brief.

PORTFOLIO: {portfolio_name}
PERIOD: Last 30 days

HOLDINGS:
{holdings_text}

P&L SUMMARY:
- Total Invested: ₹{pnl_summary.get('total_invested', 0):,.0f}
- Current NAV: ₹{pnl_summary.get('current_nav', 0):,.0f}
- Total P&L: ₹{pnl_summary.get('total_pnl', 0):+,.0f} ({pnl_summary.get('pnl_pct', 0):+.1f}%)
- Realized P&L: ₹{pnl_summary.get('realized_pnl', 0):+,.0f}

SECTOR ALLOCATION:
{sector_text}

TECHNICAL SIGNALS (for held stocks):
{signal_text}

Provide a structured brief with these exact sections (use markdown headers):

## Portfolio Health
[2-3 sentences on overall health, diversification, concentration risk]

## Top Risks
[3 bullet points: specific risks for this portfolio today]

## Opportunities
[3 bullet points: specific opportunities based on signals and market context]

## Suggested Actions
[3 concrete, actionable steps with specific stock names where relevant]

## Sector Outlook
[1 sentence each on the top 3 sectors in this portfolio vs current market conditions]

Keep language professional but accessible. Focus on Indian market context. Be specific, not generic."""


async def _fetch_advisor_holdings(db: Any, portfolio_id: str) -> list[dict]:
    """Fetch holdings enriched with latest price from LTP cache."""
    import asyncio

    def _query():
        return (
            db.schema("markets")
            .from_("holdings")
            .select(
                "instrument_id, qty, avg_cost, "
                "instruments(symbol, exchange)"
            )
            .eq("portfolio_id", portfolio_id)
            .gt("qty", 0)
            .limit(50)
            .execute()
        ).data or []

    rows = await asyncio.to_thread(_query)

    def _get_ltp(instrument_id: str) -> float | None:
        try:
            result = (
                db.schema("markets")
                .from_("price_history")
                .select("close")
                .eq("instrument_id", instrument_id)
                .order("ts", desc=True)
                .limit(1)
                .maybe_single()
                .execute()
            )
            return float(result.data["close"]) if result.data else None
        except Exception:
            return None

    holdings_out = []
    for row in rows:
        instr = row.get("instruments") or {}
        symbol = instr.get("symbol") or row.get("instrument_id", "")
        qty = float(row.get("qty") or 0)
        avg_cost = float(row.get("avg_cost") or 0)
        last_price = await asyncio.to_thread(_get_ltp, row["instrument_id"])
        unrealized_pnl = (last_price - avg_cost) * qty if last_price else 0.0
        pnl_pct = ((last_price - avg_cost) / avg_cost * 100) if (last_price and avg_cost) else 0.0
        holdings_out.append({
            "instrument_id": row["instrument_id"],
            "symbol":        symbol,
            "exchange":      instr.get("exchange"),
            "qty":           qty,
            "avg_cost":      avg_cost,
            "last_price":    last_price,
            "unrealized_pnl": round(unrealized_pnl, 2),
            "pnl_pct":       round(pnl_pct, 2),
        })

    return holdings_out


async def _fetch_advisor_signals(db: Any, instrument_ids: list[str]) -> list[dict]:
    """Fetch latest active signals for the held instruments."""
    import asyncio

    if not instrument_ids:
        return []

    def _query():
        return (
            db.schema("markets")
            .from_("signals")
            .select(
                "instrument_id, direction, confidence, rationale, "
                "instruments(symbol)"
            )
            .in_("instrument_id", instrument_ids[:30])
            .order("ts", desc=True)
            .limit(30)
            .execute()
        ).data or []

    rows = await asyncio.to_thread(_query)
    seen: set[str] = set()
    out: list[dict] = []
    for row in rows:
        iid = row.get("instrument_id", "")
        if iid in seen:
            continue
        seen.add(iid)
        instr = row.get("instruments") or {}
        out.append({
            "symbol":     instr.get("symbol") or iid,
            "direction":  row.get("direction") or "neutral",
            "confidence": float(row.get("confidence") or 0),
            "rationale":  row.get("rationale") or "",
        })
    return out


async def _fetch_cached_brief(db: Any, portfolio_id: str) -> dict | None:
    """Return an existing brief generated within the last 30 min, if any."""
    import asyncio

    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()

    def _query():
        return (
            db.schema("markets")
            .from_("ai_briefs")
            .select("id, content, generated_at, portfolio_id")
            .eq("portfolio_id", portfolio_id)
            .eq("scope", "portfolio_advisor")
            .gte("generated_at", cutoff)
            .order("generated_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        ).data

    try:
        return await asyncio.to_thread(_query)
    except Exception:
        return None


async def _store_brief(
    db: Any,
    *,
    portfolio_id: str,
    content: str,
    owner_user_id: str | None,
    tenant_id: str | None,
) -> str:
    """Upsert brief into markets.ai_briefs. Returns brief_id."""
    import asyncio

    brief_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    def _insert():
        return (
            db.schema("markets")
            .from_("ai_briefs")
            .insert({
                "id":            brief_id,
                "portfolio_id":  portfolio_id,
                "scope":         "portfolio_advisor",
                "content":       content,
                "generated_at":  now_iso,
                "owner_user_id": owner_user_id,
                "tenant_id":     tenant_id,
            })
            .execute()
        )

    try:
        await asyncio.to_thread(_insert)
    except Exception as exc:
        logger.warning("advisor.brief_store_failed", error=str(exc))

    return brief_id


@router.post("/advisor/{portfolio_id}")
async def generate_portfolio_advisor(portfolio_id: str, auth: Auth) -> dict[str, Any]:
    """
    POST /v1/portfolio/advisor/{portfolio_id}

    Generate a Claude-powered AI Portfolio Advisor brief. Results are cached for
    30 minutes per portfolio to avoid unnecessary LLM calls.
    """
    import asyncio

    user_id = auth.user_id or auth.service_account_id
    if not user_id and not auth.is_service_account:
        raise HTTPException(401, detail="Authentication required")

    db = get_supabase()

    # 1. Verify portfolio ownership + fetch name
    def _fetch_portfolio():
        return (
            db.schema("markets")
            .from_("portfolios")
            .select("id, name, owner_user_id")
            .eq("id", portfolio_id)
            .maybe_single()
            .execute()
        ).data

    portfolio = await asyncio.to_thread(_fetch_portfolio)
    if not portfolio:
        raise HTTPException(404, detail="Portfolio not found")
    if auth.user_id and portfolio.get("owner_user_id") != auth.user_id:
        raise HTTPException(403, detail="Access denied")

    portfolio_name: str = portfolio.get("name") or "My Portfolio"

    # 2. Check for a recent cached brief (30-minute TTL)
    cached = await _fetch_cached_brief(db, portfolio_id)
    if cached:
        return {
            "brief_id":     cached["id"],
            "content":      cached["content"],
            "generated_at": cached["generated_at"],
            "portfolio_id": portfolio_id,
            "cached":       True,
        }

    # 3. Fetch holdings (with latest prices)
    holdings = await _fetch_advisor_holdings(db, portfolio_id)

    # 4. Fetch 30-day P&L summary by reusing the existing transaction-replay logic
    pnl_summary: dict[str, Any] = {
        "total_invested": 0.0,
        "current_nav":    0.0,
        "total_pnl":      0.0,
        "pnl_pct":        0.0,
        "realized_pnl":   0.0,
    }
    try:
        # Inline a lightweight version: sum holdings for a quick snapshot
        total_invested = sum(h["qty"] * h["avg_cost"] for h in holdings)
        current_nav = sum(
            h["qty"] * (h["last_price"] if h["last_price"] else h["avg_cost"])
            for h in holdings
        )
        total_pnl = current_nav - total_invested
        pnl_pct = (total_pnl / total_invested * 100) if total_invested else 0.0
        pnl_summary = {
            "total_invested": round(total_invested, 2),
            "current_nav":    round(current_nav, 2),
            "total_pnl":      round(total_pnl, 2),
            "pnl_pct":        round(pnl_pct, 2),
            "realized_pnl":   0.0,  # omitted for speed; full replay not needed here
        }
    except Exception as exc:
        logger.warning("advisor.pnl_summary_failed", error=str(exc))

    # 5. Fetch signals for held instruments
    instrument_ids = [h["instrument_id"] for h in holdings if h.get("instrument_id")]
    signals = await _fetch_advisor_signals(db, instrument_ids)

    # 6. Compute sector allocation
    sector_weights: dict[str, float] = {}
    total_nav_for_sector = pnl_summary.get("current_nav") or 1.0
    for h in holdings:
        sector = _get_sector(h.get("symbol") or "")
        val = h["qty"] * (h["last_price"] if h["last_price"] else h["avg_cost"])
        sector_weights[sector] = sector_weights.get(sector, 0.0) + val
    if total_nav_for_sector > 0:
        sector_weights = {
            k: round(v / total_nav_for_sector * 100, 1)
            for k, v in sector_weights.items()
        }

    # 7. Build prompt and call Claude
    prompt = _build_advisor_prompt(
        portfolio_name=portfolio_name,
        holdings=holdings,
        pnl_summary=pnl_summary,
        signals=signals,
        sector_weights=sector_weights,
    )

    content: str
    try:
        result = await llm_invoke(
            task_id="markets.portfolio_advisor",
            variables={},
            tenant_id=auth.tenant_id,
            franchise_id=auth.franchise_id,
            user_id=user_id,
            system_override="You are an expert Indian equity market advisor. Respond only with the structured Markdown brief requested.",
            user_override=prompt,
            model_override="claude-haiku-4-5",  # fast + cheap for briefs
        )
        content = result.content
        logger.info(
            "advisor.generated",
            portfolio_id=portfolio_id,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_usd=round(result.cost_usd, 6),
        )
    except Exception as exc:
        logger.error("advisor.llm_failed", portfolio_id=portfolio_id, error=str(exc))
        # Graceful fallback — don't 500
        content = (
            "## Portfolio Health\n"
            "Unable to generate AI analysis at this time. Please try again shortly.\n\n"
            "## Top Risks\n"
            "- AI advisor temporarily unavailable\n\n"
            "## Opportunities\n"
            "- Please retry in a few minutes\n\n"
            "## Suggested Actions\n"
            "- Refresh the page and regenerate\n\n"
            "## Sector Outlook\n"
            "Analysis unavailable."
        )

    # 8. Store in markets.ai_briefs
    brief_id = await _store_brief(
        db,
        portfolio_id=portfolio_id,
        content=content,
        owner_user_id=user_id,
        tenant_id=auth.tenant_id,
    )

    return {
        "brief_id":     brief_id,
        "content":      content,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "portfolio_id": portfolio_id,
        "cached":       False,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Performance Attribution
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/attribution/{portfolio_id}")
async def get_portfolio_attribution(
    portfolio_id: str,
    auth: Auth,
    lookback: int = Query(365, ge=1, le=1825),
) -> dict[str, Any]:
    """
    GET /v1/portfolio/attribution/{portfolio_id}?lookback=365

    Compute position-level performance attribution broken down by sector,
    top/bottom contributors, and monthly cash-flow series.
    """
    user_id = auth.user_id or auth.service_account_id
    if not user_id and not auth.is_service_account:
        raise HTTPException(401, detail="Authentication required")

    db = get_supabase()
    now_utc = datetime.now(timezone.utc)
    as_of = now_utc.isoformat()

    # ── 1. Verify portfolio ownership ─────────────────────────────────────────
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

    # ── 2. Load current holdings (quantity > 0) ───────────────────────────────
    def _fetch_holdings() -> list[dict]:
        return (
            db.schema("markets")
            .from_("holdings")
            .select(
                "instrument_id, symbol, quantity, avg_cost"
            )
            .eq("portfolio_id", portfolio_id)
            .gt("quantity", 0)
            .execute()
        ).data or []

    # ── 3. Load transactions within lookback window ───────────────────────────
    cutoff_iso = (now_utc - timedelta(days=lookback)).isoformat()

    def _fetch_transactions() -> list[dict]:
        return (
            db.schema("markets")
            .from_("transactions")
            .select("instrument_id, symbol, txn_type, qty, price, created_at")
            .eq("portfolio_id", portfolio_id)
            .gt("created_at", cutoff_iso)
            .order("created_at", desc=False)
            .execute()
        ).data or []

    holdings_rows, txn_rows = await asyncio.gather(
        asyncio.to_thread(_fetch_holdings),
        asyncio.to_thread(_fetch_transactions),
    )

    if not holdings_rows:
        return {
            "portfolio_id": portfolio_id,
            "as_of": as_of,
            "lookback_days": lookback,
            "summary": {
                "total_invested": 0.0,
                "total_current_value": 0.0,
                "total_pnl": 0.0,
                "total_pnl_pct": 0.0,
                "position_count": 0,
            },
            "positions": [],
            "sectors": [],
            "top_contributors": [],
            "bottom_contributors": [],
            "monthly_flows": [],
        }

    # ── 4. Fetch current prices for each holding concurrently ─────────────────
    async def _resolve_price(holding: dict) -> float:
        """Try DB price_history first, fall back to yfinance, then avg_cost."""
        instrument_id: str | None = holding.get("instrument_id")
        symbol: str = (holding.get("symbol") or "").upper()
        avg_cost = float(holding.get("avg_cost") or 0)

        # (a) DB price_history
        if instrument_id:
            def _db_price() -> float | None:
                resp = (
                    db.schema("markets")
                    .from_("price_history")
                    .select("close")
                    .eq("instrument_id", instrument_id)
                    .order("date", desc=True)
                    .limit(1)
                    .execute()
                )
                if resp.data:
                    return float(resp.data[0]["close"])
                return None

            try:
                db_price = await asyncio.to_thread(_db_price)
                if db_price is not None:
                    return db_price
            except Exception:
                pass

        # (b) yfinance fallback
        if symbol:
            yf_price = await _get_price_async(symbol)
            if yf_price is not None:
                return yf_price

        # (c) last resort: avg_cost (zero P&L)
        return avg_cost

    price_tasks = [_resolve_price(h) for h in holdings_rows]
    resolved_prices: list[float] = await asyncio.gather(*price_tasks)

    # ── 5. Build position-level metrics ──────────────────────────────────────
    positions: list[dict] = []
    total_invested = 0.0
    total_current = 0.0

    for holding, current_price in zip(holdings_rows, resolved_prices):
        symbol = (holding.get("symbol") or "").upper()
        quantity = float(holding.get("quantity") or 0)
        avg_cost = float(holding.get("avg_cost") or 0)

        invested = quantity * avg_cost
        current_value = quantity * current_price
        pnl = current_value - invested
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0.0

        total_invested += invested
        total_current += current_value

        positions.append({
            "symbol":        symbol,
            "sector":        _get_sector(symbol),
            "quantity":      round(quantity, 4),
            "avg_cost":      round(avg_cost, 4),
            "current_price": round(current_price, 4),
            "invested":      round(invested, 4),
            "current_value": round(current_value, 4),
            "pnl":           round(pnl, 4),
            "pnl_pct":       round(pnl_pct, 4),
            # contribution_pct filled after total_invested is known
            "contribution_pct": 0.0,
        })

    # ── 6. Portfolio totals ───────────────────────────────────────────────────
    total_pnl = total_current - total_invested
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0.0

    # ── 7. Contribution % per position ───────────────────────────────────────
    for pos in positions:
        pos["contribution_pct"] = round(
            (pos["pnl"] / total_invested * 100) if total_invested > 0 else 0.0,
            4,
        )

    # Sort positions by contribution_pct descending
    positions.sort(key=lambda p: p["contribution_pct"], reverse=True)

    # ── 8. Sector grouping ────────────────────────────────────────────────────
    sector_buckets: dict[str, dict[str, float]] = defaultdict(
        lambda: {"invested": 0.0, "current_value": 0.0, "pnl": 0.0, "count": 0.0}
    )
    for pos in positions:
        s = pos["sector"]
        sector_buckets[s]["invested"] += pos["invested"]
        sector_buckets[s]["current_value"] += pos["current_value"]
        sector_buckets[s]["pnl"] += pos["pnl"]
        sector_buckets[s]["count"] += 1

    sectors: list[dict] = []
    for sector_name, bucket in sector_buckets.items():
        s_invested = bucket["invested"]
        s_pnl = bucket["pnl"]
        s_pnl_pct = (s_pnl / s_invested * 100) if s_invested > 0 else 0.0
        s_weight = (s_invested / total_invested * 100) if total_invested > 0 else 0.0
        s_contribution = (s_pnl / total_invested * 100) if total_invested > 0 else 0.0
        sectors.append({
            "sector":           sector_name,
            "invested":         round(s_invested, 4),
            "current_value":    round(bucket["current_value"], 4),
            "pnl":              round(s_pnl, 4),
            "pnl_pct":          round(s_pnl_pct, 4),
            "weight_pct":       round(s_weight, 4),
            "contribution_pct": round(s_contribution, 4),
            "position_count":   int(bucket["count"]),
        })
    sectors.sort(key=lambda s: s["weight_pct"], reverse=True)

    # ── 9. Monthly cash-flow series ───────────────────────────────────────────
    # Build a map: "YYYY-MM" -> {buy_amount, sell_amount}
    monthly: dict[str, dict[str, float]] = defaultdict(
        lambda: {"buy_amount": 0.0, "sell_amount": 0.0}
    )
    for txn in txn_rows:
        created_at = str(txn.get("created_at") or "")[:7]  # "YYYY-MM"
        if not created_at or len(created_at) < 7:
            continue
        txn_type = (txn.get("txn_type") or "").lower()
        qty = float(txn.get("qty") or 0)
        price = float(txn.get("price") or 0)
        amount = qty * price

        if txn_type in _BUY_TYPES:
            monthly[created_at]["buy_amount"] += amount
        elif txn_type in _SELL_TYPES:
            monthly[created_at]["sell_amount"] += amount

    monthly_flows: list[dict] = sorted(
        [
            {
                "month":       month_key,
                "buy_amount":  round(v["buy_amount"], 4),
                "sell_amount": round(v["sell_amount"], 4),
                "net_flow":    round(v["sell_amount"] - v["buy_amount"], 4),
            }
            for month_key, v in monthly.items()
        ],
        key=lambda x: x["month"],
    )

    # ── 10. Top / bottom contributors ─────────────────────────────────────────
    # positions already sorted by contribution_pct DESC
    top_contributors = positions[:5]
    bottom_contributors = list(reversed(positions[-5:])) if len(positions) >= 5 else list(reversed(positions))

    logger.info(
        "portfolio.attribution",
        portfolio_id=portfolio_id,
        lookback=lookback,
        position_count=len(positions),
        sector_count=len(sectors),
    )

    return {
        "portfolio_id":  portfolio_id,
        "as_of":         as_of,
        "lookback_days": lookback,
        "summary": {
            "total_invested":     round(total_invested, 4),
            "total_current_value": round(total_current, 4),
            "total_pnl":          round(total_pnl, 4),
            "total_pnl_pct":      round(total_pnl_pct, 4),
            "position_count":     len(positions),
        },
        "positions":          positions,
        "sectors":            sectors,
        "top_contributors":   top_contributors,
        "bottom_contributors": bottom_contributors,
        "monthly_flows":      monthly_flows,
    }
