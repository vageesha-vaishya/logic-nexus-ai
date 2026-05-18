# Retail Investment Platform — Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Phase 1 retail platform with full asset-class signal coverage (crypto/F&O/commodities/bonds/forex), a three-tier behavioral loss-aversion alert system, and 8 key inline contextual education moments.

**Architecture:** Three independent work streams: (1) Signal expansion — one backend line change + frontend filter additions; (2) Behavioral layer — new DB table, new `behavioral.py` FastAPI router, two new React components (`BehavioralAlertBanner`, `CoolingOffScreen`), and a new `useBehavioralAlerts` hook; (3) Inline education — pure frontend, `InlineEducation` component + `useInlineEducation` hook that fires based on user action context props. All behavioral state is stored in `markets.behavioral_events` and surfaced through `GET /v1/retail/behavioral/status`. Market stress is computed from the existing `_ltp_cache` in `ltp.py` (Nifty50 + India VIX already cached).

**Tech Stack:** React 18 + TypeScript + TanStack Query + Shadcn/Radix UI (frontend); FastAPI + Python + Supabase (backend); Vitest + @testing-library/react (frontend tests); pytest + uv (backend tests)

**Worktree:** `~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform`
**Branch:** `feature/retail-investment-platform`

---

## What Already Exists (Do NOT Rebuild)

| Existing piece | Location | Used in Phase 2 for |
|---|---|---|
| `_ltp_cache` with Nifty50 + VIX | `routers/ltp.py` | Market stress calculation |
| `_send_push_notification()` | `alert_checker.py:21-47` | Behavioral push delivery |
| `usePortfolioPnL(portfolioId, lookback)` | `hooks/usePortfolioPnL.ts` | Peak NAV + drawdown from `series` |
| `usePortfolioTiers()` | `retail/hooks/usePortfolioTiers.ts` | Tier-level drawdown per portfolio |
| `SignalFilter.tsx` | `retail/feed/SignalFilter.tsx` | Extend with new asset classes |
| `retail.py` router | `routers/retail.py:157` | Change hardcoded asset class list |
| `signal_generator.py` | `jobs/signal_generator.py` | Already generates crypto/F&O/commodity/bond/forex |
| `marketsKeys.retail.*` | `hooks/queryKeys.ts` | Add `behavioral` key |
| `conftest.py` + `createWrapper()` | `tests/conftest.py`, `src/test/utils.tsx` | All new tests |

---

## Drawdown Computation (Client-Side, No Backend Change)

`usePortfolioPnL(portfolioId, 365)` returns `{ data: { series: PnLPoint[], summary } }`.  
`PnLPoint = { date, nav, invested, pnl, pnl_pct }`.

```typescript
const series = pnl.data?.series ?? [];
const peakNav = series.length > 0 ? Math.max(...series.map(p => p.nav)) : 0;
const currentNav = pnl.data?.summary.current_nav ?? 0;
const drawdownPct = peakNav > 0 ? ((peakNav - currentNav) / peakNav) * 100 : 0;
```

Alert tiers (from design doc):
- **Yellow** — drawdown 5–10% from peak
- **Orange** — drawdown 10–20% from peak  
- **Red** — drawdown > 20% OR user about to sell entire Core Portfolio during downturn

---

## Task 1: DB Migration — behavioral_events

**Files:**
- Create: `supabase/migrations/20260518130000_markets_behavioral_events.sql`

### Step 1: Write the migration

```sql
-- supabase/migrations/20260518130000_markets_behavioral_events.sql

create table if not exists markets.behavioral_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  event_type      text not null check (event_type in (
    'yellow_alert', 'orange_alert', 'red_alert', 'cooling_off',
    'education_shown', 'panic_sell_intercepted', 'cooling_off_waited'
  )),
  severity        text not null check (severity in ('info', 'warning', 'critical')),
  metadata        jsonb not null default '{}',
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

alter table markets.behavioral_events enable row level security;

drop policy if exists "Users manage own behavioral events" on markets.behavioral_events;
create policy "Users manage own behavioral events"
  on markets.behavioral_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Query pattern: latest unacknowledged event per user
create index if not exists idx_behavioral_events_user_unacked
  on markets.behavioral_events (user_id, created_at desc)
  where acknowledged_at is null;

-- education_shown dedup: one per user per education_id
create index if not exists idx_behavioral_events_education
  on markets.behavioral_events (user_id, (metadata->>'education_id'))
  where event_type = 'education_shown';
```

### Step 2: Apply migration

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npm run supabase:db:push
```

Expected: Applied with no errors. If local Supabase is not running, just commit the file — it will be applied on next reset.

### Step 3: Commit

```bash
git add supabase/migrations/20260518130000_markets_behavioral_events.sql
git commit -m "feat(retail-p2): add behavioral_events migration"
```

---

## Task 2: Backend — Market Stress + Behavioral Router

**Files:**
- Create: `services/markets-worker/src/markets_worker/routers/behavioral.py`
- Modify: `services/markets-worker/src/markets_worker/main.py`
- Test: `services/markets-worker/tests/test_behavioral_router.py`

### Step 1: Write the failing tests

```python
# services/markets-worker/tests/test_behavioral_router.py
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


MOCK_USER_ID = "user-test-1"


@pytest.fixture
def app():
    from markets_worker.main import create_app
    from markets_worker.auth import get_auth, AuthContext
    application = create_app()
    application.dependency_overrides[get_auth] = lambda: AuthContext(user_id=MOCK_USER_ID)
    return application


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer mock-token"}


