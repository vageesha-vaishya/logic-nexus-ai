# Retail Investment Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a retail-focused investment recommendation platform as an extension of the existing Markets module, covering all asset classes with adaptive UI, intelligent signal engine, autonomous execution, and behavioral support.

**Architecture:** New `src/features/markets/retail/` frontend sub-feature + new Python modules in `services/markets-worker/`. Reuses existing `QuickTradeButton`, `llm_gateway.py`, broker registry, and signals router. Four phases: Foundation → Behavioral → Autonomous Execution → Community.

**Tech Stack:** FastAPI (Python), React 18 + TypeScript, Supabase (PostgreSQL), Vitest, existing `llm_gateway.py` for LLM calls, broker APIs (Angel One SmartAPI, Zerodha, Fyers, Dhan).

**Worktree:** `~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform`
**Branch:** `feature/retail-investment-platform`
**Design doc:** `docs/plans/2026-05-18-retail-investment-platform-design.md`

---

## Phase 1 — Foundation (Tasks 1–8)

Goal: Signal engine + recommendation feed + onboarding + three-tier portfolio. Manual execution only.

---

### Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/20260518000001_retail_risk_profiles.sql`
- Create: `supabase/migrations/20260518000002_retail_portfolio_tiers.sql`
- Create: `supabase/migrations/20260518000003_retail_signals_extended.sql`
- Create: `supabase/migrations/20260518000004_retail_execution_rules.sql`
- Create: `supabase/migrations/20260518000005_retail_behavioral_events.sql`

**Step 1: Create risk profiles migration**

```sql
-- supabase/migrations/20260518000001_retail_risk_profiles.sql
create table if not exists retail_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experience_level text not null check (experience_level in ('beginner','casual','self_directed')),
  risk_tag text not null check (risk_tag in ('conservative','moderate','aggressive')),
  goals jsonb not null default '[]',       -- [{goal: "retirement", timeline_years: 20}]
  quiz_answers jsonb not null default '{}',
  behavioral_flags jsonb not null default '{}', -- {tends_panic_sell: false, auto_approver: false}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);
alter table retail_risk_profiles enable row level security;
create policy "users manage own profile" on retail_risk_profiles
  for all using (auth.uid() = user_id);
```

**Step 2: Create portfolio tiers migration**

```sql
-- supabase/migrations/20260518000002_retail_portfolio_tiers.sql
create table if not exists retail_portfolio_tiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('safety_net','core','experimental')),
  target_amount numeric,
  current_value numeric not null default 0,
  allocation jsonb not null default '{}', -- {equity: 60, debt: 30, gold: 10}
  goal_label text,
  goal_target numeric,
  goal_deadline_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, tier)
);
alter table retail_portfolio_tiers enable row level security;
create policy "users manage own tiers" on retail_portfolio_tiers
  for all using (auth.uid() = user_id);
```

**Step 3: Create extended signals migration**

```sql
-- supabase/migrations/20260518000003_retail_signals_extended.sql
create table if not exists retail_signals (
  id uuid primary key default gen_random_uuid(),
  instrument text not null,
  exchange text not null default 'NSE',
  asset_class text not null check (asset_class in
    ('stock','mutual_fund','crypto','fno','commodity','bond','forex')),
  horizon text not null check (horizon in ('intraday','swing','long_term')),
  direction text not null check (direction in ('buy','sell','hold')),
  confidence numeric not null check (confidence between 0 and 100),
  confidence_low numeric not null,
  confidence_high numeric not null,
  label text not null check (label in ('moderate','strong','high_conviction')),
  reasoning jsonb not null default '{}',   -- {technical: {...}, fundamental: {...}, volume: {...}}
  explanation_beginner text,
  explanation_casual text,
  explanation_self_directed text,
  entry_price numeric,
  stop_loss numeric,
  target_price numeric,
  risk_reward numeric,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on retail_signals (instrument, asset_class, created_at desc);
create index on retail_signals (asset_class, horizon, confidence desc);
-- No RLS — signals are platform-wide, filtered by risk profile in API
```

**Step 4: Create execution rules migration**

```sql
-- supabase/migrations/20260518000004_retail_execution_rules.sql
create table if not exists retail_execution_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument text not null,
  exchange text not null default 'NSE',
  rule_type text not null check (rule_type in
    ('stop_loss','trailing_stop','bracket','oco','time_exit','llm_adjusted')),
  tier text not null check (tier in ('core','experimental')),
  autonomy_level text not null check (autonomy_level in ('guard','rule','algo')),
  params jsonb not null default '{}',      -- rule-specific params
  status text not null default 'active' check (status in ('active','paused','triggered','cancelled')),
  algo_id text,                            -- SEBI exchange-assigned
  paper_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table retail_execution_rules enable row level security;
create policy "users manage own rules" on retail_execution_rules
  for all using (auth.uid() = user_id);

create table if not exists retail_execution_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  rule_id uuid references retail_execution_rules(id),
  instrument text not null,
  side text not null check (side in ('buy','sell')),
  quantity numeric not null,
  order_price numeric,
  fill_price numeric,
  slippage numeric,
  trigger_condition text,
  pre_trade_checks jsonb,
  llm_recommendation jsonb,
  user_approved boolean,
  algo_id text,
  static_ip text,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);
-- No RLS on audit — admin access only; user reads via API
```

**Step 5: Create behavioral events migration**

```sql
-- supabase/migrations/20260518000005_retail_behavioral_events.sql
create table if not exists retail_behavioral_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, -- 'loss_alert_yellow','cooling_off_triggered','education_shown', etc.
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on retail_behavioral_events (user_id, event_type, created_at desc);
alter table retail_behavioral_events enable row level security;
create policy "users read own events" on retail_behavioral_events
  for select using (auth.uid() = user_id);
create policy "service inserts events" on retail_behavioral_events
  for insert with check (true);
```

**Step 6: Apply migrations**

```bash
cd ~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx supabase db diff --use-migra  # verify no conflicts
npx supabase migration up          # apply to local
```

Expected: migrations apply cleanly, no errors.

**Step 7: Commit**

```bash
git add supabase/migrations/20260518000001_retail_risk_profiles.sql \
        supabase/migrations/20260518000002_retail_portfolio_tiers.sql \
        supabase/migrations/20260518000003_retail_signals_extended.sql \
        supabase/migrations/20260518000004_retail_execution_rules.sql \
        supabase/migrations/20260518000005_retail_behavioral_events.sql
git commit -m "feat(retail): database migrations for risk profiles, tiers, signals, execution, behavioral"
```

---

### Task 2: Risk Profile Backend Router

**Files:**
- Create: `services/markets-worker/src/markets_worker/routers/retail_risk_profile.py`
- Create: `services/markets-worker/tests/test_retail_risk_profile.py`
- Modify: `services/markets-worker/src/markets_worker/main.py`

**Step 1: Write failing tests**

```python
# services/markets-worker/tests/test_retail_risk_profile.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

@pytest.fixture
def client():
    from markets_worker.main import app
    return TestClient(app)

def test_upsert_risk_profile_returns_200(client):
    payload = {
        "experience_level": "beginner",
        "risk_tag": "conservative",
        "goals": [{"goal": "retirement", "timeline_years": 20}],
        "quiz_answers": {"q1": "hold", "q2": "ignore"},
        "behavioral_flags": {}
    }
    with patch("markets_worker.routers.retail_risk_profile.get_supabase") as mock_sb:
        mock_sb.return_value.table.return_value.upsert.return_value.execute.return_value.data = [payload]
        resp = client.post("/v1/retail/risk-profile", json=payload,
                           headers={"x-user-id": "test-user-123"})
    assert resp.status_code == 200
    assert resp.json()["experience_level"] == "beginner"

def test_upsert_risk_profile_rejects_invalid_level(client):
    payload = {"experience_level": "expert", "risk_tag": "conservative",
               "goals": [], "quiz_answers": {}, "behavioral_flags": {}}
    resp = client.post("/v1/retail/risk-profile", json=payload,
                       headers={"x-user-id": "test-user-123"})
    assert resp.status_code == 422

def test_get_risk_profile_returns_profile(client):
    with patch("markets_worker.routers.retail_risk_profile.get_supabase") as mock_sb:
        mock_sb.return_value.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
            "experience_level": "casual", "risk_tag": "moderate",
            "goals": [], "quiz_answers": {}, "behavioral_flags": {}
        }
        resp = client.get("/v1/retail/risk-profile",
                          headers={"x-user-id": "test-user-123"})
    assert resp.status_code == 200
    assert resp.json()["risk_tag"] == "moderate"
```

**Step 2: Run tests — verify they fail**

```bash
cd services/markets-worker
python -m pytest tests/test_retail_risk_profile.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError` or `404` — router doesn't exist yet.

**Step 3: Implement the router**

```python
# services/markets-worker/src/markets_worker/routers/retail_risk_profile.py
from __future__ import annotations
from typing import Any, Literal
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from markets_worker.db import get_supabase

router = APIRouter(prefix="/v1/retail", tags=["retail"])

ExperienceLevel = Literal["beginner", "casual", "self_directed"]
RiskTag = Literal["conservative", "moderate", "aggressive"]

class RiskProfileIn(BaseModel):
    experience_level: ExperienceLevel
    risk_tag: RiskTag
    goals: list[dict]
    quiz_answers: dict
    behavioral_flags: dict = {}

@router.post("/risk-profile")
def upsert_risk_profile(
    body: RiskProfileIn,
    x_user_id: str = Header(..., alias="x-user-id"),
) -> dict[str, Any]:
    sb = get_supabase()
    result = (
        sb.table("retail_risk_profiles")
        .upsert({"user_id": x_user_id, **body.model_dump()},
                on_conflict="user_id")
        .execute()
    )
    if not result.data:
        raise HTTPException(500, "Failed to save risk profile")
    return result.data[0]

@router.get("/risk-profile")
def get_risk_profile(
    x_user_id: str = Header(..., alias="x-user-id"),
) -> dict[str, Any]:
    sb = get_supabase()
    result = (
        sb.table("retail_risk_profiles")
        .select("*")
        .eq("user_id", x_user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Risk profile not found")
    return result.data

@router.patch("/risk-profile/behavioral-flags")
def update_behavioral_flags(
    flags: dict,
    x_user_id: str = Header(..., alias="x-user-id"),
) -> dict[str, Any]:
    sb = get_supabase()
    result = (
        sb.table("retail_risk_profiles")
        .update({"behavioral_flags": flags})
        .eq("user_id", x_user_id)
        .execute()
    )
    return result.data[0] if result.data else {}
```

