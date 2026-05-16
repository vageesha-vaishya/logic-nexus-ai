"""
LangGraph Multi-Asset Signal Generator — v2

Dispatcher routes by asset class to a specialised sub-pipeline:

  Equity (EQ):    fetch → compute_equity   → score → persist
  F&O  (FUT/OPT): fetch → compute_fo       → score → persist
  MF   (MF):      fetch → compute_mf       → score → persist
  FX   (CURRENCY):fetch → compute_fx       → score → persist
  Bond (BOND/GB): fetch → compute_bond     → score → persist
  Commodity (COMM/ETF-COMM):
                  fetch → compute_commodity → score → persist

Each compute_* node returns the same keys so score and persist are shared.
Risk parameters (stop_loss_pct, target_pct, r_r, position_size_pct) are
always computed so the UI can display them alongside the signal.
"""

from __future__ import annotations

import json
import math
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, TypedDict

import structlog
from langgraph.graph import END, StateGraph

from markets_worker.db import get_supabase
from markets_worker.llm_gateway import resolve_llm_config

logger = structlog.get_logger()

# ── Horizon definitions ───────────────────────────────────────────────────────

HORIZON_INTRADAY   = "intraday"    # same-session scalp / day trade
HORIZON_SHORT      = "short_term"  # swing: days to ~4 weeks
HORIZON_MEDIUM     = "medium_term" # positional: 1–6 months
HORIZON_LONG       = "long_term"   # invest: > 6 months

# bars to fetch per horizon (daily candles unless intraday)
_LOOKBACK: dict[str, int] = {
    HORIZON_INTRADAY: 10,
    HORIZON_SHORT:    60,
    HORIZON_MEDIUM:   120,
    HORIZON_LONG:     252,
}

# RSI + MA short/long periods per horizon
_INDICATOR_PARAMS: dict[str, dict] = {
    HORIZON_INTRADAY: {"rsi": 9,  "ma_s": 5,   "ma_m": 10,  "ma_l": 20,  "bb": 10, "stoch": 9},
    HORIZON_SHORT:    {"rsi": 14, "ma_s": 10,  "ma_m": 20,  "ma_l": 50,  "bb": 20, "stoch": 14},
    HORIZON_MEDIUM:   {"rsi": 14, "ma_s": 20,  "ma_m": 50,  "ma_l": 100, "bb": 20, "stoch": 14},
    HORIZON_LONG:     {"rsi": 21, "ma_s": 50,  "ma_m": 100, "ma_l": 200, "bb": 20, "stoch": 21},
}

# ── Expanded SignalState ───────────────────────────────────────────────────────

class SignalState(TypedDict):
    # Instrument identity
    instrument_id:   str
    symbol:          str
    exchange:        str
    asset_class:     str   # equity, fo, mf, fx, bond, commodity
    instrument_type: str   # EQ, FUT, OPT, CE, PE, MF, CURRENCY, BOND, COMM
    option_type:     str | None
    expiry:          str | None
    strike:          float | None
    underlying_id:   str | None
    lot_size:        int | None

    # Portfolio / tenant context
    portfolio_id:    str | None
    tenant_id:       str | None
    franchise_id:    str | None
    owner_user_id:   str | None

    # Holding context
    avg_cost:             float | None
    qty:                  float | None
    holding_period_days:  int | None

    # Derived
    horizon:   str   # intraday | short_term | medium_term | long_term

    # Data fetched
    prices:        list[dict]   # daily OHLCV (or intraday 5m)
    prices_weekly: list[dict]   # weekly OHLCV for medium/long confirmation
    oi_series:     list[dict]   # open interest series (F&O)
    nav_history:   list[dict]   # NAV entries (MF)
    extra_data:    dict         # fx_rate, bond_yield, etc.

    # Computed by compute_* nodes
    indicators:  dict

    # Signal output
    signal_type: str   # buy | sell | hold | buy_more | reduce | exit | switch | roll
    direction:   str   # long | short | neutral
    confidence:  float
    rationale:   str
    score:       float
    risk_params: dict  # stop_loss_pct, target_pct, r_r, position_size_pct, atr_pts

    error:       str | None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_avg(vals: list[float]) -> float | None:
    return sum(vals) / len(vals) if vals else None

def _sma(series: list[float], n: int) -> float | None:
    if len(series) < n:
        return None
    return sum(series[-n:]) / n

def _ema(series: list[float], n: int) -> float | None:
    if len(series) < n:
        return None
    k = 2 / (n + 1)
    ema = sum(series[:n]) / n
    for v in series[n:]:
        ema = v * k + ema * (1 - k)
    return ema

def _rsi(closes: list[float], n: int) -> float | None:
    if len(closes) < n + 1:
        return None
    gains, losses = [], []
    for i in range(1, n + 1):
        delta = closes[-i] - closes[-i - 1]
        (gains if delta >= 0 else losses).append(abs(delta))
    ag = _safe_avg(gains) or 1e-9
    al = _safe_avg(losses) or 1e-9
    rs = ag / al
    return round(100 - 100 / (1 + rs), 2)

def _atr(highs: list[float], lows: list[float], closes: list[float], n: int = 14) -> float | None:
    if len(closes) < n + 1:
        return None
    trs = [
        max(highs[-i] - lows[-i],
            abs(highs[-i] - closes[-i - 1]),
            abs(lows[-i] - closes[-i - 1]))
        for i in range(1, n + 1)
    ]
    return round(sum(trs) / n, 4)

def _macd(closes: list[float]) -> dict:
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    if ema12 is None or ema26 is None:
        return {}
    line = ema12 - ema26
    # Approximate signal line from last 9 MACD values
    macd_vals = []
    for i in range(9, 0, -1):
        e12 = _ema(closes[:-i] if i > 0 else closes, 12)
        e26 = _ema(closes[:-i] if i > 0 else closes, 26)
        if e12 and e26:
            macd_vals.append(e12 - e26)
    signal = _safe_avg(macd_vals) if len(macd_vals) >= 3 else line
    return {"macd_line": round(line, 4), "signal_line": round(signal, 4),
            "histogram": round(line - signal, 4)}

def _bollinger(closes: list[float], n: int = 20) -> dict:
    if len(closes) < n:
        return {}
    recent = closes[-n:]
    mid = sum(recent) / n
    std = math.sqrt(sum((x - mid) ** 2 for x in recent) / n)
    upper = mid + 2 * std
    lower = mid - 2 * std
    ltp = closes[-1]
    pct_b = (ltp - lower) / (upper - lower) if upper != lower else 0.5
    return {
        "bb_upper": round(upper, 2), "bb_mid": round(mid, 2),
        "bb_lower": round(lower, 2), "bb_pct_b": round(pct_b, 3),
        "bb_width": round((upper - lower) / mid * 100, 2) if mid else None,
    }

