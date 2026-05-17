"""
Background alert checker.

Polls markets.price_alerts WHERE status='active' every 30 seconds.
Checks each alert against the LTP cache (from routers/ltp.py).
When triggered: updates status to 'triggered', records triggered_price + triggered_at.
"""
import asyncio
import time
from datetime import datetime, timezone

import structlog

from markets_worker.db import get_supabase

logger = structlog.get_logger()
_POLL_INTERVAL = 30  # seconds


async def check_alerts_loop() -> None:
    """Infinite loop — runs as asyncio background task from app startup."""
    while True:
        try:
            await _check_once()
        except Exception as exc:
            logger.warning("alert_checker.error", exc=str(exc))
        await asyncio.sleep(_POLL_INTERVAL)


async def _check_once() -> None:
    from markets_worker.routers.ltp import _ltp_cache, _CACHE_TTL  # lazy import to avoid circular

    loop = asyncio.get_event_loop()
    db = await loop.run_in_executor(None, get_supabase)

    # Fetch all active alerts
    rows = await loop.run_in_executor(
        None,
        lambda: db.schema("markets").from_("price_alerts")
            .select("id, symbol, exchange, condition, trigger_price, user_id")
            .eq("status", "active")
            .execute()
            .data
    )
    if not rows:
        return

    now = time.monotonic()
    to_trigger: list[dict] = []

    for alert in rows:
        sym = alert["symbol"].upper()
        exch = alert["exchange"].upper()
        key = f"{sym}:{exch}"
        entry = _ltp_cache.get(key)
        if not entry:
            continue
        ts, quote = entry
        if now - ts > _CACHE_TTL * 4:  # stale cache — skip
            continue
        ltp = quote.get("ltp")
        if ltp is None:
            continue

        condition = alert["condition"]
        trigger_price = float(alert["trigger_price"])
        triggered = (condition == "above" and ltp >= trigger_price) or \
                    (condition == "below" and ltp <= trigger_price)

        if triggered:
            to_trigger.append({"id": alert["id"], "ltp": ltp})

    if not to_trigger:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    for t in to_trigger:
        await loop.run_in_executor(
            None,
            lambda t=t: db.schema("markets").from_("price_alerts")
                .update({
                    "status": "triggered",
                    "triggered_at": now_iso,
                    "triggered_price": t["ltp"],
                })
                .eq("id", t["id"])
                .eq("status", "active")  # guard against double-trigger race
                .execute()
        )
        logger.info("alert.triggered", alert_id=t["id"], ltp=t["ltp"])