class TestMarketStress:
    def test_returns_stress_metrics(self, client, auth_headers):
        mock_cache = {
            "NIFTY 50:NSE": (1000.0, {"ltp": 21800.0, "prev_price": 22000.0}),
            "INDIA VIX:NSE": (1000.0, {"ltp": 18.5, "prev_price": 14.0}),
        }
        with patch("markets_worker.routers.behavioral._ltp_cache", mock_cache):
            resp = client.get("/v1/retail/behavioral/market-stress", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "nifty_change_pct" in data
        assert "vix_current" in data
        assert "stress_level" in data
        # Nifty down ~0.9%, VIX 18.5 (above baseline 14)
        assert data["nifty_change_pct"] < 0
        assert data["stress_level"] in ("low", "medium", "high")

    def test_returns_low_stress_when_market_up(self, client, auth_headers):
        mock_cache = {
            "NIFTY 50:NSE": (1000.0, {"ltp": 22200.0, "prev_price": 22000.0}),
            "INDIA VIX:NSE": (1000.0, {"ltp": 12.0, "prev_price": 13.0}),
        }
        with patch("markets_worker.routers.behavioral._ltp_cache", mock_cache):
            resp = client.get("/v1/retail/behavioral/market-stress", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["stress_level"] == "low"


class TestLogBehavioralEvent:
    def test_logs_yellow_alert(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.insert.return_value \
            .execute.return_value = MagicMock(data={"id": "ev1"}, error=None)
        with patch("markets_worker.routers.behavioral.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/v1/retail/behavioral/events",
                headers=auth_headers,
                json={
                    "event_type": "yellow_alert",
                    "severity": "warning",
                    "metadata": {"drawdown_pct": 7.2, "portfolio_id": "p1"},
                },
            )
        assert resp.status_code == 201

    def test_rejects_invalid_event_type(self, client, auth_headers):
        resp = client.post(
            "/v1/retail/behavioral/events",
            headers=auth_headers,
            json={"event_type": "unknown_type", "severity": "info", "metadata": {}},
        )
        assert resp.status_code == 422


class TestAcknowledgeEvent:
    def test_acknowledges_event(self, client, auth_headers):
        mock_sb = MagicMock()
        mock_sb.schema.return_value.from_.return_value.update.return_value \
            .eq.return_value.eq.return_value.execute.return_value = \
            MagicMock(data={"id": "ev1"}, error=None)
        with patch("markets_worker.routers.behavioral.get_supabase", return_value=mock_sb):
            resp = client.patch(
                "/v1/retail/behavioral/events/ev1/acknowledge",
                headers=auth_headers,
            )
        assert resp.status_code == 200
```

### Step 2: Run to confirm failure

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform/services/markets-worker
uv run pytest tests/test_behavioral_router.py -v 2>&1 | tail -15
```

Expected: FAIL — module not found.

### Step 3: Create behavioral.py router

```python
# services/markets-worker/src/markets_worker/routers/behavioral.py
"""
Retail behavioral support — market stress signals and behavioral event logging.

GET  /v1/retail/behavioral/market-stress     — Nifty + VIX stress assessment
POST /v1/retail/behavioral/events            — Log a behavioral event
PATCH /v1/retail/behavioral/events/{id}/acknowledge — Mark event seen
GET  /v1/retail/behavioral/events            — Recent unacknowledged events for user
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from markets_worker.auth import Auth
from markets_worker.db import get_supabase
from markets_worker.routers.ltp import _ltp_cache  # shared LTP cache

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail/behavioral", tags=["retail-behavioral"])

# ── Constants ────────────────────────────────────────────────────────────────

_NIFTY_STRESS_THRESHOLD = -2.0   # % intraday fall triggers medium stress
_VIX_SPIKE_MULTIPLIER  = 1.25    # VIX 25% above its prev close = elevated
_CACHE_STALE_SECONDS   = 60      # Consider LTP stale if older than this

VALID_EVENT_TYPES = {
    "yellow_alert", "orange_alert", "red_alert", "cooling_off",
    "education_shown", "panic_sell_intercepted", "cooling_off_waited",
}

# ── Pydantic models ───────────────────────────────────────────────────────────

class LogEventRequest(BaseModel):
    event_type: str
    severity: Literal["info", "warning", "critical"]
    metadata: dict[str, Any] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_cached_quote(symbol: str, exchange: str) -> dict | None:
    """Return quote dict from LTP cache if fresh, else None."""
    key = f"{symbol}:{exchange}"
    entry = _ltp_cache.get(key)
    if not entry:
        return None
    ts, quote = entry
    if (datetime.now(timezone.utc).timestamp() - ts) > _CACHE_STALE_SECONDS:
        return None
    return quote


def _compute_stress(nifty_quote: dict | None, vix_quote: dict | None) -> dict:
    nifty_change_pct = 0.0
    vix_current = 0.0
    vix_prev = 0.0

    if nifty_quote:
        ltp  = nifty_quote.get("ltp") or nifty_quote.get("close") or 0
        prev = nifty_quote.get("prev_price") or nifty_quote.get("prev_close") or ltp
        if prev:
            nifty_change_pct = ((ltp - prev) / prev) * 100

    if vix_quote:
        vix_current = vix_quote.get("ltp") or vix_quote.get("close") or 0
        vix_prev    = vix_quote.get("prev_price") or vix_quote.get("prev_close") or vix_current

    vix_spiked = vix_prev > 0 and vix_current > vix_prev * _VIX_SPIKE_MULTIPLIER

    if nifty_change_pct <= _NIFTY_STRESS_THRESHOLD or vix_spiked:
        stress_level = "high"
    elif nifty_change_pct <= -1.0 or (vix_current > 20):
        stress_level = "medium"
    else:
        stress_level = "low"

    return {
        "nifty_change_pct": round(nifty_change_pct, 2),
        "vix_current": round(vix_current, 2),
        "vix_prev": round(vix_prev, 2),
        "stress_level": stress_level,
        "nifty_ltp": nifty_quote.get("ltp") if nifty_quote else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/market-stress")
async def get_market_stress(auth: Auth):
    """Return current market stress assessment from cached LTP data."""
    nifty = _get_cached_quote("NIFTY 50", "NSE")
    vix   = _get_cached_quote("INDIA VIX", "NSE")
    return _compute_stress(nifty, vix)


@router.post("/events", status_code=201)
async def log_behavioral_event(body: LogEventRequest, auth: Auth):
    if body.event_type not in VALID_EVENT_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid event_type: {body.event_type}")
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .insert({
                "user_id":    auth.user_id,
                "event_type": body.event_type,
                "severity":   body.severity,
                "metadata":   body.metadata,
            })
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral_event_insert_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Database error")
    return res.data


@router.patch("/events/{event_id}/acknowledge")
async def acknowledge_event(event_id: str, auth: Auth):
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .update({"acknowledged_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", event_id)
            .eq("user_id", auth.user_id)
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral_event_ack_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Database error")
    return res.data


@router.get("/events")
async def get_recent_events(auth: Auth, limit: int = 10):
    sb = get_supabase()
    try:
        res = (
            sb.schema("markets")
            .from_("behavioral_events")
            .select("*")
            .eq("user_id", auth.user_id)
            .is_("acknowledged_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        logger.error("behavioral_events_fetch_failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Database error")
    return res.data or []
```

### Step 4: Register in main.py

Find the `from markets_worker.routers import retail as retail_router` line in `main.py`. Add directly after it:

```python
from markets_worker.routers import behavioral as behavioral_router
```

Inside `create_app()`, after `app.include_router(retail_router.router, ...)`:

```python
app.include_router(behavioral_router.router, tags=["retail-behavioral"])
```

### Step 5: Run tests

```bash
uv run pytest tests/test_behavioral_router.py -v 2>&1 | tail -20
```

Expected: All tests pass. If `_ltp_cache` import fails (circular import), import it lazily inside the endpoint function:

```python
# At top of function instead of module level:
from markets_worker.routers.ltp import _ltp_cache
```

### Step 6: Commit

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
git add services/markets-worker/src/markets_worker/routers/behavioral.py \
        services/markets-worker/src/markets_worker/main.py \
        services/markets-worker/tests/test_behavioral_router.py
git commit -m "feat(retail-p2): behavioral router — market stress, event log, acknowledge"
```

---

## Task 3: Extend Retail Signal Feed to All Asset Classes

**Files:**
- Modify: `services/markets-worker/src/markets_worker/routers/retail.py` line 157
- Modify: `src/features/markets/retail/feed/SignalFilter.tsx`
- Test: `services/markets-worker/tests/test_retail_router.py` (add one test)

This is the smallest task. The signal_generator.py already generates signals for all asset classes — the only blocker is that the retail feed filters to equity + mutual_fund by default.

### Step 1: Write the failing test (add to existing test file)

In `services/markets-worker/tests/test_retail_router.py`, add to `TestRetailSignals`:

```python
def test_accepts_crypto_asset_class(self, client, auth_headers):
    """Crypto signals should be served when explicitly requested."""
    mock_sb = MagicMock()
    chain = mock_sb.schema.return_value.from_.return_value.select.return_value
    chain.gte.return_value.in_.return_value.not_.is_.return_value \
        .gte.return_value.order.return_value \
        .limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "s2", "confidence": 0.65, "asset_class": "crypto"}],
            error=None,
        )
    with patch("markets_worker.routers.retail.get_supabase", return_value=mock_sb):
        resp = client.get(
            "/v1/retail/signals?asset_class=crypto", headers=auth_headers
        )
    assert resp.status_code == 200
