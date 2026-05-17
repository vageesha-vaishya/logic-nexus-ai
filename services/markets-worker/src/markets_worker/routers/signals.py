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


@router.post("/backtest/{symbol}")
async def backtest_signal(
    symbol: str,
    exchange: str = Query(default="NSE"),
    lookback: int = Query(default=252, ge=30, le=504),
) -> dict:
    """Walk-forward backtest of the RSI+MACD+SuperTrend signal on historical data."""
    import asyncio
    from datetime import datetime, timezone

    instrument = _resolve_instrument(symbol, exchange)
    if instrument is None:
        raise HTTPException(
            status_code=404,
            detail=f"Instrument {symbol} not found on {exchange}. "
                   "Import it via the instruments admin page first.",
        )

    # Fetch total bars needed: lookback + 200 warm-up days
    total_bars = lookback + 200

    db = get_supabase()
    result = (
        db.schema("markets")
        .from_("price_history")
        .select("ts, open, high, low, close, volume")
        .eq("instrument_id", instrument["id"])
        .order("ts", desc=False)
        .limit(total_bars)
        .execute()
    )
    rows = result.data or []

    if len(rows) < 150:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient price history for {symbol}. Need at least 150 bars.",
        )

    opens  = [float(r["open"])  for r in rows]
    highs  = [float(r["high"])  for r in rows]
    lows   = [float(r["low"])   for r in rows]
    closes = [float(r["close"]) for r in rows]
    dates  = [r["ts"][:10] for r in rows]

    def _run_backtest() -> dict:
        warm_up = 120
        signals_list: list[dict] = []
        wins = 0
        losses = 0
        returns_1d: list[float] = []
        returns_5d: list[float] = []

        for i in range(warm_up, len(closes) - 1):
            c_slice = closes[:i + 1]
            h_slice = highs[:i + 1]
            l_slice = lows[:i + 1]

            rsi  = compute_rsi(c_slice)
            macd = compute_macd(c_slice)
            st   = compute_supertrend(h_slice, l_slice, c_slice)
            agg  = _aggregate_signal(rsi, macd, st)

            direction = agg["direction"]
            if direction == "neutral":
                continue

            entry_price = closes[i]
            next_1d = closes[i + 1] if i + 1 < len(closes) else None
            next_5d = closes[i + 5] if i + 5 < len(closes) else None

            pct_1d: float | None = None
            outcome = "pending"

            if next_1d is not None and entry_price > 0:
                pct_1d = round((next_1d - entry_price) / entry_price * 100, 3)
                was_correct = (
                    (direction == "buy"  and next_1d > entry_price) or
                    (direction == "sell" and next_1d < entry_price)
                )
                outcome = "win" if was_correct else "loss"
                if was_correct:
                    wins += 1
                else:
                    losses += 1
                returns_1d.append(pct_1d)

            pct_5d: float | None = None
            if next_5d is not None and entry_price > 0:
                pct_5d = round((next_5d - entry_price) / entry_price * 100, 3)
                returns_5d.append(pct_5d)

            signals_list.append({
                "date":        dates[i],
                "direction":   direction,
                "confidence":  agg["confidence"],
                "entry_price": round(entry_price, 2),
                "next_1d":     round(next_1d, 2) if next_1d is not None else None,
                "next_5d":     round(next_5d, 2) if next_5d is not None else None,
                "outcome":     outcome,
                "pct_1d":      pct_1d,
            })

        total = wins + losses
        win_rate    = round(wins / total * 100, 2) if total > 0 else 0.0
        avg_1d_pct  = round(sum(returns_1d) / len(returns_1d), 3) if returns_1d else 0.0
        avg_5d_pct  = round(sum(returns_5d) / len(returns_5d), 3) if returns_5d else 0.0
        best_pct    = round(max(returns_1d), 3) if returns_1d else 0.0
        worst_pct   = round(min(returns_1d), 3) if returns_1d else 0.0

        # Return last 50 signals only
        output_signals = signals_list[-50:]

        return {
            "symbol":   symbol.upper(),
            "exchange": exchange.upper(),
            "lookback": lookback,
            "metrics": {
                "total":      total,
                "wins":       wins,
                "losses":     losses,
                "win_rate":   win_rate,
                "avg_1d_pct": avg_1d_pct,
                "avg_5d_pct": avg_5d_pct,
                "best_pct":   best_pct,
                "worst_pct":  worst_pct,
            },
            "signals":     output_signals,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }

    loop = asyncio.get_event_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(None, _run_backtest),
            timeout=45.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(504, detail="Backtest timed out — try a shorter lookback period.")


