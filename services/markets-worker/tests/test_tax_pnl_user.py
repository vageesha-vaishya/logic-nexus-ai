"""User-level LTCG endpoint tests — /v1/tax/user/pnl?fy=YYYY-YY.

Verifies that the new aggregate endpoint correctly sums realized capital
gains across all of auth.user_id's portfolios, applies the ₹1.25 L LTCG
exemption at the user level (not per-portfolio), and respects the Indian
FY window (Apr 1 – Mar 31).
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch


def _mk_response(data) -> MagicMock:
    return MagicMock(data=data)


def _txn(
    *,
    txn_type: str,
    txn_date: str,
    qty: float,
    price: float,
    symbol: str = "RELIANCE",
    asset_class: str = "equity",
    charges: float = 0.0,
    instrument_id: str = "i1",
) -> dict:
    """Build a transaction row in the shape the tax_pnl SELECT returns."""
    return {
        "id":            f"t-{txn_type}-{txn_date}",
        "instrument_id": instrument_id,
        "txn_type":      txn_type,
        "txn_date":      txn_date,
        "qty":           qty,
        "price":         price,
        "charges":       charges,
        "asset_class":   asset_class,
        "instruments":   {"symbol": symbol},
    }


def _patch_db(portfolios_by_user: list[dict], txns_by_portfolio: dict[str, list[dict]]):
    """
    Return a context-manager-shaped MagicMock that wires the two queries
    tax_pnl.user/pnl makes:
      1. portfolios.select.eq("owner_user_id", X).execute() -> portfolio rows
      2. transactions.select.eq("portfolio_id", pid).order.execute() -> txn rows
    """
    portfolios_resp = _mk_response(portfolios_by_user)

    portfolios_query = MagicMock()
    portfolios_query.select.return_value.eq.return_value.execute.return_value = portfolios_resp

    def _txn_query_for(pid_query):
        # Returns the chain leading to .execute() for one portfolio_id
        chain = MagicMock()
        eq_chain = MagicMock()
        chain.select.return_value = eq_chain
        eq_chain.eq.side_effect = lambda col, val: (
            MagicMock(order=MagicMock(return_value=MagicMock(
                execute=MagicMock(return_value=_mk_response(
                    txns_by_portfolio.get(val, []),
                )),
            ))) if col == "portfolio_id" else None
        )
        return chain

    transactions_query = _txn_query_for(None)

    def _from(table_name: str):
        if table_name == "portfolios":
            return portfolios_query
        if table_name == "transactions":
            return transactions_query
        raise AssertionError(f"unexpected table: {table_name}")

    mock_client = MagicMock()
    mock_client.schema.return_value.from_.side_effect = _from
    return mock_client


def test_user_pnl_returns_zero_when_no_portfolios(client, auth_headers):
    """User has no portfolios → empty summary, no exemption used."""
    db = _patch_db(portfolios_by_user=[], txns_by_portfolio={})
    with patch("markets_worker.routers.tax_pnl.get_supabase", return_value=db):
        resp = client.get("/v1/tax/user/pnl?fy=2024-25", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["portfolio_count"] == 0
    assert body["summary"]["equity_ltcg"] == 0.0
    assert body["summary"]["equity_ltcg_remaining"] == 125_000.0
    assert body["realized_trades"] == []


def test_user_pnl_sums_ltcg_below_exemption(client, auth_headers):
    """
    One portfolio, one LTCG realization of ₹50k → equity_ltcg=50000,
    remaining=75000, taxable=0, no tax owed.
    """
    txns = [
        _txn(txn_type="BUY",  txn_date="2023-01-15", qty=10, price=1000),  # ₹10k cost
        _txn(txn_type="SELL", txn_date="2024-08-20", qty=10, price=6000),  # gain = (6000-1000)*10 = 50000
    ]
    db = _patch_db(
        portfolios_by_user=[{"id": "pf-1"}],
        txns_by_portfolio={"pf-1": txns},
    )
    with patch("markets_worker.routers.tax_pnl.get_supabase", return_value=db):
        resp = client.get("/v1/tax/user/pnl?fy=2024-25", headers=auth_headers)

    assert resp.status_code == 200
    summary = resp.json()["summary"]
    assert summary["equity_ltcg"] == 50_000.0
    assert summary["equity_ltcg_taxable"] == 0.0
    assert summary["equity_ltcg_remaining"] == 75_000.0
    assert summary["equity_ltcg_tax_est"] == 0.0


def test_user_pnl_aggregates_two_portfolios_past_exemption(client, auth_headers):
    """
    Two portfolios each with ₹80k LTCG → equity_ltcg=160000, taxable=35000,
    remaining=0, tax_est = 35000 * 0.125 = 4375. Verifies the exemption is
    applied at the user level, not per-portfolio.
    """
    pf1_txns = [
        _txn(txn_type="BUY",  txn_date="2023-02-01", qty=10, price=1000, symbol="RELIANCE", instrument_id="i-rel"),
        _txn(txn_type="SELL", txn_date="2024-06-01", qty=10, price=9000, symbol="RELIANCE", instrument_id="i-rel"),
    ]
    pf2_txns = [
        _txn(txn_type="BUY",  txn_date="2023-02-01", qty=10, price=1000, symbol="TCS",      instrument_id="i-tcs"),
        _txn(txn_type="SELL", txn_date="2024-06-01", qty=10, price=9000, symbol="TCS",      instrument_id="i-tcs"),
    ]
    db = _patch_db(
        portfolios_by_user=[{"id": "pf-1"}, {"id": "pf-2"}],
        txns_by_portfolio={"pf-1": pf1_txns, "pf-2": pf2_txns},
    )
    with patch("markets_worker.routers.tax_pnl.get_supabase", return_value=db):
        resp = client.get("/v1/tax/user/pnl?fy=2024-25", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    summary = body["summary"]
    assert body["portfolio_count"] == 2
    assert summary["equity_ltcg"] == 160_000.0
    assert summary["equity_ltcg_taxable"] == 35_000.0
    assert summary["equity_ltcg_remaining"] == 0.0
    assert summary["equity_ltcg_tax_est"] == 4_375.0  # 35000 * 0.125
    # Each realized trade is tagged with its portfolio.
    portfolio_ids = {t["portfolio_id"] for t in body["realized_trades"]}
    assert portfolio_ids == {"pf-1", "pf-2"}


def test_user_pnl_respects_fy_boundary(client, auth_headers):
    """
    Sell on 2024-03-31 belongs to FY 2023-24; sell on 2024-04-01 belongs to
    FY 2024-25. Asking for 2024-25 must include only the latter.
    """
    txns = [
        _txn(txn_type="BUY",  txn_date="2022-01-01", qty=20, price=1000, instrument_id="i-rel"),
        _txn(txn_type="SELL", txn_date="2024-03-31", qty=10, price=5000, instrument_id="i-rel"),  # FY 2023-24
        _txn(txn_type="SELL", txn_date="2024-04-01", qty=10, price=5000, instrument_id="i-rel"),  # FY 2024-25
    ]
    db = _patch_db(
        portfolios_by_user=[{"id": "pf-1"}],
        txns_by_portfolio={"pf-1": txns},
    )
    with patch("markets_worker.routers.tax_pnl.get_supabase", return_value=db):
        resp_a = client.get("/v1/tax/user/pnl?fy=2023-24", headers=auth_headers)
        resp_b = client.get("/v1/tax/user/pnl?fy=2024-25", headers=auth_headers)

    assert resp_a.status_code == 200
    assert resp_b.status_code == 200
    # Each FY should see exactly one realized trade of gain = (5000-1000)*10 = 40000
    assert resp_a.json()["summary"]["equity_ltcg"] == 40_000.0
    assert resp_b.json()["summary"]["equity_ltcg"] == 40_000.0
    assert len(resp_a.json()["realized_trades"]) == 1
    assert len(resp_b.json()["realized_trades"]) == 1


def test_user_pnl_rejects_invalid_fy(client, auth_headers):
    db = _patch_db(portfolios_by_user=[{"id": "pf-1"}], txns_by_portfolio={"pf-1": []})
    with patch("markets_worker.routers.tax_pnl.get_supabase", return_value=db):
        resp = client.get("/v1/tax/user/pnl?fy=bogus", headers=auth_headers)
    assert resp.status_code == 400