```

### Step 2: Run to confirm it already passes (or adjust)

```bash
cd services/markets-worker
uv run pytest tests/test_retail_router.py::TestRetailSignals::test_accepts_crypto_asset_class -v 2>&1 | tail -10
```

This test should already pass since the filter logic `[asset_class] if asset_class else ["equity", "mutual_fund"]` already handles explicit asset_class values. If it passes, great — this test is now documentation of the existing behaviour. If it fails for other reasons, investigate.

### Step 3: Update the default asset class list in retail.py

In `services/markets-worker/src/markets_worker/routers/retail.py`, find line ~157:

```python
asset_classes = [asset_class] if asset_class else ["equity", "mutual_fund"]
```

Change to:

```python
# Phase 2: include all asset classes in the default feed
asset_classes = [asset_class] if asset_class else [
    "equity", "mutual_fund", "crypto", "derivative", "commodity", "fixed_income", "forex",
]
```

### Step 4: Update SignalFilter.tsx to expose all asset classes

Replace the `ASSET_CLASSES` array in `src/features/markets/retail/feed/SignalFilter.tsx`:

```typescript
const ASSET_CLASSES = [
  { value: undefined,        label: 'All' },
  { value: 'equity',         label: 'Stocks' },
  { value: 'mutual_fund',    label: 'MF' },
  { value: 'crypto',         label: 'Crypto' },
  { value: 'derivative',     label: 'F&O' },
  { value: 'commodity',      label: 'Commodity' },
  { value: 'fixed_income',   label: 'Bonds' },
  { value: 'forex',          label: 'Forex' },
];
```

Also add horizon options for intraday:

```typescript
const HORIZONS = [
  { value: undefined,        label: 'All' },
  { value: 'intraday',       label: 'Intraday' },
  { value: 'short_term',     label: 'Swing' },
  { value: 'medium_term',    label: 'Positional' },
  { value: 'long_term',      label: 'Long-term' },
];
```

### Step 5: Run all retail tests + typecheck

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx vitest run src/features/markets/retail/feed/ 2>&1 | tail -10
uv run -C services/markets-worker pytest tests/test_retail_router.py -v 2>&1 | tail -10
```

### Step 6: Commit

```bash
git add services/markets-worker/src/markets_worker/routers/retail.py \
        services/markets-worker/tests/test_retail_router.py \
        src/features/markets/retail/feed/SignalFilter.tsx
git commit -m "feat(retail-p2): expand signal feed to all asset classes — crypto, F&O, commodity, bonds, forex"
```

---

## Task 4: Frontend — Behavioral Types + Query Keys + useMarketStress hook

**Files:**
- Create: `src/features/markets/retail/behavioral/types.ts`
- Modify: `src/features/markets/hooks/queryKeys.ts`
- Create: `src/features/markets/retail/behavioral/useMarketStress.ts`
- Test: `src/features/markets/retail/behavioral/useMarketStress.test.ts`

### Step 1: Write the failing test

```typescript
// src/features/markets/retail/behavioral/useMarketStress.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/utils';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: { access_token: 'tok' }, roles: [] }),
}));

const mockStress = {
  nifty_change_pct: -2.3,
  vix_current: 21.5,
  vix_prev: 14.0,
  stress_level: 'high',
  nifty_ltp: 21800,
};

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => mockStress,
}) as any;

describe('useMarketStress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches market stress and derives isHighStress', async () => {
    const { useMarketStress } = await import('./useMarketStress');
    const { result } = renderHook(() => useMarketStress(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.stress_level).toBe('high');
    expect(result.current.isHighStress).toBe(true);
    expect(result.current.isMediumStress).toBe(false);
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/behavioral/useMarketStress.test.ts 2>&1 | tail -10
```

### Step 3: Create types.ts

```typescript
// src/features/markets/retail/behavioral/types.ts

export type StressLevel = 'low' | 'medium' | 'high';

export interface MarketStress {
  nifty_change_pct: number;
  vix_current: number;
  vix_prev: number;
  stress_level: StressLevel;
  nifty_ltp: number | null;
}

export type AlertTier = 'yellow' | 'orange' | 'red' | null;

export interface DrawdownState {
  currentNav: number;
  peakNav: number;
  drawdownPct: number;
  alertTier: AlertTier;
}

export type BehavioralEventType =
  | 'yellow_alert'
  | 'orange_alert'
  | 'red_alert'
  | 'cooling_off'
  | 'education_shown'
  | 'panic_sell_intercepted'
  | 'cooling_off_waited';

export interface BehavioralEvent {
  id: string;
  user_id: string;
  event_type: BehavioralEventType;
  severity: 'info' | 'warning' | 'critical';
  metadata: Record<string, unknown>;
  acknowledged_at: string | null;
  created_at: string;
}

export type EducationId =
  | 'low_liquidity'
  | 'mf_comparison'
  | 'first_stop_loss'
  | 'fo_enable'
  | 'concentration_warning'
  | 'first_intraday'
  | 'high_conviction_signal'
  | 'high_vix_execution'
  | 'first_sip'
  | 'green_day_check'
  | 'enable_autonomous'
  | 'approaching_trade_limit';

export interface EducationContent {
  id: EducationId;
  title: string;
  beginner: string;
  casual: string;
  self_directed?: string;
}
```

### Step 4: Add behavioral query keys

In `src/features/markets/hooks/queryKeys.ts`, inside the `retail` object, add:

```typescript
behavioral: {
  stress:  () => [...marketsKeys.all, 'retail', 'behavioral', 'stress'] as const,
  events:  () => [...marketsKeys.all, 'retail', 'behavioral', 'events'] as const,
},
```

### Step 5: Create useMarketStress.ts

```typescript
// src/features/markets/retail/behavioral/useMarketStress.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { MarketStress } from './types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

export function useMarketStress() {
  const { session } = useAuth();

  const query = useQuery({
    queryKey: marketsKeys.retail.behavioral.stress(),
    enabled: Boolean(session?.access_token),
    staleTime: 60_000,          // stress data valid for 1 minute
    refetchInterval: 2 * 60_000, // poll every 2 minutes
    queryFn: async (): Promise<MarketStress> => {
      const resp = await fetch(`${WORKER_URL}/v1/retail/behavioral/market-stress`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!resp.ok) throw new Error(`market-stress: ${resp.status}`);
      return resp.json();
    },
  });

  return {
    ...query,
    isHighStress:   query.data?.stress_level === 'high',
    isMediumStress: query.data?.stress_level === 'medium',
  };
}
```

### Step 6: Run test to confirm pass

```bash
npx vitest run src/features/markets/retail/behavioral/useMarketStress.test.ts 2>&1 | tail -10
```

### Step 7: Commit

```bash
git add src/features/markets/retail/behavioral/types.ts \
        src/features/markets/retail/behavioral/useMarketStress.ts \
        src/features/markets/retail/behavioral/useMarketStress.test.ts \
        src/features/markets/hooks/queryKeys.ts
git commit -m "feat(retail-p2): behavioral types, market stress hook, query keys"
```

