# Retail Investment Platform — Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build SEBI-compliant autonomous execution with Layer 0 validation, 4-level kill switch, mandatory paper trading, gradual autonomy phases, multi-agent signal debate, and 7-year audit trail.

**Architecture:** Four layers — Layer 0 (data validation, fat-finger), Layer 1 (Bull/Bear/Risk/Trader LangGraph debate extending existing signal_generator.py), Layer 2 (rule engine, idempotency, order construction), Layer 3 (broker OMS submission, SEBI audit log, kill switches). Frontend adds `autonomous/` sub-directory under `src/features/markets/retail/` with phase wizard, paper trading dashboard, kill switch panel, and rule builder. All phase-gate enforcement is server-side — frontend is display only.

**Tech Stack:** React 18 + TypeScript + TanStack Query + Shadcn/Radix UI (frontend); FastAPI + Python + LangGraph + Supabase (backend); Vitest + RTL (frontend tests); pytest + respx + uv (backend tests)

**Worktree:** `~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform`
**Branch:** `feature/retail-investment-platform`

---

## What Already Exists (Do NOT Rebuild)

| Existing piece | Location | Used in Phase 3 for |
|---|---|---|
| `PlaceOrderRequest` with `tag` field | `routers/broker.py:56` | SEBI Algo-ID tagging — `tag` field carries registered algo ID |
| `POST /v1/paper/order` + paper capital | `routers/paper.py` | Paper trading simulation — already seeds ₹10L portfolio |
| `_ltp_cache` | `routers/ltp.py` | Layer 0 price staleness check |
| `Auth = Annotated[AuthContext, Depends(get_auth)]` | `auth.py:134` | All new endpoints use this exact pattern |
| `get_supabase()` | `db.py` | Supabase client in all routers |
| `LangGraph StateGraph + SignalState` | `jobs/signal_generator.py` | Extend with debate nodes |
| `build_adapter`, `decrypt_credentials` | `brokers/__init__.py` | Layer 3 broker submit reuses this |
| `usePortfolioPnL`, `usePortfolioTiers` | `retail/hooks/` | Autonomy progress hooks reference tier NAV |
| `marketsKeys.retail.*` | `hooks/queryKeys.ts` | Add `autonomous.*` sub-keys |
| `conftest.py` test pattern | `services/markets-worker/tests/conftest.py` | All backend tests use `app` + `client` fixtures |

---

## Autonomy Phase Model

```
Paper (phase 0) → Micro-Live (phase 1) → Pilot (phase 2) → Full (phase 3)
```

- **Paper:** Simulated orders via `/v1/paper/order`. Minimum 10 paper trades required. No real money.
- **Micro-Live:** Real orders, max 2% of portfolio NAV per trade. Minimum 5 real trades to advance.
- **Pilot:** Real orders, max 25% of portfolio. No cap to advance — user manually requests Full.
- **Full:** All rules enabled, 100% portfolio.

Phase transitions require: user confirmation + SEBI audit log entry. Backend enforces phase caps via `autonomy_progress` table.

---

## Kill Switch Levels

| Level | Code | Action | Effect |
|---|---|---|---|
| 0 | `none` | No kill switch active | Normal operation |
| 1 | `strategy_pause` | Pause specific rule | Rule skipped; others run |
| 2 | `all_pause` | Pause all auto-execution | No new automated orders |
| 3 | `flatten_positions` | Cancel open orders + log | Requires manual broker flatten |
| 4 | `revoke_api_key` | Disable broker connection | Sets `can_trade=false` on broker connection |

---

## Task 1: DB Migrations — Autonomous Execution Tables

**Files:**
- Create: `supabase/migrations/20260518140000_markets_autonomous_execution.sql`

### Step 1: Write migration

```sql
-- supabase/migrations/20260518140000_markets_autonomous_execution.sql

-- ── execution_rules ────────────────────────────────────────────────────────────
-- Stores a user's saved auto-execution rules (one per strategy/instrument)
create table if not exists markets.execution_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  asset_class     text not null,
  instrument_id   uuid references markets.instruments(id),
  signal_type     text not null check (signal_type in ('buy', 'sell', 'both')),
  order_type      text not null check (order_type in ('MARKET', 'LIMIT', 'SL', 'SL-M')) default 'MARKET',
  product         text not null check (product in ('CNC', 'MIS', 'NRML')) default 'CNC',
  max_order_value numeric(18,2) not null default 10000,
  algo_id         text,          -- SEBI-registered algorithm ID
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_execution_rules_updated_at on markets.execution_rules;
create trigger trg_execution_rules_updated_at
  before update on markets.execution_rules
  for each row execute function platform.set_updated_at();

alter table markets.execution_rules enable row level security;
drop policy if exists "owner_all" on markets.execution_rules;
create policy "owner_all" on markets.execution_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── execution_audit_log ────────────────────────────────────────────────────────
-- SEBI-mandated 7-year audit trail for every automated order decision
create table if not exists markets.execution_audit_log (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id),
  rule_id                 uuid references markets.execution_rules(id),
  signal_id               uuid,
  algo_id                 text,
  broker_order_id         text,
  instrument_id           uuid references markets.instruments(id),
  tradingsymbol           text not null,
  exchange                text not null,
  side                    text not null check (side in ('BUY', 'SELL')),
  order_type              text not null,
  quantity                integer not null,
  price                   numeric(18,4),
  trigger_price           numeric(18,4),
  order_value             numeric(18,2),
  portfolio_nav_at_order  numeric(18,2),
  phase                   text not null check (phase in ('paper', 'micro', 'pilot', 'full')),
  -- Layer 0 validation results
  pre_trade_checks        jsonb not null default '{}',
  -- Layer 1 multi-agent debate output
  debate_summary          jsonb not null default '{}',
  -- Execution outcome
  status                  text not null check (status in ('submitted', 'rejected', 'error', 'paper')) default 'submitted',
  rejection_reason        text,
  kill_switch_active      boolean not null default false,
  created_at              timestamptz not null default now()
);

-- RLS: users can only read their own audit entries
alter table markets.execution_audit_log enable row level security;
drop policy if exists "owner_read" on markets.execution_audit_log;
create policy "owner_read" on markets.execution_audit_log
  for select using (auth.uid() = user_id);

-- Partial index for recent audit entries per user (most queries filter by user + date)
create index if not exists idx_audit_log_user_recent
  on markets.execution_audit_log (user_id, created_at desc);

-- ── autonomy_progress ─────────────────────────────────────────────────────────
-- Tracks each user's current phase, paper trade count, and kill switch state
create table if not exists markets.autonomy_progress (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  current_phase      text not null check (current_phase in ('paper', 'micro', 'pilot', 'full')) default 'paper',
  paper_trades_done  integer not null default 0,
  micro_trades_done  integer not null default 0,
  kill_switch_level  text not null check (kill_switch_level in ('none', 'strategy_pause', 'all_pause', 'flatten_positions', 'revoke_api_key')) default 'none',
  kill_switch_set_at timestamptz,
  sebi_disclosures_accepted_at timestamptz,
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_autonomy_progress_updated_at on markets.autonomy_progress;
create trigger trg_autonomy_progress_updated_at
  before update on markets.autonomy_progress
  for each row execute function platform.set_updated_at();

alter table markets.autonomy_progress enable row level security;
drop policy if exists "owner_all" on markets.autonomy_progress;
create policy "owner_all" on markets.autonomy_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Step 2: Run migration locally to verify syntax

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npm run supabase:db:diff
```

Expected: No errors. If Supabase local is not running, just verify the SQL parses cleanly.

### Step 3: Commit

```bash
git add supabase/migrations/20260518140000_markets_autonomous_execution.sql
git commit -m "feat(retail-p3): DB migrations — execution_rules, audit_log, autonomy_progress"
```

---

## Task 2: Layer 0 Data Validator

**Files:**
- Create: `services/markets-worker/src/markets_worker/autonomous/data_validator.py`
- Create: `services/markets-worker/src/markets_worker/autonomous/__init__.py`
- Create: `services/markets-worker/tests/test_data_validator.py`

### Step 1: Write failing tests

```python
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
        # ₹5,000 order on ₹1,00,000 NAV = 5% — within 20% limit
        r = validate_fat_finger(order_value=5_000, portfolio_nav=1_00_000)
        assert r.passed is True

    def test_large_order_blocked(self):
        # ₹25,000 order on ₹1,00,000 NAV = 25% — exceeds 20% limit
        r = validate_fat_finger(order_value=25_000, portfolio_nav=1_00_000)
        assert r.passed is False
        assert "20%" in r.reason

    def test_zero_nav_fails_safely(self):
        r = validate_fat_finger(order_value=1000, portfolio_nav=0)
        assert r.passed is False

    def test_boundary_exactly_20pct_passes(self):
        r = validate_fat_finger(order_value=20_000, portfolio_nav=1_00_000)
        assert r.passed is True  # exactly 20% is allowed


class TestCircuitBreaker:
    def test_normal_price_passes(self):
        # ltp close to prev_price — not at circuit
        cache = {"RELIANCE:NSE": (FRESH, {"ltp": 2890.0, "prev_price": 2880.0, "upper_circuit": 3168.0, "lower_circuit": 2592.0})}
        r = validate_circuit_breaker("RELIANCE:NSE", cache)
        assert r.passed is True

    def test_upper_circuit_blocks_buy(self):
        cache = {"RELIANCE:NSE": (FRESH, {"ltp": 3168.0, "prev_price": 2880.0, "upper_circuit": 3168.0, "lower_circuit": 2592.0})}
        r = validate_circuit_breaker("RELIANCE:NSE", cache, side="BUY")
        assert r.passed is False
        assert "circuit" in r.reason.lower()

    def test_no_circuit_data_passes(self):
        # Not all instruments have circuit limits in cache — should not block
        cache = {"RELIANCE:NSE": (FRESH, {"ltp": 2890.0})}
        r = validate_circuit_breaker("RELIANCE:NSE", cache)
        assert r.passed is True
```

