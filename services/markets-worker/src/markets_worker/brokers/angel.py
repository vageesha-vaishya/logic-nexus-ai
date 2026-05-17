"""
Angel One SmartAPI adapter.

Required credentials dict keys:
    api_key       – from smartapi.angelbroking.com
    client_id     – Angel One client ID (e.g. A123456)
    password      – login password (encrypted at rest)
    totp_secret   – base32 TOTP secret from the QR code shown at API portal
                    (enables automated daily refresh)
    access_token  – set after generateSession; refreshed daily
    refresh_token – set after generateSession; used for silent re-auth
    feed_token    – WebSocket token for live quotes

Auth flow:
    Automated: platform stores totp_secret, generates TOTP, calls generateSession
    daily at 08:00 IST. No user interaction required after initial setup.
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


class AngelAdapter(BrokerAdapter):
    name         = "angel_one"
    display_name = "Angel One (SmartAPI)"

    supports_mf        = True
    supports_fno       = True
    supports_currency  = True
    supports_commodity = True
    supports_gtt       = True
    supports_websocket = True

    _EXCHANGE_MAP = {
        "NSE": "NSE", "BSE": "BSE", "NFO": "NFO",
        "MCX": "MCX", "CDS": "CDS", "NCDEX": "NCDEX",
    }

    def __init__(self, credentials: dict[str, Any]) -> None:
        super().__init__(credentials)
        self._obj: Any = None

    async def connect(self) -> None:
        try:
            import pyotp                          # type: ignore
            from SmartApi import SmartConnect     # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "smartapi-python or pyotp not installed. "
                "Run: uv add smartapi-python pyotp"
            ) from exc

        api_key      = self._creds["api_key"]
        client_id    = self._creds["client_id"]
        password     = self._creds["password"]
        totp_secret  = self._creds.get("totp_secret", "")
        access_token = self._creds.get("access_token")

        def _init() -> Any:
            obj = SmartConnect(api_key=api_key)
            if access_token:
                # Use cached token first
                obj.setAccessToken(access_token)
                obj.setRefreshToken(self._creds.get("refresh_token", ""))
                obj.setFeedToken(self._creds.get("feed_token", ""))
            else:
                totp = pyotp.TOTP(totp_secret).now() if totp_secret else ""
                data = obj.generateSession(clientCode=client_id, password=password, totp=totp)
                if data["status"] is False:
                    raise RuntimeError(f"Angel login failed: {data.get('message')}")
            return obj

        self._obj = await asyncio.to_thread(_init)
        self._connected = True
        logger.info("angel.connected", client_id=client_id)

    async def disconnect(self) -> None:
        if self._obj:
            try:
                await asyncio.to_thread(self._obj.terminateSession,
                                        self._creds["client_id"])
            except Exception:
                pass
        self._obj = None
        self._connected = False

    # ── Auth ──────────────────────────────────────────────────────────────────

    @classmethod
    def get_auth_url(cls, **kwargs: Any) -> str:
        return ""  # TOTP-based; no browser OAuth needed

    @classmethod
    async def exchange_auth_code(cls, code: str, **kwargs: Any) -> AuthResult:
        """code = TOTP value; client_id + password + api_key in kwargs."""
        try:
            import pyotp                       # type: ignore
            from SmartApi import SmartConnect  # type: ignore
        except ImportError as exc:
            raise RuntimeError("smartapi-python or pyotp not installed") from exc

        api_key   = kwargs["api_key"]
        client_id = kwargs["client_id"]
        password  = kwargs["password"]

        def _gen() -> Any:
            obj  = SmartConnect(api_key=api_key)
            data = obj.generateSession(clientCode=client_id, password=password, totp=code)
            if data["status"] is False:
                raise ValueError(f"Angel One auth failed: {data.get('message')}")
            return data

        data = await asyncio.to_thread(_gen)
        tok  = data.get("data", {})
        midnight_ist = datetime.now(_IST).replace(hour=23, minute=59, second=59)
        return AuthResult(
            access_token=tok.get("jwtToken", ""),
            refresh_token=tok.get("refreshToken"),
            feed_token=tok.get("feedToken"),
            expires_at=midnight_ist.astimezone(timezone.utc),
        )

    async def refresh_tokens(self) -> AuthResult:
        """Automated refresh using stored TOTP secret."""
        try:
            import pyotp  # type: ignore
        except ImportError as exc:
            raise RuntimeError("pyotp not installed") from exc

        totp_secret = self._creds.get("totp_secret")
        if not totp_secret:
            raise ValueError("totp_secret required for automated refresh")

        totp = pyotp.TOTP(totp_secret).now()
        return await self.exchange_auth_code(
            totp,
            api_key=self._creds["api_key"],
            client_id=self._creds["client_id"],
            password=self._creds["password"],
        )

    # ── Market data ───────────────────────────────────────────────────────────

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        # SmartAPI ltpData expects exchange + tradingsymbol + symboltoken
        results: list[Quote] = []
        for sym in symbols:
            exchange, ts = (sym.split(":", 1) + [""])[:2] if ":" in sym else ("NSE", sym)
            try:
                def _ltp(e: str = exchange, s: str = ts) -> Any:
                    return self._obj.ltpData(exchange=e, tradingsymbol=s, symboltoken="")
                raw = await asyncio.to_thread(_ltp)
                if raw and raw.get("status"):
                    d = raw["data"]
                    results.append(Quote(
                        symbol=ts, exchange=exchange,
                        ltp=Decimal(str(d.get("ltp", 0))),
                        close=Decimal(str(d.get("close", 0))),
                        change=Decimal(str(d.get("ltp", 0))) - Decimal(str(d.get("close", 0))),
                    ))
            except Exception as exc:
                logger.warning("angel.quote_failed", symbol=sym, error=str(exc))
        return results

    async def get_ohlcv(
        self, symbol: str, exchange: str,
        interval: str, from_date: date, to_date: date,
    ) -> list[Candle]:
        _INT = {
            "1minute": "ONE_MINUTE", "5minute": "FIVE_MINUTE",
            "15minute": "FIFTEEN_MINUTE", "30minute": "THIRTY_MINUTE",
            "60minute": "ONE_HOUR", "day": "ONE_DAY", "week": "ONE_WEEK",
        }

        def _hist() -> Any:
            return self._obj.getCandleData({
                "exchange": exchange,
                "symboltoken": "",
                "interval": _INT.get(interval, "ONE_DAY"),
                "fromdate": f"{from_date} 09:15",
                "todate": f"{to_date} 15:30",
            })

        raw = await asyncio.to_thread(_hist)
        candles: list[Candle] = []
        if raw and raw.get("status") and raw.get("data"):
            for d in raw["data"]:
                # [timestamp, open, high, low, close, volume]
                candles.append(Candle(
                    ts=datetime.fromisoformat(d[0]),
                    open=Decimal(str(d[1])),
                    high=Decimal(str(d[2])),
                    low=Decimal(str(d[3])),
                    close=Decimal(str(d[4])),
                    volume=int(d[5]) if len(d) > 5 else 0,
                ))
        return candles

    # ── Portfolio ─────────────────────────────────────────────────────────────

    async def get_holdings(self) -> list[Holding]:
        raw = await asyncio.to_thread(self._obj.holding)
        holdings: list[Holding] = []
        if raw and raw.get("status") and raw.get("data"):
            for d in raw["data"]:
                holdings.append(Holding(
                    tradingsymbol=d.get("tradingsymbol", ""),
                    exchange=d.get("exchange", "NSE"),
                    isin=d.get("isin", ""),
                    quantity=Decimal(str(d.get("quantity", 0))),
                    avg_cost=Decimal(str(d.get("averageprice", 0))),
                    last_price=Decimal(str(d.get("ltp", 0))),
                    pnl=Decimal(str(d.get("profitandloss", 0))),
                    t1_quantity=Decimal(str(d.get("t1quantity", 0))),
                ))
        return holdings

    async def get_positions(self) -> list[Position]:
        raw = await asyncio.to_thread(self._obj.position)
        positions: list[Position] = []
        if raw and raw.get("status") and raw.get("data"):
            for d in raw["data"]:
                positions.append(Position(
                    tradingsymbol=d.get("tradingsymbol", ""),
                    exchange=d.get("exchange", "NSE"),
                    product=d.get("producttype", "MIS"),
                    quantity=Decimal(str(d.get("netqty", 0))),
                    avg_price=Decimal(str(d.get("netprice", 0))),
                    last_price=Decimal(str(d.get("ltp", 0))),
                    pnl=Decimal(str(d.get("unrealisedpnl", 0))),
                    realised_pnl=Decimal(str(d.get("realisedpnl", 0))),
                    m2m=Decimal(str(d.get("m2mvalue", 0))),
                    day_buy_qty=Decimal(str(d.get("buyqty", 0))),
                    day_sell_qty=Decimal(str(d.get("sellqty", 0))),
                ))
        return positions

    async def get_orders(self) -> list[Order]:
        raw = await asyncio.to_thread(self._obj.orderBook)
        orders: list[Order] = []
        if raw and raw.get("status") and raw.get("data"):
            for d in raw["data"]:
                orders.append(Order(
                    broker_order_id=d.get("orderid", ""),
                    tradingsymbol=d.get("tradingsymbol", ""),
                    exchange=d.get("exchange", "NSE"),
                    transaction_type=d.get("transactiontype", "BUY"),
                    order_type=d.get("ordertype", "MARKET"),
                    product=d.get("producttype", "CNC"),
                    quantity=Decimal(str(d.get("quantity", 0))),
                    filled_quantity=Decimal(str(d.get("filledshares", 0))),
                    price=Decimal(str(d.get("price", 0))),
                    avg_fill_price=Decimal(str(d.get("averageprice", 0))),
                    trigger_price=Decimal(str(d.get("triggerprice", 0))),
                    status=d.get("orderstatus", "open").lower(),
                    status_message=d.get("text", ""),
                    tag=d.get("ordertag", ""),
                ))
        return orders

    # ── Order management ──────────────────────────────────────────────────────

    async def place_order(self, req: OrderRequest) -> OrderResult:
        params = {
            "variety": "NORMAL",
            "tradingsymbol": req.tradingsymbol,
            "symboltoken": "",
            "transactiontype": req.transaction_type,
            "exchange": req.exchange,
            "ordertype": req.order_type,
            "producttype": req.product,
            "duration": req.validity,
            "price": str(req.price or 0),
            "squareoff": "0",
            "stoploss": str(req.trigger_price or 0),
            "quantity": str(req.quantity),
            "ordertag": req.tag,
        }
        raw = await asyncio.to_thread(self._obj.placeOrder, params)
        if raw and raw.get("status"):
            return OrderResult(broker_order_id=raw.get("data", {}).get("orderid", ""),
                               status="open")
        return OrderResult(broker_order_id="", status="rejected",
                           message=raw.get("message", "") if raw else "")

    async def modify_order(self, broker_order_id: str, **kwargs: Any) -> OrderResult:
        params = {
            "variety": "NORMAL", "orderid": broker_order_id,
            "ordertype": kwargs.get("order_type", "LIMIT"),
            "producttype": kwargs.get("product", "CNC"),
            "duration": kwargs.get("validity", "DAY"),
            "price": str(kwargs.get("price", 0)),
            "quantity": str(kwargs.get("quantity", 0)),
            "tradingsymbol": kwargs.get("tradingsymbol", ""),
            "symboltoken": "", "exchange": kwargs.get("exchange", "NSE"),
        }
        raw = await asyncio.to_thread(self._obj.modifyOrder, params)
        status = "modified" if (raw and raw.get("status")) else "error"
        return OrderResult(broker_order_id=broker_order_id, status=status,
                           message=raw.get("message", "") if raw else "")

    async def cancel_order(self, broker_order_id: str) -> OrderResult:
        raw = await asyncio.to_thread(
            self._obj.cancelOrder, "NORMAL", broker_order_id)
        status = "cancelled" if (raw and raw.get("status")) else "error"
        return OrderResult(broker_order_id=broker_order_id, status=status,
                           message=raw.get("message", "") if raw else "")

    async def get_margins(self) -> dict[str, Any]:
        raw = await asyncio.to_thread(self._obj.rmsLimit)
        return raw.get("data", {}) if raw else {}

    # ── Mutual Funds ──────────────────────────────────────────────────────────

    async def get_mf_holdings(self) -> list[dict[str, Any]]:
        try:
            raw = await asyncio.to_thread(self._obj.allHoldings)
            # SmartAPI returns all holdings; filter by exchange "BSE" + product "MF"
            data = (raw or {}).get("data", {})
            mf = data.get("mutualFundHoldings", []) if isinstance(data, dict) else []
            return mf if isinstance(mf, list) else []
        except Exception as exc:
            logger.warning("angel.get_mf_holdings_failed", error=str(exc))
            return []

    async def get_mf_orders(self) -> list:
        try:
            raw = await asyncio.to_thread(self._obj.orderBook)
            orders = (raw or {}).get("data", []) or []
            mf_orders = [o for o in orders if o.get("producttype") == "MF"]
            return mf_orders
        except Exception as exc:
            logger.warning("angel.get_mf_orders_failed", error=str(exc))
            return []

    async def place_mf_order(self, order: dict[str, Any]) -> dict[str, Any]:
        """
        Place an MF order via Angel One SmartAPI.
        order keys: isin, order_type (PURCHASE|REDEMPTION), amount, units, folio_number
        """
        try:
            params = {
                "tradingsymbol": order.get("isin", ""),
                "transactiontype": "BUY" if order.get("order_type", "").upper() in ("PURCHASE", "BUY") else "SELL",
                "quantity": str(order.get("units") or 0),
                "price": str(order.get("amount") or 0),
                "producttype": "MF",
                "exchange": "BSE",
                "ordertype": "MARKET",
                "duration": "DAY",
            }
            raw = await asyncio.to_thread(self._obj.placeOrder, params)
            if raw and raw.get("status"):
                return {"status": "ok", "order_id": (raw.get("data") or {}).get("orderid", ""), "message": raw.get("message", "")}
            return {"status": "error", "message": (raw or {}).get("message", "Order placement failed")}
        except Exception as exc:
            logger.warning("angel.place_mf_order_failed", error=str(exc))
            return {"status": "error", "message": str(exc)}
