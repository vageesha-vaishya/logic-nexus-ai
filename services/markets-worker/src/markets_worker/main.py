"""FastAPI application factory for the markets-worker service."""

import logging

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from markets_worker.config import get_settings
from markets_worker.mcp_server import mcp
from markets_worker.routers import health, jobs, llm, research
from markets_worker.routers import broker as broker_router
from markets_worker.routers import chart as chart_router
from markets_worker.routers import ltp as ltp_router
from markets_worker.routers import fno as fno_router
from markets_worker.routers import mf as mf_router


def configure_logging() -> None:
    s = get_settings()
    logging.basicConfig(level=getattr(logging, s.log_level.upper(), logging.INFO))
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, s.log_level.upper(), logging.INFO)
        ),
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.dev.ConsoleRenderer()
            if s.environment == "development"
            else structlog.processors.JSONRenderer(),
        ],
    )


def create_app() -> FastAPI:
    configure_logging()
    s = get_settings()

    app = FastAPI(
        title="Markets Worker",
        version="0.1.0",
        description="Logic Nexus AI — markets domain Python worker",
        # Disable docs in production
        docs_url="/docs" if s.environment != "production" else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Locked down at Fly.io / Supabase level
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────
    app.include_router(health.router,          tags=["ops"])
    app.include_router(llm.router,             tags=["llm"])
    app.include_router(research.router,        tags=["research"])
    app.include_router(jobs.router,            tags=["jobs"])
    app.include_router(broker_router.router,   tags=["brokers"])
    app.include_router(chart_router.router,    tags=["chart"])
    app.include_router(ltp_router.router,      tags=["ltp"])
    app.include_router(fno_router.router,      tags=["fno"])
    app.include_router(mf_router.router,       tags=["mf"])

    # ── MCP server mounted at /mcp ────────────────────────────────────────
    # Claude Agent SDK connects here via streamable HTTP transport.
    # Route: POST /mcp  (MCP JSON-RPC over HTTP)
    try:
        mcp_asgi = mcp.streamable_http_app()
        app.mount("/mcp", mcp_asgi)
    except AttributeError:
        # Fallback: older mcp package uses sse_app()
        try:
            mcp_asgi = mcp.sse_app()
            app.mount("/mcp", mcp_asgi)
        except Exception:
            pass  # MCP unavailable — worker still serves LLM + jobs

    return app


app = create_app()