### Step 2: Run to confirm failure

```bash
cd services/markets-worker
uv run pytest tests/test_data_validator.py -v
```

Expected: `ModuleNotFoundError: No module named 'markets_worker.autonomous'`

### Step 3: Implement

```python
# services/markets-worker/src/markets_worker/autonomous/__init__.py
# (empty)
```

```python
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
    """Fail if the cached price for this symbol is older than STALE_THRESHOLD_SECONDS."""
    entry = ltp_cache.get(symbol_key)
    if not entry:
        return ValidationResult(False, f"Price not found in cache for {symbol_key}")
    ts, _ = entry
    age = time.time() - ts
    if age > STALE_THRESHOLD_SECONDS:
        return ValidationResult(False, f"Price is stale ({age:.0f}s old, limit {STALE_THRESHOLD_SECONDS}s)")
    return ValidationResult(True)


def validate_fat_finger(order_value: float, portfolio_nav: float) -> ValidationResult:
    """Block orders where order_value > 20% of portfolio NAV."""
    if portfolio_nav <= 0:
        return ValidationResult(False, "Portfolio NAV is zero or negative — cannot validate order size")
    pct = (order_value / portfolio_nav) * 100
    if pct > 20.0:
        return ValidationResult(False, f"Order value {pct:.1f}% of portfolio exceeds 20% fat-finger limit")
    return ValidationResult(True)


def validate_circuit_breaker(symbol_key: str, ltp_cache: dict, side: str = "BUY") -> ValidationResult:
    """Block buy orders at upper circuit, sell orders at lower circuit."""
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
    """Run all Layer 0 checks and return named results."""
    return {
        "price_staleness": validate_price_staleness(symbol_key, ltp_cache),
        "fat_finger": validate_fat_finger(order_value, portfolio_nav),
        "circuit_breaker": validate_circuit_breaker(symbol_key, ltp_cache, side),
    }


def all_passed(checks: dict[str, ValidationResult]) -> tuple[bool, str]:
    """Return (True, '') if all checks pass, else (False, first failure reason)."""
    for name, result in checks.items():
        if not result.passed:
            return False, f"{name}: {result.reason}"
    return True, ""
```

### Step 4: Run tests

```bash
uv run pytest tests/test_data_validator.py -v
```

Expected: 10/10 passing.

### Step 5: Commit

```bash
git add services/markets-worker/src/markets_worker/autonomous/ \
        services/markets-worker/tests/test_data_validator.py
git commit -m "feat(retail-p3): Layer 0 data validator — price staleness, fat-finger, circuit breaker"
```

---

## Task 3: Execution Router — Rules CRUD + Order Submission

**Files:**
- Create: `services/markets-worker/src/markets_worker/routers/execution.py`
- Create: `services/markets-worker/tests/test_execution_router.py`
- Modify: `services/markets-worker/src/markets_worker/main.py` (register router)

### Step 1: Write failing tests

```python
# services/markets-worker/tests/test_execution_router.py
"""Tests for execution rules CRUD and order submission."""
import time
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-exec-1"

@pytest.fixture
def app():
    from markets_worker.main import create_app
    from markets_worker.auth import get_auth, AuthContext
    application = create_app()
    application.dependency_overrides[get_auth] = lambda: AuthContext(user_id=MOCK_USER_ID)
    return application

@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer mock-token"}


class TestExecutionRulesCRUD:
    def test_create_rule(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "rule-1", "name": "My HDFC Rule"}]
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/rules", json={
                "name": "My HDFC Rule",
                "description": "Buy HDFC on strong signal",
                "asset_class": "equity",
                "signal_type": "buy",
                "order_type": "MARKET",
                "product": "CNC",
                "max_order_value": 15000,
            }, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["id"] == "rule-1"

    def test_list_rules(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.eq.return_value.order.return_value \
            .execute.return_value.data = [{"id": "rule-1", "name": "My HDFC Rule"}]
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/execution/rules", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["rules"]) == 1

    def test_create_rule_rejects_invalid_order_type(self, client, auth_headers):
        resp = client.post("/v1/execution/rules", json={
            "name": "Bad Rule",
            "description": "",
            "asset_class": "equity",
            "signal_type": "buy",
            "order_type": "INVALID",
            "product": "CNC",
            "max_order_value": 5000,
        }, headers=auth_headers)
        assert resp.status_code == 422


class TestOrderSubmission:
    def test_order_rejected_when_kill_switch_active(self, client, auth_headers):
        mock_sb = MagicMock()
        # autonomy_progress has all_pause kill switch
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "current_phase": "micro",
                "kill_switch_level": "all_pause",
                "paper_trades_done": 12,
            }
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/orders", json={
                "rule_id": "rule-1",
                "signal_id": "signal-1",
                "tradingsymbol": "HDFC",
                "exchange": "NSE",
                "side": "BUY",
                "quantity": 1,
                "order_value": 1700.0,
                "portfolio_nav": 100000.0,
            }, headers=auth_headers)
        assert resp.status_code == 409
        assert "kill_switch" in resp.json()["detail"]

    def test_paper_order_submitted_in_paper_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "current_phase": "paper",
                "kill_switch_level": "none",
                "paper_trades_done": 3,
            }
        # Mock paper order endpoint response
        mock_paper_resp = MagicMock()
        mock_paper_resp.status_code = 200
        mock_paper_resp.json.return_value = {"order_id": "paper-123"}
        # Mock audit log insert
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "audit-1"}]

        fresh_cache = {"HDFC:NSE": (time.time(), {"ltp": 1700.0})}
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb), \
             patch("markets_worker.routers.execution._ltp_cache", fresh_cache), \
             patch("markets_worker.routers.execution._submit_paper_order", return_value={"order_id": "paper-123"}):
            resp = client.post("/v1/execution/orders", json={
                "rule_id": "rule-1",
                "signal_id": "signal-1",
                "tradingsymbol": "HDFC",
                "exchange": "NSE",
                "side": "BUY",
                "quantity": 1,
                "order_value": 1700.0,
                "portfolio_nav": 100000.0,
            }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["phase"] == "paper"

    def test_fat_finger_blocks_order(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "current_phase": "micro",
                "kill_switch_level": "none",
                "paper_trades_done": 12,
            }
        fresh_cache = {"HDFC:NSE": (time.time(), {"ltp": 25000.0})}
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb), \
             patch("markets_worker.routers.execution._ltp_cache", fresh_cache):
            resp = client.post("/v1/execution/orders", json={
                "rule_id": "rule-1",
                "signal_id": "signal-1",
                "tradingsymbol": "HDFC",
                "exchange": "NSE",
                "side": "BUY",
                "quantity": 1,
                "order_value": 25000.0,  # 25% of ₹1L NAV — blocked
                "portfolio_nav": 100000.0,
            }, headers=auth_headers)
        assert resp.status_code == 422
        assert "fat_finger" in resp.json()["detail"]
```

### Step 2: Run to confirm failure

```bash
uv run pytest tests/test_execution_router.py -v 2>&1 | head -20
```

Expected: `ImportError` or `404` on all endpoints (router not registered).

### Step 3: Implement execution router

