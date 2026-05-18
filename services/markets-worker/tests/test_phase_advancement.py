# services/markets-worker/tests/test_phase_advancement.py
"""Tests for autonomy phase advancement (Paper → Micro → Pilot → Full)."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-phase-1"

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


class TestPhaseAdvancement:
    def _mock_db(self, phase, paper_trades, micro_trades=0):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value.execute.return_value.data = {
                "current_phase": phase,
                "kill_switch_level": "none",
                "paper_trades_done": paper_trades,
                "micro_trades_done": micro_trades,
            }
        mock_sb.schema.return_value.from_.return_value.update.return_value \
            .eq.return_value.execute.return_value.data = [{}]
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "audit-1"}]
        return mock_sb

    def test_advance_paper_to_micro_when_eligible(self, client, auth_headers):
        mock_sb = self._mock_db("paper", paper_trades=10)
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/advance-phase", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["new_phase"] == "micro"

    def test_cannot_advance_paper_without_enough_trades(self, client, auth_headers):
        mock_sb = self._mock_db("paper", paper_trades=5)
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/advance-phase", headers=auth_headers)
        assert resp.status_code == 400
        assert "10 paper trades" in resp.json()["detail"]

    def test_advance_micro_to_pilot(self, client, auth_headers):
        mock_sb = self._mock_db("micro", paper_trades=10, micro_trades=5)
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/advance-phase", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["new_phase"] == "pilot"

    def test_full_phase_cannot_advance_further(self, client, auth_headers):
        mock_sb = self._mock_db("full", paper_trades=20, micro_trades=10)
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/advance-phase", headers=auth_headers)
        assert resp.status_code == 400
        assert "already at full" in resp.json()["detail"].lower()
