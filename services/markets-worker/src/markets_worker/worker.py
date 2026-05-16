"""RQ worker entrypoint.

Run with:
  uv run python -m markets_worker.worker
  # or via Docker CMD
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
    logger.info("worker.starting", queues=["markets_backtests"], redis=s.effective_redis_url[:40])

    conn = redis.from_url(s.effective_redis_url, decode_responses=False)
    worker = Worker(["markets_backtests"], connection=conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
