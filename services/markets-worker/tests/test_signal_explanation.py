"""Tests for signal explanation generation and asset_class normalization."""
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


def test_derive_asset_class_uses_long_form_values():
    """asset_class stored in DB must use long-form values matching the retail API.

    retail.py and SignalFilter.tsx both filter on:
      derivative | mutual_fund | forex | fixed_income | commodity | crypto | equity

    This test guarantees _derive_asset_class never returns the old short-form keys
    (fo, mf, fx, bond) that used to cause mismatches.
    """
    from markets_worker.jobs.signal_generator import _derive_asset_class

    # F&O / derivatives — instrument_type FUT / OPT / CE / PE
    assert _derive_asset_class("FUT", "equity") == "derivative"
    assert _derive_asset_class("OPT", "equity") == "derivative"
    assert _derive_asset_class("CE", "equity")  == "derivative"
    assert _derive_asset_class("PE", "equity")  == "derivative"

    # Mutual fund — instrument_type MF or asset_class_db "mf"
    assert _derive_asset_class("MF", "equity")      == "mutual_fund"
    assert _derive_asset_class("EQ", "mf")          == "mutual_fund"

    # Forex / currency
    assert _derive_asset_class("CURRENCY", "equity")  == "forex"
    assert _derive_asset_class("EQ", "fx")            == "forex"
    assert _derive_asset_class("EQ", "currency")      == "forex"

    # Fixed income / bonds
    assert _derive_asset_class("BOND", "equity")   == "fixed_income"
    assert _derive_asset_class("GB", "equity")     == "fixed_income"
    assert _derive_asset_class("EQ", "bond")       == "fixed_income"
    assert _derive_asset_class("EQ", "gsec")       == "fixed_income"
    assert _derive_asset_class("EQ", "tbill")      == "fixed_income"

    # Commodity
    assert _derive_asset_class("COMM", "equity")   == "commodity"
    assert _derive_asset_class("MCX", "equity")    == "commodity"
    assert _derive_asset_class("EQ", "commodity")  == "commodity"

    # Crypto — previously fell through to equity (bug)
    assert _derive_asset_class("CRYPTO", "equity") == "crypto"
    assert _derive_asset_class("EQ", "crypto")     == "crypto"

    # Plain equity — default
    assert _derive_asset_class("EQ", "equity")     == "equity"
    assert _derive_asset_class("EQ", "")           == "equity"
    assert _derive_asset_class("", "")             == "equity"

    # Confirm OLD short-form strings are never returned
    short_form_keys = {"fo", "mf", "fx", "bond"}
    all_cases = [
        ("FUT", "equity"), ("OPT", "equity"), ("CE", "equity"), ("PE", "equity"),
        ("MF", "equity"), ("EQ", "mf"),
        ("CURRENCY", "equity"), ("EQ", "fx"), ("EQ", "currency"),
        ("BOND", "equity"), ("GB", "equity"), ("EQ", "bond"), ("EQ", "gsec"), ("EQ", "tbill"),
        ("COMM", "equity"), ("MCX", "equity"), ("EQ", "commodity"),
        ("CRYPTO", "equity"), ("EQ", "crypto"),
        ("EQ", "equity"), ("EQ", ""), ("", ""),
    ]
    for instr_type, ac_db in all_cases:
        result = _derive_asset_class(instr_type, ac_db)
        assert result not in short_form_keys, (
            f"_derive_asset_class({instr_type!r}, {ac_db!r}) returned short-form {result!r}; "
            f"must return long-form for retail API compatibility"
        )
