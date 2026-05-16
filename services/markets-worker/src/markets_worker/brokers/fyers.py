"""
Fyers API v3 adapter.

Required credentials dict keys:
    app_id         – Fyers App ID (CLIENT_ID format: XXXXX-100)
    secret_key     – app secret
    redirect_uri   – registered redirect URI (e.g. https://127.0.0.1/)
    access_token   – set after OAuth; refreshed daily

Auth flow (OAuth):
    1. Platform calls get_auth_url(app_id, redirect_uri, state)
    2. User logs in and is redirected to redirect_uri?auth_code=<code>&state=<state>
    3. Platform calls exchange_auth_code(code, app_id, secret_key, redirect_uri)
    4. access_token stored; expires at midnight IST

Docs: https://myapi.fyers.in/docs/
"""

from __future__ import annotations

import asyncio
import hashlib
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


class FyersAdapter(BrokerAdapter):
    name         = "fyers"
    display_name = "Fyers API v3"

    supports_mf        = True
    supports_fno       = True
    supports_currency  = True
    supports_commodity = True
    supports_gtt       = False
    supports_websocket = True

    def __init__(self, credentials: dict[str, Any]) -> None:
        super().__init__(credentials)
        self._fyers: Any = None

    async def connect(self) -> None:
        try:
            from fyers_apiv3 import fyersModel  # type: ignore
        except ImportError as exc:
            raise RuntimeError("fyers-apiv3 not installed. Run: uv add fyers-apiv3") from exc

        app_id       = self._creds["app_id"]
        access_token = self._creds.get("access_token", "")

        def _init() -> Any:
            return fyersModel.FyersModel(
                client_id=app_id,
                is_async=False,
                token=access_token,
                log_path="",
            )

        self._fyers = await asyncio.to_thread(_init)
        self._connected = True
        logger.info("fyers.connected", app_id=app_id[:8] + "***")

    async def disconnect(self) -> None:
        self._fyers = None
        self._connected = False

    # ── Auth ──────────────────────────────────────────────────────────────────

    @classmethod
    def get_auth_url(
        cls,
        app_id: str = "",
        redirect_uri: str = "",
        state: str = "fyers_auth",
        **kwargs: Any,
    ) -> str:
        try:
            from fyers_apiv3 import fyersModel  # type: ignore
            session = fyersModel.SessionModel(
                client_id=app_id,
                secret_key=kwargs.get("secret_key", ""),
                redirect_uri=redirect_uri,
                response_type="code",
                grant_type="authorization_code",
                state=state,
            )
            return session.generate_authcode()
        except Exception:
            return f"https://api-t1.fyers.in/api/v3/generate-authcode?client_id={app_id}&redirect_uri={redirect_uri}&response_type=code&state={state}"

    @classmethod
    async def exchange_auth_code(cls, code: str, **kwargs: Any) -> AuthResult:
        try:
            from fyers_apiv3 import fyersModel  # type: ignore
        except ImportError as exc:
            raise RuntimeError("fyers-apiv3 not installed") from exc

        app_id       = kwargs["app_id"]
        secret_key   = kwargs["secret_key"]
        redirect_uri = kwargs.get("redirect_uri", "")

        def _exchange() -> Any:
            session = fyersModel.SessionModel(
                client_id=app_id,
                secret_key=secret_key,
                redirect_uri=redirect_uri,
                response_type="code",
                grant_type="authorization_code",
            )
            session.set_token(code)
            return session.generate_token()

        data = await asyncio.to_thread(_exchange)
        if data.get("s") != "ok":
            raise ValueError(f"Fyers token exchange failed: {data.get('message', data)}")

        midnight_ist = datetime.now(_IST).replace(hour=23, minute=59, second=59)
        return AuthResult(
            access_token=data.get("access_token", ""),
            expires_at=midnight_ist.astimezone(timezone.utc),
        )

    async def refresh_tokens(self) -> AuthResult:
        # Fyers has no refresh token — must re-do OAuth daily.
        raise NotImplementedError(
            "Fyers access tokens cannot be refreshed automatically. "
            "User must re-authenticate via OAuth each day."
        )

    # ── Market data ───────────────────────────────────────────────────────────

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        # Fyers symbol format: "NSE:RELIANCE-EQ"
        fyers_syms = []
        for sym in symbols:
            if ":" in sym:
                ex, ts = sym.split(":", 1)
                fyers_syms.append(f"{ex}:{ts}-EQ" if "-" not in ts else sym)
            else:
                fyers_syms.append(f"NSE:{sym}-EQ")

        def _q() -> Any:
            return self._fyers.quotes({"symbols": ",".join(fyers_syms)})

        raw = await asyncio.to_thread(_q)
        results: list[Quote] = []
        if raw and raw.get("s") == "ok":
            for d in raw.get("d", []):
                v = d.get("v", {})
                sym_raw = d.get("n", "")
                ex, ts = sym_raw.split(":", 1) if ":" in sym_raw else ("NSE", sym_raw)
                ts = ts.replace("-EQ", "").replace("-BE", "")
                results.append(Quote(
                    symbol=ts, exchange=ex,
                    ltp=Decimal(str(v.get("lp", 0))),
                    open=Decimal(str(v.get("open_price", 0))),
                    high=Decimal(str(v.get("high_price", 0))),
                    low=Decimal(str(v.get("low_price", 0))),
                    close=Decimal(str(v.get("prev_close_price", 0))),
                    volume=int(v.get("volume", 0)),
                    oi=int(v.get("oi", 0)) if v.get("oi") else None,
                    change=Decimal(str(v.get("ch", 0))),
                    change_pct=Decimal(str(v.get("chp", 0))),
                ))
        return results

    async def get_ohlcv(
        self, symbol: str, exchange: str,
        interval: str, from_date: date, to_date: date,
    ) -> list[Candle]:
        _INT = {
            "1minute": "1", "2minute": "2", "3minute": "3", "5minute": "5",
            "10minute": "10", "15minute": "15", "20minute": "20", "30minute": "30",
            "60minute": "60", "120minute": "120", "240minute": "240",
            "day": "D", "week": "W", "month": "M",
        }
        fyers_sym = f"{exchange}:{symbol}-EQ" if exchange in ("NSE", "BSE") else f"{exchange}:{symbol}"

        def _hist() -> Any:
            return self._fyers.history({
                "symbol": fyers_sym,
                "resolution": _INT.get(interval, "D"),
                "date_format": "1",
                "range_from": from_date.strftime("%Y-%m-%d"),
                "range_to":   to_date.strftime("%Y-%m-%d"),
                "cont_flag":  "1",
            })

        raw = await asyncio.to_thread(_hist)
        candles: list[Candle] = []
        if raw and raw.get("s") == "ok":
            for d in raw.get("candles", []):
                # [epoch, open, high, low, close, volume]
                candles.append(Candle(
                    ts=datetime.fromtimestamp(d[0]),
                    open=Decimal(str(d[1])),
                    high=Decimal(str(d[2])),
                    low=Decimal(str(d[3])),
                    close=Decimal(str(d[4])),
                    volume=int(d[5]),
                ))
        return candles

    # ── Portfolio ─────────────────────────────────────────────────────────────

    async def get_holdings(self) -> list[Holding]:
        raw = await asyncio.to_thread(self._fyers.holdings)
        holdings: list[Holding] = []
        if raw and raw.get("s") == "ok":
            for d in raw.get("holdings", []):
                sym_raw = d.get("symbol", "")
                ex, ts = sym_raw.split(":", 1) if ":" in sym_raw else ("NSE", sym_raw)
                ts = ts.replace("-EQ", "")
                holdings.append(Holding(
                    tradingsymbol=ts,
                    exchange=ex,
                    isin=d.get("isin", ""),
                    quantity=Decimal(str(d.get("quantity", 0))),
                    avg_cost=Decimal(str(d.get("costPrice", 0))),
                    last_price=Decimal(str(d.get("ltp", 0))),
                    pnl=Decimal(str(d.get("pl", 0))),
                    t1_quantity=Decimal(str(d.get("t1Quantity", 0))),
                ))
        return holdings

    async def get_positions(self) -> list[Position]:
        raw = await asyncio.to_thread(self._fyers.positions)
        positions: list[Position] = []
        if raw and raw.get("s") == "ok":
            for d in raw.get("netPositions", []):
                sym_raw = d.get("symbol", "")
                ex, ts = sym_raw.split(":", 1) if ":" in sym_raw else ("NSE", sym_raw)
                positions.append(Position(
                    tradingsymbol=ts,
                    exchange=ex,
                    product=d.get("productType", "INTRADAY"),
                    quantity=Decimal(str(d.get("netQty", 0))),
                    avg_price=Decimal(str(d.get("netAvg", 0))),
                    last_price=Decimal(str(d.get("ltp", 0))),
                    pnl=Decimal(str(d.get("unrealizedProfit", 0))),
                    realised_pnl=Decimal(str(d.get("realizedProfit", 0))),
                    m2m=Decimal(str(d.get("m2mPnl", 0))),
                    day_buy_qty=Decimal(str(d.get("buyQty", 0))),
                    day_sell_qty=Decimal(str(d.get("sellQty", 0))),
                ))
        return positions

    async def get_orders(self) -> list[Order]:
        raw = await asyncio.to_thread(self._fyers.orderbook)
        orders: list[Order] = []
        if raw and raw.get("s") == "ok":
            for d in raw.get("orderBook", []):
                sym_raw = d.get("symbol", "")
                ex, ts = sym_raw.split(":", 1) if ":" in sym_raw else ("NSE", sym_raw)
                orders.append(Order(
                    broker_order_id=d.get("id", ""),
                    tradingsymbol=ts,
                    exchange=ex,
                    transaction_type="BUY" if d.get("side", 1) == 1 else "SELL",
                    order_type={1: "LIMIT", 2: "MARKET", 3: "SL", 4: "SL-M"}.get(d.get("type", 2), "MARKET"),
                    product=d.get("productType", "CNC"),
                    quantity=Decimal(str(d.get("qty", 0))),
                    filled_quantity=Decimal(str(d.get("filledQty", 0))),
                    price=Decimal(str(d.get("limitPrice", 0))),
                    avg_fill_price=Decimal(str(d.get("tradedPrice", 0))),
                    trigger_price=Decimal(str(d.get("stopPrice", 0))),
                    status={1: "open", 2: "complete", 4: "cancelled", 5: "rejected"}.get(d.get("status", 1), "open"),
                    status_message=d.get("message", ""),
                    tag=d.get("tag", ""),
                ))
        return orders

    # ── Order management ──────────────────────────────────────────────────────

    async def place_order(self, req: OrderRequest) -> OrderResult:
        fyers_sym = f"{req.exchange}:{req.tradingsymbol}-EQ" \
            if req.exchange in ("NSE", "BSE") else f"{req.exchange}:{req.tradingsymbol}"
        params = {
            "symbol": fyers_sym,
            "qty": req.quantity,
            "type": {"MARKET": 2, "LIMIT": 1, "SL": 3, "SL-M": 4}.get(req.order_type, 2),
            "side": 1 if req.transaction_type == "BUY" else -1,
            "productType": req.product,
            "limitPrice": float(req.price or 0),
            "stopPrice": float(req.trigger_price or 0),
            "validity": req.validity,
            "disclosedQty": req.disclosed_qty,
            "offlineOrder": False,
            "stopLoss": 0, "takeProfit": 0,
            "orderTag": req.tag,
        }
        raw = await asyncio.to_thread(self._fyers.place_order, params)
        if raw and raw.get("s") == "ok":
            return OrderResult(broker_order_id=raw.get("id", ""), status="open")
        return OrderResult(broker_order_id="", status="rejected",
                           message=raw.get("message", "") if raw else "")

    async def modify_order(self, broker_order_id: str, **kwargs: Any) -> OrderResult:
        params = {
            "id": broker_order_id,
            "type": {"MARKET": 2, "LIMIT": 1, "SL": 3, "SL-M": 4}.get(
                kwargs.get("order_type", "LIMIT"), 1),
            "qty": kwargs.get("quantity", 0),
            "limitPrice": float(kwargs.get("price", 0)),
            "stopPrice": float(kwargs.get("trigger_price", 0)),
        }
        raw = await asyncio.to_thread(self._fyers.modify_order, params)
        status = "modified" if (raw and raw.get("s") == "ok") else "error"
        return OrderResult(broker_order_id=broker_order_id, status=status,
                           message=raw.get("message", "") if raw else "")

    async def cancel_order(self, broker_order_id: str) -> OrderResult:
        raw = await asyncio.to_thread(self._fyers.cancel_order, {"id": broker_order_id})
        status = "cancelled" if (raw and raw.get("s") == "ok") else "error"
        return OrderResult(broker_order_id=broker_order_id, status=status,
                           message=raw.get("message", "") if raw else "")

    async def get_margins(self) -> dict[str, Any]:
        raw = await asyncio.to_thread(self._fyers.funds)
        return {"funds": raw.get("fund_limit", [])} if raw else {}
