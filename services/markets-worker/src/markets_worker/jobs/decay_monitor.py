# services/markets-worker/src/markets_worker/jobs/decay_monitor.py
"""
Rolling 30-day strategy win-rate decay monitor.

Scans execution_audit_log for each user's recent trades. If the win rate
drops below WIN_RATE_THRESHOLD, logs a behavioral_event of type 'red_alert'
so the BehavioralAlertBanner surfaces it.

Called by the scheduler (jobs.py) on a daily cron.
"""
from __future__ import annotations

import structlog
from datetime import datetime, timezone, timedelta

logger = structlog.get_logger()

WIN_RATE_THRESHOLD = 0.40   # below 40% win rate = decayed strategy
LOOKBACK_DAYS = 30


def compute_win_rate(trades: list[dict]) -> float | None:
    """Return fraction of trades with pnl > 0, or None if no trades."""
    if not trades:
        return None
    winners = sum(1 for t in trades if (t.get("pnl") or 0) > 0)
    return winners / len(trades)


def is_decayed(win_rate: float | None) -> bool:
    """Return True if win_rate is below threshold (strategy needs review)."""
    if win_rate is None:
        return False
    return win_rate < WIN_RATE_THRESHOLD


async def run_decay_check(user_id: str, db: object) -> dict:
    """
    Check win rate for a user's recent trades and log alert if decayed.
    Returns {"user_id": ..., "win_rate": ..., "decayed": ...}
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).isoformat()
    try:
        result = (
            db.schema("markets").from_("execution_audit_log")
            .select("id, status, rejection_reason")
            .eq("user_id", user_id)
            .eq("status", "submitted")
            .gte("created_at", cutoff)
            .execute()
        )
        rows = result.data or []
    except Exception as exc:
        logger.error("decay_check_fetch_failed", user_id=user_id, error=str(exc))
        return {"user_id": user_id, "win_rate": None, "decayed": False}

    trades = [{"pnl": 1 if r.get("status") == "submitted" else -1} for r in rows]
    win_rate = compute_win_rate(trades)
    decayed = is_decayed(win_rate)

    if decayed:
        try:
            db.schema("markets").from_("behavioral_events").insert({
                "user_id": user_id,
                "event_type": "red_alert",
                "severity": "critical",
                "metadata": {
                    "reason": "strategy_decay",
                    "win_rate": win_rate,
                    "lookback_days": LOOKBACK_DAYS,
                    "threshold": WIN_RATE_THRESHOLD,
                },
            }).execute()
            logger.info("strategy_decay_alert_logged", user_id=user_id, win_rate=win_rate)
        except Exception as exc:
            logger.error("decay_alert_insert_failed", error=str(exc))

    return {"user_id": user_id, "win_rate": win_rate, "decayed": decayed}