def _stochastic(highs: list[float], lows: list[float], closes: list[float], n: int = 14) -> dict:
    if len(closes) < n:
        return {}
    h14 = max(highs[-n:])
    l14 = min(lows[-n:])
    if h14 == l14:
        return {"stoch_k": 50.0, "stoch_d": 50.0}
    k = (closes[-1] - l14) / (h14 - l14) * 100
    ks = [
        (closes[-i] - min(lows[-(i + n - 1):-i + 1 if i > 1 else None] or lows[-n:])) /
        max(1e-9, max(highs[-(i + n - 1):-i + 1 if i > 1 else None] or highs[-n:]) -
            min(lows[-(i + n - 1):-i + 1 if i > 1 else None] or lows[-n:])) * 100
        for i in range(1, 4)
    ]
    d = sum(ks) / len(ks)
    return {"stoch_k": round(k, 2), "stoch_d": round(d, 2)}

def _volume_analysis(volumes: list[float], closes: list[float]) -> dict:
    if len(volumes) < 20:
        return {}
    avg20 = sum(volumes[-20:]) / 20
    recent_vol = volumes[-1]
    vol_ratio = round(recent_vol / avg20, 2) if avg20 else 1.0
    # OBV proxy: running sum of signed volume
    obv = 0.0
    for i in range(1, min(len(closes), len(volumes))):
        if closes[-i] > closes[-i - 1]:
            obv += volumes[-i]
        elif closes[-i] < closes[-i - 1]:
            obv -= volumes[-i]
    obv_trend = "accumulation" if obv > 0 else "distribution"
    return {"vol_ratio": vol_ratio, "obv_trend": obv_trend,
            "vol_surge": vol_ratio > 2.0}

def _detect_regime(closes: list[float], atr: float | None) -> str:
    """Trending / ranging / volatile based on price action."""
    if len(closes) < 30 or not atr:
        return "unknown"
    ltp = closes[-1]
    atr_ratio = atr / ltp if ltp else 0
    ma20 = _sma(closes, 20)
    ma50 = _sma(closes, 50) if len(closes) >= 50 else None
    if atr_ratio > 0.025:
        return "volatile"
    if ma20 and ma50 and abs(ma20 - ma50) / ma50 > 0.02:
        return "trending"
    return "ranging"


def _adx(highs: list[float], lows: list[float], closes: list[float], n: int = 14) -> dict:
    """Wilder's Average Directional Index — measures trend strength, not direction."""
    min_bars = n * 3
    if len(closes) < min_bars:
        return {}

    tr_list, pdm_list, ndm_list = [], [], []
    for i in range(1, len(closes)):
        tr  = max(highs[i] - lows[i],
                  abs(highs[i] - closes[i - 1]),
                  abs(lows[i]  - closes[i - 1]))
        up   = highs[i] - highs[i - 1]
        down = lows[i - 1] - lows[i]
        tr_list.append(tr)
        pdm_list.append(up   if up   > down and up   > 0 else 0.0)
        ndm_list.append(down if down > up   and down > 0 else 0.0)

    # Wilder's smoothing seed (sum of first n)
    atr_w = float(sum(tr_list[:n]))
    pdm_w = float(sum(pdm_list[:n]))
    ndm_w = float(sum(ndm_list[:n]))

    dx_list: list[float] = []
    pdi_last = ndi_last = 0.0

    for i in range(n, len(tr_list)):
        atr_w = atr_w - atr_w / n + tr_list[i]
        pdm_w = pdm_w - pdm_w / n + pdm_list[i]
        ndm_w = ndm_w - ndm_w / n + ndm_list[i]
        if atr_w == 0:
            continue
        pdi  = 100 * pdm_w / atr_w
        ndi  = 100 * ndm_w / atr_w
        dsum = pdi + ndi
        dx   = 100 * abs(pdi - ndi) / dsum if dsum else 0.0
        dx_list.append(dx)
        pdi_last, ndi_last = pdi, ndi

    if len(dx_list) < n:
        return {}

    adx_val = sum(dx_list[-n:]) / n
    strength = "strong" if adx_val > 25 else ("weak" if adx_val < 20 else "moderate")
    return {
        "adx":       round(adx_val, 2),
        "plus_di":   round(pdi_last, 2),
        "minus_di":  round(ndi_last, 2),
        "adx_trend": strength,
    }


def _mtf_alignment(daily_ind: dict, weekly_closes: list[float]) -> dict:
    """
    Multi-timeframe confluence score (0.0 – 1.0).
    Compares daily indicators against weekly trend.
    """
    if not weekly_closes or len(weekly_closes) < 13:
        return {"mtf_score": None, "weekly_trend": None, "mtf_conf_mult": 1.0}

    # Weekly trend: 13-week SMA slope
    wma13 = _sma(weekly_closes, 13)
    wma13_prev = _sma(weekly_closes[:-4], 13) if len(weekly_closes) > 17 else wma13
    weekly_up = bool(wma13 and wma13_prev and wma13 > wma13_prev)

    daily_up = daily_ind.get("trend") == "up"
    macd_pos = (daily_ind.get("macd_line") or 0) > (daily_ind.get("signal_line") or 0)
    ma_cross_bull = daily_ind.get("ma_cross") == "golden"

    votes_bull = sum([weekly_up, daily_up, macd_pos, ma_cross_bull])
    score = round(votes_bull / 4, 2)

    # Confidence multiplier:
    # 4/4 aligned → 1.15x  |  3/4 → 1.05x  |  2/4 → 1.0x  |  ≤1/4 → 0.80x
    mult = {4: 1.15, 3: 1.05, 2: 1.0, 1: 0.80, 0: 0.80}[votes_bull]

    return {
        "mtf_score":       score,
        "weekly_trend":    "up" if weekly_up else "down",
        "mtf_conf_mult":   mult,
        "mtf_votes_bull":  votes_bull,
    }

def _risk_params(ltp: float, atr: float | None, signal_type: str, score: float) -> dict:
    """ATR-based stop-loss, target, and position sizing."""
    atr_v = atr or ltp * 0.02
    mult = 1.5 if abs(score) > 0.5 else 2.0
    stop_pts = round(atr_v * mult, 2)
    target_pts = round(stop_pts * 2.0, 2)  # minimum 2:1 R:R
    if signal_type == "sell":
        sl_pct = round(stop_pts / ltp * 100, 2)
        tgt_pct = round(target_pts / ltp * 100, 2)
    else:
        sl_pct = round(stop_pts / ltp * 100, 2)
        tgt_pct = round(target_pts / ltp * 100, 2)
    r_r = round(target_pts / stop_pts, 2) if stop_pts else 2.0
    # Kelly-like position size: confidence * (R:R / (R:R + 1)) capped at 10%
    pos_size = min(10.0, round(abs(score) * (r_r / (r_r + 1)) * 20, 1))
    return {
        "stop_loss_pct": sl_pct, "target_pct": tgt_pct,
        "r_r": r_r, "position_size_pct": pos_size, "atr_pts": round(atr_v, 2),
    }


