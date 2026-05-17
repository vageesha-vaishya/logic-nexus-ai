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
from datetime import datetime, timezone
from decimal import Decimal
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


class PlaceOrderRequest(BaseModel):
    tradingsymbol:    str
    exchange:         str
    transaction_type: str            # BUY | SELL
    order_type:       str            # MARKET | LIMIT | SL | SL-M
    product:          str            # CNC | MIS | NRML
    quantity:         int
    price:            float | None = None
    trigger_price:    float | None = None
    validity:         str = "DAY"    # DAY | IOC
    disclosed_qty:    int = 0
    tag:              str = ""       # SEBI algo tag


class ModifyOrderRequest(BaseModel):
    order_type:    str | None = None
    quantity:      int | None = None
    price:         float | None = None
    trigger_price: float | None = None
    validity:      str | None = None


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

    try:
        cls = get_adapter_class(body.broker)
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc))

    creds = dict(body.credentials)

    # ── Verify credentials immediately for brokers that support it ──────────
    # angel_one (TOTP): authenticate now, store fresh access_token
    # dhan (api_key): call holdings to verify token is valid
    # Others: can't verify without user interaction (OAuth/OTP) — store as-is
    from datetime import datetime, timedelta, timezone
    _IST = timezone(timedelta(hours=5, minutes=30))

    if body.broker == "angel_one":
        try:
            import pyotp                       # type: ignore
            from SmartApi import SmartConnect  # type: ignore
            import asyncio

            api_key     = creds.get("api_key", "")
            client_id   = creds.get("client_id", "")
            password    = creds.get("password", "")
            totp_secret = creds.get("totp_secret", "")
            if not all([api_key, client_id, password, totp_secret]):
                raise HTTPException(400, detail="angel_one requires api_key, client_id, password, totp_secret")

            def _auth():
                obj  = SmartConnect(api_key=api_key)
                totp = pyotp.TOTP(totp_secret).now()
                data = obj.generateSession(clientCode=client_id, password=password, totp=totp)
                if data.get("status") is False:
                    raise ValueError(data.get("message", "Authentication failed"))
                return data.get("data", {})

            tok = await asyncio.to_thread(_auth)
            creds["access_token"]  = tok.get("jwtToken", "")
            creds["refresh_token"] = tok.get("refreshToken", "")
            creds["feed_token"]    = tok.get("feedToken", "")
            logger.info("angel.verified_on_add", client_id=client_id)

        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(400, detail=f"Angel One authentication failed: {exc}") from exc

    elif body.broker == "dhan":
        try:
            from dhanhq import dhanhq  # type: ignore
            import asyncio

            client_id    = creds.get("client_id", "")
            access_token = creds.get("access_token", "")
            if not client_id or not access_token:
                raise HTTPException(400, detail="dhan requires client_id and access_token")

            def _verify():
                d = dhanhq(client_id=client_id, access_token=access_token)
                result = d.get_fund_limits()
                if result and result.get("status") == "failure":
                    raise ValueError(result.get("remarks", "Invalid credentials"))

            await asyncio.to_thread(_verify)
            logger.info("dhan.verified_on_add", client_id=client_id)

        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(400, detail=f"Dhan authentication failed: {exc}") from exc

    # ── Compute token_expires_at for brokers with daily tokens ───────────────
    daily_token_brokers = {"angel_one", "icici_breeze", "fyers", "zerodha", "kotak_neo"}
    token_expires_at = None
    if body.broker in daily_token_brokers:
        midnight_ist = datetime.now(_IST).replace(hour=23, minute=59, second=59)
        token_expires_at = midnight_ist.astimezone(timezone.utc).isoformat()

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
        "credentials_enc":  encrypt_credentials(creds),
        "segments":         body.segments,
        "can_trade":        body.can_trade,
        "token_expires_at": token_expires_at,
    }

    result = (
        db.schema("markets").from_("broker_connections")
        .insert(row)
        .select(
            "id, broker, broker_client_id, display_name, status, "
            "segments, can_trade, token_expires_at, created_at"
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


@router.get("/connections/{connection_id}/holdings")
async def get_holdings(connection_id: str, auth: Auth):
    """Return holdings for a broker connection owned by the authenticated user."""
    db = get_supabase()
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

    result = (
        db.schema("markets").from_("holdings")
        .select(
            "id, qty, avg_cost, realized_pnl, last_updated_at, metadata, asset_class, "
            "instrument:instrument_id(symbol, exchange, isin, instrument_type)"
        )
        .eq("owner_user_id", auth.user_id)
        .eq("metadata->>broker_connection_id", connection_id)
        .execute()
    )
    return {"holdings": result.data or [], "total": len(result.data or [])}


@router.get("/connections/{connection_id}/positions")
async def get_positions(connection_id: str, auth: Auth):
    """Return positions for a broker connection owned by the authenticated user."""
    db = get_supabase()
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

    result = (
        db.schema("markets").from_("positions")
        .select(
            "id, exchange, segment, tradingsymbol, product, quantity, overnight_quantity, "
            "buy_quantity, sell_quantity, avg_price, last_price, close_price, "
            "pnl, realised_pnl, m2m, multiplier, synced_at"
        )
        .eq("owner_user_id", auth.user_id)
        .eq("broker_connection_id", connection_id)
        .execute()
    )
    return {"positions": result.data or [], "total": len(result.data or [])}


@router.get("/connections/{connection_id}/orders")
async def get_orders(connection_id: str, auth: Auth):
    """Return last 200 orders (newest first) for a broker connection owned by the authenticated user."""
    db = get_supabase()
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

    result = (
        db.schema("markets").from_("orders")
        .select(
            "id, broker_order_id, exchange, segment, tradingsymbol, order_type, product, "
            "transaction_type, quantity, price, trigger_price, validity, status, "
            "filled_quantity, avg_fill_price, pending_quantity, status_message, algo_tag, "
            "placed_at, created_at"
        )
        .eq("owner_user_id", auth.user_id)
        .eq("broker_connection_id", connection_id)
        .order("placed_at", desc=True)
        .limit(200)
        .execute()
    )
    return {"orders": result.data or [], "total": len(result.data or [])}


@router.get("/connections/{connection_id}/margins")
async def get_margins(connection_id: str, auth: Auth):
    """Return available margin/funds for the connected broker account."""
    db = get_supabase()
    conn_row = (
        db.schema("markets").from_("broker_connections")
        .select("id, broker, credentials_enc, tenant_id, franchise_id, portfolio_id, can_trade")
        .eq("id", connection_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not conn_row:
        raise HTTPException(404, detail="Connection not found")

    try:
        creds   = decrypt_credentials(conn_row["credentials_enc"])
        adapter = build_adapter(conn_row["broker"], creds)
        await adapter.connect()
        margins = await adapter.get_margins()
        await adapter.disconnect()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, detail=f"Broker error: {exc}") from exc

    return {"margins": margins, "broker": conn_row["broker"]}


@router.post("/connections/{connection_id}/orders", status_code=201)
async def place_order(connection_id: str, body: PlaceOrderRequest, auth: Auth):
    """Place a new order via the connected broker account."""
    from markets_worker.brokers.base import OrderRequest

    db = get_supabase()
    conn_row = (
        db.schema("markets").from_("broker_connections")
        .select("id, broker, credentials_enc, tenant_id, franchise_id, portfolio_id, can_trade")
        .eq("id", connection_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not conn_row:
        raise HTTPException(404, detail="Connection not found")
    if not conn_row["can_trade"]:
        raise HTTPException(403, detail="Trading not enabled for this connection")

    try:
        creds   = decrypt_credentials(conn_row["credentials_enc"])
        adapter = build_adapter(conn_row["broker"], creds)
        await adapter.connect()

        req = OrderRequest(
            tradingsymbol=body.tradingsymbol,
            exchange=body.exchange,
            transaction_type=body.transaction_type.upper(),
            quantity=body.quantity,
            order_type=body.order_type.upper(),
            product=body.product.upper(),
            price=Decimal(str(body.price)) if body.price else None,
            trigger_price=Decimal(str(body.trigger_price)) if body.trigger_price else None,
            validity=body.validity.upper(),
            disclosed_qty=body.disclosed_qty,
            tag=body.tag,
        )
        result = await adapter.place_order(req)
        await adapter.disconnect()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, detail=f"Broker error: {exc}") from exc

    if result.status == "rejected":
        raise HTTPException(400, detail=result.message or "Order rejected")

    order_row = {
        "id":                   str(uuid.uuid4()),
        "tenant_id":            conn_row["tenant_id"],
        "franchise_id":         conn_row["franchise_id"],
        "owner_user_id":        auth.user_id,
        "portfolio_id":         conn_row["portfolio_id"] or str(uuid.uuid4()),
        "broker_connection_id": connection_id,
        "broker_order_id":      result.broker_order_id,
        "exchange":             body.exchange.upper(),
        "segment":              "equity",
        "tradingsymbol":        body.tradingsymbol.upper(),
        "order_type":           body.order_type.upper(),
        "product":              body.product.upper(),
        "transaction_type":     body.transaction_type.upper(),
        "quantity":             body.quantity,
        "price":                body.price,
        "trigger_price":        body.trigger_price,
        "validity":             body.validity.upper(),
        "status":               result.status,
        "filled_quantity":      0,
        "status_message":       result.message,
        "algo_tag":             body.tag or None,
        "source":               "manual",
        "placed_at":            datetime.now(timezone.utc).isoformat(),
        "metadata":             {},
    }
    db.schema("markets").from_("orders").insert(order_row).execute()

    logger.info("broker.order_placed",
                connection_id=connection_id, broker_order_id=result.broker_order_id,
                user_id=auth.user_id)
    return {"order_id": result.broker_order_id, "status": result.status, "message": result.message}


@router.patch("/connections/{connection_id}/orders/{broker_order_id}")
async def modify_order(connection_id: str, broker_order_id: str, body: ModifyOrderRequest, auth: Auth):
    """Modify an open order."""
    db = get_supabase()
    conn_row = (
        db.schema("markets").from_("broker_connections")
        .select("id, broker, credentials_enc, tenant_id, franchise_id, portfolio_id, can_trade")
        .eq("id", connection_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not conn_row:
        raise HTTPException(404, detail="Connection not found")

    order_row = (
        db.schema("markets").from_("orders")
        .select("id, status")
        .eq("broker_connection_id", connection_id)
        .eq("broker_order_id", broker_order_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not order_row:
        raise HTTPException(404, detail="Order not found")
    if order_row["status"] not in ("open", "trigger pending"):
        raise HTTPException(400, detail="Order cannot be modified")

    try:
        creds   = decrypt_credentials(conn_row["credentials_enc"])
        adapter = build_adapter(conn_row["broker"], creds)
        await adapter.connect()

        kwargs = {k: v for k, v in body.model_dump().items() if v is not None}
        if "price" in kwargs:
            kwargs["price"] = Decimal(str(kwargs["price"]))
        if "trigger_price" in kwargs:
            kwargs["trigger_price"] = Decimal(str(kwargs["trigger_price"]))

        result = await adapter.modify_order(broker_order_id, **kwargs)
        await adapter.disconnect()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, detail=f"Broker error: {exc}") from exc

    # Update local order record with latest status/price
    update_fields: dict = {"status": result.status}
    if body.price is not None:
        update_fields["price"] = body.price
    if body.trigger_price is not None:
        update_fields["trigger_price"] = body.trigger_price
    db.schema("markets").from_("orders").update(update_fields).eq(
        "id", order_row["id"]).execute()

    logger.info("broker.order_modified",
                connection_id=connection_id, broker_order_id=broker_order_id,
                user_id=auth.user_id)
    return {"order_id": broker_order_id, "status": result.status}


@router.delete("/connections/{connection_id}/orders/{broker_order_id}", status_code=200)
async def cancel_order(connection_id: str, broker_order_id: str, auth: Auth):
    """Cancel an open order."""
    db = get_supabase()
    conn_row = (
        db.schema("markets").from_("broker_connections")
        .select("id, broker, credentials_enc, tenant_id, franchise_id, portfolio_id, can_trade")
        .eq("id", connection_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not conn_row:
        raise HTTPException(404, detail="Connection not found")

    order_row = (
        db.schema("markets").from_("orders")
        .select("id, status")
        .eq("broker_connection_id", connection_id)
        .eq("broker_order_id", broker_order_id)
        .eq("owner_user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    if not order_row:
        raise HTTPException(404, detail="Order not found")
    if order_row["status"] not in ("open", "trigger pending"):
        raise HTTPException(400, detail="Order cannot be modified")

    try:
        creds   = decrypt_credentials(conn_row["credentials_enc"])
        adapter = build_adapter(conn_row["broker"], creds)
        await adapter.connect()
        result = await adapter.cancel_order(broker_order_id)
        await adapter.disconnect()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, detail=f"Broker error: {exc}") from exc

    db.schema("markets").from_("orders").update({"status": "cancelled"}).eq(
        "broker_order_id", broker_order_id).eq(
        "broker_connection_id", connection_id).execute()

    logger.info("broker.order_cancelled",
                connection_id=connection_id, broker_order_id=broker_order_id,
                user_id=auth.user_id)
    return {"order_id": broker_order_id, "status": "cancelled"}


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
