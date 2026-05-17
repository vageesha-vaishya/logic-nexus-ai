"""
Chart data endpoints.

GET /v1/chart/{symbol}   — OHLCV + optional MA + optional indicators for a symbol
  Query params:
    exchange   (str, default "NSE")
    interval   (str, default "1d") — 1m | 5m | 15m | 1h | 1d | 1w
    lookback   (int, default 365)  — calendar days to look back (daily); ignored for intraday
    from_date  (str, optional)     — ISO date e.g. 2025-01-01 (overrides lookback)
    to_date    (str, optional)     — ISO date (default today)
    ma         (str, default "")   — comma-separated MA periods e.g. "20,50,200"
    indicators (str, default "")   — comma-separated: bb,vwap,supertrend,ha
"""
from __future__ import annotations

import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query

from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/chart")

# ── In-memory cache for intraday data (5-min TTL) ────────────────────────────
_intraday_cache: dict[str, tuple[float, list[dict]]] = {}
_INTRADAY_TTL = 300  # seconds

# ── Interval → yfinance interval mapping ─────────────────────────────────────
_YF_INTERVAL = {
    "1m":  "1m",
    "5m":  "5m",
    "15m": "15m",
    "30m": "30m",
    "1h":  "1h",
    "1d":  "1d",
    "1w":  "1wk",
    "1mo": "1mo",
}

# ── yfinance period for intraday intervals ────────────────────────────────────
_YF_INTRADAY_PERIOD = {
    "1m":  "7d",
    "5m":  "60d",
    "15m": "60d",
    "30m": "60d",
    "1h":  "730d",
}


