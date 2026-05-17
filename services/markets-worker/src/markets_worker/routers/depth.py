"""
Level 2 market depth endpoint.

GET /v1/depth/{symbol}?exchange=NSE
  — Fetches 5-level bid/ask from NSE public API
  — 3-second in-memory cache (market depth changes fast)
  — Returns: {
        symbol, exchange,
        bids: [{price, qty, orders}×5],
        asks: [{price, qty, orders}×5],
        ltp, total_bid_qty, total_ask_qty, as_of,
        is_simulated (bool, present when real depth unavailable)
    }

Falls back to a simulated depth (deterministic, seeded on LTP) when
the NSE API is unavailable (index symbols, weekends, network errors, etc.).
"""

import asyncio
import random
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/v1/depth", tags=["depth"])
logger = structlog.get_logger()

_depth_cache: dict[str, tuple[float, dict]] = {}
_DEPTH_CACHE_TTL = 3.0   # seconds
_depth_executor = ThreadPoolExecutor(max_workers=4)

# NSE requires browser-like headers to serve the API response
_NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}
_NSE_DEPTH_URL = "https://www.nseindia.com/api/quote-equity?symbol={symbol}&section=trade_info"


def _simulate_depth(ltp: float) -> dict:
    """Generate synthetic bid/ask for display when real depth is unavailable."""
    random.seed(int(ltp * 100))  # deterministic for the same price
    bids, asks = [], []
    spread = max(0.05, round(ltp * 0.0005, 2))
    for i in range(5):
        bid_p = round(ltp - spread * (i + 1), 2)
        ask_p = round(ltp + spread * (i + 1), 2)
        bids.append({
            "price": bid_p,
            "qty": random.randint(100, 5000),
            "orders": random.randint(1, 20),
        })
        asks.append({
            "price": ask_p,
            "qty": random.randint(100, 5000),
            "orders": random.randint(1, 20),
        })
    return {"bids": bids, "asks": asks, "is_simulated": True}


def _parse_nse_depth(data: dict) -> dict | None:
    """
    Parse the NSE trade_info response into our canonical depth shape.
    Returns None if the required fields are absent.
    """
    try:
        md = (
            data.get("marketDepth")
            or data.get("data", {}).get("marketDepth")
        )
        if not md:
            return None
        raw_bids = md.get("buy", [])
        raw_asks = md.get("sell", [])
        if not raw_bids or not raw_asks:
            return None

        def _level(entry: dict) -> dict:
            return {
                "price":  float(entry.get("price", 0)),
                "qty":    int(entry.get("quantity", 0)),
                "orders": int(entry.get("numberOfOrders", 0)),
            }

        bids = [_level(e) for e in raw_bids[:5]]
        asks = [_level(e) for e in raw_asks[:5]]
        return {"bids": bids, "asks": asks, "is_simulated": False}
    except Exception:
        return None


def _fetch_nse_depth_sync(symbol: str) -> dict | None:
    """Blocking HTTP call to NSE — run in executor."""
    url = _NSE_DEPTH_URL.format(symbol=symbol.upper())
    try:
        # Two-step: first hit the homepage to get cookies, then the API
        with httpx.Client(headers=_NSE_HEADERS, timeout=6.0, follow_redirects=True) as client:
            client.get("https://www.nseindia.com/", timeout=5.0)
            resp = client.get(url, timeout=6.0)
            if resp.status_code != 200:
                return None
            return resp.json()
    except Exception:
        return None


@router.get("/{symbol}")
async def get_depth(
    symbol: str,
    exchange: str = Query("NSE", description="NSE or BSE"),
) -> dict:
    sym_upper = symbol.strip().upper()
    cache_key = f"{sym_upper}:{exchange.upper()}"
    now = time.monotonic()

    # Serve from cache if fresh
    cached = _depth_cache.get(cache_key)
    if cached and (now - cached[0]) < _DEPTH_CACHE_TTL:
        return cached[1]

    ltp: float | None = None

    # --- Try real NSE depth (equity only; NSE only) ---
    depth_data: dict | None = None
    if exchange.upper() in ("NSE", "NSE_EQ"):
        loop = asyncio.get_event_loop()
        try:
            raw = await loop.run_in_executor(
                _depth_executor, _fetch_nse_depth_sync, sym_upper
            )
            if raw:
                depth_data = _parse_nse_depth(raw)
                # Also extract LTP from the NSE response if available
                try:
                    ltp = float(
                        raw.get("priceInfo", {}).get("lastPrice", 0)
                        or raw.get("data", {}).get("priceInfo", {}).get("lastPrice", 0)
                        or 0
                    ) or None
                except Exception:
                    pass
        except Exception as exc:
            logger.warning("depth.nse_fetch_failed", symbol=sym_upper, error=str(exc))

    # --- Fall back to LTP cache for price, then simulate depth ---
    if ltp is None:
        from markets_worker.routers.ltp import _ltp_cache, _CACHE_TTL, _suffix, _fetch_one

        ltp_key = f"{sym_upper}:{exchange.upper()}"
        ltp_entry = _ltp_cache.get(ltp_key)
        if ltp_entry and (now - ltp_entry[0]) < _CACHE_TTL:
            ltp = ltp_entry[1].get("ltp")
        else:
            suffix = _suffix(exchange)
            loop = asyncio.get_event_loop()
            try:
                _, quote = await loop.run_in_executor(
                    _depth_executor, _fetch_one, sym_upper, suffix, exchange
                )
                ltp = quote.get("ltp")
                _ltp_cache[ltp_key] = (now, quote)
            except Exception:
                pass

    if ltp is None:
        raise HTTPException(status_code=404, detail=f"Could not fetch price for {sym_upper}")

    if depth_data is None:
        depth_data = _simulate_depth(ltp)

    total_bid_qty = sum(b["qty"] for b in depth_data["bids"])
    total_ask_qty = sum(a["qty"] for a in depth_data["asks"])

    result = {
        "symbol": sym_upper,
        "exchange": exchange.upper(),
        "ltp": ltp,
        "bids": depth_data["bids"],
        "asks": depth_data["asks"],
        "total_bid_qty": total_bid_qty,
        "total_ask_qty": total_ask_qty,
        "is_simulated": depth_data.get("is_simulated", False),
        "as_of": int(now * 1000),
    }

    _depth_cache[cache_key] = (now, result)
    return result
