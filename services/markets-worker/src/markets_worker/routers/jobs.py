"""Job endpoints — backtest + signal generation + price ingest.

POST /v1/jobs/backtest                  — enqueue a backtest job
POST /v1/jobs/bootstrap-portfolio       — full first-run setup for a new portfolio
POST /v1/jobs/signals/portfolio         — generate signals for all holdings
POST /v1/jobs/signals/watchlist         — generate signals for watchlist
POST /v1/jobs/prices/ingest/portfolio   — fetch 2yr OHLCV for all holdings
POST /v1/jobs/prices/refresh/portfolio  — fetch last 30d OHLCV (daily refresh)
GET  /v1/jobs/{job_id}                  — poll job status
GET  /v1/jobs/prices/{job_id}           — poll price ingest job status
"""

import uuid
from typing import Any

import redis
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from rq import Queue
from rq.job import Job, NoSuchJobError

from markets_worker.auth import Auth
from markets_worker.config import get_settings
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/jobs")


def _get_queue(name: str = "markets_backtests") -> Queue:
    s = get_settings()
    r = redis.from_url(s.effective_redis_url, decode_responses=False)
    return Queue(name, connection=r)


class BacktestRequest(BaseModel):
    strategy_id:     str
    period_from:     str  # YYYY-MM-DD
    period_to:       str  # YYYY-MM-DD
    initial_capital: float = 1_000_000
    commission_model: dict[str, Any] | None = None


class JobStatusResponse(BaseModel):
    job_id:     str
    backtest_id: str | None
    status:     str
    progress:   int
    result:     dict | None
    error:      str | None


@router.post("/backtest")
async def submit_backtest(body: BacktestRequest, auth: Auth):
    if not auth.tenant_id:
        raise HTTPException(400, detail="x-tenant-id header required")

    db = get_supabase()

    # Verify strategy belongs to this user / tenant
    strategy = (
        db.schema("markets")
        .from_("strategies")
        .select("id, name, lifecycle_state, universe")
        .eq("id", body.strategy_id)
        .maybe_single()
        .execute()
    ).data

    if not strategy:
        raise HTTPException(404, detail="Strategy not found")
    if strategy["lifecycle_state"] not in ("active", "draft"):
        raise HTTPException(400, detail=f"Cannot backtest a {strategy['lifecycle_state']} strategy")

    s = get_settings()
    commission_model = body.commission_model or {
        "per_trade_bps": 3, "stt_pct": 0.1, "gst_pct": 18, "slippage_bps": 5
    }

    # Create backtest row in DB
    backtest_id = str(uuid.uuid4())
    db.schema("markets").from_("backtests").insert({
        "id":               backtest_id,
        "strategy_id":      body.strategy_id,
        "tenant_id":        auth.tenant_id,
        "franchise_id":     auth.franchise_id,
        "owner_user_id":    auth.user_id or auth.service_account_id,
        "status":           "queued",
        "progress":         0,
        "period_from":      body.period_from,
        "period_to":        body.period_to,
        "initial_capital":  body.initial_capital,
        "commission_model": commission_model,
        "params":           {
            "strategy_id": body.strategy_id,
            "strategy_name": strategy.get("name"),
        },
    }).execute()

    # Enqueue RQ job
    try:
        q = _get_queue()
        job = q.enqueue(
            "markets_worker.jobs.backtest.run_backtest",
            backtest_id,
            job_id=f"bt-{backtest_id}",
            job_timeout=s.job_timeout,
            result_ttl=s.job_ttl,
        )
        # Store RQ job ID on the backtest row
        db.schema("markets").from_("backtests").update(
            {"worker_job_id": job.id}
        ).eq("id", backtest_id).execute()

        logger.info("backtest.enqueued", backtest_id=backtest_id, job_id=job.id)
        return {"backtest_id": backtest_id, "job_id": job.id, "status": "queued"}

    except Exception as exc:
        logger.error("backtest.enqueue_failed", error=str(exc))
        db.schema("markets").from_("backtests").update(
            {"status": "failed", "error": str(exc)}
        ).eq("id", backtest_id).execute()
        raise HTTPException(503, detail=f"Job queue unavailable: {exc}") from exc


