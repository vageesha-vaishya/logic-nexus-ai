# services/markets-worker/src/markets_worker/autonomous/data_validator.py
"""Layer 0: pre-flight data validation before any order is submitted."""
from __future__ import annotations
import time
from dataclasses import dataclass

STALE_THRESHOLD_SECONDS = 300  # 5 minutes


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    reason: str = ""

    def to_dict(self) -> dict:
        return {"passed": self.passed, "reason": self.reason}


def validate_price_staleness(symbol_key: str, ltp_cache: dict) -> ValidationResult:
    entry = ltp_cache.get(symbol_key)
    if not entry:
        return ValidationResult(False, f"Price not found in cache for {symbol_key}")
    ts, _ = entry
    age = time.time() - ts
    if age > STALE_THRESHOLD_SECONDS:
        return ValidationResult(False, f"Price is stale ({age:.0f}s old, limit {STALE_THRESHOLD_SECONDS}s)")
    return ValidationResult(True)


def validate_fat_finger(order_value: float, portfolio_nav: float) -> ValidationResult:
    if portfolio_nav <= 0:
        return ValidationResult(False, "Portfolio NAV is zero or negative — cannot validate order size")
    pct = (order_value / portfolio_nav) * 100
    if pct > 20.0:
        return ValidationResult(False, f"Order value {pct:.1f}% of portfolio exceeds 20% fat-finger limit")
    return ValidationResult(True)


def validate_circuit_breaker(symbol_key: str, ltp_cache: dict, side: str = "BUY") -> ValidationResult:
    entry = ltp_cache.get(symbol_key)
    if not entry:
        return ValidationResult(False, f"Price not found in cache for {symbol_key}")
    _, data = entry
    ltp = data.get("ltp", 0)
    upper = data.get("upper_circuit")
    lower = data.get("lower_circuit")
    if upper and side == "BUY" and ltp >= upper:
        return ValidationResult(False, f"{symbol_key} is at upper circuit limit ({upper})")
    if lower and side == "SELL" and ltp <= lower:
        return ValidationResult(False, f"{symbol_key} is at lower circuit limit ({lower})")
    return ValidationResult(True)


def run_all_checks(
    symbol_key: str,
    ltp_cache: dict,
    order_value: float,
    portfolio_nav: float,
    side: str = "BUY",
) -> dict[str, ValidationResult]:
    return {
        "price_staleness": validate_price_staleness(symbol_key, ltp_cache),
        "fat_finger": validate_fat_finger(order_value, portfolio_nav),
        "circuit_breaker": validate_circuit_breaker(symbol_key, ltp_cache, side),
    }


def all_passed(checks: dict[str, ValidationResult]) -> tuple[bool, str]:
    for name, result in checks.items():
        if not result.passed:
            return False, f"{name}: {result.reason}"
    return True, ""