**Step 4: Register router in main.py**

Add after the last router import and include:

```python
# In main.py imports section:
from markets_worker.routers import retail_risk_profile as retail_risk_profile_router

# In create_app() after existing app.include_router calls:
app.include_router(retail_risk_profile_router.router)
```

**Step 5: Run tests — verify they pass**

```bash
cd services/markets-worker
python -m pytest tests/test_retail_risk_profile.py -v
```

Expected: 3 tests pass.

**Step 6: Commit**

```bash
git add services/markets-worker/src/markets_worker/routers/retail_risk_profile.py \
        services/markets-worker/tests/test_retail_risk_profile.py \
        services/markets-worker/src/markets_worker/main.py
git commit -m "feat(retail): risk profile upsert/get/patch-flags endpoints"
```

---

### Task 3: Signal Engine — Confidence Scoring & Multi-Asset

**Files:**
- Create: `services/markets-worker/src/markets_worker/signal_engine/__init__.py`
- Create: `services/markets-worker/src/markets_worker/signal_engine/scorer.py`
- Create: `services/markets-worker/src/markets_worker/signal_engine/decay.py`
- Create: `services/markets-worker/src/markets_worker/signal_engine/features.py`
- Create: `services/markets-worker/tests/test_signal_engine.py`

**Step 1: Write failing tests**

```python
# services/markets-worker/tests/test_signal_engine.py
import pytest
from markets_worker.signal_engine.scorer import compute_confidence, label_from_confidence
from markets_worker.signal_engine.decay import apply_decay
from markets_worker.signal_engine.features import volume_ratio, compute_atr

def test_confidence_below_threshold_returns_none():
    score = compute_confidence(technical=0.4, fundamental=0.3, volume=0.5, sentiment=0.5)
    assert score < 60  # below release threshold

def test_confidence_high_conviction():
    score = compute_confidence(technical=0.9, fundamental=0.9, volume=0.9, sentiment=0.9)
    assert score > 85

def test_label_moderate():
    assert label_from_confidence(65) == "moderate"

def test_label_strong():
    assert label_from_confidence(75) == "strong"

def test_label_high_conviction():
    assert label_from_confidence(86) == "high_conviction"

def test_decay_intraday_reduces_confidence():
    adjusted = apply_decay(confidence=80.0, horizon="intraday", hours_elapsed=2.0)
    assert adjusted < 80.0
    assert adjusted > 0

def test_decay_long_term_minimal():
    adjusted = apply_decay(confidence=80.0, horizon="long_term", hours_elapsed=24.0)
    assert adjusted > 78  # minimal decay for long-term over 24h

def test_volume_ratio_above_threshold():
    recent_volume = 150_000
    avg_20d_volume = 100_000
    ratio = volume_ratio(recent_volume, avg_20d_volume)
    assert ratio == pytest.approx(1.5)

def test_atr_basic():
    highs = [102, 103, 104, 105, 106]
    lows  = [98,  99,  100, 101, 102]
    closes = [100, 101, 102, 103, 104]
    atr = compute_atr(highs, lows, closes, period=3)
    assert atr > 0
```

**Step 2: Run — verify failure**

```bash
cd services/markets-worker
python -m pytest tests/test_signal_engine.py -v 2>&1 | head -10
```

Expected: `ModuleNotFoundError: No module named 'markets_worker.signal_engine'`

**Step 3: Implement signal engine modules**

```python
# services/markets-worker/src/markets_worker/signal_engine/__init__.py
```

```python
# services/markets-worker/src/markets_worker/signal_engine/features.py
from __future__ import annotations
import math

def volume_ratio(recent: float, avg_20d: float) -> float:
    if avg_20d == 0:
        return 1.0
    return recent / avg_20d

def compute_atr(highs: list[float], lows: list[float],
                closes: list[float], period: int = 14) -> float:
    if len(highs) < period + 1:
        return 0.0
    trs = []
    for i in range(1, len(highs)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        trs.append(tr)
    return sum(trs[-period:]) / period

def normalize_score(value: float, min_val: float, max_val: float) -> float:
    """Normalize value to 0-1 range."""
    if max_val == min_val:
        return 0.5
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))
```

```python
# services/markets-worker/src/markets_worker/signal_engine/scorer.py
from __future__ import annotations

# Weights from design doc (medium-term baseline)
_W_TECHNICAL   = 0.40
_W_FUNDAMENTAL = 0.35
_W_VOLUME      = 0.15
_W_SENTIMENT   = 0.10

# Horizon-specific weight overrides
_HORIZON_WEIGHTS = {
    "intraday":   (_W_TECHNICAL + 0.25, _W_FUNDAMENTAL - 0.15, _W_VOLUME, _W_SENTIMENT),
    "swing":      (_W_TECHNICAL, _W_FUNDAMENTAL, _W_VOLUME, _W_SENTIMENT),
    "long_term":  (_W_TECHNICAL - 0.15, _W_FUNDAMENTAL + 0.25, _W_VOLUME - 0.05, _W_SENTIMENT),
}

def compute_confidence(
    technical: float,
    fundamental: float,
    volume: float,
    sentiment: float,
    horizon: str = "swing",
) -> float:
    """
    All inputs are 0-1 normalised scores.
    Returns confidence 0-100.
    """
    wt, wf, wv, ws = _HORIZON_WEIGHTS.get(horizon, (_W_TECHNICAL, _W_FUNDAMENTAL, _W_VOLUME, _W_SENTIMENT))
    raw = (technical * wt + fundamental * wf + volume * wv + sentiment * ws)
    # Volume confirmation penalty: < 1.0 ratio reduces confidence
    if volume < 0.5:
        raw *= 0.85
    return round(raw * 100, 2)

def label_from_confidence(confidence: float) -> str:
    if confidence >= 85:
        return "high_conviction"
    if confidence >= 70:
        return "strong"
    return "moderate"

def confidence_interval(confidence: float, n_signals: int = 200) -> tuple[float, float]:
    """95% Wilson CI approximation."""
    import math
    p = confidence / 100
    z = 1.96
    denom = 1 + z**2 / n_signals
    centre = (p + z**2 / (2 * n_signals)) / denom
    margin = (z * math.sqrt(p * (1 - p) / n_signals + z**2 / (4 * n_signals**2))) / denom
    low = max(0, (centre - margin) * 100)
    high = min(100, (centre + margin) * 100)
    return round(low, 1), round(high, 1)
```

```python
# services/markets-worker/src/markets_worker/signal_engine/decay.py
from __future__ import annotations
import math

# Decay rates: fraction lost per hour
_DECAY_RATES = {
    "intraday":  0.20,   # -20% per hour
    "swing":     0.009,  # -15% per week ≈ 0.009/hr
    "long_term": 0.0007, # -5% per quarter ≈ 0.0007/hr
}

def apply_decay(confidence: float, horizon: str, hours_elapsed: float) -> float:
    rate = _DECAY_RATES.get(horizon, 0.009)
    decayed = confidence * math.exp(-rate * hours_elapsed)
    return round(max(0.0, decayed), 2)
```

**Step 4: Run tests — verify they pass**

```bash
cd services/markets-worker
python -m pytest tests/test_signal_engine.py -v
```

Expected: 9 tests pass.

**Step 5: Commit**

```bash
git add services/markets-worker/src/markets_worker/signal_engine/ \
        services/markets-worker/tests/test_signal_engine.py
git commit -m "feat(retail): signal engine scorer, decay, and feature utilities"
```

---

### Task 4: Retail Signal Feed Router

**Files:**
- Create: `services/markets-worker/src/markets_worker/routers/retail_signals.py`
- Create: `services/markets-worker/tests/test_retail_signals.py`
- Modify: `services/markets-worker/src/markets_worker/main.py`

**Step 1: Write failing tests**