---

## Task 5: Frontend — useDrawdownAlerts + useBehavioralEvents hooks

**Files:**
- Create: `src/features/markets/retail/behavioral/useDrawdownAlerts.ts`
- Create: `src/features/markets/retail/behavioral/useBehavioralEvents.ts`
- Test: `src/features/markets/retail/behavioral/useDrawdownAlerts.test.ts`

### Step 1: Write the failing test

```typescript
// src/features/markets/retail/behavioral/useDrawdownAlerts.test.ts
import { describe, it, expect } from 'vitest';
import { computeDrawdownState } from './useDrawdownAlerts';

describe('computeDrawdownState', () => {
  it('returns null tier when drawdown < 5%', () => {
    const state = computeDrawdownState(97_000, 100_000);
    expect(state.drawdownPct).toBeCloseTo(3, 0);
    expect(state.alertTier).toBeNull();
  });

  it('returns yellow tier at 7% drawdown', () => {
    const state = computeDrawdownState(93_000, 100_000);
    expect(state.alertTier).toBe('yellow');
  });

  it('returns orange tier at 15% drawdown', () => {
    const state = computeDrawdownState(85_000, 100_000);
    expect(state.alertTier).toBe('orange');
  });

  it('returns red tier at 22% drawdown', () => {
    const state = computeDrawdownState(78_000, 100_000);
    expect(state.alertTier).toBe('red');
  });

  it('returns null tier when peakNav is 0', () => {
    const state = computeDrawdownState(0, 0);
    expect(state.alertTier).toBeNull();
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/behavioral/useDrawdownAlerts.test.ts 2>&1 | tail -10
```

### Step 3: Create useDrawdownAlerts.ts

```typescript
// src/features/markets/retail/behavioral/useDrawdownAlerts.ts
import { useMemo } from 'react';
import type { DrawdownState, AlertTier } from './types';
import type { PnLData } from '../../hooks/usePortfolioPnL';

export function computeDrawdownState(currentNav: number, peakNav: number): DrawdownState {
  if (peakNav <= 0) {
    return { currentNav, peakNav, drawdownPct: 0, alertTier: null };
  }
  const drawdownPct = ((peakNav - currentNav) / peakNav) * 100;
  let alertTier: AlertTier = null;
  if (drawdownPct >= 20) alertTier = 'red';
  else if (drawdownPct >= 10) alertTier = 'orange';
  else if (drawdownPct >= 5) alertTier = 'yellow';
  return { currentNav, peakNav, drawdownPct, alertTier };
}

/** Derives peak NAV from the P&L series and computes drawdown state. */
export function useDrawdownState(pnlData: PnLData | undefined): DrawdownState {
  return useMemo(() => {
    const series = pnlData?.series ?? [];
    const currentNav = pnlData?.summary.current_nav ?? 0;
    const peakNav = series.length > 0 ? Math.max(...series.map((p) => p.nav)) : currentNav;
    return computeDrawdownState(currentNav, peakNav);
  }, [pnlData]);
}
```

### Step 4: Create useBehavioralEvents.ts

```typescript
// src/features/markets/retail/behavioral/useBehavioralEvents.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { BehavioralEvent, BehavioralEventType } from './types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

export function useBehavioralEvents() {
  const { session } = useAuth();

  return useQuery({
    queryKey: marketsKeys.retail.behavioral.events(),
    enabled: Boolean(session?.access_token),
    staleTime: 30_000,
    queryFn: async (): Promise<BehavioralEvent[]> => {
      const resp = await fetch(`${WORKER_URL}/v1/retail/behavioral/events`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!resp.ok) throw new Error(`behavioral-events: ${resp.status}`);
      return resp.json();
    },
  });
}

export function useLogBehavioralEvent() {
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      event_type: BehavioralEventType;
      severity: 'info' | 'warning' | 'critical';
      metadata?: Record<string, unknown>;
    }) => {
      const resp = await fetch(`${WORKER_URL}/v1/retail/behavioral/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`log-event: ${resp.status}`);
      return resp.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.behavioral.events() }),
  });
}

