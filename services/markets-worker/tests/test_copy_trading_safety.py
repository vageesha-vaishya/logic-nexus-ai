"""Tests for extended copy trading safety limits."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-copy-safety-1"

@pytest.fixture
def app():
    from markets_worker.main import create_app
    from markets_worker.auth import get_auth, AuthContext
    application = create_app()
    application.dependency_overrides[get_auth] = lambda: AuthContext(user_id=MOCK_USER_ID)
    return application

@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer mock-token"}


class TestCopyTradingSafetyLimits:
    def test_set_safety_limits_for_copy_relationship(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"copy_trade_id": "ct-1", "budget_cap": 5000.0}]
        with patch("markets_worker.routers.copy_trading_safety.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/copy-trades/safety/ct-1", json={
                "budget_cap": 5000.0,
                "max_drawdown_pct": 15.0,
            }, headers=auth_headers)
        assert resp.status_code == 201

    def test_get_safety_limits(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "copy_trade_id": "ct-1",
                "budget_cap": 5000.0,
                "max_drawdown_pct": 15.0,
                "auto_unfollowed_at": None,
            }
        with patch("markets_worker.routers.copy_trading_safety.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/copy-trades/safety/ct-1", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["budget_cap"] == 5000.0

    def test_tier_must_be_experimental(self, client, auth_headers):
        resp = client.post("/v1/copy-trades/safety/ct-1", json={
            "budget_cap": 5000.0,
            "target_tier_number": 2,
        }, headers=auth_headers)
        assert resp.status_code == 422
        assert "experimental" in resp.json()["detail"].lower()
