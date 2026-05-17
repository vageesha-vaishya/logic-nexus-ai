"""
FII/DII Flow router.

GET /v1/fii-dii?days=30

Fetches FII/DII daily institutional buy/sell net flows.
Primary source: NSE India API (fiidiiTradeReact endpoint).
Fallback: deterministic seed data so the UI always has something to show.

Cache: module-level dict with 1-hour TTL.
"""
from __future__ import annotations

import random
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
import structlog
from fastapi import APIRouter, Query

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/fii-dii")

_NSE_BASE = "https://www.nseindia.com"
_NSE_FII_DII_URL = f"{_NSE_BASE}/api/fiidiiTradeReact"
_CACHE_TTL = 3600  # 1 hour

_NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept":          "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://www.nseindia.com/",
    "Connection":      "keep-alive",
    "sec-fetch-dest":  "empty",
    "sec-fetch-mode":  "cors",
    "sec-fetch-site":  "same-origin",
}

# _fii_cache: {"data": [...], "stored_at": float, "is_stale": bool}
_fii_cache: dict[str, Any] = {}


def _seed_fii_dii(days: int = 252) -> list[dict[str, Any]]:
    """
    Generate realistic-looking FII/DII data for display purposes.
    Deterministic (seed=42) so results are consistent across calls.
    FII mean-reverts around 0; DII is counter-cyclical.
    """
    result: list[dict[str, Any]] = []
    today = date.today()
    rng = random.Random(42)
    for i in range(days, 0, -1):
        d = today - timedelta(days=i)
        if d.weekday() >= 5:  # skip weekends
            continue
        fii = round(rng.gauss(200, 2000), 2)
        dii = round(rng.gauss(-fii * 0.3, 1000), 2)
        result.append(
            {
                "date": d.isoformat(),
                "fii_net": fii,
                "dii_net": dii,
                "total_net": round(fii + dii, 2),
            }
        )
    return result


def _parse_nse_date(raw: str) -> str | None:
    """
    Parse NSE date strings like '01-May-2026' → '2026-05-01'.
    Returns None if unparseable.
    """
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_float(val: Any) -> float:
    """Safely coerce NSE numeric field to float."""
    try:
        return float(str(val).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


async def _fetch_nse_live() -> list[dict[str, Any]] | None:
    """
    Attempt to fetch FII/DII data from NSE with a warmed-up session.
    Returns None on any error so the caller falls back to seed data.
    """
    async with httpx.AsyncClient(
        headers=_NSE_HEADERS,
        follow_redirects=True,
        timeout=httpx.Timeout(15.0),
    ) as client:
        # Warm up session (get homepage cookies)
        try:
            await client.get(_NSE_BASE)
        except Exception as exc:
            logger.warning("fii_dii.warmup_failed", error=str(exc))
            return None

        try:
            resp = await client.get(_NSE_FII_DII_URL)
            if resp.status_code not in (200, 206):
                logger.warning("fii_dii.nse_bad_status", status=resp.status_code)
                return None
            payload = resp.json()
        except Exception as exc:
            logger.warning("fii_dii.nse_fetch_failed", error=str(exc))
            return None

    if not isinstance(payload, list) or not payload:
        return None

    rows: list[dict[str, Any]] = []
    for item in payload:
        raw_date = item.get("date") or item.get("Date") or ""
        iso_date = _parse_nse_date(str(raw_date))
        if not iso_date:
            continue

        fii_net = _parse_float(
            item.get("fiiNet")
            or item.get("FII_NET")
            or item.get("netFII")
            or 0
        )
        dii_net = _parse_float(
            item.get("diiNet")
            or item.get("DII_NET")
            or item.get("netDII")
            or 0
        )
        rows.append(
            {
                "date": iso_date,
                "fii_net": fii_net,
                "dii_net": dii_net,
                "total_net": round(fii_net + dii_net, 2),
            }
        )

    return rows if rows else None


@router.get("")
async def get_fii_dii(
    days: int = Query(default=30, ge=1, le=365, description="Number of trading days"),
):
    """Return FII/DII net flows for the last N trading days."""
    now = time.monotonic()
    is_stale = True

    cached_data: list[dict[str, Any]] | None = None
    if _fii_cache.get("data") and (now - _fii_cache.get("stored_at", 0)) < _CACHE_TTL:
        cached_data = _fii_cache["data"]
        is_stale = _fii_cache.get("is_stale", False)

    if cached_data is None:
        live = await _fetch_nse_live()
        if live:
            _fii_cache["data"] = live
            _fii_cache["stored_at"] = now
            _fii_cache["is_stale"] = False
            cached_data = live
            is_stale = False
            logger.info("fii_dii.live_data_fetched", rows=len(live))
        else:
            # Fallback: generate 1 year of seed data and cache it
            seed = _seed_fii_dii(252)
            _fii_cache["data"] = seed
            _fii_cache["stored_at"] = now
            _fii_cache["is_stale"] = True
            cached_data = seed
            is_stale = True
            logger.info("fii_dii.using_seed_data", rows=len(seed))

    # Slice to requested number of trading days (take the last N)
    sliced = cached_data[-days:] if len(cached_data) > days else cached_data

    as_of = datetime.now(tz=timezone.utc).isoformat()

    return {
        "data": sliced,
        "is_stale": is_stale,
        "as_of": as_of,
    }
