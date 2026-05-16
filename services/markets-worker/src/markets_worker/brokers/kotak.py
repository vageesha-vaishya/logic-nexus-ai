"""
Kotak Securities (Neo API) adapter.

Required credentials dict keys:
    mobile_number  – registered mobile number (10 digits)
    password       – Neo trading password
    mpin           – 6-digit Neo MPIN
    consumer_key   – from Neo API developer portal
    consumer_secret – from Neo API developer portal
    access_token   – set after OTP validation; refreshed daily

Auth flow (OTP, semi-automated):
    1. Platform calls initiate_login(mobile_number, password, consumer_key, consumer_secret)
       → triggers OTP to registered mobile
    2. User receives OTP on phone and enters it in the platform UI
    3. Platform calls exchange_auth_code(otp, mobile_number, consumer_key, consumer_secret)
       → completes session; returns access_token and sid

Because OTP requires user interaction, this broker is "semi-automated":
token refresh triggers the OTP flow and waits for user input rather than
completing silently like Angel One. The scheduler marks the connection
'pending_otp' and the UI prompts the user.

Docs: https://developers.kotaksecurities.com/
Package: pip install neo-api-client
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


class KotakAdapter(BrokerAdapter):
    name         = "kotak_neo"
    display_name = "Kotak Securities (Neo API)"

    supports_mf        = True
    supports_fno       = True
    supports_currency  = True
    supports_commodity = True
    supports_gtt       = False
    supports_websocket = True

    def __init__(self, credentials: dict[str, Any]) -> None:
        super().__init__(credentials)
        self._client: Any = None

    async def connect(self) -> None:
        try:
            from neo_api_client import NeoAPI  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "neo-api-client not installed. Run: uv add neo-api-client"
            ) from exc

        consumer_key    = self._creds["consumer_key"]
        consumer_secret = self._creds["consumer_secret"]
        access_token    = self._creds.get("access_token", "")
        sid             = self._creds.get("sid", "")
        rid             = self._creds.get("rid", "")

        def _init() -> Any:
            client = NeoAPI(
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                environment="prod",
                access_token=access_token or None,
                neo_fin_key=self._creds.get("neo_fin_key"),
            )
            return client

        self._client = await asyncio.to_thread(_init)
        self._connected = True
        logger.info("kotak.connected")

    async def disconnect(self) -> None:
        self._client = None
        self._connected = False

    # ── Auth ──────────────────────────────────────────────────────────────────

    @classmethod
    def get_auth_url(cls, **kwargs: Any) -> str:
        # Kotak uses OTP flow, not a browser redirect URL.
        # Return empty string; frontend should call /v1/brokers/exchange-code
        # with step="initiate" first to trigger OTP.
        return ""

    @classmethod
    async def initiate_login(
        cls,
        mobile_number: str,
        password: str,
        consumer_key: str,
        consumer_secret: str,
        mpin: str = "",
    ) -> dict[str, Any]:
        """
        Step 1 of 2: trigger OTP to user's mobile.
        Call this, then call exchange_auth_code with the OTP.
        Returns the partial auth state needed for step 2.
        """
        try:
            from neo_api_client import NeoAPI  # type: ignore
        except ImportError as exc:
            raise RuntimeError("neo-api-client not installed") from exc

        def _login() -> Any:
            client = NeoAPI(
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                environment="prod",
            )
            return client.login(
                mobilenumber=mobile_number,
                password=password,
            )

        resp = await asyncio.to_thread(_login)
        # Returns data with token for OTP validation step
        return resp or {}

    @classmethod
    async def exchange_auth_code(cls, code: str, **kwargs: Any) -> AuthResult:
        """
        Step 2 of 2: validate OTP.
        code = OTP received on mobile.
        kwargs must include: mobile_number, password, consumer_key, consumer_secret, mpin
        """
        try:
            from neo_api_client import NeoAPI  # type: ignore
        except ImportError as exc:
            raise RuntimeError("neo-api-client not installed") from exc

        consumer_key    = kwargs["consumer_key"]
        consumer_secret = kwargs["consumer_secret"]
        mobile_number   = kwargs["mobile_number"]
        password        = kwargs["password"]
        mpin            = kwargs.get("mpin", "")

        def _validate() -> Any:
            client = NeoAPI(
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                environment="prod",
            )
            client.login(mobilenumber=mobile_number, password=password)
            return client.session_2fa(OTP=code)

        resp = await asyncio.to_thread(_validate)
        if not resp or resp.get("data") is None:
            raise ValueError(f"Kotak OTP validation failed: {resp}")

        data = resp["data"]
        midnight_ist = datetime.now(_IST).replace(hour=23, minute=59, second=59)
        return AuthResult(
            access_token=data.get("token", ""),
            expires_at=midnight_ist.astimezone(timezone.utc),
            extra={
                "sid":         data.get("sid", ""),
                "rid":         data.get("rid", ""),
                "neo_fin_key": data.get("neoFinKey", ""),
                "mobile_number": mobile_number,
            },
        )

    async def refresh_tokens(self) -> AuthResult:
        # Kotak requires fresh OTP every session — cannot refresh silently.
        raise NotImplementedError(
            "Kotak Neo requires OTP re-authentication daily. "
            "User must re-authenticate via Settings → Broker Accounts."
        )

    # ── Market data ───────────────────────────────────────────────────────────

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        results: list[Quote] = []
        for sym in symbols:
            exchange, ts = (sym.split(":", 1) + [""])[:2] if ":" in sym else ("NSE", sym)
            try:
                def _q(s: str = ts, ex: str = exchange) -> Any:
                    return self._client.quotes(instrument_tokens=s, quote_type="ltp",
                                               isIndex=False, session_token=self._creds.get("access_token"))
                raw = await asyncio.to_thread(_q)
                if raw and raw.get("data"):
                    d = raw["data"][0] if isinstance(raw["data"], list) else raw["data"]
                    results.append(Quote(
                        symbol=ts, exchange=exchange,
                        ltp=Decimal(str(d.get("ltp", d.get("last_price", 0)))),
                        open=Decimal(str(d.get("open", 0))),
                        high=Decimal(str(d.get("high", 0))),
                        low=Decimal(str(d.get("low", 0))),
                        close=Decimal(str(d.get("close", 0))),
                        volume=int(d.get("volume", d.get("vol", 0))),
                    ))
            except Exception as exc:
                logger.warning("kotak.quote_failed", symbol=sym, error=str(exc))
        return results

    async def get_ohlcv(
        self, symbol: str, exchange: str,
        interval: str, from_date: date, to_date: date,
    ) -> list[Candle]:
        _INT = {
            "1minute": 1, "5minute": 5, "10minute": 10, "15minute": 15,
            "30minute": 30, "60minute": 60, "day": "D",
        }

        def _hist() -> Any:
            return self._client.historical_candle_data(
                instrument_token=symbol,
                to_date=to_date.strftime("%d-%m-%Y"),
                from_date=from_date.strftime("%d-%m-%Y"),
                interval=str(_INT.get(interval, "D")),
            )

        raw = await asyncio.to_thread(_hist)
        candles: list[Candle] = []
        if raw and raw.get("data"):
            for d in raw["data"]:
                candles.append(Candle(
                    ts=datetime.strptime(d[0], "%Y-%m-%dT%H:%M:%S") if isinstance(d[0], str) else datetime.fromtimestamp(d[0]),
                    open=Decimal(str(d[1])),
                    high=Decimal(str(d[2])),
                    low=Decimal(str(d[3])),
                    close=Decimal(str(d[4])),
                    volume=int(d[5]) if len(d) > 5 else 0,
                ))
        return candles

    # ── Portfolio ─────────────────────────────────────────────────────────────

    async def get_holdings(self) -> list[Holding]:
        raw = await asyncio.to_thread(self._client.holdings)
        holdings: list[Holding] = []
        if raw and raw.get("data"):
            for d in (raw["data"] if isinstance(raw["data"], list) else [raw["data"]]):
                holdings.append(Holding(
                    tradingsymbol=d.get("trdSym", d.get("sym", "")),
                    exchange=d.get("exSeg", "NSE").replace("nse_cm", "NSE").replace("bse_cm", "BSE"),
                    isin=d.get("isin", ""),
                    quantity=Decimal(str(d.get("qty", d.get("holdQty", 0)))),
                    avg_cost=Decimal(str(d.get("avgPrice", d.get("avgCstPrc", 0)))),
                    last_price=Decimal(str(d.get("ltp", 0))),
                    pnl=Decimal(str(d.get("unrlPnL", d.get("pnl", 0)))),
                    t1_quantity=Decimal(str(d.get("t1Qty", 0))),
                ))
        return holdings

    async def get_positions(self) -> list[Position]:
        raw = await asyncio.to_thread(self._client.positions)
        positions: list[Position] = []
        if raw and raw.get("data"):
            for d in (raw["data"] if isinstance(raw["data"], list) else [raw["data"]]):
                qty = Decimal(str(d.get("netQty", d.get("flBuyQty", 0)))) - \
                      Decimal(str(d.get("flSellQty", 0)))
                positions.append(Position(
                    tradingsymbol=d.get("trdSym", ""),
                    exchange=d.get("exSeg", "NSE").replace("nse_cm", "NSE").replace("nse_fo", "NFO"),
                    product=d.get("prod", "MIS"),
                    quantity=qty,
                    avg_price=Decimal(str(d.get("avgPrice", d.get("buyAmt", 0)))),
                    last_price=Decimal(str(d.get("ltp", 0))),
                    pnl=Decimal(str(d.get("unrlPnL", d.get("pnL", 0)))),
                    realised_pnl=Decimal(str(d.get("rlPnL", 0))),
                    m2m=Decimal(str(d.get("mtm", 0))),
                ))
        return positions

    async def get_orders(self) -> list[Order]:
        raw = await asyncio.to_thread(self._client.order_report)
        orders: list[Order] = []
        if raw and raw.get("data"):
            for d in (raw["data"] if isinstance(raw["data"], list) else [raw["data"]]):
                orders.append(Order(
                    broker_order_id=str(d.get("nOrdNo", d.get("orderId", ""))),
                    tradingsymbol=d.get("trdSym", ""),
                    exchange=d.get("exSeg", "NSE").replace("nse_cm", "NSE").replace("nse_fo", "NFO"),
                    transaction_type="BUY" if d.get("trnsTp", "B") == "B" else "SELL",
                    order_type={"MKT": "MARKET", "L": "LIMIT", "SL": "SL", "SL-M": "SL-M"}.get(d.get("prcTp", "MKT"), "MARKET"),
                    product=d.get("prod", "CNC"),
                    quantity=Decimal(str(d.get("qty", 0))),
                    filled_quantity=Decimal(str(d.get("fldQty", 0))),
                    price=Decimal(str(d.get("prc", 0))),
                    avg_fill_price=Decimal(str(d.get("avgPrc", 0))),
                    trigger_price=Decimal(str(d.get("trgPrc", 0))),
                    status={"complete": "complete", "open": "open", "rejected": "rejected",
                             "cancelled": "cancelled", "AMO REQ RECEIVED": "open"}.get(
                        d.get("ordSt", "open").lower(), "open"),
                    status_message=d.get("rejRsn", ""),
                ))
        return orders

    # ── Order management ──────────────────────────────────────────────────────

    async def place_order(self, req: OrderRequest) -> OrderResult:
        def _place() -> Any:
            return self._client.place_order(
                exchange_segment=req.exchange.lower() + "_cm"
                    if req.exchange in ("NSE", "BSE")
                    else req.exchange.lower() + "_fo",
                product=req.product,
                trading_symbol=req.tradingsymbol,
                transaction_type=req.transaction_type[0],  # "B" or "S"
                quantity=str(req.quantity),
                order_type="MKT" if req.order_type == "MARKET" else req.order_type,
                price=str(req.price or 0),
                trigger_price=str(req.trigger_price or 0),
            )
        raw = await asyncio.to_thread(_place)
        if raw and raw.get("data"):
            oid = raw["data"].get("nOrdNo", raw["data"].get("orderId", ""))
            return OrderResult(broker_order_id=str(oid), status="open")
        return OrderResult(broker_order_id="", status="rejected",
                           message=str(raw.get("errMsg", "") if raw else ""))

    async def modify_order(self, broker_order_id: str, **kwargs: Any) -> OrderResult:
        def _mod() -> Any:
            return self._client.modify_order(
                order_id=broker_order_id,
                price=str(kwargs.get("price", 0)),
                quantity=str(kwargs.get("quantity", 0)),
                trigger_price=str(kwargs.get("trigger_price", 0)),
                order_type=kwargs.get("order_type", "L"),
            )
        raw = await asyncio.to_thread(_mod)
        status = "modified" if raw and raw.get("data") else "error"
        return OrderResult(broker_order_id=broker_order_id, status=status)

    async def cancel_order(self, broker_order_id: str) -> OrderResult:
        def _cancel() -> Any:
            return self._client.cancel_order(order_id=broker_order_id)
        raw = await asyncio.to_thread(_cancel)
        status = "cancelled" if raw and raw.get("data") else "error"
        return OrderResult(broker_order_id=broker_order_id, status=status)

    async def get_margins(self) -> dict[str, Any]:
        raw = await asyncio.to_thread(self._client.limits)
        return raw.get("data", {}) if raw else {}
