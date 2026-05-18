# services/markets-worker/tests/test_data_validator.py
"""Layer 0 data validation — pure function tests (no DB, no network)."""
import time
import pytest
from markets_worker.autonomous.data_validator import (
    validate_price_staleness,
    validate_fat_finger,
    validate_circuit_breaker,
    ValidationResult,
    STALE_THRESHOLD_SECONDS,
)

FRESH = time.time()
STALE = time.time() - (STALE_THRESHOLD_SECONDS + 60)


class TestPriceStaleness:
    def test_fresh_price_passes(self):
        cache = {"RELIANCE:NSE": (FRESH, {"ltp": 2890.0})}
        r = validate_price_staleness("RELIANCE:NSE", cache)
        assert r.passed is True

    def test_stale_price_fails(self):
        cache = {"RELIANCE:NSE": (STALE, {"ltp": 2890.0})}
        r = validate_price_staleness("RELIANCE:NSE", cache)
        assert r.passed is False
        assert "stale" in r.reason.lower()

    def test_missing_symbol_fails(self):
        r = validate_price_staleness("UNKNOWN:NSE", {})
        assert r.passed is False
        assert "not found" in r.reason.lower()


class TestFatFinger:
    def test_small_order_passes(self):
        r = validate_fat_finger(order_value=5_000, portfolio_nav=1_00_000)
        assert r.passed is True

    def test_large_order_blocked(self):
        r = validate_fat_finger(order_value=25_000, portfolio_nav=1_00_000)
        assert r.passed is False
        assert "20%" in r.reason

    def test_zero_nav_fails_safely(self):
        r = validate_fat_finger(order_value=1000, portfolio_nav=0)
        assert r.passed is False

    def test_boundary_exactly_20pct_passes(self):
        r = validate_fat_finger(order_value=20_000, portfolio_nav=1_00_000)
        assert r.passed is True


class TestCircuitBreaker:
    def test_normal_price_passes(self):
        cache = {"RELIANCE:NSE": (FRESH, {"ltp": 2890.0, "prev_price": 2880.0, "upper_circuit": 3168.0, "lower_circuit": 2592.0})}
        r = validate_circuit_breaker("RELIANCE:NSE", cache)
        assert r.passed is True

    def test_upper_circuit_blocks_buy(self):
        cache = {"RELIANCE:NSE": (FRESH, {"ltp": 3168.0, "prev_price": 2880.0, "upper_circuit": 3168.0, "lower_circuit": 2592.0})}
        r = validate_circuit_breaker("RELIANCE:NSE", cache, side="BUY")
        assert r.passed is False
        assert "circuit" in r.reason.lower()

    def test_no_circuit_data_passes(self):
        cache = {"RELIANCE:NSE": (FRESH, {"ltp": 2890.0})}
        r = validate_circuit_breaker("RELIANCE:NSE", cache)
        assert r.passed is True
