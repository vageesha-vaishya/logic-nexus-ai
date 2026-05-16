"""
Price Data Ingest — fetches OHLCV from Yahoo Finance for all NSE/BSE instruments.

Resolution chain:
  1. NSE EQUITY_L.csv (ISIN → official NSE symbol) — downloaded once, cached
  2. ICICI Direct short-code alias map (for known ICICI-to-NSE mismatches)
  3. Try {symbol}.NS  (NSE)
  4. Try {symbol}.BO  (BSE fallback)
  5. Skip + log warning

Fetches 2 years of daily OHLCV by default, upserts into markets.price_history.
Also updates instruments.metadata with the resolved Yahoo Finance ticker.

RQ job entry-points:
  ingest_prices_for_portfolio(portfolio_id, lookback_days=730)
  ingest_prices_for_instruments(instrument_ids, lookback_days=730)
  refresh_prices_for_portfolio(portfolio_id)     — last 7 days only
"""

from __future__ import annotations

import csv
import io
import time
from datetime import date, timedelta
from typing import Any

import httpx
import structlog
import yfinance as yf

from markets_worker.db import get_supabase

logger = structlog.get_logger()

# ── ICICI Direct short-code → NSE official symbol ────────────────────────────
# These are cases where ICICI truncates/mangles the NSE ticker.
ICICI_TO_NSE: dict[str, str] = {
    "HCLTEC":  "HCLTECH",
    "TECMAH":  "TECHM",
    "TATSTE":  "TATASTEEL",
    "RELIND":  "RELIANCE",
    "ASIPAI":  "ASIANPAINT",
    "GLEPHA":  "GLENMARK",
    "EXIIND":  "EXIDEIND",
    "MORLAB":  "MOREPENLAB",
    "GRANUL":  "GRANULES",
    "AMAREM":  "AMARARAJA",      # Amara Raja Energy & Mobility
    "BORGLA":  "BORORENEW",      # Borosil Renewables Ltd (NOT Borosil Ltd)
    "IDFBAN":  "IDFCFIRSTB",
    "YESBAN":  "YESBANK",
    "TRITUR":  "TRITURBINE",
    "TRILTD":  "TRIDENT",        # Trident Ltd (NOT Triveni Engineering)
    "ZEELEA":  "ZEELEARN",
    "ZEEMED":  "ZEEMEDIA",
    # AADVEN = Aadhaar Ventures India Ltd (≠ Aadhaar HFL) — try direct
    "ITCHOT":  "ITCHOTELS",
    # PENMER = Platinum Corporation Ltd (≠ Pennar Industries) — try direct
    "REPHOM":  "REPCOHOME",      # Repco Home Finance Ltd
    "JIOFIN":  "JIOFIN",
    # KAARAD = Kaashyap Technologies Ltd (≠ Karur Vysya Bank) — try direct
    "SITCAB":  "SITI",           # Siti Networks Ltd
    # DILMED = Diligent Media Corporation Ltd — try direct
    "GLOTEC":  "GLODYNE",        # Glodyne Technoserve Ltd
    # TELDAT = Tele Data Informatics Ltd (≠ Tata Elxsi) — try direct
    "TELMAR":  "TELEMAR",        # Teledata Marine Solutions — try direct
    # TELTEC = Teledata Technology Solutions — try direct
    "GOLDEX":  "GOLDBEES",       # Nippon India ETF Gold BeES
}

# Extended fallback: try multiple aliases for stubborn tickers
ICICI_EXTRA_ALIASES: dict[str, list[str]] = {
    "AMAREM":  ["AMARARAJA", "AMARAJABAT"],   # renamed; try both
    "AADVEN":  ["AADVEN"],                     # Aadhaar Ventures India Ltd
    "TATSTE":  ["TATASTEEL", "TATASTEEL.NS"],
    "TECMAH":  ["TECHM", "TECHM.NS"],
    "DILMED":  ["DILMED", "DMED"],             # Diligent Media Corp
    "SITCAB":  ["SITI", "SITINETW"],           # Siti Networks
    "GLOTEC":  ["GLODYNE", "GLOTEC"],          # Glodyne Technoserve
    "TELDAT":  ["TELDATA", "TELEDATA", "TELDAT"],  # Tele Data Informatics
    "TELMAR":  ["TELEMAR", "TELMAR"],          # Teledata Marine Solutions
    "TELTEC":  ["TELTEC", "TELETECH"],         # Teledata Technology Solutions (NOT TATAINVEST)
    "PENMER":  ["PLATINCORP", "PENMER"],       # Platinum Corporation Ltd
    "REPHOM":  ["REPCOHOME", "REPCO"],         # Repco Home Finance
    "BORGLA":  ["BORORENEW", "BORRENEW"],      # Borosil Renewables
    "KAARAD":  ["KAASHYAP", "KAARAD"],         # Kaashyap Technologies Ltd
    "GOLDEX":  ["GOLDBEES", "NIPPONIGOLD"],    # Nippon India ETF Gold BeES
    "TRILTD":  ["TRIDENT", "TRIDENTLTD"],      # Trident Ltd
}

