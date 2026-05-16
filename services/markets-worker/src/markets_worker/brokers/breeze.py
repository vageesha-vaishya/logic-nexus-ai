"""
ICICI Direct Breeze adapter.

Required credentials dict keys:
    api_key      – from ICICIdirect API portal
    api_secret   – secret key
    session_token – obtained by user visiting:
                   BreezeConnect(api_key=api_key).get_customer_details_url()
                   and copying the token from the redirect URL query param

Auth flow (daily):
    1. User visits get_customer_details_url() in their browser
    2. Browser redirects to redirect_url?token=<session_token>
    3. User copies session_token and provides it via the platform UI
    4. Platform calls exchange_auth_code(code=session_token, api_key=..., api_secret=...)

Re-auth is required daily. No automated refresh possible — session_token is
human-in-the-loop. The scheduler will mark the connection 'expired' if
token_expires_at < now(); user re-authenticates via the UI.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import structlog

from .base import (
    AuthResult, BrokerAdapter, Candle, Holding, Order,
    OrderRequest, OrderResult, Position, Quote,
)

logger = structlog.get_logger()

_IST = timezone(timedelta(hours=5, minutes=30))


class BreezeAdapter(BrokerAdapter):
    name         = "icici_breeze"
    display_name = "ICICI Direct (Breeze)"

    supports_mf        = False
    supports_fno       = True
    supports_currency  = True
    supports_commodity = True
    supports_gtt       = False
    supports_websocket = True

    # Breeze exchange codes differ from standard NSE/BSE
    _EX_MAP = {"NSE": "NSE", "BSE": "BSE", "NFO": "NFO", "MCX": "MCX", "CDS": "CDS"}
    _EX_REV = {v: k for k, v in _EX_MAP.items()}

    def __init__(self, credentials: dict[str, Any]) -> None:
        super().__init__(credentials)
        self._breeze: Any = None

    async def connect(self) -> None:
        try:
            from breeze_connect import BreezeConnect  # type: ignore
        except ImportError as exc:
            raise RuntimeError("breeze-connect not installed. Run: uv add breeze-connect") from exc

        api_key      = self._creds["api_key"]
        api_secret   = self._creds["api_secret"]
        session_token = self._creds["session_token"]

        def _init() -> Any:
            b = BreezeConnect(api_key=api_key)
            b.generate_session(api_secret=api_secret, session_token=session_token)
            return b

        self._breeze = await asyncio.to_thread(_init)
        self._connected = True
        logger.info("breeze.connected", api_key=api_key[:8] + "***")

    async def disconnect(self) -> None:
        self._breeze = None
        self._connected = False

    # ── Auth ──────────────────────────────────────────────────────────────────

    @classmethod
    def get_auth_url(cls, api_key: str = "", **kwargs: Any) -> str:
        """Return the URL the user must visit to obtain a session token."""
        try:
            from breeze_connect import BreezeConnect  # type: ignore
            b = BreezeConnect(api_key=api_key)
            return b.get_customer_details_url()
        except Exception:
            return f"https://api.icicidirect.com/apiuser/login?api_key={api_key}"

    @classmethod
    async def exchange_auth_code(cls, code: str, **kwargs: Any) -> AuthResult:
        """code = session_token from the redirect URL."""
        # Session is valid until midnight IST
        now_ist = datetime.now(_IST)
        midnight_ist = now_ist.replace(hour=23, minute=59, second=59)
        return AuthResult(
            access_token=code,
            expires_at=midnight_ist.astimezone(timezone.utc),
            extra={"session_token": code},
        )

    async def refresh_tokens(self) -> AuthResult:
        # Breeze has no programmatic refresh — user must re-authenticate daily
        raise NotImplementedError(
            "Breeze sessions cannot be refreshed programmatically. "
            "User must re-authenticate via the broker login URL."
        )

    # ── Market data ───────────────────────────────────────────────────────────

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        results: list[Quote] = []
        for sym in symbols:
            exchange, stock_code = (sym.split(":", 1) + [""])[:2] if ":" in sym else ("NSE", sym)
            try:
                def _q(sc: str = stock_code, ex: str = exchange) -> Any:
                    return self._breeze.get_quotes(
                        stock_code=sc, exchange_code=ex,
                        expiry_date="", product_type="cash", right="", strike_price="",
                    )
                raw = await asyncio.to_thread(_q)
                if raw and raw.get("Success"):
                    d = raw["Success"][0] if isinstance(raw["Success"], list) else raw["Success"]
                    results.append(Quote(
                        symbol=stock_code, exchange=exchange,
                        ltp=Decimal(str(d.get("ltp", 0))),
                        open=Decimal(str(d.get("open", 0))),
                        high=Decimal(str(d.get("high", 0))),
                        low=Decimal(str(d.get("low", 0))),
                        close=Decimal(str(d.get("previous_close", 0))),
                        volume=int(d.get("total_quantity_traded", 0)),
                        change=Decimal(str(d.get("ltp", 0))) - Decimal(str(d.get("previous_close", 0))),
                    ))
            except Exception as exc:
                logger.warning("breeze.quote_failed", symbol=sym, error=str(exc))
        return results

    async def get_ohlcv(
        self, symbol: str, exchange: str,
        interval: str, from_date: date, to_date: date,
    ) -> list[Candle]:
        # Breeze interval map
        _INT = {"1minute": "1minute", "5minute": "5minute", "30minute": "30minute",
                "day": "1day", "week": "1week", "month": "1month"}
        breeze_interval = _INT.get(interval, "1day")

        def _hist() -> Any:
            return self._breeze.get_historical_data(
                interval=breeze_interval,
                from_date=f"{from_date.isoformat()} 09:00:00",
                to_date=f"{to_date.isoformat()} 15:30:00",
                stock_code=symbol, exchange_code=exchange,
                product_type="cash", expiry_date="", right="", strike_price="",
            )

        raw = await asyncio.to_thread(_hist)
        candles: list[Candle] = []
        if raw and raw.get("Success"):
            for d in raw["Success"]:
                candles.append(Candle(
                    ts=datetime.fromisoformat(d["datetime"]),
                    open=Decimal(str(d["open"])),
                    high=Decimal(str(d["high"])),
                    low=Decimal(str(d["low"])),
                    close=Decimal(str(d["close"])),
                    volume=int(d.get("volume", 0)),
                ))
        return candles

    # ── Portfolio ─────────────────────────────────────────────────────────────

    async def get_holdings(self) -> list[Holding]:
        raw = await asyncio.to_thread(self._breeze.get_portfolio_holdings)
        holdings: list[Holding] = []
        if raw and raw.get("Success"):
            for d in (raw["Success"] if isinstance(raw["Success"], list) else [raw["Success"]]):
                holdings.append(Holding(
                    tradingsymbol=d.get("stock_code", ""),
                    exchange=d.get("exchange_code", "NSE"),
                    isin=d.get("isin_code", ""),
                    quantity=Decimal(str(d.get("quantity", 0))),
                    avg_cost=Decimal(str(d.get("average_cost", 0))),
                    last_price=Decimal(str(d.get("current_market_price", 0))),
                    pnl=Decimal(str(d.get("profit_loss", 0))),
                ))
        return holdings

    async def get_positions(self) -> list[Position]:
        raw = await asyncio.to_thread(self._breeze.get_portfolio_positions)
        positions: list[Position] = []
        if raw and raw.get("Success"):
            for d in (raw["Success"] if isinstance(raw["Success"], list) else [raw["Success"]]):
                positions.append(Position(
                    tradingsymbol=d.get("stock_code", ""),
                    exchange=d.get("exchange_code", "NSE"),
                    product=d.get("product_type", "MIS"),
                    quantity=Decimal(str(d.get("quantity", 0))),
                    avg_price=Decimal(str(d.get("average_cost", 0))),
                    last_price=Decimal(str(d.get("current_market_price", 0))),
                    pnl=Decimal(str(d.get("profit_loss", 0))),
                ))
        return positions

    async def get_orders(self) -> list[Order]:
        raw = await asyncio.to_thread(self._breeze.get_order_list,
                                      exchange_code="NSE", from_date="", to_date="")
        orders: list[Order] = []
        if raw and raw.get("Success"):
            for d in (raw["Success"] if isinstance(raw["Success"], list) else [raw["Success"]]):
                orders.append(Order(
                    broker_order_id=str(d.get("order_id", "")),
                    tradingsymbol=d.get("stock_code", ""),
                    exchange=d.get("exchange_code", "NSE"),
                    transaction_type=d.get("action", "BUY").upper(),
                    order_type=d.get("order_type", "MARKET").upper(),
                    product=d.get("product_type", "CNC"),
                    quantity=Decimal(str(d.get("quantity", 0))),
                    filled_quantity=Decimal(str(d.get("executed_quantity", 0))),
                    price=Decimal(str(d.get("price", 0))),
                    avg_fill_price=Decimal(str(d.get("average_execution_price", 0))),
                    status=d.get("order_status", "open").lower(),
                    status_message=d.get("order_status_info", ""),
                ))
        return orders

    # ── Order management ──────────────────────────────────────────────────────

    async def place_order(self, req: OrderRequest) -> OrderResult:
        def _place() -> Any:
            return self._breeze.place_order(
                stock_code=req.tradingsymbol,
                exchange_code=req.exchange,
                product=req.product.lower(),
                action=req.transaction_type.lower(),
                order_type=req.order_type.lower(),
                quantity=str(req.quantity),
                price=str(req.price or 0),
                stoploss=str(req.trigger_price or 0),
                validity=req.validity,
                disclosed_quantity="0",
                expiry_date="", right="", strike_price="",
                user_remark=req.tag,
            )
        raw = await asyncio.to_thread(_place)
        if raw and raw.get("Success"):
            oid = raw["Success"].get("order_id", "")
            return OrderResult(broker_order_id=str(oid), status="open")
        err = raw.get("Error", "Order placement failed") if raw else "No response"
        return OrderResult(broker_order_id="", status="rejected", message=str(err))

    async def modify_order(self, broker_order_id: str, **kwargs: Any) -> OrderResult:
        def _mod() -> Any:
            return self._breeze.modify_order(
                order_id=broker_order_id,
                exchange_code=kwargs.get("exchange", "NSE"),
                order_type=kwargs.get("order_type", "limit").lower(),
                stoploss=str(kwargs.get("trigger_price", 0)),
                quantity=str(kwargs.get("quantity", 0)),
                price=str(kwargs.get("price", 0)),
                validity=kwargs.get("validity", "DAY"),
                disclosed_quantity="0",
                expiry_date="",
            )
        raw = await asyncio.to_thread(_mod)
        if raw and raw.get("Success"):
            return OrderResult(broker_order_id=broker_order_id, status="modified")
        return OrderResult(broker_order_id=broker_order_id, status="error",
                           message=str(raw.get("Error", "") if raw else ""))

    async def cancel_order(self, broker_order_id: str) -> OrderResult:
        def _cancel() -> Any:
            return self._breeze.cancel_order(
                exchange_code=self._creds.get("default_exchange", "NSE"),
                order_id=broker_order_id,
            )
        raw = await asyncio.to_thread(_cancel)
        if raw and raw.get("Success"):
            return OrderResult(broker_order_id=broker_order_id, status="cancelled")
        return OrderResult(broker_order_id=broker_order_id, status="error",
                           message=str(raw.get("Error", "") if raw else ""))
