"""
Unit tests for GrowwAdapter with the growwapi SDK mocked.

These tests verify the adapter's plumbing — argument shapes, response
normalisation, error fallbacks. They do NOT verify behaviour against the
real Groww API: the SDK's exact method names and response key names are
inferred from incomplete public docs. Once the first real call lands, any
key-name mismatches should be fixed in groww.py and corresponding test
fixtures updated here.
"""
from __future__ import annotations

import sys
import types
from decimal import Decimal
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def fake_growwapi(monkeypatch):
    """
    Install a stub `growwapi` module into sys.modules so GrowwAdapter can
    import it without the real package being available.
    """
    module = types.ModuleType("growwapi")
    fake_class = MagicMock(name="GrowwAPI")
    fake_class.get_access_token = MagicMock(return_value="MOCK_ACCESS_TOKEN")
    module.GrowwAPI = fake_class
    monkeypatch.setitem(sys.modules, "growwapi", module)
    return fake_class


@pytest.fixture
def adapter(fake_growwapi):
    from markets_worker.brokers.groww import GrowwAdapter
    return GrowwAdapter({
        "api_key":    "test-key",
        "api_secret": "test-secret",
    })


# ── Connection / auth ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_connect_generates_access_token_when_missing(adapter, fake_growwapi):
    await adapter.connect()
    fake_growwapi.get_access_token.assert_called_once_with(
        api_key="test-key", secret="test-secret",
    )
    fake_growwapi.assert_called_once_with("MOCK_ACCESS_TOKEN")
    assert adapter._connected is True
    assert adapter._creds["access_token"] == "MOCK_ACCESS_TOKEN"


@pytest.mark.asyncio
async def test_connect_reuses_existing_access_token(fake_growwapi):
    from markets_worker.brokers.groww import GrowwAdapter
    a = GrowwAdapter({
        "api_key":      "test-key",
        "api_secret":   "test-secret",
        "access_token": "CACHED_TOKEN",
    })
    await a.connect()
    fake_growwapi.get_access_token.assert_not_called()
    fake_growwapi.assert_called_once_with("CACHED_TOKEN")


@pytest.mark.asyncio
async def test_connect_raises_without_keys_and_no_token(fake_growwapi):
    from markets_worker.brokers.groww import GrowwAdapter
    a = GrowwAdapter({})
    with pytest.raises(RuntimeError, match="api_key"):
        await a.connect()


@pytest.mark.asyncio
async def test_refresh_tokens_regenerates(adapter, fake_growwapi):
    await adapter.connect()
    fake_growwapi.get_access_token.reset_mock()
    fake_growwapi.get_access_token.return_value = "NEW_TOKEN"

    result = await adapter.refresh_tokens()

    assert result.access_token == "NEW_TOKEN"
    assert adapter._creds["access_token"] == "NEW_TOKEN"
    fake_growwapi.get_access_token.assert_called_once()


@pytest.mark.asyncio
async def test_exchange_auth_code_raises(fake_growwapi):
    from markets_worker.brokers.groww import GrowwAdapter
    with pytest.raises(NotImplementedError):
        await GrowwAdapter.exchange_auth_code("any")


def test_get_auth_url_returns_keys_page(fake_growwapi):
    from markets_worker.brokers.groww import GrowwAdapter
    assert "groww.in/trade-api/api-keys" in GrowwAdapter.get_auth_url()


# ── Portfolio reads ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_holdings_normalises_response(adapter, fake_growwapi):
    await adapter.connect()
    client = fake_growwapi.return_value
    client.get_holdings = MagicMock(return_value={
        "data": [
            {
                "trading_symbol": "WIPRO", "exchange": "NSE", "isin": "INE075A01022",
                "quantity": 10, "average_price": "420.50", "last_price": "445.10",
                "pnl": "246.00",
            },
        ],
    })

    holdings = await adapter.get_holdings()

    assert len(holdings) == 1
    h = holdings[0]
    assert h.tradingsymbol == "WIPRO"
    assert h.quantity == Decimal("10")
    assert h.avg_cost == Decimal("420.50")
    assert h.last_price == Decimal("445.10")


@pytest.mark.asyncio
async def test_get_holdings_handles_bare_list(adapter, fake_growwapi):
    await adapter.connect()
    client = fake_growwapi.return_value
    client.get_holdings = MagicMock(return_value=[
        {"symbol": "TCS", "quantity": 5, "avg_price": "3100"},
    ])

    holdings = await adapter.get_holdings()
    assert len(holdings) == 1
    assert holdings[0].tradingsymbol == "TCS"
    assert holdings[0].avg_cost == Decimal("3100")


