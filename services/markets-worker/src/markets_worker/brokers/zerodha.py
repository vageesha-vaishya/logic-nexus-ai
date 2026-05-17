"""
Zerodha Kite Connect adapter.

Required credentials dict keys:
    api_key      – from kite.trade developer console
    api_secret   – Kite secret
    access_token – set after OAuth; expires at midnight IST

Auth flow (OAuth, daily):
    1. Platform calls get_auth_url(api_key) → redirect URL
    2. User logs in; Kite redirects to redirect_url?request_token=<token>
    3. Platform calls exchange_auth_code(request_token, api_key, api_secret)
    4. access_token stored; valid until midnight IST

Live data requires ₹2,000/month subscription on Kite Connect portal.

Docs: https://kite.trade/docs/connect/v3/
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


class ZerodhaAdapter(BrokerAdapter):
    name         = "zerodha"
    display_name = "Zerodha (Kite Connect)"

    supports_mf        = True
    supports_fno       = True
    supports_currency  = True
    supports_commodity = True
    supports_gtt       = True
    supports_websocket = True

    def __init__(self, credentials: dict[str, Any]) -> None:
        super().__init__(credentials)
        self._kite: Any = None

    async def connect(self) -> None:
        try:
            from kiteconnect import KiteConnect  # type: ignore
        except ImportError as exc:
            raise RuntimeError("kiteconnect not installed. Run: uv add kiteconnect") from exc

        api_key      = self._creds["api_key"]
        access_token = self._creds.get("access_token", "")

        def _init() -> Any:
            kite = KiteConnect(api_key=api_key)
            if access_token:
                kite.set_access_token(access_token)
            return kite

        self._kite = await asyncio.to_thread(_init)
        self._connected = True
        logger.info("zerodha.connected", api_key=api_key[:8] + "***")

    async def disconnect(self) -> None:
        if self._kite:
            try:
                await asyncio.to_thread(self._kite.invalidate_access_token)
            except Exception:
                pass
        self._kite = None
        self._connected = False

    # ── Auth ──────────────────────────────────────────────────────────────────

    @classmethod
    def get_auth_url(cls, api_key: str = "", **kwargs: Any) -> str:
        try:
            from kiteconnect import KiteConnect  # type: ignore
            return KiteConnect(api_key=api_key).login_url()
        except Exception:
            return f"https://kite.trade/connect/login?api_key={api_key}&v=3"

    @classmethod
    async def exchange_auth_code(cls, code: str, **kwargs: Any) -> AuthResult:
        try:
            from kiteconnect import KiteConnect  # type: ignore
        except ImportError as exc:
            raise RuntimeError("kiteconnect not installed") from exc

        api_key    = kwargs["api_key"]
        api_secret = kwargs["api_secret"]

        def _gen() -> Any:
            kite = KiteConnect(api_key=api_key)
            return kite.generate_session(code, api_secret=api_secret)

        data = await asyncio.to_thread(_gen)
        midnight_ist = datetime.now(_IST).replace(hour=23, minute=59, second=59)
        return AuthResult(
            access_token=data.get("access_token", ""),
            refresh_token=data.get("refresh_token"),
            expires_at=midnight_ist.astimezone(timezone.utc),
            extra={"public_token": data.get("public_token", "")},
        )

    async def refresh_tokens(self) -> AuthResult:
        # Kite has no programmatic refresh — daily OAuth required.
        raise NotImplementedError(
            "Zerodha access tokens cannot be refreshed automatically. "
            "User must re-authenticate via OAuth each day."
        )

    # ── Market data ───────────────────────────────────────────────────────────

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        # Kite format: "NSE:RELIANCE", "BSE:RELIANCE"
        def _q() -> Any:
            return self._kite.quote(symbols)

        raw = await asyncio.to_thread(_q)
        results: list[Quote] = []
        for sym, d in (raw or {}).items():
            exchange, ts = sym.split(":", 1) if ":" in sym else ("NSE", sym)
            ohlc = d.get("ohlc", {})
            results.append(Quote(
                symbol=ts,
                exchange=exchange,
                ltp=Decimal(str(d.get("last_price", 0))),
                open=Decimal(str(ohlc.get("open", 0))),
                high=Decimal(str(ohlc.get("high", 0))),
                low=Decimal(str(ohlc.get("low", 0))),
                close=Decimal(str(ohlc.get("close", 0))),
                volume=int(d.get("volume", 0)),
                oi=int(d.get("oi", 0)) if d.get("oi") else None,
                bid=Decimal(str(d.get("depth", {}).get("buy", [{}])[0].get("price", 0))),
                ask=Decimal(str(d.get("depth", {}).get("sell", [{}])[0].get("price", 0))),
                change=Decimal(str(d.get("net_change", 0))),
                ts=datetime.fromisoformat(d["timestamp"]) if d.get("timestamp") else None,
            ))
        return results

    async def get_ohlcv(
        self, symbol: str, exchange: str,
        interval: str, from_date: date, to_date: date,
    ) -> list[Candle]:
        _INT = {
            "1minute": "minute", "3minute": "3minute", "5minute": "5minute",
            "10minute": "10minute", "15minute": "15minute", "30minute": "30minute",
            "60minute": "60minute", "day": "day", "week": "week", "month": "month",
        }
        instrument = f"{exchange}:{symbol}"

        def _hist() -> Any:
            return self._kite.historical_data(
                instrument_token=self._resolve_token(instrument),
                from_date=from_date, to_date=to_date,
                interval=_INT.get(interval, "day"),
                continuous=False, oi=False,
            )

        raw = await asyncio.to_thread(_hist)
        candles: list[Candle] = []
        for d in (raw or []):
            candles.append(Candle(
                ts=d["date"] if isinstance(d["date"], datetime) else datetime.fromisoformat(str(d["date"])),
                open=Decimal(str(d["open"])),
                high=Decimal(str(d["high"])),
                low=Decimal(str(d["low"])),
                close=Decimal(str(d["close"])),
                volume=int(d.get("volume", 0)),
                oi=int(d.get("oi", 0)),
            ))
        return candles

    def _resolve_token(self, instrument: str) -> int:
        # In production: lookup from pre-fetched instrument master.
        # Fallback: use instrument string directly (Kite also accepts NSE:SYMBOL).
        return instrument  # type: ignore

    # ── Portfolio ─────────────────────────────────────────────────────────────

    async def get_holdings(self) -> list[Holding]:
        raw = await asyncio.to_thread(self._kite.holdings)
        holdings: list[Holding] = []
        for d in (raw or []):
            holdings.append(Holding(
                tradingsymbol=d["tradingsymbol"],
                exchange=d.get("exchange", "NSE"),
                isin=d.get("isin", ""),
                quantity=Decimal(str(d["quantity"])),
                avg_cost=Decimal(str(d["average_price"])),
                last_price=Decimal(str(d.get("last_price", 0))),
                pnl=Decimal(str(d.get("pnl", 0))),
                t1_quantity=Decimal(str(d.get("t1_quantity", 0))),
            ))
        return holdings

    async def get_positions(self) -> list[Position]:
        raw = await asyncio.to_thread(self._kite.positions)
        positions: list[Position] = []
        for d in (raw or {}).get("net", []):
            positions.append(Position(
                tradingsymbol=d["tradingsymbol"],
                exchange=d.get("exchange", "NSE"),
                product=d.get("product", "MIS"),
                quantity=Decimal(str(d["quantity"])),
                avg_price=Decimal(str(d["average_price"])),
                last_price=Decimal(str(d.get("last_price", 0))),
                pnl=Decimal(str(d.get("pnl", 0))),
                realised_pnl=Decimal(str(d.get("realised", 0))),
                m2m=Decimal(str(d.get("m2m", 0))),
                multiplier=Decimal(str(d.get("multiplier", 1))),
                close_price=Decimal(str(d.get("close_price", 0))),
                overnight_qty=Decimal(str(d.get("overnight_quantity", 0))),
                day_buy_qty=Decimal(str(d.get("buy_quantity", 0))),
                day_sell_qty=Decimal(str(d.get("sell_quantity", 0))),
                segment=d.get("exchange_segment", "equity").lower(),
            ))
        return positions

    async def get_orders(self) -> list[Order]:
        raw = await asyncio.to_thread(self._kite.orders)
        orders: list[Order] = []
        for d in (raw or []):
            ts_raw = d.get("order_timestamp")
            orders.append(Order(
                broker_order_id=d["order_id"],
                tradingsymbol=d["tradingsymbol"],
                exchange=d.get("exchange", "NSE"),
                transaction_type=d["transaction_type"],
                order_type=d["order_type"],
                product=d["product"],
                quantity=Decimal(str(d["quantity"])),
                filled_quantity=Decimal(str(d.get("filled_quantity", 0))),
                pending_quantity=Decimal(str(d.get("pending_quantity", 0))),
                price=Decimal(str(d.get("price", 0))),
                avg_fill_price=Decimal(str(d.get("average_price", 0))),
                trigger_price=Decimal(str(d.get("trigger_price", 0))),
                status=d["status"].lower(),
                status_message=d.get("status_message", ""),
                order_timestamp=ts_raw if isinstance(ts_raw, datetime) else None,
                tag=d.get("tag", ""),
            ))
        return orders

    # ── Order management ──────────────────────────────────────────────────────

    async def place_order(self, req: OrderRequest) -> OrderResult:
        from kiteconnect import KiteConnect  # type: ignore
        def _place() -> Any:
            return self._kite.place_order(
                variety=KiteConnect.VARIETY_REGULAR,
                exchange=req.exchange,
                tradingsymbol=req.tradingsymbol,
                transaction_type=req.transaction_type,
                quantity=req.quantity,
                product=req.product,
                order_type=req.order_type,
                price=float(req.price or 0) or None,
                trigger_price=float(req.trigger_price or 0) or None,
                validity=req.validity,
                disclosed_quantity=req.disclosed_qty or None,
                tag=req.tag or None,
            )
        try:
            oid = await asyncio.to_thread(_place)
            return OrderResult(broker_order_id=str(oid), status="open")
        except Exception as exc:
            return OrderResult(broker_order_id="", status="rejected", message=str(exc))

    async def modify_order(self, broker_order_id: str, **kwargs: Any) -> OrderResult:
        from kiteconnect import KiteConnect  # type: ignore
        def _mod() -> Any:
            return self._kite.modify_order(
                variety=KiteConnect.VARIETY_REGULAR,
                order_id=broker_order_id,
                quantity=kwargs.get("quantity"),
                price=kwargs.get("price"),
                order_type=kwargs.get("order_type"),
                trigger_price=kwargs.get("trigger_price"),
                validity=kwargs.get("validity"),
                disclosed_quantity=kwargs.get("disclosed_qty"),
            )
        try:
            await asyncio.to_thread(_mod)
            return OrderResult(broker_order_id=broker_order_id, status="modified")
        except Exception as exc:
            return OrderResult(broker_order_id=broker_order_id, status="error", message=str(exc))

    async def cancel_order(self, broker_order_id: str) -> OrderResult:
        from kiteconnect import KiteConnect  # type: ignore
        try:
            await asyncio.to_thread(
                self._kite.cancel_order,
                variety=KiteConnect.VARIETY_REGULAR,
                order_id=broker_order_id,
            )
            return OrderResult(broker_order_id=broker_order_id, status="cancelled")
        except Exception as exc:
            return OrderResult(broker_order_id=broker_order_id, status="error", message=str(exc))

    async def get_margins(self) -> dict[str, Any]:
        raw = await asyncio.to_thread(self._kite.margins)
        return raw or {}

    # ── GTT ──────────────────────────────────────────────────────────────────────

    async def create_gtt(self, req: "GTTRequest") -> "GTTResult":
        try:
            from markets_worker.brokers.base import GTTResult
            from kiteconnect import KiteConnect  # type: ignore

            t0 = req.triggers[0]
            if req.trigger_type == "oco" and len(req.triggers) >= 2:
                t1 = req.triggers[1]
                trigger_type = "two-leg"
                trigger_values = [float(t0.trigger_price), float(t1.trigger_price)]
                orders = [
                    {"exchange": req.exchange, "tradingsymbol": req.tradingsymbol,
                     "transaction_type": t0.transaction_type, "quantity": t0.quantity,
                     "order_type": "LIMIT", "product": t0.product, "price": float(t0.price)},
                    {"exchange": req.exchange, "tradingsymbol": req.tradingsymbol,
                     "transaction_type": t1.transaction_type, "quantity": t1.quantity,
                     "order_type": "LIMIT", "product": t1.product, "price": float(t1.price)},
                ]
            else:
                trigger_type = "single"
                trigger_values = [float(t0.trigger_price)]
                orders = [
                    {"exchange": req.exchange, "tradingsymbol": req.tradingsymbol,
                     "transaction_type": t0.transaction_type, "quantity": t0.quantity,
                     "order_type": "LIMIT", "product": t0.product, "price": float(t0.price)},
                ]

            def _place():
                return self._kite.place_gtt(
                    trigger_type=trigger_type,
                    tradingsymbol=req.tradingsymbol,
                    exchange=req.exchange,
                    trigger_values=trigger_values,
                    last_price=float(req.ltp),
                    orders=orders,
                )
            raw = await asyncio.to_thread(_place)
            gtt_id = str(raw.get("trigger_id", raw.get("id", ""))) if isinstance(raw, dict) else str(raw)
            return GTTResult(gtt_id=gtt_id, status="active")
        except Exception as exc:
            logger.warning("zerodha.create_gtt_failed", error=str(exc))
            return GTTResult(gtt_id="", status="error", message=str(exc))

    async def cancel_gtt(self, gtt_id: str) -> "GTTResult":
        try:
            from markets_worker.brokers.base import GTTResult
            await asyncio.to_thread(self._kite.delete_gtt, int(gtt_id))
            return GTTResult(gtt_id=gtt_id, status="cancelled")
        except Exception as exc:
            logger.warning("zerodha.cancel_gtt_failed", error=str(exc))
            return GTTResult(gtt_id=gtt_id, status="error", message=str(exc))

    async def get_gtts(self) -> list:
        try:
            from markets_worker.brokers.base import GTTOrder, GTTTrigger
            raw = await asyncio.to_thread(self._kite.get_gtts)
            result = []
            for row in (raw or []):
                cond = row.get("condition", {})
                orders = row.get("orders", [{}])
                triggers = []
                for leg in orders:
                    triggers.append(GTTTrigger(
                        transaction_type=leg.get("transaction_type", "BUY"),
                        quantity=int(leg.get("quantity", 0)),
                        order_type=leg.get("order_type", "LIMIT"),
                        trigger_price=Decimal(str(cond.get("trigger_values", [0])[0])),
                        price=Decimal(str(leg.get("price", 0))),
                        product=leg.get("product", "CNC"),
                    ))
                result.append(GTTOrder(
                    gtt_id=str(row.get("id", "")),
                    status=str(row.get("status", "active")).lower(),
                    tradingsymbol=cond.get("tradingsymbol", ""),
                    exchange=cond.get("exchange", "NSE"),
                    trigger_type="oco" if row.get("type") == "two-leg" else "single",
                    ltp=Decimal(str(cond.get("last_price", 0))),
                    triggers=triggers,
                ))
            return result
        except Exception as exc:
            logger.warning("zerodha.get_gtts_failed", error=str(exc))
            return []
