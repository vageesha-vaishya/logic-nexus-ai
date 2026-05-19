"""
In-app notification helpers.

Writes rows to markets.notifications. The frontend listens to Supabase
Realtime INSERT events on that table and renders a toast + bell badge.

This is in-app only. Backgrounded mobile delivery (system push) requires
FCM/APNs and is intentionally deferred — when added, a delivery worker
will consume rows from the same table and dispatch to device tokens.
"""
from __future__ import annotations

import asyncio
from typing import Any, Iterable, Literal

import structlog

from markets_worker.db import get_supabase

logger = structlog.get_logger()

Category = Literal["alert", "order_fill", "sip", "risk", "rebalance", "system"]
Severity = Literal["info", "success", "warning", "critical"]


def notify_user_sync(
    user_id: str,
    category: Category,
    title: str,
    body: str,
    *,
    severity: Severity = "info",
    data: dict[str, Any] | None = None,
    link_url: str | None = None,
) -> None:
    """Synchronous insert — for use from RQ jobs / blocking code paths.

    After the in-app row lands, fans out to FCM via push.fan_out_push so
    Android sees a system notification too (T24c). Push delivery is a
    soft-fail — any FCM error is logged inside fan_out_push and never
    bubbles up.
    """
    if not user_id:
        return
    try:
        db = get_supabase()
        db.schema("markets").from_("notifications").insert({
            "user_id":  user_id,
            "category": category,
            "severity": severity,
            "title":    title,
            "body":     body,
            "data":     data or {},
            "link_url": link_url,
        }).execute()
    except Exception as exc:
        # Never let notification failure break the calling job.
        logger.warning("notify.insert_failed",
                       user_id=user_id, category=category, error=str(exc))
        return

    # Best-effort mobile push. Import here to avoid a hard dep cycle and
    # to keep the in-app path working when google-auth isn't installed.
    try:
        from markets_worker.push import fan_out_push  # noqa: PLC0415
        fan_out_push(user_id, title, body, data=data, link_url=link_url)
    except Exception as exc:  # noqa: BLE001
        logger.warning("notify.push_failed",
                       user_id=user_id, category=category, error=str(exc))


async def notify_user(
    user_id: str,
    category: Category,
    title: str,
    body: str,
    *,
    severity: Severity = "info",
    data: dict[str, Any] | None = None,
    link_url: str | None = None,
) -> None:
    """Async wrapper — runs the blocking insert in the default executor."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: notify_user_sync(
            user_id, category, title, body,
            severity=severity, data=data, link_url=link_url,
        ),
    )


def notify_users_sync(
    user_ids: Iterable[str],
    category: Category,
    title: str,
    body: str,
    *,
    severity: Severity = "info",
    data: dict[str, Any] | None = None,
    link_url: str | None = None,
) -> None:
    """Bulk insert — same notification to multiple users."""
    rows = [
        {
            "user_id":  uid,
            "category": category,
            "severity": severity,
            "title":    title,
            "body":     body,
            "data":     data or {},
            "link_url": link_url,
        }
        for uid in user_ids if uid
    ]
    if not rows:
        return
    try:
        db = get_supabase()
        db.schema("markets").from_("notifications").insert(rows).execute()
    except Exception as exc:
        logger.warning("notify.bulk_insert_failed",
                       count=len(rows), category=category, error=str(exc))