@router.get("/{symbol}")
async def get_chart(
    symbol:     str,
    exchange:   str = Query("NSE"),
    interval:   str = Query("1d"),
    lookback:   int = Query(365, ge=1, le=1825),
    from_date:  str = Query(""),
    to_date:    str = Query(""),
    ma:         str = Query(""),
    indicators: str = Query("", description="Comma-separated: bb,vwap,supertrend,ha"),
):
    """
    Return OHLCV bars for a symbol.

    For daily/weekly: reads from markets.price_history (fast, no external call).
    For intraday (1m-1h): fetches from yfinance with 5-min in-memory cache.

    Response shape:
    {
      "symbol": "RELIANCE",
      "exchange": "NSE",
      "interval": "1d",
      "bars": [{"time": "2024-05-16", "open": 2400.0, "high": 2450.0, "low": 2380.0,
                "close": 2430.0, "volume": 1200000}, ...],
      "ma": {
        "20":  [{"time": "2024-05-16", "value": 2410.0}, ...],
        "50":  [...],
        "200": [...],
      },
      "count": 365,
      "bollinger": {"upper": [...], "middle": [...], "lower": [...]},  // if bb requested
      "vwap": [...],                                                     // if vwap requested
      "supertrend": [{"time": ..., "value": ..., "direction": "up"|"down"}, ...],  // if supertrend
    }
    """
    sym = symbol.upper().strip()
    exch = exchange.upper().strip()
    interval = interval.lower().strip()

    if interval not in _YF_INTERVAL:
        raise HTTPException(400, detail=f"Unsupported interval '{interval}'. Use: {', '.join(_YF_INTERVAL)}")

    is_intraday = interval in ("1m", "5m", "15m", "30m", "1h")

    # Parse date range
    today = date.today()
    if from_date:
        try:
            dt_from = date.fromisoformat(from_date)
        except ValueError:
            raise HTTPException(400, detail="Invalid from_date — use ISO format YYYY-MM-DD")
    else:
        dt_from = today - timedelta(days=lookback)

    if to_date:
        try:
            dt_to = date.fromisoformat(to_date)
        except ValueError:
            raise HTTPException(400, detail="Invalid to_date — use ISO format YYYY-MM-DD")
    else:
        dt_to = today

    # Parse MA periods
    ma_periods: list[int] = []
    if ma:
        for p in ma.split(","):
            try:
                ma_periods.append(int(p.strip()))
            except ValueError:
                pass

    # Parse requested indicators
    requested: set[str] = set()
    if indicators:
        for ind in indicators.split(","):
            stripped = ind.strip().lower()
            if stripped:
                requested.add(stripped)

    # Fetch bars
    if is_intraday:
        bars = await _fetch_intraday(sym, exch, interval)
    else:
        bars = await _fetch_daily(sym, exch, interval, dt_from, dt_to)

    if not bars:
        raise HTTPException(
            404,
            detail=f"No chart data found for {sym} ({exch}). Try running a price sync first.",
        )

    # Heikin Ashi — transform bars before all other computations
    ha_bars: list[dict] | None = None
    if "ha" in requested:
        ha_bars = _heikin_ashi(bars)

    # Use HA bars as the response bars when HA is requested
    response_bars = ha_bars if ha_bars is not None else bars

    # Compute MAs (always on original bars for accuracy)
    ma_data: dict[str, list[dict]] = {}
    if ma_periods and bars:
        closes = [b["close"] for b in bars]
        times  = [b["time"]  for b in bars]
        for period in ma_periods:
            if period < len(closes):
                ma_values = _simple_ma(closes, period)
                ma_data[str(period)] = [
                    {"time": t, "value": round(v, 2)}
                    for t, v in zip(times[period - 1:], ma_values)
                    if v is not None
                ]

    # Build response
    response: dict[str, Any] = {
        "symbol":   sym,
        "exchange": exch,
        "interval": interval,
        "bars":     response_bars,
        "ma":       ma_data,
        "count":    len(response_bars),
    }

    # Bollinger Bands
    if "bb" in requested and bars:
        closes = [b["close"] for b in bars]
        times  = [b["time"]  for b in bars]
        bb = _bollinger_bands(closes)
        period = 20
        offset_times = times[period - 1:]
        response["bollinger"] = {
            "upper":  [{"time": t, "value": v} for t, v in zip(offset_times, bb["upper"])],
            "middle": [{"time": t, "value": v} for t, v in zip(offset_times, bb["middle"])],
            "lower":  [{"time": t, "value": v} for t, v in zip(offset_times, bb["lower"])],
        }

    # VWAP
    if "vwap" in requested and bars:
        vwap_vals = _vwap(bars)
        response["vwap"] = [
            {"time": b["time"], "value": v}
            for b, v in zip(bars, vwap_vals)
            if v is not None
        ]

    # SuperTrend
    if "supertrend" in requested and bars:
        response["supertrend"] = _supertrend_overlay(bars)

    return response


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _fetch_daily(sym: str, exch: str, interval: str, dt_from: date, dt_to: date) -> list[dict]:
    """Read daily/weekly OHLCV from markets.price_history."""
    import asyncio

    db = get_supabase()

    # Look up instrument_id
    instr = (
        db.schema("markets").from_("instruments")
        .select("id, metadata")
        .eq("symbol", sym)
        .eq("exchange", exch)
        .maybe_single()
        .execute()
    ).data

    if not instr:
        # Try without exchange filter (some instruments stored differently)
        instr = (
            db.schema("markets").from_("instruments")
            .select("id, metadata")
            .eq("symbol", sym)
            .limit(1)
            .execute()
        ).data
        if isinstance(instr, list) and instr:
            instr = instr[0]

    if not instr:
        # Fall through to yfinance
        return await _fetch_yfinance(sym, exch, interval, dt_from, dt_to)

    instrument_id = instr["id"] if isinstance(instr, dict) else instr[0]["id"]

    result = (
        db.schema("markets").from_("price_history")
        .select("ts, open, high, low, close, volume")
        .eq("instrument_id", instrument_id)
        .gte("ts", dt_from.isoformat())
        .lte("ts", dt_to.isoformat())
        .order("ts", desc=False)
        .execute()
    ).data or []

    if not result:
        # No data in DB — try yfinance
        return await _fetch_yfinance(sym, exch, interval, dt_from, dt_to)

    # Convert to Lightweight Charts format
    bars = []
    for r in result:
        try:
            ts_str = r["ts"]
            if isinstance(ts_str, str):
                # Handle "2024-05-16T00:00:00+00:00" or "2024-05-16 00:00:00+00"
                dt = datetime.fromisoformat(ts_str.replace(" ", "T"))
            else:
                dt = ts_str
            # For daily bars, Lightweight Charts accepts "YYYY-MM-DD" strings
            time_val = dt.strftime("%Y-%m-%d")
            bars.append({
                "time":   time_val,
                "open":   float(r["open"]),
                "high":   float(r["high"]),
                "low":    float(r["low"]),
                "close":  float(r["close"]),
                "volume": int(r["volume"] or 0),
            })
        except Exception as exc:
            logger.warning("chart.parse_row_failed", error=str(exc))
            continue

    # Weekly aggregation if interval == "1w"
    if interval == "1w" and bars:
        bars = _aggregate_weekly(bars)

    return bars


