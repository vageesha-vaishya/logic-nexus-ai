"""LLM explanation layer over generated signals."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_generate_explanations_returns_three_levels():
    from markets_worker.jobs.signal_generator import _generate_explanations

    mock_payload = {
        "beginner": "Reliance looks like a buy right now.",
        "casual": "RSI 58, momentum rising. Confidence 72%. Entry ₹2,890.",
        "self_directed": (
            "EMA20 > EMA50. RSI 58. Vol +65% vs 20d avg. Confidence 72% "
            "(CI 69–75%). Stop ₹2,820. Target ₹3,050. R/R 1:2.1."
        ),
    }

    with patch(
        "markets_worker.jobs.signal_generator._call_llm_for_explanation",
        new=AsyncMock(return_value=mock_payload),
    ):
        result = await _generate_explanations(
            symbol="RELIANCE",
            asset_class="equity",
            signal_type="buy",
            confidence=0.72,
            rationale="EMA cross with volume confirmation",
            risk_params={"stop_loss_pct": 2.5, "target_pct": 5.5},
            horizon="short_term",
        )

    assert set(result.keys()) == {"beginner", "casual", "self_directed"}
    assert "Reliance" in result["beginner"]
    assert "RSI" in result["casual"]
    assert "EMA20" in result["self_directed"]


@pytest.mark.asyncio
async def test_generate_explanations_returns_empty_on_llm_failure():
    """A broken LLM must never bubble up into signal generation — return {}."""
    from markets_worker.jobs.signal_generator import _generate_explanations

    with patch(
        "markets_worker.jobs.signal_generator._call_llm_for_explanation",
        new=AsyncMock(side_effect=RuntimeError("rate limited")),
    ):
        result = await _generate_explanations(
            symbol="TCS",
            asset_class="equity",
            signal_type="buy",
            confidence=0.65,
            rationale="momentum",
            risk_params={},
            horizon="short_term",
        )
    assert result == {}


@pytest.mark.asyncio
async def test_generate_explanations_drops_partial_responses():
    """If the LLM emits an incomplete dict (missing keys), reject it entirely
    rather than store a half-populated explanations block."""
    from markets_worker.jobs.signal_generator import _generate_explanations

    with patch(
        "markets_worker.jobs.signal_generator._call_llm_for_explanation",
        new=AsyncMock(return_value={"beginner": "ok", "casual": "ok"}),
    ):
        result = await _generate_explanations(
            symbol="HDFCBANK",
            asset_class="equity",
            signal_type="buy",
            confidence=0.70,
            rationale="trend",
            risk_params={},
            horizon="long_term",
        )
    assert result == {}


@pytest.mark.asyncio
async def test_call_llm_for_explanation_parses_json_from_response():
    """The LLM caller must extract JSON from the gateway's text reply."""
    from markets_worker.jobs.signal_generator import _call_llm_for_explanation

    payload = {
        "beginner": "A is a buy.",
        "casual": "Entry 100.",
        "self_directed": "EMA cross, stop 95, target 110.",
    }
    fake_result = type("R", (), {"content": "Here you go:\n" + json.dumps(payload) + "\n"})()

    with patch(
        "markets_worker.jobs.signal_generator.llm_invoke",
        new=AsyncMock(return_value=fake_result),
    ):
        out = await _call_llm_for_explanation("dummy prompt")

    assert out == payload