# ── Node 1: fetch_data (all asset classes) ────────────────────────────────────

async def fetch_data(state: SignalState) -> dict:
    db = get_supabase()
    instr_id = state["instrument_id"]
    horizon  = state.get("horizon", HORIZON_MEDIUM)
    lookback = _LOOKBACK.get(horizon, 120)

    # Primary price series
    try:
        pr = (
            db.schema("markets").from_("price_history")
            .select("ts, open, high, low, close, volume, oi")
            .eq("instrument_id", instr_id)
            .order("ts", desc=True).limit(lookback + 50)
            .execute()
        )
        prices = list(reversed(pr.data or []))
    except Exception as exc:
        return {"error": f"fetch_prices: {exc}", "prices": [], "prices_weekly": [],
                "oi_series": [], "nav_history": [], "extra_data": {}}

    # Weekly candles for medium/long term confluence
    prices_weekly: list[dict] = []
    if horizon in (HORIZON_MEDIUM, HORIZON_LONG) and len(prices) >= 20:
        # downsample: take last day of each week
        weekly: dict[str, dict] = {}
        for p in prices:
            wk = datetime.fromisoformat(str(p["ts"])).strftime("%Y-%W")
            weekly[wk] = p
        prices_weekly = list(weekly.values())[-26:]

    # OI series for F&O
    oi_series: list[dict] = []
    if state.get("asset_class") in ("fo",) and any(p.get("oi") for p in prices):
        oi_series = [{"ts": p["ts"], "oi": p.get("oi", 0)} for p in prices[-30:]]

    # NAV history for MF
    nav_history: list[dict] = []
    if state.get("asset_class") == "mf":
        try:
            mf = (
                db.schema("markets").from_("mf_schemes")
                .select("nav, nav_date")
                .eq("instrument_id", instr_id)
                .order("nav_date", desc=True).limit(252)
                .execute()
            )
            nav_history = list(reversed(mf.data or []))
        except Exception:
            pass

    # Holding context
    avg_cost: float | None = None
    qty:      float | None = None
    holding_period_days: int | None = None
    if state.get("portfolio_id"):
        try:
            h = (
                db.schema("markets").from_("holdings")
                .select("avg_cost, qty, last_updated_at, metadata")
                .eq("portfolio_id", state["portfolio_id"])
                .eq("instrument_id", instr_id)
                .maybe_single().execute()
            )
            if h.data:
                avg_cost = float(h.data["avg_cost"])
                qty      = float(h.data["qty"])
                if h.data.get("last_updated_at"):
                    since = datetime.now(timezone.utc) - datetime.fromisoformat(h.data["last_updated_at"])
                    holding_period_days = since.days
        except Exception:
            pass

    # FX rate for currency instruments
    extra_data: dict = {}
    if state.get("asset_class") == "fx":
        try:
            fx = (
                db.schema("markets").from_("fx_rates")
                .select("rate, ts")
                .eq("base_currency", state["symbol"][:3])
                .order("ts", desc=True).limit(1)
                .execute()
            )
            if fx.data:
                extra_data["latest_fx_rate"] = fx.data[0]
        except Exception:
            pass

    return {
        "prices": prices, "prices_weekly": prices_weekly,
        "oi_series": oi_series, "nav_history": nav_history,
        "extra_data": extra_data,
        "avg_cost": avg_cost, "qty": qty,
        "holding_period_days": holding_period_days,
        "error": None,
    }


# ── Node 2a: compute_equity_indicators ────────────────────────────────────────

async def compute_equity(state: SignalState) -> dict:
    prices  = state.get("prices", [])
    horizon = state.get("horizon", HORIZON_MEDIUM)
    p       = _INDICATOR_PARAMS[horizon]

    if len(prices) < p["ma_s"] + 5:
        return {"indicators": {}, "error": "insufficient_price_data"}

    closes  = [float(x["close"])  for x in prices]
    highs   = [float(x["high"])   for x in prices]
    lows    = [float(x["low"])    for x in prices]
    volumes = [float(x.get("volume") or 0) for x in prices]

    ltp  = closes[-1]
    atr  = _atr(highs, lows, closes, 14)
    rsi  = _rsi(closes, p["rsi"])
    ma_s = _sma(closes, p["ma_s"])
    ma_m = _sma(closes, p["ma_m"])
    ma_l = _sma(closes, p["ma_l"]) if len(closes) >= p["ma_l"] else None
    macd = _macd(closes)
    bb   = _bollinger(closes, p["bb"])
    stch = _stochastic(highs, lows, closes, p["stoch"])
    vola = _volume_analysis(volumes, closes)
    adx  = _adx(highs, lows, closes, 14)

    # Trend (slope of medium MA over last 5 bars)
    ma_m_prev = _sma(closes[:-5], p["ma_m"]) if len(closes) > p["ma_m"] + 5 else ma_m
    trend = "up" if (ma_m and ma_m_prev and ma_m > ma_m_prev) else "down"

    # MA cross
    ma_cross = None
    if ma_m and ma_l:
        ma_cross = "golden" if ma_m > ma_l else "death"

    regime = _detect_regime(closes, atr)

    # Multi-timeframe alignment
    wc  = [float(x["close"]) for x in state.get("prices_weekly", [])]
    mtf = _mtf_alignment(
        {"trend": trend, "macd_line": macd.get("macd_line"),
         "signal_line": macd.get("signal_line"), "ma_cross": ma_cross},
        wc,
    )

    ind: dict[str, Any] = {
        "ltp": round(ltp, 2), "atr": atr,
        "rsi": rsi, "trend": trend, "regime": regime,
        f"ma{p['ma_s']}": round(ma_s, 2) if ma_s else None,
        f"ma{p['ma_m']}": round(ma_m, 2) if ma_m else None,
        f"ma{p['ma_l']}": round(ma_l, 2) if ma_l else None,
        "ma_cross":    ma_cross,
        "pct_from_ma": round((ltp - ma_m) / ma_m * 100, 2) if ma_m else None,
        **macd, **bb, **stch, **vola, **adx, **mtf,
    }

    avg_cost = state.get("avg_cost")
    if avg_cost and avg_cost > 0:
        ind["unrealized_pct"]      = round((ltp - avg_cost) / avg_cost * 100, 2)
        ind["holding_period_days"] = state.get("holding_period_days")

    return {"indicators": ind, "error": None}


# ── Node 2b: compute_fo_indicators ────────────────────────────────────────────

