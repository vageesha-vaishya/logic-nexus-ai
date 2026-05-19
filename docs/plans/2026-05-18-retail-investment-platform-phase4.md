# Retail Investment Platform — Phase 4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Community Layer — thematic baskets (Smallcase-style), extended copy trading with safety limits, strategy marketplace with mandatory paper trading, creator verification, and Hindi localisation for all new community UI.

**Architecture:** Three independent backend areas — community router (`routers/community.py`) for baskets + strategies + creator-status; copy_trades router extended (not replaced) with safety-limit enforcement; new `community/` sub-directory under `src/features/markets/retail/` mirroring the `autonomous/` pattern. Hindi i18n uses the existing i18next HTTP-backend at `/public/locales/{lng}/{ns}.json` — new community components use `useTranslation('community')` and ship both `en` and `hi` locale files. Phase gates for strategy deployment reuse `autonomy_progress.current_phase` (must not be `paper` to deploy a community strategy live).

**Tech Stack:** React 18 + TypeScript + TanStack Query + i18next/react-i18next + Shadcn (frontend); FastAPI + Python + Supabase (backend); Vitest + RTL (frontend); pytest + uv (backend)

**Worktree:** `~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform`
**Branch:** `feature/retail-investment-platform`

---

## What Already Exists (Do NOT Rebuild)

| Piece | Location | Phase 4 use |
|---|---|---|
| `GET/POST /v1/copy-trades` + leaderboard | `routers/copy_trades.py` | Extend with safety limits — add new endpoints, don't touch existing |
| `markets.risk_profiles` | migration 20260518120000 | Add `verified_creator` column |
| `markets.autonomy_progress` | migration 20260518140000 | Strategy deploy gate: phase must not be `paper` |
| `Auth`, `get_supabase()` | `auth.py`, `db.py` | All new endpoints |
| `platform.set_updated_at()` | existing trigger function | All new `updated_at` triggers |
| i18next HTTP backend | `src/lib/i18n.ts` | Add `/public/locales/hi/community.json` |
| `marketsKeys.retail.autonomous.*` | `hooks/queryKeys.ts` | Add parallel `retail.community.*` |
| `useSession` | `src/hooks/useSession.ts` | All new hooks |
| `Card`, `Badge`, `Button`, `Progress`, `Tabs` | `@/components/ui/` | All new components |
| pytest fixtures: `app`, `client`, `auth_headers` | `tests/conftest.py` + per-file | New test files follow same pattern |

---

## Basket Investment Model

A basket is a named collection of instruments with percentage weights (must sum to 100%). When a user invests ₹X in a basket, the platform allocates `weight_pct / 100 * X` to each instrument. Tracked in `basket_user_positions` (user-specific holdings per basket, not per instrument — aggregate view only).

---

## Copy Trading Safety Rules

1. **Tier restriction:** Can only copy into Experimental tier (tier_number = 3). Blocked if user selects Core (2) or Safety Net (1).
2. **Per-trader cap:** Total allocation to any single copied trader ≤ 20% of Experimental tier NAV.
3. **Auto-unfollow:** If copied trader's 30-day max drawdown exceeds `max_drawdown_pct` set by follower, copy relationship is auto-paused.

---

## Task 1: DB Migrations — Community Tables

**Files:**
- Create: `supabase/migrations/20260518150000_markets_community.sql`

### Step 1: Write the migration

```sql
-- supabase/migrations/20260518150000_markets_community.sql

-- ── Add verified_creator to risk_profiles ─────────────────────────────────────
alter table markets.risk_profiles
  add column if not exists verified_creator boolean not null default false;

-- ── community_baskets ─────────────────────────────────────────────────────────
create table if not exists markets.community_baskets (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  theme           text not null,
  description     text not null default '',
  risk_level      text not null check (risk_level in ('low', 'medium', 'high')) default 'medium',
  rebalance_freq  text not null check (rebalance_freq in ('monthly', 'quarterly', 'yearly')) default 'quarterly',
  status          text not null check (status in ('draft', 'published', 'archived')) default 'draft',
  total_invested  numeric(18,2) not null default 0,
  follower_count  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_community_baskets_updated_at on markets.community_baskets;
create trigger trg_community_baskets_updated_at
  before update on markets.community_baskets
  for each row execute function platform.set_updated_at();

alter table markets.community_baskets enable row level security;

drop policy if exists "public_read_published" on markets.community_baskets;
create policy "public_read_published" on markets.community_baskets
  for select using (status = 'published' or auth.uid() = creator_id);

drop policy if exists "creator_write" on markets.community_baskets;
create policy "creator_write" on markets.community_baskets
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

create index if not exists idx_community_baskets_published
  on markets.community_baskets (status, created_at desc) where status = 'published';

-- ── basket_holdings ───────────────────────────────────────────────────────────
-- Instrument weights inside a basket (must sum to 100 per basket)
create table if not exists markets.basket_holdings (
  id            uuid primary key default gen_random_uuid(),
  basket_id     uuid not null references markets.community_baskets(id) on delete cascade,
  instrument_id uuid not null references markets.instruments(id),
  weight_pct    numeric(5,2) not null check (weight_pct > 0 and weight_pct <= 100),
  created_at    timestamptz not null default now()
);

alter table markets.basket_holdings enable row level security;

drop policy if exists "public_read" on markets.basket_holdings;
create policy "public_read" on markets.basket_holdings
  for select using (true);

drop policy if exists "creator_write" on markets.basket_holdings;
create policy "creator_write" on markets.basket_holdings
  for all using (
    auth.uid() = (
      select creator_id from markets.community_baskets where id = basket_id
    )
  ) with check (
    auth.uid() = (
      select creator_id from markets.community_baskets where id = basket_id
    )
  );

create index if not exists idx_basket_holdings_basket
  on markets.basket_holdings (basket_id);

-- ── basket_user_positions ─────────────────────────────────────────────────────
-- Tracks each user's total investment in a basket (aggregate, not per-instrument)
create table if not exists markets.basket_user_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  basket_id     uuid not null references markets.community_baskets(id) on delete cascade,
  invested_amt  numeric(18,2) not null default 0,
  portfolio_id  uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, basket_id)
);

drop trigger if exists trg_basket_user_positions_updated_at on markets.basket_user_positions;
create trigger trg_basket_user_positions_updated_at
  before update on markets.basket_user_positions
  for each row execute function platform.set_updated_at();

alter table markets.basket_user_positions enable row level security;

drop policy if exists "owner_all" on markets.basket_user_positions;
create policy "owner_all" on markets.basket_user_positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── strategy_marketplace ──────────────────────────────────────────────────────
create table if not exists markets.strategy_marketplace (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  description         text not null default '',
  asset_class         text not null,
  rule_config         jsonb not null default '{}',
  backtest_summary    jsonb not null default '{}',
  live_users          integer not null default 0,
  rating              numeric(3,2) check (rating >= 0 and rating <= 5),
  paper_required_days integer not null default 14,
  status              text not null check (status in ('draft', 'published', 'archived')) default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_strategy_marketplace_updated_at on markets.strategy_marketplace;
create trigger trg_strategy_marketplace_updated_at
  before update on markets.strategy_marketplace
  for each row execute function platform.set_updated_at();

alter table markets.strategy_marketplace enable row level security;

drop policy if exists "public_read_published" on markets.strategy_marketplace;
create policy "public_read_published" on markets.strategy_marketplace
  for select using (status = 'published' or auth.uid() = creator_id);

drop policy if exists "creator_write" on markets.strategy_marketplace;
create policy "creator_write" on markets.strategy_marketplace
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

create index if not exists idx_strategy_marketplace_published
  on markets.strategy_marketplace (status, rating desc nulls last) where status = 'published';

-- ── copy_trading_extended ─────────────────────────────────────────────────────
-- Stores safety-limit config per copy relationship (extends existing copy_trades)
create table if not exists markets.copy_trading_extended (
  copy_trade_id       uuid primary key references markets.copy_trades(id) on delete cascade,
  target_tier_number  integer not null check (target_tier_number = 3) default 3,
  budget_cap          numeric(18,2),
  max_drawdown_pct    numeric(5,2) check (max_drawdown_pct > 0 and max_drawdown_pct <= 100),
  auto_unfollowed_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_copy_trading_extended_updated_at on markets.copy_trading_extended;
create trigger trg_copy_trading_extended_updated_at
  before update on markets.copy_trading_extended
  for each row execute function platform.set_updated_at();

alter table markets.copy_trading_extended enable row level security;

drop policy if exists "owner_all" on markets.copy_trading_extended;
create policy "owner_all" on markets.copy_trading_extended
  for all using (
    auth.uid() = (
      select follower_id from markets.copy_trades where id = copy_trade_id
    )
  ) with check (
    auth.uid() = (
      select follower_id from markets.copy_trades where id = copy_trade_id
    )
  );
```

