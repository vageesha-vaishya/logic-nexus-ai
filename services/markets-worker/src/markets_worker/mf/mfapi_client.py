"""
Async client for https://api.mfapi.in — free Indian MF NAV API.

Endpoints used:
  GET /mf/search?q=<query>          → [{schemeCode, schemeName}]
  GET /mf/{scheme_code}/latest      → {meta, data:[{date,nav}]}  (1 row)
  GET /mf/{scheme_code}             → {meta, data:[...]}          (full history)
"""
from __future__ import annotations

import time
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()

_BASE = "https://api.mfapi.in"
_TIMEOUT = httpx.Timeout(12.0)

# Simple TTL cache: key → (timestamp, value)
_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = {
    "latest": 300,      # 5 min for NAV
    "history": 3600,    # 1 hour for full history
    "search": 1800,     # 30 min for search results
}


def _cached(key: str, ttl: int) -> Any | None:
    entry = _cache.get(key)
    if entry and (time.monotonic() - entry[0]) < ttl:
        return entry[1]
    return None


def _store(key: str, value: Any) -> None:
    _cache[key] = (time.monotonic(), value)


async def search_funds(q: str) -> list[dict]:
    """Search fund schemes by name. Returns [{schemeCode, schemeName}]."""
    key = f"search:{q.lower()}"
    cached = _cached(key, _CACHE_TTL["search"])
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE}/mf/search", params={"q": q})
        resp.raise_for_status()
        data = resp.json()
    _store(key, data)
    return data


async def get_nav_latest(scheme_code: str | int) -> dict:
    """Return {meta, data:[{date, nav}]} with only the most recent NAV row."""
    key = f"latest:{scheme_code}"
    cached = _cached(key, _CACHE_TTL["latest"])
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE}/mf/{scheme_code}/latest")
        resp.raise_for_status()
        data = resp.json()
    _store(key, data)
    return data


async def get_nav_history(scheme_code: str | int) -> dict:
    """Return {meta, data:[{date,nav}, ...]} full history, newest first."""
    key = f"history:{scheme_code}"
    cached = _cached(key, _CACHE_TTL["history"])
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE}/mf/{scheme_code}")
        resp.raise_for_status()
        data = resp.json()
    _store(key, data)
    return data


def compute_returns(nav_history: list[dict]) -> dict[str, float | None]:
    """
    Compute period returns from NAV history (newest-first list of {date, nav}).
    Returns dict with keys: 1w, 1m, 3m, 6m, 1y, 3y, 5y (all in % or None).
    """
    from datetime import datetime, timedelta
    if not nav_history:
        return {}
    try:
        current = float(nav_history[0]["nav"])
    except (KeyError, ValueError, IndexError):
        return {}

    def _parse(d: str) -> datetime:
        for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(d, fmt)
            except ValueError:
                pass
        raise ValueError(f"Unknown date format: {d}")

    def _nav_before(days: int) -> float | None:
        cutoff = datetime.now() - timedelta(days=days)
        for row in nav_history:
            try:
                if _parse(row["date"]) <= cutoff:
                    return float(row["nav"])
            except (ValueError, KeyError):
                continue
        return None

    def _ret(past: float | None) -> float | None:
        if past is None or past == 0:
            return None
        raw = (current - past) / past * 100
        # CAGR for multi-year periods
        return round(raw, 2)

    def _cagr(days: int) -> float | None:
        past = _nav_before(days)
        if past is None or past == 0:
            return None
        yrs = days / 365
        try:
            return round(((current / past) ** (1 / yrs) - 1) * 100, 2)
        except (ZeroDivisionError, ValueError):
            return None

    return {
        "1w":  _ret(_nav_before(7)),
        "1m":  _ret(_nav_before(30)),
        "3m":  _ret(_nav_before(91)),
        "6m":  _ret(_nav_before(182)),
        "1y":  _ret(_nav_before(365)),
        "3y":  _cagr(1095),
        "5y":  _cagr(1825),
    }
