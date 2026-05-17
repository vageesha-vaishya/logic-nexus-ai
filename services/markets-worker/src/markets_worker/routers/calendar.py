"""
Economic Calendar router.

GET /v1/calendar?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&types=rbi,earnings,macro

Returns upcoming/past economic events including:
  - RBI MPC meeting dates (hardcoded 2025-2026 schedule)
  - Key macro data releases (CPI, WPI, IIP, Union Budget, GST Council)
  - Corporate earnings from markets.corporate_actions if available

No external HTTP calls required — all data is hardcoded or from Supabase.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Query

from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/calendar")

# ── RBI MPC Dates ─────────────────────────────────────────────────────────────
# Each entry: (start_date, end_date, decision_note)
_RBI_MPC_DATES: list[tuple[str, str, str]] = [
    ("2025-02-05", "2025-02-07", "Rate decision expected February 7"),
    ("2025-04-07", "2025-04-09", "Rate decision expected April 9"),
    ("2025-06-04", "2025-06-06", "Rate decision expected June 6"),
    ("2025-08-05", "2025-08-07", "Rate decision expected August 7"),
    ("2025-10-06", "2025-10-08", "Rate decision expected October 8"),
    ("2025-12-03", "2025-12-05", "Rate decision expected December 5"),
    ("2026-02-04", "2026-02-06", "Rate decision expected February 6"),
    ("2026-04-01", "2026-04-03", "Rate decision expected April 3"),
    ("2026-06-03", "2026-06-05", "Rate decision expected June 5"),
    ("2026-08-05", "2026-08-07", "Rate decision expected August 7"),
    ("2026-10-07", "2026-10-09", "Rate decision expected October 9"),
    ("2026-12-02", "2026-12-04", "Rate decision expected December 4"),
]

# ── Macro Events ──────────────────────────────────────────────────────────────
# Tuple: (date_str, title, description, importance)
_MACRO_EVENTS: list[tuple[str, str, str, str]] = [
    # Union Budgets
    ("2025-02-01", "Union Budget 2025-26", "Annual Union Budget presented by Finance Minister", "high"),
    ("2026-02-01", "Union Budget 2026-27", "Annual Union Budget presented by Finance Minister", "high"),

    # GST Council meetings — quarterly first week
    ("2025-01-06", "GST Council Meeting", "Quarterly GST Council meeting — rate revisions and policy updates", "medium"),
    ("2025-04-07", "GST Council Meeting", "Quarterly GST Council meeting — rate revisions and policy updates", "medium"),
    ("2025-07-07", "GST Council Meeting", "Quarterly GST Council meeting — rate revisions and policy updates", "medium"),
    ("2025-10-06", "GST Council Meeting", "Quarterly GST Council meeting — rate revisions and policy updates", "medium"),
    ("2026-01-05", "GST Council Meeting", "Quarterly GST Council meeting — rate revisions and policy updates", "medium"),
    ("2026-04-06", "GST Council Meeting", "Quarterly GST Council meeting — rate revisions and policy updates", "medium"),
    ("2026-07-06", "GST Council Meeting", "Quarterly GST Council meeting — rate revisions and policy updates", "medium"),
    ("2026-10-05", "GST Council Meeting", "Quarterly GST Council meeting — rate revisions and policy updates", "medium"),
]

# CPI/WPI/IIP releases — generate for 2025-2026
def _macro_monthly_events() -> list[tuple[str, str, str, str]]:
    events: list[tuple[str, str, str, str]] = []
    for year in (2025, 2026):
        for month in range(1, 13):
            # CPI on 12th
            cpi_date = date(year, month, 12)
            prev_month = date(year, month, 1) - timedelta(days=1)
            events.append((
                cpi_date.isoformat(),
                f"CPI Inflation Data ({prev_month.strftime('%b %Y')})",
                f"Consumer Price Index data for {prev_month.strftime('%B %Y')} released by MoSPI",
                "high",
            ))
            # WPI on 14th
            wpi_date = date(year, month, 14)
            events.append((
                wpi_date.isoformat(),
                f"WPI Data ({prev_month.strftime('%b %Y')})",
                f"Wholesale Price Index data for {prev_month.strftime('%B %Y')} released by DPIIT",
                "medium",
            ))
            # IIP on 12th (2-month lag — shows data from 2 months prior)
            two_months_prior = date(year, month, 1) - timedelta(days=45)
            events.append((
                cpi_date.isoformat(),
                f"IIP Data ({two_months_prior.strftime('%b %Y')})",
                f"Index of Industrial Production for {two_months_prior.strftime('%B %Y')} released by MoSPI",
                "medium",
            ))
    return events


def _build_rbi_events() -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for start_str, end_str, note in _RBI_MPC_DATES:
        d = date.fromisoformat(start_str)
        event_id = f"rbi-mpc-{d.year}-{d.month:02d}"
        events.append({
            "id": event_id,
            "date": start_str,
            "end_date": end_str,
            "title": "RBI MPC Meeting",
            "type": "rbi_mpc",
            "description": f"Monetary Policy Committee — {note}",
            "importance": "high",
            "actual": None,
            "expected": None,
            "previous": None,
        })
    return events


def _build_macro_events() -> list[dict[str, Any]]:
    all_tuples = _MACRO_EVENTS + _macro_monthly_events()
    events: list[dict[str, Any]] = []
    for date_str, title, description, importance in all_tuples:
        slug = (
            title.lower()
            .replace(" ", "-")
            .replace("(", "")
            .replace(")", "")
            .replace("/", "-")
        )
        event_id = f"macro-{date_str}-{slug[:30]}"
        events.append({
            "id": event_id,
            "date": date_str,
            "end_date": None,
            "title": title,
            "type": "macro",
            "description": description,
            "importance": importance,
            "actual": None,
            "expected": None,
            "previous": None,
        })
    return events


async def _fetch_earnings_events(
    from_date: date,
    to_date: date,
) -> list[dict[str, Any]]:
    """Try to read from markets.corporate_actions; return [] if table absent."""
    try:
        sb = get_supabase()
        resp = (
            sb.schema("markets")
            .from_("corporate_actions")
            .select("symbol,ex_date,purpose,series")
            .eq("purpose", "EARNINGS")
            .gte("ex_date", from_date.isoformat())
            .lte("ex_date", to_date.isoformat())
            .limit(200)
            .execute()
        )
        rows = resp.data or []
        events: list[dict[str, Any]] = []
        for row in rows:
            symbol = row.get("symbol", "")
            ex_date = row.get("ex_date", "")
            event_id = f"earnings-{symbol}-{ex_date}"
            events.append({
                "id": event_id,
                "date": ex_date,
                "end_date": None,
                "title": f"{symbol} Earnings",
                "type": "earnings",
                "description": f"{symbol} — quarterly results announcement",
                "importance": "medium",
                "actual": None,
                "expected": None,
                "previous": None,
            })
        return events
    except Exception as exc:
        logger.debug("calendar.earnings_fetch_skipped", reason=str(exc))
        return []


# ── Route ─────────────────────────────────────────────────────────────────────


@router.get("")
async def get_calendar(
    from_date: str = Query(
        default="",
        description="Start date YYYY-MM-DD (defaults to today)",
    ),
    to_date: str = Query(
        default="",
        description="End date YYYY-MM-DD (defaults to 3 months from today)",
    ),
    types: str = Query(
        default="rbi,earnings,macro",
        description="Comma-separated event types to include",
    ),
):
    """Return economic calendar events filtered by date range and event types."""
    today = date.today()

    try:
        fd = date.fromisoformat(from_date) if from_date else today.replace(day=1)
    except ValueError:
        fd = today.replace(day=1)

    try:
        td = date.fromisoformat(to_date) if to_date else today + timedelta(days=90)
    except ValueError:
        td = today + timedelta(days=90)

    requested_types = {t.strip().lower() for t in types.split(",")}

    all_events: list[dict[str, Any]] = []

    if "rbi" in requested_types or "rbi_mpc" in requested_types:
        all_events.extend(_build_rbi_events())

    if "macro" in requested_types:
        all_events.extend(_build_macro_events())

    if "earnings" in requested_types:
        earnings = await _fetch_earnings_events(fd, td)
        all_events.extend(earnings)

    # Filter by date range
    filtered: list[dict[str, Any]] = []
    for evt in all_events:
        try:
            evt_date = date.fromisoformat(evt["date"])
            if fd <= evt_date <= td:
                filtered.append(evt)
        except (ValueError, KeyError):
            pass

    # Sort ascending by date
    filtered.sort(key=lambda e: e["date"])

    return {"events": filtered}
