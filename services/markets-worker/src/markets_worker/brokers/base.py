"""
Abstract BrokerAdapter base class and shared data types.

Every broker adapter inherits from BrokerAdapter and implements the methods
marked @abstractmethod.  Optional capabilities (MF, GTT, options chain) are
implemented on the concrete class; callers check `adapter.supports_mf` etc.
before calling.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, AsyncIterator


# ── Shared data types ─────────────────────────────────────────────────────────

@dataclass
class Quote:
    symbol:       str
    exchange:     str
    ltp:          Decimal
    bid:          Decimal | None = None
    ask:          Decimal | None = None
    open:         Decimal | None = None
    high:         Decimal | None = None
    low:          Decimal | None = None
    close:        Decimal | None = None   # previous close
    volume:       int = 0
    oi:           int | None = None       # open interest (F&O)
    change:       Decimal = Decimal("0")
    change_pct:   Decimal = Decimal("0")
    ts:           datetime | None = None


@dataclass
class Candle:
    ts:     datetime
    open:   Decimal
    high:   Decimal
    low:    Decimal
    close:  Decimal
    volume: int = 0
    oi:     int = 0


@dataclass
class Holding:
    tradingsymbol: str
    exchange:      str
    isin:          str
    quantity:      Decimal
    avg_cost:      Decimal
    last_price:    Decimal = Decimal("0")
    pnl:           Decimal = Decimal("0")
    pnl_pct:       Decimal = Decimal("0")
    product:       str = "CNC"
    t1_quantity:   Decimal = Decimal("0")   # shares bought today, pending delivery


@dataclass
class Position:
    tradingsymbol:   str
    exchange:        str
    product:         str                    # MIS | NRML | CNC
    quantity:        Decimal                # net; negative = short
    avg_price:       Decimal
    last_price:      Decimal = Decimal("0")
    pnl:             Decimal = Decimal("0")
    realised_pnl:    Decimal = Decimal("0")
    m2m:             Decimal = Decimal("0")
    multiplier:      Decimal = Decimal("1")
    close_price:     Decimal = Decimal("0")
    overnight_qty:   Decimal = Decimal("0")
    day_buy_qty:     Decimal = Decimal("0")
    day_sell_qty:    Decimal = Decimal("0")
    segment:         str = "equity"


@dataclass
class OrderRequest:
    tradingsymbol:    str
    exchange:         str
    transaction_type: str            # BUY | SELL
    quantity:         int
    order_type:       str            # MARKET | LIMIT | SL | SL-M
    product:          str            # CNC | MIS | NRML
    price:            Decimal | None = None
    trigger_price:    Decimal | None = None
    validity:         str = "DAY"
    disclosed_qty:    int = 0
    tag:              str = ""       # algo_id for SEBI


@dataclass
class OrderResult:
    broker_order_id: str
    status:          str
    message:         str | None = None


@dataclass
class Order:
    broker_order_id:  str
    tradingsymbol:    str
    exchange:         str
    transaction_type: str
    order_type:       str
    product:          str
    quantity:         Decimal
    filled_quantity:  Decimal = Decimal("0")
    pending_quantity: Decimal = Decimal("0")
    price:            Decimal = Decimal("0")
    avg_fill_price:   Decimal = Decimal("0")
    trigger_price:    Decimal = Decimal("0")
    status:           str = "open"
    status_message:   str = ""
    order_timestamp:  datetime | None = None
    exchange_timestamp: datetime | None = None
    tag:              str = ""


@dataclass
class MFOrder:
    folio_number:    str | None
    isin:            str
    scheme_name:     str
    order_type:      str            # PURCHASE | REDEMPTION | SIP | SWP | STP | SWITCH
    amount:          Decimal | None = None
    units:           Decimal | None = None
    nav:             Decimal | None = None
    status:          str = "pending"
    broker_order_id: str | None = None
    allotment_date:  date | None = None
    allotment_units: Decimal | None = None


@dataclass
class AuthResult:
    """Credentials returned after a successful authentication."""
    access_token:   str
    refresh_token:  str | None = None
    feed_token:     str | None = None    # Angel One WebSocket token
    expires_at:     datetime | None = None
    extra:          dict[str, Any] = field(default_factory=dict)


# ── Abstract base ─────────────────────────────────────────────────────────────

class BrokerAdapter(ABC):
    """
    Abstract base for all broker adapters.

    Lifecycle:
        adapter = ConcreteAdapter(credentials_dict)
        await adapter.connect()           # validate + set up session
        quotes = await adapter.get_quotes(["NSE:RELIANCE"])
        await adapter.disconnect()

    credentials_dict is the decrypted dict from broker_connections.credentials_enc.
    Its schema is broker-specific; see each concrete class for documentation.
    """

    name:         str = ""    # snake_case broker identifier matching DB enum
    display_name: str = ""    # "Angel One SmartAPI"

    # Capability flags — concrete classes override as needed
    supports_mf:          bool = False
    supports_fno:         bool = True
    supports_currency:    bool = True
    supports_commodity:   bool = False
    supports_gtt:         bool = False
    supports_websocket:   bool = True

    def __init__(self, credentials: dict[str, Any]) -> None:
        self._creds = credentials
        self._connected = False

    # ── Auth ──────────────────────────────────────────────────────────────────

    @abstractmethod
    async def connect(self) -> None:
        """Validate credentials and initialise the session."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Close session / WebSocket cleanly."""
        ...

    @classmethod
    def get_auth_url(cls, **kwargs: Any) -> str:
        """
        For OAuth-based brokers: return the URL the user should visit to
        authorise. Returns empty string for non-OAuth brokers.
        """
        return ""

    @classmethod
    @abstractmethod
    async def exchange_auth_code(cls, code: str, **kwargs: Any) -> AuthResult:
        """
        Exchange an OAuth auth code (or session token) for access tokens.
        For non-OAuth brokers, raise NotImplementedError.
        """
        ...

    @abstractmethod
    async def refresh_tokens(self) -> AuthResult:
        """
        Refresh the access token using stored refresh credentials.
        Called by the daily token-refresh scheduler at 08:00 IST.
        Returns updated AuthResult to be re-encrypted and stored.
        """
        ...

    # ── Market data ───────────────────────────────────────────────────────────

    @abstractmethod
    async def get_quotes(self, symbols: list[str]) -> list[Quote]:
        """
        Fetch latest quotes.
        symbols format: "EXCHANGE:TRADINGSYMBOL"  e.g. "NSE:RELIANCE"
        """
        ...

    @abstractmethod
    async def get_ohlcv(
        self,
        symbol: str,
        exchange: str,
        interval: str,          # "1minute" | "5minute" | "15minute" | "day" | "week"
        from_date: date,
        to_date: date,
    ) -> list[Candle]:
        ...

    async def stream_quotes(self, symbols: list[str]) -> AsyncIterator[Quote]:
        """WebSocket quote stream. Override in adapters that support it."""
        raise NotImplementedError(f"{self.display_name} stream_quotes not implemented")
        yield  # make this a generator

    async def get_option_chain(self, underlying: str, expiry: date) -> dict[str, Any]:
        """Options chain for a given underlying and expiry."""
        raise NotImplementedError(f"{self.display_name} get_option_chain not implemented")

    # ── Portfolio ─────────────────────────────────────────────────────────────

    @abstractmethod
    async def get_holdings(self) -> list[Holding]:
        ...

    @abstractmethod
    async def get_positions(self) -> list[Position]:
        ...

    @abstractmethod
    async def get_orders(self) -> list[Order]:
        """Today's order book."""
        ...

    async def get_order_history(self, order_id: str) -> list[Order]:
        """Full history for a single order (fills, modifications)."""
        raise NotImplementedError

    # ── Order management ──────────────────────────────────────────────────────

    @abstractmethod
    async def place_order(self, req: OrderRequest) -> OrderResult:
        ...

    @abstractmethod
    async def modify_order(self, broker_order_id: str, **kwargs: Any) -> OrderResult:
        ...

    @abstractmethod
    async def cancel_order(self, broker_order_id: str) -> OrderResult:
        ...

    # ── Mutual funds (optional) ───────────────────────────────────────────────

    async def get_mf_holdings(self) -> list[dict[str, Any]]:
        raise NotImplementedError(f"{self.display_name} MF not supported")

    async def get_mf_orders(self) -> list[MFOrder]:
        raise NotImplementedError(f"{self.display_name} MF not supported")

    async def place_mf_order(self, order: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError(f"{self.display_name} MF not supported")

    # ── Utilities ─────────────────────────────────────────────────────────────

    async def get_margins(self) -> dict[str, Any]:
        """Available margin / funds."""
        raise NotImplementedError

    async def get_instrument_master(
        self, exchange: str
    ) -> list[dict[str, Any]]:
        """Full instrument list for an exchange (for symbol lookup)."""
        raise NotImplementedError

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} connected={self._connected}>"
