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
from .groww import GrowwAdapter
from .zerodha import ZerodhaAdapter
from .kotak import KotakAdapter

_REGISTRY: dict[str, Type[BrokerAdapter]] = {
    "icici_breeze":    BreezeAdapter,
    "angel_one":       AngelAdapter,
    "dhan":            DhanAdapter,
    "fyers":           FyersAdapter,
    "groww":           GrowwAdapter,
    "zerodha":         ZerodhaAdapter,
    "kotak_neo":       KotakAdapter,
}

# ── Preview brokers (API exists but adapter not yet implemented) ──────────────
# Listed in the UI as "Coming soon — request access" so users can apply for
# API keys directly with the broker. No entry in _REGISTRY → build_adapter()
# raises ValueError if anything ever tries to instantiate one. Promote to
# _REGISTRY by writing the adapter and moving the entry.
_PREVIEW: dict[str, dict[str, Any]] = {}


# ── Import-only brokers (no trading API available) ────────────────────────────
# These appear in the frontend so users can see why live trading isn't offered,
# and are directed to the CSV import flow instead.
_IMPORT_ONLY: dict[str, dict[str, Any]] = {
    "axis_direct": {
        "id":          "axis_direct",
        "name":        "Axis Bank Direct",
        "auth_type":   "none",
        "data_cost":   "N/A",
        "supports":    ["equity"],
        "refresh":     "none",
        "import_note": "No public trading API. Import holdings via NSDL Demat CAS statement.",
        "logo":        "axis.svg",
        "tier":        "import_only",
    },
    "hdfc_securities": {
        "id":          "hdfc_securities",
        "name":        "HDFC Securities",
        "auth_type":   "none",
        "data_cost":   "N/A",
        "supports":    ["equity"],
        "refresh":     "none",
        "import_note": "Import holdings via CDSL/NSDL Demat CAS or HDFC Securities CSV export.",
        "logo":        "hdfc.svg",
        "tier":        "import_only",
    },
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
    """Return metadata for all brokers — full API + import-only tiers."""
    full_api = [
        {
            "id":            "icici_breeze",
            "name":          "ICICI Direct (Breeze API)",
            "auth_type":     "session_token",
            "data_cost":     "Free",
            "supports":      ["equity", "fno", "currency", "commodity"],
            "refresh":       "manual",
            "logo":          "icici.svg",
            "tier":          "full_api",
        },
        {
            "id":            "angel_one",
            "name":          "Angel One (SmartAPI)",
            "auth_type":     "totp",
            "data_cost":     "Free",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "automated",
            "logo":          "angel.svg",
            "tier":          "full_api",
        },
        {
            "id":            "dhan",
            "name":          "Dhan (DhanHQ)",
            "auth_type":     "api_key",
            "data_cost":     "Free (≥25 trades) or ₹499/mo",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "none",
            "logo":          "dhan.svg",
            "tier":          "full_api",
        },
        {
            "id":            "groww",
            "name":          "Groww (Trade API)",
            "auth_type":     "api_key_secret",
            "data_cost":     "Free (daily approval required)",
            "supports":      ["equity", "fno", "mf"],
            "refresh":       "automated",
            "logo":          "groww.svg",
            "tier":          "full_api",
        },
        {
            "id":            "fyers",
            "name":          "Fyers API v3",
            "auth_type":     "oauth",
            "data_cost":     "Free",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "manual",
            "logo":          "fyers.svg",
            "tier":          "full_api",
        },
        {
            "id":            "zerodha",
            "name":          "Zerodha (Kite Connect)",
            "auth_type":     "oauth",
            "data_cost":     "₹2,000/month",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "manual",
            "logo":          "zerodha.svg",
            "tier":          "full_api",
        },
        {
            "id":            "kotak_neo",
            "name":          "Kotak Securities (Neo API)",
            "auth_type":     "otp",
            "data_cost":     "Free",
            "supports":      ["equity", "fno", "currency", "commodity", "mf"],
            "refresh":       "otp",
            "logo":          "kotak.svg",
            "tier":          "full_api",
        },
    ]
    return full_api + list(_PREVIEW.values()) + list(_IMPORT_ONLY.values())
