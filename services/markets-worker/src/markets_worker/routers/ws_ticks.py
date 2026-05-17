"""
WebSocket endpoint for real-time LTP tick streaming.

WS /v1/ws/ltp
  Connect, then send JSON subscription message:
    {"action": "subscribe", "symbols": ["RELIANCE", "TCS", "NIFTY 50"], "exchange": "NSE"}
  Server pushes tick updates every 2 seconds:
    {"type": "tick", "data": {"RELIANCE": {"ltp": 1336.4, "change": -32.2, "change_pct": -2.35, ...}, ...}}
  Unsubscribe:
    {"action": "unsubscribe", "symbols": ["RELIANCE"]}
  Disconnect: close the WebSocket

Features:
  - ConnectionManager tracks active connections and their subscribed symbols
  - Background asyncio task per connection pushes updates on 2s interval
  - Reuses _ltp_cache from routers/ltp.py (no extra yfinance calls if cache is warm)
  - If cache miss for a symbol, fetches fresh via _fetch_one in executor
  - Sends delta-only updates when price unchanged (sends heartbeat every 10s instead)
  - Max 50 symbols per connection
  - Clean disconnect handling
"""

import asyncio
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/v1/ws")
logger = structlog.get_logger()

_ws_executor = ThreadPoolExecutor(max_workers=4)
_TICK_INTERVAL = 2.0       # push every 2 seconds
_HEARTBEAT_INTERVAL = 10.0  # heartbeat when no price change
_MAX_SYMBOLS = 50


class ConnectionManager:
    def __init__(self) -> None:
        # conn_id -> (websocket, symbols_set, exchange)
        self._connections: dict[str, tuple[WebSocket, set[str], str]] = {}

    def add(self, conn_id: str, ws: WebSocket, exchange: str = "NSE") -> None:
        self._connections[conn_id] = (ws, set(), exchange)

    def remove(self, conn_id: str) -> None:
        self._connections.pop(conn_id, None)

    def subscribe(self, conn_id: str, symbols: list[str]) -> None:
        if conn_id in self._connections:
            ws, syms, exch = self._connections[conn_id]
            syms.update(s.upper() for s in symbols[:_MAX_SYMBOLS])
            self._connections[conn_id] = (ws, syms, exch)

    def unsubscribe(self, conn_id: str, symbols: list[str]) -> None:
        if conn_id in self._connections:
            ws, syms, exch = self._connections[conn_id]
            for s in symbols:
                syms.discard(s.upper())

    def get_connection(self, conn_id: str) -> tuple[WebSocket, set[str], str] | None:
        return self._connections.get(conn_id)


manager = ConnectionManager()


@router.websocket("/ltp")
async def ws_ltp(websocket: WebSocket) -> None:
    await websocket.accept()
    conn_id = str(uuid.uuid4())
    manager.add(conn_id, websocket)
    logger.info("ws.ltp.connected", conn_id=conn_id)

    async def _push_loop() -> None:
        from markets_worker.routers.ltp import _ltp_cache, _CACHE_TTL, _suffix, _fetch_one

        last_prices: dict[str, float | None] = {}
        last_heartbeat = time.monotonic()

        while True:
            await asyncio.sleep(_TICK_INTERVAL)
            conn = manager.get_connection(conn_id)
            if conn is None:
                break
            ws, symbols, exchange = conn
            if not symbols:
                continue

            now = time.monotonic()
            loop = asyncio.get_event_loop()
            suffix = _suffix(exchange)
            ticks: dict[str, dict] = {}

            for sym in list(symbols):
                # Check in-memory cache first
                cache_entry = _ltp_cache.get(f"{sym}:{exchange.upper()}")
                if cache_entry and (now - cache_entry[0]) < _CACHE_TTL:
                    quote = cache_entry[1]
                else:
                    # Fetch fresh
                    try:
                        _, quote = await loop.run_in_executor(
                            _ws_executor, _fetch_one, sym, suffix, exchange
                        )
                        _ltp_cache[f"{sym}:{exchange.upper()}"] = (now, quote)
                    except Exception:
                        continue

                ltp = quote.get("ltp")
                prev = last_prices.get(sym)
                # Only include if price changed OR heartbeat interval passed
                if ltp != prev or (now - last_heartbeat) >= _HEARTBEAT_INTERVAL:
                    ticks[sym] = quote
                    last_prices[sym] = ltp

            if ticks or (now - last_heartbeat) >= _HEARTBEAT_INTERVAL:
                last_heartbeat = now
                try:
                    await ws.send_json({"type": "tick", "data": ticks, "ts": int(now * 1000)})
                except Exception:
                    break

    push_task = asyncio.create_task(_push_loop())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            action = msg.get("action")
            if action == "subscribe":
                syms = msg.get("symbols", [])
                exch = msg.get("exchange", "NSE")
                manager.subscribe(conn_id, syms)
                # Update stored exchange on subscribe
                conn = manager.get_connection(conn_id)
                if conn is not None:
                    ws, sym_set, _ = conn
                    manager._connections[conn_id] = (ws, sym_set, exch)
                await websocket.send_json({"type": "subscribed", "symbols": syms})
            elif action == "unsubscribe":
                manager.unsubscribe(conn_id, msg.get("symbols", []))
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("ws.ltp.error", conn_id=conn_id, error=str(exc))
    finally:
        push_task.cancel()
        manager.remove(conn_id)
        logger.info("ws.ltp.disconnected", conn_id=conn_id)
