"""
Multi-broker holdings upsert regression test.

Pins the on_conflict key in _upsert_holdings to the new schema:
(portfolio_id, broker_connection_id, instrument_id). The legacy key
(portfolio_id, instrument_id) caused two broker connections sharing
the same portfolio + symbol to clobber each other; the partial
unique index `holdings_broker_scoped_uniq` requires the new key.

Also asserts the row body carries broker_connection_id as a top-level
column (not only inside metadata) so the unique index actually fires.
"""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock

from markets_worker.brokers.base import Holding
from markets_worker.jobs.broker_sync import _upsert_holdings


def _make_db_mock(instrument_id: str = "instr-xyz"):
    """
    Build a Supabase-client-shaped mock that:
      • returns instrument_id for any (symbol, exchange) lookup
      • records the holdings upsert call so the test can assert on it
    """
    holdings_upsert_capture: dict = {}

    instr_lookup_chain = MagicMock()
    instr_lookup_chain.execute.return_value = MagicMock(data={"id": instrument_id})

    instruments_from = MagicMock()
    instruments_from.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value = instr_lookup_chain

    holdings_from = MagicMock()
    def _capture_upsert(rows, on_conflict=None, ignore_duplicates=None):
        holdings_upsert_capture["rows"] = rows
        holdings_upsert_capture["on_conflict"] = on_conflict
        holdings_upsert_capture["ignore_duplicates"] = ignore_duplicates
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=rows)
        return chain
    holdings_from.upsert.side_effect = _capture_upsert

    def _from(table_name):
        return holdings_from if table_name == "holdings" else instruments_from

    schema_mock = MagicMock()
    schema_mock.from_.side_effect = _from

    db = MagicMock()
    db.schema.return_value = schema_mock
    return db, holdings_upsert_capture


def _holding(symbol: str = "RELIANCE", qty: float = 10.0, avg: float = 2500.0) -> Holding:
    return Holding(
        tradingsymbol=symbol,
        exchange="NSE",
        isin="INE002A01018",
        quantity=Decimal(str(qty)),
        avg_cost=Decimal(str(avg)),
        last_price=Decimal("2600"),
        pnl=Decimal("1000"),
        pnl_pct=Decimal("0.04"),
        product="CNC",
    )


def test_upsert_uses_new_multibroker_on_conflict_key():
    """on_conflict must include broker_connection_id so two connections
    don't clobber each other in the same portfolio."""
    db, captured = _make_db_mock()

    _upsert_holdings(
        db,
        [_holding()],
        portfolio_id="port-1",
        owner_id="user-A",
        tenant_id="tenant-1",
        franchise_id="franchise-1",
        connection_id="conn-zerodha",
    )

    assert captured["on_conflict"] == "portfolio_id,broker_connection_id,instrument_id", (
        f"on_conflict key drifted: {captured['on_conflict']!r}"
    )
    assert captured["ignore_duplicates"] is False


def test_upsert_writes_broker_connection_id_at_top_level():
    """The unique index lives on the top-level column, not on metadata —
    the row must carry broker_connection_id directly."""
    db, captured = _make_db_mock()

    _upsert_holdings(
        db,
        [_holding()],
        portfolio_id="port-1",
        owner_id="user-A",
        tenant_id="tenant-1",
        franchise_id="franchise-1",
        connection_id="conn-zerodha",
    )

    rows = captured["rows"]
    assert len(rows) == 1
    assert rows[0]["broker_connection_id"] == "conn-zerodha", (
        "broker_connection_id missing or wrong on the upserted row"
    )
    # And it's still also in metadata for backward-compat readers.
    assert rows[0]["metadata"]["broker_connection_id"] == "conn-zerodha"


def test_two_connections_produce_distinct_rows_same_symbol():
    """Two separate _upsert_holdings calls with different connection_ids
    must produce rows that differ in broker_connection_id (so the
    partial unique index won't conflate them)."""
    db, captured = _make_db_mock()

    _upsert_holdings(db, [_holding()],
        portfolio_id="port-shared", owner_id="u", tenant_id="t",
        franchise_id="f", connection_id="conn-zerodha")
    rows_a = list(captured["rows"])

    _upsert_holdings(db, [_holding()],
        portfolio_id="port-shared", owner_id="u", tenant_id="t",
        franchise_id="f", connection_id="conn-groww")
    rows_b = list(captured["rows"])

    assert rows_a[0]["broker_connection_id"] == "conn-zerodha"
    assert rows_b[0]["broker_connection_id"] == "conn-groww"
    # Same portfolio + symbol but different connection — the new
    # partial unique index allows this; the old one would have clobbered.
    assert rows_a[0]["portfolio_id"] == rows_b[0]["portfolio_id"]
    assert rows_a[0]["instrument_id"] == rows_b[0]["instrument_id"]
    assert rows_a[0]["broker_connection_id"] != rows_b[0]["broker_connection_id"]


def test_empty_holdings_is_a_noop():
    db, captured = _make_db_mock()
    _upsert_holdings(db, [], portfolio_id="p", owner_id="u",
                     tenant_id="t", franchise_id="f", connection_id="c")
    assert "rows" not in captured, "upsert should not be called on empty list"
