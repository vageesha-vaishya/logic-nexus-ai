"""Holdings-news endpoint tests — /v1/retail/holdings-news."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch


def _mk(data) -> MagicMock:
    return MagicMock(data=data)


def _patch_db(
    *,
    portfolios: list[dict],
    holdings_by_portfolio: dict[str, list[dict]],
    prices_by_iid: dict[str, float | None],
    news_rows: list[dict],
):
    """
    Wires four query paths:
      portfolios (top-3 calc),
      holdings (per pid),
      price_history (per instrument_id),
      news_events.
    """
    portfolios_query = MagicMock()
    portfolios_query.select.return_value.eq.return_value.execute.return_value = _mk(portfolios)

    holdings_query = MagicMock()
    def _holdings_eq(col, val):
        chain = MagicMock()
        chain.gt.return_value.execute.return_value = _mk(holdings_by_portfolio.get(val, []))
        return chain
    holdings_query.select.return_value.eq.side_effect = _holdings_eq

    price_query = MagicMock()
    def _price_eq(col, val):
        chain = MagicMock()
        chain.order.return_value.limit.return_value.maybe_single.return_value.execute.return_value = (
            _mk({"close": prices_by_iid.get(val)} if prices_by_iid.get(val) is not None else None)
        )
        return chain
    price_query.select.return_value.eq.side_effect = _price_eq

    news_query = MagicMock()
    news_query.select.return_value.gte.return_value.overlaps.return_value.order.return_value.limit.return_value.execute.return_value = _mk(news_rows)

    def _from(table):
        return {
            "portfolios":    portfolios_query,
            "holdings":      holdings_query,
            "price_history": price_query,
            "news_events":   news_query,
        }[table]

    mock_client = MagicMock()
    mock_client.schema.return_value.from_.side_effect = _from
    return mock_client


def _news_row(symbol: str, *, hours_ago: float = 1.0, title: str = "Headline") -> dict:
    return {
        "id":              f"n-{symbol}-{hours_ago}",
        "ts":              (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat(),
        "source":          "test-wire",
        "title":           title,
        "sentiment_score": 0.0,
        "raw_url":         f"https://example.test/{symbol}",
        "instruments":     [symbol],
    }


def test_holdings_news_empty_when_no_portfolios(client, auth_headers):
    db = _patch_db(
        portfolios=[],
        holdings_by_portfolio={},
        prices_by_iid={},
        news_rows=[],
    )
    with patch("markets_worker.routers.holdings_news.get_supabase", return_value=db):
        resp = client.get("/v1/retail/holdings-news", headers=auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["holdings"] == []
    assert body["lookback_hours"] == 24


def test_holdings_news_returns_headlines_for_top_holding(client, auth_headers):
    holdings = [
        {"instrument_id": "i-rel", "qty": 100, "instruments": {"symbol": "RELIANCE"}},
    ]
    db = _patch_db(
        portfolios=[{"id": "pf-1"}],
        holdings_by_portfolio={"pf-1": holdings},
        prices_by_iid={"i-rel": 2500.0},
        news_rows=[
            _news_row("RELIANCE", hours_ago=2, title="Reliance quarterly results"),
            _news_row("RELIANCE", hours_ago=12, title="Reliance launches new venture"),
        ],
    )
    with patch("markets_worker.routers.holdings_news.get_supabase", return_value=db):
        resp = client.get("/v1/retail/holdings-news", headers=auth_headers)

    body = resp.json()
    assert len(body["holdings"]) == 1
    h = body["holdings"][0]
    assert h["symbol"] == "RELIANCE"
    assert h["value"] == 250_000.0
    assert len(h["news"]) == 2
    assert h["news"][0]["title"] == "Reliance quarterly results"


def test_holdings_news_caps_at_5_per_symbol(client, auth_headers):
    holdings = [{"instrument_id": "i-rel", "qty": 100, "instruments": {"symbol": "RELIANCE"}}]
    # 7 RELIANCE-tagged news rows — endpoint should truncate to 5
    news_rows = [_news_row("RELIANCE", hours_ago=i + 1, title=f"Story {i}") for i in range(7)]
    db = _patch_db(
        portfolios=[{"id": "pf-1"}],
        holdings_by_portfolio={"pf-1": holdings},
        prices_by_iid={"i-rel": 1000.0},
        news_rows=news_rows,
    )
    with patch("markets_worker.routers.holdings_news.get_supabase", return_value=db):
        resp = client.get("/v1/retail/holdings-news", headers=auth_headers)

    assert len(resp.json()["holdings"][0]["news"]) == 5


def test_holdings_news_ranks_top3_by_value(client, auth_headers):
    """Top-3 holdings ranked by market value, lowest-value position dropped if >3."""
    pf1 = [
        {"instrument_id": "i-a", "qty": 10, "instruments": {"symbol": "AAA"}},   # value 100*10=1000
        {"instrument_id": "i-b", "qty": 10, "instruments": {"symbol": "BBB"}},   # value 200*10=2000
        {"instrument_id": "i-c", "qty": 10, "instruments": {"symbol": "CCC"}},   # value 300*10=3000
        {"instrument_id": "i-d", "qty": 10, "instruments": {"symbol": "DDD"}},   # value 400*10=4000  (top)
    ]
    db = _patch_db(
        portfolios=[{"id": "pf-1"}],
        holdings_by_portfolio={"pf-1": pf1},
        prices_by_iid={"i-a": 100, "i-b": 200, "i-c": 300, "i-d": 400},
        news_rows=[],
    )
    with patch("markets_worker.routers.holdings_news.get_supabase", return_value=db):
        resp = client.get("/v1/retail/holdings-news", headers=auth_headers)

    syms = [h["symbol"] for h in resp.json()["holdings"]]
    assert syms == ["DDD", "CCC", "BBB"]  # AAA dropped (lowest value)


def test_holdings_news_filters_unrelated_symbols_client_side(client, auth_headers):
    """News rows tagged with other symbols should be bucketed only to matching holdings."""
    holdings = [{"instrument_id": "i-rel", "qty": 1, "instruments": {"symbol": "RELIANCE"}}]
    # Postgrest `overlaps` already filters server-side; this verifies that the
    # endpoint doesn't get confused if a row's instruments array is
    # multi-tagged (e.g. ["RELIANCE","NIFTY"]).
    news_rows = [
        {
            "id":              "n1",
            "ts":              datetime.now(timezone.utc).isoformat(),
            "source":          "wire",
            "title":           "Reliance + Nifty story",
            "sentiment_score": 0.0,
            "raw_url":         "https://example.test/x",
            "instruments":     ["RELIANCE", "NIFTY"],
        },
        {
            "id":              "n2",
            "ts":              datetime.now(timezone.utc).isoformat(),
            "source":          "wire",
            "title":           "TCS-only story (should be filtered out)",
            "sentiment_score": 0.0,
            "raw_url":         "https://example.test/y",
            "instruments":     ["TCS"],
        },
    ]
    db = _patch_db(
        portfolios=[{"id": "pf-1"}],
        holdings_by_portfolio={"pf-1": holdings},
        prices_by_iid={"i-rel": 1000.0},
        news_rows=news_rows,
    )
    with patch("markets_worker.routers.holdings_news.get_supabase", return_value=db):
        resp = client.get("/v1/retail/holdings-news", headers=auth_headers)

    body = resp.json()
    reliance_titles = [n["title"] for n in body["holdings"][0]["news"]]
    assert "Reliance + Nifty story" in reliance_titles
    assert "TCS-only story (should be filtered out)" not in reliance_titles