export function useAcknowledgeBehavioralEvent() {
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const resp = await fetch(
        `${WORKER_URL}/v1/retail/behavioral/events/${eventId}/acknowledge`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${session!.access_token}` },
        },
      );
      if (!resp.ok) throw new Error(`ack-event: ${resp.status}`);
      return resp.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.behavioral.events() }),
  });
}
```

### Step 5: Run test to confirm pass

```bash
npx vitest run src/features/markets/retail/behavioral/useDrawdownAlerts.test.ts 2>&1 | tail -10
```

### Step 6: Commit

```bash
git add src/features/markets/retail/behavioral/useDrawdownAlerts.ts \
        src/features/markets/retail/behavioral/useDrawdownAlerts.test.ts \
        src/features/markets/retail/behavioral/useBehavioralEvents.ts
git commit -m "feat(retail-p2): drawdown alert computation + behavioral events CRUD hooks"
```

---

## Task 6: Frontend — BehavioralAlertBanner (Yellow + Orange tiers)

**Files:**
- Create: `src/features/markets/retail/behavioral/BehavioralAlertBanner.tsx`
- Test: `src/features/markets/retail/behavioral/BehavioralAlertBanner.test.tsx`

The Yellow and Orange alerts are non-blocking banners. They inform and slow down — they never prevent selling.

### Step 1: Write the failing test

```tsx
// src/features/markets/retail/behavioral/BehavioralAlertBanner.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockLog = vi.fn().mockResolvedValue({});
vi.mock('./useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockLog, isPending: false }),
}));

describe('BehavioralAlertBanner', () => {
  it('renders nothing when alertTier is null', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    const { container } = render(
      <BehavioralAlertBanner alertTier={null} drawdownPct={2} portfolioId="p1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows yellow banner with drawdown info', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    render(
      <BehavioralAlertBanner alertTier="yellow" drawdownPct={7.2} portfolioId="p1" />,
    );
    expect(screen.getByText(/7\.2%|7%/)).toBeInTheDocument();
    expect(screen.getByText(/normal/i)).toBeInTheDocument();
  });

  it('shows orange banner with recovery context', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={14} portfolioId="p1" />,
    );
    expect(screen.getByText(/14%|14/)).toBeInTheDocument();
    expect(screen.getByText(/recover/i)).toBeInTheDocument();
  });

  it('dismiss button calls log event', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    render(
      <BehavioralAlertBanner alertTier="yellow" drawdownPct={7} portfolioId="p1" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss|understood|ok/i }));
    expect(mockLog).toHaveBeenCalled();
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/behavioral/BehavioralAlertBanner.test.tsx 2>&1 | tail -10
```

### Step 3: Create BehavioralAlertBanner.tsx

```tsx
// src/features/markets/retail/behavioral/BehavioralAlertBanner.tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { useLogBehavioralEvent } from './useBehavioralEvents';
import type { AlertTier } from './types';

interface BehavioralAlertBannerProps {
  alertTier: AlertTier;
  drawdownPct: number;
  portfolioId: string;
}

const YELLOW_CONTENT = (pct: number) => ({
  title: 'Markets are moving today',
  message: `Your portfolio is down ${pct.toFixed(1)}% from its recent high. This is normal for a long-term portfolio. No action needed.`,
  action: 'Understood',
  variant: 'default' as const,
  eventType: 'yellow_alert' as const,
  severity: 'info' as const,
});

const ORANGE_CONTENT = (pct: number) => ({
  title: 'Portfolio down from peak',
  message: `Your portfolio is down ${pct.toFixed(1)}% from its peak. In the last 20 years, Indian equity portfolios recovered from similar drawdowns within 14 months on average. Selling now locks in this loss permanently.`,
  action: 'I understand, keep holding',
  variant: 'destructive' as const,
  eventType: 'orange_alert' as const,
  severity: 'warning' as const,
});

export function BehavioralAlertBanner({
  alertTier,
  drawdownPct,
  portfolioId,
}: BehavioralAlertBannerProps) {
  const { mutate: logEvent } = useLogBehavioralEvent();

  if (!alertTier || alertTier === 'red') return null;

  const content = alertTier === 'yellow'
    ? YELLOW_CONTENT(drawdownPct)
    : ORANGE_CONTENT(drawdownPct);

  const handleDismiss = () => {
    logEvent({
      event_type: content.eventType,
      severity: content.severity,
      metadata: { drawdown_pct: drawdownPct, portfolio_id: portfolioId, action: 'dismissed' },
    });
  };

  return (
    <Alert variant={content.variant} className="mb-4">
      <div className="flex items-start gap-2">
        {alertTier === 'orange'
          ? <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" />
          : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        }
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{content.title}</p>
          <AlertDescription className="text-xs leading-relaxed">
            {content.message}
          </AlertDescription>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs mt-1"
            onClick={handleDismiss}
          >
            {content.action}
          </Button>
        </div>
      </div>
    </Alert>
  );
}
```

> **Note:** If `Alert`/`AlertDescription` don't exist in `src/components/ui/`, check with `ls src/components/ui/alert.tsx`. If missing, use a plain styled `div` instead:
> ```tsx
> <div className={`rounded-lg border p-4 mb-4 ${alertTier === 'orange' ? 'border-orange-300 bg-orange-50 dark:bg-orange-950' : 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950'}`}>
> ```

### Step 4: Run tests to confirm pass

```bash
npx vitest run src/features/markets/retail/behavioral/BehavioralAlertBanner.test.tsx 2>&1 | tail -10
```

### Step 5: Commit

```bash
git add src/features/markets/retail/behavioral/BehavioralAlertBanner.tsx \
        src/features/markets/retail/behavioral/BehavioralAlertBanner.test.tsx
git commit -m "feat(retail-p2): BehavioralAlertBanner — yellow and orange drawdown alerts"
```

---

## Task 7: Frontend — CoolingOffScreen (Red alert)

**Files:**
- Create: `src/features/markets/retail/behavioral/CoolingOffScreen.tsx`
- Test: `src/features/markets/retail/behavioral/CoolingOffScreen.test.tsx`

The Red alert is a mandatory cooling-off screen shown before the user can sell the entire Core Portfolio during a downturn. It NEVER blocks — the user can always proceed.

### Step 1: Write the failing test

```tsx
// src/features/markets/retail/behavioral/CoolingOffScreen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockLog = vi.fn().mockResolvedValue({});
vi.mock('./useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockLog }),
}));

describe('CoolingOffScreen', () => {
  it('shows the mandatory warning and all three options', async () => {
    const { CoolingOffScreen } = await import('./CoolingOffScreen');
    render(
      <CoolingOffScreen
        open={true}
        onClose={vi.fn()}
        onProceed={vi.fn()}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    expect(screen.getByText(/proceed anyway/i)).toBeInTheDocument();
    expect(screen.getByText(/wait 24 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/23%|23/)).toBeInTheDocument();
  });

  it('"Proceed anyway" calls onProceed and logs event', async () => {
    const onProceed = vi.fn();
    const { CoolingOffScreen } = await import('./CoolingOffScreen');
    render(
      <CoolingOffScreen
        open={true}
        onClose={vi.fn()}
        onProceed={onProceed}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /proceed anyway/i }));
    expect(onProceed).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'panic_sell_intercepted' }),
    );
  });

  it('"Wait 24 hours" calls onClose and logs cooling_off_waited', async () => {
    const onClose = vi.fn();
    const { CoolingOffScreen } = await import('./CoolingOffScreen');
    render(
      <CoolingOffScreen
        open={true}
        onClose={onClose}
        onProceed={vi.fn()}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /wait 24 hours/i }));
    expect(onClose).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'cooling_off_waited' }),
    );
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/behavioral/CoolingOffScreen.test.tsx 2>&1 | tail -10
```

### Step 3: Create CoolingOffScreen.tsx

```tsx
// src/features/markets/retail/behavioral/CoolingOffScreen.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLogBehavioralEvent } from './useBehavioralEvents';

interface CoolingOffScreenProps {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
  drawdownPct: number;
  portfolioId: string;
}

