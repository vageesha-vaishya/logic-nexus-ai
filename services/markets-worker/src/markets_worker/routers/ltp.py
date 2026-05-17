import asyncio
import math
import time
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Query

import yfinance as yf

router = APIRouter(prefix="/v1/ltp", tags=["ltp"])

_ltp_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 5.0
_executor = ThreadPoolExecutor(max_workers=8)


def _suffix(exchange: str) -> str:
    return ".NS" if exchange.upper() in ("NSE", "NSE_EQ") else ".BO"


def _safe_float(val) -> float | None:
    try:
        if val is None:
            return None
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else round(f, 2)
    except (TypeError, ValueError):
        return None


def _fetch_one(sym: str, suffix: str, exchange: str) -> tuple[str, dict]:
    try:
        fi = yf.Ticker(f"{sym}{suffix}").fast_info
        ltp = _safe_float(fi.last_price)
        prev_close = _safe_float(fi.previous_close)
        change: float | None = None
        change_pct: float | None = None
        if ltp is not None and prev_close is not None and prev_close != 0:
            change = round(ltp - prev_close, 2)
            change_pct = round((change / prev_close) * 100, 2)
        volume: int | None = None
        try:
            v = fi.three_month_average_volume
            if v is not None and not math.isnan(float(v)):
                volume = int(v)
        except (TypeError, ValueError):
            pass
        data = {
            "symbol": sym,
            "exchange": exchange.upper(),
            "ltp": ltp,
            "open": _safe_float(fi.open),
            "high": _safe_float(fi.day_high),
            "low": _safe_float(fi.day_low),
            "prev_close": prev_close,
            "change": change,
            "change_pct": change_pct,
            "volume": volume,
        }
        return sym, data
    except Exception:
        return sym, {"symbol": sym, "exchange": exchange.upper(), "ltp": None, "error": "fetch_failed"}


@router.get("")
async def get_ltp(
    symbols: str = Query(..., description="Comma-separated NSE/BSE symbols"),
    exchange: str = Query("NSE", description="NSE or BSE"),
):
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not sym_list:
        return {"quotes": []}

    suffix = _suffix(exchange)
    now = time.monotonic()
    result: dict[str, dict] = {}
    uncached: list[str] = []

    for sym in sym_list:
        entry = _ltp_cache.get(f"{sym}:{exchange.upper()}")
        if entry and (now - entry[0]) < _CACHE_TTL:
            result[sym] = entry[1]
        else:
            uncached.append(sym)

    if uncached:
        loop = asyncio.get_event_loop()
        futures_map = {
            loop.run_in_executor(_executor, _fetch_one, sym, suffix, exchange): sym
            for sym in uncached
        }
        for coro in asyncio.as_completed(list(futures_map)):
            sym_key, data = await coro
            _ltp_cache[f"{sym_key}:{exchange.upper()}"] = (now, data)
            result[sym_key] = data

    quotes = [result.get(sym, {"symbol": sym, "exchange": exchange.upper(), "ltp": None}) for sym in sym_list]
    return {"quotes": quotes}