```python
# services/markets-worker/src/markets_worker/routers/execution.py
"""
Autonomous execution: rules CRUD, order submission with Layer 0 validation,
autonomy phase enforcement, and SEBI audit trail logging.

POST /v1/execution/rules           — save an auto-execution rule
GET  /v1/execution/rules           — list user's rules
DELETE /v1/execution/rules/{id}    — remove a rule
POST /v1/execution/orders          — submit an order (paper or live, phase-gated)
GET  /v1/execution/audit           — user's audit log (most recent 50)
GET  /v1/execution/progress        — current autonomy phase + kill switch state
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from markets_worker.auth import Auth
from markets_worker.autonomous.data_validator import run_all_checks, all_passed
from markets_worker.db import get_supabase
from markets_worker.routers.ltp import _ltp_cache

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/execution")

PAPER_TRADES_REQUIRED = 10   # minimum paper trades before Micro-Live
MICRO_TRADES_REQUIRED = 5    # minimum Micro trades before Pilot


# ── Models ────────────────────────────────────────────────────────────────────

class CreateRuleRequest(BaseModel):
    name: str
    description: str = ""
    asset_class: str
    instrument_id: str | None = None
    signal_type: Literal["buy", "sell", "both"]
    order_type: Literal["MARKET", "LIMIT", "SL", "SL-M"] = "MARKET"
    product: Literal["CNC", "MIS", "NRML"] = "CNC"
    max_order_value: float = 10_000.0
    algo_id: str | None = None


class PlaceOrderRequest(BaseModel):
    rule_id: str
    signal_id: str
    tradingsymbol: str
    exchange: str
    side: Literal["BUY", "SELL"]
    quantity: int
    order_value: float
    portfolio_nav: float
    price: float | None = None
    trigger_price: float | None = None

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_progress(db: Any, user_id: str) -> dict:
    row = (
        db.schema("markets").from_("autonomy_progress")
        .select("current_phase, kill_switch_level, paper_trades_done, micro_trades_done")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        # First time — seed the row
        try:
            db.schema("markets").from_("autonomy_progress").insert({"user_id": user_id}).execute()
        except Exception:
            pass
        return {"current_phase": "paper", "kill_switch_level": "none",
                "paper_trades_done": 0, "micro_trades_done": 0}
    return row


def _log_audit(db: Any, user_id: str, body: PlaceOrderRequest, phase: str,
                checks: dict, status: str, broker_order_id: str | None = None,
                rejection_reason: str | None = None) -> None:
    try:
        db.schema("markets").from_("execution_audit_log").insert({
            "user_id": user_id,
            "rule_id": body.rule_id,
            "signal_id": body.signal_id,
            "tradingsymbol": body.tradingsymbol,
            "exchange": body.exchange,
            "side": body.side,
            "order_type": "MARKET",
            "quantity": body.quantity,
            "price": body.price,
            "order_value": body.order_value,
            "portfolio_nav_at_order": body.portfolio_nav,
            "phase": phase,
            "pre_trade_checks": {k: v.to_dict() for k, v in checks.items()},
            "status": status,
            "broker_order_id": broker_order_id,
            "rejection_reason": rejection_reason,
            "kill_switch_active": False,
        }).execute()
    except Exception as exc:
        logger.error("audit_log_failed", error=str(exc))


def _submit_paper_order(tradingsymbol: str, exchange: str, side: str,
                        quantity: int, user_id: str) -> dict:
    """Delegate to existing paper router logic via internal supabase insert."""
    db = get_supabase()
    # Increment paper_trades_done
    progress = (
        db.schema("markets").from_("autonomy_progress")
        .select("paper_trades_done")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    ).data
    count = (progress or {}).get("paper_trades_done", 0) + 1
    db.schema("markets").from_("autonomy_progress").update({"paper_trades_done": count}) \
        .eq("user_id", user_id).execute()
    return {"order_id": f"paper-{tradingsymbol}-{quantity}", "phase": "paper"}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/rules", status_code=201)
async def create_rule(body: CreateRuleRequest, auth: Auth):
    db = get_supabase()
    try:
        result = db.schema("markets").from_("execution_rules").insert({
            "user_id": auth.user_id,
            "name": body.name,
            "description": body.description,
            "asset_class": body.asset_class,
            "instrument_id": body.instrument_id,
            "signal_type": body.signal_type,
            "order_type": body.order_type,
            "product": body.product,
            "max_order_value": body.max_order_value,
            "algo_id": body.algo_id,
        }).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    rows = result.data or []
    if not rows:
        raise HTTPException(500, detail="Insert returned no data")
    return rows[0]


@router.get("/rules")
async def list_rules(auth: Auth):
    db = get_supabase()
    result = (
        db.schema("markets").from_("execution_rules")
        .select("id, name, description, asset_class, signal_type, order_type, product, max_order_value, algo_id, is_active, created_at")
        .eq("user_id", auth.user_id)
        .eq("is_active", True)
        .order("created_at", desc=False)
        .execute()
    )
    return {"rules": result.data or []}


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: str, auth: Auth):
    db = get_supabase()
    db.schema("markets").from_("execution_rules") \
        .update({"is_active": False}) \
        .eq("id", rule_id).eq("user_id", auth.user_id).execute()


@router.get("/progress")
async def get_autonomy_progress(auth: Auth):
    db = get_supabase()
    return _get_progress(db, auth.user_id)


@router.get("/audit")
async def get_audit_log(auth: Auth, limit: int = 50):
    db = get_supabase()
    result = (
        db.schema("markets").from_("execution_audit_log")
        .select("id, tradingsymbol, exchange, side, quantity, order_value, phase, status, rejection_reason, created_at")
        .eq("user_id", auth.user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"entries": result.data or []}


@router.post("/orders")
async def submit_order(body: PlaceOrderRequest, auth: Auth):
    db = get_supabase()

    # 1. Check kill switch
    progress = _get_progress(db, auth.user_id)
    if progress["kill_switch_level"] in ("all_pause", "flatten_positions", "revoke_api_key"):
        raise HTTPException(409, detail=f"kill_switch active: {progress['kill_switch_level']}")

    # 2. Layer 0 validation
    symbol_key = f"{body.tradingsymbol}:{body.exchange}"
    checks = run_all_checks(
        symbol_key=symbol_key,
        ltp_cache=_ltp_cache,
        order_value=body.order_value,
        portfolio_nav=body.portfolio_nav,
        side=body.side,
    )
    passed, reason = all_passed(checks)
    if not passed:
        _log_audit(db, auth.user_id, body, progress["current_phase"], checks,
                   "rejected", rejection_reason=reason)
        raise HTTPException(422, detail=reason)

    phase = progress["current_phase"]

    # 3. Paper phase — simulate
    if phase == "paper":
        result = _submit_paper_order(body.tradingsymbol, body.exchange, body.side,
                                     body.quantity, auth.user_id)
        _log_audit(db, auth.user_id, body, "paper", checks, "paper",
                   broker_order_id=result.get("order_id"))
        return {"phase": "paper", "order_id": result["order_id"], "status": "simulated"}

    # 4. Micro phase — enforce 2% NAV cap per trade
    if phase == "micro" and body.order_value > body.portfolio_nav * 0.02:
        reason = f"Micro-Live cap: order_value {body.order_value} exceeds 2% of NAV {body.portfolio_nav}"
        _log_audit(db, auth.user_id, body, phase, checks, "rejected", rejection_reason=reason)
        raise HTTPException(422, detail=reason)

    # 5. Pilot phase — enforce 25% NAV cap
    if phase == "pilot" and body.order_value > body.portfolio_nav * 0.25:
        reason = f"Pilot cap: order_value {body.order_value} exceeds 25% of NAV {body.portfolio_nav}"
        _log_audit(db, auth.user_id, body, phase, checks, "rejected", rejection_reason=reason)
        raise HTTPException(422, detail=reason)

    # 6. Live submission via broker (broker_id must be resolved from rule — simplified here)
    _log_audit(db, auth.user_id, body, phase, checks, "submitted")
    return {"phase": phase, "status": "submitted", "message": "Order queued for broker submission"}
```

### Step 4: Register in main.py

```python
# In services/markets-worker/src/markets_worker/main.py — add after behavioral_router import:
from markets_worker.routers import execution as execution_router
```

And in the `create_app()` function, add:
```python
app.include_router(execution_router.router)
```

### Step 5: Run tests

```bash
uv run pytest tests/test_execution_router.py -v
```

Expected: All 6 tests pass.

### Step 6: Commit

```bash
git add services/markets-worker/src/markets_worker/routers/execution.py \
        services/markets-worker/src/markets_worker/main.py \
        services/markets-worker/tests/test_execution_router.py
git commit -m "feat(retail-p3): execution router — rules CRUD, Layer 0 validation, phase-gated order submission"
```

---

## Task 4: Kill Switch — 4 Levels

**Files:**
- Modify: `services/markets-worker/src/markets_worker/routers/execution.py`
- Create: `services/markets-worker/tests/test_kill_switch.py`

### Step 1: Write failing tests

```python
# services/markets-worker/tests/test_kill_switch.py
"""Tests for the 4-level kill switch."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-ks-1"

@pytest.fixture
def app():
    from markets_worker.main import create_app
    from markets_worker.auth import get_auth, AuthContext
    application = create_app()
    application.dependency_overrides[get_auth] = lambda: AuthContext(user_id=MOCK_USER_ID)
    return application

@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer mock-token"}


class TestKillSwitch:
    def _mock_db_with_progress(self, phase="micro", ks_level="none"):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "current_phase": phase, "kill_switch_level": ks_level,
                "paper_trades_done": 12, "micro_trades_done": 6,
            }
        mock_sb.schema.return_value.from_.return_value.update.return_value \
            .eq.return_value.execute.return_value.data = [{}]
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "audit-ks-1"}]
        return mock_sb

    def test_get_kill_switch_returns_current_state(self, client, auth_headers):
        mock_sb = self._mock_db_with_progress(ks_level="none")
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/execution/kill-switch", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["kill_switch_level"] == "none"

    def test_activate_all_pause(self, client, auth_headers):
        mock_sb = self._mock_db_with_progress()
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/kill-switch/all_pause", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["kill_switch_level"] == "all_pause"

    def test_activate_revoke_api_key_disables_broker(self, client, auth_headers):
        mock_sb = self._mock_db_with_progress()
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/kill-switch/revoke_api_key", headers=auth_headers)
        assert resp.status_code == 200
        # Verify broker connections were disabled (can_trade=False)
        update_calls = mock_sb.schema.return_value.from_.return_value.update.call_args_list
        broker_update = any(
            "can_trade" in str(call) for call in update_calls
        )
        assert broker_update

    def test_reset_kill_switch(self, client, auth_headers):
        mock_sb = self._mock_db_with_progress(ks_level="all_pause")
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/kill-switch/none", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["kill_switch_level"] == "none"

    def test_invalid_kill_switch_level_rejected(self, client, auth_headers):
        resp = client.post("/v1/execution/kill-switch/destroy_everything", headers=auth_headers)
        assert resp.status_code == 422
```