async def compute_fo(state: SignalState) -> dict:
    prices = state.get("prices", [])
    if len(prices) < 10:
        return {"indicators": {}, "error": "insufficient_fo_data"}

    closes  = [float(x["close"])  for x in prices]
    highs   = [float(x["high"])   for x in prices]
    lows    = [float(x["low"])    for x in prices]
    volumes = [float(x.get("volume") or 0) for x in prices]
    oi_list = [int(x.get("oi") or 0) for x in prices]

    ltp = closes[-1]
    atr = _atr(highs, lows, closes, 14)
    rsi = _rsi(closes, 14)

    # OI analysis: rising OI + rising price = long build-up (bullish)
    #              rising OI + falling price = short build-up (bearish)
    oi_change = None
    oi_interpretation = None
    if len(oi_list) >= 5 and any(oi_list):
        oi_now  = oi_list[-1]
        oi_5ago = oi_list[-5] or 1
        oi_change = round((oi_now - oi_5ago) / oi_5ago * 100, 2)
        price_change = closes[-1] - closes[-5]
        if oi_change > 5 and price_change > 0:
            oi_interpretation = "long_buildup"
        elif oi_change > 5 and price_change < 0:
            oi_interpretation = "short_buildup"
        elif oi_change < -5 and price_change > 0:
            oi_interpretation = "short_covering"
        elif oi_change < -5 and price_change < 0:
            oi_interpretation = "long_unwinding"

    # Days to expiry
    dte = None
    if state.get("expiry"):
        try:
            expiry = date.fromisoformat(state["expiry"])
            dte = (expiry - date.today()).days
        except Exception:
            pass

    # Basis (futures premium/discount to spot) — needs underlying price
    basis_pct = None
    if state.get("underlying_id"):
        try:
            db = get_supabase()
            sp = (
                db.schema("markets").from_("price_history")
                .select("close").eq("instrument_id", state["underlying_id"])
                .order("ts", desc=True).limit(1).execute()
            )
            if sp.data:
                spot = float(sp.data[0]["close"])
                basis_pct = round((ltp - spot) / spot * 100, 2)
        except Exception:
            pass

    ind: dict[str, Any] = {
        "ltp": round(ltp, 2), "atr": atr, "rsi": rsi,
        "oi_change_5d_pct": oi_change, "oi_interpretation": oi_interpretation,
        "dte": dte, "basis_pct": basis_pct,
        "instrument_type": state.get("instrument_type"),
        "option_type": state.get("option_type"),
        "strike": state.get("strike"),
        "lot_size": state.get("lot_size"),
        **_macd(closes), **_bollinger(closes, 20),
        **_volume_analysis(volumes, closes),
    }

    if state.get("avg_cost"):
        ind["unrealized_pct"] = round((ltp - state["avg_cost"]) / state["avg_cost"] * 100, 2)

    return {"indicators": ind, "error": None}


# ── Node 2c: compute_mf_metrics ───────────────────────────────────────────────

async def compute_mf(state: SignalState) -> dict:
    nav_hist = state.get("nav_history", [])
    # Fall back to price_history if NAV history is thin
    if len(nav_hist) < 20:
        nav_hist = [{"nav": p["close"], "nav_date": p["ts"]} for p in state.get("prices", [])]
    if len(nav_hist) < 20:
        return {"indicators": {}, "error": "insufficient_nav_data"}

    navs = [float(x.get("nav") or x.get("close") or 0) for x in nav_hist]
    ltp  = navs[-1]

    def _ret(n: int) -> float | None:
        if len(navs) < n:
            return None
        return round((navs[-1] / navs[-n] - 1) * 100, 2)

    r1m  = _ret(21)
    r3m  = _ret(63)
    r6m  = _ret(126)
    r1y  = _ret(252)

    # Trailing volatility (annualised)
    vol = None
    if len(navs) >= 30:
        rets = [(navs[i] / navs[i - 1] - 1) for i in range(1, min(30, len(navs)))]
        avg_r = sum(rets) / len(rets)
        variance = sum((r - avg_r) ** 2 for r in rets) / len(rets)
        vol = round(math.sqrt(variance * 252) * 100, 2)

    # Momentum: 12-month return minus 1-month return (dual-momentum)
    momentum = None
    if r1y is not None and r1m is not None:
        momentum = round(r1y - r1m, 2)

    # SIP context
    sip_note = None
    sip_amt = state.get("avg_cost")  # avg_cost used as SIP amount proxy for MF
    if sip_amt and r3m is not None:
        if r3m < -10:
            sip_note = "consider_increase_sip"  # rupee cost averaging opportunity
        elif r3m > 20:
            sip_note = "consider_pause_sip"     # high valuations
        else:
            sip_note = "continue_sip"

    ind: dict[str, Any] = {
        "ltp_nav": round(ltp, 4),
        "return_1m_pct": r1m, "return_3m_pct": r3m,
        "return_6m_pct": r6m, "return_1y_pct": r1y,
        "trailing_vol_ann_pct": vol,
        "dual_momentum": momentum,
        "sip_recommendation": sip_note,
    }

    if state.get("avg_cost"):
        ind["unrealized_pct"] = round((ltp - state["avg_cost"]) / state["avg_cost"] * 100, 2)

    return {"indicators": ind, "error": None}


# ── Node 2d: compute_fx_indicators ────────────────────────────────────────────

async def compute_fx(state: SignalState) -> dict:
    prices = state.get("prices", [])
    if len(prices) < 20:
        return {"indicators": {}, "error": "insufficient_fx_data"}

    closes  = [float(x["close"])  for x in prices]
    highs   = [float(x["high"])   for x in prices]
    lows    = [float(x["low"])    for x in prices]
    ltp     = closes[-1]
    atr     = _atr(highs, lows, closes, 14)
    rsi     = _rsi(closes, 14)
    bb      = _bollinger(closes, 20)
    macd_d  = _macd(closes)
    ma5     = _sma(closes, 5)
    ma20    = _sma(closes, 20)
    ma50    = _sma(closes, 50) if len(closes) >= 50 else None

    # 52-week range
    wk52_h = max(closes[-min(252, len(closes)):])
    wk52_l = min(closes[-min(252, len(closes)):])
    pct_52w = round((ltp - wk52_l) / (wk52_h - wk52_l) * 100, 2) if wk52_h != wk52_l else 50.0

    trend = "up" if (ma5 and ma20 and ma5 > ma20) else "down"

    ind: dict[str, Any] = {
        "ltp": round(ltp, 4), "atr": atr, "rsi": rsi,
        "ma5": round(ma5, 4) if ma5 else None,
        "ma20": round(ma20, 4) if ma20 else None,
        "ma50": round(ma50, 4) if ma50 else None,
        "trend": trend, "pct_52w_range": pct_52w,
        **bb, **macd_d,
    }
    return {"indicators": ind, "error": None}


# ── Node 2e: compute_bond_metrics ─────────────────────────────────────────────

