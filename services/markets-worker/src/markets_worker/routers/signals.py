"""
Signal computation router — Phase 2 intraday signal engine.

GET /v1/signals/compute/{symbol}?exchange=NSE&lookback=120
    Compute fresh RSI / MACD / SuperTrend for a symbol, store in
    markets.signals, return the aggregated result.

GET /v1/signals/summary?symbols=RELIANCE,TCS&exchange=NSE
    Batch: compute/fetch cached signals for multiple symbols (watchlist).
    Module-level in-memory cache with 15-minute TTL.
"""

from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query

from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/signals", tags=["signals"])

# ── Module-level 15-min cache for summary endpoint ────────────────────────────
# { "<SYMBOL>:<EXCHANGE>" : (computed_at_ts, result_dict) }
_summary_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 15 * 60  # 15 minutes


# ── Pure-Python technical indicators ─────────────────────────────────────────

def _ema(values: list[float], period: int) -> list[float]:
    """Exponential moving average."""
    k = 2 / (period + 1)
    result = [values[0]]
    for v in values[1:]:
        result.append(v * k + result[-1] * (1 - k))
    return result


def compute_rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 2:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains  = [max(d, 0) for d in deltas]
    losses = [max(-d, 0) for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - 100 / (1 + rs), 2)


def compute_macd(
    closes: list[float],
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> dict | None:
    if len(closes) < slow + signal_period:
        return None
    ema_fast = _ema(closes, fast)
    ema_slow = _ema(closes, slow)
    macd_line   = [f - s for f, s in zip(ema_fast[slow - 1:], ema_slow[slow - 1:])]
    signal_line = _ema(macd_line, signal_period)
    histogram   = [m - s for m, s in zip(macd_line[signal_period - 1:], signal_line[signal_period - 1:])]
    if not histogram:
        return None
    crossover: str
    if len(histogram) >= 2 and histogram[-2] < 0 <= histogram[-1]:
        crossover = "bullish"
    elif len(histogram) >= 2 and histogram[-2] > 0 >= histogram[-1]:
        crossover = "bearish"
    else:
        crossover = "none"
    return {
        "macd":      round(macd_line[-1],   4),
        "signal":    round(signal_line[-1], 4),
        "histogram": round(histogram[-1],   4),
        "crossover": crossover,
    }


def compute_supertrend(
    highs:  list[float],
    lows:   list[float],
    closes: list[float],
    period: int = 10,
    multiplier: float = 3.0,
) -> dict | None:
    if len(closes) < period + 1:
        return None
    # True Range
    tr_list: list[float] = []
    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        tr_list.append(tr)
    # Wilder ATR
    atr: list[float] = [sum(tr_list[:period]) / period]
    for t in tr_list[period:]:
        atr.append((atr[-1] * (period - 1) + t) / period)

    direction = 1  # 1=up, -1=down
    upper_band = lower_band = 0.0
    for i in range(len(atr)):
        idx = i + period
        if idx >= len(closes):
            break
        hl2 = (highs[idx] + lows[idx]) / 2
        upper = hl2 + multiplier * atr[i]
        lower = hl2 - multiplier * atr[i]
        if i == 0:
            upper_band, lower_band = upper, lower
        else:
            upper_band = upper if upper < upper_band or closes[idx - 1] > upper_band else upper_band
            lower_band = lower if lower > lower_band or closes[idx - 1] < lower_band else lower_band
        if closes[idx] > upper_band:
            direction = 1
        elif closes[idx] < lower_band:
            direction = -1

    return {
        "direction":  "up"   if direction == 1 else "down",
        "upper_band": round(upper_band, 2),
        "lower_band": round(lower_band, 2),
        "signal":     "buy"  if direction == 1 else "sell",
    }


# ── Signal aggregation ────────────────────────────────────────────────────────

def _aggregate_signal(
    rsi:  float | None,
    macd: dict | None,
    st:   dict | None,
) -> dict:
    """Combine RSI + MACD + SuperTrend into a single direction + strength."""
    buy_signals  = 0
    sell_signals = 0
    reasons: list[str] = []

    if rsi is not None:
        if rsi < 30:
            buy_signals += 2
            reasons.append(f"RSI {rsi:.1f} — oversold")
        elif rsi < 45:
            buy_signals += 1
            reasons.append(f"RSI {rsi:.1f} — approaching oversold")
        elif rsi > 70:
            sell_signals += 2
            reasons.append(f"RSI {rsi:.1f} — overbought")
        elif rsi > 55:
            sell_signals += 1
            reasons.append(f"RSI {rsi:.1f} — approaching overbought")

    if macd is not None:
        if macd["crossover"] == "bullish":
            buy_signals += 2
            reasons.append("MACD bullish crossover")
        elif macd["crossover"] == "bearish":
            sell_signals += 2
            reasons.append("MACD bearish crossover")
        elif macd["histogram"] > 0:
            buy_signals += 1
            reasons.append("MACD histogram positive")
        elif macd["histogram"] < 0:
            sell_signals += 1
            reasons.append("MACD histogram negative")

    if st is not None:
        if st["signal"] == "buy":
            buy_signals += 2
            reasons.append(f"SuperTrend bullish (above ₹{st['lower_band']})")
        else:
            sell_signals += 2
            reasons.append(f"SuperTrend bearish (below ₹{st['upper_band']})")

    total = buy_signals + sell_signals
    if total == 0:
        direction, confidence = "neutral", 0.5
    elif buy_signals > sell_signals:
        direction  = "buy"
        confidence = round(min(buy_signals / (total * 0.7), 1.0), 2)
    else:
        direction  = "sell"
        confidence = round(min(sell_signals / (total * 0.7), 1.0), 2)

    return {
        "direction":  direction,
        "confidence": confidence,
        "score":      round(confidence * 100),
        "rationale":  "; ".join(reasons) or "No strong signal",
        "indicators": {
            "rsi":        rsi,
            "macd":       macd,
            "supertrend": st,
        },
    }


# ── DB helpers ────────────────────────────────────────────────────────────────

def _fetch_price_history(
    instrument_id: str,
    lookback: int,
) -> dict[str, list]:
    """Return lists of open/high/low/close/volume for the last `lookback` bars."""
    db = get_supabase()
    result = (
        db.schema("markets")
        .from_("price_history")
        .select("ts, open, high, low, close, volume")
        .eq("instrument_id", instrument_id)
        .order("ts", desc=False)
        .limit(lookback)
        .execute()
    )
    rows = result.data or []
    return {
        "opens":   [float(r["open"])   for r in rows],
        "highs":   [float(r["high"])   for r in rows],
        "lows":    [float(r["low"])    for r in rows],
        "closes":  [float(r["close"])  for r in rows],
        "volumes": [float(r["volume"]) for r in rows],
    }


def _resolve_instrument(symbol: str, exchange: str) -> dict | None:
    db = get_supabase()
    result = (
        db.schema("markets")
        .from_("instruments")
        .select("id, symbol, exchange")
        .eq("symbol", symbol.upper())
        .eq("exchange", exchange.upper())
        .maybe_single()
        .execute()
    )
    return result.data


def _upsert_signal(instrument_id: str, agg: dict, last_close: float | None) -> str:
    """Upsert aggregated signal into markets.signals; return the row id."""
    from datetime import datetime, timezone, timedelta

    db = get_supabase()
    now_iso = datetime.now(timezone.utc).isoformat()
    expires_iso = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()

    direction  = agg["direction"]
    signal_type_map = {"buy": "buy", "sell": "sell", "neutral": "hold"}
    signal_type = signal_type_map.get(direction, "hold")

    payload: dict[str, Any] = {
        "instrument_id":   instrument_id,
        "strategy_id":     "rsi_macd_supertrend",
        "signal_type":     signal_type,
        "direction":       "long" if direction == "buy" else ("short" if direction == "sell" else "neutral"),
        "confidence":      agg["confidence"],
        "score":           float(agg["score"]) / 100,
        "rationale":       agg["rationale"],
        "generated_by":    "technical_indicators",
        "expires_at":      expires_iso,
        "ts":              now_iso,
        "metadata": {
            "indicators": agg["indicators"],
        },
    }
    if last_close is not None:
        payload["price_at_signal"] = last_close

    result = (
        db.schema("markets")
        .from_("signals")
        .upsert(
            payload,
            on_conflict="instrument_id,strategy_id",
        )
        .execute()
    )
    rows = result.data or []
    return rows[0]["id"] if rows else ""


# ── Shared computation logic ──────────────────────────────────────────────────

def _compute_for_instrument(
    instrument_id: str,
    symbol: str,
    exchange: str,
    lookback: int,
    store: bool = True,
) -> dict:
    """Fetch price history, compute indicators, aggregate, optionally upsert."""
    bars = _fetch_price_history(instrument_id, lookback)
    closes = bars["closes"]
    highs  = bars["highs"]
    lows   = bars["lows"]

    if not closes:
        raise HTTPException(
            status_code=422,
            detail=f"No price history found for {symbol} ({exchange}). Ingest prices first.",
        )

    rsi  = compute_rsi(closes)
    macd = compute_macd(closes)
    st   = compute_supertrend(highs, lows, closes)
    agg  = _aggregate_signal(rsi, macd, st)

    last_close = closes[-1] if closes else None

    signal_id: str | None = None
    if store:
        try:
            signal_id = _upsert_signal(instrument_id, agg, last_close)
        except Exception as exc:
            logger.warning("signal_upsert_failed", symbol=symbol, error=str(exc))

    from datetime import datetime, timezone
    return {
        "symbol":       symbol,
        "exchange":     exchange,
        "instrument_id": instrument_id,
        "signal_id":    signal_id,
        "direction":    agg["direction"],
        "confidence":   agg["confidence"],
        "score":        agg["score"],
        "rationale":    agg["rationale"],
        "indicators":   agg["indicators"],
        "bars_used":    len(closes),
        "computed_at":  datetime.now(timezone.utc).isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/compute/{symbol}")
async def compute_signal(
    symbol:   str,
    exchange: str = Query(default="NSE"),
    lookback: int = Query(default=120, ge=30, le=500),
) -> dict:
    """Compute RSI/MACD/SuperTrend for a symbol and persist to markets.signals."""
    instrument = _resolve_instrument(symbol, exchange)
    if instrument is None:
        raise HTTPException(
            status_code=404,
            detail=f"Instrument {symbol} not found on {exchange}. "
                   "Import it via the instruments admin page first.",
        )

    result = _compute_for_instrument(
        instrument_id=instrument["id"],
        symbol=symbol.upper(),
        exchange=exchange.upper(),
        lookback=lookback,
        store=True,
    )
    return result


@router.get("/summary")
async def signals_summary(
    symbols:  str = Query(..., description="Comma-separated symbols, e.g. RELIANCE,TCS"),
    exchange: str = Query(default="NSE"),
    lookback: int = Query(default=120, ge=30, le=500),
) -> dict:
    """
    Batch compute/fetch cached signals for multiple symbols.
    Results are cached per symbol for 15 minutes to avoid hammering the DB.
    """
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not sym_list:
        raise HTTPException(status_code=400, detail="No symbols provided")

    now = time.monotonic()
    results: list[dict] = []
    errors:  list[dict] = []

    for sym in sym_list:
        cache_key = f"{sym}:{exchange.upper()}"
        cached = _summary_cache.get(cache_key)
        if cached is not None and (now - cached[0]) < _CACHE_TTL:
            results.append(cached[1])
            continue

        try:
            instrument = _resolve_instrument(sym, exchange)
            if instrument is None:
                errors.append({"symbol": sym, "error": "instrument_not_found"})
                continue

            result = _compute_for_instrument(
                instrument_id=instrument["id"],
                symbol=sym,
                exchange=exchange.upper(),
                lookback=lookback,
                store=True,
            )
            _summary_cache[cache_key] = (now, result)
            results.append(result)
        except HTTPException as exc:
            errors.append({"symbol": sym, "error": exc.detail})
        except Exception as exc:
            logger.warning("summary_compute_error", symbol=sym, error=str(exc))
            errors.append({"symbol": sym, "error": str(exc)})

    return {
        "results": results,
        "errors":  errors,
        "total":   len(sym_list),
        "computed": len(results),
    }