export function CoolingOffScreen({
  open,
  onClose,
  onProceed,
  drawdownPct,
  portfolioId,
}: CoolingOffScreenProps) {
  const { mutate: logEvent } = useLogBehavioralEvent();

  const handleProceed = () => {
    logEvent({
      event_type: 'panic_sell_intercepted',
      severity: 'critical',
      metadata: { drawdown_pct: drawdownPct, portfolio_id: portfolioId, action: 'proceeded' },
    });
    onProceed();
  };

  const handleWait = () => {
    logEvent({
      event_type: 'cooling_off_waited',
      severity: 'warning',
      metadata: { drawdown_pct: drawdownPct, portfolio_id: portfolioId, action: 'waited' },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            Selling during a {drawdownPct.toFixed(0)}% drawdown
          </DialogTitle>
          <DialogDescription className="text-sm space-y-3 pt-2 text-left">
            <p>
              You're about to sell during a significant market decline. Consider:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li>
                Investors who sold during COVID (Mar 2020) missed a 100% recovery in 18 months
              </li>
              <li>
                Selling now locks in this {drawdownPct.toFixed(0)}% loss permanently
              </li>
              <li>
                Your long-term goals may need more time to recover if you exit now
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              You can always choose to proceed — this screen is informational only.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button variant="outline" onClick={handleWait} className="w-full">
            Wait 24 hours
          </Button>
          <Button
            variant="destructive"
            onClick={handleProceed}
            className="w-full"
          >
            Proceed anyway
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 4: Run tests

```bash
npx vitest run src/features/markets/retail/behavioral/CoolingOffScreen.test.tsx 2>&1 | tail -10
```

### Step 5: Commit

```bash
git add src/features/markets/retail/behavioral/CoolingOffScreen.tsx \
        src/features/markets/retail/behavioral/CoolingOffScreen.test.tsx
git commit -m "feat(retail-p2): CoolingOffScreen — red alert cooling-off before panic sell"
```

---

## Task 8: Frontend — InlineEducation component (8 key trigger moments)

**Files:**
- Create: `src/features/markets/retail/behavioral/educationContent.ts`
- Create: `src/features/markets/retail/behavioral/InlineEducation.tsx`
- Create: `src/features/markets/retail/behavioral/useInlineEducation.ts`
- Test: `src/features/markets/retail/behavioral/InlineEducation.test.tsx`

Phase 2 implements 8 of the 12 trigger moments (the ones not requiring live trade data):
- `high_conviction_signal` — shown when viewing a High Conviction signal
- `first_sip` — shown during first SIP setup
- `first_stop_loss` — shown when setting first stop-loss
- `concentration_warning` — shown when any single stock > 40% of portfolio
- `first_intraday` — shown on first intraday signal view
- `high_vix_execution` — shown when market stress is high and user taps execute
- `mf_comparison` — shown when user views two MF signals side by side
- `fo_enable` — shown when user first taps an F&O signal

Education cards are shown max once per `education_id` per user (tracked via `behavioral_events`).

### Step 1: Write the failing test

```tsx
// src/features/markets/retail/behavioral/InlineEducation.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

describe('InlineEducation', () => {
  it('renders nothing when educationId is null', async () => {
    const { InlineEducation } = await import('./InlineEducation');
    const { container } = render(
      <InlineEducation educationId={null} experienceLevel="beginner" onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows appropriate content for high_conviction_signal', async () => {
    const { InlineEducation } = await import('./InlineEducation');
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="beginner"
        onDismiss={vi.fn()}
      />,
    );
    // Should show some educational text about signal accuracy
    expect(screen.getByText(/signal|accuracy|wrong/i)).toBeInTheDocument();
  });

  it('dismiss button calls onDismiss', async () => {
    const onDismiss = vi.fn();
    const { InlineEducation } = await import('./InlineEducation');
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="beginner"
        onDismiss={onDismiss}
      />,
    );
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onDismiss).toHaveBeenCalledWith('high_conviction_signal');
  });

  it('shows self_directed content when available', async () => {
    const { InlineEducation } = await import('./InlineEducation');
    render(
      <InlineEducation
        educationId="high_conviction_signal"
        experienceLevel="self_directed"
        onDismiss={vi.fn()}
      />,
    );
    // Self-directed gets more detail (Sharpe, CI, sample size)
    expect(screen.getByText(/32%|68%|historical/i)).toBeInTheDocument();
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/behavioral/InlineEducation.test.tsx 2>&1 | tail -10
```

### Step 3: Create educationContent.ts

```typescript
// src/features/markets/retail/behavioral/educationContent.ts
import type { EducationContent, EducationId } from './types';

export const EDUCATION_CONTENT: Record<EducationId, EducationContent> = {
  high_conviction_signal: {
    id: 'high_conviction_signal',
    title: 'About this signal',
    beginner: 'This signal has been right more often than most — but signals are never guaranteed. Only invest what you can afford to lose.',
    casual: 'High Conviction signals have historically been right ~68% of the time. That means 32% of the time they were wrong. Past performance doesn't guarantee future results.',
    self_directed: 'Historical accuracy ~68% over 847 signals (2 years), 32% failure rate. Confidence interval: 65–71%. Always validate with your own analysis. Position-size accordingly.',
  },
  first_stop_loss: {
    id: 'first_stop_loss',
    title: 'What is a stop-loss?',
    beginner: 'A stop-loss automatically sells if the price falls to your level. It limits losses — but won't protect against very fast overnight drops.',
    casual: 'Stop-losses are exchange-side orders (GTT) — they survive if your app is offline. However, if news hits overnight and the stock gaps down, your sell may execute well below your stop price.',
    self_directed: 'GTT stops are exchange-side, not client-side watchers. Gap risk: if price opens below stop (e.g., circuit-limit), fill occurs at open price. For high-risk names consider a hard floor stop below the GTT.',
  },
  fo_enable: {
    id: 'fo_enable',
    title: 'F&O carries higher risk',
    beginner: 'Options and futures can lose value quickly — even to zero. They are complex instruments best suited for experienced investors.',
    casual: 'F&O signals involve leverage. Your maximum loss on options is the premium paid. Futures carry unlimited loss risk. Time decay (theta) erodes option value daily.',
    self_directed: 'Check IV rank before entry. High IV → consider selling premium. Low IV → consider buying. PCR and max pain are sentiment indicators, not price predictors. Manage expiry risk explicitly.',
  },
  concentration_warning: {
    id: 'concentration_warning',
    title: 'Concentration risk',
    beginner: 'Your portfolio has a lot in one stock. If that company has problems, it could significantly hurt your returns.',
    casual: 'Diversified portfolios typically keep no single stock above 10%. High concentration in one name means company-specific risk (management, sector, regulatory) dominates your portfolio returns.',
    self_directed: 'Single-stock concentration > 40% implies idiosyncratic risk exceeds systematic risk in your portfolio. Consider reducing to < 15% per name for standard risk management. Factor in correlation with other holdings.',
  },
  first_intraday: {
    id: 'first_intraday',
    title: 'Intraday means sell today',
    beginner: 'Intraday trades must be closed before 3:30 PM today. If you forget, your broker will auto-close at market price — which may not be favourable.',
    casual: 'Intraday positions are auto-squared off by your broker between 3:15–3:30 PM at whatever price the market is at. Set a reminder. Slippage on forced squareoffs can be significant.',
    self_directed: 'Brokers typically squareoff at ~3:20 PM via market orders. On volatile days, impact cost on squareoff can be 0.3–1.5%. Factor this into your intraday P&L calculation. Use time-based exit rules.',
  },
  high_vix_execution: {
    id: 'high_vix_execution',
    title: 'High volatility right now',
    beginner: 'Markets are moving fast today. Your order might fill at a very different price than shown. Consider waiting for calmer conditions.',
    casual: 'India VIX is elevated — bid-ask spreads are wider and prices are moving quickly. Use limit orders instead of market orders to control your fill price.',
    self_directed: 'Elevated VIX typically correlates with wider spreads and higher slippage. Consider reducing position size by 20–30% to maintain consistent risk in vol-adjusted terms. Avoid market orders.',
  },
  mf_comparison: {
    id: 'mf_comparison',
    title: 'Expense ratio compounds',
    beginner: 'Even small differences in fees add up over time. A fund that costs less often beats one that costs more — even if returns look similar today.',
    casual: 'A 1.3% difference in expense ratio on ₹1 lakh over 20 years at 12% CAGR costs ~₹47,000 in foregone returns. Direct plans of the same fund typically save 0.5–1.5% annually versus regular plans.',
    self_directed: 'Expense ratio drag: compounded over N years, the cost multiplier is (1/(1+ER))^N vs (1/(1+ER_low))^N. For a 20-year horizon, 1.5% vs 0.3% ER is a ~29% total return differential on principal.',
  },
  first_sip: {
    id: 'first_sip',
    title: 'How SIP works',
    beginner: 'A SIP invests the same amount every month, no matter what markets are doing. When prices fall, you buy more units — this helps smooth out ups and downs over time.',
    casual: 'SIP uses rupee cost averaging: fixed amount ÷ NAV = units purchased. In bear markets you accumulate more units at lower NAV. The benefit is psychological discipline as much as mathematical.',
    self_directed: 'Rupee cost averaging outperforms lump sum in sideways/bearish markets and slightly underperforms in persistent bull markets. For long-duration goals (> 7 years), SIP XIRR typically converges to CAGR of the underlying fund.',
  },
  approaching_trade_limit: {
    id: 'approaching_trade_limit',
    title: 'Tax classification warning',
    beginner: 'Trading very frequently might mean your gains are taxed differently — and more heavily. Consider slowing down.',
    casual: 'More than 20–30 trades/month may lead the tax department to classify gains as business income (taxed at up to 30%) rather than capital gains (STCG 20%, LTCG 12.5%).',
    self_directed: 'IT Dept classifies frequent equity trading (intent to profit from price movements) as business income. No fixed threshold — intent, frequency, and volume are assessed together. Keep detailed records.',
  },
  green_day_check: {
    id: 'green_day_check',
    title: 'Stay the course',
    beginner: 'Great day! Long-term investors who stay invested through ups and downs tend to do better than those who try to time the market.',
    casual: 'Single-day gains feel great but rarely predict tomorrow. Studies show that missing the 10 best days in a 20-year period can halve your total returns. Staying invested matters more than timing.',
    self_directed: 'J.P. Morgan Asset Management data: missing the 10 best days in 20 years (S&P) cuts returns from ~9.5% to ~5% CAGR. Indian equity data shows similar patterns. Resist recency bias after green days.',
  },
  enable_autonomous: {
    id: 'enable_autonomous',
    title: 'Before enabling automation',
    beginner: 'Automation means the system can place trades for you. Make sure you understand your stop-loss levels and have tested it in paper trading first.',
    casual: 'Autonomous execution runs pre-defined rules — no AI guesses. The kill switch (in Settings → Risk Controls) stops everything immediately if something goes wrong. Test it before going live.',
    self_directed: 'Mandatory paper trading phase: 30 days minimum before Micro-Live. All autonomous orders are tagged with Algo-ID (SEBI requirement). Tax: > 20–30 trades/month risks business income classification.',
  },
  low_liquidity: {
    id: 'low_liquidity',
    title: 'Low liquidity warning',
    beginner: 'This stock doesn't trade much. It may be hard to buy or sell at the price shown.',
    casual: 'Low daily volume means your order could move the price against you (market impact). Spread between buy/sell price may be wide. Consider whether you can exit when needed.',
    self_directed: 'Your order is a significant % of daily volume — expect meaningful market impact cost. Liquidity risk: exit may require multiple days or significant price concession. Use limit orders and break into smaller tranches.',
  },
};
```

### Step 4: Create InlineEducation.tsx

```tsx
// src/features/markets/retail/behavioral/InlineEducation.tsx
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EDUCATION_CONTENT } from './educationContent';
import type { EducationId } from './types';
import type { ExperienceLevel } from '../types';

interface InlineEducationProps {
  educationId: EducationId | null;
  experienceLevel: ExperienceLevel;
  onDismiss: (id: EducationId) => void;
  className?: string;
}

export function InlineEducation({
  educationId,
  experienceLevel,
  onDismiss,
  className,
}: InlineEducationProps) {
  if (!educationId) return null;

  const content = EDUCATION_CONTENT[educationId];
  if (!content) return null;

  const text =
    experienceLevel === 'self_directed' && content.self_directed
      ? content.self_directed
      : experienceLevel === 'casual'
      ? content.casual
      : content.beginner;

  return (
    <div
      className={`rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
            {content.title}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{text}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 text-blue-600 dark:text-blue-400 shrink-0"
          onClick={() => onDismiss(educationId)}
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
```

### Step 5: Create useInlineEducation.ts

```typescript
// src/features/markets/retail/behavioral/useInlineEducation.ts
import { useCallback } from 'react';
import { useLogBehavioralEvent } from './useBehavioralEvents';
import type { EducationId } from './types';

/**
 * Hook for tracking which education cards have been shown.
 * Each education_id is shown max once per user (tracked in behavioral_events).
 * 
 * Usage: const { markShown, hasBeenShown } = useInlineEducation(seenIds)
 * where seenIds = set of education_ids from behavioral_events with event_type='education_shown'
 */
export function useInlineEducation(seenEducationIds: Set<string>) {
  const { mutate: logEvent } = useLogBehavioralEvent();

  const markShown = useCallback(
    (educationId: EducationId) => {
      if (seenEducationIds.has(educationId)) return;
      logEvent({
        event_type: 'education_shown',
        severity: 'info',
        metadata: { education_id: educationId },
      });
    },
    [seenEducationIds, logEvent],
  );

  const hasBeenShown = useCallback(
    (educationId: EducationId) => seenEducationIds.has(educationId),
    [seenEducationIds],
  );

  return { markShown, hasBeenShown };
}

/** Derives the set of seen education IDs from the behavioral events list. */
export function getSeenEducationIds(
  events: Array<{ event_type: string; metadata: Record<string, unknown> }>,
): Set<string> {
  return new Set(
    events
      .filter((e) => e.event_type === 'education_shown' && e.metadata?.education_id)
      .map((e) => e.metadata.education_id as string),
  );
}
```

### Step 6: Run tests to confirm pass

```bash
npx vitest run src/features/markets/retail/behavioral/InlineEducation.test.tsx 2>&1 | tail -10
```

### Step 7: Commit

```bash
git add src/features/markets/retail/behavioral/educationContent.ts \
        src/features/markets/retail/behavioral/InlineEducation.tsx \
        src/features/markets/retail/behavioral/InlineEducation.test.tsx \
        src/features/markets/retail/behavioral/useInlineEducation.ts
git commit -m "feat(retail-p2): InlineEducation — 12-trigger education content + dismiss tracking"
```

---

## Task 9: Wire Behavioral Layer into RetailMode + SignalCard

**Files:**
- Modify: `src/features/markets/retail/RetailMode.tsx`
- Modify: `src/features/markets/retail/feed/SignalCard.tsx`
- Modify: `src/features/markets/retail/dashboard/PortfolioTierView.tsx`

This task wires all the behavioral components into the existing UI. No new test file — existing tests must still pass.

### Step 1: Update RetailMode.tsx

`RetailMode` now:
1. Fetches market stress via `useMarketStress`
2. Fetches behavioral events to get seen education IDs
3. Shows `BehavioralAlertBanner` above the signal feed when Core tier has yellow/orange drawdown
4. Makes stress available via context prop to child components

```tsx
// Full updated RetailMode.tsx
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { OnboardingWizard } from './onboarding/OnboardingWizard';
import { RetailDashboard } from './dashboard/RetailDashboard';
import { RetailSignalFeed } from './feed/RetailSignalFeed';
import { ExecutionBottomSheet } from './feed/ExecutionBottomSheet';
import { BehavioralAlertBanner } from './behavioral/BehavioralAlertBanner';
import { useRiskProfile } from './hooks/useRiskProfile';
import { usePortfolioTiers } from './hooks/usePortfolioTiers';
import { usePortfolioPnL } from '../hooks/usePortfolioPnL';
import { useMarketStress } from './behavioral/useMarketStress';
import { useBehavioralEvents, useLogBehavioralEvent } from './behavioral/useBehavioralEvents';
import { useDrawdownState } from './behavioral/useDrawdownAlerts';
import { getSeenEducationIds } from './behavioral/useInlineEducation';
import { marketsKeys } from '../hooks/queryKeys';
import type { RetailSignal } from './types';

export function RetailMode() {
  const { data: profile, isLoading, hasOnboarded } = useRiskProfile();
  const [executing, setExecuting] = useState<RetailSignal | null>(null);
  const qc = useQueryClient();

  // Fetch behavioral context (market stress + seen education IDs)
  const { data: behavioralEvents = [] } = useBehavioralEvents();
  const { isHighStress } = useMarketStress();
  const seenEducationIds = useMemo(() => getSeenEducationIds(behavioralEvents), [behavioralEvents]);

  // Core portfolio (Tier 2) drawdown for behavioral alerts
  const { data: tiers = [] } = usePortfolioTiers();
  const coreTier = tiers.find((t) => t.tier_number === 2);
  const corePnL = usePortfolioPnL(coreTier?.portfolio_id ?? undefined, 365);
  const coreDrawdown = useDrawdownState(corePnL.data);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading your investment profile…
      </div>
    );
  }

  if (!hasOnboarded) {
    return (
      <OnboardingWizard
        onComplete={() => qc.invalidateQueries({ queryKey: marketsKeys.retail.profile() })}
      />
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <RetailDashboard profile={profile} />

      {/* Behavioral alert for Core Portfolio drawdown */}
      {coreTier && (
        <BehavioralAlertBanner
          alertTier={coreDrawdown.alertTier}
          drawdownPct={coreDrawdown.drawdownPct}
          portfolioId={coreTier.portfolio_id ?? ''}
        />
      )}

      <hr className="border-border" />

      <RetailSignalFeed
        experienceLevel={profile.experience_level}
        isHighStress={isHighStress}
        seenEducationIds={seenEducationIds}
        onExecute={(signal) => setExecuting(signal)}
      />

      <ExecutionBottomSheet
        signal={executing}
        open={Boolean(executing)}
        onOpenChange={(open) => { if (!open) setExecuting(null); }}
      />
    </div>
  );
}
```

### Step 2: Update RetailSignalFeed.tsx to accept isHighStress + seenEducationIds

Add props to `RetailSignalFeedProps`:

```typescript
interface RetailSignalFeedProps {
  experienceLevel: ExperienceLevel;
  onExecute?: (signal: RetailSignal) => void;
  isHighStress?: boolean;
  seenEducationIds?: Set<string>;
}
```

And pass them through to `SignalCard`:

```tsx
{signals.map((s) => (
  <SignalCard
    key={s.id}
    signal={s}
    experienceLevel={experienceLevel}
    onExecute={onExecute}
    isHighStress={isHighStress}
    seenEducationIds={seenEducationIds}
  />
))}
```

### Step 3: Update SignalCard.tsx to show inline education

Add these props to `SignalCardProps`:

```typescript
interface SignalCardProps {
  signal: RetailSignal;
  experienceLevel: ExperienceLevel;
  onExecute?: (signal: RetailSignal) => void;
  isHighStress?: boolean;
  seenEducationIds?: Set<string>;
}
```

Add education trigger logic inside the card, after the explanation `<p>`:

```tsx
import { InlineEducation } from '../behavioral/InlineEducation';
import { useLogBehavioralEvent } from '../behavioral/useBehavioralEvents';
import type { EducationId } from '../behavioral/types';

// Inside the SignalCard component:
const { mutate: logEvent } = useLogBehavioralEvent();

// Determine which education to show (one at a time)
const educationToShow: EducationId | null = (() => {
  if (!seenEducationIds) return null;
  if (confidence >= 0.85 && !seenEducationIds.has('high_conviction_signal'))
    return 'high_conviction_signal';
  if (isHighStress && !seenEducationIds.has('high_vix_execution'))
    return 'high_vix_execution';
  const horizon = signal.horizon;
  if (horizon === 'intraday' && !seenEducationIds.has('first_intraday'))
    return 'first_intraday';
  if (signal.asset_class === 'derivative' && !seenEducationIds.has('fo_enable'))
    return 'fo_enable';
  return null;
})();

const handleEducationDismiss = (id: EducationId) => {
  logEvent({
    event_type: 'education_shown',
    severity: 'info',
    metadata: { education_id: id },
  });
};

// Add inside the JSX, after the explanation paragraph:
{educationToShow && (
  <InlineEducation
    educationId={educationToShow}
    experienceLevel={experienceLevel}
    onDismiss={handleEducationDismiss}
    className="mt-2"
  />
)}
```

### Step 4: Run all retail tests to confirm nothing broken

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx vitest run src/features/markets/retail/ 2>&1 | tail -15
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
```

Fix any type errors (common: `seenEducationIds` prop might need `?` in intermediate components).

### Step 5: Commit

```bash
git add src/features/markets/retail/RetailMode.tsx \
        src/features/markets/retail/feed/RetailSignalFeed.tsx \
        src/features/markets/retail/feed/SignalCard.tsx \
        src/features/markets/retail/dashboard/PortfolioTierView.tsx
git commit -m "feat(retail-p2): wire behavioral alerts + inline education into RetailMode and SignalCard"
```

---

## Task 10: Final Verification

### Step 1: Run full backend test suite

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform/services/markets-worker
uv run pytest tests/ -v 2>&1 | tail -20
```

Expected: All tests pass (Phase 1: 9 tests + Phase 2: ~6 new tests = ~15 total).

### Step 2: Run full frontend retail test suite

```bash
cd /Users/vims/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx vitest run src/features/markets/retail/ 2>&1 | tail -15
```

Expected: All tests pass (Phase 1: 21 + Phase 2: ~12 new = ~33 total).

### Step 3: TypeScript clean

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
```

Expected: No output (zero errors).

### Step 4: Check signal feed includes new asset classes

```bash
curl -s "http://localhost:8001/v1/retail/signals?asset_class=crypto&limit=1" \
  -H "Authorization: Bearer $TEST_TOKEN" | python3 -m json.tool 2>/dev/null | head -10
```

(Only if markets-worker is running locally.)

### Step 5: Commit if any final cleanup needed

```bash
git add -p   # stage only actual source changes, not pycache
git commit -m "fix(retail-p2): Phase 2 final cleanup and verification"
```

---

## Phase 2 Deliverable Checklist

- [ ] DB: `markets.behavioral_events` table with RLS and indexes
- [ ] Backend: `/v1/retail/behavioral/market-stress` — Nifty + VIX stress assessment
- [ ] Backend: `/v1/retail/behavioral/events` — log, list, acknowledge behavioral events
- [ ] Backend: Retail signal feed now defaults to all asset classes
- [ ] Frontend: `SignalFilter` shows Crypto, F&O, Commodity, Bonds, Forex + Intraday horizon
- [ ] Frontend: `useMarketStress` hook (2-min poll, `isHighStress` derived)
- [ ] Frontend: `useDrawdownState` — derives peak NAV from series, returns alertTier
- [ ] Frontend: `useBehavioralEvents` + `useLogBehavioralEvent` + `useAcknowledgeBehavioralEvent`
- [ ] Frontend: `BehavioralAlertBanner` — Yellow (5–10%) and Orange (10–20%) non-blocking banners
- [ ] Frontend: `CoolingOffScreen` — Red alert modal before Core Portfolio panic sell
- [ ] Frontend: `InlineEducation` — 12-trigger education content, dismissable, shown once
- [ ] Frontend: `useInlineEducation` — tracks seen education IDs via behavioral_events
- [ ] Integration: Behavioral banner shown in `RetailMode` for Core tier drawdown
- [ ] Integration: Inline education triggered from `SignalCard` (4 triggers: high conviction, high VIX, intraday, F&O)
- [ ] All tests passing: ~15 backend + ~33 frontend
- [ ] TypeScript clean
