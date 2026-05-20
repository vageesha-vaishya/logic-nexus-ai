"""RQ worker entrypoint.

Run with:
  OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES uv run python -m markets_worker.worker

On macOS the default forking RQ Worker can SIGSEGV when C-extension
libraries (numpy/polars/postgrest under HTTP/2, etc.) are imported in
the parent before fork(). We use SimpleWorker which runs jobs inline in
the parent process — no fork, no segv. Single-job-at-a-time is fine
for the markets workload (broker sync, signal generation are I/O bound).
"""

import logging
import platform

import redis
import structlog
from rq import SimpleWorker, Worker

from markets_worker.config import get_settings


def main() -> None:
    s = get_settings()
    logging.basicConfig(level=logging.INFO)
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer(),
        ]
    )
    logger = structlog.get_logger()
    queues = ["markets_signals", "markets_backtests"]
    logger.info("worker.starting", queues=queues, redis=s.effective_redis_url[:40])

    conn = redis.from_url(s.effective_redis_url, decode_responses=False)

    # Register daily 07:00 IST refresh+signal jobs for all portfolios
    try:
        from markets_worker.scheduler import setup_daily_jobs
        setup_daily_jobs()
    except Exception as exc:
        logger.warning("scheduler.setup_error", error=str(exc))

    # macOS: forking work-horse crashes (SIGSEGV) with some C extensions.
    # Linux: keep the default forking Worker for better isolation.
    worker_cls = SimpleWorker if platform.system() == "Darwin" else Worker
    logger.info("worker.class", cls=worker_cls.__name__)
    worker = worker_cls(queues, connection=conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
