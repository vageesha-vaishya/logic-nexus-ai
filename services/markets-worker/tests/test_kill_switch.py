# services/markets-worker/tests/test_kill_switch.py
"""Tests for the 4-level kill switch."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-ks-1"

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


class TestKillSwitch:
    def _mock_db(self, ks_level="none", phase="micro"):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value.execute.return_value.data = {
                "current_phase": phase, "kill_switch_level": ks_level,
                "paper_trades_done": 12, "micro_trades_done": 6,
            }
        mock_sb.schema.return_value.from_.return_value.update.return_value \
            .eq.return_value.execute.return_value.data = [{}]
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "audit-ks-1"}]
        return mock_sb

    def test_get_kill_switch_returns_current_state(self, client, auth_headers):
        mock_sb = self._mock_db(ks_level="none")
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/execution/kill-switch", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["kill_switch_level"] == "none"

    def test_activate_all_pause(self, client, auth_headers):
        mock_sb = self._mock_db()
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/kill-switch/all_pause", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["kill_switch_level"] == "all_pause"

    def test_activate_revoke_api_key_disables_broker(self, client, auth_headers):
        mock_sb = self._mock_db()
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/kill-switch/revoke_api_key", headers=auth_headers)
        assert resp.status_code == 200
        # Verify broker connections were updated (can_trade=False)
        update_calls = mock_sb.schema.return_value.from_.return_value.update.call_args_list
        broker_update = any("can_trade" in str(call) for call in update_calls)
        assert broker_update

    def test_reset_kill_switch(self, client, auth_headers):
        mock_sb = self._mock_db(ks_level="all_pause")
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/kill-switch/none", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["kill_switch_level"] == "none"

    def test_invalid_kill_switch_level_rejected(self, client, auth_headers):
        resp = client.post("/v1/execution/kill-switch/destroy_everything", headers=auth_headers)
        assert resp.status_code == 422