# ── Scanner ───────────────────────────────────────────────────────────────────

# { "<filters_key>:<match>" : (cached_at_ts, response_dict) }
_scanner_cache: dict[str, tuple[float, dict]] = {}
_SCANNER_TTL = 300.0  # 5 minutes

FILTER_DESCRIPTIONS: dict[str, str] = {
    "rsi_oversold":    "RSI < 30 — oversold, potential bounce",
    "rsi_overbought":  "RSI > 70 — overbought, potential correction",
    "macd_bullish":    "MACD bullish crossover — momentum turning up",
    "macd_bearish":    "MACD bearish crossover — momentum turning down",
    "supertrend_buy":  "SuperTrend bullish — uptrend confirmed",
    "supertrend_sell": "SuperTrend bearish — downtrend confirmed",
    "strong_buy":      "2+ indicators bullish — strong signal",
    "strong_sell":     "2+ indicators bearish — strong signal",
    "near_52w_high":   "Within 5% of 52-week high",
    "near_52w_low":    "Within 5% of 52-week low",
}

_VALID_FILTERS = set(FILTER_DESCRIPTIONS.keys())


def _apply_filter(signal_data: dict, filter_name: str) -> bool:
    inds = signal_data.get("indicators", {})
    rsi = inds.get("rsi")
    macd = inds.get("macd") or {}
    st = inds.get("supertrend") or {}
    direction = signal_data.get("direction", "neutral")

    if filter_name == "rsi_oversold":   return rsi is not None and rsi < 30
    if filter_name == "rsi_overbought": return rsi is not None and rsi > 70
    if filter_name == "macd_bullish":   return macd.get("crossover") == "bullish"
    if filter_name == "macd_bearish":   return macd.get("crossover") == "bearish"
    if filter_name == "supertrend_buy": return st.get("signal") == "buy"
    if filter_name == "supertrend_sell":return st.get("signal") == "sell"
    if filter_name == "strong_buy":     return direction == "buy" and signal_data.get("score", 0) >= 75
    if filter_name == "strong_sell":    return direction == "sell" and signal_data.get("score", 0) >= 75
    # near_52w_high / near_52w_low require price history data in metadata
    if filter_name == "near_52w_high":
        meta = signal_data.get("meta", {}) or {}
        high52 = meta.get("high_52w")
        price  = signal_data.get("price_at_signal")
        if high52 and price and high52 > 0:
            return price >= high52 * 0.95
        return False
    if filter_name == "near_52w_low":
        meta = signal_data.get("meta", {}) or {}
        low52 = meta.get("low_52w")
        price = signal_data.get("price_at_signal")
        if low52 and price and low52 > 0:
            return price <= low52 * 1.05
        return False
    return False


