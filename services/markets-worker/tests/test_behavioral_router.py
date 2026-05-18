"""Tests for the retail behavioral support router."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

MOCK_USER_ID = "user-test-1"

@pytest.fixture
def app():
    from markets_worker.main import create_app
    from markets_worker.auth import get_auth, AuthContext
    application = create_app()
    application.dependency_overrides[get_auth] = lambda: AuthContext(user_id=MOCK_USER_ID)
    return application

@pytest.fixture
def client(app):
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer mock-token"}

class TestMarketStress:
    def test_returns_stress_metrics(self, client, auth_headers):
        mock_cache = {
            "NIFTY 50:NSE": (1_000_000.0, {"ltp": 21800.0, "prev_price": 22000.0}),
            "INDIA VIX:NSE": (1_000_000.0, {"ltp": 18.5, "prev_price": 14.0}),
        }
        with patch("markets_worker.routers.behavioral._ltp_cache", mock_cache):
            resp = client.get("/v1/retail/behavioral/market-stress", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "nifty_change_pct" in data
        assert "vix_current" in data
        assert "stress_level" in data
        assert data["nifty_change_pct"] < 0  # Nifty down from 22000 to 21800

    def test_high_stress_when_nifty_down_over_2pct(self, client, auth_headers):
        mock_cache = {
            "NIFTY 50:NSE": (1_000_000.0, {"ltp": 21500.0, "prev_price": 22000.0}),
            "INDIA VIX:NSE": (1_000_000.0, {"ltp": 15.0, "prev_price": 14.0}),
        }
        with patch("markets_worker.routers.behavioral._ltp_cache", mock_cache):
            resp = client.get("/v1/retail/behavioral/market-stress", headers=auth_headers)
        assert resp.json()["stress_level"] == "high"

    def test_low_stress_when_market_up(self, client, auth_headers):
        mock_cache = {
            "NIFTY 50:NSE": (1_000_000.0, {"ltp": 22200.0, "prev_price": 22000.0}),
            "INDIA VIX:NSE": (1_000_000.0, {"ltp": 12.0, "prev_price": 13.0}),
        }
        with patch("markets_worker.routers.behavioral._ltp_cache", mock_cache):
            resp = client.get("/v1/retail/behavioral/market-stress", headers=auth_headers)
        assert resp.json()["stress_level"] == "low"

class TestLogBehavioralEvent:
    def test_logs_valid_event(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value = MagicMock(data={"id": "ev1"}, error=None)
        with patch("markets_worker.routers.behavioral.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/v1/retail/behavioral/events",
                headers=auth_headers,
                json={"event_type": "yellow_alert", "severity": "warning",
                      "metadata": {"drawdown_pct": 7.2}},
            )
        assert resp.status_code == 201

    def test_rejects_invalid_event_type(self, client, auth_headers):
        resp = client.post(
            "/v1/retail/behavioral/events",
            headers=auth_headers,
            json={"event_type": "invalid_type", "severity": "info", "metadata": {}},
        )
        assert resp.status_code == 422

class TestListBehavioralEvents:
    def test_returns_empty_list_when_no_events(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.is_.return_value.order.return_value \
            .limit.return_value.execute.return_value = MagicMock(data=[], error=None)
        with patch("markets_worker.routers.behavioral.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/retail/behavioral/events", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

class TestAcknowledgeEvent:
    def test_acknowledges_event(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.update.return_value \
            .eq.return_value.eq.return_value.execute.return_value = \
            MagicMock(data={"id": "ev1"}, error=None)
        with patch("markets_worker.routers.behavioral.get_supabase", return_value=mock_sb):
            resp = client.patch(
                "/v1/retail/behavioral/events/ev1/acknowledge",
                headers=auth_headers,
            )
        assert resp.status_code == 200