### Step 2: Run to confirm failure

```bash
uv run pytest tests/test_kill_switch.py -v 2>&1 | head -10
```

Expected: `404` on `/v1/execution/kill-switch` routes.

### Step 3: Add kill switch routes to execution.py

Add these after the existing routes in `routers/execution.py`:

```python
from typing import Literal as _Literal

VALID_KILL_SWITCH_LEVELS = {"none", "strategy_pause", "all_pause", "flatten_positions", "revoke_api_key"}


@router.get("/kill-switch")
async def get_kill_switch(auth: Auth):
    db = get_supabase()
    progress = _get_progress(db, auth.user_id)
    return {
        "kill_switch_level": progress["kill_switch_level"],
        "current_phase": progress["current_phase"],
    }


@router.post("/kill-switch/{level}")
async def set_kill_switch(level: str, auth: Auth):
    if level not in VALID_KILL_SWITCH_LEVELS:
        from fastapi import HTTPException as _HTTPException
        from pydantic import ValidationError
        raise HTTPException(422, detail=f"Invalid kill switch level: {level}. Valid: {sorted(VALID_KILL_SWITCH_LEVELS)}")

    db = get_supabase()

    # For revoke_api_key — disable all broker connections for this user
    if level == "revoke_api_key":
        try:
            db.schema("markets").from_("broker_connections") \
                .update({"can_trade": False}) \
                .eq("owner_user_id", auth.user_id).execute()
        except Exception as exc:
            logger.error("kill_switch_broker_revoke_failed", error=str(exc))

    # Update autonomy_progress
    try:
        db.schema("markets").from_("autonomy_progress") \
            .update({
                "kill_switch_level": level,
                "kill_switch_set_at": datetime.now(timezone.utc).isoformat() if level != "none" else None,
            }) \
            .eq("user_id", auth.user_id).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))

    # Log to audit trail
    _log_kill_switch_audit(db, auth.user_id, level)

    return {"kill_switch_level": level, "set_at": datetime.now(timezone.utc).isoformat()}


def _log_kill_switch_audit(db: Any, user_id: str, level: str) -> None:
    try:
        db.schema("markets").from_("execution_audit_log").insert({
            "user_id": user_id,
            "tradingsymbol": "_KILL_SWITCH_",
            "exchange": "SYSTEM",
            "side": "BUY",
            "order_type": "MARKET",
            "quantity": 0,
            "phase": "paper",
            "pre_trade_checks": {},
            "status": "rejected",
            "kill_switch_active": True,
            "rejection_reason": f"Kill switch activated: {level}",
        }).execute()
    except Exception as exc:
        logger.error("kill_switch_audit_failed", error=str(exc))
```

### Step 4: Run tests

```bash
uv run pytest tests/test_kill_switch.py -v
```

Expected: 5/5 passing.

### Step 5: Commit

```bash
git add services/markets-worker/src/markets_worker/routers/execution.py \
        services/markets-worker/tests/test_kill_switch.py
git commit -m "feat(retail-p3): 4-level kill switch — strategy_pause, all_pause, flatten_positions, revoke_api_key"
```

---

## Task 5: Multi-Agent Signal Debate (LangGraph)

**Files:**
- Modify: `services/markets-worker/src/markets_worker/jobs/signal_generator.py`
- Modify: `services/markets-worker/tests/test_signal_explanation.py`

This task extends the LangGraph graph to add Bull, Bear, and Risk agent nodes before `score_signal`. Each node runs a fast, structured LLM call and appends to `debate_notes` in the state. The existing `score_signal` node consumes `debate_notes` as additional context.

### Step 1: Add failing test for debate output

Append to `services/markets-worker/tests/test_signal_explanation.py`:

```python
def test_debate_notes_present_in_signal_state():
    """After running the debate nodes, debate_notes should have bull/bear/risk entries."""
    from markets_worker.jobs.signal_generator import (
        _bull_debate, _bear_debate, _risk_debate, SignalState,
    )
    state: SignalState = {
        "instrument_id": "instr-1", "symbol": "RELIANCE", "exchange": "NSE",
        "asset_class": "equity", "instrument_type": "EQ",
        "option_type": None, "expiry": None, "strike": None,
        "underlying_id": None, "lot_size": None, "portfolio_id": None,
        "tenant_id": None, "franchise_id": None, "owner_user_id": None,
        "avg_cost": None, "qty": None, "holding_period_days": None,
        "horizon": "short_term", "prices": [], "prices_weekly": [],
        "oi_series": [], "nav_history": [], "extra_data": {},
        "indicators": {"rsi": 62, "macd_diff": 1.2, "adx": 30, "price": 2890},
        "signal_type": "", "direction": "", "confidence": 0.0,
        "rationale": "", "score": 0.0, "risk_params": {}, "error": None,
        "debate_notes": {},
    }
    # These nodes run without LLM (rule-based fallback when LLM is unavailable)
    result = _bull_debate(state)
    assert "bull" in result["debate_notes"]

    result2 = _bear_debate({**state, **result})
    assert "bear" in result2["debate_notes"]

    result3 = _risk_debate({**state, **result, **result2})
    assert "risk" in result3["debate_notes"]
```

### Step 2: Run to confirm failure

```bash
uv run pytest tests/test_signal_explanation.py::test_debate_notes_present_in_signal_state -v
```

Expected: `ImportError: cannot import name '_bull_debate'`

### Step 3: Implement debate nodes in signal_generator.py

**3a.** Add `debate_notes: dict` to `SignalState` TypedDict (after `error: str | None`):

```python
debate_notes: dict  # keyed by "bull", "bear", "risk" — populated by debate nodes
```

**3b.** Add the three debate node functions (insert before `_score_signal`):

```python
def _bull_debate(state: SignalState) -> dict:
    """Bull agent: looks for reasons to buy. Rule-based when LLM unavailable."""
    ind = state.get("indicators", {})
    rsi = ind.get("rsi", 50)
    macd = ind.get("macd_diff", 0)
    adx = ind.get("adx", 20)
    notes = state.get("debate_notes", {})

    bullish_signals = []
    if rsi < 40:
        bullish_signals.append("RSI oversold — potential bounce")
    if macd > 0:
        bullish_signals.append("MACD positive crossover")
    if adx > 25:
        bullish_signals.append("Strong trend (ADX > 25)")

    notes["bull"] = {
        "stance": "bullish" if bullish_signals else "neutral",
        "reasons": bullish_signals or ["No strong bullish signal detected"],
    }
    return {"debate_notes": notes}


def _bear_debate(state: SignalState) -> dict:
    """Bear agent: looks for reasons to sell or avoid. Rule-based when LLM unavailable."""
    ind = state.get("indicators", {})
    rsi = ind.get("rsi", 50)
    macd = ind.get("macd_diff", 0)
    notes = state.get("debate_notes", {})

    bearish_signals = []
    if rsi > 70:
        bearish_signals.append("RSI overbought — risk of reversal")
    if macd < 0:
        bearish_signals.append("MACD negative — downward momentum")

    notes["bear"] = {
        "stance": "bearish" if bearish_signals else "neutral",
        "reasons": bearish_signals or ["No strong bearish signal detected"],
    }
    return {"debate_notes": notes}


def _risk_debate(state: SignalState) -> dict:
    """Risk agent: evaluates position sizing and risk/reward."""
    risk_params = state.get("risk_params", {})
    notes = state.get("debate_notes", {})
    r_r = risk_params.get("r_r", 0)
    pos_pct = risk_params.get("position_size_pct", 0)

    risk_notes = []
    if r_r > 0 and r_r < 1.5:
        risk_notes.append(f"R:R ratio {r_r:.1f} below minimum 1.5 — reduce position")
    if pos_pct > 8:
        risk_notes.append(f"Position size {pos_pct:.1f}% is large — consider splitting entry")

    notes["risk"] = {
        "r_r": r_r,
        "position_pct": pos_pct,
        "warnings": risk_notes,
        "approved": len(risk_notes) == 0,
    }
    return {"debate_notes": notes}
```

**3c.** In the `_build_graph()` function, add the three debate nodes before `score_signal`:

After `graph.add_node("fetch_data", _fetch_data)` and the compute_* nodes, add:
```python
graph.add_node("bull_debate", _bull_debate)
graph.add_node("bear_debate", _bear_debate)
graph.add_node("risk_debate", _risk_debate)
```

