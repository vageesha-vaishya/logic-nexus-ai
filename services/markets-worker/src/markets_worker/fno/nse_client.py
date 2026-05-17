"""
Async NSE India API client.

NSE requires a warmed-up session (homepage visit for cookies) before
API calls succeed. Session is cached for 45 minutes.
"""
from __future__ import annotations
import asyncio
import time
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept":          "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer":         "https://www.nseindia.com/",
    "Connection":      "keep-alive",
    "sec-fetch-dest":  "empty",
    "sec-fetch-mode":  "cors",
    "sec-fetch-site":  "same-origin",
}

_BASE = "https://www.nseindia.com"
_SESSION_TTL = 2700  # 45 minutes

_client: httpx.AsyncClient | None = None
_warmed_at: float = 0.0
_lock = asyncio.Lock()

# Last-known-good cache: symbol → (stored_at_monotonic, iso_timestamp, raw_response)
_chain_cache: dict[str, tuple[float, str, dict[str, Any]]] = {}


async def _ensure_client() -> httpx.AsyncClient:
    global _client, _warmed_at
    async with _lock:
        now = time.monotonic()
        if _client is None or (now - _warmed_at) > _SESSION_TTL:
            if _client:
                await _client.aclose()
            _client = httpx.AsyncClient(
                headers=_HEADERS,
                follow_redirects=True,
                timeout=httpx.Timeout(15.0),
            )
            try:
                await _client.get(_BASE)
                _warmed_at = now
                logger.info("nse_client.session_warmed")
            except Exception as exc:
                logger.warning("nse_client.warmup_failed", error=str(exc))
    return _client


async def _get(path: str) -> dict[str, Any]:
    client = await _ensure_client()
    url = f"{_BASE}/api/{path}"
    resp = await client.get(url)
    if resp.status_code in (401, 403):
        # Session expired — force re-warm
        global _warmed_at
        _warmed_at = 0.0
        client = await _ensure_client()
        resp = await client.get(url)
    resp.raise_for_status()
    return resp.json()


# ── Public API ────────────────────────────────────────────────────────────────

# Symbols classified as indices on NSE (use option-chain-indices endpoint)
INDEX_SYMBOLS = frozenset({
    "NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY",
    "NIFTYIT", "NIFTYMIDSEL", "SENSEX", "BANKEX",
})


async def fetch_option_chain(symbol: str) -> dict[str, Any]:
    """
    Fetch full option chain from NSE.
    Returns the raw NSE response dict (keys: records, filtered).
    Stores a last-known-good copy in _chain_cache for stale-data fallback.
    Raises httpx.HTTPStatusError on failure.
    """
    import datetime as _dt
    sym = symbol.upper()
    endpoint = (
        f"option-chain-indices?symbol={sym}"
        if sym in INDEX_SYMBOLS
        else f"option-chain-equities?symbol={sym}"
    )
    data = await _get(endpoint)
    # Cache only if we got real data (non-empty records with expiryDates)
    if data.get("records", {}).get("expiryDates"):
        _chain_cache[sym] = (
            time.monotonic(),
            _dt.datetime.now(_dt.timezone.utc).isoformat(),
            data,
        )
        logger.debug("nse_client.chain_cached", symbol=sym)
    return data


def get_cached_chain(symbol: str) -> tuple[str, dict[str, Any]] | None:
    """
    Return (cached_at_iso, raw_response) for symbol if available, else None.
    No TTL — stale data is better than no data for a closed-market display.
    """
    entry = _chain_cache.get(symbol.upper())
    if entry:
        return entry[1], entry[2]   # (iso_timestamp, raw_response)
    return None


async def fetch_spot_price(symbol: str) -> float | None:
    """
    Get current spot price for an index or equity from NSE.
    Returns None on failure (caller should use option chain's underlyingValue).
    """
    sym = symbol.upper()
    try:
        if sym in INDEX_SYMBOLS:
            data = await _get(f"equity-stockIndices?index={sym.replace(' ', '%20')}")
            return data.get("data", [{}])[0].get("last")
        else:
            data = await _get(f"quote-equity?symbol={sym}")
            return data.get("priceInfo", {}).get("lastPrice")
    except Exception:
        return None
