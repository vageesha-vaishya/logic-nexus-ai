"""
Daily job scheduler for markets-worker.

Runs at 07:00 IST every trading day:
  1. Refresh last-30-days OHLCV for all active portfolios
  2. Re-generate signals for all active portfolios

Self-rescheduling: each daily job re-enqueues itself for the next day,
so you only need to call setup_daily_jobs() once (on worker startup).

Also exposes:
  schedule_immediate_refresh(portfolio_id) — ad-hoc run outside cron window
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import redis
import structlog
from rq import Queue
from rq.job import Job

from markets_worker.config import get_settings
from markets_worker.db import get_supabase

logger = structlog.get_logger()

# IST = UTC+5:30
_IST = timezone(timedelta(hours=5, minutes=30))

# RQ queue names
_QUEUE_SIGNALS = "markets_signals"


# ── Time helpers ──────────────────────────────────────────────────────────────

def _next_run_at(hour: int = 7, minute: int = 0) -> datetime:
    """Return the next occurrence of HH:MM IST as a UTC datetime."""
    now_ist  = datetime.now(_IST)
    target   = now_ist.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if now_ist >= target:
        target += timedelta(days=1)
    # Skip Saturday (5) and Sunday (6)
    while target.weekday() >= 5:
        target += timedelta(days=1)
    return target.astimezone(timezone.utc)


def _get_queue(name: str = _QUEUE_SIGNALS) -> Queue:
    s    = get_settings()
    conn = redis.from_url(s.effective_redis_url, decode_responses=False)
    return Queue(name, connection=conn)


# ── Job implementations ───────────────────────────────────────────────────────

def daily_refresh_and_signals(portfolio_id: str) -> dict:
    """
    RQ job: refresh price data + generate signals for one portfolio.
    Self-reschedules for the next trading day at 07:00 IST on completion.
    """
    from markets_worker.jobs.price_ingest import refresh_prices_for_portfolio
    from markets_worker.jobs.signal_generator import generate_signals_for_portfolio

    logger.info("daily_job.start", portfolio_id=portfolio_id)

    refresh_result = refresh_prices_for_portfolio(portfolio_id)
    signal_result  = generate_signals_for_portfolio(portfolio_id)

    logger.info("daily_job.done",
                portfolio_id=portfolio_id,
                rows_refreshed=refresh_result.get("total_rows", 0),
                signals_generated=signal_result.get("generated", 0))

    # Re-schedule for the next trading day
    _enqueue_daily_for_portfolio(portfolio_id)

    return {
        "portfolio_id": portfolio_id,
        "refresh":      refresh_result,
        "signals":      signal_result,
    }


def _enqueue_daily_for_portfolio(portfolio_id: str) -> Job | None:
    """Enqueue the daily job for a portfolio at the next 07:00 IST."""
    try:
        q        = _get_queue()
        run_at   = _next_run_at(hour=7, minute=0)
        job_id   = f"daily-{portfolio_id[:8]}-{run_at.strftime('%Y%m%d')}"

        # Avoid duplicate scheduling for the same day
        try:
            existing = Job.fetch(job_id, connection=q.connection)
            if existing.get_status() in ("scheduled", "queued"):
                logger.debug("daily_job.already_scheduled",
                             portfolio_id=portfolio_id, job_id=job_id)
                return existing
        except Exception:
            pass   # job doesn't exist yet — schedule it

        job = q.enqueue_at(
            run_at,
            daily_refresh_and_signals,
            portfolio_id,
            job_id=job_id,
            job_timeout=900,
            result_ttl=86400,
        )
        logger.info("daily_job.scheduled",
                    portfolio_id=portfolio_id,
                    run_at=run_at.isoformat(), job_id=job.id)
        return job
    except Exception as exc:
        logger.error("daily_job.schedule_failed",
                     portfolio_id=portfolio_id, error=str(exc))
        return None


# ── Setup — called once on worker startup ────────────────────────────────────

def _enqueue_token_refresh() -> None:
    """Schedule the daily broker token refresh at 08:00 IST (before market open)."""
    try:
        from markets_worker.jobs.broker_sync import refresh_broker_tokens
        q      = _get_queue()
        run_at = _next_run_at(hour=8, minute=0)
        job_id = f"broker-token-refresh-{run_at.strftime('%Y%m%d')}"
        try:
            existing = Job.fetch(job_id, connection=q.connection)
            if existing.get_status() in ("scheduled", "queued"):
                return
        except Exception:
            pass
        q.enqueue_at(
            run_at, refresh_broker_tokens,
            job_id=job_id, job_timeout=300, result_ttl=86400,
        )
        logger.info("token_refresh.scheduled", run_at=run_at.isoformat())
    except Exception as exc:
        logger.error("token_refresh.schedule_failed", error=str(exc))


def setup_daily_jobs() -> None:
    """
    Load all active portfolios from DB and schedule a daily refresh+signal job
    for each one at 07:00 IST. Safe to call multiple times (idempotent).
    Also schedules the broker token-refresh job at 08:00 IST.
    """
    try:
        db         = get_supabase()
        portfolios = (
            db.schema("markets").from_("portfolios")
            .select("id, name")
            .execute()
        ).data or []
    except Exception as exc:
        logger.error("scheduler.setup_failed", error=str(exc))
        return

    if not portfolios:
        logger.info("scheduler.no_portfolios")
        return

    for p in portfolios:
        _enqueue_daily_for_portfolio(p["id"])

    _enqueue_token_refresh()

    logger.info("scheduler.setup_done", portfolios=len(portfolios))


# ── Ad-hoc helpers (called from API / frontend) ───────────────────────────────

def schedule_immediate_refresh(portfolio_id: str) -> str:
    """Enqueue price refresh + signals to run NOW (no delay). Returns job ID."""
    q   = _get_queue()
    job = q.enqueue(
        daily_refresh_and_signals,
        portfolio_id,
        job_id=f"adhoc-{portfolio_id[:8]}-{datetime.now(timezone.utc).strftime('%H%M%S')}",
        job_timeout=900,
        result_ttl=3600,
    )
    return job.id
