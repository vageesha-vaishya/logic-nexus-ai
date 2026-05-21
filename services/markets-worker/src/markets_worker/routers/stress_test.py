"""Stress-test endpoint — Phase 1 Addendum T18.

Apply historical drawdown returns from three real Indian-market scenarios to
the auth user's current holdings, returning a per-scenario portfolio impact
summary with worst-3 losers.

GET /v1/retail/stress-test

Output shape:
    {
      "as_of": "2026-05-21",
      "portfolio_value": 543210.0,
      "scenarios": [
        {
          "code": "COVID_2020",
          "label": "COVID crash (Mar 2020)",
          "window": "Feb 19 – Mar 23, 2020",
          "description": "...",
          "portfolio_value_post": 350720.0,
          "loss_inr": -192490.0,
          "loss_pct": -35.4,
          "top3_losers": [
            {"symbol": "ICICIBANK", "qty": 50, "value_pre": 80000, "value_post": 36000, "loss_inr": -44000, "loss_pct": -55.0},
            ...
          ]
        },
        ...
      ]
    }

Per-symbol returns are hard-coded in `SCENARIOS` below — see the design doc
note: "stress_test_scenarios table is static seed data — historical returns
per symbol per scenario, pre-loaded once. Recomputation per user is pure
SQL, no LLM. Cheap." We keep the seed in code for v1 (no migration churn);
move to a DB table when we want to update without redeploys.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail", tags=["retail"])


# ── Hard-coded scenario seed ─────────────────────────────────────────────────
#
# return_pct values are decimal fractions (-0.45 = 45% loss). Numbers are
# approximate from observed close-to-close drawdowns over the listed window.
# `__default__` is the broad-market return applied to any symbol not
# explicitly seeded — used for less-common holdings.

SCENARIOS: dict[str, dict[str, Any]] = {
    "COVID_2020": {
        "label":       "COVID crash (Mar 2020)",
        "window":      "Feb 19 – Mar 23, 2020",
        "description": "NIFTY 50 fell ~38% over five weeks as global markets priced in pandemic lockdowns.",
        "returns": {
            "__default__":   -0.38,
            # Banks / Financials — hit hardest on credit-risk fears
            "HDFCBANK":      -0.40,
            "ICICIBANK":     -0.55,
            "AXISBANK":      -0.60,
            "KOTAKBANK":     -0.42,
            "SBIN":          -0.50,
            "BAJFINANCE":    -0.58,
            "BAJAJFINSV":    -0.55,
            # IT — relatively defensive (weak rupee, USD revenue)
            "TCS":           -0.27,
            "INFY":          -0.30,
            "WIPRO":         -0.30,
            "HCLTECH":       -0.28,
            "TECHM":         -0.35,
            # FMCG — defensives held up
            "HINDUNILVR":    -0.18,
            "ITC":           -0.25,
            "NESTLEIND":     -0.10,
            "BRITANNIA":     -0.15,
            # Pharma — mildly positive on vaccine optimism, but earlier drawdown
            "SUNPHARMA":     -0.12,
            "DRREDDY":       -0.10,
            "CIPLA":         -0.15,
            # Auto — demand-collapse fears
            "MARUTI":        -0.50,
            "TATAMOTORS":    -0.55,
            "M&M":           -0.50,
            "BAJAJ-AUTO":    -0.42,
            "EICHERMOT":     -0.50,
            # Energy / Metals
            "RELIANCE":      -0.40,
            "ONGC":          -0.50,
            "COALINDIA":     -0.42,
            "TATASTEEL":     -0.45,
            "JSWSTEEL":      -0.45,
            "HINDALCO":      -0.50,
            # Utilities — defensive but still hit
            "NTPC":          -0.30,
            "POWERGRID":     -0.20,
            # Telecom / Conglomerates
            "BHARTIARTL":    -0.25,
            "LT":            -0.45,
            "ASIANPAINT":    -0.30,
            "ULTRACEMCO":    -0.38,
            "TITAN":         -0.50,
            "ADANIPORTS":    -0.55,
            "ADANIENT":      -0.50,
        },
    },
    "GFC_2008": {
        "label":       "Global Financial Crisis (Sep–Nov 2008)",
        "window":      "Sep 15 – Nov 21, 2008",
        "description": "Lehman collapse triggered a credit-market freeze; Sensex fell ~45% over 10 weeks.",
        "returns": {
            "__default__":   -0.45,
            # Financials — at the epicentre
            "HDFCBANK":      -0.45,
            "ICICIBANK":     -0.65,
            "AXISBANK":      -0.60,
            "KOTAKBANK":     -0.55,
            "SBIN":          -0.55,
            "BAJFINANCE":    -0.70,
            # Realty / Infra — credit-dependent, hit hardest
            "DLF":           -0.75,
            "LT":            -0.55,
            # Metals — global commodity rout
            "TATASTEEL":     -0.70,
            "JSWSTEEL":      -0.70,
            "HINDALCO":      -0.65,
            # IT — global slowdown but USD revenue cushioned
            "TCS":           -0.35,
            "INFY":          -0.30,
            "WIPRO":         -0.40,
            "HCLTECH":       -0.45,
            # FMCG — defensive
            "HINDUNILVR":    -0.18,
            "ITC":           -0.25,
            "NESTLEIND":     -0.12,
            # Pharma — defensive
            "SUNPHARMA":     -0.25,
            "DRREDDY":       -0.20,
            "CIPLA":         -0.25,
            # Auto — demand collapse
            "MARUTI":        -0.55,
            "TATAMOTORS":    -0.70,
            "M&M":           -0.50,
            # Energy
            "RELIANCE":      -0.50,
            "ONGC":          -0.50,
            # Utilities
            "NTPC":          -0.30,
            # Telecom
            "BHARTIARTL":    -0.40,
            # Other large-caps
            "ASIANPAINT":    -0.40,
            "ULTRACEMCO":    -0.50,
            "TITAN":         -0.55,
        },
    },
    "ADANI_2023": {
        "label":       "Adani–Hindenburg shock (Jan–Feb 2023)",
        "window":      "Jan 24 – Feb 28, 2023",
        "description": "Hindenburg short-seller report triggered a sharp Adani-group sell-off; broader market barely moved.",
        "returns": {
            "__default__":   -0.02,
            # Adani group — the epicentre
            "ADANIENT":      -0.80,
            "ADANIPORTS":    -0.40,
            "ADANIGREEN":    -0.75,
            "ADANITRANS":    -0.70,
            "ADANIPOWER":    -0.35,
            "ADANITOTAL":    -0.78,
            "AMBUJACEM":     -0.30,  # Adani-owned
            "ACC":           -0.25,  # Adani-owned
            # Banks with Adani exposure — mild contagion
            "SBIN":          -0.05,
            "ICICIBANK":     -0.03,
            "AXISBANK":      -0.04,
            # Broader large-caps — mostly flat
            "RELIANCE":      -0.03,
            "HDFCBANK":      -0.02,
            "TCS":           -0.01,
            "INFY":           0.00,
            "ITC":            0.02,
            "HINDUNILVR":     0.00,
            "BHARTIARTL":    -0.02,
            "MARUTI":        -0.01,
            "SUNPHARMA":      0.01,
        },
    },
}


def _scenario_return(scenario_code: str, symbol: str) -> float:
    """Look up the per-symbol drawdown for a scenario, falling back to the
    scenario's broad-market default. Symbols normalised to upper-case."""
    s = SCENARIOS.get(scenario_code)
    if not s:
        return 0.0
    returns = s["returns"]
    sym = (symbol or "").upper()
    return float(returns.get(sym, returns["__default__"]))


