# services/markets-worker/tests/test_execution_router.py
"""Tests for execution rules CRUD and order submission."""
import time
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-exec-1"

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


class TestExecutionRulesCRUD:
    def test_create_rule(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "rule-1", "name": "My HDFC Rule"}]
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/rules", json={
                "name": "My HDFC Rule",
                "description": "Buy HDFC on strong signal",
                "asset_class": "equity",
                "signal_type": "buy",
                "order_type": "MARKET",
                "product": "CNC",
                "max_order_value": 15000,
            }, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["id"] == "rule-1"

    def test_list_rules(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.eq.return_value.order.return_value \
            .execute.return_value.data = [{"id": "rule-1", "name": "My HDFC Rule"}]
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/execution/rules", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["rules"]) == 1

    def test_create_rule_rejects_invalid_order_type(self, client, auth_headers):
        resp = client.post("/v1/execution/rules", json={
            "name": "Bad Rule",
            "description": "",
            "asset_class": "equity",
            "signal_type": "buy",
            "order_type": "INVALID",
            "product": "CNC",
            "max_order_value": 5000,
        }, headers=auth_headers)
        assert resp.status_code == 422


class TestOrderSubmission:
    def test_order_rejected_when_kill_switch_active(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "current_phase": "micro",
                "kill_switch_level": "all_pause",
                "paper_trades_done": 12,
                "micro_trades_done": 6,
            }
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/orders", json={
                "rule_id": "rule-1",
                "signal_id": "signal-1",
                "tradingsymbol": "HDFC",
                "exchange": "NSE",
                "side": "BUY",
                "quantity": 1,
                "order_value": 1700.0,
                "portfolio_nav": 100000.0,
            }, headers=auth_headers)
        assert resp.status_code == 409
        assert "kill_switch" in resp.json()["detail"]

    def test_paper_order_submitted_in_paper_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        # _get_progress returns paper phase
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "current_phase": "paper",
                "kill_switch_level": "none",
                "paper_trades_done": 3,
                "micro_trades_done": 0,
            }
        # audit log insert
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "audit-1"}]

        fresh_cache = {"HDFC:NSE": (time.time(), {"ltp": 1700.0})}
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb), \
             patch("markets_worker.routers.execution._ltp_cache", fresh_cache), \
             patch("markets_worker.routers.execution._submit_paper_order", return_value={"order_id": "paper-123"}):
            resp = client.post("/v1/execution/orders", json={
                "rule_id": "rule-1",
                "signal_id": "signal-1",
                "tradingsymbol": "HDFC",
                "exchange": "NSE",
                "side": "BUY",
                "quantity": 1,
                "order_value": 1700.0,
                "portfolio_nav": 100000.0,
            }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["phase"] == "paper"

    def test_micro_phase_cap_blocks_large_order(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "current_phase": "micro",
                "kill_switch_level": "none",
                "paper_trades_done": 12,
                "micro_trades_done": 3,
            }
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "audit-1"}]
        fresh_cache = {"HDFC:NSE": (time.time(), {"ltp": 3000.0})}
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb), \
             patch("markets_worker.routers.execution._ltp_cache", fresh_cache):
            resp = client.post("/v1/execution/orders", json={
                "rule_id": "rule-1",
                "signal_id": "signal-1",
                "tradingsymbol": "HDFC",
                "exchange": "NSE",
                "side": "BUY",
                "quantity": 1,
                "order_value": 3000.0,   # 3% of 100k NAV — exceeds 2% micro cap
                "portfolio_nav": 100000.0,
            }, headers=auth_headers)
        assert resp.status_code == 422
        assert "Micro-Live cap" in resp.json()["detail"]

    def test_fat_finger_blocks_order(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "current_phase": "micro",
                "kill_switch_level": "none",
                "paper_trades_done": 12,
                "micro_trades_done": 6,
            }
        fresh_cache = {"HDFC:NSE": (time.time(), {"ltp": 25000.0})}
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb), \
             patch("markets_worker.routers.execution._ltp_cache", fresh_cache):
            resp = client.post("/v1/execution/orders", json={
                "rule_id": "rule-1",
                "signal_id": "signal-1",
                "tradingsymbol": "HDFC",
                "exchange": "NSE",
                "side": "BUY",
                "quantity": 1,
                "order_value": 25000.0,
                "portfolio_nav": 100000.0,
            }, headers=auth_headers)
        assert resp.status_code == 422
        assert "fat_finger" in resp.json()["detail"]
