"""Shared pytest fixtures for markets-worker.

Provides:
  - app / client            — a TestClient over a freshly-built FastAPI app
  - mock_user_id            — canonical test user UUID
  - auth_headers            — bearer header that flows through to the auth
                              dependency (the dependency itself is overridden)
  - mock_supabase           — patches markets_worker.db.get_supabase. Routers
                              that read `from markets_worker.db import get_supabase`
                              at function-scope pick up the patch transparently;
                              routers that import the symbol at module-scope
                              should re-patch in their own module path.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from markets_worker.auth import AuthContext, get_auth
from markets_worker.main import create_app

MOCK_USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def mock_user_id() -> str:
    return MOCK_USER_ID


@pytest.fixture
def app():
    application = create_app()
    application.dependency_overrides[get_auth] = lambda: AuthContext(user_id=MOCK_USER_ID)
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def mock_supabase():
    """Patch get_supabase across both db and routers.retail import paths."""
    mock_client = MagicMock()
    mock_schema = MagicMock()
    mock_client.schema.return_value = mock_schema
    with (
        patch("markets_worker.db.get_supabase", return_value=mock_client),
        patch("markets_worker.routers.retail.get_supabase", return_value=mock_client),
    ):
        yield mock_schema
