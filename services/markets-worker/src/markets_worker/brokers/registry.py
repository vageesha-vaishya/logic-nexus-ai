"""
Broker registry — maps broker name strings to adapter classes.
Import this to get an adapter instance from a broker_connections row.
"""

from __future__ import annotations

from typing import Any, Type

from .base import BrokerAdapter
from .breeze import BreezeAdapter
from .angel import AngelAdapter
from .dhan import DhanAdapter
from .fyers import FyersAdapter
from .zerodha import ZerodhaAdapter

_REGISTRY: dict[str, Type[BrokerAdapter]] = {
    "icici_breeze":    BreezeAdapter,
    "angel_one":       AngelAdapter,
    "dhan":            DhanAdapter,
    "fyers":           FyersAdapter,
    "zerodha":         ZerodhaAdapter,
}


def get_adapter_class(broker: str) -> Type[BrokerAdapter]:
    cls = _REGISTRY.get(broker)
    if cls is None:
        raise ValueError(
            f"Unknown broker '{broker}'. "
            f"Supported: {', '.join(_REGISTRY)}"
        )
    return cls


def build_adapter(broker: str, credentials: dict[str, Any]) -> BrokerAdapter:
    """Construct a broker adapter from a credentials dict (already decrypted)."""
    return get_adapter_class(broker)(credentials)


def list_brokers() -> list[dict[str, Any]]:
    """Return metadata for all registered brokers (used by the frontend)."""
    return [
        {
            "id":            "icici_breeze",
            "name":          "ICICI Direct (Breeze API)",
            "auth_type":     "session_token",
            "data_cost":     "Free",
            "supports":      ["equity", "fno", "currency", "commodity"],
            "refresh":       "manual",
            "logo":          "icici.svg",
        },
        {
            "id":            "angel_one",
            "name":          "Angel One (SmartAPI)",
            "auth_type":     "totp",
            "data_cost":     "Free",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "automated",
            "logo":          "angel.svg",
        },
        {
            "id":            "dhan",
            "name":          "Dhan (DhanHQ)",
            "auth_type":     "api_key",
            "data_cost":     "Free (≥25 trades) or ₹499/mo",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "none",
            "logo":          "dhan.svg",
        },
        {
            "id":            "fyers",
            "name":          "Fyers API v3",
            "auth_type":     "oauth",
            "data_cost":     "Free",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "manual",
            "logo":          "fyers.svg",
        },
        {
            "id":            "zerodha",
            "name":          "Zerodha (Kite Connect)",
            "auth_type":     "oauth",
            "data_cost":     "₹2,000/month",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "manual",
            "logo":          "zerodha.svg",
        },
    ]