# ISINs that are MF/ETF — fetch NAV separately via AMFI (not yfinance equity)
MF_ISINS: set[str] = {
    "INF204KB17I5",   # HDFC Gold ETF / similar
}

# NSE master CSV URLs — equity + ETF securities lists
_NSE_CSV_URLS = [
    "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
    "https://archives.nseindia.com/content/fo/fo_mktlots.csv",   # F&O universe
]

# Module-level cache — populated once per worker process lifetime
_isin_cache: dict[str, str] | None = None
_isin_cache_loaded: bool = False   # track whether we've attempted load


def _fetch_nse_symbol_master() -> dict[str, str]:
    """Download NSE's equity list and return {ISIN: NSE_SYMBOL} map."""
    global _isin_cache, _isin_cache_loaded
    if _isin_cache_loaded:
        return _isin_cache or {}

    _isin_cache_loaded = True   # prevent re-attempts even on failure
    isin_map: dict[str, str] = {}
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.nseindia.com/",
    }
    for url in _NSE_CSV_URLS:
        try:
            r = httpx.get(url, headers=headers, timeout=30, follow_redirects=True)
            if not r.is_success:
                continue
            reader = csv.DictReader(io.StringIO(r.text))
            for row in reader:
                symbol = (row.get("SYMBOL") or row.get("Symbol") or "").strip()
                isin   = (row.get("ISIN NUMBER") or row.get("ISIN") or "").strip()
                if symbol and isin:
                    isin_map[isin] = symbol
        except Exception as exc:
            logger.warning("nse_master.fetch_failed", url=url, error=str(exc))

    _isin_cache = isin_map
    logger.info("nse_master.loaded", count=len(isin_map))
    return isin_map


def _resolve_ticker(symbol: str, exchange: str, isin: str | None) -> list[str]:
    """
    Return ordered list of Yahoo Finance tickers to try for this instrument.
    First hit with data wins.
    """
    seen: set[str] = set()
    candidates: list[str] = []

    def _add(t: str) -> None:
        if t not in seen:
            seen.add(t)
            candidates.append(t)

    # 1. NSE symbol master via ISIN (most reliable)
    if isin and isin not in MF_ISINS:
        nse_map = _fetch_nse_symbol_master()
        nse_sym = nse_map.get(isin)
        if nse_sym:
            _add(f"{nse_sym}.NS")

    # 2. Primary ICICI alias
    alias = ICICI_TO_NSE.get(symbol.upper())
    if alias:
        _add(f"{alias}.NS")

    # 3. Extended extra aliases (multiple fallbacks per symbol)
    for extra in ICICI_EXTRA_ALIASES.get(symbol.upper(), []):
        _add(f"{extra}.NS")

    # 4. Direct symbol on NSE
    _add(f"{symbol}.NS")

    # 5. Direct symbol on BSE (last resort)
    _add(f"{symbol}.BO")
    if alias:
        _add(f"{alias}.BO")

    return candidates


def _yf_fetch(ticker: str, start: date, end: date) -> list[dict]:
    """Fetch OHLCV from Yahoo Finance for one ticker. Returns [] on failure."""
    try:
        t = yf.Ticker(ticker)
        hist = t.history(
            start=start.isoformat(),
            end=end.isoformat(),
            auto_adjust=True,
            back_adjust=False,
        )
        if hist is None or hist.empty:
            return []
        rows = []
        for ts, row in hist.iterrows():
            rows.append({
                "ts":     ts.strftime("%Y-%m-%dT00:00:00+00:00"),
                "open":   round(float(row["Open"]),   4),
                "high":   round(float(row["High"]),   4),
                "low":    round(float(row["Low"]),    4),
                "close":  round(float(row["Close"]),  4),
                "volume": int(row.get("Volume") or 0),
                "source": f"yfinance/{ticker}",
            })
        return rows
    except Exception as exc:
        logger.debug("yfinance.fetch_error", ticker=ticker, error=str(exc))
        return []


