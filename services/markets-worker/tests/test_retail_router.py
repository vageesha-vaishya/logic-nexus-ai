"""Tests for the retail investment profile router."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


MOCK_USER_ID = "user-test-1"


def _make_auth_ctx():
    """Return a mock AuthContext with user_id = MOCK_USER_ID."""
    from markets_worker.auth import AuthContext
    return AuthContext(user_id=MOCK_USER_ID)


@pytest.fixture
def app():
    from markets_worker.main import create_app
    from markets_worker.auth import get_auth
    application = create_app()
    # Override auth dependency so no real Supabase JWT check happens
    application.dependency_overrides[get_auth] = _make_auth_ctx
    return application


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer mock-token"}


class TestGetProfile:
    def test_returns_404_when_no_profile(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value.execute.return_value = \
            MagicMock(data=None, error=None)
        with patch("markets_worker.routers.retail.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/retail/profile", headers=auth_headers)
        assert resp.status_code == 404

    def test_returns_profile_when_exists(self, client, auth_headers):
        profile = {"id": "p1", "user_id": MOCK_USER_ID, "experience_level": "beginner",
                   "risk_tag": "conservative", "goals": [], "onboarding_complete": False}
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value.execute.return_value = \
            MagicMock(data=profile, error=None)
        with patch("markets_worker.routers.retail.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/retail/profile", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["experience_level"] == "beginner"


class TestUpsertProfile:
    def test_upsert_creates_profile(self, client, auth_headers):
        profile = {"id": "p1", "user_id": MOCK_USER_ID, "experience_level": "casual",
                   "risk_tag": "moderate", "goals": [], "onboarding_complete": False}
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.upsert.return_value \
            .select.return_value.single.return_value.execute.return_value = \
            MagicMock(data=profile, error=None)
        with patch("markets_worker.routers.retail.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/retail/profile", headers=auth_headers, json={
                "experience_level": "casual",
                "risk_tag": "moderate",
                "goals": [],
            })
        assert resp.status_code == 201
        assert resp.json()["risk_tag"] == "moderate"


class TestGetTiers:
    def test_returns_empty_list_when_no_tiers(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.order.return_value.execute.return_value = \
            MagicMock(data=[], error=None)
        with patch("markets_worker.routers.retail.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/retail/tiers", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []


class TestUpsertTier:
    def test_rejects_invalid_tier_number(self, client, auth_headers):
        resp = client.post("/v1/retail/tiers/5", headers=auth_headers, json={
            "tier_number": 5,
            "name": "Invalid",
        })
        assert resp.status_code == 400

    def test_upsert_valid_tier(self, client, auth_headers):
        tier = {"id": "t1", "user_id": MOCK_USER_ID, "tier_number": 2, "name": "Core Portfolio"}
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.upsert.return_value \
            .select.return_value.single.return_value.execute.return_value = \
            MagicMock(data=tier, error=None)
        with patch("markets_worker.routers.retail.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/retail/tiers/2", headers=auth_headers, json={
                "tier_number": 2,
                "name": "Core Portfolio",
            })
        assert resp.status_code == 201


class TestRetailSignals:
    def test_returns_signal_list(self, client, auth_headers):
        signals = [{"id": "s1", "confidence": 0.73, "asset_class": "equity"}]
        mock_sb = MagicMock()
        # Chain: .schema().from_().select().gte().in_().not_().is_().gte().order().limit()
        chain = mock_sb.schema.return_value.from_.return_value.select.return_value
        # not_ is an attribute (not a call), so no .return_value between not_ and is_
        chain.gte.return_value.in_.return_value.not_.is_.return_value \
            .gte.return_value.order.return_value \
            .limit.return_value.execute.return_value = MagicMock(data=signals, error=None)
        with patch("markets_worker.routers.retail.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/retail/signals", headers=auth_headers)
        assert resp.status_code == 200