async def _fetch_intraday(sym: str, exch: str, interval: str) -> list[dict]:
    """Fetch intraday OHLCV from yfinance with 5-min in-memory cache."""
    cache_key = f"{sym}:{exch}:{interval}"
    now = time.monotonic()
    cached = _intraday_cache.get(cache_key)
    if cached and (now - cached[0]) < _INTRADAY_TTL:
        return cached[1]

    # NSE tickers need .NS suffix on Yahoo Finance
    ticker = f"{sym}.NS" if exch in ("NSE", "NFO") else f"{sym}.BO"
    period = _YF_INTRADAY_PERIOD.get(interval, "60d")
    yf_interval = _YF_INTERVAL[interval]

    import asyncio
    import yfinance as yf

    def _fetch():
        try:
            t = yf.Ticker(ticker)
            df = t.history(period=period, interval=yf_interval, auto_adjust=True)
            if df.empty and exch == "NSE":
                # Try BSE fallback
                t2 = yf.Ticker(f"{sym}.BO")
                df = t2.history(period=period, interval=yf_interval, auto_adjust=True)
            return df
        except Exception:
            return None

    df = await asyncio.to_thread(_fetch)
    if df is None or (hasattr(df, "empty") and df.empty):
        return []

    bars = []
    for idx, row in df.iterrows():
        try:
            # For intraday use UNIX timestamp
            if hasattr(idx, "timestamp"):
                time_val = int(idx.timestamp())
            else:
                time_val = int(idx.value // 1_000_000_000)
            bars.append({
                "time":   time_val,
                "open":   round(float(row["Open"]),   2),
                "high":   round(float(row["High"]),   2),
                "low":    round(float(row["Low"]),    2),
                "close":  round(float(row["Close"]),  2),
                "volume": int(row.get("Volume", 0) or 0),
            })
        except Exception:
            continue

    _intraday_cache[cache_key] = (now, bars)
    return bars


async def _fetch_yfinance(sym: str, exch: str, interval: str, dt_from: date, dt_to: date) -> list[dict]:
    """Fallback: fetch daily data from yfinance when not in DB."""
    import asyncio
    import yfinance as yf

    ticker = f"{sym}.NS" if exch in ("NSE", "NFO") else f"{sym}.BO"
    yf_interval = _YF_INTERVAL.get(interval, "1d")

    def _fetch():
        try:
            t = yf.Ticker(ticker)
            df = t.history(
                start=dt_from.isoformat(),
                end=(dt_to + timedelta(days=1)).isoformat(),
                interval=yf_interval,
                auto_adjust=True,
            )
            return df
        except Exception:
            return None

    df = await asyncio.to_thread(_fetch)
    if df is None or (hasattr(df, "empty") and df.empty):
        return []

    bars = []
    for idx, row in df.iterrows():
        try:
            if hasattr(idx, "date"):
                time_val = idx.date().isoformat()
            else:
                time_val = str(idx)[:10]
            bars.append({
                "time":   time_val,
                "open":   round(float(row["Open"]),   2),
                "high":   round(float(row["High"]),   2),
                "low":    round(float(row["Low"]),    2),
                "close":  round(float(row["Close"]),  2),
                "volume": int(row.get("Volume", 0) or 0),
            })
        except Exception:
            continue
    return bars


def _bollinger_bands(closes: list[float], period: int = 20, num_std: float = 2.0) -> dict[str, list[float]]:
    """Returns upper, middle, lower band series."""
    upper, middle, lower = [], [], []
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        mean = sum(window) / period
        variance = sum((x - mean) ** 2 for x in window) / period
        std = variance ** 0.5
        upper.append(round(mean + num_std * std, 2))
        middle.append(round(mean, 2))
        lower.append(round(mean - num_std * std, 2))
    return {"upper": upper, "middle": middle, "lower": lower}


def _vwap(bars: list[dict]) -> list[float | None]:
    """Volume Weighted Average Price — resets daily (session VWAP for intraday, cumulative for daily)."""
    result: list[float | None] = []
    cum_pv = 0.0
    cum_vol = 0.0
    for bar in bars:
        vol = bar.get("volume") or 0
        typical = (bar["high"] + bar["low"] + bar["close"]) / 3
        cum_pv += typical * vol
        cum_vol += vol
        result.append(round(cum_pv / cum_vol, 2) if cum_vol > 0 else None)
    return result


def _supertrend_overlay(bars: list[dict], period: int = 10, multiplier: float = 3.0) -> list[dict]:
    """Returns {time, value, direction} series for SuperTrend line."""
    if len(bars) < period + 1:
        return []
    closes = [b["close"] for b in bars]
    highs  = [b["high"]  for b in bars]
    lows   = [b["low"]   for b in bars]

    # ATR (Wilder)
    tr_list = [
        max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
        for i in range(1, len(closes))
    ]
    atr_vals = [sum(tr_list[:period]) / period]
    for t in tr_list[period:]:
        atr_vals.append((atr_vals[-1] * (period - 1) + t) / period)

    result: list[dict] = []
    direction = 1
    upper_band = 0.0
    lower_band = 0.0

    for i, atr in enumerate(atr_vals):
        idx = i + period
        if idx >= len(closes):
            break
        hl2 = (highs[idx] + lows[idx]) / 2
        upper = hl2 + multiplier * atr
        lower = hl2 - multiplier * atr
        if i == 0:
            upper_band, lower_band = upper, lower
        else:
            upper_band = upper if upper < upper_band or closes[idx - 1] > upper_band else upper_band
            lower_band = lower if lower > lower_band or closes[idx - 1] < lower_band else lower_band
        if closes[idx] > upper_band:
            direction = 1
        elif closes[idx] < lower_band:
            direction = -1
        result.append({
            "time":      bars[idx]["time"],
            "value":     round(lower_band if direction == 1 else upper_band, 2),
            "direction": "up" if direction == 1 else "down",
        })
    return result


def _heikin_ashi(bars: list[dict]) -> list[dict]:
    """Transform standard OHLC to Heikin Ashi candles."""
    ha_bars: list[dict] = []
    for i, bar in enumerate(bars):
        ha_close = round((bar["open"] + bar["high"] + bar["low"] + bar["close"]) / 4, 2)
        if i == 0:
            ha_open = round((bar["open"] + bar["close"]) / 2, 2)
        else:
            ha_open = round((ha_bars[-1]["open"] + ha_bars[-1]["close"]) / 2, 2)
        ha_high = round(max(bar["high"], ha_open, ha_close), 2)
        ha_low  = round(min(bar["low"],  ha_open, ha_close), 2)
        ha_bars.append({
            "time":   bar["time"],
            "open":   ha_open,
            "high":   ha_high,
            "low":    ha_low,
            "close":  ha_close,
            "volume": bar.get("volume", 0),
        })
    return ha_bars


def _simple_ma(closes: list[float], period: int) -> list[float | None]:
    """Simple moving average. Returns list aligned to closes starting at index (period-1)."""
    result = []
    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        result.append(sum(window) / period)
    return result


def _aggregate_weekly(daily_bars: list[dict]) -> list[dict]:
    """Aggregate daily bars into weekly OHLCV (week keyed by Monday)."""
    from datetime import date as _date

    weeks: dict[str, dict] = {}
    for bar in daily_bars:
        try:
            d = _date.fromisoformat(bar["time"])
            # Week key = Monday of the week
            monday = d - timedelta(days=d.weekday())
            key = monday.isoformat()
            if key not in weeks:
                weeks[key] = {
                    "time":   key,
                    "open":   bar["open"],
                    "high":   bar["high"],
                    "low":    bar["low"],
                    "close":  bar["close"],
                    "volume": bar["volume"],
                }
            else:
                weeks[key]["high"]    = max(weeks[key]["high"],  bar["high"])
                weeks[key]["low"]     = min(weeks[key]["low"],   bar["low"])
                weeks[key]["close"]   = bar["close"]
                weeks[key]["volume"] += bar["volume"]
        except Exception:
            continue
    return sorted(weeks.values(), key=lambda x: x["time"])
