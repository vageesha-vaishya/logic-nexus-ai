"""FastAPI application factory for the markets-worker service."""

import asyncio
import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from markets_worker.alert_checker import check_alerts_loop
from markets_worker.config import get_settings
from markets_worker.mcp_server import mcp
from markets_worker.routers import health, jobs, llm, research
from markets_worker.routers import broker as broker_router
from markets_worker.routers import chart as chart_router
from markets_worker.routers import ltp as ltp_router
from markets_worker.routers import fno as fno_router
from markets_worker.routers import mf as mf_router
from markets_worker.routers import portfolio_pnl as portfolio_pnl_router
from markets_worker.routers import paper as paper_router
from markets_worker.routers import calendar as calendar_router
from markets_worker.routers import fii_dii as fii_dii_router
from markets_worker.routers import signals as signals_router
from markets_worker.routers import span as span_router
from markets_worker.routers import ws_ticks as ws_ticks_router
from markets_worker.routers import depth as depth_router
from markets_worker.routers import options_positions as options_positions_router
from markets_worker.routers.ideas import router_ideas as ideas_router, router_users as users_router
from markets_worker.routers import chat as chat_router
from markets_worker.routers import copy_trades as copy_trades_router
from markets_worker.routers import rebalancing as rebalancing_router
from markets_worker.routers import tax_pnl as tax_pnl_router
from markets_worker.routers import retail as retail_router
from markets_worker.routers import behavioral as behavioral_router


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(check_alerts_loop())
    yield
    task.cancel()


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
        lifespan=lifespan,
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
    app.include_router(mf_router.router,           tags=["mf"])
    app.include_router(portfolio_pnl_router.router, tags=["portfolio"])
    app.include_router(paper_router.router,         tags=["paper"])
    app.include_router(calendar_router.router,      tags=["calendar"])
    app.include_router(fii_dii_router.router,       tags=["fii-dii"])
    app.include_router(signals_router.router,       tags=["signals"])
    app.include_router(span_router.router,          tags=["span"])
    app.include_router(ws_ticks_router.router,      tags=["websocket"])
    app.include_router(depth_router.router,         tags=["depth"])
    app.include_router(options_positions_router.router, tags=["options"])
    app.include_router(ideas_router,                        tags=["ideas"])
    app.include_router(users_router,                        tags=["social"])
    app.include_router(chat_router.router,                  tags=["chat"])
    app.include_router(copy_trades_router.router,           tags=["copy-trades"])
    app.include_router(rebalancing_router.router,           tags=["rebalancing"])
    app.include_router(tax_pnl_router.router,               tags=["tax"])
    app.include_router(retail_router.router,                tags=["retail"])
    app.include_router(behavioral_router.router,            tags=["retail-behavioral"])

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