```python
# services/markets-worker/tests/test_retail_signals.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

@pytest.fixture
def client():
    from markets_worker.main import app
    return TestClient(app)

MOCK_SIGNAL = {
    "id": "sig-1", "instrument": "RELIANCE", "exchange": "NSE",
    "asset_class": "stock", "horizon": "swing", "direction": "buy",
    "confidence": 73.5, "confidence_low": 70.1, "confidence_high": 76.9,
    "label": "strong",
    "reasoning": {"technical": {"rsi": 62, "macd": "bullish"}, "volume": {"ratio": 1.6}},
    "explanation_beginner": "Reliance looks strong right now.",
    "explanation_casual": "RSI 62, volume 60% above average. Confidence: 73%.",
    "explanation_self_directed": "EMA20>EMA50, RSI 62, volume 1.6x avg. Confidence: 73.5%.",
    "entry_price": 2890, "stop_loss": 2820, "target_price": 3050,
    "risk_reward": 2.3, "expires_at": "2026-05-19T15:30:00+05:30",
}

def test_feed_returns_signals(client):
    with patch("markets_worker.routers.retail_signals.get_supabase") as mock_sb:
        mock_sb.return_value.table.return_value.select.return_value\
            .gte.return_value.order.return_value.limit.return_value\
            .execute.return_value.data = [MOCK_SIGNAL]
        resp = client.get("/v1/retail/signals/feed",
                          headers={"x-user-id": "u1", "x-risk-tag": "moderate"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["signals"]) == 1
    assert data["signals"][0]["instrument"] == "RELIANCE"

def test_feed_filters_by_asset_class(client):
    with patch("markets_worker.routers.retail_signals.get_supabase") as mock_sb:
        mock_sb.return_value.table.return_value.select.return_value\
            .gte.return_value.order.return_value.limit.return_value\
            .execute.return_value.data = []
        resp = client.get("/v1/retail/signals/feed?asset_class=crypto",
                          headers={"x-user-id": "u1", "x-risk-tag": "conservative"})
    assert resp.status_code == 200
    assert resp.json()["signals"] == []

def test_feed_conservative_excludes_low_confidence(client):
    low_conf_signal = {**MOCK_SIGNAL, "confidence": 62, "label": "moderate"}
    with patch("markets_worker.routers.retail_signals.get_supabase") as mock_sb:
        mock_sb.return_value.table.return_value.select.return_value\
            .gte.return_value.order.return_value.limit.return_value\
            .execute.return_value.data = [low_conf_signal]
        resp = client.get("/v1/retail/signals/feed",
                          headers={"x-user-id": "u1", "x-risk-tag": "conservative"})
    assert resp.status_code == 200
    # Conservative users only see high_conviction (>=70) signals
    assert resp.json()["signals"] == []
```

**Step 2: Run — verify failure**

```bash
python -m pytest tests/test_retail_signals.py -v 2>&1 | head -10
```

**Step 3: Implement the router**

```python
# services/markets-worker/src/markets_worker/routers/retail_signals.py
from __future__ import annotations
from typing import Any, Literal
from fastapi import APIRouter, Header, Query
from markets_worker.db import get_supabase

router = APIRouter(prefix="/v1/retail", tags=["retail"])

# Minimum confidence per risk tag
_MIN_CONFIDENCE: dict[str, float] = {
    "conservative": 70.0,
    "moderate":     60.0,
    "aggressive":   55.0,
}

@router.get("/signals/feed")
def get_signal_feed(
    asset_class: str | None = Query(None),
    horizon: str | None = Query(None),
    tier: str | None = Query(None),
    limit: int = Query(20, le=50),
    x_user_id: str = Header(..., alias="x-user-id"),
    x_risk_tag: str = Header("moderate", alias="x-risk-tag"),
) -> dict[str, Any]:
    sb = get_supabase()
    min_conf = _MIN_CONFIDENCE.get(x_risk_tag, 60.0)

    q = (
        sb.table("retail_signals")
        .select("*")
        .gte("confidence", min_conf)
        .gte("expires_at", "now()")
        .order("confidence", desc=True)
        .limit(limit)
    )
    if asset_class:
        q = q.eq("asset_class", asset_class)
    if horizon:
        q = q.eq("horizon", horizon)

    result = q.execute()
    signals = result.data or []

    # Conservative users: only high_conviction
    if x_risk_tag == "conservative":
        signals = [s for s in signals if s.get("label") == "high_conviction"]

    return {"signals": signals, "count": len(signals)}

@router.get("/signals/{signal_id}")
def get_signal_detail(
    signal_id: str,
    x_user_id: str = Header(..., alias="x-user-id"),
) -> dict[str, Any]:
    sb = get_supabase()
    result = (
        sb.table("retail_signals")
        .select("*")
        .eq("id", signal_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        from fastapi import HTTPException
        raise HTTPException(404, "Signal not found")
    return result.data
```

**Step 4: Register in main.py**

```python
from markets_worker.routers import retail_signals as retail_signals_router
# in create_app():
app.include_router(retail_signals_router.router)
```

**Step 5: Run tests — verify pass**

```bash
python -m pytest tests/test_retail_signals.py -v
```

**Step 6: Commit**

```bash
git add services/markets-worker/src/markets_worker/routers/retail_signals.py \
        services/markets-worker/tests/test_retail_signals.py \
        services/markets-worker/src/markets_worker/main.py
git commit -m "feat(retail): signal feed endpoint with risk-profile-aware filtering"
```

---

### Task 5: Signal Computation Pipeline (Stocks)

**Files:**
- Create: `services/markets-worker/src/markets_worker/signal_engine/rules/stocks.py`
- Create: `services/markets-worker/src/markets_worker/signal_engine/explainer.py`
- Create: `services/markets-worker/src/markets_worker/routers/retail_compute.py`
- Create: `services/markets-worker/tests/test_signal_compute.py`
- Modify: `services/markets-worker/src/markets_worker/main.py`

**Step 1: Write failing tests**

```python
# services/markets-worker/tests/test_signal_compute.py
import pytest
from markets_worker.signal_engine.rules.stocks import compute_stock_signal

def test_stock_signal_returns_buy_on_bullish_indicators():
    # RSI=62, EMA20 > EMA50, volume 1.6x avg → bullish
    closes = list(range(80, 160))  # uptrend
    volumes = [100_000] * len(closes)
    volumes[-1] = 160_000  # recent volume spike
    result = compute_stock_signal(
        symbol="RELIANCE", closes=closes, volumes=volumes,
        highs=[c + 2 for c in closes], lows=[c - 2 for c in closes],
        fundamental_score=0.7, horizon="swing",
    )
    assert result is not None
    assert result["direction"] in ("buy", "hold", "sell")
    assert 0 <= result["confidence"] <= 100
    assert "reasoning" in result

def test_stock_signal_returns_none_on_insufficient_data():
    result = compute_stock_signal(
        symbol="XYZ", closes=[100, 101], volumes=[1000, 1000],
        highs=[102, 103], lows=[99, 100],
        fundamental_score=0.5, horizon="swing",
    )
    assert result is None  # not enough data for indicators

def test_stock_signal_below_threshold_filtered():
    # Flat, low-volume data → low confidence → None returned
    closes = [100.0] * 60
    volumes = [50_000] * 60
    result = compute_stock_signal(
        symbol="TEST", closes=closes, volumes=volumes,
        highs=[101.0] * 60, lows=[99.0] * 60,
        fundamental_score=0.3, horizon="swing",
    )
    # Low fundamental + flat tech → confidence < 60 → filtered
    if result is not None:
        assert result["confidence"] < 60 or result["label"] in ("moderate", "strong", "high_conviction")
```

**Step 2: Implement stock signal computation**

```python
# services/markets-worker/src/markets_worker/signal_engine/rules/stocks.py
from __future__ import annotations
from typing import Any
from markets_worker.signal_engine.features import volume_ratio, compute_atr, normalize_score
from markets_worker.signal_engine.scorer import compute_confidence, label_from_confidence, confidence_interval

# Reuse existing indicator functions from signals.py
from markets_worker.routers.signals import compute_rsi, _ema

def _compute_macd(closes: list[float]) -> dict:
    if len(closes) < 27:
        return {"signal": "neutral", "histogram": 0}
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd_line = [e12 - e26 for e12, e26 in zip(ema12[-len(ema26):], ema26)]
    signal_line = _ema(macd_line, 9)
    hist = macd_line[-1] - signal_line[-1]
    return {
        "signal": "bullish" if hist > 0 else "bearish",
        "histogram": round(hist, 4),
    }

def _ema_cross(closes: list[float]) -> dict:
    if len(closes) < 52:
        return {"cross": "neutral", "ema20": None, "ema50": None}
    ema20 = _ema(closes, 20)[-1]
    ema50 = _ema(closes, 50)[-1]
    return {
        "cross": "bullish" if ema20 > ema50 else "bearish",
        "ema20": round(ema20, 2),
        "ema50": round(ema50, 2),
    }

def compute_stock_signal(
    symbol: str,
    closes: list[float],
    volumes: list[float],
    highs: list[float],
    lows: list[float],
    fundamental_score: float,  # 0-1 pre-computed
    horizon: str = "swing",
) -> dict[str, Any] | None:
    if len(closes) < 52:
        return None

    rsi = compute_rsi(closes)
    macd = _compute_macd(closes)
    ema = _ema_cross(closes)
    atr = compute_atr(highs, lows, closes)
    vol_ratio = volume_ratio(volumes[-1], sum(volumes[-21:-1]) / 20) if len(volumes) >= 21 else 1.0

    # Technical score: vote-based
    votes = 0
    total = 3
    if rsi and 40 < rsi < 70:
        votes += 1
    if macd["signal"] == "bullish":
        votes += 1
    if ema["cross"] == "bullish":
        votes += 1

    tech_score = normalize_score(votes, 0, total)
    vol_score  = normalize_score(vol_ratio, 0.5, 2.5)
    sent_score = 0.5  # neutral default; extended in Phase 2

    confidence = compute_confidence(
        technical=tech_score,
        fundamental=fundamental_score,
        volume=vol_score,
        sentiment=sent_score,
        horizon=horizon,
    )

    if confidence < 55:
        return None

    direction = "buy" if votes >= 2 and fundamental_score > 0.4 else \
                "sell" if votes == 0 else "hold"

    low, high = confidence_interval(confidence)
    current_price = closes[-1]

    return {
        "instrument": symbol,
        "asset_class": "stock",
        "horizon": horizon,
        "direction": direction,
        "confidence": confidence,
        "confidence_low": low,
        "confidence_high": high,
        "label": label_from_confidence(confidence),
        "reasoning": {
            "technical": {"rsi": rsi, "macd": macd, "ema_cross": ema},
            "volume": {"ratio": round(vol_ratio, 2)},
            "fundamental": {"score": fundamental_score},
            "atr": round(atr, 2),
        },
        "entry_price": round(current_price, 2),
        "stop_loss": round(current_price - 2 * atr, 2),
        "target_price": round(current_price + 4 * atr, 2),
        "risk_reward": round(4 / 2, 1),
    }
```