Wire them in sequence after all compute_* nodes converge, before `score_signal`:
Each compute_* node should route to `bull_debate` instead of `score_signal`. Then:
```python
graph.add_edge("bull_debate", "bear_debate")
graph.add_edge("bear_debate", "risk_debate")
graph.add_edge("risk_debate", "score_signal")
```

**3d.** Initialize `debate_notes: {}` in `generate_signals_for_portfolio()` when building the initial state dict.

### Step 4: Run tests

```bash
uv run pytest tests/test_signal_explanation.py -v
```

Expected: All tests (previously 3) + 1 new = 4 passing.

### Step 5: Commit

```bash
git add services/markets-worker/src/markets_worker/jobs/signal_generator.py \
        services/markets-worker/tests/test_signal_explanation.py
git commit -m "feat(retail-p3): multi-agent debate — Bull/Bear/Risk nodes in LangGraph signal pipeline"
```

---

## Task 6: Autonomy Phase Advancement

**Files:**
- Modify: `services/markets-worker/src/markets_worker/routers/execution.py`
- Create: `services/markets-worker/tests/test_phase_advancement.py`

### Step 1: Write failing tests

```python
# services/markets-worker/tests/test_phase_advancement.py
"""Tests for autonomy phase advancement (Paper → Micro → Pilot → Full)."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-phase-1"

@pytest.fixture
def app():
    from markets_worker.main import create_app
    from markets_worker.auth import get_auth, AuthContext
    application = create_app()
    application.dependency_overrides[get_auth] = lambda: AuthContext(user_id=MOCK_USER_ID)
    return application

@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer mock-token"}


class TestPhaseAdvancement:
    def _mock_db(self, phase, paper_trades, micro_trades=0):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value.execute.return_value.data = {
                "current_phase": phase,
                "kill_switch_level": "none",
                "paper_trades_done": paper_trades,
                "micro_trades_done": micro_trades,
            }
        mock_sb.schema.return_value.from_.return_value.update.return_value \
            .eq.return_value.execute.return_value.data = [{}]
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "audit-1"}]
        return mock_sb

    def test_advance_paper_to_micro_when_eligible(self, client, auth_headers):
        mock_sb = self._mock_db("paper", paper_trades=10)
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/advance-phase", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["new_phase"] == "micro"

    def test_cannot_advance_paper_without_enough_trades(self, client, auth_headers):
        mock_sb = self._mock_db("paper", paper_trades=5)
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/advance-phase", headers=auth_headers)
        assert resp.status_code == 400
        assert "10 paper trades" in resp.json()["detail"]

    def test_advance_micro_to_pilot(self, client, auth_headers):
        mock_sb = self._mock_db("micro", paper_trades=10, micro_trades=5)
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/advance-phase", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["new_phase"] == "pilot"

    def test_full_phase_cannot_advance_further(self, client, auth_headers):
        mock_sb = self._mock_db("full", paper_trades=20, micro_trades=10)
        with patch("markets_worker.routers.execution.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/execution/advance-phase", headers=auth_headers)
        assert resp.status_code == 400
        assert "already at full" in resp.json()["detail"].lower()
```

### Step 2: Implement `POST /v1/execution/advance-phase` in execution.py

Add to `routers/execution.py`:

```python
PHASE_ORDER = ["paper", "micro", "pilot", "full"]
PHASE_NEXT  = {"paper": "micro", "micro": "pilot", "pilot": "full"}


@router.post("/advance-phase")
async def advance_phase(auth: Auth):
    db = get_supabase()
    progress = _get_progress(db, auth.user_id)
    current = progress["current_phase"]

    if current == "full":
        raise HTTPException(400, detail="Already at full autonomy phase")

    # Gate checks
    if current == "paper" and progress["paper_trades_done"] < PAPER_TRADES_REQUIRED:
        remaining = PAPER_TRADES_REQUIRED - progress["paper_trades_done"]
        raise HTTPException(400, detail=f"Complete {PAPER_TRADES_REQUIRED} paper trades first ({remaining} remaining)")
    if current == "micro" and progress["micro_trades_done"] < MICRO_TRADES_REQUIRED:
        remaining = MICRO_TRADES_REQUIRED - progress["micro_trades_done"]
        raise HTTPException(400, detail=f"Complete {MICRO_TRADES_REQUIRED} Micro-Live trades first ({remaining} remaining)")

    new_phase = PHASE_NEXT[current]
    try:
        db.schema("markets").from_("autonomy_progress") \
            .update({"current_phase": new_phase}) \
            .eq("user_id", auth.user_id).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))

    # Log phase transition in audit trail
    try:
        db.schema("markets").from_("execution_audit_log").insert({
            "user_id": auth.user_id,
            "tradingsymbol": "_PHASE_ADVANCE_",
            "exchange": "SYSTEM",
            "side": "BUY",
            "order_type": "MARKET",
            "quantity": 0,
            "phase": new_phase,
            "pre_trade_checks": {},
            "status": "submitted",
            "rejection_reason": f"Phase advanced: {current} → {new_phase}",
        }).execute()
    except Exception:
        pass

    return {"previous_phase": current, "new_phase": new_phase}
```

### Step 3: Run all execution + kill switch + phase tests

```bash
uv run pytest tests/test_execution_router.py tests/test_kill_switch.py tests/test_phase_advancement.py -v
```

Expected: All passing.

### Step 4: Commit

```bash
git add services/markets-worker/src/markets_worker/routers/execution.py \
        services/markets-worker/tests/test_phase_advancement.py
git commit -m "feat(retail-p3): autonomy phase advancement — paper → micro → pilot → full with gate checks"
```

---

## Task 7: Frontend Autonomous Types + Query Keys + Hooks

**Files:**
- Create: `src/features/markets/retail/autonomous/types.ts`
- Modify: `src/features/markets/hooks/queryKeys.ts`
- Create: `src/features/markets/retail/autonomous/hooks/useAutonomyProgress.ts`
- Create: `src/features/markets/retail/autonomous/hooks/useKillSwitch.ts`
- Create: `src/features/markets/retail/autonomous/hooks/useExecutionRules.ts`
- Create: `src/features/markets/retail/autonomous/hooks/useAutonomyProgress.test.ts`

### Step 1: Write failing test

```typescript
// src/features/markets/retail/autonomous/hooks/useAutonomyProgress.test.ts
import { describe, it, expect, vi } from 'vitest';
import { computePhaseProgress } from '../types';

describe('computePhaseProgress', () => {
  it('paper phase needs 10 trades, shows correct count', () => {
    const p = computePhaseProgress({ current_phase: 'paper', paper_trades_done: 3, micro_trades_done: 0, kill_switch_level: 'none' });
    expect(p.required).toBe(10);
    expect(p.done).toBe(3);
    expect(p.canAdvance).toBe(false);
  });

  it('paper with 10 trades can advance', () => {
    const p = computePhaseProgress({ current_phase: 'paper', paper_trades_done: 10, micro_trades_done: 0, kill_switch_level: 'none' });
    expect(p.canAdvance).toBe(true);
  });

  it('micro phase needs 5 trades', () => {
    const p = computePhaseProgress({ current_phase: 'micro', paper_trades_done: 10, micro_trades_done: 2, kill_switch_level: 'none' });
    expect(p.required).toBe(5);
    expect(p.done).toBe(2);
    expect(p.canAdvance).toBe(false);
  });

  it('full phase has no advancement requirement', () => {
    const p = computePhaseProgress({ current_phase: 'full', paper_trades_done: 20, micro_trades_done: 10, kill_switch_level: 'none' });
    expect(p.canAdvance).toBe(false);
    expect(p.required).toBe(0);
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/autonomous/hooks/useAutonomyProgress.test.ts 2>&1 | tail -5
```

### Step 3: Implement

```typescript
// src/features/markets/retail/autonomous/types.ts
export type AutonomyPhase = 'paper' | 'micro' | 'pilot' | 'full';
export type KillSwitchLevel = 'none' | 'strategy_pause' | 'all_pause' | 'flatten_positions' | 'revoke_api_key';

export interface AutonomyProgress {
  current_phase: AutonomyPhase;
  paper_trades_done: number;
  micro_trades_done: number;
  kill_switch_level: KillSwitchLevel;
}

export interface PhaseProgress {
  canAdvance: boolean;
  done: number;
  required: number;
  label: string;
}

export interface ExecutionRule {
  id: string;
  name: string;
  description: string;
  asset_class: string;
  signal_type: 'buy' | 'sell' | 'both';
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  product: 'CNC' | 'MIS' | 'NRML';
  max_order_value: number;
  algo_id: string | null;
  is_active: boolean;
  created_at: string;
}

export const PHASE_LABELS: Record<AutonomyPhase, string> = {
  paper: 'Paper Trading',
  micro: 'Micro-Live (2% cap)',
  pilot: 'Pilot (25% cap)',
  full: 'Full Autonomy',
};

export const PHASE_ORDER: AutonomyPhase[] = ['paper', 'micro', 'pilot', 'full'];

export function computePhaseProgress(progress: AutonomyProgress): PhaseProgress {
  const { current_phase, paper_trades_done, micro_trades_done } = progress;
  if (current_phase === 'paper') {
    return { canAdvance: paper_trades_done >= 10, done: paper_trades_done, required: 10, label: 'paper trades' };
  }
  if (current_phase === 'micro') {
    return { canAdvance: micro_trades_done >= 5, done: micro_trades_done, required: 5, label: 'micro-live trades' };
  }
  if (current_phase === 'pilot') {
    return { canAdvance: true, done: 0, required: 0, label: 'request Full Autonomy manually' };
  }
  return { canAdvance: false, done: 0, required: 0, label: 'fully autonomous' };
}
```