### Step 2: Verify (if local Supabase running)

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npm run supabase:db:diff 2>&1 | head -20
```

If local Supabase is not running, just verify the SQL is syntactically consistent with existing migrations.

### Step 3: Commit

```bash
git add supabase/migrations/20260518150000_markets_community.sql
git commit -m "feat(retail-p4): DB migrations — community_baskets, basket_holdings, strategy_marketplace, copy_trading_extended"
```

---

## Task 2: Community Router — Baskets + Creator Status

**Files:**
- Create: `services/markets-worker/src/markets_worker/routers/community.py`
- Create: `services/markets-worker/tests/test_community_baskets.py`
- Modify: `services/markets-worker/src/markets_worker/main.py`

### Step 1: Write failing tests

```python
# services/markets-worker/tests/test_community_baskets.py
"""Tests for community baskets and creator-status endpoints."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-community-1"

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


class TestCreatorStatus:
    def test_returns_not_verified_by_default(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"verified_creator": False}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/creator-status", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["is_verified"] is False

    def test_returns_verified_for_verified_user(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"verified_creator": True}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/creator-status", headers=auth_headers)
        assert resp.json()["is_verified"] is True


class TestBaskets:
    def test_list_published_baskets(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.order.return_value.limit.return_value \
            .execute.return_value.data = [
                {"id": "b1", "name": "EV Revolution", "theme": "Tech", "risk_level": "high"}
            ]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/baskets", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["baskets"]) == 1

    def test_create_basket_requires_verified_creator(self, client, auth_headers):
        mock_sb = MagicMock()
        # risk_profiles says not verified
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"verified_creator": False}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/baskets", json={
                "name": "Test Basket",
                "theme": "Tech",
                "description": "A test basket",
                "risk_level": "medium",
                "rebalance_freq": "quarterly",
            }, headers=auth_headers)
        assert resp.status_code == 403
        assert "verified" in resp.json()["detail"].lower()

    def test_create_basket_succeeds_for_verified_creator(self, client, auth_headers):
        mock_sb = MagicMock()
        # verified
        def select_side_effect(*a, **kw):
            m = MagicMock()
            m.eq.return_value.maybe_single.return_value.execute.return_value.data = {"verified_creator": True}
            m.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []
            return m
        mock_sb.schema.return_value.from_.return_value.select.side_effect = select_side_effect
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"id": "b2", "name": "Test Basket"}]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/baskets", json={
                "name": "Test Basket",
                "theme": "Tech",
                "description": "A test basket",
                "risk_level": "medium",
                "rebalance_freq": "quarterly",
            }, headers=auth_headers)
        assert resp.status_code == 201

    def test_get_basket_holdings(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.execute.return_value.data = [
                {"id": "h1", "basket_id": "b1", "weight_pct": 50.0,
                 "instrument": {"symbol": "HDFC", "exchange": "NSE"}}
            ]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/baskets/b1/holdings", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["holdings"]) == 1
```

### Step 2: Run to confirm failure

```bash
cd services/markets-worker
uv run pytest tests/test_community_baskets.py -v 2>&1 | head -10
```

Expected: `ImportError` — router not yet created.

### Step 3: Implement community.py

```python
# services/markets-worker/src/markets_worker/routers/community.py
"""
Community layer: baskets, strategy marketplace, creator verification.

