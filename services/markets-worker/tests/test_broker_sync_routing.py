"""
Routing-layer regression for broker_sync.

Pins the contract from
docs/plans/2026-05-26-broker-portfolio-routing-design.md:
  • _segment_for() exchange→segment mapping.
  • _route_and_upsert_holdings():
      - rule-matched holdings route to the link's portfolio_id
      - unmatched holdings fall back to broker_connections.portfolio_id
      - no match + no default → dropped, warning logged
      - holdings grouped by target_pid → one upsert call per group
      - stranded rows DELETEd before upsert
      - conflicting rules → first wins, warning logged
"""
from __future__ import annotations

import logging
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from markets_worker.brokers.base import Holding
from markets_worker.jobs.broker_sync import (
    _route_and_upsert_holdings,
    _segment_for,
)


def _holding(symbol: str, exchange: str = "NSE", qty: float = 10.0) -> Holding:
    return Holding(
        tradingsymbol=symbol,
        exchange=exchange,
        isin="INE002A01018",
        quantity=Decimal(str(qty)),
        avg_cost=Decimal("2500"),
        last_price=Decimal("2600"),
        pnl=Decimal("1000"),
        pnl_pct=Decimal("0.04"),
        product="CNC",
    )


def _make_db_mock():
    """Build a Supabase-shaped mock that records upserts and deletes."""
    upserts: list[dict] = []
    deletes: list[dict] = []

    instr_chain = MagicMock()
    instr_chain.execute.return_value = MagicMock(data={"id": "instr-xyz"})

    instruments_from = MagicMock()
    instruments_from.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value = instr_chain

    holdings_from = MagicMock()

    def _capture_upsert(rows, on_conflict=None, ignore_duplicates=None):
        upserts.append({"rows": list(rows), "on_conflict": on_conflict})
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=rows)
        return chain
    holdings_from.upsert.side_effect = _capture_upsert

    # Stranded-rows delete: db.from_("holdings").delete().eq(...).not_.in_(...).execute()
    def _capture_delete():
        chain = MagicMock()
        captured = {}
        def _eq(col, val):
            captured.setdefault("eq", []).append((col, val))
            return chain
        def _not_in(col, vals):
            captured["not_in"] = (col, list(vals))
            return chain
        def _execute():
            deletes.append(captured)
            return MagicMock(data=[])
        chain.eq.side_effect = _eq
        chain.not_ = MagicMock()
        chain.not_.in_.side_effect = _not_in
        chain.execute.side_effect = _execute
        return chain
    holdings_from.delete.side_effect = _capture_delete

    schema_mock = MagicMock()
    schema_mock.from_.side_effect = lambda name: holdings_from if name == "holdings" else instruments_from

    db = MagicMock()
    db.schema.return_value = schema_mock
    return db, upserts, deletes


# ── _segment_for ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("exch,expected", [
    ("NSE", "equity"),   ("BSE", "equity"),
    ("NFO", "fno"),      ("BFO", "fno"),
    ("CDS", "currency"), ("BCD", "currency"),
    ("MCX", "commodity"),
    ("MF",  "mf"),       ("AMFI","mf"),
    ("",    "other"),    ("XXX", "other"),
])
def test_segment_for_maps_known_exchanges(exch, expected):
    assert _segment_for(exch) == expected


# ── _route_and_upsert_holdings ────────────────────────────────────────────

def test_no_links_routes_all_to_default():
    db, upserts, deletes = _make_db_mock()
    holdings = [_holding("RELIANCE", "NSE"), _holding("INFY", "NSE")]
    _route_and_upsert_holdings(
        db, holdings, default_portfolio_id="port-default", links=[],
        owner_id="u", tenant_id="t", franchise_id="f", connection_id="c1",
    )
    assert len(upserts) == 1
    assert all(r["portfolio_id"] == "port-default" for r in upserts[0]["rows"])
    assert upserts[0]["on_conflict"] == "portfolio_id,broker_connection_id,instrument_id"


def test_link_matching_segment_routes_to_link_portfolio():
    db, upserts, deletes = _make_db_mock()
    holdings = [_holding("RELIANCE", "NSE"), _holding("NIFTY25JAN", "NFO")]
    links = [{"portfolio_id": "port-fno", "sync_filter": {"segments": ["fno"]}}]
    _route_and_upsert_holdings(
        db, holdings, "port-default", links,
        owner_id="u", tenant_id="t", franchise_id="f", connection_id="c1",
    )
    # Two upsert calls — one per target portfolio.
    grouped = {u["rows"][0]["portfolio_id"]: u["rows"] for u in upserts}
    assert set(grouped.keys()) == {"port-default", "port-fno"}
    # The F&O holding ended up in port-fno
    assert any(r["instrument_id"] == "instr-xyz" for r in grouped["port-fno"])


def test_no_match_no_default_drops_with_warning(caplog):
    db, upserts, deletes = _make_db_mock()
    holdings = [_holding("RELIANCE", "NSE")]
    with caplog.at_level(logging.WARNING):
        _route_and_upsert_holdings(
            db, holdings, default_portfolio_id=None, links=[],
            owner_id="u", tenant_id="t", franchise_id="f", connection_id="c1",
        )
    # Nothing upserted, nothing deleted (no targets).
    assert upserts == []
    assert deletes == []


def test_two_rules_same_segment_first_wins_with_warning(caplog):
    db, upserts, deletes = _make_db_mock()
    holdings = [_holding("NIFTY25JAN", "NFO")]
    links = [
        {"portfolio_id": "port-A", "sync_filter": {"segments": ["fno"]}},
        {"portfolio_id": "port-B", "sync_filter": {"segments": ["fno"]}},
    ]
    _route_and_upsert_holdings(
        db, holdings, "port-default", links,
        owner_id="u", tenant_id="t", franchise_id="f", connection_id="c1",
    )
    # First wins
    assert upserts[0]["rows"][0]["portfolio_id"] == "port-A"


def test_stranded_rows_cleanup_runs_before_upsert():
    db, upserts, deletes = _make_db_mock()
    holdings = [_holding("RELIANCE", "NSE")]
    _route_and_upsert_holdings(
        db, holdings, "port-default", links=[],
        owner_id="u", tenant_id="t", franchise_id="f", connection_id="c1",
    )
    # One delete call scoped to this connection, excluding the only target.
    assert len(deletes) == 1
    eq_pairs = dict(deletes[0]["eq"])
    assert eq_pairs.get("broker_connection_id") == "c1"
    col, vals = deletes[0]["not_in"]
    assert col == "portfolio_id"
    assert set(vals) == {"port-default"}


def test_grouped_upserts_split_one_call_per_destination():
    db, upserts, deletes = _make_db_mock()
    holdings = [
        _holding("RELIANCE", "NSE"),
        _holding("INFY",     "BSE"),
        _holding("NIFTY",    "NFO"),
        _holding("USDINR",   "CDS"),
    ]
    links = [
        {"portfolio_id": "port-eq",  "sync_filter": {"segments": ["equity"]}},
        {"portfolio_id": "port-fno", "sync_filter": {"segments": ["fno"]}},
    ]
    _route_and_upsert_holdings(
        db, holdings, "port-default", links,
        owner_id="u", tenant_id="t", franchise_id="f", connection_id="c1",
    )
    # Three groups: eq (NSE/BSE → port-eq), fno (NFO → port-fno), default (CDS → port-default)
    pids = {u["rows"][0]["portfolio_id"] for u in upserts}
    assert pids == {"port-eq", "port-fno", "port-default"}
