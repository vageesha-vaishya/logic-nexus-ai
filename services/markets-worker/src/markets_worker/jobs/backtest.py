"""
RQ job wrapper for the backtest engine.

Entry point: run_backtest_job(backtest_id)
  1. Load backtest + strategy rows from DB
  2. Fetch price history for all universe symbols
  3. Run the engine (buy_and_hold or rule_based)
  4. Write metrics + equity curve + equity dates to backtests.metrics
  5. Update status → completed | failed
"""

from __future__ import annotations

import traceback
from datetime import date, datetime, timezone

import polars as pl
import structlog

from markets_worker.db import get_supabase
from markets_worker.jobs.backtest_engine import BacktestParams, run_backtest as _run_engine

logger = structlog.get_logger()

_MAX_BARS = 800   # per symbol — ~3 years @ 252 trading days/yr


def _set_status(
    db, backtest_id: str, status: str, progress: int = 0,
    metrics: dict | None = None, error: str | None = None, finished: bool = False
) -> None:
    upd: dict = {"status": status, "progress": progress}
    if metrics is not None:
        upd["metrics"] = metrics
    if error is not None:
        upd["error"] = error[:2000]
    if finished:
        upd["finished_at"] = datetime.now(timezone.utc).isoformat()
    try:
        db.schema("markets").from_("backtests").update(upd).eq("id", backtest_id).execute()
    except Exception as exc:
        logger.error("backtest.status_update_failed", error=str(exc))


def _downsample(lst: list, n: int) -> list:
    if len(lst) <= n:
        return lst
    step = len(lst) / n
    return [lst[int(i * step)] for i in range(n)]


def run_backtest(backtest_id: str) -> dict:
    """RQ job entry point — called by the router as markets_worker.jobs.backtest.run_backtest."""
    db = get_supabase()
    _set_status(db, backtest_id, "running", progress=5)

    try:
        # ── 1. Load backtest row ────────────────────────────────────────────
        bt_res = (
            db.schema("markets").from_("backtests")
            .select(
                "id, strategy_id, period_from, period_to, "
                "initial_capital, commission_model, params"
            )
            .eq("id", backtest_id)
            .maybe_single().execute()
        )
        bt = bt_res.data
        if not bt:
            _set_status(db, backtest_id, "failed",
                        error="Backtest record not found", finished=True)
            return {"backtest_id": backtest_id, "status": "failed"}

        # ── 2. Load strategy ────────────────────────────────────────────────
        strat_res = (
            db.schema("markets").from_("strategies")
            .select("id, name, dsl, universe")
            .eq("id", bt["strategy_id"])
            .maybe_single().execute()
        )
        strat = strat_res.data
        if not strat:
            _set_status(db, backtest_id, "failed",
                        error="Strategy not found", finished=True)
            return {"backtest_id": backtest_id, "status": "failed"}

        _set_status(db, backtest_id, "running", progress=15)

        # ── 3. Resolve universe symbols ─────────────────────────────────────
        universe = strat.get("universe") or bt.get("params", {}).get("universe") or {}
        symbols: list[str] = universe.get("symbols", [])
        exchange: str = universe.get("exchange", "NSE")

        if not symbols:
            _set_status(db, backtest_id, "failed",
                        error="Strategy has no universe symbols defined. "
                              "Edit the strategy and add symbols to the universe.",
                        finished=True)
            return {"backtest_id": backtest_id, "status": "failed"}

        # ── 4. Resolve instrument IDs ───────────────────────────────────────
        instr_res = (
            db.schema("markets").from_("instruments")
            .select("id, symbol")
            .in_("symbol", symbols)
            .eq("exchange", exchange)
            .execute()
        )
        instr_rows = instr_res.data or []
        sym_to_id  = {row["symbol"]: row["id"] for row in instr_rows}
        known_ids  = list(sym_to_id.values())

        if not known_ids:
            _set_status(db, backtest_id, "failed",
                        error=f"No instruments found for {symbols[:5]} on {exchange}.",
                        finished=True)
            return {"backtest_id": backtest_id, "status": "failed"}

        _set_status(db, backtest_id, "running", progress=30)

        # ── 5. Fetch price history ──────────────────────────────────────────
        period_from = date.fromisoformat(bt["period_from"])
        period_to   = date.fromisoformat(bt["period_to"])

        price_res = (
            db.schema("markets").from_("price_history")
            .select("instrument_id, ts, close")
            .in_("instrument_id", known_ids)
            .gte("ts", period_from.isoformat())
            .lte("ts", period_to.isoformat())
            .order("ts", desc=False)
            .limit(_MAX_BARS * len(known_ids))
            .execute()
        )
        price_rows = price_res.data or []

        if not price_rows:
            _set_status(db, backtest_id, "failed",
                        error="No price history found for the selected period and universe. "
                              "Run 'Fetch Prices' from the Signals page first.",
                        finished=True)
            return {"backtest_id": backtest_id, "status": "failed"}

        _set_status(db, backtest_id, "running", progress=50)

        id_to_sym = {v: k for k, v in sym_to_id.items()}

        records = []
        for r in price_rows:
            sym = id_to_sym.get(r["instrument_id"])
            if not sym:
                continue
            ts_raw = r["ts"]
            if isinstance(ts_raw, str):
                ts_val = date.fromisoformat(ts_raw[:10])
            elif hasattr(ts_raw, "date"):
                ts_val = ts_raw.date()
            else:
                ts_val = ts_raw
            records.append({"symbol": sym, "ts": ts_val, "close": float(r["close"])})

        if not records:
            _set_status(db, backtest_id, "failed",
                        error="Price data could not be parsed.", finished=True)
            return {"backtest_id": backtest_id, "status": "failed"}

        price_df = pl.DataFrame(records).sort(["symbol", "ts"])

        _set_status(db, backtest_id, "running", progress=60)

        # ── 6. Run engine ───────────────────────────────────────────────────
        params = BacktestParams(
            strategy_id      = bt["strategy_id"],
            strategy_name    = strat.get("name", ""),
            dsl_raw          = strat.get("dsl"),
            universe_symbols = symbols,
            period_from      = period_from,
            period_to        = period_to,
            initial_capital  = float(bt.get("initial_capital", 1_000_000)),
            commission_model = bt.get("commission_model") or {"pct": 0.05},
        )

        result = _run_engine(params, price_df)

        _set_status(db, backtest_id, "running", progress=90)

        # ── 7. Persist ──────────────────────────────────────────────────────
        if result.error:
            _set_status(db, backtest_id, "failed",
                        error=result.error, finished=True)
            return {"backtest_id": backtest_id, "status": "failed", "error": result.error}

        full_metrics = {
            **result.metrics,
            "equity_curve": _downsample(result.equity_curve, 500),
            "equity_dates": _downsample(result.dates, 500),
            "symbols_used": result.symbols_used,
        }

        _set_status(db, backtest_id, "completed",
                    progress=100, metrics=full_metrics, finished=True)

        logger.info(
            "backtest.job_done",
            backtest_id  = backtest_id,
            strategy     = strat.get("name"),
            total_return = result.metrics.get("total_return"),
            sharpe       = result.metrics.get("sharpe"),
            n_trades     = result.metrics.get("n_trades"),
        )
        return {"backtest_id": backtest_id, "status": "completed", "metrics": full_metrics}

    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("backtest.job_error", backtest_id=backtest_id, error=str(exc))
        _set_status(db, backtest_id, "failed",
                    error=f"{exc}\n{tb[:800]}", finished=True)
        return {"backtest_id": backtest_id, "status": "failed", "error": str(exc)}
