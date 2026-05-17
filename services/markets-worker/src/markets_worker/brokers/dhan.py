"""
Dhan HQ adapter.

Required credentials dict keys:
    client_id    – Dhan client ID
    access_token – long-lived token from console.dhan.co → My Profile → Access Token

Dhan tokens do NOT expire daily — no automated refresh needed.
The scheduler will still verify the connection daily and mark it 'error'
if any API call fails.

Docs: https://dhanhq.co/docs/v2/
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


class DhanAdapter(BrokerAdapter):
    name         = "dhan"
    display_name = "Dhan (DhanHQ)"

    supports_mf        = True
    supports_fno       = True
    supports_currency  = True
    supports_commodity = True
    supports_gtt       = True   # GTT / OCO supported natively
    supports_websocket = True

    # Dhan exchange segment codes
    _SEG_MAP = {
        "NSE": "NSE_EQ", "BSE": "BSE_EQ",
        "NFO": "NSE_FNO", "CDS": "NSE_CURRENCY",
        "MCX": "MCX_COMM",
    }

    def __init__(self, credentials: dict[str, Any]) -> None:
        super().__init__(credentials)
        self._dhan: Any = None

    async def connect(self) -> None:
        try:
            from dhanhq import dhanhq  # type: ignore
        except ImportError as exc:
            raise RuntimeError("dhanhq not installed. Run: uv add dhanhq") from exc

        client_id    = self._creds["client_id"]
        access_token = self._creds["access_token"]

        self._dhan = await asyncio.to_thread(
            dhanhq, client_id=client_id, access_token=access_token)
        self._connected = True
        logger.info("dhan.connected", client_id=client_id)

    async def disconnect(self) -> None:
        self._dhan = None
        self._connected = False

    # ── Auth (Dhan uses long-lived tokens — no OAuth required) ────────────────

    @classmethod
    def get_auth_url(cls, **kwargs: Any) -> str:
        return "https://console.dhan.co/api-credentials"  # user generates token here

    @classmethod
    async def exchange_auth_code(cls, code: str, **kwargs: Any) -> AuthResult:
        # code = access_token directly (no exchange needed)
        return AuthResult(
            access_token=code,
            expires_at=None,   # Dhan tokens don't expire
        )

    async def refresh_tokens(self) -> AuthResult:
        # No refresh needed — token is long-lived
        return AuthResult(
            access_token=self._creds["access_token"],
            expires_at=None,
        )

    # ── Market data ───────────────────────────────────────────────────────────

    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        results: list[Quote] = []
        for sym in symbols:
            exchange, ts = (sym.split(":", 1) + [""])[:2] if ":" in sym else ("NSE", sym)
            seg = self._SEG_MAP.get(exchange, "NSE_EQ")
            try:
                def _q(s: str = ts, sg: str = seg) -> Any:
                    return self._dhan.get_ltp_data(security_id=s, exchange_segment=sg)
                raw = await asyncio.to_thread(_q)
                if raw and raw.get("status") == "success":
                    d = raw["data"]
                    results.append(Quote(
                        symbol=ts, exchange=exchange,
                        ltp=Decimal(str(d.get("last_price", 0))),
                        close=Decimal(str(d.get("close", 0))),
                        open=Decimal(str(d.get("open", 0))),
                        high=Decimal(str(d.get("high", 0))),
                        low=Decimal(str(d.get("low", 0))),
                        volume=int(d.get("volume", 0)),
                        oi=int(d.get("oi", 0)) if d.get("oi") else None,
                    ))
            except Exception as exc:
                logger.warning("dhan.quote_failed", symbol=sym, error=str(exc))
        return results

    async def get_ohlcv(
        self, symbol: str, exchange: str,
        interval: str, from_date: date, to_date: date,
    ) -> list[Candle]:
        seg = self._SEG_MAP.get(exchange, "NSE_EQ")
        _INT = {
            "1minute": 1, "5minute": 5, "15minute": 15, "30minute": 30,
            "60minute": 60, "day": "D",
        }
        chart_type = "intraday" if isinstance(_INT.get(interval), int) else "daily"
        interval_val = _INT.get(interval, "D")

        def _hist() -> Any:
            if chart_type == "intraday":
                return self._dhan.intraday_minute_data(
                    security_id=symbol, exchange_segment=seg,
                    instrument_type="EQUITY",
                )
            else:
                return self._dhan.historical_daily_data(
                    security_id=symbol, exchange_segment=seg,
                    instrument_type="EQUITY",
                    expiry_code=0,
                    from_date=from_date.isoformat(),
                    to_date=to_date.isoformat(),
                )

        raw = await asyncio.to_thread(_hist)
        candles: list[Candle] = []
        if raw and raw.get("status") == "success":
            data = raw.get("data", {})
            opens  = data.get("open", [])
            highs  = data.get("high", [])
            lows   = data.get("low", [])
            closes = data.get("close", [])
            vols   = data.get("volume", [])
            times  = data.get("timestamp", [])
            for i in range(len(closes)):
                candles.append(Candle(
                    ts=datetime.fromtimestamp(times[i]) if times else datetime.now(),
                    open=Decimal(str(opens[i])),
                    high=Decimal(str(highs[i])),
                    low=Decimal(str(lows[i])),
                    close=Decimal(str(closes[i])),
                    volume=int(vols[i]) if vols else 0,
                ))
        return candles

    # ── Portfolio ─────────────────────────────────────────────────────────────

    async def get_holdings(self) -> list[Holding]:
        raw = await asyncio.to_thread(self._dhan.get_holdings)
        holdings: list[Holding] = []
        if raw and raw.get("status") == "success":
            for d in raw.get("data", []):
                holdings.append(Holding(
                    tradingsymbol=d.get("trading_symbol", ""),
                    exchange=d.get("exchange", "NSE"),
                    isin=d.get("isin", ""),
                    quantity=Decimal(str(d.get("total_qty", 0))),
                    avg_cost=Decimal(str(d.get("buy_avg", 0))),
                    last_price=Decimal(str(d.get("last_traded_price", 0))),
                    pnl=Decimal(str(d.get("unrealized_profit", 0))),
                    t1_quantity=Decimal(str(d.get("t1_qty", 0))),
                ))
        return holdings

    async def get_positions(self) -> list[Position]:
        raw = await asyncio.to_thread(self._dhan.get_positions)
        positions: list[Position] = []
        if raw and raw.get("status") == "success":
            for d in raw.get("data", []):
                positions.append(Position(
                    tradingsymbol=d.get("trading_symbol", ""),
                    exchange=d.get("exchange", "NSE"),
                    product=d.get("product_type", "MIS"),
                    quantity=Decimal(str(d.get("net_qty", 0))),
                    avg_price=Decimal(str(d.get("cost_price", 0))),
                    last_price=Decimal(str(d.get("last_traded_price", 0))),
                    pnl=Decimal(str(d.get("unrealized_profit", 0))),
                    realised_pnl=Decimal(str(d.get("realized_profit", 0))),
                    m2m=Decimal(str(d.get("mtm", 0))),
                    day_buy_qty=Decimal(str(d.get("buy_qty", 0))),
                    day_sell_qty=Decimal(str(d.get("sell_qty", 0))),
                    segment=d.get("exchange_segment", "equity").lower(),
                ))
        return positions

    async def get_orders(self) -> list[Order]:
        raw = await asyncio.to_thread(self._dhan.get_order_list)
        orders: list[Order] = []
        if raw and raw.get("status") == "success":
            for d in raw.get("data", []):
                orders.append(Order(
                    broker_order_id=str(d.get("orderId", "")),
                    tradingsymbol=d.get("tradingSymbol", ""),
                    exchange=d.get("exchangeSegment", "NSE_EQ").replace("_EQ", ""),
                    transaction_type=d.get("transactionType", "BUY"),
                    order_type=d.get("orderType", "MARKET"),
                    product=d.get("productType", "CNC"),
                    quantity=Decimal(str(d.get("quantity", 0))),
                    filled_quantity=Decimal(str(d.get("filledQty", 0))),
                    price=Decimal(str(d.get("price", 0))),
                    avg_fill_price=Decimal(str(d.get("averageTradedPrice", 0))),
                    status=d.get("orderStatus", "PENDING").lower(),
                ))
        return orders

    # ── Order management ──────────────────────────────────────────────────────

    async def place_order(self, req: OrderRequest) -> OrderResult:
        seg = self._SEG_MAP.get(req.exchange, "NSE_EQ")
        params = {
            "security_id": req.tradingsymbol,
            "exchange_segment": seg,
            "transaction_type": req.transaction_type,
            "quantity": req.quantity,
            "order_type": req.order_type,
            "product_type": req.product,
            "price": float(req.price or 0),
            "trigger_price": float(req.trigger_price or 0),
            "disclosed_quantity": req.disclosed_qty,
            "validity": req.validity,
            "after_market_order": False,
            "amo_time": "OPEN",
            "bo_profit_value": 0,
            "bo_stop_loss_value": 0,
            "tag": req.tag or None,
        }
        raw = await asyncio.to_thread(self._dhan.place_order, **params)
        if raw and raw.get("status") == "success":
            return OrderResult(
                broker_order_id=str(raw.get("data", {}).get("orderId", "")),
                status="open",
            )
        return OrderResult(broker_order_id="", status="rejected",
                           message=raw.get("remarks", "") if raw else "")

    async def modify_order(self, broker_order_id: str, **kwargs: Any) -> OrderResult:
        raw = await asyncio.to_thread(
            self._dhan.modify_order,
            order_id=broker_order_id,
            order_type=kwargs.get("order_type", "LIMIT"),
            leg_name=kwargs.get("leg_name", "ENTRY_LEG"),
            quantity=kwargs.get("quantity", 0),
            price=kwargs.get("price", 0),
            trigger_price=kwargs.get("trigger_price", 0),
            disclosed_quantity=0,
            validity=kwargs.get("validity", "DAY"),
        )
        status = "modified" if (raw and raw.get("status") == "success") else "error"
        return OrderResult(broker_order_id=broker_order_id, status=status,
                           message=raw.get("remarks", "") if raw else "")

    async def cancel_order(self, broker_order_id: str) -> OrderResult:
        raw = await asyncio.to_thread(self._dhan.cancel_order, order_id=broker_order_id)
        status = "cancelled" if (raw and raw.get("status") == "success") else "error"
        return OrderResult(broker_order_id=broker_order_id, status=status,
                           message=raw.get("remarks", "") if raw else "")

    async def get_margins(self) -> dict[str, Any]:
        raw = await asyncio.to_thread(self._dhan.get_fund_limits)
        return raw.get("data", {}) if raw else {}

    # ── Mutual Funds ──────────────────────────────────────────────────────────

    async def get_mf_holdings(self) -> list[dict[str, Any]]:
        try:
            raw = await asyncio.to_thread(self._dhan.get_fund_limits)
            # Dhan's MF holdings endpoint
            holdings_raw = await asyncio.to_thread(
                lambda: self._dhan.get_holdings() if hasattr(self._dhan, 'get_holdings') else {"data": []}
            )
            data = (holdings_raw or {}).get("data", []) or []
            mf = [h for h in data if h.get("exchange", "") in ("BSE", "NSE") and
                  h.get("product", "") in ("MF", "MUTUAL_FUND")]
            return mf
        except Exception as exc:
            logger.warning("dhan.get_mf_holdings_failed", error=str(exc))
            return []

    async def get_mf_orders(self) -> list:
        try:
            raw = await asyncio.to_thread(self._dhan.get_order_list)
            orders = (raw or {}).get("data", []) or []
            return [o for o in orders if o.get("productType", "") in ("MF", "MUTUAL_FUND")]
        except Exception as exc:
            logger.warning("dhan.get_mf_orders_failed", error=str(exc))
            return []

    async def place_mf_order(self, order: dict[str, Any]) -> dict[str, Any]:
        """Place MF order via Dhan. order keys: isin, order_type, amount, units."""
        try:
            raw = await asyncio.to_thread(
                self._dhan.place_order,
                security_id=order.get("isin", ""),
                exchange_segment="BSE_EQ",
                transaction_type="BUY" if order.get("order_type", "").upper() in ("PURCHASE", "BUY") else "SELL",
                quantity=int(order.get("units") or 1),
                order_type="MARKET",
                product_type="MF",
                price=float(order.get("amount") or 0),
            )
            if raw and raw.get("status") == "success":
                return {"status": "ok", "order_id": (raw.get("data") or {}).get("orderId", ""), "message": ""}
            return {"status": "error", "message": (raw or {}).get("remarks", "Order failed")}
        except Exception as exc:
            logger.warning("dhan.place_mf_order_failed", error=str(exc))
            return {"status": "error", "message": str(exc)}

    # ── GTT / Forever Orders ─────────────────────────────────────────────────────

    async def create_gtt(self, req: "GTTRequest") -> "GTTResult":
        """Dhan Forever Order (equivalent to GTT single-leg)."""
        try:
            from markets_worker.brokers.base import GTTResult
            t = req.triggers[0]
            # Dhan forever order uses place_order with order_type="SL" + validity
            # Map GTT to a Dhan stop-loss order with extended validity
            raw = await asyncio.to_thread(
                self._client.place_order,
                security_id=req.tradingsymbol,
                exchange_segment=f"{req.exchange}_EQ",
                transaction_type=t.transaction_type,
                quantity=t.quantity,
                order_type="SL",
                product_type=t.product,
                price=float(t.price),
                trigger_price=float(t.trigger_price),
                validity="GTC",     # Good Till Cancelled = Forever Order
            )
            if raw and raw.get("status") == "success":
                gtt_id = str((raw.get("data") or {}).get("orderId", ""))
                return GTTResult(gtt_id=gtt_id, status="active")
            return GTTResult(gtt_id="", status="error",
                             message=(raw or {}).get("remarks", "GTT creation failed"))
        except Exception as exc:
            logger.warning("dhan.create_gtt_failed", error=str(exc))
            return GTTResult(gtt_id="", status="error", message=str(exc))

    async def cancel_gtt(self, gtt_id: str) -> "GTTResult":
        try:
            from markets_worker.brokers.base import GTTResult
            raw = await asyncio.to_thread(self._client.cancel_order, gtt_id)
            status = "cancelled" if (raw and raw.get("status") == "success") else "error"
            return GTTResult(gtt_id=gtt_id, status=status)
        except Exception as exc:
            logger.warning("dhan.cancel_gtt_failed", error=str(exc))
            return GTTResult(gtt_id=gtt_id, status="error", message=str(exc))

    async def get_gtts(self) -> list:
        """Return GTC orders from Dhan order book."""
        try:
            from markets_worker.brokers.base import GTTOrder, GTTTrigger
            raw = await asyncio.to_thread(self._dhan.get_order_list)
            orders = (raw or {}).get("data", []) or []
            result = []
            for row in orders:
                if row.get("validity", "") not in ("GTC", "GTD"):
                    continue
                result.append(GTTOrder(
                    gtt_id=str(row.get("orderId", "")),
                    status=str(row.get("orderStatus", "PENDING")).lower(),
                    tradingsymbol=row.get("tradingSymbol", ""),
                    exchange=row.get("exchangeSegment", "NSE_EQ").split("_")[0],
                    trigger_type="single",
                    ltp=Decimal("0"),
                    triggers=[GTTTrigger(
                        transaction_type=row.get("transactionType", "BUY"),
                        quantity=int(row.get("quantity", 0)),
                        order_type=row.get("orderType", "LIMIT"),
                        trigger_price=Decimal(str(row.get("triggerPrice", 0))),
                        price=Decimal(str(row.get("price", 0))),
                        product=row.get("productType", "CNC"),
                    )],
                ))
            return result
        except Exception as exc:
            logger.warning("dhan.get_gtts_failed", error=str(exc))
            return []
