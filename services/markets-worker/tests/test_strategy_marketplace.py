# services/markets-worker/tests/test_strategy_marketplace.py
"""Tests for strategy marketplace endpoints."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-strategy-1"

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


class TestStrategyMarketplace:
    def test_list_strategies(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.order.return_value.limit.return_value \
            .execute.return_value.data = [
                {"id": "s1", "name": "RSI Reversal", "rating": 4.2,
                 "asset_class": "equity", "live_users": 34, "paper_required_days": 14,
                 "backtest_summary": {}, "description": "RSI reversal strategy",
                 "creator_id": "c1", "created_at": "2026-05-18T00:00:00Z"}
            ]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/strategies", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["strategies"]) == 1
        assert resp.json()["strategies"][0]["name"] == "RSI Reversal"

    def test_list_strategies_returns_empty_when_none(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.order.return_value.limit.return_value \
            .execute.return_value.data = []
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/strategies", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["strategies"] == []

    def test_deploy_strategy_blocked_in_paper_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"current_phase": "paper"}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/strategies/s1/deploy", headers=auth_headers)
        assert resp.status_code == 400
        assert "paper" in resp.json()["detail"].lower()

    def test_deploy_strategy_succeeds_in_micro_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"current_phase": "micro"}
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{}]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/strategies/s1/deploy", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deployed"
        assert resp.json()["strategy_id"] == "s1"
        assert resp.json()["phase"] == "micro"

    def test_deploy_strategy_succeeds_in_full_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"current_phase": "full"}
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{}]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/strategies/s1/deploy", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["phase"] == "full"

    def test_deploy_defaults_to_paper_when_no_progress_row(self, client, auth_headers):
        mock_sb = MagicMock()
        # No autonomy_progress row → defaults to paper → blocked
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = None
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/strategies/s1/deploy", headers=auth_headers)
        assert resp.status_code == 400
