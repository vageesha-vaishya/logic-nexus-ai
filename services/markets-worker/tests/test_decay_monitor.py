# services/markets-worker/tests/test_decay_monitor.py
"""Tests for rolling 30-day strategy win-rate decay detection."""
import pytest
from markets_worker.jobs.decay_monitor import (
    compute_win_rate,
    is_decayed,
    WIN_RATE_THRESHOLD,
)


class TestWinRate:
    def test_all_winners(self):
        trades = [{"pnl": 100}, {"pnl": 200}, {"pnl": 50}]
        assert compute_win_rate(trades) == 1.0

    def test_all_losers(self):
        trades = [{"pnl": -100}, {"pnl": -50}]
        assert compute_win_rate(trades) == 0.0

    def test_mixed(self):
        trades = [{"pnl": 100}, {"pnl": -50}, {"pnl": 200}, {"pnl": -30}]
        assert compute_win_rate(trades) == 0.5

    def test_empty_returns_none(self):
        assert compute_win_rate([]) is None


class TestIsDecayed:
    def test_decayed_when_below_threshold(self):
        assert is_decayed(0.30) is True

    def test_healthy_above_threshold(self):
        assert is_decayed(0.55) is False

    def test_exactly_at_threshold_not_decayed(self):
        assert is_decayed(WIN_RATE_THRESHOLD) is False

    def test_none_win_rate_returns_false(self):
        assert is_decayed(None) is False