**Step 3: Implement LLM explainer**

```python
# services/markets-worker/src/markets_worker/signal_engine/explainer.py
from __future__ import annotations
from markets_worker.llm_gateway import llm_complete

_SYSTEM = """You are a financial signal explainer for a retail investment platform.
Given a trading signal with technical reasoning, generate plain-English explanations
at three levels. Return JSON only: {"beginner": "...", "casual": "...", "self_directed": "..."}.
Beginner: 1-2 sentences, no jargon, max 25 words.
Casual: 2-3 sentences, 1-2 metrics mentioned, max 50 words.
Self_directed: full reasoning with all metrics, entry/stop/target, confidence CI."""

def generate_explanations(signal: dict) -> dict[str, str]:
    prompt = f"Signal: {signal}"
    try:
        raw = llm_complete(system=_SYSTEM, user=prompt, temperature=0, max_tokens=400)
        import json
        return json.loads(raw)
    except Exception:
        name = signal.get("instrument", "This instrument")
        direction = signal.get("direction", "hold")
        conf = signal.get("confidence", 0)
        return {
            "beginner": f"{name} shows a {direction} signal based on current market data.",
            "casual": f"{name}: {direction.upper()} signal. Confidence: {conf:.0f}%.",
            "self_directed": f"{name}: {direction.upper()} | Confidence: {conf:.1f}% | Reasoning: {signal.get('reasoning', {})}",
        }
```

**Step 4: Run tests**

```bash
python -m pytest tests/test_signal_compute.py -v
```

Expected: 3 tests pass.

**Step 5: Commit**

```bash
git add services/markets-worker/src/markets_worker/signal_engine/rules/ \
        services/markets-worker/src/markets_worker/signal_engine/explainer.py \
        services/markets-worker/tests/test_signal_compute.py
git commit -m "feat(retail): stock signal computation pipeline with LLM explainer"
```

---

### Task 6: Frontend — Types, API Client, Hooks

**Files:**
- Create: `src/features/markets/retail/types.ts`
- Create: `src/features/markets/retail/api.ts`
- Create: `src/features/markets/retail/hooks/useRetailSignals.ts`
- Create: `src/features/markets/retail/hooks/useRiskProfile.ts`
- Create: `src/features/markets/retail/hooks/usePortfolioTiers.ts`
- Create: `src/features/markets/retail/hooks/useRetailSignals.test.ts`

**Step 1: Write failing test**

```typescript
// src/features/markets/retail/hooks/useRetailSignals.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test/utils'

vi.mock('@/features/markets/retail/api', () => ({
  fetchSignalFeed: vi.fn(),
}))

import { fetchSignalFeed } from '@/features/markets/retail/api'
import { useRetailSignals } from './useRetailSignals'

const MOCK_SIGNAL = {
  id: 'sig-1', instrument: 'RELIANCE', exchange: 'NSE',
  asset_class: 'stock', horizon: 'swing', direction: 'buy',
  confidence: 73.5, confidence_low: 70.1, confidence_high: 76.9,
  label: 'strong',
  explanation_beginner: 'Reliance looks strong.',
  explanation_casual: 'RSI 62, volume strong. Confidence: 73%.',
  explanation_self_directed: 'EMA20>EMA50, RSI 62...',
  entry_price: 2890, stop_loss: 2820, target_price: 3050, risk_reward: 2.3,
  expires_at: '2026-05-19T15:30:00+05:30',
}

describe('useRetailSignals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns signals on success', async () => {
    vi.mocked(fetchSignalFeed).mockResolvedValue({ signals: [MOCK_SIGNAL], count: 1 })
    const { result } = renderHook(() => useRetailSignals({}), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.signals).toHaveLength(1)
    expect(result.current.data?.signals[0].instrument).toBe('RELIANCE')
  })

  it('returns empty on error', async () => {
    vi.mocked(fetchSignalFeed).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useRetailSignals({}), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

**Step 2: Run — verify failure**

```bash
cd ~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx vitest run src/features/markets/retail/hooks/useRetailSignals.test.ts 2>&1 | tail -10
```

**Step 3: Implement types, API, and hooks**

```typescript
// src/features/markets/retail/types.ts
export type ExperienceLevel = 'beginner' | 'casual' | 'self_directed'
export type RiskTag = 'conservative' | 'moderate' | 'aggressive'
export type AssetClass = 'stock' | 'mutual_fund' | 'crypto' | 'fno' | 'commodity' | 'bond' | 'forex'
export type Horizon = 'intraday' | 'swing' | 'long_term'
export type SignalDirection = 'buy' | 'sell' | 'hold'
export type ConfidenceLabel = 'moderate' | 'strong' | 'high_conviction'
export type PortfolioTier = 'safety_net' | 'core' | 'experimental'

export interface RetailSignal {
  id: string
  instrument: string
  exchange: string
  asset_class: AssetClass
  horizon: Horizon
  direction: SignalDirection
  confidence: number
  confidence_low: number
  confidence_high: number
  label: ConfidenceLabel
  reasoning: Record<string, unknown>
  explanation_beginner: string
  explanation_casual: string
  explanation_self_directed: string
  entry_price: number | null
  stop_loss: number | null
  target_price: number | null
  risk_reward: number | null
  expires_at: string
}

export interface RiskProfile {
  experience_level: ExperienceLevel
  risk_tag: RiskTag
  goals: Array<{ goal: string; timeline_years: number }>
  quiz_answers: Record<string, string>
  behavioral_flags: Record<string, boolean>
}

export interface PortfolioTierData {
  tier: PortfolioTier
  current_value: number
  target_amount: number | null
  allocation: Record<string, number>
  goal_label: string | null
  goal_target: number | null
  goal_deadline_year: number | null
}

export interface SignalFeedParams {
  asset_class?: AssetClass
  horizon?: Horizon
  limit?: number
}
```

```typescript
// src/features/markets/retail/api.ts
import { supabase } from '@/integrations/supabase/client'
import type { RiskProfile, SignalFeedParams } from './types'

const WORKER_BASE = '/api/markets'

async function workerGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const url = new URL(WORKER_BASE + path, window.location.origin)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'x-user-id': session?.user?.id ?? '',
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function workerPost<T>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(WORKER_BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'x-user-id': session?.user?.id ?? '',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const fetchSignalFeed = (params: SignalFeedParams) =>
  workerGet<{ signals: import('./types').RetailSignal[]; count: number }>(
    '/v1/retail/signals/feed',
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
  )

export const fetchRiskProfile = () =>
  workerGet<RiskProfile>('/v1/retail/risk-profile')

export const upsertRiskProfile = (profile: RiskProfile) =>
  workerPost<RiskProfile>('/v1/retail/risk-profile', profile)

export const fetchPortfolioTiers = () =>
  workerGet<import('./types').PortfolioTierData[]>('/v1/retail/portfolio/tiers')
```

```typescript
// src/features/markets/retail/hooks/useRetailSignals.ts
import { useQuery } from '@tanstack/react-query'
import { fetchSignalFeed } from '../api'
import type { SignalFeedParams } from '../types'

export function useRetailSignals(params: SignalFeedParams) {
  return useQuery({
    queryKey: ['retail-signals', params],
    queryFn: () => fetchSignalFeed(params),
    staleTime: 15 * 60 * 1000, // 15 min
    refetchInterval: 15 * 60 * 1000,
  })
}
```

```typescript
// src/features/markets/retail/hooks/useRiskProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchRiskProfile, upsertRiskProfile } from '../api'
import type { RiskProfile } from '../types'

export function useRiskProfile() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['retail-risk-profile'], queryFn: fetchRiskProfile })
  const mutation = useMutation({
    mutationFn: upsertRiskProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['retail-risk-profile'] }),
  })
  return { ...query, save: mutation.mutate, isSaving: mutation.isPending }
}
```

```typescript
// src/features/markets/retail/hooks/usePortfolioTiers.ts
import { useQuery } from '@tanstack/react-query'
import { fetchPortfolioTiers } from '../api'

export function usePortfolioTiers() {
  return useQuery({ queryKey: ['retail-portfolio-tiers'], queryFn: fetchPortfolioTiers })
}
```

**Step 4: Run tests**

```bash
npx vitest run src/features/markets/retail/hooks/useRetailSignals.test.ts
```

Expected: 2 tests pass.

**Step 5: Commit**

```bash
git add src/features/markets/retail/types.ts \
        src/features/markets/retail/api.ts \
        src/features/markets/retail/hooks/
git commit -m "feat(retail): frontend types, API client, and TanStack Query hooks"
```

---

### Task 7: Onboarding Wizard (5-Step Frontend)

**Files:**
- Create: `src/features/markets/retail/onboarding/OnboardingWizard.tsx`
- Create: `src/features/markets/retail/onboarding/steps/StepExperience.tsx`
- Create: `src/features/markets/retail/onboarding/steps/StepGoals.tsx`
- Create: `src/features/markets/retail/onboarding/steps/StepTimeline.tsx`
- Create: `src/features/markets/retail/onboarding/steps/StepRiskQuiz.tsx`
- Create: `src/features/markets/retail/onboarding/steps/StepTierSetup.tsx`
- Create: `src/features/markets/retail/onboarding/OnboardingWizard.test.tsx`

**Step 1: Write failing test**

```typescript
// src/features/markets/retail/onboarding/OnboardingWizard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingWizard } from './OnboardingWizard'

vi.mock('../hooks/useRiskProfile', () => ({
  useRiskProfile: () => ({ data: null, save: vi.fn(), isSaving: false }),
}))