def _fetch_amfi_nav(isin: str, start: date, end: date) -> list[dict]:
    """Fetch MF NAV history from AMFI for Gold ETFs / MF ISINs."""
    try:
        url = "https://api.mfapi.in/mf/search"
        r = httpx.get(url, params={"q": isin}, timeout=15)
        r.raise_for_status()
        results = r.json()
        if not results:
            return []
        scheme_code = results[0].get("schemeCode")
        if not scheme_code:
            return []

        detail_url = f"https://api.mfapi.in/mf/{scheme_code}"
        dr = httpx.get(detail_url, timeout=30)
        dr.raise_for_status()
        data = dr.json().get("data", [])

        rows = []
        for entry in data:
            try:
                d = date.fromisoformat(
                    entry["date"].split("-")[-1] + "-" +
                    entry["date"].split("-")[1] + "-" +
                    entry["date"].split("-")[0]
                    if len(entry["date"].split("-")[0]) == 2
                    else entry["date"]
                )
            except Exception:
                continue
            if d < start or d > end:
                continue
            nav = float(entry.get("nav", 0))
            if nav <= 0:
                continue
            rows.append({
                "ts":     d.strftime("%Y-%m-%dT00:00:00+00:00"),
                "open":   nav, "high": nav, "low": nav, "close": nav,
                "volume": 0,
                "source": "amfi",
            })
        return rows
    except Exception as exc:
        logger.warning("amfi.nav_fetch_failed", isin=isin, error=str(exc))
        return []


def _upsert_prices(instrument_id: str, rows: list[dict]) -> int:
    """Upsert OHLCV rows into markets.price_history. Returns count written."""
    if not rows:
        return 0
    db = get_supabase()
    records = [{"instrument_id": instrument_id, **r} for r in rows]

    # Batch in chunks of 500 to stay within Supabase payload limits
    written = 0
    for i in range(0, len(records), 500):
        chunk = records[i : i + 500]
        try:
            db.schema("markets").from_("price_history").upsert(
                chunk, on_conflict="instrument_id,ts"
            ).execute()
            written += len(chunk)
        except Exception as exc:
            logger.warning("price_history.upsert_failed", error=str(exc))
    return written


def _cache_resolved_ticker(instrument_id: str, ticker: str) -> None:
    """Store the resolved Yahoo Finance ticker in instruments.metadata."""
    try:
        db = get_supabase()
        db.schema("markets").from_("instruments").update(
            {"metadata": {"yf_ticker": ticker}}
        ).eq("id", instrument_id).execute()
    except Exception:
        pass


# ── Core per-instrument ingest ────────────────────────────────────────────────

def ingest_one(
    instrument_id: str,
    symbol:        str,
    exchange:      str,
    isin:          str | None,
    start:         date,
    end:           date,
) -> dict[str, Any]:
    """Resolve ticker, fetch history, upsert. Returns result summary dict."""
    result: dict[str, Any] = {
        "instrument_id": instrument_id,
        "symbol":        symbol,
        "ticker":        None,
        "rows_written":  0,
        "error":         None,
    }

    # MF/ETF — use AMFI NAV
    if isin and isin in MF_ISINS:
        rows = _fetch_amfi_nav(isin, start, end)
        if rows:
            result["rows_written"] = _upsert_prices(instrument_id, rows)
            result["ticker"] = f"amfi/{isin}"
            logger.info("price_ingest.mf_ok", symbol=symbol, rows=result["rows_written"])
        else:
            result["error"] = "amfi_no_data"
            logger.warning("price_ingest.mf_skip", symbol=symbol, isin=isin)
        return result

    # Equity — try Yahoo Finance ticker candidates
    candidates = _resolve_ticker(symbol, exchange, isin)
    for ticker in candidates:
        rows = _yf_fetch(ticker, start, end)
        if rows:
            result["ticker"] = ticker
            result["rows_written"] = _upsert_prices(instrument_id, rows)
            _cache_resolved_ticker(instrument_id, ticker)
            logger.info("price_ingest.ok", symbol=symbol, ticker=ticker,
                        rows=result["rows_written"])
            return result
        time.sleep(0.15)  # be gentle with Yahoo Finance rate limits

    result["error"] = f"no_data_from_any_ticker: {candidates}"
    logger.warning("price_ingest.skip", symbol=symbol, tried=candidates)
    return result


# ── RQ job entrypoints ────────────────────────────────────────────────────────

