"""Tests for community baskets and creator-status endpoints."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-community-1"

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


class TestCreatorStatus:
    def test_returns_not_verified_by_default(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"verified_creator": False}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/creator-status", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["is_verified"] is False

    def test_returns_verified_for_verified_user(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"verified_creator": True}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/creator-status", headers=auth_headers)
        assert resp.json()["is_verified"] is True


class TestBaskets:
    def test_list_published_baskets(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.order.return_value.limit.return_value \
            .execute.return_value.data = [
                {"id": "b1", "name": "EV Revolution", "theme": "Tech", "risk_level": "high"}
            ]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/baskets", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["baskets"]) == 1

    def test_create_basket_requires_verified_creator(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"verified_creator": False}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/baskets", json={
                "name": "Test Basket",
                "theme": "Tech",
                "description": "A test basket",
                "risk_level": "medium",
                "rebalance_freq": "quarterly",
            }, headers=auth_headers)
        assert resp.status_code == 403
        assert "verified" in resp.json()["detail"].lower()

    def test_create_basket_succeeds_for_verified_creator(self, client, auth_headers):
        mock_sb = MagicMock()
        # First call (select for verified check) returns verified=True
        # Second call (insert) returns new basket
        select_mock = MagicMock()
        select_mock.eq.return_value.maybe_single.return_value.execute.return_value.data = {"verified_creator": True}
        insert_mock = MagicMock()
        insert_mock.execute.return_value.data = [{"id": "b2", "name": "Test Basket"}]
        mock_sb.schema.return_value.from_.return_value.select.return_value = select_mock
        mock_sb.schema.return_value.from_.return_value.insert.return_value = insert_mock
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/baskets", json={
                "name": "Test Basket",
                "theme": "Tech",
                "description": "A test basket",
                "risk_level": "medium",
                "rebalance_freq": "quarterly",
            }, headers=auth_headers)
        assert resp.status_code == 201

    def test_get_basket_holdings(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.execute.return_value.data = [
                {"id": "h1", "basket_id": "b1", "weight_pct": 50.0,
                 "instrument": {"symbol": "HDFC", "exchange": "NSE"}}
            ]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/baskets/b1/holdings", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["holdings"]) == 1


class TestInvest:
    def test_invest_in_basket_returns_confirmed(self, client, auth_headers):
        mock_sb = MagicMock()
        # Position lookup (None = new position)
        pos_select = MagicMock()
        pos_select.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None
        # Basket total_invested lookup
        basket_select = MagicMock()
        basket_select.eq.return_value.maybe_single.return_value.execute.return_value.data = {"total_invested": 10000.0}
        mock_sb.schema.return_value.from_.return_value.select.side_effect = [pos_select, basket_select]
        mock_sb.schema.return_value.from_.return_value.insert.return_value.execute.return_value.data = [{}]
        mock_sb.schema.return_value.from_.return_value.update.return_value.eq.return_value.execute.return_value.data = [{}]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/baskets/b1/invest", json={"amount": 5000.0}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "confirmed"

    def test_invest_rejects_zero_amount(self, client, auth_headers):
        mock_sb = MagicMock()
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/baskets/b1/invest", json={"amount": 0}, headers=auth_headers)
        assert resp.status_code == 422


class TestStrategiesDeploy:
    def test_deploy_blocked_in_paper_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value.execute.return_value.data = {"current_phase": "paper"}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/strategies/s1/deploy", headers=auth_headers)
        assert resp.status_code == 400
        assert "paper" in resp.json()["detail"].lower()

    def test_deploy_succeeds_in_micro_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value.execute.return_value.data = {"current_phase": "micro"}
        mock_sb.schema.return_value.from_.return_value.insert.return_value.execute.return_value.data = [{}]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/strategies/s1/deploy", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deployed"