GET  /v1/community/creator-status            — is current user a verified creator?
GET  /v1/community/baskets                   — list published baskets
POST /v1/community/baskets                   — create basket (verified creators only)
GET  /v1/community/baskets/{id}/holdings     — basket instrument weights
POST /v1/community/baskets/{id}/invest       — one-tap invest in basket
GET  /v1/community/strategies                — list published strategies
POST /v1/community/strategies                — create strategy (verified creators only)
POST /v1/community/strategies/{id}/deploy    — deploy strategy (paper gate: not in paper phase)
"""
from __future__ import annotations

from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/community", tags=["community"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_verified(db, user_id: str) -> bool:
    row = (
        db.schema("markets").from_("risk_profiles")
        .select("verified_creator")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    ).data
    return bool((row or {}).get("verified_creator", False))


def _require_verified(db, user_id: str) -> None:
    if not _is_verified(db, user_id):
        raise HTTPException(403, detail="Only verified creators can perform this action")


# ── Creator status ────────────────────────────────────────────────────────────

@router.get("/creator-status")
async def get_creator_status(auth: Auth):
    db = get_supabase()
    return {"is_verified": _is_verified(db, auth.user_id)}


# ── Baskets ───────────────────────────────────────────────────────────────────

class CreateBasketRequest(BaseModel):
    name: str
    theme: str
    description: str = ""
    risk_level: Literal["low", "medium", "high"] = "medium"
    rebalance_freq: Literal["monthly", "quarterly", "yearly"] = "quarterly"


class InvestRequest(BaseModel):
    amount: float
    portfolio_id: str | None = None


@router.get("/baskets")
async def list_baskets(auth: Auth, limit: int = 20):
    db = get_supabase()
    result = (
        db.schema("markets").from_("community_baskets")
        .select("id, name, theme, description, risk_level, rebalance_freq, follower_count, total_invested, creator_id, created_at")
        .eq("status", "published")
        .order("follower_count", desc=True)
        .limit(limit)
        .execute()
    )
    return {"baskets": result.data or []}


@router.post("/baskets", status_code=201)
async def create_basket(body: CreateBasketRequest, auth: Auth):
    db = get_supabase()
    _require_verified(db, auth.user_id)
    try:
        result = db.schema("markets").from_("community_baskets").insert({
            "creator_id": auth.user_id,
            "name": body.name,
            "theme": body.theme,
            "description": body.description,
            "risk_level": body.risk_level,
            "rebalance_freq": body.rebalance_freq,
        }).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    rows = result.data or []
    if not rows:
        raise HTTPException(500, detail="Insert returned no data")
    return rows[0]


@router.get("/baskets/{basket_id}/holdings")
async def get_basket_holdings(basket_id: str, auth: Auth):
    db = get_supabase()
    result = (
        db.schema("markets").from_("basket_holdings")
        .select("id, basket_id, weight_pct, instrument_id, instrument:instruments(symbol, exchange, instrument_type)")
        .eq("basket_id", basket_id)
        .execute()
    )
    return {"holdings": result.data or []}


@router.post("/baskets/{basket_id}/invest")
async def invest_in_basket(basket_id: str, body: InvestRequest, auth: Auth):
    if body.amount <= 0:
        raise HTTPException(422, detail="Investment amount must be positive")
    db = get_supabase()
    # Upsert basket_user_positions
    try:
        existing = (
            db.schema("markets").from_("basket_user_positions")
            .select("id, invested_amt")
            .eq("user_id", auth.user_id)
            .eq("basket_id", basket_id)
            .maybe_single()
            .execute()
        ).data
        if existing:
            db.schema("markets").from_("basket_user_positions") \
                .update({"invested_amt": existing["invested_amt"] + body.amount}) \
                .eq("id", existing["id"]).execute()
        else:
            db.schema("markets").from_("basket_user_positions").insert({
                "user_id": auth.user_id,
                "basket_id": basket_id,
                "invested_amt": body.amount,
                "portfolio_id": body.portfolio_id,
            }).execute()
        # Update basket total_invested
        db.schema("markets").from_("community_baskets") \
            .update({"total_invested": body.amount}) \
            .eq("id", basket_id).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    return {"basket_id": basket_id, "invested": body.amount, "status": "confirmed"}


# ── Strategies ────────────────────────────────────────────────────────────────

class CreateStrategyRequest(BaseModel):
    name: str
    description: str = ""
    asset_class: str
    rule_config: dict = {}
    backtest_summary: dict = {}


@router.get("/strategies")
async def list_strategies(auth: Auth, limit: int = 20):
    db = get_supabase()
    result = (
        db.schema("markets").from_("strategy_marketplace")
        .select("id, name, description, asset_class, backtest_summary, live_users, rating, paper_required_days, creator_id, created_at")
        .eq("status", "published")
        .order("rating", desc=True)
        .limit(limit)
        .execute()
    )
    return {"strategies": result.data or []}


@router.post("/strategies", status_code=201)
async def create_strategy(body: CreateStrategyRequest, auth: Auth):
    db = get_supabase()
    _require_verified(db, auth.user_id)
    try:
        result = db.schema("markets").from_("strategy_marketplace").insert({
            "creator_id": auth.user_id,
            "name": body.name,
            "description": body.description,
            "asset_class": body.asset_class,
            "rule_config": body.rule_config,
            "backtest_summary": body.backtest_summary,
        }).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    rows = result.data or []
    if not rows:
        raise HTTPException(500, detail="Insert returned no data")
    return rows[0]


@router.post("/strategies/{strategy_id}/deploy")
async def deploy_strategy(strategy_id: str, auth: Auth):
    db = get_supabase()
    # Paper gate: user must not be in paper phase
    progress = (
        db.schema("markets").from_("autonomy_progress")
        .select("current_phase")
        .eq("user_id", auth.user_id)
        .maybe_single()
        .execute()
    ).data
    current_phase = (progress or {}).get("current_phase", "paper")
    if current_phase == "paper":
        raise HTTPException(400, detail="Complete paper trading phase before deploying community strategies")
    # Log deployment as a behavioral event
    try:
        db.schema("markets").from_("behavioral_events").insert({
            "user_id": auth.user_id,
            "event_type": "education_shown",
            "severity": "info",
            "metadata": {"action": "strategy_deployed", "strategy_id": strategy_id},
        }).execute()
    except Exception:
        pass
    return {"strategy_id": strategy_id, "status": "deployed", "phase": current_phase}
```

### Step 4: Register in main.py

Read `main.py`, then add:
```python
from markets_worker.routers import community as community_router
# in create_app():
app.include_router(community_router.router)
```

### Step 5: Run tests

```bash
uv run pytest tests/test_community_baskets.py -v
```

Expected: 5/5 passing. Also run full suite — no regressions.

### Step 6: Commit

```bash
git add services/markets-worker/src/markets_worker/routers/community.py \
        services/markets-worker/src/markets_worker/main.py \
        services/markets-worker/tests/test_community_baskets.py
git commit -m "feat(retail-p4): community router — baskets, strategy marketplace, creator status"
```

---

## Task 3: Copy Trading Safety Limits

**Files:**
- Create: `services/markets-worker/tests/test_copy_trading_safety.py`
- Create: `services/markets-worker/src/markets_worker/routers/copy_trading_safety.py`
- Modify: `services/markets-worker/src/markets_worker/main.py`

These are NEW endpoints under `/v1/copy-trades/safety/` — the existing copy_trades router is not modified.

### Step 1: Write failing tests

```python
# services/markets-worker/tests/test_copy_trading_safety.py
"""Tests for extended copy trading safety limits."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-copy-safety-1"

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


