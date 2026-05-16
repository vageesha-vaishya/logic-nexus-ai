"""
Vectorised Backtest Engine — v1

Supports two strategy modes driven by the strategy.dsl JSON:

  buy_and_hold   → hold all universe symbols for the full period
  rule_based     → entry/exit conditions on RSI, SMA crossover, MACD,
                   Bollinger Bands, price-change momentum

DSL schema (parsed from strategy.dsl text field):
{
  "version": 1,
  "strategy_type": "buy_and_hold" | "rule_based",
  "entry_conditions": [
    {"indicator": "rsi",          "period": 14,       "op": "<",  "value": 30},
    {"indicator": "sma_cross",    "fast": 10, "slow": 50,         "direction": "above"},
    {"indicator": "macd_cross",   "fast": 12, "slow": 26, "signal": 9, "direction": "above"},
    {"indicator": "bb_squeeze",   "period": 20, "std": 2.0,       "direction": "above"},
    {"indicator": "price_change", "period": 5,        "op": ">",  "value": 2.0}
  ],
  "exit_conditions": {
    "stop_loss_pct":      7.0,
    "take_profit_pct":    20.0,
    "trailing_stop_pct":  null,
    "max_holding_days":   30,
    "rsi_overbought":     70
  },
  "position_sizing": {
    "method":       "equal_weight",   // or "fixed_pct"
    "max_positions": 5,
    "pct_per_trade": 20.0
  }
}

If DSL is absent or invalid, defaults to buy_and_hold.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import numpy as np
import polars as pl
import structlog

logger = structlog.get_logger()

# ── DSL defaults ─────────────────────────────────────────────────────────────

_DEFAULT_DSL: dict = {
    "version": 1,
    "strategy_type": "buy_and_hold",
    "entry_conditions": [],
    "exit_conditions": {
        "stop_loss_pct":     None,
        "take_profit_pct":   None,
        "trailing_stop_pct": None,
        "max_holding_days":  None,
        "rsi_overbought":    None,
    },
    "position_sizing": {
        "method":        "equal_weight",
        "max_positions": 10,
        "pct_per_trade": 100.0,
    },
}


def _parse_dsl(raw: str | None) -> dict:
    if not raw:
        return _DEFAULT_DSL
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return _DEFAULT_DSL
        parsed.setdefault("strategy_type", "buy_and_hold")
        parsed.setdefault("entry_conditions", [])
        ec = parsed.get("exit_conditions") or {}
        parsed["exit_conditions"] = {
            "stop_loss_pct":     ec.get("stop_loss_pct"),
            "take_profit_pct":   ec.get("take_profit_pct"),
            "trailing_stop_pct": ec.get("trailing_stop_pct"),
            "max_holding_days":  ec.get("max_holding_days"),
            "rsi_overbought":    ec.get("rsi_overbought"),
        }
        ps = parsed.get("position_sizing") or {}
        parsed["position_sizing"] = {
            "method":        ps.get("method", "equal_weight"),
            "max_positions": int(ps.get("max_positions", 10)),
            "pct_per_trade": float(ps.get("pct_per_trade", 100.0)),
        }
        return parsed
    except Exception:
        return _DEFAULT_DSL


# ── Technical indicators (all take a 1-D float64 array, return same length) ─

def _sma(arr: np.ndarray, period: int) -> np.ndarray:
    out = np.full(len(arr), np.nan)
    for i in range(period - 1, len(arr)):
        out[i] = arr[i - period + 1 : i + 1].mean()
    return out


def _ema(arr: np.ndarray, period: int) -> np.ndarray:
    out = np.full(len(arr), np.nan)
    k = 2.0 / (period + 1)
    # seed with first SMA
    if len(arr) >= period:
        out[period - 1] = arr[:period].mean()
        for i in range(period, len(arr)):
            out[i] = arr[i] * k + out[i - 1] * (1 - k)
    return out


def _rsi(arr: np.ndarray, period: int = 14) -> np.ndarray:
    out = np.full(len(arr), np.nan)
    delta = np.diff(arr)
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    if len(delta) < period:
        return out
    avg_gain = gain[:period].mean()
    avg_loss = loss[:period].mean()
    for i in range(period, len(delta)):
        avg_gain = (avg_gain * (period - 1) + gain[i]) / period
        avg_loss = (avg_loss * (period - 1) + loss[i]) / period
        rs = avg_gain / avg_loss if avg_loss > 0 else 100
        idx = i + 1          # offset: delta is 1 shorter than arr
        out[idx] = 100 - (100 / (1 + rs))
    return out


def _macd(arr: np.ndarray, fast: int = 12, slow: int = 26,
          signal: int = 9) -> tuple[np.ndarray, np.ndarray]:
    macd_line = _ema(arr, fast) - _ema(arr, slow)
    sig_line  = _ema(np.where(np.isnan(macd_line), 0, macd_line), signal)
    sig_line  = np.where(np.isnan(macd_line), np.nan, sig_line)
    return macd_line, sig_line


def _bollinger(arr: np.ndarray, period: int = 20,
               std: float = 2.0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mid = _sma(arr, period)
    std_arr = np.full(len(arr), np.nan)
    for i in range(period - 1, len(arr)):
        std_arr[i] = arr[i - period + 1 : i + 1].std(ddof=1)
    upper = mid + std * std_arr
    lower = mid - std * std_arr
    return upper, mid, lower


def _pct_change(arr: np.ndarray, period: int = 1) -> np.ndarray:
    out = np.full(len(arr), np.nan)
    for i in range(period, len(arr)):
        if arr[i - period] != 0:
            out[i] = (arr[i] - arr[i - period]) / arr[i - period] * 100
    return out


# ── Entry condition evaluator ─────────────────────────────────────────────────

def _check_entry(closes: np.ndarray, dsl: dict, i: int) -> bool:
    """Return True if all entry conditions are satisfied at bar i."""
    for cond in dsl.get("entry_conditions", []):
        ind = cond.get("indicator", "")

        if ind == "rsi":
            period = int(cond.get("period", 14))
            rsi_arr = _rsi(closes[:i + 1], period)
            v = rsi_arr[-1]
            if np.isnan(v):
                return False
            op = cond.get("op", "<")
            thr = float(cond.get("value", 30))
            if op == "<"  and not (v < thr):  return False
            if op == ">"  and not (v > thr):  return False
            if op == "<=" and not (v <= thr): return False
            if op == ">=" and not (v >= thr): return False

        elif ind == "sma_cross":
            fast  = int(cond.get("fast", 10))
            slow  = int(cond.get("slow", 50))
            arr   = closes[:i + 1]
            if len(arr) < slow + 1:
                return False
            sma_f_now  = _sma(arr, fast)[-1]
            sma_s_now  = _sma(arr, slow)[-1]
            sma_f_prev = _sma(arr[:-1], fast)[-1]
            sma_s_prev = _sma(arr[:-1], slow)[-1]
            if any(np.isnan(x) for x in [sma_f_now, sma_s_now, sma_f_prev, sma_s_prev]):
                return False
            direction = cond.get("direction", "above")
            if direction == "above":
                if not (sma_f_prev <= sma_s_prev and sma_f_now > sma_s_now):
                    return False
            else:  # below
                if not (sma_f_prev >= sma_s_prev and sma_f_now < sma_s_now):
                    return False

        elif ind == "macd_cross":
            fast   = int(cond.get("fast", 12))
            slow   = int(cond.get("slow", 26))
            sig    = int(cond.get("signal", 9))
            arr    = closes[:i + 1]
            if len(arr) < slow + sig:
                return False
            ml, sl = _macd(arr, fast, slow, sig)
            if len(ml) < 2 or np.isnan(ml[-1]) or np.isnan(sl[-1]):
                return False
            direction = cond.get("direction", "above")
            if direction == "above":
                if not (ml[-2] <= sl[-2] and ml[-1] > sl[-1]):
                    return False
            else:
                if not (ml[-2] >= sl[-2] and ml[-1] < sl[-1]):
                    return False

        elif ind == "bb_squeeze":
            period = int(cond.get("period", 20))
            std    = float(cond.get("std", 2.0))
            arr    = closes[:i + 1]
            if len(arr) < period:
                return False
            upper, _, lower = _bollinger(arr, period, std)
            direction = cond.get("direction", "above")
            price = arr[-1]
            if direction == "above" and price <= upper[-1]:
                return False
            if direction == "below" and price >= lower[-1]:
                return False

        elif ind == "price_change":
            period = int(cond.get("period", 5))
            arr    = closes[:i + 1]
            pc     = _pct_change(arr, period)
            v      = pc[-1]
            if np.isnan(v):
                return False
            op  = cond.get("op", ">")
            thr = float(cond.get("value", 2.0))
            if op == ">" and not (v > thr):  return False
            if op == "<" and not (v < thr):  return False

    return True


# ── Exit condition evaluator ──────────────────────────────────────────────────

def _check_exit(entry_price: float, current_price: float, entry_bar: int,
                i: int, closes: np.ndarray, dsl: dict,
                max_price_since_entry: float) -> tuple[bool, str]:
    """Return (should_exit, reason)."""
    ec = dsl.get("exit_conditions", {})

    sl = ec.get("stop_loss_pct")
    tp = ec.get("take_profit_pct")
    ts = ec.get("trailing_stop_pct")
    mhd = ec.get("max_holding_days")
    rsi_ob = ec.get("rsi_overbought")

    if entry_price <= 0:
        return True, "invalid_entry_price"

    pnl_pct = (current_price - entry_price) / entry_price * 100

    if sl is not None and pnl_pct <= -abs(sl):
        return True, "stop_loss"

    if tp is not None and pnl_pct >= abs(tp):
        return True, "take_profit"

    if ts is not None and max_price_since_entry > 0:
        trail_pct = (max_price_since_entry - current_price) / max_price_since_entry * 100
        if trail_pct >= abs(ts):
            return True, "trailing_stop"

    if mhd is not None and (i - entry_bar) >= int(mhd):
        return True, "max_holding_days"

    if rsi_ob is not None:
        rsi_period = 14
        if len(closes) >= rsi_period + 1:
            rsi_arr = _rsi(closes[:i + 1], rsi_period)
            v = rsi_arr[-1]
            if not np.isnan(v) and v >= rsi_ob:
                return True, "rsi_overbought"

    return False, ""


# ── Performance metrics ───────────────────────────────────────────────────────

def _compute_metrics(
    equity_curve: list[float],
    trade_returns: list[float],
    n_trading_days: int,
    initial_capital: float,
    symbols: list[str],
    strategy_type: str,
) -> dict:
    eq = np.array(equity_curve, dtype=float)
    if len(eq) < 2 or eq[0] <= 0:
        return {}

    total_return   = (eq[-1] - eq[0]) / eq[0]
    years          = n_trading_days / 252.0
    cagr           = (eq[-1] / eq[0]) ** (1.0 / years) - 1 if years > 0 else 0.0

    daily_ret = np.diff(eq) / eq[:-1]
    vol_annual = float(daily_ret.std() * math.sqrt(252)) if len(daily_ret) > 1 else 0.0

    rf_daily = 0.065 / 252  # 6.5% risk-free (India 10Y)
    excess   = daily_ret - rf_daily
    sharpe   = float(excess.mean() / excess.std() * math.sqrt(252)) if excess.std() > 0 else 0.0

    neg_ret = daily_ret[daily_ret < 0]
    sortino_denom = float(neg_ret.std() * math.sqrt(252)) if len(neg_ret) > 0 else 0.001
    sortino = float((daily_ret.mean() - rf_daily) * math.sqrt(252) / sortino_denom)

    # Max drawdown
    running_max = np.maximum.accumulate(eq)
    drawdowns   = (eq - running_max) / running_max
    max_dd      = float(drawdowns.min())

    calmar = float(cagr / abs(max_dd)) if max_dd < 0 else 0.0

    # Trade-level stats
    rets = np.array(trade_returns, dtype=float)
    n_trades = len(rets)
    if n_trades > 0:
        wins       = rets[rets > 0]
        losses     = rets[rets <= 0]
        win_rate   = len(wins) / n_trades
        avg_win    = float(wins.mean())  if len(wins)   > 0 else 0.0
        avg_loss   = float(losses.mean()) if len(losses) > 0 else 0.0
        gross_profit = float(wins.sum())  if len(wins)   > 0 else 0.0
        gross_loss   = float(abs(losses.sum())) if len(losses) > 0 else 0.0
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else (
            float("inf") if gross_profit > 0 else 1.0
        )
        avg_trade_return = float(rets.mean())
    else:
        win_rate = profit_factor = avg_win = avg_loss = avg_trade_return = 0.0
        n_trades = 0

    # Percentage fields — frontend uses m.cagr.toFixed(2) + "%" convention
    return {
        "total_return":           round(total_return * 100, 2),
        "cagr":                   round(cagr * 100, 2),
        "sharpe":                 round(sharpe, 4),
        "sortino":                round(sortino, 4),
        "calmar":                 round(calmar, 4),
        "max_drawdown":           round(max_dd * 100, 2),   # negative e.g. -5.83
        "volatility_annualised":  round(vol_annual * 100, 2),
        "n_trading_days":         n_trading_days,
        "n_trades":               n_trades,
        "win_rate":               round(win_rate * 100, 2),  # as pct e.g. 72.5
        "profit_factor":          round(profit_factor, 3),
        "avg_trade_return_pct":   round(avg_trade_return * 100, 2),
        "avg_win_pct":            round(avg_win * 100, 2),
        "avg_loss_pct":           round(avg_loss * 100, 2),
        "symbols":                symbols,
        "n_assets":               len(symbols),
        "strategy_type":          strategy_type,
        "initial_capital":        initial_capital,
        "final_value":            round(eq[-1], 2),
    }


# ── Buy-and-Hold simulation ───────────────────────────────────────────────────

def _run_buy_and_hold(
    price_df: pl.DataFrame,
    symbols: list[str],
    initial_capital: float,
    commission_pct: float,
) -> tuple[list[float], list[float], list[date], list[str]]:
    """
    Equal-weight buy-and-hold of all symbols.
    Returns (equity_curve, trade_returns, dates, symbols_used).
    """
    dates_all   = sorted(price_df["ts"].unique().to_list())
    if len(dates_all) < 2:
        return [], [], [], []

    alloc        = initial_capital / len(symbols)
    positions: dict[str, dict] = {}
    equity_curve = [initial_capital]
    trade_rets: list[float] = []
    symbols_used: list[str] = []

    # Open all positions on day 0
    day0 = dates_all[0]
    for sym in symbols:
        df_sym = price_df.filter(pl.col("symbol") == sym).sort("ts")
        if df_sym.is_empty():
            continue
        price_row = df_sym.filter(pl.col("ts") == day0)
        if price_row.is_empty():
            # use first available price
            price_row = df_sym.head(1)
        price = float(price_row["close"][0])
        cost  = alloc * (1 + commission_pct / 100)
        shares = alloc / price if price > 0 else 0
        positions[sym] = {"shares": shares, "entry_price": price, "cost": cost}
        symbols_used.append(sym)

    # Mark-to-market each day
    for dt in dates_all[1:]:
        portfolio_val = 0.0
        for sym, pos in positions.items():
            df_sym  = price_df.filter(pl.col("symbol") == sym).sort("ts")
            row     = df_sym.filter(pl.col("ts") <= dt).tail(1)
            price   = float(row["close"][0]) if not row.is_empty() else 0.0
            portfolio_val += pos["shares"] * price
        equity_curve.append(portfolio_val)

    # Close positions at last day — compute trade return per symbol
    last_day = dates_all[-1]
    for sym, pos in positions.items():
        df_sym = price_df.filter(pl.col("symbol") == sym).sort("ts")
        row    = df_sym.tail(1)
        if row.is_empty():
            continue
        exit_price = float(row["close"][0])
        ret = (exit_price - pos["entry_price"]) / pos["entry_price"] if pos["entry_price"] > 0 else 0.0
        trade_rets.append(ret)

    return equity_curve, trade_rets, [d for d in dates_all], list(symbols_used)


# ── Rule-based simulation ─────────────────────────────────────────────────────

def _run_rule_based(
    price_df: pl.DataFrame,
    symbols: list[str],
    dsl: dict,
    initial_capital: float,
    commission_pct: float,
) -> tuple[list[float], list[float], list[date], list[str]]:
    """
    Rule-based entry/exit across a universe of symbols.
    One position per symbol max; equal-weight allocation.
    """
    dates_all = sorted(price_df["ts"].unique().to_list())
    if len(dates_all) < 30:
        # Not enough bars for indicator warm-up — fall back to buy-and-hold
        logger.warning("backtest.insufficient_data", n_bars=len(dates_all))
        return _run_buy_and_hold(price_df, symbols, initial_capital, commission_pct)

    ps        = dsl.get("position_sizing", {})
    max_pos   = int(ps.get("max_positions", 5))
    pct       = float(ps.get("pct_per_trade", 20.0)) / 100.0
    alloc_per = initial_capital * pct

    cash          = initial_capital
    positions: dict[str, dict] = {}   # sym → {shares, entry_price, entry_bar, max_price}
    equity_curve  = [initial_capital]
    trade_rets:   list[float] = []
    symbols_used: set[str] = set()

    # Build per-symbol close arrays for fast access
    sym_closes: dict[str, np.ndarray] = {}
    sym_dates:  dict[str, list] = {}
    for sym in symbols:
        df_sym = price_df.filter(pl.col("symbol") == sym).sort("ts")
        if df_sym.is_empty() or len(df_sym) < 30:
            continue
        sym_closes[sym] = df_sym["close"].to_numpy().astype(float)
        sym_dates[sym]  = df_sym["ts"].to_list()

    if not sym_closes:
        return [], [], [], []

    # Align all symbols to the common date index
    date_to_idx: dict = {d: i for i, d in enumerate(dates_all)}

    for bar_i, dt in enumerate(dates_all):
        # ── Check exits on open positions ──────────────────────────────────
        to_close: list[str] = []
        for sym, pos in positions.items():
            if dt not in date_to_idx:
                continue
            closes = sym_closes.get(sym, np.array([]))
            local_i = next((j for j, d in enumerate(sym_dates[sym]) if d == dt), None)
            if local_i is None or local_i == 0:
                continue
            price = float(closes[local_i])
            # update max price since entry
            pos["max_price"] = max(pos.get("max_price", price), price)

            should_exit, reason = _check_exit(
                entry_price           = pos["entry_price"],
                current_price         = price,
                entry_bar             = pos["entry_bar"],
                i                     = bar_i,
                closes                = closes[:local_i + 1],
                dsl                   = dsl,
                max_price_since_entry = pos["max_price"],
            )
            if should_exit:
                proceeds  = pos["shares"] * price * (1 - commission_pct / 100)
                ret       = (price - pos["entry_price"]) / pos["entry_price"]
                cash     += proceeds
                trade_rets.append(ret)
                to_close.append(sym)

        for sym in to_close:
            del positions[sym]

        # ── Check entries for symbols not held ─────────────────────────────
        if len(positions) < max_pos and cash >= alloc_per * 0.95:
            for sym in sym_closes:
                if sym in positions:
                    continue
                closes  = sym_closes[sym]
                local_i = next((j for j, d in enumerate(sym_dates[sym]) if d == dt), None)
                if local_i is None or local_i < 30:
                    continue
                if _check_entry(closes[:local_i + 1], dsl, local_i):
                    price  = float(closes[local_i])
                    if price <= 0:
                        continue
                    spend  = min(alloc_per, cash)
                    shares = spend / price / (1 + commission_pct / 100)
                    cash  -= shares * price * (1 + commission_pct / 100)
                    positions[sym] = {
                        "shares":      shares,
                        "entry_price": price,
                        "entry_bar":   bar_i,
                        "max_price":   price,
                    }
                    symbols_used.add(sym)
                    if len(positions) >= max_pos:
                        break

        # ── Mark portfolio to market ────────────────────────────────────────
        mkt_val = cash
        for sym, pos in positions.items():
            closes  = sym_closes.get(sym, np.array([]))
            local_i = next((j for j, d in enumerate(sym_dates[sym]) if d <= dt), None)
            if local_i is not None and local_i < len(closes):
                price    = float(closes[local_i])
                mkt_val += pos["shares"] * price
        equity_curve.append(mkt_val)

    # Force-close remaining positions at last bar
    for sym, pos in positions.items():
        closes = sym_closes.get(sym, np.array([]))
        if len(closes) == 0:
            continue
        price = float(closes[-1])
        ret   = (price - pos["entry_price"]) / pos["entry_price"]
        trade_rets.append(ret)

    return equity_curve[1:], trade_rets, dates_all, list(symbols_used)


# ── Public entry point ────────────────────────────────────────────────────────

@dataclass
class BacktestParams:
    strategy_id:      str
    strategy_name:    str
    dsl_raw:          str | None
    universe_symbols: list[str]
    period_from:      date
    period_to:        date
    initial_capital:  float = 1_000_000.0
    commission_model: dict  = field(default_factory=lambda: {"pct": 0.05})


@dataclass
class BacktestResult:
    metrics:      dict
    equity_curve: list[float]          # one value per trading day
    dates:        list[str]            # ISO date strings, same length as equity_curve
    trades:       list[float]          # per-trade return fractions
    symbols_used: list[str]
    error:        str | None = None


def run_backtest(params: BacktestParams, price_df: pl.DataFrame) -> BacktestResult:
    """
    Core engine entry point.

    price_df columns: symbol (str), ts (date), close (float)
    """
    dsl = _parse_dsl(params.dsl_raw)
    strategy_type = dsl.get("strategy_type", "buy_and_hold")
    cm = params.commission_model or {}
    if "pct" in cm:
        commission_pct = float(cm["pct"])
    elif "per_trade_bps" in cm:
        # Convert bps to pct; add STT and slippage if present
        bps   = float(cm.get("per_trade_bps", 3))
        stt   = float(cm.get("stt_pct", 0.1))        # STT ~0.1% on sell
        slip  = float(cm.get("slippage_bps", 5)) / 100
        commission_pct = bps / 100 + stt / 2 + slip   # round-trip avg
    else:
        commission_pct = 0.05

    # Filter price data to backtest window
    df = price_df.filter(
        (pl.col("ts") >= params.period_from) &
        (pl.col("ts") <= params.period_to)
    )

    if df.is_empty():
        return BacktestResult(
            metrics={}, equity_curve=[], dates=[], trades=[], symbols_used=[],
            error="No price data available for the selected period and universe."
        )

    symbols_in_data = df["symbol"].unique().to_list()
    symbols = [s for s in params.universe_symbols if s in symbols_in_data]
    if not symbols:
        return BacktestResult(
            metrics={}, equity_curve=[], dates=[], trades=[], symbols_used=[],
            error=f"No price data for any universe symbol in the period. "
                  f"Universe: {params.universe_symbols[:5]}. "
                  f"Data available for: {symbols_in_data[:5]}."
        )

    logger.info(
        "backtest.start",
        strategy_type=strategy_type,
        symbols=len(symbols),
        period_from=params.period_from.isoformat(),
        period_to=params.period_to.isoformat(),
    )

    if strategy_type == "buy_and_hold":
        equity, trades, dates, sym_used = _run_buy_and_hold(
            df, symbols, params.initial_capital, commission_pct
        )
    else:
        equity, trades, dates, sym_used = _run_rule_based(
            df, symbols, dsl, params.initial_capital, commission_pct
        )

    if not equity or len(equity) < 2:
        return BacktestResult(
            metrics={}, equity_curve=[], dates=[], trades=[], symbols_used=symbols,
            error="Simulation produced no equity data. Check price history coverage."
        )

    n_days = len(dates)
    metrics = _compute_metrics(
        equity_curve    = equity,
        trade_returns   = trades,
        n_trading_days  = n_days,
        initial_capital = params.initial_capital,
        symbols         = sym_used or symbols,
        strategy_type   = strategy_type,
    )

    logger.info(
        "backtest.complete",
        total_return_pct = metrics.get("total_return"),
        sharpe           = metrics.get("sharpe"),
        max_dd_pct       = metrics.get("max_drawdown"),
        n_trades         = metrics.get("n_trades"),
    )

    return BacktestResult(
        metrics      = metrics,
        equity_curve = [round(v, 2) for v in equity],
        dates        = [d.isoformat() if hasattr(d, "isoformat") else str(d) for d in dates],
        trades       = [round(t, 6) for t in trades],
        symbols_used = sym_used or symbols,
    )
