"""
Black-Scholes Greeks engine.

All functions accept plain Python floats. Time T is in years.
Risk-free rate r defaults to 0.065 (RBI repo rate as of 2026).
"""
from __future__ import annotations
import math


def _norm_cdf(x: float) -> float:
    """Standard-normal CDF via math.erfc (no scipy dependency)."""
    return 0.5 * math.erfc(-x / math.sqrt(2))


def _norm_pdf(x: float) -> float:
    """Standard-normal PDF."""
    return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)


def _d1d2(S: float, K: float, T: float, r: float, sigma: float) -> tuple[float, float]:
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        raise ValueError("Invalid B-S inputs")
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return d1, d2


def bs_price(option_type: str, S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Black-Scholes theoretical price. option_type: 'CE' or 'PE'."""
    d1, d2 = _d1d2(S, K, T, r, sigma)
    if option_type.upper() == "CE":
        return S * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)
    else:
        return K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)


def implied_volatility(
    option_type: str, S: float, K: float, T: float, r: float,
    market_price: float, tol: float = 1e-5, max_iter: int = 100,
) -> float | None:
    """Newton-Raphson IV solver. Returns None if it fails to converge."""
    if T <= 0 or market_price <= 0:
        return None
    sigma = 0.20  # initial guess
    for _ in range(max_iter):
        try:
            price = bs_price(option_type, S, K, T, r, sigma)
            d1, _ = _d1d2(S, K, T, r, sigma)
            vega = S * _norm_pdf(d1) * math.sqrt(T)
            if abs(vega) < 1e-10:
                return None
            diff = market_price - price
            sigma += diff / vega
            if sigma <= 0:
                sigma = 1e-6
            if abs(diff) < tol:
                return sigma
        except (ValueError, ZeroDivisionError, OverflowError):
            return None
    return None


def greeks(
    option_type: str, S: float, K: float, T: float, r: float, sigma: float,
) -> dict:
    """
    Returns dict with delta, gamma, theta (per day), vega (per 1% IV move).
    Returns all zeros on bad inputs.
    """
    zeros = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    try:
        d1, d2 = _d1d2(S, K, T, r, sigma)
        nd1 = _norm_pdf(d1)
        sqrt_T = math.sqrt(T)
        gamma = nd1 / (S * sigma * sqrt_T)
        vega  = S * nd1 * sqrt_T / 100          # per 1% change in vol
        if option_type.upper() == "CE":
            delta = _norm_cdf(d1)
            theta = (
                -(S * nd1 * sigma) / (2 * sqrt_T)
                - r * K * math.exp(-r * T) * _norm_cdf(d2)
            ) / 365
        else:
            delta = _norm_cdf(d1) - 1
            theta = (
                -(S * nd1 * sigma) / (2 * sqrt_T)
                + r * K * math.exp(-r * T) * _norm_cdf(-d2)
            ) / 365
        return {
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta, 4),
            "vega":  round(vega,  4),
        }
    except Exception:
        return zeros
