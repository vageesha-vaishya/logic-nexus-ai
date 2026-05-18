"""Tests for signal explanation generation."""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_generate_explanations_returns_three_levels():
    """_generate_explanations should return a dict with beginner/casual/self_directed keys."""
    from markets_worker.jobs.signal_generator import _generate_explanations

    mock_llm_response = {
        "beginner": "Reliance looks good to buy right now.",
        "casual": "RSI at 58, momentum rising. Confidence 72%. Entry ₹2,890.",
        "self_directed": "EMA20 > EMA50 cross. RSI 58. Vol +65% vs 20d avg. Stop ₹2,820. Target ₹3,050.",
    }

    with patch(
        "markets_worker.jobs.signal_generator._call_llm_for_explanation",
        new=AsyncMock(return_value=mock_llm_response),
    ):
        result = await _generate_explanations(
            symbol="RELIANCE",
            asset_class="equity",
            signal_type="buy",
            confidence=0.72,
            rationale="EMA cross with volume confirmation",
            risk_params={"stop_loss_pct": 2.5, "target_pct": 5.5, "r_r": 2.2},
            horizon="short_term",
        )

    assert result["beginner"] == "Reliance looks good to buy right now."
    assert "RSI" in result["casual"]
    assert "EMA20" in result["self_directed"]


@pytest.mark.asyncio
async def test_generate_explanations_returns_empty_on_llm_failure():
    """_generate_explanations should return {} when LLM call fails, not raise."""
    from markets_worker.jobs.signal_generator import _generate_explanations

    with patch(
        "markets_worker.jobs.signal_generator._call_llm_for_explanation",
        new=AsyncMock(side_effect=Exception("LLM unavailable")),
    ):
        result = await _generate_explanations(
            symbol="RELIANCE",
            asset_class="equity",
            signal_type="buy",
            confidence=0.72,
            rationale="test",
            risk_params={},
            horizon="short_term",
        )

    assert result == {}