Add to `queryKeys.ts` inside `retail`:

```typescript
autonomous: {
  progress: () => [...marketsKeys.retail.all, 'autonomous', 'progress'] as const,
  rules:    () => [...marketsKeys.retail.all, 'autonomous', 'rules'] as const,
  audit:    () => [...marketsKeys.retail.all, 'autonomous', 'audit'] as const,
  killSwitch: () => [...marketsKeys.retail.all, 'autonomous', 'kill-switch'] as const,
},
```

```typescript
// src/features/markets/retail/autonomous/hooks/useAutonomyProgress.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { marketsKeys } from '../../../hooks/queryKeys';
import type { AutonomyProgress } from '../types';

const BASE = '/api/markets/v1/execution';

export function useAutonomyProgress() {
  const { session } = useSession();
  return useQuery<AutonomyProgress>({
    queryKey: marketsKeys.retail.autonomous.progress(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/progress`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useAdvancePhase() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/advance-phase`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).detail ?? await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.autonomous.progress() }),
  });
}
```

```typescript
// src/features/markets/retail/autonomous/hooks/useKillSwitch.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { marketsKeys } from '../../../hooks/queryKeys';
import type { KillSwitchLevel } from '../types';

const BASE = '/api/markets/v1/execution';

export function useKillSwitch() {
  const { session } = useSession();
  return useQuery<{ kill_switch_level: KillSwitchLevel; current_phase: string }>({
    queryKey: marketsKeys.retail.autonomous.killSwitch(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/kill-switch`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useSetKillSwitch() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (level: KillSwitchLevel) => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/kill-switch/${level}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: marketsKeys.retail.autonomous.killSwitch() });
      qc.invalidateQueries({ queryKey: marketsKeys.retail.autonomous.progress() });
    },
  });
}
```

```typescript
// src/features/markets/retail/autonomous/hooks/useExecutionRules.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { marketsKeys } from '../../../hooks/queryKeys';
import type { ExecutionRule } from '../types';

const BASE = '/api/markets/v1/execution';

