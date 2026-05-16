"""Backtest job endpoints.

POST /v1/jobs/backtest  — enqueue a backtest job
GET  /v1/jobs/{job_id} — poll job status
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


def _get_queue() -> Queue:
    s = get_settings()
    r = redis.from_url(s.effective_redis_url, decode_responses=False)
    return Queue("markets_backtests", connection=r)


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