class SignalPortfolioRequest(BaseModel):
    portfolio_id: str


class SignalWatchlistRequest(BaseModel):
    watchlist_id:  str
    owner_user_id: str
    tenant_id:     str
    franchise_id:  str


class BootstrapPortfolioRequest(BaseModel):
    portfolio_id: str


@router.post("/bootstrap-portfolio")
async def bootstrap_new_portfolio(body: BootstrapPortfolioRequest, auth: Auth):
    """
    First-run setup for a freshly-created portfolio. Two things at once:
      1. Schedules the recurring daily refresh+signals job at 07:00 IST so
         the portfolio joins the same cadence as every other one.
      2. Fires an immediate refresh+signals run so the user sees content on
         their first visit to the Signals tab instead of an empty state.

    Idempotent — `_enqueue_daily_for_portfolio` dedupes by job_id and skips
    if today's slot is already scheduled. Safe to call multiple times from
    the frontend without spawning duplicate jobs.

    Closed-beta dealbreaker fix #D1 (see docs/audits/2026-05-21-content-coverage.md).
    """
    from markets_worker.scheduler import (
        _enqueue_daily_for_portfolio,
        schedule_immediate_refresh,
    )
    try:
        # Verify the portfolio exists + is visible to this user. RLS would
        # block the daily job's own reads anyway, but a 400 here gives a
        # cleaner error than a job that silently no-ops at 07:00 IST.
        db = get_supabase()
        check = (
            db.schema("markets").from_("portfolios")
            .select("id, owner_user_id")
            .eq("id", body.portfolio_id)
            .limit(1)
            .execute()
        )
        if not check.data:
            raise HTTPException(404, detail=f"portfolio {body.portfolio_id} not found")
        port = check.data[0]
        if not (auth.is_service_account or port.get("owner_user_id") == auth.user_id):
            raise HTTPException(403, detail="Access denied")

        daily_job     = _enqueue_daily_for_portfolio(body.portfolio_id)
        immediate_job = schedule_immediate_refresh(body.portfolio_id)
        logger.info(
            "bootstrap_portfolio.enqueued",
            portfolio_id=body.portfolio_id,
            daily_job_id=getattr(daily_job, "id", None),
            immediate_job_id=immediate_job,
        )
        return {
            "portfolio_id":     body.portfolio_id,
            "daily_job_id":     getattr(daily_job, "id", None),
            "immediate_job_id": immediate_job,
            "status":           "queued",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("bootstrap_portfolio.failed", portfolio_id=body.portfolio_id, error=str(exc))
        raise HTTPException(503, detail=f"Job queue unavailable: {exc}") from exc


@router.post("/signals/portfolio")
async def generate_portfolio_signals(body: SignalPortfolioRequest, auth: Auth):
    """Enqueue LangGraph signal generation for all holdings in a portfolio."""
    from markets_worker.jobs.signal_generator import generate_signals_for_portfolio
    try:
        q = _get_queue("markets_signals")
        job = q.enqueue(
            generate_signals_for_portfolio,
            body.portfolio_id,
            job_id=f"sig-portfolio-{body.portfolio_id[:8]}-{uuid.uuid4().hex[:6]}",
            job_timeout=300,
            result_ttl=3600,
        )
        logger.info("signals.enqueued", portfolio_id=body.portfolio_id, job_id=job.id)
        return {"job_id": job.id, "portfolio_id": body.portfolio_id, "status": "queued"}
    except Exception as exc:
        logger.error("signals.enqueue_failed", error=str(exc))
        raise HTTPException(503, detail=f"Job queue unavailable: {exc}") from exc


@router.post("/signals/watchlist")
async def generate_watchlist_signals(body: SignalWatchlistRequest, auth: Auth):
    """Enqueue LangGraph signal generation for all instruments in a watchlist."""
    from markets_worker.jobs.signal_generator import generate_signals_for_watchlist
    try:
        q = _get_queue("markets_signals")
        job = q.enqueue(
            generate_signals_for_watchlist,
            body.watchlist_id,
            body.owner_user_id,
            body.tenant_id,
            body.franchise_id,
            job_id=f"sig-watchlist-{body.watchlist_id[:8]}-{uuid.uuid4().hex[:6]}",
            job_timeout=300,
            result_ttl=3600,
        )
        return {"job_id": job.id, "watchlist_id": body.watchlist_id, "status": "queued"}
    except Exception as exc:
        raise HTTPException(503, detail=f"Job queue unavailable: {exc}") from exc


# ── Price ingest endpoints ────────────────────────────────────────────────────

class PriceIngestRequest(BaseModel):
    portfolio_id:  str
    lookback_days: int = 730   # 2 years default


@router.post("/prices/ingest/portfolio")
async def ingest_portfolio_prices(body: PriceIngestRequest, auth: Auth):
    """Enqueue full OHLCV backfill (2 years) for all holdings in a portfolio."""
    from markets_worker.jobs.price_ingest import ingest_prices_for_portfolio
    try:
        q = _get_queue("markets_signals")   # reuse same queue
        job_id = f"price-ingest-{body.portfolio_id[:8]}-{uuid.uuid4().hex[:6]}"
        job = q.enqueue(
            ingest_prices_for_portfolio,
            body.portfolio_id,
            body.lookback_days,
            job_id=job_id,
            job_timeout=900,      # 15 min max for full historical fetch
            result_ttl=3600,
        )
        logger.info("price_ingest.enqueued", portfolio_id=body.portfolio_id, job_id=job.id)
        return {"job_id": job.id, "portfolio_id": body.portfolio_id, "status": "queued"}
    except Exception as exc:
        logger.error("price_ingest.enqueue_failed", error=str(exc))
        raise HTTPException(503, detail=f"Job queue unavailable: {exc}") from exc


@router.post("/prices/refresh/portfolio")
async def refresh_portfolio_prices(body: PriceIngestRequest, auth: Auth):
    """Enqueue 30-day price refresh for all holdings (use after initial backfill)."""
    from markets_worker.jobs.price_ingest import refresh_prices_for_portfolio
    try:
        q = _get_queue("markets_signals")
        job_id = f"price-refresh-{body.portfolio_id[:8]}-{uuid.uuid4().hex[:6]}"
        job = q.enqueue(
            refresh_prices_for_portfolio,
            body.portfolio_id,
            job_id=job_id,
            job_timeout=300,
            result_ttl=3600,
        )
        return {"job_id": job.id, "portfolio_id": body.portfolio_id, "status": "queued"}
    except Exception as exc:
        raise HTTPException(503, detail=f"Job queue unavailable: {exc}") from exc


@router.get("/prices/{job_id}")
async def get_price_ingest_status(job_id: str, auth: Auth):
    """Poll a price ingest job by its RQ job ID."""
    try:
        q = _get_queue("markets_signals")
        job = Job.fetch(job_id, connection=q.connection)
        status = job.get_status()
        result = None
        if status and status.value == "finished":
            result = job.result
        return {
            "job_id": job_id,
            "status": status.value if status else "unknown",
            "result": result,
        }
    except NoSuchJobError:
        raise HTTPException(404, detail="Job not found")
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, auth: Auth):
    db = get_supabase()

    # Look up backtest row by worker_job_id
    result = (
        db.schema("markets")
        .from_("backtests")
        .select("id, status, progress, metrics, error, worker_job_id")
        .eq("worker_job_id", job_id)
        .maybe_single()
        .execute()
    )
    bt = result.data

    if not bt:
        raise HTTPException(404, detail="Job not found")

    # Augment with live RQ status if still running
    rq_status = bt["status"]
    if rq_status in ("queued", "running"):
        try:
            q = _get_queue()
            rq_job = Job.fetch(job_id, connection=q.connection)
            rq_status = rq_job.get_status().value if rq_job.get_status() else rq_status
        except NoSuchJobError:
            pass
        except Exception:
            pass

    return JobStatusResponse(
        job_id=job_id,
        backtest_id=bt["id"],
        status=rq_status,
        progress=bt.get("progress") or 0,
        result=bt.get("metrics"),
        error=bt.get("error"),
    )
