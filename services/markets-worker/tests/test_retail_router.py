"""Retail router contract tests — /v1/retail/{profile,tiers,signals}."""
from __future__ import annotations

from unittest.mock import MagicMock


def _mk_response(data, error=None) -> MagicMock:
    """Build a fake supabase APIResponse with .data (+ optional .error)."""
    return MagicMock(data=data, error=error)


# ── /v1/retail/profile ────────────────────────────────────────────────────────

def test_get_profile_returns_404_when_missing(client, auth_headers, mock_supabase):
    mock_supabase.from_().select().eq().maybe_single.return_value = MagicMock(
        execute=MagicMock(return_value=_mk_response(None)),
    )
    resp = client.get("/v1/retail/profile", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Risk profile not found"


def test_get_profile_returns_row_when_present(client, auth_headers, mock_user_id, mock_supabase):
    row = {
        "id": "p1",
        "user_id": mock_user_id,
        "experience_level": "beginner",
        "risk_tag": "conservative",
        "goals": [],
        "behavioral_flags": {},
        "quiz_answers": {},
        "onboarding_complete": False,
    }
    mock_supabase.from_().select().eq().maybe_single.return_value = MagicMock(
        execute=MagicMock(return_value=_mk_response(row)),
    )
    resp = client.get("/v1/retail/profile", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["risk_tag"] == "conservative"


def test_upsert_profile_returns_201_and_stamps_user(client, auth_headers, mock_user_id, mock_supabase):
    body = {
        "experience_level": "casual",
        "risk_tag": "moderate",
        "goals": [{"goal": "retirement", "years": 20}],
        "onboarding_complete": True,
    }
    saved = {**body, "id": "p1", "user_id": mock_user_id, "behavioral_flags": {}, "quiz_answers": {}}

    upsert_call = MagicMock()
    upsert_call.select.return_value.single.return_value.execute.return_value = _mk_response(saved)
    mock_supabase.from_().upsert.return_value = upsert_call

    resp = client.post("/v1/retail/profile", json=body, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["risk_tag"] == "moderate"

    sent_payload, sent_kwargs = mock_supabase.from_().upsert.call_args
    assert sent_payload[0]["user_id"] == mock_user_id
    assert sent_kwargs == {"on_conflict": "user_id"}


def test_upsert_profile_rejects_invalid_risk_tag(client, auth_headers, mock_supabase):
    body = {
        "experience_level": "beginner",
        "risk_tag": "yolo",  # not in enum
        "goals": [],
    }
    resp = client.post("/v1/retail/profile", json=body, headers=auth_headers)
    assert resp.status_code == 422


# ── /v1/retail/tiers ──────────────────────────────────────────────────────────

def test_get_tiers_returns_empty_list_when_none(client, auth_headers, mock_supabase):
    mock_supabase.from_().select().eq().order.return_value = MagicMock(
        execute=MagicMock(return_value=_mk_response([])),
    )
    resp = client.get("/v1/retail/tiers", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_tiers_returns_sorted_rows(client, auth_headers, mock_user_id, mock_supabase):
    rows = [
        {"id": "t1", "user_id": mock_user_id, "tier_number": 1, "name": "Safety Net"},
        {"id": "t2", "user_id": mock_user_id, "tier_number": 2, "name": "Core Portfolio"},
    ]
    mock_supabase.from_().select().eq().order.return_value = MagicMock(
        execute=MagicMock(return_value=_mk_response(rows)),
    )
    resp = client.get("/v1/retail/tiers", headers=auth_headers)
    assert resp.status_code == 200
    assert [r["tier_number"] for r in resp.json()] == [1, 2]


def test_upsert_tier_201_with_correct_conflict_target(client, auth_headers, mock_user_id, mock_supabase):
    body = {"name": "Core Portfolio", "target_amount": 500000, "goals": ["retirement"]}
    saved = {**body, "id": "t1", "user_id": mock_user_id, "tier_number": 2, "portfolio_id": None}

    upsert_call = MagicMock()
    upsert_call.select.return_value.single.return_value.execute.return_value = _mk_response(saved)
    mock_supabase.from_().upsert.return_value = upsert_call

    resp = client.post("/v1/retail/tiers/2", json=body, headers=auth_headers)
    assert resp.status_code == 201
    payload, kwargs = mock_supabase.from_().upsert.call_args
    assert payload[0]["tier_number"] == 2
    assert payload[0]["user_id"] == mock_user_id
    assert kwargs == {"on_conflict": "user_id,tier_number"}


def test_upsert_tier_rejects_invalid_tier_number(client, auth_headers, mock_supabase):
    body = {"name": "Core Portfolio"}  # valid body — error must come from path, not pydantic
    resp = client.post("/v1/retail/tiers/4", json=body, headers=auth_headers)
    assert resp.status_code == 400
    assert "tier_number" in resp.json()["detail"]


# ── /v1/retail/signals ────────────────────────────────────────────────────────

def test_get_signals_filters_by_asset_class_and_min_confidence(
    client, auth_headers, mock_supabase,
):
    rows = [
        {"id": "s1", "asset_class": "equity",      "horizon": "short_term", "confidence": 0.82},
        {"id": "s2", "asset_class": "mutual_fund", "horizon": "long_term",  "confidence": 0.75},
    ]

    # Build a query-builder-shaped mock with chained methods.
    builder = MagicMock()
    builder.execute.return_value = _mk_response(rows)
    builder.gte.return_value          = builder
    builder.in_.return_value          = builder
    builder.not_.is_.return_value     = builder
    builder.order.return_value        = builder
    builder.limit.return_value        = builder
    builder.eq.return_value           = builder

    mock_supabase.from_().select.return_value = builder

    resp = client.get(
        "/v1/retail/signals?min_confidence=0.7&horizon=short_term&limit=5",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Min-confidence threshold must be passed through to .gte()
    gte_calls = [c.args for c in builder.gte.call_args_list]
    assert ("confidence", 0.7) in gte_calls
    # Horizon filter must be applied
    builder.eq.assert_any_call("horizon", "short_term")
    # Limit must be applied
    builder.limit.assert_called_with(5)


def _build_signals_query_mock(mock_supabase, rows):
    builder = MagicMock()
    builder.execute.return_value = _mk_response(rows)
    for m in ("gte", "in_", "order", "limit", "eq"):
        getattr(builder, m).return_value = builder
    builder.not_.is_.return_value = builder
    mock_supabase.from_().select.return_value = builder
    return builder


def test_get_signals_defaults_to_full_asset_class_vocabulary(client, auth_headers, mock_supabase):
    """Phase 2: default feed includes every asset class the worker emits."""
    builder = _build_signals_query_mock(mock_supabase, [])

    resp = client.get("/v1/retail/signals", headers=auth_headers)
    assert resp.status_code == 200
    builder.in_.assert_called_with(
        "asset_class",
        ["equity", "mf", "fo", "fx", "bond", "commodity"],
    )


def test_get_signals_accepts_explicit_fo_asset_class(client, auth_headers, mock_supabase):
    """F&O signals should be served when explicitly requested."""
    builder = _build_signals_query_mock(mock_supabase, [{"id": "s2", "asset_class": "fo"}])

    resp = client.get("/v1/retail/signals?asset_class=fo", headers=auth_headers)
    assert resp.status_code == 200
    builder.in_.assert_called_with("asset_class", ["fo"])


def test_get_signals_rejects_unknown_asset_class(client, auth_headers, mock_supabase):
    """Unknown asset_class values fail validation before touching the DB."""
    resp = client.get("/v1/retail/signals?asset_class=crypto", headers=auth_headers)
    assert resp.status_code == 422


def test_get_signals_accepts_medium_term_horizon(client, auth_headers, mock_supabase):
    """Phase 2 widened the horizon vocabulary to include medium_term."""
    builder = _build_signals_query_mock(mock_supabase, [])

    resp = client.get("/v1/retail/signals?horizon=medium_term", headers=auth_headers)
    assert resp.status_code == 200
    builder.eq.assert_any_call("horizon", "medium_term")
