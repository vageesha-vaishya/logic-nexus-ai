"""
Broker sync RQ jobs.

refresh_broker_tokens()         — refresh all expiring access tokens (08:00 IST)
sync_broker_connection(conn_id) — pull holdings + positions + orders for one connection
sync_all_active_connections()   — fan-out sync for all active connections
"""

from __future__ import annotations

import traceback
from datetime import datetime, timedelta, timezone

import structlog

from markets_worker.brokers import build_adapter, decrypt_credentials, encrypt_credentials
from markets_worker.db import get_supabase
from markets_worker.notifications import notify_user_sync

logger = structlog.get_logger()

_IST = timezone(timedelta(hours=5, minutes=30))


# ── Token refresh ─────────────────────────────────────────────────────────────

def refresh_broker_tokens() -> dict:
    """
    RQ job: refresh all active broker connections whose tokens expire within
    2 hours. Called by the scheduler at 08:00 IST before market open.
    Angel One (TOTP-based) is refreshed automatically; OAuth brokers
    (Zerodha, Fyers) are marked 'expired' for the user to re-authenticate.
    """
    db = get_supabase()
    now_utc   = datetime.now(timezone.utc)
    threshold = now_utc + timedelta(hours=2)

    rows = (
        db.schema("markets").from_("broker_connections")
        .select("id, broker, broker_client_id, credentials_enc, token_expires_at, status")
        .eq("status", "active")
        .lte("token_expires_at", threshold.isoformat())
        .execute()
    ).data or []

    refreshed = expired = errors = 0

    for row in rows:
        conn_id = row["id"]
        broker  = row["broker"]
        try:
            creds   = decrypt_credentials(row["credentials_enc"])
            adapter = build_adapter(broker, creds)

            try:
                result = _run_sync(adapter.refresh_tokens)
                # Update stored tokens
                creds.update({
                    "access_token":  result.access_token,
                    "refresh_token": result.refresh_token or creds.get("refresh_token"),
                    "feed_token":    result.feed_token    or creds.get("feed_token"),
                })
                db.schema("markets").from_("broker_connections").update({
                    "credentials_enc": encrypt_credentials(creds),
                    "token_expires_at": result.expires_at.isoformat() if result.expires_at else None,
                    "status":          "active",
                    "error_message":   None,
                }).eq("id", conn_id).execute()
                refreshed += 1
                logger.info("broker_sync.token_refreshed",
                            conn_id=conn_id, broker=broker)

            except NotImplementedError:
                # OAuth broker (Zerodha, Fyers) — can't refresh programmatically
                db.schema("markets").from_("broker_connections").update({
                    "status":        "expired",
                    "error_message": "Daily re-authentication required. Please reconnect via Settings → Broker Accounts.",
                }).eq("id", conn_id).execute()
                expired += 1
                logger.info("broker_sync.token_expired_manual",
                            conn_id=conn_id, broker=broker)

        except Exception as exc:
            logger.error("broker_sync.token_refresh_error",
                         conn_id=conn_id, broker=broker, error=str(exc))
            db.schema("markets").from_("broker_connections").update({
                "status":        "error",
                "error_message": str(exc)[:500],
            }).eq("id", conn_id).execute()
            errors += 1

    return {"refreshed": refreshed, "expired_manual": expired, "errors": errors}


# ── Portfolio sync ────────────────────────────────────────────────────────────

