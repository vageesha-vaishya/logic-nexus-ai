"""
Broker connectivity endpoints.

GET  /v1/brokers                          — list supported brokers
GET  /v1/brokers/connections              — list user's connections
POST /v1/brokers/connections              — add new connection (store credentials)
GET  /v1/brokers/connections/{id}         — get connection status
DELETE /v1/brokers/connections/{id}       — remove connection
POST /v1/brokers/connections/{id}/sync    — trigger manual sync
POST /v1/brokers/connections/{id}/refresh — refresh access token
GET  /v1/brokers/auth-url                 — get OAuth/login URL for a broker
POST /v1/brokers/exchange-code            — exchange auth code for token
"""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.brokers import (
    build_adapter, decrypt_credentials, encrypt_credentials,
    list_brokers,
)
from markets_worker.brokers.registry import get_adapter_class
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/brokers")


# ── Request / Response models ─────────────────────────────────────────────────

class AddConnectionRequest(BaseModel):
    broker:           str
    broker_client_id: str
    display_name:     str
    portfolio_id:     str | None = None
    credentials:      dict[str, Any]   # plain-text; encrypted before storage
    segments:         list[str] = ["equity"]
    can_trade:        bool = False


class ExchangeCodeRequest(BaseModel):
    broker:       str
    code:         str          # auth_code / request_token / session_token
    extra:        dict[str, Any] = {}  # api_key, api_secret, etc. per broker


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_supported_brokers():
    """Return metadata for all supported brokers."""
    return {"brokers": list_brokers()}


@router.get("/connections")
async def list_connections(auth: Auth):
    db = get_supabase()
    result = (
        db.schema("markets").from_("broker_connections")
        .select(
            "id, broker, broker_client_id, display_name, status, "
            "segments, can_trade, can_read_holdings, can_read_positions, "
            "token_expires_at, last_synced_at, error_message, created_at"
        )
        .eq("owner_user_id", auth.user_id)
        .order("created_at", desc=False)
        .execute()
    )
    # Never return credentials_enc to the frontend
    return {"connections": result.data or []}


@router.post("/connections", status_code=201)
async def add_connection(body: AddConnectionRequest, auth: Auth):
    if not auth.user_id:
        raise HTTPException(401, detail="Authentication required")
    if not auth.tenant_id or not auth.franchise_id:
        raise HTTPException(400, detail="x-tenant-id and x-franchise-id headers required")

    # Validate broker name
    try:
        get_adapter_class(body.broker)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))

    db = get_supabase()
    row = {
        "id":               str(uuid.uuid4()),
        "tenant_id":        auth.tenant_id,
        "franchise_id":     auth.franchise_id,
        "owner_user_id":    auth.user_id,
        "portfolio_id":     body.portfolio_id,
        "broker":           body.broker,
        "broker_client_id": body.broker_client_id,
        "display_name":     body.display_name,
        "status":           "active",
        "credentials_enc":  encrypt_credentials(body.credentials),
        "segments":         body.segments,
        "can_trade":        body.can_trade,
    }

    result = (
        db.schema("markets").from_("broker_connections")
        .insert(row)
        .select(
            "id, broker, broker_client_id, display_name, status, "
            "segments, can_trade, created_at"
        )
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(500, detail="Failed to create broker connection")

    logger.info("broker.connection_added",
                broker=body.broker, user_id=auth.user_id)
    return {"connection": result.data}


@router.get("/connections/{connection_id}")
async def get_connection(connection_id: str, auth: Auth):
    db = get_supabase()
    row = (
        db.schema("markets").from_("broker_connections")
        .select(
            "id, broker, broker_client_id, display_name, status, "
            "segments, can_trade, token_expires_at, last_synced_at, error_message, created_at"
        )
        .eq("id", connection_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(404, detail="Connection not found")
    return {"connection": row}


@router.delete("/connections/{connection_id}", status_code=204)
async def remove_connection(connection_id: str, auth: Auth):
    db = get_supabase()
    # Verify ownership
    row = (
        db.schema("markets").from_("broker_connections")
        .select("id")
        .eq("id", connection_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(404, detail="Connection not found")

    # Delete positions linked to this connection before removing
    db.schema("markets").from_("positions").delete().eq(
        "broker_connection_id", connection_id).execute()
    db.schema("markets").from_("broker_connections").delete().eq(
        "id", connection_id).execute()

    logger.info("broker.connection_removed",
                connection_id=connection_id, user_id=auth.user_id)


@router.post("/connections/{connection_id}/sync")
async def trigger_sync(connection_id: str, auth: Auth):
    """Enqueue an immediate broker sync for this connection."""
    import redis as redis_lib
    from rq import Queue
    from markets_worker.config import get_settings

    db  = get_supabase()
    row = (
        db.schema("markets").from_("broker_connections")
        .select("id, status")
        .eq("id", connection_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(404, detail="Connection not found")
    if row["status"] not in ("active",):
        raise HTTPException(400, detail=f"Cannot sync connection with status '{row['status']}'")

    s = get_settings()
    r = redis_lib.from_url(s.effective_redis_url, decode_responses=False)
    q = Queue("markets_signals", connection=r)
    from markets_worker.jobs.broker_sync import sync_broker_connection
    job = q.enqueue(
        sync_broker_connection, connection_id,
        job_id=f"broker-sync-{connection_id[:8]}-adhoc",
        job_timeout=120, result_ttl=3600,
    )
    return {"job_id": job.id, "status": "queued"}


@router.get("/auth-url")
async def get_auth_url(broker: str, api_key: str = "", redirect_uri: str = ""):
    """Return the OAuth / login URL the user should visit for a given broker."""
    try:
        cls = get_adapter_class(broker)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))

    url = cls.get_auth_url(api_key=api_key, redirect_uri=redirect_uri)
    return {"broker": broker, "auth_url": url}


@router.post("/exchange-code")
async def exchange_code(body: ExchangeCodeRequest):
    """Exchange an auth code / session token for access tokens."""
    try:
        cls = get_adapter_class(body.broker)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))

    try:
        result = await cls.exchange_auth_code(body.code, **body.extra)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(400, detail=str(exc))
    except NotImplementedError as exc:
        raise HTTPException(501, detail=str(exc))

    return {
        "access_token":  result.access_token,
        "refresh_token": result.refresh_token,
        "feed_token":    result.feed_token,
        "expires_at":    result.expires_at.isoformat() if result.expires_at else None,
        "extra":         result.extra,
    }