# ── Holdings aggregation across the user's portfolios ────────────────────────

async def _fetch_user_holdings_aggregated(db: Any, user_id: str) -> list[dict]:
    """
    Sum holdings by symbol across all portfolios the user owns, attaching the
    latest price from price_history. Returns a list of:
      { "symbol": str, "qty": float, "last_price": float | None, "value": float }
    Symbols with no price are skipped (we can't stress-test what we can't value).
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

    # Aggregate by symbol: instrument_id -> {symbol, qty}
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

    out: list[dict] = []
    for (iid, slot), price in zip(agg.items(), prices):
        if price is None or price <= 0:
            continue
        out.append({
            "symbol":     slot["symbol"],
            "qty":        slot["qty"],
            "last_price": price,
            "value":      slot["qty"] * price,
        })
    return out


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/stress-test")
async def stress_test(auth: Auth) -> dict[str, Any]:
    """
    Apply each historical scenario's per-symbol returns to the user's current
    holdings and return per-scenario impact summaries with worst-3 losers.
    """
    if not auth.user_id and not auth.is_service_account:
        raise HTTPException(401, detail="User authentication required")

    db = get_supabase()
    as_of = datetime.now(timezone.utc).date().isoformat()

    holdings = await _fetch_user_holdings_aggregated(db, auth.user_id)
    portfolio_value = sum(h["value"] for h in holdings)

    scenarios_out: list[dict[str, Any]] = []
    for code, meta in SCENARIOS.items():
        # Per-holding stress: value_post = value_pre * (1 + return_pct)
        stressed: list[dict[str, Any]] = []
        for h in holdings:
            ret_pct = _scenario_return(code, h["symbol"])
            value_post = h["value"] * (1.0 + ret_pct)
            loss_inr = value_post - h["value"]
            stressed.append({
                "symbol":     h["symbol"],
                "qty":        h["qty"],
                "value_pre":  round(h["value"], 2),
                "value_post": round(value_post, 2),
                "loss_inr":   round(loss_inr, 2),
                "loss_pct":   round(ret_pct * 100, 2),
            })
        portfolio_value_post = sum(s["value_post"] for s in stressed)
        total_loss_inr = portfolio_value_post - portfolio_value
        total_loss_pct = (
            (total_loss_inr / portfolio_value * 100) if portfolio_value > 0 else 0.0
        )
        # Worst-3 losers by absolute loss (most negative first)
        top3 = sorted(stressed, key=lambda s: s["loss_inr"])[:3]

        scenarios_out.append({
            "code":                 code,
            "label":                meta["label"],
            "window":               meta["window"],
            "description":          meta["description"],
            "portfolio_value_post": round(portfolio_value_post, 2),
            "loss_inr":             round(total_loss_inr, 2),
            "loss_pct":             round(total_loss_pct, 2),
            "top3_losers":          top3,
        })

    logger.info(
        "stress_test.computed",
        user_id=auth.user_id,
        holdings_count=len(holdings),
        portfolio_value=round(portfolio_value, 2),
    )

    return {
        "as_of":           as_of,
        "portfolio_value": round(portfolio_value, 2),
        "holdings_count":  len(holdings),
        "scenarios":       scenarios_out,
    }