@pytest.mark.asyncio
async def test_get_holdings_falls_back_to_alternate_method(adapter, fake_growwapi):
    await adapter.connect()
    client = fake_growwapi.return_value
    # No get_holdings attribute — adapter should try get_holding_list
    del client.get_holdings
    client.get_holding_list = MagicMock(return_value=[
        {"symbol": "INFY", "quantity": 2, "avg_price": "1500"},
    ])

    holdings = await adapter.get_holdings()
    assert len(holdings) == 1
    assert holdings[0].tradingsymbol == "INFY"


@pytest.mark.asyncio
async def test_get_positions_returns_empty_when_method_missing(adapter, fake_growwapi):
    await adapter.connect()
    client = fake_growwapi.return_value
    del client.get_positions
    del client.get_position_list

    positions = await adapter.get_positions()
    assert positions == []


@pytest.mark.asyncio
async def test_get_orders_uses_get_order_list(adapter, fake_growwapi):
    await adapter.connect()
    client = fake_growwapi.return_value
    client.get_order_list = MagicMock(return_value={"data": [
        {
            "order_id": "GR-123", "trading_symbol": "RELIANCE",
            "exchange": "NSE", "transaction_type": "BUY",
            "order_type": "LIMIT", "product": "CNC",
            "quantity": 1, "filled_quantity": 0,
            "price": "2500", "order_status": "OPEN",
        },
    ]})

    orders = await adapter.get_orders()
    assert len(orders) == 1
    assert orders[0].broker_order_id == "GR-123"
    assert orders[0].status == "open"
    client.get_order_list.assert_called_once_with(timeout=5)


# ── Orders ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_place_order_passes_groww_param_names(adapter, fake_growwapi):
    from markets_worker.brokers.base import OrderRequest

    await adapter.connect()
    client = fake_growwapi.return_value
    client.place_order = MagicMock(return_value={"order_id": "GR-NEW-1"})

    req = OrderRequest(
        tradingsymbol="WIPRO", exchange="NSE",
        transaction_type="BUY", quantity=10,
        order_type="LIMIT", product="CNC",
        price=Decimal("420"), validity="DAY", tag="my-algo",
    )
    res = await adapter.place_order(req)

    assert res.broker_order_id == "GR-NEW-1"
    assert res.status == "open"
    call_kwargs = client.place_order.call_args.kwargs
    assert call_kwargs["trading_symbol"] == "WIPRO"
    assert call_kwargs["transaction_type"] == "BUY"
    assert call_kwargs["order_type"] == "LIMIT"
    assert call_kwargs["product"] == "CNC"
    assert call_kwargs["segment"] == "CASH"
    assert call_kwargs["order_reference_id"] == "my-algo"


@pytest.mark.asyncio
async def test_place_order_handles_failure(adapter, fake_growwapi):
    from markets_worker.brokers.base import OrderRequest

    await adapter.connect()
    client = fake_growwapi.return_value
    client.place_order = MagicMock(side_effect=Exception("insufficient margin"))

    req = OrderRequest(
        tradingsymbol="WIPRO", exchange="NSE", transaction_type="BUY",
        quantity=1, order_type="MARKET", product="CNC",
    )
    res = await adapter.place_order(req)

    assert res.status == "rejected"
    assert "insufficient margin" in res.message


@pytest.mark.asyncio
async def test_cancel_order_passes_order_id(adapter, fake_growwapi):
    await adapter.connect()
    client = fake_growwapi.return_value
    client.cancel_order = MagicMock(return_value={"status": "success"})

    res = await adapter.cancel_order("GR-XYZ")

    assert res.status == "cancelled"
    client.cancel_order.assert_called_once_with(order_id="GR-XYZ")


@pytest.mark.asyncio
async def test_fno_exchange_maps_to_fno_segment(adapter, fake_growwapi):
    from markets_worker.brokers.base import OrderRequest

    await adapter.connect()
    client = fake_growwapi.return_value
    client.place_order = MagicMock(return_value={"order_id": "GR-FNO-1"})

    req = OrderRequest(
        tradingsymbol="NIFTY24DECFUT", exchange="NFO",
        transaction_type="BUY", quantity=50, order_type="MARKET",
        product="NRML",
    )
    await adapter.place_order(req)
    assert client.place_order.call_args.kwargs["segment"] == "FNO"


# ── Registry wiring ────────────────────────────────────────────────────────────


def test_registry_includes_groww_as_full_api(fake_growwapi):
    from markets_worker.brokers.registry import (
        get_adapter_class, list_brokers,
    )
    from markets_worker.brokers.groww import GrowwAdapter

    assert get_adapter_class("groww") is GrowwAdapter

    listed = {b["id"]: b for b in list_brokers()}
    assert "groww" in listed
    assert listed["groww"]["tier"] == "full_api"
    assert listed["groww"]["auth_type"] == "api_key_secret"
