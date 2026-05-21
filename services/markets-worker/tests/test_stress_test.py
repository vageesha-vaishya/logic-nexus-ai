"""Stress-test endpoint tests — /v1/retail/stress-test.

Validates the per-scenario aggregation: portfolio value, total loss, top-3
losers ordering, fallback for unseeded symbols, and the empty-holdings path.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

from markets_worker.routers.stress_test import SCENARIOS


def _mk_response(data) -> MagicMock:
    return MagicMock(data=data)


def _patch_db(
    *,
    portfolios: list[dict],
    holdings_by_portfolio: dict[str, list[dict]],
    prices_by_iid: dict[str, float | None],
):
    """
    Wires three query paths:
      1. portfolios.select.eq("owner_user_id", X).execute() -> portfolios
      2. holdings.select.eq("portfolio_id", pid).gt("qty", 0).execute() -> holdings
      3. price_history.select.eq("instrument_id", iid).order.limit.maybe_single.execute() -> price
    """
    portfolios_resp = _mk_response(portfolios)
    portfolios_query = MagicMock()
    portfolios_query.select.return_value.eq.return_value.execute.return_value = portfolios_resp

    holdings_query = MagicMock()
    def _holdings_eq(col, val):
        if col != "portfolio_id":
            raise AssertionError(f"unexpected holdings filter: {col}")
        chain = MagicMock()
        chain.gt.return_value.execute.return_value = _mk_response(
            holdings_by_portfolio.get(val, []),
        )
        return chain
    holdings_query.select.return_value.eq.side_effect = _holdings_eq

    price_query = MagicMock()
    def _price_eq(col, val):
        if col != "instrument_id":
            raise AssertionError(f"unexpected price filter: {col}")
        price = prices_by_iid.get(val)
        chain = MagicMock()
        chain.order.return_value.limit.return_value.maybe_single.return_value.execute.return_value = (
            _mk_response({"close": price} if price is not None else None)
        )
        return chain
    price_query.select.return_value.eq.side_effect = _price_eq

    def _from(table):
        return {
            "portfolios":    portfolios_query,
            "holdings":      holdings_query,
            "price_history": price_query,
        }[table]

    mock_client = MagicMock()
    mock_client.schema.return_value.from_.side_effect = _from
    return mock_client


def test_stress_test_returns_zero_when_no_holdings(client, auth_headers):
    db = _patch_db(portfolios=[], holdings_by_portfolio={}, prices_by_iid={})
    with patch("markets_worker.routers.stress_test.get_supabase", return_value=db):
        resp = client.get("/v1/retail/stress-test", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["portfolio_value"] == 0
    assert body["holdings_count"] == 0
    # All three scenarios still render — losses are zero.
    assert len(body["scenarios"]) == 3
    for s in body["scenarios"]:
        assert s["loss_inr"] == 0
        assert s["loss_pct"] == 0
        assert s["top3_losers"] == []


def test_stress_test_applies_seeded_returns(client, auth_headers):
    """Holdings hit by seeded scenario returns produce correct per-scenario losses."""
    holdings = [
        # 100 RELIANCE @ ₹2500 = ₹250,000
        {"instrument_id": "i-rel", "qty": 100, "instruments": {"symbol": "RELIANCE"}},
    ]
    db = _patch_db(
        portfolios=[{"id": "pf-1"}],
        holdings_by_portfolio={"pf-1": holdings},
        prices_by_iid={"i-rel": 2500.0},
    )
    with patch("markets_worker.routers.stress_test.get_supabase", return_value=db):
        resp = client.get("/v1/retail/stress-test", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["portfolio_value"] == 250_000.0
    by_code = {s["code"]: s for s in body["scenarios"]}

    # RELIANCE COVID return is -0.40 → loss = -100,000
    covid = by_code["COVID_2020"]
    assert covid["loss_inr"] == -100_000.0
    assert covid["loss_pct"] == -40.0
    assert covid["top3_losers"][0]["symbol"] == "RELIANCE"
    assert covid["top3_losers"][0]["loss_inr"] == -100_000.0

    # Adani scenario: RELIANCE return is -0.03 → -7,500 loss
    adani = by_code["ADANI_2023"]
    assert adani["loss_inr"] == -7_500.0


def test_stress_test_aggregates_across_portfolios(client, auth_headers):
    """Holdings split across two portfolios are summed by symbol in the result."""
    pf1 = [{"instrument_id": "i-rel", "qty": 50, "instruments": {"symbol": "RELIANCE"}}]
    pf2 = [{"instrument_id": "i-rel", "qty": 50, "instruments": {"symbol": "RELIANCE"}}]
    db = _patch_db(
        portfolios=[{"id": "pf-1"}, {"id": "pf-2"}],
        holdings_by_portfolio={"pf-1": pf1, "pf-2": pf2},
        prices_by_iid={"i-rel": 2500.0},
    )
    with patch("markets_worker.routers.stress_test.get_supabase", return_value=db):
        resp = client.get("/v1/retail/stress-test", headers=auth_headers)

    body = resp.json()
    # 50+50 = 100 shares × ₹2500 = ₹250,000 total
    assert body["holdings_count"] == 1  # aggregated by symbol
    assert body["portfolio_value"] == 250_000.0


def test_stress_test_falls_back_for_unseeded_symbol(client, auth_headers):
    """A symbol not in SCENARIOS uses the scenario __default__ return."""
    holdings = [
        # An obscure small-cap not in any scenario map
        {"instrument_id": "i-x", "qty": 100, "instruments": {"symbol": "OBSCURECO"}},
    ]
    db = _patch_db(
        portfolios=[{"id": "pf-1"}],
        holdings_by_portfolio={"pf-1": holdings},
        prices_by_iid={"i-x": 100.0},
    )
    with patch("markets_worker.routers.stress_test.get_supabase", return_value=db):
        resp = client.get("/v1/retail/stress-test", headers=auth_headers)

    body = resp.json()
    by_code = {s["code"]: s for s in body["scenarios"]}
    # COVID default is -0.38, applied to ₹10,000 portfolio → -3,800
    assert by_code["COVID_2020"]["loss_inr"] == -3_800.0


def test_stress_test_top3_ordering(client, auth_headers):
    """Worst-3 losers are ordered most-negative-loss first."""
    holdings = [
        {"instrument_id": "i-rel",   "qty": 10, "instruments": {"symbol": "RELIANCE"}},   # COVID -40%
        {"instrument_id": "i-tcs",   "qty": 10, "instruments": {"symbol": "TCS"}},        # COVID -27%
        {"instrument_id": "i-axis",  "qty": 10, "instruments": {"symbol": "AXISBANK"}},   # COVID -60%
        {"instrument_id": "i-itc",   "qty": 10, "instruments": {"symbol": "ITC"}},        # COVID -25%
    ]
    db = _patch_db(
        portfolios=[{"id": "pf-1"}],
        holdings_by_portfolio={"pf-1": holdings},
        prices_by_iid={"i-rel": 1000, "i-tcs": 1000, "i-axis": 1000, "i-itc": 1000},
    )
    with patch("markets_worker.routers.stress_test.get_supabase", return_value=db):
        resp = client.get("/v1/retail/stress-test", headers=auth_headers)

    body = resp.json()
    covid = next(s for s in body["scenarios"] if s["code"] == "COVID_2020")
    losers = covid["top3_losers"]
    assert len(losers) == 3
    # AXISBANK (-60% × 10000) = -6000 → worst
    # RELIANCE (-40% × 10000) = -4000
    # TCS (-27% × 10000) = -2700
    assert [l["symbol"] for l in losers] == ["AXISBANK", "RELIANCE", "TCS"]


def test_scenarios_have_default_returns():
    """Every scenario must declare a __default__ — guards against typos in the seed."""
    for code, meta in SCENARIOS.items():
        assert "__default__" in meta["returns"], f"{code} missing __default__"
