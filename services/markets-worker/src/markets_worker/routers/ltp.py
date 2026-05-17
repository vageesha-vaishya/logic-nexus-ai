import asyncio
import math
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from fastapi import APIRouter, Query

import yfinance as yf

router = APIRouter(prefix="/v1/ltp", tags=["ltp"])

_ltp_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 5.0
_executor = ThreadPoolExecutor(max_workers=8)


# Known NSE/BSE index symbols → correct yfinance ticker (no exchange suffix needed)
_INDEX_SYMBOL_MAP: dict[str, str] = {
    "NIFTY 50":       "^NSEI",
    "NIFTY50":        "^NSEI",
    "SENSEX":         "^BSESN",
    "NIFTY BANK":     "^NSEBANK",
    "NIFTYBANK":      "^NSEBANK",
    "NIFTY IT":       "^CNXIT",
    "NIFTYIT":        "^CNXIT",
    "INDIA VIX":      "^INDIAVIX",
    "INDIAVIX":       "^INDIAVIX",
    "NIFTY MIDCAP":   "^NSEMDCP50",
    "NIFTY MIDCAP 50":"^NSEMDCP50",
    "NIFTY NEXT 50":  "^NSMIDCP",
    "NIFTY FMCG":     "^CNXFMCG",
    "NIFTY AUTO":     "^CNXAUTO",
    "NIFTY PHARMA":   "^CNXPHARMA",
    "NIFTY METAL":    "^CNXMETAL",
    "NIFTY REALTY":   "^CNXREALTY",
    "NIFTY ENERGY":   "^CNXENERGY",
    "NIFTY INFRA":    "^CNXINFRA",
    "NIFTY PSU BANK": "^CNXPSUBANK",
}


def _suffix(exchange: str) -> str:
    return ".NS" if exchange.upper() in ("NSE", "NSE_EQ") else ".BO"


def _resolve_yf_ticker(sym: str, suffix: str) -> str:
    """Map logical symbol name to actual yfinance ticker."""
    return _INDEX_SYMBOL_MAP.get(sym.upper(), f"{sym}{suffix}")


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
        yf_ticker = _resolve_yf_ticker(sym, suffix)
        fi = yf.Ticker(yf_ticker).fast_info
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


# ── Market Breadth / Sector Heatmap ───────────────────────────────────────────

# NSE sector ETF / index proxies for breadth
_SECTOR_TICKERS: dict[str, str] = {
    "Financial Services": "^CNXFIN",
    "Information Technology": "^CNXIT",
    "Energy": "^CNXENERGY",
    "Healthcare": "^CNXPHARMA",
    "Consumer Staples": "^CNXFMCG",
    "Automobile": "^CNXAUTO",
    "Metal": "^CNXMETAL",
    "Realty": "^CNXREALTY",
    "PSU Bank": "^CNXPSUBANK",
    "Infrastructure": "^CNXINFRA",
}

_BREADTH_CACHE: dict = {}
_BREADTH_TTL = 300  # 5 minutes


@router.get("/breadth")
async def get_market_breadth():
    """
    GET /v1/ltp/breadth
    Returns sector-level change % using NSE sector index tickers,
    plus the major index snapshot (NIFTY 50, NIFTY BANK, NIFTY IT, INDIA VIX).
    Cached 5 minutes.
    """
    now = time.monotonic()
    if _BREADTH_CACHE.get("stored_at") and (now - _BREADTH_CACHE["stored_at"]) < _BREADTH_TTL:
        return _BREADTH_CACHE["data"]

    # Fetch sector indices + main indices concurrently
    all_symbols = list(_SECTOR_TICKERS.values()) + ["^NSEI", "^NSEBANK", "^CNXIT", "^INDIAVIX"]
    loop = asyncio.get_event_loop()

    def _fetch_batch(tickers: list[str]) -> dict[str, dict]:
        result = {}
        for ticker in tickers:
            try:
                fi = yf.Ticker(ticker).fast_info
                ltp = fi.last_price
                prev = fi.previous_close
                if ltp and prev and prev > 0:
                    change_pct = round((float(ltp) - float(prev)) / float(prev) * 100, 2)
                    result[ticker] = {"ltp": round(float(ltp), 2), "change_pct": change_pct, "prev_close": round(float(prev), 2)}
                else:
                    result[ticker] = {"ltp": None, "change_pct": None, "prev_close": None}
            except Exception:
                result[ticker] = {"ltp": None, "change_pct": None, "prev_close": None}
        return result

    prices = await loop.run_in_executor(_executor, _fetch_batch, all_symbols)

    # Build sectors list
    sectors = []
    for name, ticker in _SECTOR_TICKERS.items():
        p = prices.get(ticker, {})
        sectors.append({
            "sector": name,
            "ticker": ticker,
            "change_pct": p.get("change_pct"),
            "ltp": p.get("ltp"),
        })

    # Build indices list
    idx_map = {
        "^NSEI":     "NIFTY 50",
        "^NSEBANK":  "NIFTY Bank",
        "^CNXIT":    "NIFTY IT",
        "^INDIAVIX": "India VIX",
    }
    indices = []
    for ticker, name in idx_map.items():
        p = prices.get(ticker, {})
        indices.append({
            "name": name, "ticker": ticker,
            "change_pct": p.get("change_pct"),
            "ltp": p.get("ltp"),
        })

    # Simple advance/decline from sectors (positive = advance, negative = decline)
    valid = [s for s in sectors if s["change_pct"] is not None]
    advances = sum(1 for s in valid if s["change_pct"] > 0)
    declines = sum(1 for s in valid if s["change_pct"] < 0)

    data = {
        "sectors": sectors,
        "indices": indices,
        "advance_decline": {"advances": advances, "declines": declines, "unchanged": len(valid) - advances - declines},
        "as_of": datetime.now(timezone.utc).isoformat(),
        "is_stale": False,
    }
    _BREADTH_CACHE["data"] = data
    _BREADTH_CACHE["stored_at"] = now
    return data