def ingest_prices_for_portfolio(
    portfolio_id:  str,
    lookback_days: int = 730,   # 2 years default
) -> dict[str, Any]:
    """
    RQ job: fetch and store historical OHLCV for all holdings in a portfolio.
    Called via: queue.enqueue(ingest_prices_for_portfolio, portfolio_id)
    """
    db     = get_supabase()
    end    = date.today()
    start  = end - timedelta(days=lookback_days)

    holdings_res = (
        db.schema("markets").from_("holdings")
        .select("instrument_id, instruments!inner(symbol, exchange, isin, metadata)")
        .eq("portfolio_id", portfolio_id)
        .gt("qty", 0)
        .execute()
    )
    holdings = holdings_res.data or []
    if not holdings:
        return {"ingested": 0, "portfolio_id": portfolio_id}

    results = []
    for h in holdings:
        instr = h.get("instruments") or {}
        symbol = instr.get("symbol", "")
        isin   = instr.get("isin")

        # Skip if already has enough data (avoid re-fetching full 2 years)
        meta = instr.get("metadata") or {}
        existing_ticker = meta.get("yf_ticker")
        if existing_ticker:
            # Only fetch the last 10 days to keep fresh
            row_check = (
                db.schema("markets").from_("price_history")
                .select("ts", count="exact")
                .eq("instrument_id", h["instrument_id"])
                .execute()
            )
            if (row_check.count or 0) >= 200:
                # Full history present — do a 7-day refresh instead
                fresh_start = end - timedelta(days=10)
                r = ingest_one(h["instrument_id"], symbol, instr.get("exchange","NSE"),
                               isin, fresh_start, end)
                r["mode"] = "refresh"
                results.append(r)
                continue

        r = ingest_one(h["instrument_id"], symbol,
                       instr.get("exchange", "NSE"), isin, start, end)
        r["mode"] = "full"
        results.append(r)

    ok    = [r for r in results if not r["error"]]
    fails = [r for r in results if r["error"]]

    logger.info("price_ingest.portfolio_done",
                portfolio_id=portfolio_id,
                ok=len(ok), failed=len(fails),
                total_rows=sum(r["rows_written"] for r in ok))

    return {
        "portfolio_id":  portfolio_id,
        "total":         len(results),
        "ingested":      len(ok),
        "failed":        len(fails),
        "total_rows":    sum(r["rows_written"] for r in ok),
        "failures":      [{"symbol": r["symbol"], "error": r["error"]} for r in fails],
        "results":       results,
    }


def ingest_prices_for_instruments(
    instrument_ids: list[str],
    lookback_days:  int = 730,
) -> dict[str, Any]:
    """RQ job: fetch OHLCV for a specific list of instrument IDs."""
    db    = get_supabase()
    end   = date.today()
    start = end - timedelta(days=lookback_days)

    instr_res = (
        db.schema("markets").from_("instruments")
        .select("id, symbol, exchange, isin")
        .in_("id", instrument_ids)
        .execute()
    )
    instruments = instr_res.data or []

    results = [
        ingest_one(i["id"], i["symbol"], i.get("exchange","NSE"), i.get("isin"), start, end)
        for i in instruments
    ]
    ok = [r for r in results if not r["error"]]
    return {
        "total": len(results), "ingested": len(ok),
        "total_rows": sum(r["rows_written"] for r in ok),
        "results": results,
    }


def refresh_prices_for_portfolio(portfolio_id: str) -> dict[str, Any]:
    """RQ job: fetch the last 30 days only — for daily scheduled refresh."""
    db    = get_supabase()
    end   = date.today()
    start = end - timedelta(days=30)

    holdings_res = (
        db.schema("markets").from_("holdings")
        .select("instrument_id, instruments!inner(symbol, exchange, isin)")
        .eq("portfolio_id", portfolio_id)
        .gt("qty", 0)
        .execute()
    )
    holdings = holdings_res.data or []
    results = []
    for h in holdings:
        instr = h.get("instruments") or {}
        r = ingest_one(h["instrument_id"], instr.get("symbol",""),
                       instr.get("exchange","NSE"), instr.get("isin"), start, end)
        results.append(r)

    ok = [r for r in results if not r["error"]]
    logger.info("price_refresh.done", portfolio_id=portfolio_id,
                ok=len(ok), failed=len(results) - len(ok))
    return {"portfolio_id": portfolio_id, "refreshed": len(ok),
            "total_rows": sum(r["rows_written"] for r in ok)}