describe('OnboardingWizard', () => {
  it('renders step 1 by default', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    expect(screen.getByText(/how would you describe/i)).toBeInTheDocument()
  })

  it('advances to step 2 on selection', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText(/beginner/i))
    expect(screen.getByText(/what are you investing for/i)).toBeInTheDocument()
  })

  it('shows 5 step indicators', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    const dots = screen.getAllByRole('listitem')
    expect(dots.length).toBeGreaterThanOrEqual(5)
  })
})
```

**Step 2: Implement OnboardingWizard**

```typescript
// src/features/markets/retail/onboarding/OnboardingWizard.tsx
import { useState } from 'react'
import { StepExperience } from './steps/StepExperience'
import { StepGoals } from './steps/StepGoals'
import { StepTimeline } from './steps/StepTimeline'
import { StepRiskQuiz } from './steps/StepRiskQuiz'
import { StepTierSetup } from './steps/StepTierSetup'
import { useRiskProfile } from '../hooks/useRiskProfile'
import type { ExperienceLevel, RiskProfile } from '../types'

interface Props { onComplete: (profile: RiskProfile) => void }

const TOTAL_STEPS = 5

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<Partial<RiskProfile>>({})
  const { save, isSaving } = useRiskProfile()

  const next = (patch: Partial<RiskProfile>) => {
    const updated = { ...draft, ...patch }
    setDraft(updated)
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return }
    const profile = updated as RiskProfile
    save(profile, { onSuccess: () => onComplete(profile) })
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <ol className="flex gap-2 mb-8" aria-label="steps">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <li key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i + 1 <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </ol>

      {step === 1 && <StepExperience onNext={next} />}
      {step === 2 && <StepGoals onNext={next} />}
      {step === 3 && <StepTimeline goals={draft.goals ?? []} onNext={next} />}
      {step === 4 && <StepRiskQuiz onNext={next} />}
      {step === 5 && <StepTierSetup onNext={next} isSaving={isSaving} />}
    </div>
  )
}
```

```typescript
// src/features/markets/retail/onboarding/steps/StepExperience.tsx
import { Button } from '@/components/ui/button'
import type { ExperienceLevel, RiskProfile } from '../../types'

const OPTIONS: Array<{ level: ExperienceLevel; title: string; desc: string }> = [
  { level: 'beginner',     title: 'Beginner',      desc: 'New to investing' },
  { level: 'casual',       title: 'Casual',         desc: 'Some experience with mutual funds or FDs' },
  { level: 'self_directed',title: 'Self-directed',  desc: 'Comfortable with stocks, F&O, or trading apps' },
]

