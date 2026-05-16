"""RQ job: run a vectorised backtest using Polars + DuckDB and write results to markets.backtests."""

import time
import traceback
from datetime import date

import duckdb
import polars as pl
import structlog

from markets_worker.db import get_duckdb, get_supabase

logger = structlog.get_logger()


def _update_backtest(backtest_id: str, **fields) -> None:
    get_supabase().schema("markets").from_("backtests").update(fields).eq("id", backtest_id).execute()


def _load_price_history(
    conn: duckdb.DuckDBPyConnection,
    instrument_ids: list[str],
    period_from: date,
    period_to: date,
) -> pl.DataFrame:
    """Pull OHLCV from Supabase into DuckDB, return as Polars DataFrame."""
    db = get_supabase()
    result = (
        db.schema("markets")
        .from_("price_history")
        .select("instrument_id,ts,open,high,low,close,volume")
        .in_("instrument_id", instrument_ids)
        .gte("ts", period_from.isoformat())
        .lte("ts", period_to.isoformat())
        .order("ts")
        .limit(50_000)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return pl.DataFrame()

    df = pl.DataFrame(rows)
    df = df.with_columns(pl.col("ts").str.slice(0, 10).alias("date").cast(pl.Date))
    for col in ("open", "high", "low", "close"):
        df = df.with_columns(pl.col(col).cast(pl.Float64))
    df = df.with_columns(pl.col("volume").cast(pl.Float64, strict=False))
    return df


def _compute_metrics(
    equity_curve: pl.Series,
    period_from: date,
    period_to: date,
) -> dict:
    """Compute standard performance metrics from a daily equity curve."""
    if equity_curve.is_empty() or equity_curve.null_count() == equity_curve.len():
        return {}

    returns = equity_curve.pct_change().drop_nulls()
    if returns.is_empty():
        return {}

    n_days = (period_to - period_from).days or 1
    n_years = n_days / 365.25
    final_value = float(equity_curve[-1])
    initial_value = float(equity_curve[0])

    cagr = ((final_value / initial_value) ** (1 / n_years) - 1) if n_years > 0 else 0.0
    vol = float(returns.std() or 0) * (252 ** 0.5)
    sharpe = (returns.mean() * 252) / (vol + 1e-9)

    # Max drawdown
    peak = equity_curve.cum_max()
    drawdown = (equity_curve - peak) / peak
    max_dd = float(drawdown.min() or 0)

    # Calmar ratio
    calmar = cagr / abs(max_dd + 1e-9)

    # Sortino (downside deviation)
    down_returns = returns.filter(returns < 0)
    down_vol = float(down_returns.std() or 0) * (252 ** 0.5)
    sortino = (float(returns.mean() or 0) * 252) / (down_vol + 1e-9)

    return {
        "cagr":                 round(cagr * 100, 2),
        "sharpe":               round(float(sharpe), 3),
        "sortino":              round(sortino, 3),
        "calmar":               round(calmar, 3),
        "max_drawdown":         round(max_dd * 100, 2),
        "volatility_annualised": round(vol * 100, 2),
        "total_return":         round((final_value / initial_value - 1) * 100, 2),
        "n_trading_days":       len(equity_curve),
    }


def run_backtest(backtest_id: str) -> None:
    """
    RQ job entrypoint. Fetches backtest config, runs simulation, writes metrics.

    Strategy is interpreted as equal-weight buy-and-hold over the universe
    (v1 baseline). More sophisticated execution logic (signals, rebalancing,
    stop-loss) plugs in here in subsequent iterations.
    """
    logger.info("backtest.start", id=backtest_id)
    t0 = time.monotonic()

    try:
        _update_backtest(backtest_id, status="running", progress=5)

        # ── Load backtest config ──────────────────────────────────────────
        db = get_supabase()
        result = (
            db.schema("markets")
            .from_("backtests")
            .select("*, strategies(universe, constraints)")
            .eq("id", backtest_id)
            .single()
            .execute()
        )
        bt = result.data
        if not bt:
            raise ValueError(f"Backtest {backtest_id} not found")

        strategy = bt.get("strategies") or {}
        universe: dict = strategy.get("universe") or {}
        symbol_list: list[str] = universe.get("symbols") or []
        period_from = date.fromisoformat(bt["period_from"] or "2023-01-01")
        period_to   = date.fromisoformat(bt["period_to"]   or date.today().isoformat())
        initial_capital = float(bt.get("initial_capital") or 1_000_000)
        commission_model: dict = bt.get("commission_model") or {}
        per_trade_bps = float(commission_model.get("per_trade_bps", 3))

        if not symbol_list:
            raise ValueError("Strategy universe.symbols is empty")

        _update_backtest(backtest_id, progress=15)

        # ── Resolve instrument IDs from symbols ───────────────────────────
        instr_result = (
            db.schema("markets")
            .from_("instruments")
            .select("id, symbol, exchange")
            .in_("symbol", symbol_list)
            .eq("is_active", True)
            .execute()
        )
        instruments = instr_result.data or []
        if not instruments:
            raise ValueError(f"No instruments found for symbols: {symbol_list}")

        instrument_ids = [i["id"] for i in instruments]
        id_to_symbol = {i["id"]: i["symbol"] for i in instruments}

        _update_backtest(backtest_id, progress=25)

        # ── Load price history into Polars ────────────────────────────────
        conn = get_duckdb()
        prices_df = _load_price_history(conn, instrument_ids, period_from, period_to)
        conn.close()

        if prices_df.is_empty():
            raise ValueError("No price data found for the specified period and symbols")

        _update_backtest(backtest_id, progress=50)

        # ── v1 strategy: equal-weight buy-and-hold ────────────────────────
        # Pivot to wide format: dates × symbols, fill forward missing prices
        wide = (
            prices_df.select(["date", "instrument_id", "close"])
            .pivot(on="instrument_id", index="date", values="close")
            .sort("date")
            .fill_null(strategy="forward")
            .fill_null(strategy="backward")
        )

        n_assets = len(instrument_ids)
        if n_assets == 0:
            raise ValueError("No asset columns in pivoted data")

        # Equal weight allocation per asset
        weight = 1.0 / n_assets
        asset_cols = [c for c in wide.columns if c != "date"]

        # Compute daily portfolio value
        # Each position starts at initial_capital * weight / entry_price shares
        portfolio_values = []
        entry_prices = {col: float(wide[col][0]) for col in asset_cols if wide[col][0] is not None}

        # Apply entry commission on day 0
        entry_commission = sum(
            (initial_capital * weight) * (per_trade_bps / 10_000)
            for _ in asset_cols
        )

        for row in wide.iter_rows(named=True):
            day_value = 0.0
            for col in asset_cols:
                if col not in entry_prices or entry_prices[col] == 0:
                    continue
                n_shares = (initial_capital * weight) / entry_prices[col]
                price = row.get(col)
                if price is not None:
                    day_value += n_shares * float(price)
            portfolio_values.append(day_value - entry_commission)
            entry_commission = 0.0  # commission only on entry day

        equity_curve = pl.Series("equity", portfolio_values)
        _update_backtest(backtest_id, progress=80)

        # ── Compute metrics ───────────────────────────────────────────────
        metrics = _compute_metrics(equity_curve, period_from, period_to)
        metrics["symbols"] = [id_to_symbol.get(iid, iid) for iid in instrument_ids]
        metrics["n_assets"] = n_assets
        metrics["strategy_type"] = "equal_weight_buy_hold_v1"

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        logger.info("backtest.complete", id=backtest_id, metrics=metrics, elapsed_ms=elapsed_ms)

        _update_backtest(
            backtest_id,
            status="completed",
            progress=100,
            finished_at="now()",
            metrics=metrics,
        )

    except Exception as exc:
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        error_msg = f"{type(exc).__name__}: {exc}"
        logger.error("backtest.failed", id=backtest_id, error=error_msg, elapsed_ms=elapsed_ms)
        logger.debug("backtest.traceback", tb=traceback.format_exc())
        _update_backtest(
            backtest_id,
            status="failed",
            finished_at="now()",
            error=error_msg,
        )
        raise