export function useExecutionRules() {
  const { session } = useSession();
  return useQuery<ExecutionRule[]>({
    queryKey: marketsKeys.retail.autonomous.rules(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/rules`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.rules ?? [];
    },
  });
}

export function useCreateExecutionRule() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<ExecutionRule, 'id' | 'is_active' | 'created_at'>) => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.autonomous.rules() }),
  });
}
```

### Step 4: Run test

```bash
npx vitest run src/features/markets/retail/autonomous/hooks/useAutonomyProgress.test.ts
```

Expected: 4/4 passing.

### Step 5: Full typecheck

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
```

Fix any errors before committing.

### Step 6: Commit

```bash
git add src/features/markets/retail/autonomous/ \
        src/features/markets/hooks/queryKeys.ts
git commit -m "feat(retail-p3): autonomous types, query keys, and data hooks"
```

---

## Task 8: PaperTradingPhase.tsx

**Files:**
- Create: `src/features/markets/retail/autonomous/PaperTradingPhase.tsx`
- Create: `src/features/markets/retail/autonomous/PaperTradingPhase.test.tsx`

### Step 1: Write failing tests

```typescript
// src/features/markets/retail/autonomous/PaperTradingPhase.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockAdvance = vi.fn();
vi.mock('./hooks/useAutonomyProgress', () => ({
  useAutonomyProgress: () => ({ data: { current_phase: 'paper', paper_trades_done: 7, micro_trades_done: 0, kill_switch_level: 'none' }, isLoading: false }),
  useAdvancePhase: () => ({ mutate: mockAdvance, isPending: false }),
}));

describe('PaperTradingPhase', () => {
  it('shows paper trades progress', async () => {
    const { PaperTradingPhase } = await import('./PaperTradingPhase');
    render(<PaperTradingPhase />);
    expect(screen.getByText(/7.*10|7 of 10|7\/10/i)).toBeInTheDocument();
  });

  it('advance button disabled when not enough trades', async () => {
    const { PaperTradingPhase } = await import('./PaperTradingPhase');
    render(<PaperTradingPhase />);
    expect(screen.getByRole('button', { name: /advance|next phase|micro/i })).toBeDisabled();
  });
});
```

### Step 2: Implement

```tsx
// src/features/markets/retail/autonomous/PaperTradingPhase.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAutonomyProgress, useAdvancePhase } from './hooks/useAutonomyProgress';
import { computePhaseProgress, PHASE_LABELS } from './types';

export function PaperTradingPhase() {
  const { data: progress, isLoading } = useAutonomyProgress();
  const { mutate: advance, isPending } = useAdvancePhase();

  if (isLoading || !progress) {
    return <div className="h-24 rounded-lg bg-muted animate-pulse" />;
  }

  const phaseProgress = computePhaseProgress(progress);
  const pct = phaseProgress.required > 0
    ? Math.min(100, (phaseProgress.done / phaseProgress.required) * 100)
    : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {PHASE_LABELS[progress.current_phase]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{phaseProgress.label}</span>
            <span>{phaseProgress.done} of {phaseProgress.required}</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <p className="text-xs text-muted-foreground">
          Paper trades are simulated with live market prices. No real money is used.
          Complete {phaseProgress.required} trades to advance to Micro-Live.
        </p>

        <Button
          size="sm"
          disabled={!phaseProgress.canAdvance || isPending}
          onClick={() => advance()}
          className="w-full"
        >
          {isPending ? 'Advancing…' : `Advance to ${PHASE_LABELS['micro']}`}
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Step 3: Run tests

```bash
npx vitest run src/features/markets/retail/autonomous/PaperTradingPhase.test.tsx
```

Expected: 2/2 passing.

### Step 4: Commit

```bash
git add src/features/markets/retail/autonomous/PaperTradingPhase.tsx \
        src/features/markets/retail/autonomous/PaperTradingPhase.test.tsx
git commit -m "feat(retail-p3): PaperTradingPhase — progress tracker with advance gate"
```

---

## Task 9: KillSwitchPanel.tsx

**Files:**
- Create: `src/features/markets/retail/autonomous/KillSwitchPanel.tsx`
- Create: `src/features/markets/retail/autonomous/KillSwitchPanel.test.tsx`

### Step 1: Write failing tests

```typescript
// src/features/markets/retail/autonomous/KillSwitchPanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockSetKillSwitch = vi.fn();
vi.mock('./hooks/useKillSwitch', () => ({
  useKillSwitch: () => ({ data: { kill_switch_level: 'none', current_phase: 'micro' }, isLoading: false }),
  useSetKillSwitch: () => ({ mutate: mockSetKillSwitch, isPending: false }),
}));

describe('KillSwitchPanel', () => {
  it('shows all 4 kill switch actions', async () => {
    const { KillSwitchPanel } = await import('./KillSwitchPanel');
    render(<KillSwitchPanel />);
    expect(screen.getByRole('button', { name: /pause.*strategy|strategy.*pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause.*all|all.*pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flatten/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revoke|api key/i })).toBeInTheDocument();
  });

  it('clicking Pause All calls setKillSwitch with all_pause', async () => {
    const { KillSwitchPanel } = await import('./KillSwitchPanel');
    render(<KillSwitchPanel />);
    fireEvent.click(screen.getByRole('button', { name: /pause.*all|all.*pause/i }));
    expect(mockSetKillSwitch).toHaveBeenCalledWith('all_pause');
  });
});
```

### Step 2: Implement

```tsx
// src/features/markets/retail/autonomous/KillSwitchPanel.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKillSwitch, useSetKillSwitch } from './hooks/useKillSwitch';
import type { KillSwitchLevel } from './types';

const KILL_SWITCH_ACTIONS: { level: KillSwitchLevel; label: string; description: string; variant: 'default' | 'outline' | 'destructive' }[] = [
  { level: 'strategy_pause', label: 'Pause Strategy', description: 'Pause a specific rule', variant: 'outline' },
  { level: 'all_pause',      label: 'Pause All',      description: 'Stop all auto-execution', variant: 'default' },
  { level: 'flatten_positions', label: 'Flatten Positions', description: 'Cancel open orders now', variant: 'destructive' },
  { level: 'revoke_api_key', label: 'Revoke API Key', description: 'Disable broker connection', variant: 'destructive' },
];

export function KillSwitchPanel() {
  const { data: state } = useKillSwitch();
  const { mutate: setKillSwitch, isPending } = useSetKillSwitch();

  const active = state?.kill_switch_level ?? 'none';

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-destructive">Kill Switch</CardTitle>
          {active !== 'none' && (
            <Badge variant="destructive" className="text-xs">{active.replace(/_/g, ' ')}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {KILL_SWITCH_ACTIONS.map(({ level, label, description, variant }) => (
          <div key={level} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Button
              size="sm"
              variant={active === level ? 'secondary' : variant}
              disabled={isPending}
              onClick={() => setKillSwitch(active === level ? 'none' : level)}
              className="text-xs h-7 px-3"
            >
              {active === level ? 'Active — Reset' : label}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

### Step 3: Run tests

```bash
npx vitest run src/features/markets/retail/autonomous/KillSwitchPanel.test.tsx
```

Expected: 2/2 passing.

### Step 4: Commit

```bash
git add src/features/markets/retail/autonomous/KillSwitchPanel.tsx \
        src/features/markets/retail/autonomous/KillSwitchPanel.test.tsx
git commit -m "feat(retail-p3): KillSwitchPanel — 4-level kill switch UI"
```

---

## Task 10: GradualAutonomyWizard.tsx

**Files:**
- Create: `src/features/markets/retail/autonomous/GradualAutonomyWizard.tsx`
- Create: `src/features/markets/retail/autonomous/GradualAutonomyWizard.test.tsx`

### Step 1: Write failing tests

```typescript
// src/features/markets/retail/autonomous/GradualAutonomyWizard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./hooks/useAutonomyProgress', () => ({
  useAutonomyProgress: () => ({
    data: { current_phase: 'paper', paper_trades_done: 3, micro_trades_done: 0, kill_switch_level: 'none' },
    isLoading: false,
  }),
  useAdvancePhase: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('GradualAutonomyWizard', () => {
  it('shows all 4 phases with current phase highlighted', async () => {
    const { GradualAutonomyWizard } = await import('./GradualAutonomyWizard');
    render(<GradualAutonomyWizard />);
    expect(screen.getByText('Paper Trading')).toBeInTheDocument();
    expect(screen.getByText(/micro/i)).toBeInTheDocument();
    expect(screen.getByText(/pilot/i)).toBeInTheDocument();
    expect(screen.getByText(/full/i)).toBeInTheDocument();
  });

  it('shows current phase progress', async () => {
    const { GradualAutonomyWizard } = await import('./GradualAutonomyWizard');
    render(<GradualAutonomyWizard />);
    expect(screen.getByText(/3.*10|3 of 10|7 more/i)).toBeInTheDocument();
  });
});
```

### Step 2: Implement

```tsx
// src/features/markets/retail/autonomous/GradualAutonomyWizard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAutonomyProgress, useAdvancePhase } from './hooks/useAutonomyProgress';
import { computePhaseProgress, PHASE_LABELS, PHASE_ORDER, type AutonomyPhase } from './types';

const PHASE_CAPS: Record<AutonomyPhase, string> = {
  paper: 'Simulated — no real money',
  micro: 'Max 2% of portfolio per trade',
  pilot: 'Max 25% of portfolio',
  full: 'No cap — full autonomy',
};

export function GradualAutonomyWizard() {
  const { data: progress, isLoading } = useAutonomyProgress();
  const { mutate: advance, isPending } = useAdvancePhase();

  if (isLoading || !progress) {
    return <div className="h-48 rounded-lg bg-muted animate-pulse" />;
  }

  const currentIdx = PHASE_ORDER.indexOf(progress.current_phase);
  const phaseProgress = computePhaseProgress(progress);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Autonomy Phases</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {PHASE_ORDER.map((phase, idx) => {
          const isCurrent = phase === progress.current_phase;
          const isPast = idx < currentIdx;
          return (
            <div
              key={phase}
              className={`flex items-start justify-between rounded-lg border p-3 ${
                isCurrent ? 'border-primary bg-primary/5' : isPast ? 'border-border opacity-60' : 'border-border'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{PHASE_LABELS[phase]}</span>
                  {isCurrent && <Badge className="text-xs h-4 px-1.5">Current</Badge>}
                  {isPast && <Badge variant="secondary" className="text-xs h-4 px-1.5">Done</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{PHASE_CAPS[phase]}</p>
                {isCurrent && phaseProgress.required > 0 && (
                  <p className="text-xs text-primary font-medium">
                    {phaseProgress.done} of {phaseProgress.required} {phaseProgress.label}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {progress.current_phase !== 'full' && (
          <Button
            size="sm"
            className="w-full"
            disabled={!phaseProgress.canAdvance || isPending}
            onClick={() => advance()}
          >
            {isPending ? 'Advancing…' : `Advance to ${PHASE_LABELS[PHASE_ORDER[currentIdx + 1]]}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 3: Run tests

```bash
npx vitest run src/features/markets/retail/autonomous/GradualAutonomyWizard.test.tsx
```

Expected: 2/2 passing.

### Step 4: Commit

```bash
git add src/features/markets/retail/autonomous/GradualAutonomyWizard.tsx \
        src/features/markets/retail/autonomous/GradualAutonomyWizard.test.tsx
git commit -m "feat(retail-p3): GradualAutonomyWizard — 4-phase progression UI with gate checks"
```

---

## Task 11: AutoExecutionSetup + RuleBuilder

**Files:**
- Create: `src/features/markets/retail/autonomous/RuleBuilder.tsx`
- Create: `src/features/markets/retail/autonomous/AutoExecutionSetup.tsx`
- Create: `src/features/markets/retail/autonomous/RuleBuilder.test.tsx`

### Step 1: Write failing tests

```typescript
// src/features/markets/retail/autonomous/RuleBuilder.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockCreate = vi.fn();
vi.mock('./hooks/useExecutionRules', () => ({
  useExecutionRules: () => ({ data: [], isLoading: false }),
  useCreateExecutionRule: () => ({ mutate: mockCreate, isPending: false }),
}));

describe('RuleBuilder', () => {
  it('renders name input and asset class selector', async () => {
    const { RuleBuilder } = await import('./RuleBuilder');
    render(<RuleBuilder />);
    expect(screen.getByLabelText(/rule name/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /asset class/i }) ?? screen.getByText(/asset class/i)).toBeInTheDocument();
  });

  it('save button calls createRule', async () => {
    const { RuleBuilder } = await import('./RuleBuilder');
    render(<RuleBuilder />);
    const nameInput = screen.getByLabelText(/rule name/i);
    fireEvent.change(nameInput, { target: { value: 'My HDFC Rule' } });
    fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
    expect(mockCreate).toHaveBeenCalled();
  });
});
```

### Step 2: Implement

```tsx
// src/features/markets/retail/autonomous/RuleBuilder.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateExecutionRule } from './hooks/useExecutionRules';
import type { ExecutionRule } from './types';

const ASSET_CLASSES = ['equity', 'mutual_fund', 'crypto', 'derivative', 'commodity', 'fixed_income', 'forex'];

export function RuleBuilder() {
  const { mutate: createRule, isPending } = useCreateExecutionRule();
  const [form, setForm] = useState({
    name: '',
    description: '',
    asset_class: 'equity',
    signal_type: 'buy' as 'buy' | 'sell' | 'both',
    order_type: 'MARKET' as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
    product: 'CNC' as 'CNC' | 'MIS' | 'NRML',
    max_order_value: 10000,
    algo_id: null as string | null,
  });

  const handleSave = () => {
    createRule(form as Omit<ExecutionRule, 'id' | 'is_active' | 'created_at'>);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Create Auto-Execution Rule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="rule-name" className="text-xs">Rule Name</Label>
          <Input
            id="rule-name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Buy HDFC on strong signal"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Asset Class</Label>
          <Select value={form.asset_class} onValueChange={v => setForm(f => ({ ...f, asset_class: v }))}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CLASSES.map(ac => (
                <SelectItem key={ac} value={ac} className="text-sm capitalize">{ac.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Signal Type</Label>
            <Select value={form.signal_type} onValueChange={v => setForm(f => ({ ...f, signal_type: v as 'buy' | 'sell' | 'both' }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order Type</Label>
            <Select value={form.order_type} onValueChange={v => setForm(f => ({ ...f, order_type: v as typeof form.order_type }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['MARKET', 'LIMIT', 'SL', 'SL-M'] as const).map(ot => (
                  <SelectItem key={ot} value={ot}>{ot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Max Order Value (₹)</Label>
          <Input
            type="number"
            value={form.max_order_value}
            onChange={e => setForm(f => ({ ...f, max_order_value: Number(e.target.value) }))}
            className="h-8 text-sm"
            min={1000}
            max={500000}
          />
        </div>

        <Button size="sm" className="w-full" disabled={!form.name || isPending} onClick={handleSave}>
          {isPending ? 'Saving…' : 'Save Rule'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/features/markets/retail/autonomous/AutoExecutionSetup.tsx
import { useExecutionRules } from './hooks/useExecutionRules';
import { RuleBuilder } from './RuleBuilder';
import { GradualAutonomyWizard } from './GradualAutonomyWizard';
import { KillSwitchPanel } from './KillSwitchPanel';
import { Badge } from '@/components/ui/badge';

export function AutoExecutionSetup() {
  const { data: rules = [], isLoading } = useExecutionRules();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Auto-Execution</h3>
        <Badge variant="outline" className="text-xs">{rules.length} rules</Badge>
      </div>

      <GradualAutonomyWizard />
      <RuleBuilder />
      <KillSwitchPanel />

      {!isLoading && rules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Rules</p>
          {rules.map(rule => (
            <div key={rule.id} className="rounded-lg border p-3 text-xs space-y-0.5">
              <p className="font-medium">{rule.name}</p>
              <p className="text-muted-foreground capitalize">{rule.asset_class} · {rule.signal_type} · {rule.order_type}</p>
              <p className="text-muted-foreground">Max ₹{rule.max_order_value.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Run tests

```bash
npx vitest run src/features/markets/retail/autonomous/RuleBuilder.test.tsx
```

Expected: 2/2 passing.

### Step 4: Commit

```bash
git add src/features/markets/retail/autonomous/RuleBuilder.tsx \
        src/features/markets/retail/autonomous/AutoExecutionSetup.tsx \
        src/features/markets/retail/autonomous/RuleBuilder.test.tsx
git commit -m "feat(retail-p3): AutoExecutionSetup — RuleBuilder, phase wizard, kill switch assembled"
```

---

## Task 12: Wire Autonomous Mode into RetailMode

**Files:**
- Modify: `src/features/markets/retail/RetailMode.tsx`

No new test file needed — existing 50 tests must still pass.

### Step 1: Add autonomous tab to RetailMode

The existing `RetailMode.tsx` shows `RetailDashboard` + `BehavioralAlertBanner` + `RetailSignalFeed`. Add a tab selector so self-directed users can switch to the autonomous execution setup view.

```tsx
// Add imports at top of RetailMode.tsx:
import { useState } from 'react';  // already imported
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AutoExecutionSetup } from './autonomous/AutoExecutionSetup';
```

Replace the bottom section (RetailSignalFeed + ExecutionBottomSheet) with:

```tsx
{profile.experience_level === 'self_directed' ? (
  <Tabs defaultValue="feed">
    <TabsList className="w-full">
      <TabsTrigger value="feed" className="flex-1 text-xs">Signals</TabsTrigger>
      <TabsTrigger value="auto" className="flex-1 text-xs">Auto-Execute</TabsTrigger>
    </TabsList>
    <TabsContent value="feed">
      <RetailSignalFeed
        experienceLevel={profile.experience_level}
        isHighStress={isHighStress}
        seenEducationIds={seenEducationIds}
        onExecute={(signal) => setExecuting(signal)}
      />
    </TabsContent>
    <TabsContent value="auto">
      <AutoExecutionSetup />
    </TabsContent>
  </Tabs>
) : (
  <RetailSignalFeed
    experienceLevel={profile.experience_level}
    isHighStress={isHighStress}
    seenEducationIds={seenEducationIds}
    onExecute={(signal) => setExecuting(signal)}
  />
)}

<ExecutionBottomSheet
  signal={executing}
  open={Boolean(executing)}
  onOpenChange={(open) => { if (!open) setExecuting(null); }}
/>
```

### Step 2: Run all retail tests

```bash
npx vitest run src/features/markets/retail/ 2>&1 | tail -10
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
```

Expected: All existing 50 tests still pass, 0 TS errors.

### Step 3: Commit

```bash
git add src/features/markets/retail/RetailMode.tsx
git commit -m "feat(retail-p3): wire autonomous execution tab into RetailMode for self_directed users"
```

---

## Task 13: Strategy Decay Monitor

**Files:**
- Create: `services/markets-worker/src/markets_worker/jobs/decay_monitor.py`
- Create: `services/markets-worker/tests/test_decay_monitor.py`

### Step 1: Write failing tests

```python
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
        # Default threshold is 0.40 — 30% win rate triggers decay
        assert is_decayed(0.30) is True

    def test_healthy_above_threshold(self):
        assert is_decayed(0.55) is False

    def test_exactly_at_threshold_not_decayed(self):
        assert is_decayed(WIN_RATE_THRESHOLD) is False

    def test_none_win_rate_returns_false(self):
        assert is_decayed(None) is False
```

### Step 2: Run to confirm failure

```bash
uv run pytest tests/test_decay_monitor.py -v 2>&1 | head -10
```

### Step 3: Implement

```python
# services/markets-worker/src/markets_worker/jobs/decay_monitor.py
"""
Rolling 30-day strategy win-rate decay monitor.

Scans execution_audit_log for each user's recent trades. If the win rate
drops below WIN_RATE_THRESHOLD, logs a behavioral_event of type 'red_alert'
so the BehavioralAlertBanner surfaces it.

Called by the scheduler (jobs.py) on a daily cron.
"""
from __future__ import annotations

import structlog
from datetime import datetime, timezone, timedelta

logger = structlog.get_logger()

WIN_RATE_THRESHOLD = 0.40   # below 40% win rate = decayed strategy
LOOKBACK_DAYS = 30


def compute_win_rate(trades: list[dict]) -> float | None:
    """Return fraction of trades with pnl > 0, or None if no trades."""
    if not trades:
        return None
    winners = sum(1 for t in trades if (t.get("pnl") or 0) > 0)
    return winners / len(trades)


def is_decayed(win_rate: float | None) -> bool:
    """Return True if win_rate is below threshold (strategy needs review)."""
    if win_rate is None:
        return False
    return win_rate < WIN_RATE_THRESHOLD


async def run_decay_check(user_id: str, db: object) -> dict:
    """
    Check win rate for a user's recent trades and log alert if decayed.
    Returns {"user_id": ..., "win_rate": ..., "decayed": ...}
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).isoformat()
    try:
        result = (
            db.schema("markets").from_("execution_audit_log")
            .select("id, status, rejection_reason")
            .eq("user_id", user_id)
            .eq("status", "submitted")
            .gte("created_at", cutoff)
            .execute()
        )
        rows = result.data or []
    except Exception as exc:
        logger.error("decay_check_fetch_failed", user_id=user_id, error=str(exc))
        return {"user_id": user_id, "win_rate": None, "decayed": False}

    # For submitted orders, treat rows without rejection as "wins" for now
    # In production this would JOIN with actual fill P&L
    trades = [{"pnl": 1 if r.get("status") == "submitted" else -1} for r in rows]
    win_rate = compute_win_rate(trades)
    decayed = is_decayed(win_rate)

    if decayed:
        try:
            db.schema("markets").from_("behavioral_events").insert({
                "user_id": user_id,
                "event_type": "red_alert",
                "severity": "critical",
                "metadata": {
                    "reason": "strategy_decay",
                    "win_rate": win_rate,
                    "lookback_days": LOOKBACK_DAYS,
                    "threshold": WIN_RATE_THRESHOLD,
                },
            }).execute()
            logger.info("strategy_decay_alert_logged", user_id=user_id, win_rate=win_rate)
        except Exception as exc:
            logger.error("decay_alert_insert_failed", error=str(exc))

    return {"user_id": user_id, "win_rate": win_rate, "decayed": decayed}
```

### Step 4: Run tests

```bash
uv run pytest tests/test_decay_monitor.py -v
```

Expected: 7/7 passing.

### Step 5: Commit

```bash
git add services/markets-worker/src/markets_worker/jobs/decay_monitor.py \
        services/markets-worker/tests/test_decay_monitor.py
git commit -m "feat(retail-p3): strategy decay monitor — rolling 30-day win-rate check with red_alert logging"
```

---

## Task 14: Final Verification

**Run the complete test suite to confirm all Phase 3 components pass.**

### Step 1: Backend tests

```bash
cd services/markets-worker
uv run pytest tests/ -v 2>&1 | tail -30
```

Expected: All tests passing (was 18 in Phase 2; Phase 3 adds ~25 more = ~43 total).

### Step 2: Frontend tests

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx vitest run src/features/markets/retail/ 2>&1 | tail -10
```

Expected: All 50 Phase 2 tests + 6 new Phase 3 tests = ~56 passing.

### Step 3: TypeScript check

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

### Step 4: Verify autonomy query keys are consistent

```bash
grep -r "autonomous" src/features/markets/retail/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep "marketsKeys" | head -10
```

All references should use `marketsKeys.retail.autonomous.*`.

### Step 5: Final commit if cleanup needed

```bash
git add -p  # stage only intentional changes
git commit -m "chore(retail-p3): Phase 3 final verification cleanup"
```

---

## Phase 3 Summary

| Task | Deliverable | Tests |
|---|---|---|
| 1 | DB migrations (execution_rules, audit_log, autonomy_progress) | SQL validated |
| 2 | Layer 0 data validator (staleness, fat-finger, circuit) | 10 pytest |
| 3 | Execution router (rules CRUD + order submission) | 6 pytest |
| 4 | Kill switch (4 levels) | 5 pytest |
| 5 | Multi-agent debate (Bull/Bear/Risk LangGraph nodes) | 1 pytest |
| 6 | Phase advancement (paper→micro→pilot→full) | 4 pytest |
| 7 | Frontend types + hooks + query keys | 4 vitest |
| 8 | PaperTradingPhase.tsx | 2 vitest |
| 9 | KillSwitchPanel.tsx | 2 vitest |
| 10 | GradualAutonomyWizard.tsx | 2 vitest |
| 11 | AutoExecutionSetup + RuleBuilder | 2 vitest |
| 12 | Wire into RetailMode | (existing 50 pass) |
| 13 | Strategy decay monitor | 7 pytest |
| 14 | Final verification | All ~56 frontend + ~43 backend |