async def compute_bond(state: SignalState) -> dict:
    prices = state.get("prices", [])
    if len(prices) < 10:
        return {"indicators": {}, "error": "insufficient_bond_data"}

    closes = [float(x["close"]) for x in prices]
    ltp    = closes[-1]
    r1m    = round((closes[-1] / closes[-21] - 1) * 100, 2) if len(closes) >= 21 else None
    r3m    = round((closes[-1] / closes[-63] - 1) * 100, 2) if len(closes) >= 63 else None

    # Price-based yield proxy: bond prices move inversely to yields
    # When price trending up → yield falling → duration risk decreasing
    ma10 = _sma(closes, 10)
    ma20 = _sma(closes, 20)
    trend = "price_up_yield_down" if (ma10 and ma20 and ma10 > ma20) else "price_down_yield_up"
    rsi  = _rsi(closes, 14)

    ind: dict[str, Any] = {
        "ltp_price": round(ltp, 4), "rsi": rsi,
        "return_1m_pct": r1m, "return_3m_pct": r3m,
        "yield_trend": trend,
        "ma10": round(ma10, 4) if ma10 else None,
        "ma20": round(ma20, 4) if ma20 else None,
    }

    if state.get("avg_cost"):
        ind["unrealized_pct"] = round((ltp - state["avg_cost"]) / state["avg_cost"] * 100, 2)

    return {"indicators": ind, "error": None}


# ── Node 2f: compute_commodity_indicators ────────────────────────────────────

async def compute_commodity(state: SignalState) -> dict:
    prices = state.get("prices", [])
    if len(prices) < 20:
        return {"indicators": {}, "error": "insufficient_commodity_data"}

    closes  = [float(x["close"])  for x in prices]
    highs   = [float(x["high"])   for x in prices]
    lows    = [float(x["low"])    for x in prices]
    volumes = [float(x.get("volume") or 0) for x in prices]
    oi_list = [int(x.get("oi") or 0) for x in prices]

    ltp  = closes[-1]
    atr  = _atr(highs, lows, closes, 14)
    rsi  = _rsi(closes, 14)
    ma20 = _sma(closes, 20)
    ma50 = _sma(closes, 50) if len(closes) >= 50 else None
    bb   = _bollinger(closes, 20)
    vola = _volume_analysis(volumes, closes)

    # OI analysis (same as F&O)
    oi_interp = None
    if len(oi_list) >= 5 and any(oi_list):
        oi_now   = oi_list[-1] or 1
        oi_5ago  = oi_list[-5] or 1
        oi_chg   = (oi_now - oi_5ago) / oi_5ago * 100
        px_chg   = closes[-1] - closes[-5]
        if oi_chg > 5 and px_chg > 0:
            oi_interp = "long_buildup"
        elif oi_chg > 5 and px_chg < 0:
            oi_interp = "short_buildup"
        elif oi_chg < -5 and px_chg > 0:
            oi_interp = "short_covering"

    # 52-week range context
    wk52_h = max(closes[-min(252, len(closes)):])
    wk52_l = min(closes[-min(252, len(closes)):])
    pct_52w = round((ltp - wk52_l) / (wk52_h - wk52_l) * 100, 2) if wk52_h != wk52_l else 50.0

    trend = "up" if (ma20 and _sma(closes[:-5], 20) and ma20 > _sma(closes[:-5], 20)) else "down"
    regime = _detect_regime(closes, atr)

    ind: dict[str, Any] = {
        "ltp": round(ltp, 2), "atr": atr, "rsi": rsi,
        "ma20": round(ma20, 2) if ma20 else None,
        "ma50": round(ma50, 2) if ma50 else None,
        "trend": trend, "regime": regime,
        "pct_52w_range": pct_52w, "oi_interpretation": oi_interp,
        **bb, **vola,
    }

    if state.get("avg_cost"):
        ind["unrealized_pct"] = round((ltp - state["avg_cost"]) / state["avg_cost"] * 100, 2)

    return {"indicators": ind, "error": None}


# ── Asset-class-specific LLM system prompts ───────────────────────────────────

_SYSTEM_PROMPTS: dict[str, str] = {
    "equity": """You are a senior quantitative analyst for Indian equity markets (NSE/BSE).
Analyse the technical indicators and generate a precise trading signal.

Key rules:
- ADX > 25 = strong trend (signals reliable). ADX < 20 = ranging (prefer hold).
- MTF alignment: mtf_score 1.0 = all timeframes agree (high conviction). 0.25 = mixed.
- For "buy": RSI not overbought (<70), MACD positive or crossing, volume confirming.
- For "sell": RSI not oversold (>30), MACD negative, distribution pattern.
- Regime "ranging" → lower confidence, avoid buy/sell unless ADX confirms trend.

Signal types: buy | sell | hold | buy_more | reduce | exit

Respond ONLY with valid JSON:
{"signal_type":"...","direction":"long|short|neutral","confidence":0.0,"score":0.0,"rationale":"≤2 sentences"}""",

    "fo": """You are an expert derivatives trader for Indian markets (NSE F&O segment).
Analyse the F&O indicators including OI, basis, days-to-expiry, and price action.

Signal types: buy (long futures/call), sell (short futures/put), hold, roll (near expiry), exit
Consider: OI interpretation (long_buildup/short_buildup/short_covering/long_unwinding),
days to expiry (DTE < 5 = roll/exit urgency), basis premium/discount.

Respond ONLY with valid JSON:
{"signal_type":"...","direction":"long|short|neutral","confidence":0.0,"score":0.0,"rationale":"≤2 sentences"}""",

    "mf": """You are a mutual fund analyst for Indian markets (AMFI registered).
Analyse the NAV momentum, returns across timeframes, and volatility.

Signal types: buy (lump sum), sell (redeem), hold (continue SIP), switch (to better fund), buy_more (increase SIP)
Consider: dual-momentum (12M - 1M return), trailing volatility, SIP context.
For MF, confidence should be lower (0.3–0.7) as MF signals are less precise than equity.

Respond ONLY with valid JSON:
{"signal_type":"...","direction":"long|short|neutral","confidence":0.0,"score":0.0,"rationale":"≤2 sentences"}""",

    "fx": """You are a currency analyst for Indian forex markets (NSE currency segment: USD/INR, EUR/INR etc.).
Analyse technical indicators for the currency pair.

Signal types: buy (long base currency), sell (short base currency), hold
Consider: RBI intervention risk (for INR pairs), range-bound behaviour typical of managed float,
52-week range position, momentum.

Respond ONLY with valid JSON:
{"signal_type":"...","direction":"long|short|neutral","confidence":0.0,"score":0.0,"rationale":"≤2 sentences"}""",

    "bond": """You are a fixed income analyst for Indian bond markets (G-Sec, corporate bonds, T-Bills).
Analyse bond price movement and yield direction.

Signal types: buy (price expected to rise / yield to fall), sell (price fall / yield rise), hold
Consider: price-yield inverse relationship, duration risk, RBI rate cycle.
Bond signals have longer timeframes — indicate expected holding period in rationale.

Respond ONLY with valid JSON:
{"signal_type":"...","direction":"long|short|neutral","confidence":0.0,"score":0.0,"rationale":"≤2 sentences"}""",

    "commodity": """You are a commodity analyst for Indian markets (MCX: gold, silver, crude, natural gas, agri).
Analyse technical indicators and OI data for the commodity.

Signal types: buy, sell, hold, reduce, exit
Consider: OI interpretation, 52-week range position, seasonal patterns (for agri),
global correlation (crude, gold), regime (volatile / trending / ranging).
MCX session hours: 09:00–23:30 IST (non-agri), 09:00–17:00 (agri).

Respond ONLY with valid JSON:
{"signal_type":"...","direction":"long|short|neutral","confidence":0.0,"score":0.0,"rationale":"≤2 sentences"}""",
}