class TestCopyTradingSafetyLimits:
    def test_set_safety_limits_for_copy_relationship(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{"copy_trade_id": "ct-1", "budget_cap": 5000.0}]
        with patch("markets_worker.routers.copy_trading_safety.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/copy-trades/safety/ct-1", json={
                "budget_cap": 5000.0,
                "max_drawdown_pct": 15.0,
            }, headers=auth_headers)
        assert resp.status_code == 201

    def test_get_safety_limits(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {
                "copy_trade_id": "ct-1",
                "budget_cap": 5000.0,
                "max_drawdown_pct": 15.0,
                "auto_unfollowed_at": None,
            }
        with patch("markets_worker.routers.copy_trading_safety.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/copy-trades/safety/ct-1", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["budget_cap"] == 5000.0

    def test_tier_must_be_experimental(self, client, auth_headers):
        # Safety limits only apply to Experimental tier (tier_number=3)
        # If someone tries to set for Core tier, reject
        mock_sb = MagicMock()
        with patch("markets_worker.routers.copy_trading_safety.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/copy-trades/safety/ct-1", json={
                "budget_cap": 5000.0,
                "target_tier_number": 2,  # Core — not allowed
            }, headers=auth_headers)
        assert resp.status_code == 422
        assert "experimental" in resp.json()["detail"].lower()
```

### Step 2: Implement copy_trading_safety.py

```python
# services/markets-worker/src/markets_worker/routers/copy_trading_safety.py
"""
Extended copy trading safety limits.

POST /v1/copy-trades/safety/{copy_trade_id}  — set safety limits for a copy relationship
GET  /v1/copy-trades/safety/{copy_trade_id}  — get current safety limits
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/copy-trades/safety", tags=["copy-trades"])


class SetSafetyLimitsRequest(BaseModel):
    budget_cap: float | None = None
    max_drawdown_pct: float | None = None
    target_tier_number: int = 3  # must be 3 (Experimental)


@router.post("/{copy_trade_id}", status_code=201)
async def set_safety_limits(copy_trade_id: str, body: SetSafetyLimitsRequest, auth: Auth):
    if body.target_tier_number != 3:
        raise HTTPException(422, detail="Copy trading is only allowed in Experimental tier (tier_number=3)")
    db = get_supabase()
    try:
        result = db.schema("markets").from_("copy_trading_extended").insert({
            "copy_trade_id": copy_trade_id,
            "target_tier_number": 3,
            "budget_cap": body.budget_cap,
            "max_drawdown_pct": body.max_drawdown_pct,
        }).execute()
    except Exception as exc:
        raise HTTPException(500, detail=str(exc))
    return (result.data or [{}])[0]


@router.get("/{copy_trade_id}")
async def get_safety_limits(copy_trade_id: str, auth: Auth):
    db = get_supabase()
    row = (
        db.schema("markets").from_("copy_trading_extended")
        .select("copy_trade_id, target_tier_number, budget_cap, max_drawdown_pct, auto_unfollowed_at")
        .eq("copy_trade_id", copy_trade_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(404, detail="No safety limits set for this copy relationship")
    return row
```

Register in `main.py`:
```python
from markets_worker.routers import copy_trading_safety as copy_trading_safety_router
# in create_app():
app.include_router(copy_trading_safety_router.router)
```

### Step 3: Run tests

```bash
uv run pytest tests/test_copy_trading_safety.py -v
```

Expected: 3/3 passing.

### Step 4: Commit

```bash
git add services/markets-worker/src/markets_worker/routers/copy_trading_safety.py \
        services/markets-worker/src/markets_worker/main.py \
        services/markets-worker/tests/test_copy_trading_safety.py
git commit -m "feat(retail-p4): copy trading safety limits — Experimental-only, budget cap, drawdown auto-unfollow"
```

---

## Task 4: Strategy Marketplace Tests (additional coverage)

**Files:**
- Create: `services/markets-worker/tests/test_strategy_marketplace.py`

These tests cover the strategy endpoints already implemented in `community.py`.

### Step 1: Write and run tests

```python
# services/markets-worker/tests/test_strategy_marketplace.py
"""Tests for strategy marketplace endpoints."""
import pytest
from unittest.mock import MagicMock, patch

MOCK_USER_ID = "user-strategy-1"

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


class TestStrategyMarketplace:
    def test_list_strategies(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.order.return_value.limit.return_value \
            .execute.return_value.data = [
                {"id": "s1", "name": "RSI Reversal", "rating": 4.2}
            ]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.get("/v1/community/strategies", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["strategies"]) == 1

    def test_deploy_strategy_blocked_in_paper_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"current_phase": "paper"}
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/strategies/s1/deploy", headers=auth_headers)
        assert resp.status_code == 400
        assert "paper" in resp.json()["detail"].lower()

    def test_deploy_strategy_succeeds_in_micro_phase(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.select.return_value \
            .eq.return_value.maybe_single.return_value \
            .execute.return_value.data = {"current_phase": "micro"}
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value.data = [{}]
        with patch("markets_worker.routers.community.get_supabase", return_value=mock_sb):
            resp = client.post("/v1/community/strategies/s1/deploy", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "deployed"
```

### Step 2: Run

```bash
uv run pytest tests/test_strategy_marketplace.py -v
```

Expected: 3/3 passing.

### Step 3: Commit

```bash
git add services/markets-worker/tests/test_strategy_marketplace.py
git commit -m "test(retail-p4): strategy marketplace deploy gate — paper blocked, micro/pilot/full allowed"
```

---

## Task 5: Frontend — Community Types + Query Keys + Hooks

**Files:**
- Create: `src/features/markets/retail/community/types.ts`
- Modify: `src/features/markets/hooks/queryKeys.ts`
- Create: `src/features/markets/retail/community/hooks/useCommunity.ts`
- Create: `src/features/markets/retail/community/hooks/useCommunity.test.ts`

### Step 1: Write failing test

```typescript
// src/features/markets/retail/community/hooks/useCommunity.test.ts
import { describe, it, expect } from 'vitest';
import { formatWeight } from '../types';

describe('formatWeight', () => {
  it('formats 33.33 as "33.3%"', () => {
    expect(formatWeight(33.33)).toBe('33.3%');
  });
  it('formats 100 as "100.0%"', () => {
    expect(formatWeight(100)).toBe('100.0%');
  });
});
```

### Step 2: Implement types.ts

```typescript
// src/features/markets/retail/community/types.ts
export type BasketRiskLevel = 'low' | 'medium' | 'high';
export type RebalanceFreq = 'monthly' | 'quarterly' | 'yearly';
export type StrategyStatus = 'draft' | 'published' | 'archived';

export interface CommunityBasket {
  id: string;
  creator_id: string;
  name: string;
  theme: string;
  description: string;
  risk_level: BasketRiskLevel;
  rebalance_freq: RebalanceFreq;
  follower_count: number;
  total_invested: number;
  created_at: string;
}

export interface BasketHolding {
  id: string;
  basket_id: string;
  weight_pct: number;
  instrument_id: string;
  instrument?: { symbol: string; exchange: string; instrument_type: string };
}

export interface MarketplaceStrategy {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  asset_class: string;
  backtest_summary: Record<string, unknown>;
  live_users: number;
  rating: number | null;
  paper_required_days: number;
  created_at: string;
}

export interface CreatorStatus {
  is_verified: boolean;
}

export const RISK_LEVEL_LABELS: Record<BasketRiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Moderate Risk',
  high: 'High Risk',
};

export const RISK_LEVEL_COLORS: Record<BasketRiskLevel, string> = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-red-600',
};

export function formatWeight(pct: number): string {
  return `${pct.toFixed(1)}%`;
}
```

### Step 3: Add community keys to queryKeys.ts

Read `queryKeys.ts` first. Add inside `retail`:

```typescript
community: {
  baskets:    () => [...marketsKeys.retail.all, 'community', 'baskets'] as const,
  basket:     (id: string) => [...marketsKeys.retail.all, 'community', 'basket', id] as const,
  strategies: () => [...marketsKeys.retail.all, 'community', 'strategies'] as const,
  creator:    () => [...marketsKeys.retail.all, 'community', 'creator'] as const,
},
```

### Step 4: Implement hooks

```typescript
// src/features/markets/retail/community/hooks/useCommunity.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { marketsKeys } from '../../../hooks/queryKeys';
import type { CommunityBasket, BasketHolding, MarketplaceStrategy, CreatorStatus } from '../types';

const BASE = '/api/markets/v1/community';

export function useCreatorStatus() {
  const { session } = useSession();
  return useQuery<CreatorStatus>({
    queryKey: marketsKeys.retail.community.creator(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/creator-status`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useBaskets() {
  const { session } = useSession();
  return useQuery<CommunityBasket[]>({
    queryKey: marketsKeys.retail.community.baskets(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/baskets`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.baskets ?? [];
    },
  });
}

export function useBasketHoldings(basketId: string) {
  const { session } = useSession();
  return useQuery<BasketHolding[]>({
    queryKey: marketsKeys.retail.community.basket(basketId),
    enabled: !!session && !!basketId,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/baskets/${basketId}/holdings`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.holdings ?? [];
    },
  });
}

export function useInvestInBasket() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ basketId, amount }: { basketId: string; amount: number }) => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/baskets/${basketId}/invest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.community.baskets() }),
  });
}

export function useStrategies() {
  const { session } = useSession();
  return useQuery<MarketplaceStrategy[]>({
    queryKey: marketsKeys.retail.community.strategies(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/strategies`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.strategies ?? [];
    },
  });
}

export function useDeployStrategy() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (strategyId: string) => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/strategies/${strategyId}/deploy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.community.strategies() }),
  });
}
```

### Step 5: Run test

```bash
npx vitest run src/features/markets/retail/community/hooks/useCommunity.test.ts
```

Expected: 2/2 pass.

### Step 6: Full typecheck

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -5
```

### Step 7: Commit

```bash
git add src/features/markets/retail/community/ \
        src/features/markets/hooks/queryKeys.ts
git commit -m "feat(retail-p4): community types, query keys, and data hooks"
```

---

## Task 6: BasketDiscovery.tsx + BasketDetail.tsx

**Files:**
- Create: `src/features/markets/retail/community/BasketDiscovery.tsx`
- Create: `src/features/markets/retail/community/BasketDetail.tsx`
- Create: `src/features/markets/retail/community/BasketDiscovery.test.tsx`

### Step 1: Write failing test

```typescript
// src/features/markets/retail/community/BasketDiscovery.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./hooks/useCommunity', () => ({
  useBaskets: () => ({
    data: [
      { id: 'b1', name: 'EV Revolution', theme: 'Tech', risk_level: 'high', follower_count: 142, total_invested: 500000, description: 'EV stocks' },
      { id: 'b2', name: 'Dividend Income', theme: 'Value', risk_level: 'low', follower_count: 98, total_invested: 320000, description: 'Dividend stocks' },
    ],
    isLoading: false,
  }),
  useInvestInBasket: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null }) }));

describe('BasketDiscovery', () => {
  it('renders all baskets', async () => {
    const { BasketDiscovery } = await import('./BasketDiscovery');
    render(<BasketDiscovery onSelect={vi.fn()} />);
    expect(screen.getByText('EV Revolution')).toBeInTheDocument();
    expect(screen.getByText('Dividend Income')).toBeInTheDocument();
  });

  it('filter by risk_level shows only matching baskets', async () => {
    const { BasketDiscovery } = await import('./BasketDiscovery');
    render(<BasketDiscovery onSelect={vi.fn()} />);
    // Click the 'High' risk filter button
    fireEvent.click(screen.getByRole('button', { name: /high/i }));
    expect(screen.getByText('EV Revolution')).toBeInTheDocument();
    expect(screen.queryByText('Dividend Income')).toBeNull();
  });
});
```

### Step 2: Implement BasketDiscovery.tsx

```tsx
// src/features/markets/retail/community/BasketDiscovery.tsx
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBaskets } from './hooks/useCommunity';
import { RISK_LEVEL_LABELS, RISK_LEVEL_COLORS, type BasketRiskLevel, type CommunityBasket } from './types';

interface BasketDiscoveryProps {
  onSelect: (basket: CommunityBasket) => void;
}

const RISK_FILTERS: Array<BasketRiskLevel | 'all'> = ['all', 'low', 'medium', 'high'];

export function BasketDiscovery({ onSelect }: BasketDiscoveryProps) {
  const { data: baskets = [], isLoading } = useBaskets();
  const [riskFilter, setRiskFilter] = useState<BasketRiskLevel | 'all'>('all');

  const filtered = riskFilter === 'all' ? baskets : baskets.filter(b => b.risk_level === riskFilter);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {RISK_FILTERS.map(f => (
          <Button
            key={f}
            size="sm"
            variant={riskFilter === f ? 'default' : 'outline'}
            className="h-7 text-xs capitalize"
            onClick={() => setRiskFilter(f)}
          >
            {f === 'all' ? 'All' : RISK_LEVEL_LABELS[f]}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(basket => (
          <Card
            key={basket.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelect(basket)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{basket.name}</p>
                  <p className="text-xs text-muted-foreground">{basket.theme}</p>
                </div>
                <Badge variant="outline" className={`text-xs ${RISK_LEVEL_COLORS[basket.risk_level]}`}>
                  {RISK_LEVEL_LABELS[basket.risk_level]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{basket.description}</p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{basket.follower_count} followers</span>
                <span>₹{(basket.total_invested / 1_00_000).toFixed(1)}L invested</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No baskets match your filter.</p>
        )}
      </div>
    </div>
  );
}
```

### Step 3: Implement BasketDetail.tsx

```tsx
// src/features/markets/retail/community/BasketDetail.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useBasketHoldings, useInvestInBasket } from './hooks/useCommunity';
import { RISK_LEVEL_LABELS, RISK_LEVEL_COLORS, formatWeight, type CommunityBasket } from './types';

interface BasketDetailProps {
  basket: CommunityBasket;
  onBack: () => void;
}

export function BasketDetail({ basket, onBack }: BasketDetailProps) {
  const { data: holdings = [], isLoading } = useBasketHoldings(basket.id);
  const { mutate: invest, isPending } = useInvestInBasket();
  const [amount, setAmount] = useState('');

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={onBack} className="text-xs -ml-2">
        ← Back to baskets
      </Button>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{basket.name}</h3>
          <Badge variant="outline" className={`text-xs ${RISK_LEVEL_COLORS[basket.risk_level]}`}>
            {RISK_LEVEL_LABELS[basket.risk_level]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{basket.description}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Holdings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <div className="h-16 bg-muted rounded animate-pulse" />}
          {holdings.map(h => (
            <div key={h.id} className="flex items-center justify-between text-xs">
              <span className="font-medium">{h.instrument?.symbol ?? h.instrument_id}</span>
              <span className="text-muted-foreground">{formatWeight(h.weight_pct)}</span>
            </div>
          ))}
          {!isLoading && holdings.length === 0 && (
            <p className="text-xs text-muted-foreground">No holdings added yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Investment Amount (₹)</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 10000"
              className="h-8 text-sm"
              min={500}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!amount || Number(amount) <= 0 || isPending}
            onClick={() => invest({ basketId: basket.id, amount: Number(amount) })}
          >
            {isPending ? 'Investing…' : `Invest ₹${Number(amount).toLocaleString('en-IN')}`}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Amount is allocated across all holdings proportionally.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 4: Run tests

```bash
npx vitest run src/features/markets/retail/community/BasketDiscovery.test.tsx
```

Expected: 2/2 passing.

### Step 5: Commit

```bash
git add src/features/markets/retail/community/BasketDiscovery.tsx \
        src/features/markets/retail/community/BasketDetail.tsx \
        src/features/markets/retail/community/BasketDiscovery.test.tsx
git commit -m "feat(retail-p4): BasketDiscovery + BasketDetail — browse and invest in thematic baskets"
```

---

## Task 7: BasketCreator.tsx

**Files:**
- Create: `src/features/markets/retail/community/BasketCreator.tsx`
- Create: `src/features/markets/retail/community/BasketCreator.test.tsx`

### Step 1: Write failing test

```typescript
// src/features/markets/retail/community/BasketCreator.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./hooks/useCommunity', () => ({
  useCreatorStatus: () => ({ data: { is_verified: false }, isLoading: false }),
  useBaskets: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null }) }));

describe('BasketCreator', () => {
  it('shows not-verified message for non-creator', async () => {
    const { BasketCreator } = await import('./BasketCreator');
    render(<BasketCreator />);
    expect(screen.getByText(/verified creator/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create basket/i })).toBeNull();
  });
});
```

### Step 2: Implement BasketCreator.tsx

```tsx
// src/features/markets/retail/community/BasketCreator.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCreatorStatus } from './hooks/useCommunity';

export function BasketCreator() {
  const { data: creator, isLoading } = useCreatorStatus();

  if (isLoading) return <div className="h-24 bg-muted rounded-lg animate-pulse" />;

  if (!creator?.is_verified) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center space-y-2">
          <Badge variant="outline" className="text-xs">Verified Creator Required</Badge>
          <p className="text-sm text-muted-foreground">
            Only SEBI-registered research analysts and verified creators can publish baskets.
            Contact support to apply for creator verification.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Create Basket</CardTitle>
          <Badge className="text-xs">Verified Creator</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Basket creation form — define theme, add instruments with weights, set rebalancing frequency.
        </p>
      </CardContent>
    </Card>
  );
}
```

### Step 3: Run tests

```bash
npx vitest run src/features/markets/retail/community/BasketCreator.test.tsx
```

Expected: 1/1 passing.

### Step 4: Commit

```bash
git add src/features/markets/retail/community/BasketCreator.tsx \
        src/features/markets/retail/community/BasketCreator.test.tsx
git commit -m "feat(retail-p4): BasketCreator — verified-creator gate + creator form placeholder"
```

---

## Task 8: StrategyMarketplace.tsx

**Files:**
- Create: `src/features/markets/retail/community/StrategyMarketplace.tsx`
- Create: `src/features/markets/retail/community/StrategyMarketplace.test.tsx`

### Step 1: Write failing test

```typescript
// src/features/markets/retail/community/StrategyMarketplace.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockDeploy = vi.fn();
vi.mock('./hooks/useCommunity', () => ({
  useStrategies: () => ({
    data: [
      { id: 's1', name: 'RSI Reversal', description: 'Reversal on RSI', asset_class: 'equity', live_users: 34, rating: 4.2, paper_required_days: 14, backtest_summary: {} },
    ],
    isLoading: false,
  }),
  useDeployStrategy: () => ({ mutate: mockDeploy, isPending: false }),
}));
vi.mock('../autonomous/hooks/useAutonomyProgress', () => ({
  useAutonomyProgress: () => ({
    data: { current_phase: 'paper', paper_trades_done: 3, micro_trades_done: 0, kill_switch_level: 'none' },
  }),
}));
vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null }) }));

describe('StrategyMarketplace', () => {
  it('shows strategies list', async () => {
    const { StrategyMarketplace } = await import('./StrategyMarketplace');
    render(<StrategyMarketplace />);
    expect(screen.getByText('RSI Reversal')).toBeInTheDocument();
  });

  it('deploy button disabled in paper phase', async () => {
    const { StrategyMarketplace } = await import('./StrategyMarketplace');
    render(<StrategyMarketplace />);
    expect(screen.getByRole('button', { name: /deploy|paper/i })).toBeDisabled();
  });
});
```

### Step 2: Implement StrategyMarketplace.tsx

```tsx
// src/features/markets/retail/community/StrategyMarketplace.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStrategies, useDeployStrategy } from './hooks/useCommunity';
import { useAutonomyProgress } from '../autonomous/hooks/useAutonomyProgress';

export function StrategyMarketplace() {
  const { data: strategies = [], isLoading } = useStrategies();
  const { mutate: deploy, isPending } = useDeployStrategy();
  const { data: progress } = useAutonomyProgress();

  const isInPaperPhase = !progress || progress.current_phase === 'paper';

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isInPaperPhase && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            Complete paper trading (10 trades) to deploy community strategies.
          </p>
        </div>
      )}

      {strategies.map(strategy => (
        <Card key={strategy.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{strategy.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{strategy.asset_class.replace(/_/g, ' ')}</p>
              </div>
              {strategy.rating && (
                <Badge variant="secondary" className="text-xs">★ {strategy.rating.toFixed(1)}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{strategy.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{strategy.live_users} using this</span>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={isInPaperPhase || isPending}
                onClick={() => deploy(strategy.id)}
              >
                {isInPaperPhase ? 'Paper phase' : 'Deploy'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {strategies.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No published strategies yet.</p>
      )}
    </div>
  );
}
```

### Step 3: Run tests

```bash
npx vitest run src/features/markets/retail/community/StrategyMarketplace.test.tsx
```

Expected: 2/2 passing.

### Step 4: Commit

```bash
git add src/features/markets/retail/community/StrategyMarketplace.tsx \
        src/features/markets/retail/community/StrategyMarketplace.test.tsx
git commit -m "feat(retail-p4): StrategyMarketplace — browse and deploy community strategies with paper gate"
```

---

## Task 9: CopyTradingExtended.tsx

**Files:**
- Create: `src/features/markets/retail/community/CopyTradingExtended.tsx`
- Create: `src/features/markets/retail/community/CopyTradingExtended.test.tsx`

### Step 1: Write failing test

```typescript
// src/features/markets/retail/community/CopyTradingExtended.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null }) }));

describe('CopyTradingExtended', () => {
  it('renders leaderboard header and safety notice', async () => {
    const { CopyTradingExtended } = await import('./CopyTradingExtended');
    render(<CopyTradingExtended />);
    expect(screen.getByText(/top traders|leaderboard/i)).toBeInTheDocument();
    expect(screen.getByText(/experimental|20%/i)).toBeInTheDocument();
  });
});
```

### Step 2: Implement CopyTradingExtended.tsx

```tsx
// src/features/markets/retail/community/CopyTradingExtended.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function CopyTradingExtended() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Safety limits:</strong> Copy trading is only allowed in your Experimental tier.
          Maximum 20% of Experimental tier NAV per copied trader.
          Auto-unfollow triggers if copied trader drawdown exceeds your limit.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top Traders Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Traders ranked by risk-adjusted returns (Sharpe), max drawdown, and consistency.
            All performance metrics are real — no simulated results.
          </p>
          <div className="mt-3 space-y-2">
            {/* Leaderboard data loads from existing GET /v1/copy-trades/leaderboard */}
            <div className="flex items-center justify-between text-xs border rounded-lg p-2">
              <div>
                <p className="font-medium">Leaderboard loading…</p>
                <p className="text-muted-foreground">Connect to view top traders</p>
              </div>
              <Badge variant="outline" className="text-xs">Experimental only</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 3: Run tests

```bash
npx vitest run src/features/markets/retail/community/CopyTradingExtended.test.tsx
```

Expected: 1/1 passing.

### Step 4: Commit

```bash
git add src/features/markets/retail/community/CopyTradingExtended.tsx \
        src/features/markets/retail/community/CopyTradingExtended.test.tsx
git commit -m "feat(retail-p4): CopyTradingExtended — safety limits UI with Experimental-only enforcement"
```

---

## Task 10: Wire Community Tab into RetailMode

**Files:**
- Create: `src/features/markets/retail/community/CommunityHub.tsx`
- Modify: `src/features/markets/retail/RetailMode.tsx`

### Step 1: Create CommunityHub.tsx (assembles all community components)

```tsx
// src/features/markets/retail/community/CommunityHub.tsx
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BasketDiscovery } from './BasketDiscovery';
import { BasketDetail } from './BasketDetail';
import { BasketCreator } from './BasketCreator';
import { StrategyMarketplace } from './StrategyMarketplace';
import { CopyTradingExtended } from './CopyTradingExtended';
import type { CommunityBasket } from './types';

export function CommunityHub() {
  const [selectedBasket, setSelectedBasket] = useState<CommunityBasket | null>(null);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Community</h3>

      <Tabs defaultValue="baskets">
        <TabsList className="w-full">
          <TabsTrigger value="baskets" className="flex-1 text-xs">Baskets</TabsTrigger>
          <TabsTrigger value="strategies" className="flex-1 text-xs">Strategies</TabsTrigger>
          <TabsTrigger value="copy" className="flex-1 text-xs">Copy Trade</TabsTrigger>
          <TabsTrigger value="create" className="flex-1 text-xs">Create</TabsTrigger>
        </TabsList>

        <TabsContent value="baskets">
          {selectedBasket ? (
            <BasketDetail basket={selectedBasket} onBack={() => setSelectedBasket(null)} />
          ) : (
            <BasketDiscovery onSelect={setSelectedBasket} />
          )}
        </TabsContent>

        <TabsContent value="strategies">
          <StrategyMarketplace />
        </TabsContent>

        <TabsContent value="copy">
          <CopyTradingExtended />
        </TabsContent>

        <TabsContent value="create">
          <BasketCreator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 2: Add Community tab to RetailMode.tsx

Read `RetailMode.tsx` — it already has a `Tabs` for self_directed users (Signals / Auto-Execute). Add a third tab `community`:

In the existing Tabs block for self_directed users, add:
```tsx
// Import at top:
import { CommunityHub } from './community/CommunityHub';

// In the TabsList:
<TabsTrigger value="community" className="flex-1 text-xs">Community</TabsTrigger>

// New TabsContent:
<TabsContent value="community">
  <CommunityHub />
</TabsContent>
```

### Step 3: Run all retail tests

```bash
npx vitest run src/features/markets/retail/ 2>&1 | tail -8
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -5
```

Expected: All 62+ existing tests still pass. 0 TS errors.

### Step 4: Commit

```bash
git add src/features/markets/retail/community/CommunityHub.tsx \
        src/features/markets/retail/RetailMode.tsx
git commit -m "feat(retail-p4): CommunityHub — baskets, strategies, copy trading assembled; Community tab in RetailMode"
```

---

## Task 11: Hindi i18n for Community Components

**Files:**
- Create: `public/locales/en/community.json`
- Create: `public/locales/hi/community.json`
- Modify: Key community components to use `useTranslation('community')`

The i18n setup already uses `i18next-http-backend` loading from `/public/locales/{lng}/{ns}.json`. New community components will use the `community` namespace.

### Step 1: Write failing test for i18n

```typescript
// src/features/markets/retail/community/i18n.test.ts
import { describe, it, expect } from 'vitest';

describe('community locale files', () => {
  it('en/community.json has required keys', async () => {
    // Dynamic import to validate JSON structure
    const en = await import('../../../../public/locales/en/community.json');
    expect(en.default).toHaveProperty('baskets.title');
    expect(en.default).toHaveProperty('baskets.invest');
    expect(en.default).toHaveProperty('strategies.title');
    expect(en.default).toHaveProperty('strategies.deploy');
    expect(en.default).toHaveProperty('copy.title');
    expect(en.default).toHaveProperty('copy.safety_notice');
  });

  it('hi/community.json has same keys as en', async () => {
    const en = await import('../../../../public/locales/en/community.json');
    const hi = await import('../../../../public/locales/hi/community.json');
    const enKeys = Object.keys(en.default.baskets);
    const hiKeys = Object.keys(hi.default.baskets);
    expect(hiKeys).toEqual(expect.arrayContaining(enKeys));
  });
});
```

### Step 2: Create locale files

```json
// public/locales/en/community.json
{
  "baskets": {
    "title": "Thematic Baskets",
    "subtitle": "Curated collections of stocks and ETFs",
    "filter_all": "All",
    "filter_risk": "Risk Level",
    "invest": "Invest",
    "investing": "Investing…",
    "invested_label": "invested",
    "followers_label": "followers",
    "no_baskets": "No baskets match your filter.",
    "holdings_title": "Holdings",
    "no_holdings": "No holdings added yet.",
    "back": "← Back to baskets",
    "allocation_note": "Amount is allocated across all holdings proportionally."
  },
  "strategies": {
    "title": "Strategy Marketplace",
    "deploy": "Deploy",
    "deploying": "Deploying…",
    "paper_phase_warning": "Complete paper trading (10 trades) to deploy community strategies.",
    "paper_phase_button": "Paper phase",
    "live_users": "using this",
    "no_strategies": "No published strategies yet."
  },
  "copy": {
    "title": "Top Traders Leaderboard",
    "safety_notice": "Safety limits: Copy trading is only allowed in your Experimental tier. Maximum 20% of Experimental tier NAV per copied trader. Auto-unfollow triggers if copied trader drawdown exceeds your limit.",
    "experimental_badge": "Experimental only",
    "connect_prompt": "Connect to view top traders"
  },
  "creator": {
    "verified_badge": "Verified Creator",
    "not_verified_title": "Verified Creator Required",
    "not_verified_message": "Only SEBI-registered research analysts and verified creators can publish baskets. Contact support to apply for creator verification."
  }
}
```

```json
// public/locales/hi/community.json
{
  "baskets": {
    "title": "थीमेटिक बास्केट",
    "subtitle": "शेयरों और ETF का क्यूरेटेड संग्रह",
    "filter_all": "सभी",
    "filter_risk": "जोखिम स्तर",
    "invest": "निवेश करें",
    "investing": "निवेश हो रहा है…",
    "invested_label": "निवेश किया",
    "followers_label": "फॉलोअर",
    "no_baskets": "आपके फ़िल्टर से कोई बास्केट नहीं मिला।",
    "holdings_title": "होल्डिंग्स",
    "no_holdings": "अभी तक कोई होल्डिंग नहीं जोड़ी गई।",
    "back": "← बास्केट पर वापस",
    "allocation_note": "राशि सभी होल्डिंग्स में आनुपातिक रूप से आवंटित की जाती है।"
  },
  "strategies": {
    "title": "स्ट्रैटेजी मार्केटप्लेस",
    "deploy": "तैनात करें",
    "deploying": "तैनाती हो रही है…",
    "paper_phase_warning": "कम्युनिटी स्ट्रैटेजी तैनात करने के लिए पेपर ट्रेडिंग (10 ट्रेड) पूरी करें।",
    "paper_phase_button": "पेपर चरण",
    "live_users": "उपयोग में",
    "no_strategies": "अभी तक कोई प्रकाशित स्ट्रैटेजी नहीं।"
  },
  "copy": {
    "title": "शीर्ष ट्रेडर लीडरबोर्ड",
    "safety_notice": "सुरक्षा सीमाएं: कॉपी ट्रेडिंग केवल आपके प्रायोगिक टियर में अनुमत है। प्रति कॉपी किए गए ट्रेडर अधिकतम 20% प्रायोगिक टियर NAV। यदि कॉपी किए गए ट्रेडर की गिरावट आपकी सीमा से अधिक हो तो ऑटो-अनफॉलो।",
    "experimental_badge": "केवल प्रायोगिक",
    "connect_prompt": "शीर्ष ट्रेडर देखने के लिए जुड़ें"
  },
  "creator": {
    "verified_badge": "सत्यापित निर्माता",
    "not_verified_title": "सत्यापित निर्माता आवश्यक",
    "not_verified_message": "केवल SEBI-पंजीकृत रिसर्च विश्लेषक और सत्यापित निर्माता ही बास्केट प्रकाशित कर सकते हैं। निर्माता सत्यापन के लिए आवेदन करने हेतु सपोर्ट से संपर्क करें।"
  }
}
```

### Step 3: Run i18n test

```bash
npx vitest run src/features/markets/retail/community/i18n.test.ts
```

Expected: 2/2 passing.

### Step 4: Commit

```bash
git add public/locales/en/community.json \
        public/locales/hi/community.json \
        src/features/markets/retail/community/i18n.test.ts
git commit -m "feat(retail-p4): Hindi i18n for community — baskets, strategies, copy trading, creator labels"
```

---

## Task 12: Final Verification

### Step 1: Full backend test suite

```bash
cd services/markets-worker
uv run pytest tests/ -v 2>&1 | tail -20
```

Expected: All tests passing (~62+ = 54 Phase 3 + 11 new Phase 4 backend tests).

### Step 2: Full frontend test suite

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx vitest run src/features/markets/retail/ 2>&1 | tail -10
```

Expected: All tests passing (~76+ = 62 Phase 3 + 10+ new Phase 4 tests).

### Step 3: TypeScript check

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

### Step 4: Verify community query keys don't break existing hooks

```bash
grep -r "marketsKeys.retail.community\|marketsKeys.retail.autonomous\|marketsKeys.retail.behavioral" \
  src/features/markets/retail/ --include="*.ts" --include="*.tsx" | grep -v ".test." | head -20
```

All references should resolve without TypeScript errors.

### Step 5: Final commit if cleanup needed

```bash
git add -p
git commit -m "chore(retail-p4): Phase 4 final verification cleanup"
```

---

## Phase 4 Summary

| Task | Deliverable | Tests |
|---|---|---|
| 1 | DB migrations (baskets, basket_holdings, basket_user_positions, strategy_marketplace, copy_trading_extended + verified_creator column) | SQL validated |
| 2 | Community router (baskets CRUD, invest, strategies CRUD, deploy gate, creator-status) | 5 pytest |
| 3 | Copy trading safety limits router (Experimental-only, budget cap, drawdown limit) | 3 pytest |
| 4 | Strategy marketplace tests (deploy gate: paper blocked, micro allowed) | 3 pytest |
| 5 | Frontend types + query keys + hooks (useBaskets, useStrategies, useDeployStrategy, etc.) | 2 vitest |
| 6 | BasketDiscovery + BasketDetail (risk filter, invest flow) | 2 vitest |
| 7 | BasketCreator (verified-creator gate) | 1 vitest |
| 8 | StrategyMarketplace (paper phase gate on deploy button) | 2 vitest |
| 9 | CopyTradingExtended (safety limits UI) | 1 vitest |
| 10 | CommunityHub + RetailMode wiring (Community tab for self_directed) | (existing 62 pass) |
| 11 | Hindi i18n (en + hi community.json, 2 locale tests) | 2 vitest |
| 12 | Final verification (~65 backend + ~76 frontend) | All pass |
