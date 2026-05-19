"""
Command-line entrypoints for cron-driven retail jobs.

Runs without Redis/RQ — direct synchronous invocations that a Hostinger
crontab can call daily. For RQ-backed scheduling see scheduler.py.

Usage (from a cron / systemd timer):

  # Daily universe signal generation (08:00 IST, 30 min before market open):
  30 2 * * 1-5  cd /srv/markets-worker \\
                && .venv/bin/python -m markets_worker.cli signals:daily

  # Weekend price backfill (sat 23:00 UTC):
  0  23 * * 6   cd /srv/markets-worker \\
                && .venv/bin/python -m markets_worker.cli prices:backfill --days 30

Times above are UTC; convert to IST as needed.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date, datetime, timedelta, timezone

import structlog

from markets_worker.db import get_supabase

logger = structlog.get_logger()


# ── signals:daily ──────────────────────────────────────────────────────────────

async def _run_universe_signals(min_bars: int) -> dict[str, int]:
    """Run the LangGraph signal pipeline on every NSE equity with enough bars.

    Reuses the same per-instrument entrypoint the per-portfolio jobs use, so
    behaviour (LLM scoring + explanation layer + persist) stays in one place.
    """
    from markets_worker.jobs.signal_generator import _run_for_instrument

    db = get_supabase()
    instruments = (
        db.schema("markets").from_("instruments")
        .select("id, symbol")
        .eq("exchange", "NSE")
        .in_("instrument_type", ["equity", "EQ"])
        .execute()
    ).data or []

    # Filter to instruments with >= min_bars of price history. Per-instrument
    # HEAD count avoids pulling the whole price_history table.
    targets: list[dict] = []
    for inst in instruments:
        res = (
            db.schema("markets").from_("price_history")
            .select("instrument_id", count="exact", head=True)
            .eq("instrument_id", inst["id"])
            .execute()
        )
        if (res.count or 0) >= min_bars:
            targets.append(inst)

    # Tenant/franchise/owner are required NOT NULL on markets.signals; pick the
    # first active platform tenant as the home for universe-level rows.
    tenant_row = (
        db.schema("markets").from_("signals")
        .select("tenant_id, franchise_id, owner_user_id")
        .not_.is_("tenant_id", "null")
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not tenant_row or not tenant_row.data:
        raise RuntimeError(
            "No tenant context found in markets.signals — seed at least one "
            "signal manually (or extend this CLI to read platform.tenants) "
            "before running signals:daily.",
        )
    tenant_id    = tenant_row.data["tenant_id"]
    franchise_id = tenant_row.data["franchise_id"]
    owner_id     = tenant_row.data["owner_user_id"]

    counts = {"total": len(targets), "high_conviction": 0, "errors": 0}

    for inst in targets:
        try:
            result = await _run_for_instrument(
                instrument_id=inst["id"],
                symbol=inst["symbol"],
                exchange="NSE",
                instrument_type="EQ",
                asset_class_db="equity",
                option_type=None, expiry=None, strike=None, underlying_id=None, lot_size=None,
                portfolio_id=None,
                tenant_id=tenant_id,
                franchise_id=franchise_id,
                owner_user_id=owner_id,
            )
            conf = float(result.get("confidence") or 0)
            if conf >= 0.60 and result.get("signal_type") != "hold":
                counts["high_conviction"] += 1
        except Exception as exc:
            counts["errors"] += 1
            logger.warning("signals.daily.instrument_failed",
                           symbol=inst["symbol"], error=str(exc))

    return counts


def cmd_signals_daily(args: argparse.Namespace) -> int:
    logger.info("cli.signals.daily.start", min_bars=args.min_bars)
    counts = asyncio.run(_run_universe_signals(args.min_bars))
    logger.info("cli.signals.daily.done", **counts)
    print(
        f"signals:daily — {counts['total']} instruments processed, "
        f"{counts['high_conviction']} high-conviction non-hold, "
        f"{counts['errors']} errors",
    )
    return 0 if counts["errors"] == 0 else 1


# ── prices:backfill ────────────────────────────────────────────────────────────

def cmd_prices_backfill(args: argparse.Namespace) -> int:
    """Backfill OHLC from yfinance for all NSE equities (or one symbol)."""
    from markets_worker.jobs.price_ingest import ingest_one

    db = get_supabase()
    if args.symbol:
        rows = (
            db.schema("markets").from_("instruments")
            .select("id, symbol")
            .eq("exchange", "NSE")
            .eq("symbol", args.symbol)
            .execute()
        ).data or []
    else:
        rows = (
            db.schema("markets").from_("instruments")
            .select("id, symbol")
            .eq("exchange", "NSE")
            .in_("instrument_type", ["equity", "EQ"])
            .execute()
        ).data or []

    start = date.today() - timedelta(days=args.days)
    end   = date.today()
    ok = skipped = 0
    for r in rows:
        if not (2 <= len(r["symbol"]) <= 12):
            skipped += 1
            continue
        result = ingest_one(r["id"], r["symbol"], "NSE", None, start, end)
        if result["rows_written"] > 0:
            ok += 1
        else:
            skipped += 1
    logger.info("cli.prices.backfill.done",
                instruments=len(rows), backfilled=ok, skipped=skipped, days=args.days)
    print(
        f"prices:backfill — {ok} instruments backfilled, "
        f"{skipped} skipped (delisted or unknown ticker)",
    )
    return 0


# ── argparse wiring ────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="markets-worker", description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)

    p_sig = sub.add_parser(
        "signals:daily",
        help="Run the LangGraph signal pipeline on every NSE equity with enough history.",
    )
    p_sig.add_argument("--min-bars", type=int, default=100,
                      help="Skip instruments with fewer than this many price bars (default 100).")
    p_sig.set_defaults(func=cmd_signals_daily)

    p_bf = sub.add_parser(
        "prices:backfill",
        help="Backfill OHLC from yfinance.",
    )
    p_bf.add_argument("--days", type=int, default=730,
                     help="Lookback window in days (default 730 = 2 years).")
    p_bf.add_argument("--symbol", type=str, default=None,
                     help="Optional: backfill a single symbol only.")
    p_bf.set_defaults(func=cmd_prices_backfill)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
