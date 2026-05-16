"""RQ worker entrypoint.

Run with:
  OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES uv run python -m markets_worker.worker
"""

import logging

import redis
import structlog
from rq import Worker

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

    worker = Worker(queues, connection=conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
