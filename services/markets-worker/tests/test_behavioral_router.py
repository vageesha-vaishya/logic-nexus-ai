"""Behavioral router contract tests — /v1/retail/behavioral/*."""
from __future__ import annotations

import time
from unittest.mock import MagicMock, patch


def _mk_response(data, error=None) -> MagicMock:
    return MagicMock(data=data, error=error)


# ── Market stress ────────────────────────────────────────────────────────────

def test_market_stress_high_when_nifty_falls(client, auth_headers):
    """Nifty −2.5% intraday + VIX spike → high stress."""
    now = time.monotonic()
    fake_cache = {
        "NIFTY 50:NSE":  (now, {"ltp": 21450.0, "prev_price": 22000.0}),  # −2.5%
        "INDIA VIX:NSE": (now, {"ltp": 19.0,    "prev_price": 14.0}),     # +35%
    }
    with patch("markets_worker.routers.behavioral._ltp_cache", fake_cache):
        resp = client.get("/v1/retail/behavioral/market-stress", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["stress_level"] == "high"
    assert data["nifty_change_pct"] <= -2.0


def test_market_stress_low_when_market_up(client, auth_headers):
    """Nifty +1% intraday + VIX below baseline → low stress."""
    now = time.monotonic()
    fake_cache = {
        "NIFTY 50:NSE":  (now, {"ltp": 22200.0, "prev_price": 22000.0}),  # +0.9%
        "INDIA VIX:NSE": (now, {"ltp": 12.0,    "prev_price": 13.0}),     # below 20, no spike
    }
    with patch("markets_worker.routers.behavioral._ltp_cache", fake_cache):
        resp = client.get("/v1/retail/behavioral/market-stress", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["stress_level"] == "low"


def test_market_stress_ignores_stale_cache_entries(client, auth_headers):
    """Cache entries older than 60s are treated as missing → low stress, zero metrics."""
    stale = time.monotonic() - 300
    fake_cache = {
        "NIFTY 50:NSE":  (stale, {"ltp": 21000.0, "prev_price": 22000.0}),
        "INDIA VIX:NSE": (stale, {"ltp": 30.0,    "prev_price": 14.0}),
    }
    with patch("markets_worker.routers.behavioral._ltp_cache", fake_cache):
        resp = client.get("/v1/retail/behavioral/market-stress", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["stress_level"] == "low"
    assert body["nifty_change_pct"] == 0
    assert body["vix_current"] == 0


# ── Behavioral event log ─────────────────────────────────────────────────────

def test_log_yellow_alert(client, auth_headers, mock_user_id):
    sb = MagicMock()
    insert_call = MagicMock()
    insert_call.execute.return_value = _mk_response([{"id": "ev1"}])
    sb.schema().from_().insert.return_value = insert_call

    with patch("markets_worker.routers.behavioral.get_supabase", return_value=sb):
        resp = client.post(
            "/v1/retail/behavioral/events",
            headers=auth_headers,
            json={
                "event_type": "yellow_alert",
                "severity":   "warning",
                "metadata":   {"drawdown_pct": 7.2, "portfolio_id": "p1"},
            },
        )

    assert resp.status_code == 201
    payload, _ = sb.schema().from_().insert.call_args
    assert payload[0]["user_id"] == mock_user_id
    assert payload[0]["event_type"] == "yellow_alert"


def test_log_event_rejects_invalid_type(client, auth_headers):
    resp = client.post(
        "/v1/retail/behavioral/events",
        headers=auth_headers,
        json={"event_type": "unknown_type", "severity": "info", "metadata": {}},
    )
    assert resp.status_code == 422


def test_log_event_rejects_invalid_severity(client, auth_headers):
    resp = client.post(
        "/v1/retail/behavioral/events",
        headers=auth_headers,
        json={"event_type": "yellow_alert", "severity": "panic", "metadata": {}},
    )
    assert resp.status_code == 422


# ── Acknowledge ──────────────────────────────────────────────────────────────

def test_acknowledge_event_scoped_to_user(client, auth_headers, mock_user_id):
    sb = MagicMock()
    update_call = MagicMock()
    eq_user     = MagicMock()
    eq_user.execute.return_value = _mk_response([{"id": "ev1"}])
    eq_id       = MagicMock()
    eq_id.eq.return_value = eq_user
    update_call.eq.return_value = eq_id
    sb.schema().from_().update.return_value = update_call

    with patch("markets_worker.routers.behavioral.get_supabase", return_value=sb):
        resp = client.patch(
            "/v1/retail/behavioral/events/ev1/acknowledge",
            headers=auth_headers,
        )

    assert resp.status_code == 200
    # First .eq is on id, second is on user_id — both must be applied
    eq_id.eq.assert_called_with("user_id", mock_user_id)
    update_call.eq.assert_called_with("id", "ev1")


# ── List recent ──────────────────────────────────────────────────────────────

def test_get_recent_events_returns_unacked_only(client, auth_headers, mock_user_id):
    sb = MagicMock()
    builder = MagicMock()
    builder.execute.return_value = _mk_response([{"id": "ev1", "event_type": "yellow_alert"}])
    builder.eq.return_value = builder
    builder.is_.return_value = builder
    builder.order.return_value = builder
    builder.limit.return_value = builder
    sb.schema().from_().select.return_value = builder

    with patch("markets_worker.routers.behavioral.get_supabase", return_value=sb):
        resp = client.get("/v1/retail/behavioral/events", headers=auth_headers)

    assert resp.status_code == 200
    builder.eq.assert_any_call("user_id", mock_user_id)
    builder.is_.assert_called_with("acknowledged_at", "null")
    assert len(resp.json()) == 1