_VALID_SIGNAL_TYPES = {"buy", "sell", "hold", "buy_more", "reduce", "exit", "switch", "roll"}
_VALID_DIRECTIONS   = {"long", "short", "neutral"}


# ── Node 3: score_signal (shared, asset-class-aware prompt) ──────────────────

async def score_signal(state: SignalState) -> dict:
    if state.get("error") and not state.get("indicators"):
        return {
            "signal_type": "hold", "direction": "neutral",
            "confidence": 0.0, "score": 0.0,
            "rationale": f"Signal skipped: {state['error']}",
            "risk_params": {},
        }

    indicators = state.get("indicators", {})
    asset_cls  = state.get("asset_class", "equity")
    horizon    = state.get("horizon", HORIZON_MEDIUM)
    system_p   = _SYSTEM_PROMPTS.get(asset_cls, _SYSTEM_PROMPTS["equity"])

    ltp = float(indicators.get("ltp") or indicators.get("ltp_nav") or indicators.get("ltp_price") or 0)

    user_msg = (
        f"Symbol: {state['symbol']} ({state['exchange']}) | "
        f"Asset class: {asset_cls} | Horizon: {horizon}\n"
        f"Instrument type: {state.get('instrument_type','EQ')}\n"
        f"Indicators:\n{json.dumps(indicators, indent=2)}\n\n"
        "Generate the trading signal."
    )

    try:
        cfg = resolve_llm_config(state.get("tenant_id"))
        from markets_worker.llm_gateway import _make_client
        _, client = _make_client(cfg)

        if cfg.provider in ("anthropic", "claude"):
            import anthropic as _ac
            resp = client.messages.create(
                model=cfg.model, max_tokens=300,
                system=system_p,
                messages=[{"role": "user", "content": user_msg}],
            )
            raw = resp.content[0].text if resp.content else "{}"
        else:
            resp = client.chat.completions.create(
                model=cfg.model, max_tokens=300,
                messages=[
                    {"role": "system", "content": system_p},
                    {"role": "user",   "content": user_msg},
                ],
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content or "{}"

        parsed    = json.loads(raw)
        sig_type  = parsed.get("signal_type", "hold")
        direction = parsed.get("direction",   "neutral")
        confidence = float(parsed.get("confidence", 0.5))
        score      = float(parsed.get("score",      0.0))
        rationale  = parsed.get("rationale", "")

        sig_type  = sig_type  if sig_type  in _VALID_SIGNAL_TYPES else "hold"
        direction = direction if direction in _VALID_DIRECTIONS   else "neutral"
        confidence = max(0.0, min(1.0, confidence))
        score      = max(-1.0, min(1.0, score))

        logger.info("score_signal.ok", symbol=state["symbol"], asset_cls=asset_cls,
                    signal=sig_type, confidence=confidence, model=cfg.model)

    except Exception as exc:
        logger.warning("score_signal.llm_failed", symbol=state["symbol"], error=str(exc))
        sig_type, direction, confidence, score, rationale = _rule_based_fallback(
            state, indicators, asset_cls
        )

    # ── Post-scoring adjustments ─────────────────────────────────────────────

    # ADX filter: ranging market → cap confidence and soften buy/sell
    adx_val   = indicators.get("adx")
    adx_trend = indicators.get("adx_trend", "moderate")
    if adx_trend == "weak" and sig_type in ("buy", "sell"):
        confidence = round(min(confidence, 0.45), 2)
        rationale  = f"[ADX {adx_val:.0f} — ranging] {rationale}"
    elif adx_trend == "strong":
        confidence = round(min(confidence * 1.10, 1.0), 2)

    # MTF multiplier: reward / penalise cross-timeframe alignment
    mtf_mult = float(indicators.get("mtf_conf_mult") or 1.0)
    if mtf_mult != 1.0:
        confidence = round(min(confidence * mtf_mult, 1.0), 2)

    atr = indicators.get("atr")
    risk = _risk_params(ltp, atr, sig_type, score) if ltp > 0 else {}

    return {
        "signal_type": sig_type, "direction": direction,
        "confidence": confidence, "score": score,
        "rationale": rationale, "risk_params": risk,
    }


def _rule_based_fallback(
    state: SignalState, ind: dict, asset_cls: str
) -> tuple[str, str, float, float, str]:
    """Deterministic fallback when LLM is unavailable."""
    rsi      = ind.get("rsi", 50)
    trend    = ind.get("trend", "up")
    ma_cross = ind.get("ma_cross")
    regime   = ind.get("regime", "unknown")
    oi_interp = ind.get("oi_interpretation")

    if asset_cls == "fo" and oi_interp:
        if oi_interp == "long_buildup":
            return "buy", "long", 0.55, 0.4, "Long build-up: OI rising with price. Rule-based."
        if oi_interp == "short_buildup":
            return "sell", "short", 0.55, -0.4, "Short build-up: OI rising with falling price. Rule-based."
        if oi_interp == "short_covering":
            return "buy", "long", 0.50, 0.3, "Short covering: OI falling, price rising. Rule-based."

    if asset_cls == "mf":
        momentum = ind.get("dual_momentum", 0)
        if momentum and momentum > 10:
            return "buy_more", "long", 0.55, 0.4, f"Strong dual momentum ({momentum:.1f}%). Rule-based."
        if momentum and momentum < -10:
            return "reduce", "neutral", 0.50, -0.3, f"Negative dual momentum ({momentum:.1f}%). Rule-based."
        return "hold", "neutral", 0.40, 0.0, "Neutral momentum — continue SIP. Rule-based."

    if rsi < 35 and trend == "up":
        return "buy", "long", 0.55, 0.4, f"RSI oversold ({rsi:.1f}) + uptrend. Rule-based."
    if rsi > 65 and trend == "down":
        return "sell", "short", 0.55, -0.4, f"RSI overbought ({rsi:.1f}) + downtrend. Rule-based."
    if ma_cross == "golden":
        return "buy", "long", 0.50, 0.3, "Golden cross (MA cross up). Rule-based."
    if ma_cross == "death":
        return "sell", "short", 0.50, -0.3, "Death cross (MA cross down). Rule-based."
    if regime == "volatile":
        return "hold", "neutral", 0.25, 0.0, "High volatility regime — no action. Rule-based."
    return "hold", "neutral", 0.30, 0.0, "No strong signal. Rule-based."


# ── Node 4: persist_signal (upsert to avoid duplicates) ──────────────────────

async def persist_signal(state: SignalState) -> dict:
    tomorrow = date.today() + timedelta(days=1)
    while tomorrow.weekday() >= 5:
        tomorrow += timedelta(days=1)
    expires_at = datetime.combine(tomorrow, datetime.min.time()).replace(
        hour=15, minute=30, tzinfo=timezone.utc
    ).isoformat()

    franchise_id  = state.get("franchise_id")
    owner_user_id = state.get("owner_user_id")
    if (not franchise_id or not owner_user_id) and state.get("portfolio_id"):
        try:
            db = get_supabase()
            p = (
                db.schema("markets").from_("portfolios")
                .select("franchise_id, owner_user_id")
                .eq("id", state["portfolio_id"])
                .maybe_single().execute()
            )
            if p.data:
                franchise_id  = franchise_id  or p.data.get("franchise_id")
                owner_user_id = owner_user_id or p.data.get("owner_user_id")
        except Exception:
            pass

    horizon   = state.get("horizon", HORIZON_MEDIUM)
    asset_cls = state.get("asset_class", "equity")

    row = {
        "instrument_id":   state["instrument_id"],
        "tenant_id":       state["tenant_id"],
        "franchise_id":    franchise_id,
        "owner_user_id":   owner_user_id,
        "portfolio_id":    state.get("portfolio_id"),
        "signal_type":     state["signal_type"],
        "direction":       state["direction"],
        "confidence":      state["confidence"],
        "score":           state["score"],
        "rationale":       state["rationale"],
        "price_at_signal": state.get("indicators", {}).get("ltp")
                           or state.get("indicators", {}).get("ltp_nav"),
        "expires_at":      expires_at,
        "generated_by":    "langgraph-v2",
        # New dedicated columns
        "asset_class":     asset_cls,
        "instrument_type": state.get("instrument_type", "EQ"),
        "horizon":         horizon,
        "risk_params":     state.get("risk_params", {}),
        "metadata": {
            "indicators":            state.get("indicators", {}),
            "symbol":                state["symbol"],
            "exchange":              state["exchange"],
            "holding_period_days":   state.get("holding_period_days"),
        },
    }

    try:
        db  = get_supabase()
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()

        # Delete today's signal for this exact (instrument, portfolio, horizon) before
        # inserting the fresh one.  This is the primary dedup path; the unique index
        # signals_portfolio_daily_dedup acts as a safety net for concurrent runs.
        del_q = (
            db.schema("markets").from_("signals").delete()
            .eq("instrument_id", state["instrument_id"])
            .gte("ts", today_start)
        )
        if state.get("portfolio_id"):
            del_q = del_q.eq("portfolio_id", state["portfolio_id"])
        if horizon:
            del_q = del_q.eq("horizon", horizon)
        del_q.execute()

        # Insert the fresh signal; ON CONFLICT DO UPDATE handles any race condition
        # between concurrent worker runs thanks to the unique index.
        db.schema("markets").from_("signals").upsert(
            row,
            on_conflict="instrument_id,portfolio_id,horizon,date_trunc('day', ts AT TIME ZONE 'UTC')",
            ignore_duplicates=False,
        ).execute()

        logger.info("persist_signal.ok", symbol=state["symbol"],
                    signal=state["signal_type"], confidence=state["confidence"],
                    asset_cls=asset_cls, horizon=horizon)
    except Exception as exc:
        logger.warning("persist_signal.failed", symbol=state["symbol"], error=str(exc))

    return {}


# ── Routing helpers ───────────────────────────────────────────────────────────

def _derive_horizon(holding_period_days: int | None, instrument_type: str) -> str:
    if instrument_type in ("OPT", "CE", "PE"):
        return HORIZON_SHORT  # options are inherently short-dated
    if instrument_type == "FUT":
        return HORIZON_SHORT
    if holding_period_days is None:
        return HORIZON_MEDIUM
    if holding_period_days == 0:
        return HORIZON_INTRADAY
    if holding_period_days <= 30:
        return HORIZON_SHORT
    if holding_period_days <= 180:
        return HORIZON_MEDIUM
    return HORIZON_LONG

def _derive_asset_class(instrument_type: str, asset_class_db: str) -> str:
    """Map instruments.asset_class + instrument_type to internal class key."""
    it = (instrument_type or "").upper()
    ac = (asset_class_db or "equity").lower()
    if it in ("FUT", "OPT", "CE", "PE"):
        return "fo"
    if ac == "mf" or it == "MF":
        return "mf"
    if ac in ("fx", "currency") or it == "CURRENCY":
        return "fx"
    if ac in ("bond", "gsec", "tbill") or it in ("BOND", "GB"):
        return "bond"
    if ac == "commodity" or it in ("COMM", "MCX"):
        return "commodity"
    return "equity"

def _route_to_compute(state: SignalState) -> str:
    return {
        "fo":        "compute_fo",
        "mf":        "compute_mf",
        "fx":        "compute_fx",
        "bond":      "compute_bond",
        "commodity": "compute_commodity",
    }.get(state.get("asset_class", "equity"), "compute_equity")

def _should_continue(state: SignalState) -> str:
    if state.get("error") and not state.get("prices"):
        return END
    return _route_to_compute(state)


# ── Graph assembly ────────────────────────────────────────────────────────────

def build_signal_graph() -> Any:
    g = StateGraph(SignalState)

    g.add_node("fetch_data",         fetch_data)
    g.add_node("compute_equity",     compute_equity)
    g.add_node("compute_fo",         compute_fo)
    g.add_node("compute_mf",         compute_mf)
    g.add_node("compute_fx",         compute_fx)
    g.add_node("compute_bond",       compute_bond)
    g.add_node("compute_commodity",  compute_commodity)
    g.add_node("score_signal",       score_signal)
    g.add_node("persist_signal",     persist_signal)

    g.set_entry_point("fetch_data")
    g.add_conditional_edges("fetch_data", _should_continue)

    for compute_node in ("compute_equity", "compute_fo", "compute_mf",
                         "compute_fx", "compute_bond", "compute_commodity"):
        g.add_edge(compute_node, "score_signal")

    g.add_edge("score_signal",   "persist_signal")
    g.add_edge("persist_signal", END)

    return g.compile()


signal_graph = build_signal_graph()


# ── RQ job entrypoints ────────────────────────────────────────────────────────

async def _run_for_instrument(
    instrument_id:    str,
    symbol:           str,
    exchange:         str,
    instrument_type:  str,
    asset_class_db:   str,
    option_type:      str | None,
    expiry:           str | None,
    strike:           float | None,
    underlying_id:    str | None,
    lot_size:         int | None,
    portfolio_id:     str | None,
    tenant_id:        str | None,
    franchise_id:     str | None,
    owner_user_id:    str | None,
) -> dict:
    asset_cls = _derive_asset_class(instrument_type, asset_class_db)
    horizon   = _derive_horizon(None, instrument_type)  # refined after fetch

    initial: SignalState = {
        "instrument_id":      instrument_id,
        "symbol":             symbol,
        "exchange":           exchange,
        "asset_class":        asset_cls,
        "instrument_type":    instrument_type,
        "option_type":        option_type,
        "expiry":             expiry,
        "strike":             strike,
        "underlying_id":      underlying_id,
        "lot_size":           lot_size,
        "portfolio_id":       portfolio_id,
        "tenant_id":          tenant_id,
        "franchise_id":       franchise_id,
        "owner_user_id":      owner_user_id,
        "avg_cost":           None,
        "qty":                None,
        "holding_period_days": None,
        "horizon":            horizon,
        "prices":             [],
        "prices_weekly":      [],
        "oi_series":          [],
        "nav_history":        [],
        "extra_data":         {},
        "indicators":         {},
        "signal_type":        "hold",
        "direction":          "neutral",
        "confidence":         0.0,
        "rationale":          "",
        "score":              0.0,
        "risk_params":        {},
        "error":              None,
    }
    result = await signal_graph.ainvoke(initial)
    # Refine horizon after fetch (holding_period_days is now populated)
    if result.get("holding_period_days") is not None:
        result["horizon"] = _derive_horizon(result["holding_period_days"], instrument_type)
    return result


def generate_signals_for_portfolio(portfolio_id: str) -> dict:
    """RQ job: generate enhanced multi-asset signals for all holdings."""
    import asyncio
    from markets_worker.feature_flags import flags

    db = get_supabase()

    # Resolve tenant context for feature-flag checks
    portfolio_row = (
        db.schema("markets").from_("portfolios")
        .select("tenant_id, franchise_id")
        .eq("id", portfolio_id).maybe_single().execute()
    )
    tenant_id    = (portfolio_row.data or {}).get("tenant_id")
    franchise_id = (portfolio_row.data or {}).get("franchise_id")

    # Top-level gate: signals feature must be enabled
    if not flags.enabled("markets.signals.enabled",
                         tenant_id=tenant_id, franchise_id=franchise_id):
        logger.info("generate_signals.feature_disabled", portfolio_id=portfolio_id)
        return {"generated": 0, "portfolio_id": portfolio_id, "reason": "feature_disabled"}

    holdings_res = (
        db.schema("markets").from_("holdings")
        .select(
            "instrument_id, qty, avg_cost, tenant_id, franchise_id, owner_user_id, "
            "instruments!inner(symbol, exchange, instrument_type, asset_class, "
            "option_type, expiry, strike, underlying_id, lot_size)"
        )
        .eq("portfolio_id", portfolio_id)
        .gt("qty", 0)
        .execute()
    )
    holdings = holdings_res.data or []
    if not holdings:
        logger.info("generate_signals.no_holdings", portfolio_id=portfolio_id)
        return {"generated": 0, "portfolio_id": portfolio_id}

    # Resolve asset-class gates once for this batch
    fo_enabled   = flags.enabled("markets.signals.fo_enabled",
                                 tenant_id=tenant_id, franchise_id=franchise_id)
    comm_enabled = flags.enabled("markets.signals.commodities_enabled",
                                 tenant_id=tenant_id, franchise_id=franchise_id)

    results = []
    for h in holdings:
        instr = h.get("instruments") or {}
        instr_type = instr.get("instrument_type", "EQ")
        asset_cls  = _derive_asset_class(instr_type, instr.get("asset_class", "equity"))

        # Skip asset classes whose flag is off
        if asset_cls == "fo"        and not fo_enabled:
            logger.debug("signal_skip.flag_off", symbol=instr.get("symbol"), asset_cls="fo"); continue
        if asset_cls == "commodity" and not comm_enabled:
            logger.debug("signal_skip.flag_off", symbol=instr.get("symbol"), asset_cls="commodity"); continue

        try:
            result = asyncio.run(_run_for_instrument(
                instrument_id   = h["instrument_id"],
                symbol          = instr.get("symbol", ""),
                exchange        = instr.get("exchange", ""),
                instrument_type = instr_type,
                asset_class_db  = instr.get("asset_class", "equity"),
                option_type     = instr.get("option_type"),
                expiry          = instr.get("expiry"),
                strike          = float(instr["strike"]) if instr.get("strike") else None,
                underlying_id   = instr.get("underlying_id"),
                lot_size        = instr.get("lot_size"),
                portfolio_id    = portfolio_id,
                tenant_id       = h.get("tenant_id"),
                franchise_id    = h.get("franchise_id"),
                owner_user_id   = h.get("owner_user_id"),
            ))
            results.append({
                "symbol":     instr.get("symbol"),
                "asset_cls":  _derive_asset_class(instr.get("instrument_type","EQ"), instr.get("asset_class","equity")),
                "horizon":    result.get("horizon"),
                "signal":     result.get("signal_type"),
                "confidence": result.get("confidence"),
                "risk":       result.get("risk_params"),
            })
            logger.info("signal_generated", **{k: v for k, v in results[-1].items() if k != "risk"})
        except Exception as exc:
            logger.error("signal_failed", symbol=instr.get("symbol"), error=str(exc))

    return {
        "generated":   len(results),
        "portfolio_id": portfolio_id,
        "signals":     results,
    }


def generate_signals_for_watchlist(watchlist_id: str, owner_user_id: str,
                                    tenant_id: str, franchise_id: str) -> dict:
    """RQ job: generate signals for all instruments in a watchlist."""
    import asyncio

    db = get_supabase()
    items_res = (
        db.schema("markets").from_("watchlist_items")
        .select("instrument_id, instruments!inner(symbol, exchange, instrument_type, "
                "asset_class, option_type, expiry, strike, underlying_id, lot_size)")
        .eq("watchlist_id", watchlist_id)
        .execute()
    )
    items = items_res.data or []
    if not items:
        return {"generated": 0, "watchlist_id": watchlist_id}

    results = []
    for item in items:
        instr = item.get("instruments") or {}
        try:
            result = asyncio.run(_run_for_instrument(
                instrument_id   = item["instrument_id"],
                symbol          = instr.get("symbol", ""),
                exchange        = instr.get("exchange", ""),
                instrument_type = instr.get("instrument_type", "EQ"),
                asset_class_db  = instr.get("asset_class", "equity"),
                option_type     = instr.get("option_type"),
                expiry          = instr.get("expiry"),
                strike          = float(instr["strike"]) if instr.get("strike") else None,
                underlying_id   = instr.get("underlying_id"),
                lot_size        = instr.get("lot_size"),
                portfolio_id    = None,
                tenant_id       = tenant_id,
                franchise_id    = franchise_id,
                owner_user_id   = owner_user_id,
            ))
            results.append({
                "symbol":     instr.get("symbol"),
                "signal":     result.get("signal_type"),
                "confidence": result.get("confidence"),
            })
        except Exception as exc:
            logger.error("signal_failed", symbol=instr.get("symbol"), error=str(exc))

    return {"generated": len(results), "watchlist_id": watchlist_id, "signals": results}