def sync_broker_connection(connection_id: str) -> dict:
    """
    RQ job: pull holdings, positions, and orders from a broker account
    and upsert into markets.holdings, markets.positions, markets.orders.
    """
    db  = get_supabase()
    row = (
        db.schema("markets").from_("broker_connections")
        .select(
            "id, broker, portfolio_id, owner_user_id, tenant_id, franchise_id, "
            "credentials_enc, status, segments"
        )
        .eq("id", connection_id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    ).data

    if not row:
        return {"status": "skipped", "reason": "Connection not found or not active"}

    broker       = row["broker"]
    portfolio_id = row["portfolio_id"]
    owner_id     = row["owner_user_id"]
    tenant_id    = row["tenant_id"]
    franchise_id = row["franchise_id"]

    try:
        creds   = decrypt_credentials(row["credentials_enc"])
        adapter = build_adapter(broker, creds)
        _run_sync(adapter.connect)

        synced: dict = {}

        # ── Holdings ──────────────────────────────────────────────────────────
        if "equity" in (row.get("segments") or ["equity"]):
            try:
                holdings = _run_sync(adapter.get_holdings)
                _upsert_holdings(db, holdings, portfolio_id, owner_id, tenant_id, franchise_id, connection_id)
                synced["holdings"] = len(holdings)
            except Exception as exc:
                logger.warning("broker_sync.holdings_failed",
                               connection_id=connection_id, error=str(exc))
                synced["holdings_error"] = str(exc)

        # ── Positions ─────────────────────────────────────────────────────────
        try:
            positions = _run_sync(adapter.get_positions)
            _upsert_positions(db, positions, portfolio_id, owner_id, tenant_id, franchise_id, connection_id)
            synced["positions"] = len(positions)
        except Exception as exc:
            logger.warning("broker_sync.positions_failed",
                           connection_id=connection_id, error=str(exc))
            synced["positions_error"] = str(exc)

        # ── Orders ────────────────────────────────────────────────────────────
        try:
            orders = _run_sync(adapter.get_orders)
            _upsert_orders(db, orders, portfolio_id, owner_id, tenant_id, franchise_id, connection_id)
            synced["orders"] = len(orders)
        except Exception as exc:
            logger.warning("broker_sync.orders_failed",
                           connection_id=connection_id, error=str(exc))
            synced["orders_error"] = str(exc)

        _run_sync(adapter.disconnect)

        # Mark last_synced_at
        db.schema("markets").from_("broker_connections").update({
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
            "error_message":  None,
        }).eq("id", connection_id).execute()

        logger.info("broker_sync.done", connection_id=connection_id,
                    broker=broker, **synced)
        return {"status": "ok", "connection_id": connection_id, **synced}

    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("broker_sync.error",
                     connection_id=connection_id, error=str(exc))
        db.schema("markets").from_("broker_connections").update({
            "error_message": f"{exc}\n{tb[:600]}",
        }).eq("id", connection_id).execute()
        return {"status": "error", "error": str(exc)}


def sync_all_active_connections() -> dict:
    """Enqueue a sync job for every active broker connection."""
    import redis as redis_lib
    from rq import Queue
    from markets_worker.config import get_settings

    db   = get_supabase()
    rows = (
        db.schema("markets").from_("broker_connections")
        .select("id, broker")
        .eq("status", "active")
        .execute()
    ).data or []

    s = get_settings()
    r = redis_lib.from_url(s.effective_redis_url, decode_responses=False)
    q = Queue("markets_signals", connection=r)

    queued = 0
    for row in rows:
        q.enqueue(
            sync_broker_connection, row["id"],
            job_id=f"broker-sync-{row['id'][:8]}",
            job_timeout=120, result_ttl=3600,
        )
        queued += 1

    logger.info("broker_sync.all_enqueued", queued=queued)
    return {"queued": queued}


# ── DB upsert helpers ─────────────────────────────────────────────────────────

def _upsert_holdings(db, holdings, portfolio_id, owner_id, tenant_id, franchise_id, connection_id):
    from markets_worker.brokers.base import Holding

    if not holdings:
        return

    # Upsert into markets.holdings (the existing table)
    rows = []
    for h in holdings:
        rows.append({
            "portfolio_id":  portfolio_id,
            "owner_user_id": owner_id,
            "tenant_id":     tenant_id,
            "franchise_id":  franchise_id,
            "qty":           float(h.quantity),
            "avg_cost":      float(h.avg_cost),
            "metadata":      {
                "broker_connection_id": connection_id,
                "last_price":   float(h.last_price),
                "pnl":          float(h.pnl),
                "isin":         h.isin,
                "tradingsymbol": h.tradingsymbol,
                "exchange":     h.exchange,
                "t1_quantity":  float(h.t1_quantity),
                "source":       "broker_sync",
            },
        })

    # We need instrument_id; look up by symbol + exchange
    for i, h in enumerate(holdings):
        instr = (
            db.schema("markets").from_("instruments")
            .select("id")
            .eq("symbol", h.tradingsymbol)
            .eq("exchange", h.exchange)
            .maybe_single()
            .execute()
        ).data
        if instr:
            rows[i]["instrument_id"] = instr["id"]
        else:
            # Auto-create minimal instrument record
            res = (
                db.schema("markets").from_("instruments")
                .upsert({
                    "symbol":          h.tradingsymbol,
                    "exchange":        h.exchange,
                    "isin":            h.isin or None,
                    "instrument_type": "equity",
                }, on_conflict="symbol,exchange")
                .select("id")
                .execute()
            )
            # postgrest 2.x: .single() not available after upsert
            new_instr = res.data[0] if isinstance(res.data, list) and res.data else res.data
            if new_instr:
                rows[i]["instrument_id"] = new_instr["id"]

    valid_rows = [r for r in rows if r.get("instrument_id")]
    if valid_rows:
        db.schema("markets").from_("holdings").upsert(
            valid_rows,
            on_conflict="portfolio_id,instrument_id",
            ignore_duplicates=False,
        ).execute()


def _upsert_positions(db, positions, portfolio_id, owner_id, tenant_id, franchise_id, connection_id):
    if not positions:
        # Clear stale positions for this connection
        db.schema("markets").from_("positions").delete().eq(
            "broker_connection_id", connection_id).execute()
        return

    rows = []
    for p in positions:
        rows.append({
            "portfolio_id":          portfolio_id,
            "owner_user_id":         owner_id,
            "tenant_id":             tenant_id,
            "franchise_id":          franchise_id,
            "broker_connection_id":  connection_id,
            "exchange":              p.exchange,
            "segment":               p.segment,
            "tradingsymbol":         p.tradingsymbol,
            "product":               p.product,
            "quantity":              float(p.quantity),
            "overnight_quantity":    float(p.overnight_qty),
            "buy_quantity":          float(p.day_buy_qty),
            "sell_quantity":         float(p.day_sell_qty),
            "avg_price":             float(p.avg_price),
            "last_price":            float(p.last_price),
            "close_price":           float(p.close_price),
            "pnl":                   float(p.pnl),
            "realised_pnl":          float(p.realised_pnl),
            "m2m":                   float(p.m2m),
            "multiplier":            float(p.multiplier),
            "synced_at":             datetime.now(timezone.utc).isoformat(),
        })

    db.schema("markets").from_("positions").upsert(
        rows,
        on_conflict="portfolio_id,broker_connection_id,tradingsymbol,exchange,product",
        ignore_duplicates=False,
    ).execute()


def _upsert_orders(db, orders, portfolio_id, owner_id, tenant_id, franchise_id, connection_id):
    if not orders:
        return

    for o in orders:
        # Only upsert if order doesn't already exist as complete/cancelled
        existing = (
            db.schema("markets").from_("orders")
            .select("id, status")
            .eq("broker_connection_id", connection_id)
            .eq("broker_order_id", o.broker_order_id)
            .maybe_single()
            .execute()
        ).data

        if existing and existing["status"] in ("complete", "cancelled", "rejected"):
            continue  # Don't overwrite terminal orders

        prev_status = existing["status"] if existing else None

        row = {
            "portfolio_id":          portfolio_id,
            "owner_user_id":         owner_id,
            "tenant_id":             tenant_id,
            "franchise_id":          franchise_id,
            "broker_connection_id":  connection_id,
            "broker_order_id":       o.broker_order_id,
            "exchange":              o.exchange,
            "tradingsymbol":         o.tradingsymbol,
            "order_type":            o.order_type,
            "product":               o.product,
            "transaction_type":      o.transaction_type,
            "quantity":              float(o.quantity),
            "price":                 float(o.price),
            "avg_fill_price":        float(o.avg_fill_price) if o.avg_fill_price else None,
            "trigger_price":         float(o.trigger_price) if o.trigger_price else None,
            "filled_quantity":       float(o.filled_quantity),
            "pending_quantity":      float(o.pending_quantity) if o.pending_quantity else None,
            "status":                o.status,
            "status_message":        o.status_message,
            "algo_tag":              o.tag or None,
            "placed_at":             o.order_timestamp.isoformat() if o.order_timestamp else None,
        }

        if existing:
            db.schema("markets").from_("orders").update(row).eq("id", existing["id"]).execute()
        else:
            db.schema("markets").from_("orders").insert(row).execute()

        # Notify on transition into a terminal state.
        new_status = o.status
        terminal  = new_status in ("complete", "rejected", "cancelled")
        changed   = new_status != prev_status
        if terminal and changed and owner_id:
            side = (o.transaction_type or "").upper()
            sym  = o.tradingsymbol or ""
            qty  = float(o.filled_quantity or o.quantity or 0)
            price = float(o.avg_fill_price or o.price or 0)

            if new_status == "complete":
                title    = f"Order filled: {side} {sym}"
                body     = f"{side} {qty:g} {sym} @ ₹{price:,.2f}"
                severity = "success"
            elif new_status == "rejected":
                title    = f"Order rejected: {side} {sym}"
                body     = (o.status_message or "Broker rejected the order.")[:200]
                severity = "critical"
            else:  # cancelled
                title    = f"Order cancelled: {side} {sym}"
                body     = (o.status_message or f"{side} {qty:g} {sym} was cancelled.")[:200]
                severity = "warning"

            notify_user_sync(
                user_id=str(owner_id),
                category="order_fill",
                severity=severity,
                title=title,
                body=body,
                data={
                    "broker_order_id": o.broker_order_id,
                    "symbol": sym,
                    "side": side,
                    "qty": qty,
                    "price": price,
                    "status": new_status,
                },
                link_url="/dashboard/markets/orders",
            )


# ── Sync helper (run async adapter methods synchronously in RQ worker) ────────

def _run_sync(coro_fn):
    """Run an async method in the current thread's event loop (or new one)."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro_fn())
                return future.result()
        return loop.run_until_complete(coro_fn())
    except RuntimeError:
        return asyncio.run(coro_fn())