@router.get("/scanner")
async def scanner(
    exchange: str = Query(default="NSE"),
    filters:  str = Query(default="strong_buy", description="Comma-separated filter names"),
    match:    str = Query(default="any", description="'any' (OR) or 'all' (AND)"),
    limit:    int = Query(default=50, ge=1, le=200),
) -> dict:
    """
    Scan all recent signals for NSE instruments and return those matching
    the requested technical filters. Results are cached for 5 minutes.
    """
    from datetime import datetime, timezone, timedelta

    filter_list = [f.strip() for f in filters.split(",") if f.strip() in _VALID_FILTERS]
    if not filter_list:
        raise HTTPException(
            status_code=400,
            detail=f"No valid filters. Valid options: {sorted(_VALID_FILTERS)}",
        )

    match_mode = "all" if match == "all" else "any"
    cache_key = f"{','.join(sorted(filter_list))}:{match_mode}:{exchange.upper()}"

    now = time.monotonic()
    cached = _scanner_cache.get(cache_key)
    if cached is not None and (now - cached[0]) < _SCANNER_TTL:
        payload = dict(cached[1])
        payload["results"] = cached[1]["results"][:limit]
        return payload

    # ── Query last-24h signals joined to instruments ──────────────────────
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    db = get_supabase()
    try:
        rows_result = (
            db.schema("markets")
            .from_("signals")
            .select(
                "instrument_id, direction, confidence, score, rationale, "
                "metadata, price_at_signal, ts, "
                "instruments!instrument_id(symbol, exchange, instrument_type)"
            )
            .gte("ts", cutoff)
            .order("score", desc=True)
            .limit(2000)
            .execute()
        )
        raw_rows = rows_result.data or []
        # Filter by exchange in Python to avoid PostgREST embedded-resource filter issues
        rows = [
            r for r in raw_rows
            if (r.get("instruments") or {}).get("exchange", "").upper() == exchange.upper()
        ]
    except Exception as exc:
        logger.warning("scanner_db_error", error=str(exc))
        rows = []

    # ── Enrich with live LTP from in-memory cache ─────────────────────────
    from markets_worker.routers.ltp import _ltp_cache as ltp_cache  # type: ignore[import]

    def _get_ltp(symbol: str) -> tuple[float | None, float | None]:
        """Return (ltp, change_pct) from the ltp cache if fresh."""
        for suffix in (".NS", ".BO", ""):
            entry = ltp_cache.get(f"{symbol}{suffix}")
            if entry is None:
                entry = ltp_cache.get(symbol)
            if entry is not None:
                data = entry[1] if isinstance(entry, tuple) else entry
                ltp_val     = data.get("ltp")
                change_pct  = data.get("change_pct")
                return ltp_val, change_pct
        return None, None

    # ── Apply filters + build result rows ────────────────────────────────
    results: list[dict] = []
    now_utc = datetime.now(timezone.utc)

    for row in rows:
        instr = row.get("instruments") or row.get("instrument") or {}
        symbol        = instr.get("symbol", "")
        exch          = instr.get("exchange", exchange.upper())
        instr_type    = instr.get("instrument_type", "equity")

        meta = row.get("metadata") or {}
        indicators = meta.get("indicators") or {}

        signal_data = {
            "direction":      row.get("direction", "neutral"),
            "score":          round((row.get("score") or 0) * 100),
            "confidence":     row.get("confidence") or 0,
            "indicators":     indicators,
            "price_at_signal": row.get("price_at_signal"),
            "meta":           meta,
        }

        matched: list[str] = [f for f in filter_list if _apply_filter(signal_data, f)]

        passes = (
            len(matched) > 0 if match_mode == "any"
            else len(matched) == len(filter_list)
        )
        if not passes:
            continue

        ltp_val, change_pct = _get_ltp(symbol)

        rsi_val    = indicators.get("rsi")
        macd_d     = indicators.get("macd") or {}
        st_d       = indicators.get("supertrend") or {}

        try:
            ts = datetime.fromisoformat(row["ts"].replace("Z", "+00:00"))
            age_minutes = int((now_utc - ts).total_seconds() / 60)
        except Exception:
            age_minutes = -1

        results.append({
            "symbol":             symbol,
            "exchange":           exch,
            "instrument_type":    instr_type,
            "direction":          row.get("direction", "neutral"),
            "score":              signal_data["score"],
            "confidence":         round(float(signal_data["confidence"]), 2),
            "rationale":          row.get("rationale") or "",
            "ltp":                ltp_val,
            "change_pct":         change_pct,
            "rsi":                round(rsi_val, 2) if rsi_val is not None else None,
            "macd_crossover":     macd_d.get("crossover"),
            "supertrend":         st_d.get("signal"),
            "signal_age_minutes": age_minutes,
            "matched_filters":    matched,
        })

    # ── Sort by score desc, cache full result set ────────────────────────
    results.sort(key=lambda r: r["score"], reverse=True)

    response = {
        "filters":        filter_list,
        "match":          match_mode,
        "results":        results,
        "total_scanned":  len(rows),
        "total_matched":  len(results),
        "as_of":          now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _scanner_cache[cache_key] = (now, response)

    paged = dict(response)
    paged["results"] = results[:limit]
    return paged


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