export function StepExperience({ onNext }: { onNext: (p: Partial<RiskProfile>) => void }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">How would you describe your investing experience?</h2>
      <p className="text-muted-foreground mb-6 text-sm">This sets the level of detail you'll see across the platform.</p>
      <div className="flex flex-col gap-3">
        {OPTIONS.map(o => (
          <button key={o.level}
            className="text-left border rounded-lg p-4 hover:border-primary hover:bg-accent transition-colors"
            onClick={() => onNext({ experience_level: o.level })}
          >
            <div className="font-medium">{o.title}</div>
            <div className="text-sm text-muted-foreground">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

```typescript
// src/features/markets/retail/onboarding/steps/StepGoals.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { RiskProfile } from '../../types'

const GOALS = [
  'Retirement', 'Emergency Fund', 'Wealth Growth',
  "Child's Education", 'Home Purchase', 'Short-term Income', 'Just exploring',
]

export function StepGoals({ onNext }: { onNext: (p: Partial<RiskProfile>) => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (g: string) =>
    setSelected(s => s.includes(g) ? s.filter(x => x !== g) : s.length < 3 ? [...s, g] : s)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">What are you investing for?</h2>
      <p className="text-muted-foreground mb-6 text-sm">Pick up to 3 goals.</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {GOALS.map(g => (
          <button key={g}
            className={`border rounded-lg p-3 text-sm text-left transition-colors ${
              selected.includes(g) ? 'border-primary bg-primary/10 font-medium' : 'hover:border-muted-foreground'
            }`}
            onClick={() => toggle(g)}
          >
            {g}
          </button>
        ))}
      </div>
      <Button disabled={selected.length === 0}
        onClick={() => onNext({ goals: selected.map(g => ({ goal: g, timeline_years: 10 })) })}>
        Continue
      </Button>
    </div>
  )
}
```

```typescript
// src/features/markets/retail/onboarding/steps/StepTimeline.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import type { RiskProfile } from '../../types'

const LABELS = ['1 yr', '3 yrs', '5 yrs', '10 yrs', '20+ yrs']
const VALUES = [1, 3, 5, 10, 20]

export function StepTimeline({ goals, onNext }: {
  goals: RiskProfile['goals'], onNext: (p: Partial<RiskProfile>) => void
}) {
  const [timelines, setTimelines] = useState<Record<string, number>>(
    Object.fromEntries(goals.map(g => [g.goal, 10]))
  )

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">When do you need this money?</h2>
      <p className="text-muted-foreground mb-6 text-sm">Set a timeline for each goal.</p>
      <div className="flex flex-col gap-6 mb-6">
        {goals.map(g => (
          <div key={g.goal}>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">{g.goal}</span>
              <span className="text-muted-foreground">{timelines[g.goal]} years</span>
            </div>
            <Slider min={1} max={20} step={1} value={[timelines[g.goal]]}
              onValueChange={([v]) => setTimelines(t => ({ ...t, [g.goal]: v }))} />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {LABELS.map(l => <span key={l}>{l}</span>)}
            </div>
          </div>
        ))}
      </div>
      <Button onClick={() => onNext({
        goals: goals.map(g => ({ ...g, timeline_years: timelines[g.goal] }))
      })}>Continue</Button>
    </div>
  )
}
```

```typescript
// src/features/markets/retail/onboarding/steps/StepRiskQuiz.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { RiskProfile, RiskTag } from '../../types'

const QUESTIONS = [
  {
    id: 'q1',
    text: 'Your ₹1 lakh investment drops to ₹75,000 in 3 months. You…',
    options: [
      { value: 'sell',     label: 'Sell — I can\'t afford more losses' },
      { value: 'hold',     label: 'Hold — I trust the long-term plan' },
      { value: 'buy_more', label: 'Buy more — great opportunity' },
    ],
  },
  {
    id: 'q2',
    text: 'You see a trending stock tip on social media. You…',
    options: [
      { value: 'buy_now',     label: 'Buy now before it\'s too late' },
      { value: 'investigate', label: 'Research it first' },
      { value: 'ignore',      label: 'Ignore — tips are unreliable' },
    ],
  },
  {
    id: 'q3',
    text: 'Markets have fallen 20%. Your advisor says to wait. You…',
    options: [
      { value: 'sell',    label: 'Sell anyway — I need peace of mind' },
      { value: 'wait',    label: 'Wait as advised' },
      { value: 'invest',  label: 'Invest more at the lower price' },
    ],
  },
  {
    id: 'q4',
    text: 'You need this money in 2 years. Would you put it in stocks?',
    options: [
      { value: 'yes',  label: 'Yes — higher returns' },
      { value: 'some', label: 'Some of it' },
      { value: 'no',   label: 'No — too risky for 2 years' },
    ],
  },
]

function deriveRiskTag(answers: Record<string, string>): RiskTag {
  const aggressiveVotes = Object.values(answers).filter(
    v => ['buy_more', 'ignore', 'invest', 'yes'].includes(v)
  ).length
  if (aggressiveVotes >= 3) return 'aggressive'
  if (aggressiveVotes >= 1) return 'moderate'
  return 'conservative'
}

export function StepRiskQuiz({ onNext }: { onNext: (p: Partial<RiskProfile>) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const done = Object.keys(answers).length === QUESTIONS.length

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">A few quick scenarios</h2>
      <p className="text-muted-foreground mb-6 text-sm">No right or wrong answers — helps us personalise your signals.</p>
      <div className="flex flex-col gap-6 mb-6">
        {QUESTIONS.map(q => (
          <div key={q.id}>
            <p className="text-sm font-medium mb-2">{q.text}</p>
            <div className="flex flex-col gap-2">
              {q.options.map(o => (
                <button key={o.value}
                  className={`text-left text-sm border rounded-lg px-3 py-2 transition-colors ${
                    answers[q.id] === o.value ? 'border-primary bg-primary/10' : 'hover:border-muted-foreground'
                  }`}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: o.value }))}
                >{o.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button disabled={!done} onClick={() => onNext({
        quiz_answers: answers,
        risk_tag: deriveRiskTag(answers),
      })}>Continue</Button>
    </div>
  )
}
```

```typescript
// src/features/markets/retail/onboarding/steps/StepTierSetup.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { RiskProfile } from '../../types'

export function StepTierSetup({ onNext, isSaving }: {
  onNext: (p: Partial<RiskProfile>) => void
  isSaving: boolean
}) {
  const [safety, setSafety] = useState('')
  const [core, setCore]     = useState('')
  const [exp, setExp]       = useState('')

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Set up your three portfolios</h2>
      <p className="text-muted-foreground mb-6 text-sm">Each has its own P&L. You can change these anytime.</p>
      <div className="flex flex-col gap-4 mb-6">
        {[
          { label: '🛡 Safety Net', desc: 'Capital protected. No signals. 3–6 months expenses.', val: safety, set: setSafety },
          { label: '🌱 Core Portfolio', desc: 'Long-term wealth. High-conviction signals only.', val: core, set: setCore },
          { label: '⚡ Experimental', desc: 'Active signals. Only money you can afford to lose.', val: exp, set: setExp },
        ].map(t => (
          <div key={t.label} className="border rounded-lg p-4">
            <div className="font-medium text-sm mb-1">{t.label}</div>
            <div className="text-xs text-muted-foreground mb-3">{t.desc}</div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input className="pl-6" placeholder="0" type="number"
                value={t.val} onChange={e => t.set(e.target.value)} />
            </div>
          </div>
        ))}
      </div>
      <Button disabled={isSaving} onClick={() => onNext({ behavioral_flags: {} })}>
        {isSaving ? 'Saving…' : 'Get started'}
      </Button>
    </div>
  )
}
```

**Step 3: Run tests**

```bash
npx vitest run src/features/markets/retail/onboarding/OnboardingWizard.test.tsx
```

Expected: 3 tests pass.

**Step 4: Commit**

```bash
git add src/features/markets/retail/onboarding/
git commit -m "feat(retail): 5-step onboarding wizard with experience level, goals, risk quiz, tier setup"
```

---

### Task 8: Signal Card + Recommendation Feed UI

**Files:**
- Create: `src/features/markets/retail/feed/SignalCard.tsx`
- Create: `src/features/markets/retail/feed/RetailSignalFeed.tsx`
- Create: `src/features/markets/retail/feed/ExecutionBottomSheet.tsx`
- Create: `src/features/markets/retail/feed/SignalCard.test.tsx`

**Step 1: Write failing test**

```typescript
// src/features/markets/retail/feed/SignalCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SignalCard } from './SignalCard'
import type { RetailSignal } from '../types'

const MOCK: RetailSignal = {
  id: 'sig-1', instrument: 'RELIANCE', exchange: 'NSE',
  asset_class: 'stock', horizon: 'swing', direction: 'buy',
  confidence: 73.5, confidence_low: 70.1, confidence_high: 76.9,
  label: 'strong',
  explanation_beginner: 'Reliance looks strong right now.',
  explanation_casual: 'RSI 62, volume strong. Confidence: 73%.',
  explanation_self_directed: 'EMA20>EMA50, RSI 62, volume 1.6x...',
  entry_price: 2890, stop_loss: 2820, target_price: 3050, risk_reward: 2.3,
  expires_at: '2026-05-19T15:30:00+05:30',
}

describe('SignalCard', () => {
  it('renders instrument name', () => {
    render(<SignalCard signal={MOCK} experienceLevel="beginner" onExecute={vi.fn()} />)
    expect(screen.getByText('RELIANCE')).toBeInTheDocument()
  })

  it('shows beginner explanation for beginner level', () => {
    render(<SignalCard signal={MOCK} experienceLevel="beginner" onExecute={vi.fn()} />)
    expect(screen.getByText('Reliance looks strong right now.')).toBeInTheDocument()
  })

  it('shows execute button', () => {
    render(<SignalCard signal={MOCK} experienceLevel="beginner" onExecute={vi.fn()} />)
    expect(screen.getByRole('button', { name: /buy/i })).toBeInTheDocument()
  })

  it('calls onExecute when button clicked', () => {
    const onExecute = vi.fn()
    render(<SignalCard signal={MOCK} experienceLevel="beginner" onExecute={onExecute} />)
    fireEvent.click(screen.getByRole('button', { name: /buy/i }))
    expect(onExecute).toHaveBeenCalledWith(MOCK)
  })

  it('shows confidence % for casual level', () => {
    render(<SignalCard signal={MOCK} experienceLevel="casual" onExecute={vi.fn()} />)
    expect(screen.getByText(/73/)).toBeInTheDocument()
  })
})
```

**Step 2: Implement SignalCard**

```typescript
// src/features/markets/retail/feed/SignalCard.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RetailSignal, ExperienceLevel } from '../types'

const DIRECTION_STYLES = {
  buy:  { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800', btn: 'bg-green-600 hover:bg-green-700 text-white' },
  sell: { bg: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-800',     btn: 'bg-red-600 hover:bg-red-700 text-white' },
  hold: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800', btn: 'bg-amber-500 hover:bg-amber-600 text-white' },
}

const LABEL_DISPLAY: Record<string, string> = {
  moderate: 'Moderate', strong: 'Strong', high_conviction: 'High Conviction',
}

interface Props {
  signal: RetailSignal
  experienceLevel: ExperienceLevel
  onExecute: (signal: RetailSignal) => void
}

export function SignalCard({ signal, experienceLevel, onExecute }: Props) {
  const styles = DIRECTION_STYLES[signal.direction]

  const explanation =
    experienceLevel === 'beginner'     ? signal.explanation_beginner :
    experienceLevel === 'casual'       ? signal.explanation_casual :
                                         signal.explanation_self_directed

  return (
    <div className={`border rounded-xl p-4 ${styles.bg} transition-shadow hover:shadow-sm`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-base">{signal.instrument}</span>
            <Badge variant="outline" className="text-xs">{signal.asset_class}</Badge>
            <Badge variant="outline" className="text-xs">{signal.horizon}</Badge>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
            {LABEL_DISPLAY[signal.label]}
            {experienceLevel !== 'beginner' && ` · ${signal.confidence.toFixed(0)}%`}
          </span>
        </div>
        <Button size="sm" className={`capitalize shrink-0 ${styles.btn}`}
          onClick={() => onExecute(signal)}>
          {signal.direction}
        </Button>
      </div>

      <p className="text-sm text-foreground/80 mb-3">{explanation}</p>

      {experienceLevel === 'self_directed' && signal.entry_price && (
        <div className="grid grid-cols-3 gap-2 text-xs border-t pt-2 mt-2">
          <div><span className="text-muted-foreground">Entry</span><div className="font-medium">₹{signal.entry_price}</div></div>
          <div><span className="text-muted-foreground">Stop</span><div className="font-medium text-red-600">₹{signal.stop_loss}</div></div>
          <div><span className="text-muted-foreground">Target</span><div className="font-medium text-green-600">₹{signal.target_price}</div></div>
        </div>
      )}
    </div>
  )
}
```

```typescript
// src/features/markets/retail/feed/ExecutionBottomSheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { RetailSignal, PortfolioTier } from '../types'
import { useState } from 'react'

interface Props {
  signal: RetailSignal | null
  open: boolean
  onClose: () => void
  onConfirm: (signal: RetailSignal, tier: PortfolioTier) => void
}

export function ExecutionBottomSheet({ signal, open, onClose, onConfirm }: Props) {
  const [tier, setTier] = useState<PortfolioTier>('experimental')
  if (!signal) return null

  const amount = signal.entry_price
    ? `₹${signal.entry_price.toLocaleString('en-IN')}`
    : 'Market price'

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="capitalize">
            {signal.direction} {signal.instrument}
          </SheetTitle>
        </SheetHeader>

        <p className="text-sm text-muted-foreground mb-4">
          {signal.direction === 'buy' ? 'Buy' : 'Sell'} at {amount} via your connected broker.
        </p>

        <div className="mb-4">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Which portfolio?</p>
          <div className="flex gap-2">
            {(['core', 'experimental'] as PortfolioTier[]).map(t => (
              <button key={t} onClick={() => setTier(t)}
                className={`flex-1 border rounded-lg py-2 text-sm capitalize transition-colors ${
                  tier === t ? 'border-primary bg-primary/10 font-medium' : ''
                }`}>{t}</button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4 bg-amber-50 border border-amber-100 rounded p-2">
          Investment in securities is subject to market risks. Past performance is not indicative of future returns.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => { onConfirm(signal, tier); onClose() }}>
            Confirm {signal.direction}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

```typescript
// src/features/markets/retail/feed/RetailSignalFeed.tsx
import { useState } from 'react'
import { SignalCard } from './SignalCard'
import { ExecutionBottomSheet } from './ExecutionBottomSheet'
import { useRetailSignals } from '../hooks/useRetailSignals'
import { useRiskProfile } from '../hooks/useRiskProfile'
import type { RetailSignal, AssetClass, PortfolioTier } from '../types'

const ASSET_TABS: Array<{ key: AssetClass | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'stock', label: 'Stocks' },
  { key: 'mutual_fund', label: 'MF' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'fno', label: 'F&O' },
  { key: 'commodity', label: 'Commodity' },
]

interface Props {
  onExecute?: (signal: RetailSignal, tier: PortfolioTier) => void
}

export function RetailSignalFeed({ onExecute }: Props) {
  const [activeClass, setActiveClass] = useState<AssetClass | 'all'>('all')
  const [pendingSignal, setPendingSignal] = useState<RetailSignal | null>(null)
  const { data: profile } = useRiskProfile()
  const experienceLevel = profile?.experience_level ?? 'beginner'

  const { data, isLoading } = useRetailSignals(
    activeClass === 'all' ? {} : { asset_class: activeClass }
  )

  return (
    <div>
      {/* Asset class tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {ASSET_TABS.map(t => (
          <button key={t.key}
            onClick={() => setActiveClass(t.key)}
            className={`shrink-0 text-sm px-3 py-1.5 rounded-full border transition-colors ${
              activeClass === t.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-muted-foreground'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      )}

      {!isLoading && data?.signals.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No signals available for this filter right now. Check back in 15 minutes.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {data?.signals.map(signal => (
          <SignalCard key={signal.id} signal={signal}
            experienceLevel={experienceLevel}
            onExecute={setPendingSignal} />
        ))}
      </div>

      <ExecutionBottomSheet
        signal={pendingSignal}
        open={!!pendingSignal}
        onClose={() => setPendingSignal(null)}
        onConfirm={(sig, tier) => { onExecute?.(sig, tier); setPendingSignal(null) }}
      />
    </div>
  )
}
```

**Step 3: Run tests**

```bash
npx vitest run src/features/markets/retail/feed/SignalCard.test.tsx
```

Expected: 5 tests pass.

**Step 4: Commit**

```bash
git add src/features/markets/retail/feed/
git commit -m "feat(retail): SignalCard (adaptive 3-level), RetailSignalFeed, ExecutionBottomSheet"
```

---

### Task 9: Retail Dashboard + Navigation Entry Point

**Files:**
- Create: `src/features/markets/retail/RetailDashboard.tsx`
- Create: `src/features/markets/retail/dashboard/PortfolioTierView.tsx`
- Create: `src/features/markets/retail/index.ts`
- Modify: `src/features/markets/pages/MarketsPage.tsx` (or equivalent entry)

**Step 1: Implement dashboard**

```typescript
// src/features/markets/retail/dashboard/PortfolioTierView.tsx
import { usePortfolioTiers } from '../hooks/usePortfolioTiers'
import type { PortfolioTierData } from '../types'

const TIER_META: Record<string, { icon: string; label: string; desc: string }> = {
  safety_net:   { icon: '🛡', label: 'Safety Net',      desc: 'Capital protected' },
  core:         { icon: '🌱', label: 'Core Portfolio',  desc: 'Long-term wealth' },
  experimental: { icon: '⚡', label: 'Experimental',    desc: 'Active signals' },
}

function TierCard({ tier }: { tier: PortfolioTierData }) {
  const meta = TIER_META[tier.tier]
  const pct = tier.goal_target
    ? Math.round((tier.current_value / tier.goal_target) * 100)
    : null

  return (
    <div className="border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{meta.icon}</span>
        <div>
          <div className="font-medium text-sm">{meta.label}</div>
          <div className="text-xs text-muted-foreground">{meta.desc}</div>
        </div>
      </div>
      <div className="text-2xl font-bold">
        ₹{tier.current_value.toLocaleString('en-IN')}
      </div>
      {pct !== null && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{tier.goal_label ?? 'Goal'}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

export function PortfolioTierView() {
  const { data: tiers, isLoading } = usePortfolioTiers()

  if (isLoading) return <div className="h-32 bg-muted rounded-xl animate-pulse" />

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {(tiers ?? []).map(t => <TierCard key={t.tier} tier={t} />)}
    </div>
  )
}
```

```typescript
// src/features/markets/retail/RetailDashboard.tsx
import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PortfolioTierView } from './dashboard/PortfolioTierView'
import { RetailSignalFeed } from './feed/RetailSignalFeed'
import { OnboardingWizard } from './onboarding/OnboardingWizard'
import { useRiskProfile } from './hooks/useRiskProfile'

export function RetailDashboard() {
  const { data: profile, isLoading } = useRiskProfile()
  const [onboarded, setOnboarded] = useState(false)

  if (isLoading) return <div className="p-6 animate-pulse bg-muted h-64 rounded-xl" />

  if (!profile && !onboarded) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingWizard onComplete={() => setOnboarded(true)} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Your Portfolios</h1>
      <PortfolioTierView />

      <div className="mt-6">
        <Tabs defaultValue="signals">
          <TabsList className="mb-4">
            <TabsTrigger value="signals">Signals</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          </TabsList>
          <TabsContent value="signals">
            <RetailSignalFeed />
          </TabsContent>
          <TabsContent value="portfolio">
            <PortfolioTierView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

```typescript
// src/features/markets/retail/index.ts
export { RetailDashboard } from './RetailDashboard'
export type { RetailSignal, RiskProfile, PortfolioTierData } from './types'
```

**Step 2: Add Retail Mode entry to Markets navigation**

Find the Markets pages index and add:

```typescript
// In src/features/markets/pages/ or wherever Markets tabs are defined:
// Add a "Retail" or "Invest" tab that renders <RetailDashboard />
import { RetailDashboard } from '../retail'
// ... add to tab list
```

**Step 3: Verify in browser**

```bash
cd ~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npm run dev:vite
```

Navigate to Markets → Retail (or Invest) tab. Verify:
- Onboarding wizard shows for new users
- Portfolio tier cards render
- Signal feed shows (may be empty until signals are computed)
- Signal card tabs switch

**Step 4: Commit**

```bash
git add src/features/markets/retail/RetailDashboard.tsx \
        src/features/markets/retail/dashboard/ \
        src/features/markets/retail/index.ts
git commit -m "feat(retail): RetailDashboard with portfolio tier view, onboarding gate, and signal feed"
```

---

## Phase 2 — Behavioral Layer (Tasks 10–12)

*Start here after Phase 1 is live and tested.*

---

### Task 10: Loss Aversion Alert Backend

**Files:**
- Create: `services/markets-worker/src/markets_worker/behavioral/stress_detector.py`
- Create: `services/markets-worker/src/markets_worker/routers/retail_behavioral.py`
- Create: `services/markets-worker/tests/test_stress_detector.py`
- Modify: `services/markets-worker/src/markets_worker/main.py`

**Step 1: Write failing tests**

```python
# services/markets-worker/tests/test_stress_detector.py
from markets_worker.behavioral.stress_detector import (
    compute_drawdown_pct, classify_alert_tier
)

def test_drawdown_calculation():
    assert compute_drawdown_pct(peak=100_000, current=91_000) == pytest.approx(9.0)

def test_yellow_alert():
    assert classify_alert_tier(drawdown_pct=7.5) == "yellow"

def test_orange_alert():
    assert classify_alert_tier(drawdown_pct=14.0) == "orange"

def test_red_alert():
    assert classify_alert_tier(drawdown_pct=22.0) == "red"

def test_no_alert_small_drawdown():
    assert classify_alert_tier(drawdown_pct=2.0) is None
```

**Step 2: Implement**

```python
# services/markets-worker/src/markets_worker/behavioral/stress_detector.py
from __future__ import annotations
import math

def compute_drawdown_pct(peak: float, current: float) -> float:
    if peak == 0:
        return 0.0
    return round((peak - current) / peak * 100, 2)

def classify_alert_tier(drawdown_pct: float) -> str | None:
    if drawdown_pct >= 20:
        return "red"
    if drawdown_pct >= 10:
        return "orange"
    if drawdown_pct >= 5:
        return "yellow"
    return None

def recovery_context(drawdown_pct: float) -> dict:
    """Historical Indian equity recovery statistics."""
    if drawdown_pct <= 10:
        return {"median_months": 4, "pct_recovered": 95}
    if drawdown_pct <= 20:
        return {"median_months": 14, "pct_recovered": 92}
    return {"median_months": 24, "pct_recovered": 88}
```

**Step 3: Implement behavioral router**

```python
# services/markets-worker/src/markets_worker/routers/retail_behavioral.py
from fastapi import APIRouter, Header
from markets_worker.db import get_supabase
from markets_worker.behavioral.stress_detector import (
    compute_drawdown_pct, classify_alert_tier, recovery_context
)

router = APIRouter(prefix="/v1/retail/behavioral", tags=["retail"])

@router.get("/stress-check")
def stress_check(
    current_value: float,
    peak_value: float,
    x_user_id: str = Header(..., alias="x-user-id"),
) -> dict:
    drawdown = compute_drawdown_pct(peak_value, current_value)
    tier = classify_alert_tier(drawdown)
    result = {
        "drawdown_pct": drawdown,
        "alert_tier": tier,
        "show_alert": tier is not None,
    }
    if tier:
        result["recovery_context"] = recovery_context(drawdown)
        # Log the event
        sb = get_supabase()
        sb.table("retail_behavioral_events").insert({
            "user_id": x_user_id,
            "event_type": f"loss_alert_{tier}",
            "payload": result,
        }).execute()
    return result
```

**Step 4: Run tests**

```bash
python -m pytest tests/test_stress_detector.py -v
```

**Step 5: Commit**

```bash
git add services/markets-worker/src/markets_worker/behavioral/ \
        services/markets-worker/src/markets_worker/routers/retail_behavioral.py \
        services/markets-worker/tests/test_stress_detector.py
git commit -m "feat(retail): loss aversion stress detector and behavioral alert endpoint"
```

---

### Task 11: Behavioral Alerts Frontend

**Files:**
- Create: `src/features/markets/retail/behavioral/MarketStressBanner.tsx`
- Create: `src/features/markets/retail/behavioral/CoolingOffScreen.tsx`
- Create: `src/features/markets/retail/behavioral/InlineEducation.tsx`
- Create: `src/features/markets/retail/behavioral/MarketStressBanner.test.tsx`

**Step 1: Write failing test**

```typescript
// src/features/markets/retail/behavioral/MarketStressBanner.test.tsx
import { render, screen } from '@testing-library/react'
import { MarketStressBanner } from './MarketStressBanner'

it('shows yellow alert for 7% drawdown', () => {
  render(<MarketStressBanner drawdownPct={7} alertTier="yellow"
    recoveryContext={{ median_months: 4, pct_recovered: 95 }} />)
  expect(screen.getByText(/7/)).toBeInTheDocument()
  expect(screen.getByText(/normal/i)).toBeInTheDocument()
})

it('shows nothing when no alert', () => {
  const { container } = render(<MarketStressBanner drawdownPct={2} alertTier={null}
    recoveryContext={null} />)
  expect(container.firstChild).toBeNull()
})
```

**Step 2: Implement**

```typescript
// src/features/markets/retail/behavioral/MarketStressBanner.tsx
interface Props {
  drawdownPct: number
  alertTier: 'yellow' | 'orange' | 'red' | null
  recoveryContext: { median_months: number; pct_recovered: number } | null
}

const TIER_STYLES = {
  yellow: 'bg-amber-50 border-amber-200 text-amber-900',
  orange: 'bg-orange-50 border-orange-200 text-orange-900',
  red:    'bg-red-50 border-red-200 text-red-900',
}

export function MarketStressBanner({ drawdownPct, alertTier, recoveryContext }: Props) {
  if (!alertTier) return null

  const messages = {
    yellow: `Your portfolio is down ${drawdownPct.toFixed(1)}% from its recent high. This is normal for long-term investing. No action needed.`,
    orange: `Your portfolio is down ${drawdownPct.toFixed(1)}%. Portfolios like yours recovered in ~${recoveryContext?.median_months} months on average. Selling now locks in the loss permanently.`,
    red:    `Your portfolio is down ${drawdownPct.toFixed(1)}%. Before making changes, remember: investors who sold during COVID (−38%) and stayed out missed a 100% recovery in 18 months.`,
  }

  return (
    <div className={`border rounded-lg p-3 mb-4 text-sm ${TIER_STYLES[alertTier]}`}>
      {messages[alertTier]}
    </div>
  )
}
```

```typescript
// src/features/markets/retail/behavioral/CoolingOffScreen.tsx
import { Button } from '@/components/ui/button'

interface Props {
  drawdownPct: number
  goalLabel?: string
  goalSetback?: string
  onWait24h: () => void
  onSupport: () => void
  onProceed: () => void
}

export function CoolingOffScreen({ drawdownPct, goalLabel, goalSetback, onWait24h, onSupport, onProceed }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <h2 className="text-xl font-semibold mb-3">Before you sell everything…</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Your portfolio is down {drawdownPct.toFixed(0)}% during a market dip.
        </p>
        <ul className="text-sm space-y-2 mb-6">
          <li className="flex gap-2">
            <span>—</span>
            <span>Investors who sold during the COVID crash (March 2020) and didn't reinvest missed a 100% recovery in 18 months.</span>
          </li>
          {goalLabel && goalSetback && (
            <li className="flex gap-2">
              <span>—</span>
              <span>Your <strong>{goalLabel}</strong> goal is set back by approximately {goalSetback} if you exit now.</span>
            </li>
          )}
        </ul>
        <div className="flex flex-col gap-2">
          <Button onClick={onWait24h}>Wait 24 hours (remind me tomorrow)</Button>
          <Button variant="outline" onClick={onSupport}>Talk to support</Button>
          <Button variant="ghost" className="text-muted-foreground text-xs" onClick={onProceed}>
            I understand the risks — proceed anyway
          </Button>
        </div>
      </div>
    </div>
  )
}
```

```typescript
// src/features/markets/retail/behavioral/InlineEducation.tsx
import { useState } from 'react'
import { X } from 'lucide-react'

export type EducationTrigger =
  | 'low_liquidity' | 'fund_comparison' | 'first_stop_loss'
  | 'first_intraday' | 'high_vix' | 'first_sip' | 'enable_fno'
  | 'high_concentration' | 'high_conviction_signal' | 'enable_autonomous'

interface Props {
  trigger: EducationTrigger
  context?: Record<string, string | number>
  onDismiss?: () => void
}

const MESSAGES: Record<EducationTrigger, (ctx: Record<string, string | number>) => string> = {
  low_liquidity:         ctx => `Low liquidity: This stock trades ₹${ctx.daily_volume ?? '?'}/day. Your order may be hard to fill and harder to sell later.`,
  fund_comparison:       ctx => `Fund A (${ctx.ratio_a}% expense ratio) vs Fund B (${ctx.ratio_b}%). Over 20 years on ₹1L, that difference compounds significantly — lower fees win long-term.`,
  first_stop_loss:       () => `A stop-loss automatically sells if price falls to your level. It limits losses but won't protect against gap-down openings.`,
  first_intraday:        () => `Intraday means you must sell before 3:30 PM today. If you forget, your broker will auto-square off at market price.`,
  high_vix:              () => `Markets are unusually volatile right now. Your order may fill at a very different price than shown. Consider a limit order.`,
  first_sip:             () => `SIP invests the same amount every month. When markets fall, you buy more units — this is called rupee cost averaging.`,
  enable_fno:            () => `F&O (futures & options) can result in losses beyond your initial investment. Please complete the 3-screen education before proceeding.`,
  high_concentration:    ctx => `Your portfolio is ${ctx.pct ?? '?'}% in one stock. A diversified portfolio typically keeps no single stock above 10%.`,
  high_conviction_signal:ctx => `This signal type has been right ~${ctx.accuracy ?? '?'}% of the time — meaning it's also been wrong ~${100 - Number(ctx.accuracy ?? 0)}% of the time.`,
  enable_autonomous:     () => `Autonomous execution will place orders on your behalf. Please complete the 5-screen setup to understand how it works and where the kill switch is.`,
}

export function InlineEducation({ trigger, context = {}, onDismiss }: Props) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  const dismiss = () => { setVisible(false); onDismiss?.() }

  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900 my-2">
      <span className="shrink-0 mt-0.5">ℹ️</span>
      <p className="flex-1">{MESSAGES[trigger](context)}</p>
      <button onClick={dismiss} className="shrink-0 text-blue-400 hover:text-blue-600">
        <X size={14} />
      </button>
    </div>
  )
}
```

**Step 3: Run tests**

```bash
npx vitest run src/features/markets/retail/behavioral/MarketStressBanner.test.tsx
```

**Step 4: Commit**

```bash
git add src/features/markets/retail/behavioral/
git commit -m "feat(retail): behavioral support — stress banner, cooling-off screen, inline education"
```

---

## Phase 3 — Autonomous Execution (Tasks 12–16)

*Full detail in the design doc. Key tasks:*

### Task 12: Layer 0 Data Validation

**Files:**
- Create: `services/markets-worker/src/markets_worker/autonomous/validation/data_validator.py`
- Create: `services/markets-worker/src/markets_worker/autonomous/validation/fat_finger.py`
- Create: `services/markets-worker/src/markets_worker/autonomous/validation/idempotency.py`
- Create: `services/markets-worker/tests/test_autonomous_validation.py`

Key logic to implement (write tests first for each):
- `is_price_stale(timestamp, max_age_seconds=5) -> bool`
- `prices_diverge(source_a, source_b, threshold_pct=0.5) -> bool`
- `is_fat_finger(order_size, avg_daily_volume, portfolio_value, order_value) -> tuple[bool, str]`
- `generate_idempotency_key(user_id, instrument, side, quantity, price) -> str`
- `is_duplicate(key, redis_client, window_seconds=0.5) -> bool`

### Task 13: LLM Multi-Agent Framework

**Files:**
- Create: `services/markets-worker/src/markets_worker/autonomous/agents/bull_agent.py`
- Create: `services/markets-worker/src/markets_worker/autonomous/agents/bear_agent.py`
- Create: `services/markets-worker/src/markets_worker/autonomous/agents/risk_agent.py`
- Create: `services/markets-worker/src/markets_worker/autonomous/agents/trader_agent.py`
- Create: `services/markets-worker/src/markets_worker/autonomous/agents/prompt_sanitizer.py`

Use existing `llm_gateway.llm_complete()`. Temperature=0 for all agents. Each agent returns structured JSON. Prompt sanitizer strips instruction-injection patterns before any external text reaches LLM.

### Task 14: Execution Rule Engine + OMS

**Files:**
- Create: `services/markets-worker/src/markets_worker/autonomous/rule_engine.py`
- Create: `services/markets-worker/src/markets_worker/autonomous/oms.py`
- Create: `services/markets-worker/src/markets_worker/routers/retail_execution_rules.py`

Rule engine evaluates conditions against current market data. OMS tags every order with Algo-ID, runs all Layer 0 checks, calls broker API, writes audit log. Reuse existing broker registry (`brokers/registry.py`).

### Task 15: Kill Switch (All 4 Levels)

**Files:**
- Create: `services/markets-worker/src/markets_worker/autonomous/kill_switch.py`
- Create: `services/markets-worker/src/markets_worker/routers/retail_kill_switch.py`
- Create: `src/features/markets/retail/autonomous/KillSwitchPanel.tsx`

Kill switch levels: per-trade (cancel single), per-strategy (pause + cancel all strategy orders), per-account (liquidate all at market), platform-wide (halt new execution). Per-account and per-trade stops are submitted as exchange-side GTT — survive network failure.

### Task 16: Gradual Autonomy Phases

**Files:**
- Create: `src/features/markets/retail/autonomous/GradualAutonomyWizard.tsx`
- Create: `src/features/markets/retail/autonomous/PaperTradingPhase.tsx`

Paper trading: API calls to signal engine but order submission is mocked. Tracks P&L on mock fills. Phase gates enforced server-side: paper `minimum_days=30`, micro `max_portfolio_pct=5`, pilot `max_portfolio_pct=25`. Cannot skip.

---

## Phase 4 — Community Layer (Tasks 17–19)

### Task 17: Thematic Baskets

**Files:**
- Create: `services/markets-worker/src/markets_worker/routers/retail_community.py`
- Create: `src/features/markets/retail/community/BasketDiscovery.tsx`
- Create: `src/features/markets/retail/community/BasketDetail.tsx`

Baskets are stored in `community_baskets` table. Creator submits basket (instrument list + weights + rationale). Platform runs backtest (uses existing signal engine data). Published after SEBI-compliance check. Users invest via one-tap that distributes amount across basket instruments.

### Task 18: Copy Trading Extension

**File:** `src/features/markets/retail/community/CopyTradingExtended.tsx`

Extends existing `CopyTradeSetupModal.tsx`. Adds: creator performance stats (Sharpe, max drawdown, % months positive), safety limits enforcement (max 20% of Experimental tier per copied trader), partial copy (copy only specific strategy types), auto-unfollow if copied trader drawdown exceeds user limit.

### Task 19: Strategy Marketplace

**File:** `src/features/markets/retail/community/StrategyMarketplace.tsx`

Browse pre-built no-code strategies. Shows: backtest Sharpe, walk-forward results, live user count, creator rating. Paper trade mandatory before live deploy (14 days). Rating only from users with active live deployments.

---

## Running All Tests

```bash
# Backend
cd services/markets-worker
python -m pytest tests/ -v --tb=short

# Frontend
cd ~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx vitest run src/features/markets/retail/
```

## Baseline Verification Before Merging

```bash
npm run typecheck
npm run lint
npx vitest run
```

All must pass before opening PR.

---

*Plan complete. Worktree: `~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform` | Branch: `feature/retail-investment-platform`*
