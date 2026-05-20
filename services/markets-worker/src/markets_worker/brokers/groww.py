"""
Groww Trade API adapter (MVP).

Required credentials dict keys (stored encrypted):
    api_key      – Groww API key from https://groww.in/trade-api/api-keys
    api_secret   – Groww API secret
    access_token – generated daily via GrowwAPI.get_access_token(api_key, secret).
                   Populated on connection-create and on refresh_tokens().

Lifecycle:
    Groww access tokens are SHORT-LIVED. Per Groww docs the API keys require
    a manual daily approval on the Groww Cloud "API Keys" page; once approved,
    `GrowwAPI.get_access_token(api_key, secret)` returns a fresh access token
    for that day. The scheduler calls `refresh_tokens()` at 08:00 IST to
    regenerate. If the user has not approved that day, the regeneration call
    fails and the connection is marked 'expired' until the user re-approves.

Method signatures inferred from the official PyPI page and SDK docs:
    https://pypi.org/project/growwapi/
    https://groww.in/trade-api/docs/python-sdk

UNVERIFIED ASSUMPTIONS (will need adjustment after first real-API test):
    - Holdings/positions/order_list response dict key names
    - place_order returns dict with 'order_id' or 'groww_order_id' top-level
    - Symbols passed as bare tradingsymbol (e.g. "WIPRO"), no exchange prefix
    - get_stocks_ltp returns dict keyed by symbol → {ltp, ...}

If a real call shape differs, fix the parsing here — the structure mirrors
DhanAdapter so the diff should be localized to the response-extraction lines.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import structlog

from .base import (
    AuthResult, BrokerAdapter, Candle, Holding, Order,
    OrderRequest, OrderResult, Position, Quote,
)

logger = structlog.get_logger()


class GrowwAdapter(BrokerAdapter):
    name         = "groww"
    display_name = "Groww (Trade API)"

    supports_mf        = True
    supports_fno       = True
    supports_currency  = False   # Groww does not currently offer CDS
    supports_commodity = False
    supports_gtt       = False   # Not in MVP
    supports_websocket = True    # GrowwFeed exists but stream_quotes left to v2

    def __init__(self, credentials: dict[str, Any]) -> None:
        super().__init__(credentials)
        self._groww: Any = None

    # ── Connection lifecycle ──────────────────────────────────────────────────

    async def connect(self) -> None:
        try:
            from growwapi import GrowwAPI  # type: ignore
        except ImportError as exc:
            raise RuntimeError("growwapi not installed. Run: uv add growwapi") from exc

        access_token = self._creds.get("access_token", "")
        if not access_token:
            # No token cached — try generating now using api_key + secret
            api_key    = self._creds.get("api_key", "")
            api_secret = self._creds.get("api_secret", "")
            if not (api_key and api_secret):
                raise RuntimeError(
                    "groww requires api_key + api_secret (and a daily-approved access_token)"
                )
            access_token = await asyncio.to_thread(
                GrowwAPI.get_access_token, api_key=api_key, secret=api_secret
            )
            self._creds["access_token"] = access_token

        self._groww = await asyncio.to_thread(GrowwAPI, access_token)
        self._connected = True
        logger.info("groww.connected")

    async def disconnect(self) -> None:
        self._groww = None
        self._connected = False

    # ── Auth ──────────────────────────────────────────────────────────────────

    @classmethod
    def get_auth_url(cls, **kwargs: Any) -> str:
        # No OAuth — user generates API key/secret here and approves daily
        return "https://groww.in/trade-api/api-keys"

    @classmethod
    async def exchange_auth_code(cls, code: str, **kwargs: Any) -> AuthResult:
        # Not OAuth — code path unused for Groww. Kept to satisfy abstract base.
        raise NotImplementedError(
            "groww does not use OAuth; provide api_key + api_secret instead"
        )

    async def refresh_tokens(self) -> AuthResult:
        """
        Regenerate the daily access token. Called by the 08:00 IST scheduler.
        Requires the user to have approved today's session on the Groww Cloud
        API Keys page; otherwise this raises and the connection is marked
        expired.
        """
        try:
            from growwapi import GrowwAPI  # type: ignore
        except ImportError as exc:
            raise RuntimeError("growwapi not installed") from exc

        api_key    = self._creds.get("api_key", "")
        api_secret = self._creds.get("api_secret", "")
        if not (api_key and api_secret):
            raise RuntimeError("groww refresh requires api_key + api_secret in stored credentials")

        access_token = await asyncio.to_thread(
            GrowwAPI.get_access_token, api_key=api_key, secret=api_secret
        )
        self._creds["access_token"] = access_token
        return AuthResult(access_token=access_token, expires_at=None)

    # ── Market data ───────────────────────────────────────────────────────────

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        """LTP-only quotes via get_ltp. Full quote depth available via get_quote in v2."""
        results: list[Quote] = []
        for sym in symbols:
            exchange, tsym = (sym.split(":", 1) + [""])[:2] if ":" in sym else ("NSE", sym)
            try:
                def _q(s: str = tsym, ex: str = exchange) -> Any:
                    return self._groww.get_ltp(
                        segment=self._infer_segment(ex),
                        exchange=ex,
                        trading_symbol=s,
                    )
                raw = await asyncio.to_thread(_q)
                if not raw:
                    continue
                # The SDK may return either a bare number, a dict like
                # {"ltp": X, "close": Y, ...}, or a wrapped {symbol: {...}}.
                if isinstance(raw, dict):
                    inner = raw.get(tsym) if tsym in raw else raw
                    ltp = inner.get("ltp") if isinstance(inner, dict) else inner
                    results.append(Quote(
                        symbol=tsym, exchange=exchange,
                        ltp=Decimal(str(ltp or 0)),
                        close=Decimal(str(inner.get("close", 0))) if isinstance(inner, dict) else Decimal("0"),
                        open=Decimal(str(inner.get("open", 0))) if isinstance(inner, dict) else Decimal("0"),
                        high=Decimal(str(inner.get("high", 0))) if isinstance(inner, dict) else Decimal("0"),
                        low=Decimal(str(inner.get("low", 0))) if isinstance(inner, dict) else Decimal("0"),
                        volume=int(inner.get("volume", 0)) if isinstance(inner, dict) else 0,
                    ))
                else:
                    results.append(Quote(symbol=tsym, exchange=exchange, ltp=Decimal(str(raw))))
            except Exception as exc:
                logger.warning("groww.quote_failed", symbol=sym, error=str(exc))
        return results

    async def get_ohlcv(
        self, symbol: str, exchange: str,
        interval: str, from_date: date, to_date: date,
    ) -> list[Candle]:
        # Historical OHLCV is out of MVP scope. Returning empty list lets
        # signal-engine downstream code degrade gracefully rather than crash.
        logger.info("groww.get_ohlcv.skipped_mvp", symbol=symbol, interval=interval)
        return []

    # ── Portfolio ─────────────────────────────────────────────────────────────

    async def get_holdings(self) -> list[Holding]:
        try:
            raw = await asyncio.to_thread(self._groww.get_holdings_for_user)
        except Exception as exc:
            logger.warning("groww.holdings_failed", error=str(exc))
            return []

        rows = self._extract_list(raw)
        holdings: list[Holding] = []
        for d in rows:
            holdings.append(Holding(
                tradingsymbol=str(d.get("trading_symbol") or d.get("symbol") or d.get("tradingsymbol") or ""),
                exchange=str(d.get("exchange") or "NSE"),
                isin=str(d.get("isin") or ""),
                quantity=Decimal(str(d.get("quantity") or d.get("qty") or 0)),
                avg_cost=Decimal(str(d.get("average_price") or d.get("avg_price") or d.get("buy_avg") or 0)),
                last_price=Decimal(str(d.get("last_price") or d.get("ltp") or 0)),
                pnl=Decimal(str(d.get("pnl") or d.get("unrealized_pnl") or 0)),
            ))
        return holdings

    async def get_positions(self) -> list[Position]:
        try:
            raw = await asyncio.to_thread(self._groww.get_positions_for_user)
        except Exception as exc:
            logger.warning("groww.positions_failed", error=str(exc))
            return []

        rows = self._extract_list(raw)
        positions: list[Position] = []
        for d in rows:
            positions.append(Position(
                tradingsymbol=str(d.get("trading_symbol") or d.get("symbol") or ""),
                exchange=str(d.get("exchange") or "NSE"),
                product=str(d.get("product") or "MIS"),
                quantity=Decimal(str(d.get("net_quantity") or d.get("net_qty") or 0)),
                avg_price=Decimal(str(d.get("average_price") or d.get("avg_price") or 0)),
                last_price=Decimal(str(d.get("last_price") or d.get("ltp") or 0)),
                pnl=Decimal(str(d.get("pnl") or 0)),
                realised_pnl=Decimal(str(d.get("realised_pnl") or d.get("realized_pnl") or 0)),
                segment=str(d.get("segment") or "equity").lower(),
            ))
        return positions

    async def get_orders(self) -> list[Order]:
        raw = await asyncio.to_thread(self._groww.get_order_list, timeout=5)
        rows = self._extract_list(raw)
        orders: list[Order] = []
        for d in rows:
            orders.append(Order(
                broker_order_id=str(d.get("order_id") or d.get("groww_order_id") or ""),
                tradingsymbol=str(d.get("trading_symbol") or d.get("symbol") or ""),
                exchange=str(d.get("exchange") or "NSE"),
                transaction_type=str(d.get("transaction_type") or "BUY"),
                order_type=str(d.get("order_type") or "MARKET"),
                product=str(d.get("product") or "CNC"),
                quantity=Decimal(str(d.get("quantity") or 0)),
                filled_quantity=Decimal(str(d.get("filled_quantity") or d.get("filled_qty") or 0)),
                price=Decimal(str(d.get("price") or 0)),
                avg_fill_price=Decimal(str(d.get("average_price") or d.get("avg_price") or 0)),
                trigger_price=Decimal(str(d.get("trigger_price") or 0)),
                status=str(d.get("order_status") or d.get("status") or "open").lower(),
            ))
        return orders

    # ── Order management ──────────────────────────────────────────────────────

    async def place_order(self, req: OrderRequest) -> OrderResult:
        # Groww SDK uses bare tradingsymbol + SDK-constant enums. We pass the
        # string enums; the SDK is expected to accept them (matches the docs'
        # code example which used the same string values via constants).
        params: dict[str, Any] = {
            "trading_symbol":   req.tradingsymbol,
            "quantity":         req.quantity,
            "validity":         req.validity,
            "exchange":         req.exchange,
            "segment":          self._infer_segment(req.exchange),
            "product":          req.product,
            "order_type":       req.order_type,
            "transaction_type": req.transaction_type,
        }
        if req.price is not None:
            params["price"] = float(req.price)
        if req.trigger_price is not None:
            params["trigger_price"] = float(req.trigger_price)
        if req.tag:
            params["order_reference_id"] = req.tag

        try:
            raw = await asyncio.to_thread(self._groww.place_order, **params)
        except Exception as exc:
            logger.warning("groww.place_order_failed", error=str(exc))
            return OrderResult(broker_order_id="", status="rejected", message=str(exc))

        order_id = ""
        message = ""
        if isinstance(raw, dict):
            order_id = str(raw.get("order_id") or raw.get("groww_order_id") or "")
            message = str(raw.get("message") or raw.get("status_message") or "")
        return OrderResult(
            broker_order_id=order_id,
            status="open" if order_id else "rejected",
            message=message,
        )

    async def modify_order(self, broker_order_id: str, **kwargs: Any) -> OrderResult:
        # MVP scope: provide best-effort passthrough. SDK signature unverified.
        try:
            raw = await asyncio.to_thread(
                self._groww.modify_order,
                order_id=broker_order_id,
                **kwargs,
            )
        except Exception as exc:
            logger.warning("groww.modify_order_failed", order_id=broker_order_id, error=str(exc))
            return OrderResult(broker_order_id=broker_order_id, status="error", message=str(exc))

        status = "modified"
        if isinstance(raw, dict) and raw.get("status") in {"failure", "error"}:
            status = "error"
        return OrderResult(broker_order_id=broker_order_id, status=status)

    async def cancel_order(self, broker_order_id: str) -> OrderResult:
        try:
            raw = await asyncio.to_thread(self._groww.cancel_order, order_id=broker_order_id)
        except Exception as exc:
            logger.warning("groww.cancel_order_failed", order_id=broker_order_id, error=str(exc))
            return OrderResult(broker_order_id=broker_order_id, status="error", message=str(exc))

        status = "cancelled"
        if isinstance(raw, dict) and raw.get("status") in {"failure", "error"}:
            status = "error"
        return OrderResult(broker_order_id=broker_order_id, status=status)

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _extract_list(raw: Any) -> list[dict[str, Any]]:
        """
        Groww SDK responses vary: sometimes a list, sometimes wrapped in
        {"data": [...]} or {"status": "...", "payload": [...]}. Normalise.
        """
        if raw is None:
            return []
        if isinstance(raw, list):
            return [d for d in raw if isinstance(d, dict)]
        if isinstance(raw, dict):
            for key in ("data", "payload", "holdings", "positions", "orders"):
                inner = raw.get(key)
                if isinstance(inner, list):
                    return [d for d in inner if isinstance(d, dict)]
            # Last resort: maybe the dict itself is one record
            return [raw]
        return []

    @staticmethod
    def _infer_segment(exchange: str) -> str:
        # Groww uses SEGMENT_CASH / SEGMENT_FNO etc. We send strings the SDK
        # accepts (matches the docs example which used groww.SEGMENT_CASH).
        return "FNO" if exchange.upper() in {"NFO", "BFO", "MCX"} else "CASH"
