# Retail Investment Platform — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Phase 1 foundation of the Retail Investment Recommendation Platform — onboarding, three-tier portfolio, stock/MF signal feed with adaptive UI, and one-tap execution.

**Architecture:** New `src/features/markets/retail/` sub-feature extending the existing markets module. Backend adds one new FastAPI router (`retail.py`) to `services/markets-worker/`. Signals already exist in `markets.signals`; Phase 1 enriches them with LLM explanations stored in `metadata.explanations`. Two new Supabase tables: `markets.risk_profiles` and `markets.portfolio_tiers`.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Shadcn/Radix UI, Tailwind CSS (frontend); FastAPI + Python, Supabase/PostgreSQL (backend); Vitest + @testing-library/react (frontend tests); pytest (backend tests, no existing tests — write new)

**Worktree:** `~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform`  
**Branch:** `feature/retail-investment-platform`

---

## What Already Exists (Do NOT Rebuild)

| Existing piece | Location | Used in Phase 1 for |
|---|---|---|
| `QuickTradeButton` | `src/features/markets/components/QuickTradeButton.tsx` | One-tap trade from signal cards |
| `OrderFormSheet` | `src/features/markets/components/OrderFormSheet.tsx` | Trade confirmation sheet |
| `useActiveConnection` | `src/features/markets/hooks/useActiveConnection.ts` | Broker connection in ExecutionBottomSheet |
| `usePortfolioPnL` | `src/features/markets/hooks/usePortfolioPnL.ts` | P&L in tier views |
| `usePortfolios` | `src/features/markets/hooks/usePortfolios.ts` | Portfolio selection in tier setup |
| `useSignals` | `src/features/markets/hooks/useSignals.ts` | Existing signal queries |
| `signal_generator.py` | `services/markets-worker/src/markets_worker/jobs/signal_generator.py` | Extend with explanation layer |
| `llm_gateway.py` | `services/markets-worker/src/markets_worker/llm_gateway.py` | LLM explanation generation |
| `Signal` type | `src/features/markets/types.ts:349` | Already has `horizon`, `asset_class`, `confidence`, `metadata` |
| `AssetClass` type | `src/features/markets/types.ts:194` | Reuse in retail types |
| Supabase `markets.signals` table | DB | Already has `confidence`, `rationale`, `horizon`, `asset_class`, `risk_params`, `metadata` JSONB |

---

## Task 1: DB Migration — risk_profiles + portfolio_tiers

**Files:**
- Create: `supabase/migrations/20260518120000_markets_retail_profile.sql`
- Create: `supabase/migrations/20260518120001_markets_retail_profile_rollback.sql`

### Step 1: Write the migration SQL

```sql
-- supabase/migrations/20260518120000_markets_retail_profile.sql

-- ── Risk Profiles ─────────────────────────────────────────────────────────────
create table if not exists markets.risk_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  experience_level text not null check (experience_level in ('beginner','casual','self_directed')),
  risk_tag        text not null check (risk_tag in ('conservative','moderate','aggressive')),
  goals           jsonb not null default '[]',   -- [{goal: "retirement", years: 10}, ...]
  behavioral_flags jsonb not null default '{}',  -- {tends_panic_sell: true, ...}
  quiz_answers    jsonb not null default '{}',   -- raw quiz responses for audit
  onboarding_complete boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_risk_profile_user unique (user_id)
);

alter table markets.risk_profiles enable row level security;

create policy "Users manage own risk profile"
  on markets.risk_profiles
  for all using (auth.uid() = user_id);

-- ── Portfolio Tiers ───────────────────────────────────────────────────────────
create table if not exists markets.portfolio_tiers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  tier_number     int not null check (tier_number in (1,2,3)),
  name            text not null,  -- 'Safety Net' | 'Core Portfolio' | 'Experimental'
  portfolio_id    uuid references markets.portfolios(id) on delete set null,
  target_amount   numeric(18,2),  -- user-defined target allocation amount
  goals           jsonb not null default '[]',  -- linked goal names
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_portfolio_tier unique (user_id, tier_number)
);

alter table markets.portfolio_tiers enable row level security;

create policy "Users manage own tiers"
  on markets.portfolio_tiers
  for all using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function markets.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_risk_profiles_updated_at
  before update on markets.risk_profiles
  for each row execute function markets.set_updated_at();

create trigger trg_portfolio_tiers_updated_at
  before update on markets.portfolio_tiers
  for each row execute function markets.set_updated_at();
```

### Step 2: Apply migration to local Supabase

```bash
cd ~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npm run supabase:db:push
```

Expected: migration applied with no errors.

### Step 3: Verify tables exist

```bash
npm run supabase:start 2>/dev/null; npx supabase db query "select table_name from information_schema.tables where table_schema = 'markets' order by table_name"
```

Expected: `portfolio_tiers` and `risk_profiles` appear in the list.

### Step 4: Commit

```bash
git add supabase/migrations/20260518120000_markets_retail_profile.sql
git commit -m "feat(retail): add risk_profiles and portfolio_tiers migrations"
```

---

## Task 2: Frontend Types + Query Keys

**Files:**
- Create: `src/features/markets/retail/types.ts`
- Modify: `src/features/markets/hooks/queryKeys.ts`
- Test: `src/features/markets/retail/types.test.ts`

### Step 1: Write the failing type tests

```typescript
// src/features/markets/retail/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeRiskTag,
  TIER_DEFAULTS,
  type RiskProfile,
  type PortfolioTier,
  type RetailSignal,
} from './types';

describe('computeRiskTag', () => {
  it('returns conservative for score <= 4', () => {
    expect(computeRiskTag(4)).toBe('conservative');
  });
  it('returns moderate for score 5-7', () => {
    expect(computeRiskTag(6)).toBe('moderate');
  });
  it('returns aggressive for score >= 8', () => {
    expect(computeRiskTag(8)).toBe('aggressive');
  });
});

describe('TIER_DEFAULTS', () => {
  it('defines 3 tiers with correct names', () => {
    expect(TIER_DEFAULTS).toHaveLength(3);
    expect(TIER_DEFAULTS[0].name).toBe('Safety Net');
    expect(TIER_DEFAULTS[1].name).toBe('Core Portfolio');
    expect(TIER_DEFAULTS[2].name).toBe('Experimental');
  });
});
```

### Step 2: Run test to confirm it fails

```bash
cd ~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npx vitest run src/features/markets/retail/types.test.ts
```

Expected: FAIL — module not found.

### Step 3: Create the types file

```typescript
// src/features/markets/retail/types.ts
import type { Signal, AssetClass } from '../types';

export type ExperienceLevel = 'beginner' | 'casual' | 'self_directed';
export type RiskTag = 'conservative' | 'moderate' | 'aggressive';
export type TierName = 'Safety Net' | 'Core Portfolio' | 'Experimental';

export interface Goal {
  goal: string;   // e.g. 'retirement', 'emergency_fund', 'wealth_growth', etc.
  years: number;
}

export interface RiskProfile {
  id: string;
  user_id: string;
  experience_level: ExperienceLevel;
  risk_tag: RiskTag;
  goals: Goal[];
  behavioral_flags: Record<string, boolean>;
  quiz_answers: Record<string, string>;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertRiskProfileInput {
  experience_level: ExperienceLevel;
  risk_tag: RiskTag;
  goals: Goal[];
  behavioral_flags?: Record<string, boolean>;
  quiz_answers?: Record<string, string>;
  onboarding_complete?: boolean;
}

export interface PortfolioTier {
  id: string;
  user_id: string;
  tier_number: 1 | 2 | 3;
  name: TierName;
  portfolio_id: string | null;
  target_amount: number | null;
  goals: string[];
  created_at: string;
  updated_at: string;
}

export interface UpsertTierInput {
  tier_number: 1 | 2 | 3;
  name: TierName;
  portfolio_id?: string | null;
  target_amount?: number | null;
  goals?: string[];
}

export interface SignalExplanations {
  beginner: string;
  casual: string;
  self_directed: string;
}

/** Signal from markets.signals with explanation layer populated */
export interface RetailSignal extends Signal {
  metadata: Signal['metadata'] & {
    explanations?: SignalExplanations;
    horizon?: string;
    entry_price?: number;
    stop_loss?: number;
    target_price?: number;
    confidence_low?: number;
    confidence_high?: number;
    accuracy_historical?: number;
    accuracy_sample_size?: number;
  };
}

// ── Quiz scoring ──────────────────────────────────────────────────────────────

/** Score 0–10 from 4 quiz answers. Maps answer values to risk points.
 *  Each question can contribute 0, 1, or 2 points.
 *  ≤4 → conservative, 5–7 → moderate, ≥8 → aggressive */
export function computeRiskTag(score: number): RiskTag {
  if (score <= 4) return 'conservative';
  if (score <= 7) return 'moderate';
  return 'aggressive';
}

// ── Tier defaults ─────────────────────────────────────────────────────────────

export const TIER_DEFAULTS: Array<{
  tier_number: 1 | 2 | 3;
  name: TierName;
  description: string;
  signal_access: string;
}> = [
  {
    tier_number: 1,
    name: 'Safety Net',
    description: 'Capital protected, emergency access',
    signal_access: 'none',
  },
  {
    tier_number: 2,
    name: 'Core Portfolio',
    description: 'Long-term wealth, high conviction signals only',
    signal_access: 'high_conviction',
  },
  {
    tier_number: 3,
    name: 'Experimental',
    description: 'Active signals, play money, separate P&L',
    signal_access: 'all',
  },
];

export const GOALS = [
  { id: 'retirement',      label: 'Retirement' },
  { id: 'emergency_fund',  label: 'Emergency Fund / Safety Net' },
  { id: 'wealth_growth',   label: 'Wealth Growth' },
  { id: 'education',       label: "Child's Education" },
  { id: 'home_purchase',   label: 'Home Purchase' },
  { id: 'short_income',    label: 'Short-term Income' },
  { id: 'exploring',       label: 'Just exploring' },
] as const;
```

### Step 4: Add retail query keys to queryKeys.ts

Open `src/features/markets/hooks/queryKeys.ts` and add a `retail` section. Find the file's existing pattern and add:

```typescript
// Add inside the marketsKeys object in queryKeys.ts:
retail: {
  profile:       () => [...base, 'retail', 'profile'] as const,
  tiers:         () => [...base, 'retail', 'tiers'] as const,
  signals: (f?: object) => [...base, 'retail', 'signals', f ?? {}] as const,
},
```

### Step 5: Run test to confirm it passes

```bash
npx vitest run src/features/markets/retail/types.test.ts
```

Expected: PASS — 4 tests passing.

### Step 6: Commit

```bash
git add src/features/markets/retail/types.ts src/features/markets/hooks/queryKeys.ts
git commit -m "feat(retail): types, risk tag scoring, tier defaults, query keys"
```

---

## Task 3: Frontend Hooks — useRiskProfile + usePortfolioTiers

**Files:**
- Create: `src/features/markets/retail/hooks/useRiskProfile.ts`
- Create: `src/features/markets/retail/hooks/usePortfolioTiers.ts`
- Test: `src/features/markets/retail/hooks/useRiskProfile.test.ts`

### Step 1: Write the failing hook tests

```typescript
// src/features/markets/retail/hooks/useRiskProfile.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/utils';  // QueryClientProvider wrapper

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'profile-1',
                user_id: 'user-1',
                experience_level: 'beginner',
                risk_tag: 'conservative',
                goals: [],
                behavioral_flags: {},
                quiz_answers: {},
                onboarding_complete: false,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, roles: [] }),
}));

describe('useRiskProfile', () => {
  it('returns the profile data', async () => {
    const { useRiskProfile } = await import('./useRiskProfile');
    const { result } = renderHook(() => useRiskProfile(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.experience_level).toBe('beginner');
    expect(result.current.hasOnboarded).toBe(false);
  });
});
```

> **Note:** If `src/test/utils.ts` doesn't have `createWrapper`, create it:
> ```typescript
> // src/test/utils.tsx
> import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
> export function createWrapper() {
>   const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
>   return ({ children }: { children: React.ReactNode }) => (
>     <QueryClientProvider client={qc}>{children}</QueryClientProvider>
>   );
> }
> ```

### Step 2: Run test to confirm it fails

```bash
npx vitest run src/features/markets/retail/hooks/useRiskProfile.test.ts
```

Expected: FAIL — module not found.

### Step 3: Create useRiskProfile.ts

```typescript
// src/features/markets/retail/hooks/useRiskProfile.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { RiskProfile, UpsertRiskProfileInput } from '../types';

export function useRiskProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: marketsKeys.retail.profile(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RiskProfile | null> => {
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('risk_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  return {
    ...query,
    hasOnboarded: query.data?.onboarding_complete ?? false,
  };
}

export function useUpsertRiskProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertRiskProfileInput): Promise<RiskProfile> => {
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('risk_profiles')
        .upsert({ ...input, user_id: user!.id }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.profile() }),
  });
}
```

### Step 4: Create usePortfolioTiers.ts

```typescript
// src/features/markets/retail/hooks/usePortfolioTiers.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { PortfolioTier, UpsertTierInput } from '../types';

export function usePortfolioTiers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: marketsKeys.retail.tiers(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PortfolioTier[]> => {
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('portfolio_tiers')
        .select('*')
        .eq('user_id', user!.id)
        .order('tier_number');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertPortfolioTier() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertTierInput): Promise<PortfolioTier> => {
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('portfolio_tiers')
        .upsert(
          { ...input, user_id: user!.id },
          { onConflict: 'user_id,tier_number' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.tiers() }),
  });
}
```

### Step 5: Run test to confirm it passes

```bash
npx vitest run src/features/markets/retail/hooks/useRiskProfile.test.ts
```

Expected: PASS.

### Step 6: Commit

```bash
git add src/features/markets/retail/hooks/useRiskProfile.ts \
        src/features/markets/retail/hooks/usePortfolioTiers.ts \
        src/features/markets/retail/hooks/useRiskProfile.test.ts
git commit -m "feat(retail): useRiskProfile and usePortfolioTiers hooks"
```

---

## Task 4: Backend — Retail Router (Profile + Tiers CRUD)

**Files:**
- Create: `services/markets-worker/src/markets_worker/routers/retail.py`
- Modify: `services/markets-worker/src/markets_worker/main.py`
- Test: `services/markets-worker/tests/test_retail_router.py`

### Step 1: Write the failing backend tests

```python
# services/markets-worker/tests/test_retail_router.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from markets_worker.main import create_app

MOCK_USER_ID = "user-test-1"
MOCK_TOKEN = "mock-jwt-token"

@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {MOCK_TOKEN}"}

@pytest.fixture(autouse=True)
def mock_auth():
    with patch("markets_worker.auth.verify_token", return_value=MOCK_USER_ID):
        yield

@pytest.fixture(autouse=True)
def mock_db():
    mock_client = MagicMock()
    mock_schema = MagicMock()
    mock_client.schema.return_value = mock_schema
    with patch("markets_worker.routers.retail.get_supabase", return_value=mock_client):
        yield mock_schema

def test_get_profile_not_found(client, auth_headers, mock_db):
    mock_db.from_().select().eq().maybe_single.return_value = MagicMock(
        execute=MagicMock(return_value=MagicMock(data=None, error=None))
    )
    resp = client.get("/v1/retail/profile", headers=auth_headers)
    assert resp.status_code == 404

def test_upsert_profile(client, auth_headers, mock_db):
    profile_data = {
        "experience_level": "beginner",
        "risk_tag": "conservative",
        "goals": [{"goal": "retirement", "years": 20}],
        "onboarding_complete": False,
    }
    mock_db.from_().upsert().select().single.return_value = MagicMock(
        execute=MagicMock(return_value=MagicMock(
            data={**profile_data, "id": "p1", "user_id": MOCK_USER_ID},
            error=None
        ))
    )
    resp = client.post("/v1/retail/profile", json=profile_data, headers=auth_headers)
    assert resp.status_code in (200, 201)
```

### Step 2: Run test to confirm it fails

```bash
cd services/markets-worker
python -m pytest tests/test_retail_router.py -v 2>&1 | head -20
```

Expected: FAIL — router not found.

### Step 3: Create the retail router

```python
# services/markets-worker/src/markets_worker/routers/retail.py
"""Retail investment profile and tier management."""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from markets_worker.auth import verify_token
from markets_worker.db import get_supabase

logger = structlog.get_logger()
router = APIRouter(prefix="/v1/retail", tags=["retail"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class Goal(BaseModel):
    goal: str
    years: int


class UpsertProfileRequest(BaseModel):
    experience_level: str   # beginner | casual | self_directed
    risk_tag: str           # conservative | moderate | aggressive
    goals: list[Goal] = []
    behavioral_flags: dict[str, Any] = {}
    quiz_answers: dict[str, Any] = {}
    onboarding_complete: bool = False


class UpsertTierRequest(BaseModel):
    tier_number: int        # 1 | 2 | 3
    name: str
    portfolio_id: str | None = None
    target_amount: float | None = None
    goals: list[str] = []


# ── Risk profile endpoints ────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(user_id: str = Depends(verify_token)):
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("risk_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    if not res.data:
        raise HTTPException(status_code=404, detail="Risk profile not found")
    return res.data


@router.post("/profile", status_code=201)
async def upsert_profile(
    body: UpsertProfileRequest,
    user_id: str = Depends(verify_token),
):
    sb = get_supabase()
    payload = {
        **body.model_dump(),
        "goals": [g.model_dump() for g in body.goals],
        "user_id": user_id,
    }
    res = (
        sb.schema("markets")
        .from_("risk_profiles")
        .upsert(payload, on_conflict="user_id")
        .select()
        .single()
        .execute()
    )
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    return res.data


# ── Portfolio tiers endpoints ─────────────────────────────────────────────────

@router.get("/tiers")
async def get_tiers(user_id: str = Depends(verify_token)):
    sb = get_supabase()
    res = (
        sb.schema("markets")
        .from_("portfolio_tiers")
        .select("*")
        .eq("user_id", user_id)
        .order("tier_number")
        .execute()
    )
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    return res.data or []


@router.post("/tiers/{tier_number}", status_code=201)
async def upsert_tier(
    tier_number: int,
    body: UpsertTierRequest,
    user_id: str = Depends(verify_token),
):
    if tier_number not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="tier_number must be 1, 2, or 3")
    sb = get_supabase()
    payload = {**body.model_dump(), "tier_number": tier_number, "user_id": user_id}
    res = (
        sb.schema("markets")
        .from_("portfolio_tiers")
        .upsert(payload, on_conflict="user_id,tier_number")
        .select()
        .single()
        .execute()
    )
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    return res.data


# ── Retail signal feed ────────────────────────────────────────────────────────
# Returns signals from markets.signals filtered for retail relevance.
# Equity (horizon: short_term | long_term) + MF only.
# Decorates each with metadata.explanations if present.

@router.get("/signals")
async def get_retail_signals(
    limit: int = 20,
    asset_class: str | None = None,
    horizon: str | None = None,
    min_confidence: float = 0.60,
    user_id: str = Depends(verify_token),
):
    sb = get_supabase()
    q = (
        sb.schema("markets")
        .from_("signals")
        .select(
            "id, ts, instrument_id, signal_type, direction, confidence, "
            "rationale, price_at_signal, expires_at, metadata, horizon, "
            "asset_class, risk_params, score, "
            "instrument:instruments(symbol, exchange, instrument_type)"
        )
        .gte("confidence", min_confidence)
        .in_("asset_class", ["equity", "mutual_fund"] if not asset_class else [asset_class])
        .not_.is_("expires_at", "null")
        .gte("expires_at", "now()")
        .order("ts", desc=True)
        .limit(limit)
    )
    if horizon:
        q = q.eq("horizon", horizon)
    res = q.execute()
    if res.error:
        raise HTTPException(status_code=500, detail=str(res.error))
    return res.data or []
```

### Step 4: Wire the router into main.py

In `services/markets-worker/src/markets_worker/main.py`, add after the last import:

```python
from markets_worker.routers import retail as retail_router
```

And inside `create_app()`, after the last `app.include_router` line:

```python
app.include_router(retail_router.router, tags=["retail"])
```

### Step 5: Run tests to confirm they pass

```bash
cd services/markets-worker
python -m pytest tests/test_retail_router.py -v
```

Expected: PASS (may need `mkdir -p tests && touch tests/__init__.py` first).

### Step 6: Commit

```bash
git add services/markets-worker/src/markets_worker/routers/retail.py \
        services/markets-worker/src/markets_worker/main.py \
        services/markets-worker/tests/
git commit -m "feat(retail): retail FastAPI router — profile, tiers, signal feed"
```

---

## Task 5: Signal Explanation Layer (Extend signal_generator.py)

**Files:**
- Modify: `services/markets-worker/src/markets_worker/jobs/signal_generator.py`

The existing `signal_generator.py` already generates signals with `confidence`, `rationale`, `horizon`, `asset_class`. Phase 1 adds a `_generate_explanations` step that calls the LLM gateway and stores results in `metadata.explanations`. This runs for equity and MF signals only (Phase 1 scope).

### Step 1: Write a unit test for the explanation function

```python
# services/markets-worker/tests/test_signal_explanation.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_generate_explanations_returns_three_levels():
    from markets_worker.jobs.signal_generator import _generate_explanations

    mock_llm_response = {
        "beginner": "Reliance looks good to buy right now.",
        "casual": "RSI at 58, momentum rising. Confidence 72%. Entry ₹2,890.",
        "self_directed": "EMA20 > EMA50 cross. RSI 58. Vol +65% vs 20d avg. Confidence 72% (CI: 69–75%). Stop ₹2,820. Target ₹3,050. R/R 1:2.1.",
    }

    with patch(
        "markets_worker.jobs.signal_generator._call_llm_for_explanation",
        new=AsyncMock(return_value=mock_llm_response),
    ):
        result = await _generate_explanations(
            symbol="RELIANCE",
            asset_class="equity",
            signal_type="buy",
            confidence=0.72,
            rationale="EMA cross with volume confirmation",
            risk_params={"stop_loss_pct": 2.5, "target_pct": 5.5},
            horizon="short_term",
        )

    assert result["beginner"].startswith("Reliance")
    assert "RSI" in result["casual"]
    assert "EMA20" in result["self_directed"]
```

### Step 2: Run test to confirm it fails

```bash
cd services/markets-worker
python -m pytest tests/test_signal_explanation.py -v
```

Expected: FAIL — `_generate_explanations` not found.

### Step 3: Add explanation functions to signal_generator.py

At the bottom of `signal_generator.py`, before `# ── Graph construction`, add:

```python
# ── LLM Explanation Layer ──────────────────────────────────────────────────────

_EXPLANATION_SYSTEM_PROMPT = """You are a financial signal explainer for a retail investment app.
Given a trading signal, produce explanations at three reading levels.
Return ONLY valid JSON: {"beginner": "...", "casual": "...", "self_directed": "..."}
- beginner: 1-2 plain English sentences, no numbers except the action
- casual: 2-3 sentences with key indicator, confidence %, entry price
- self_directed: full technical detail — all indicators, confidence CI, stop, target, R/R, historical accuracy hint
"""

async def _call_llm_for_explanation(prompt_text: str) -> dict:
    from markets_worker.llm_gateway import resolve_llm_config
    import json, re
    config = await resolve_llm_config()
    if not config:
        return {}
    # Use anthropic if available, else skip
    if config.get("provider") == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=config["api_key"])
        msg = await client.messages.create(
            model=config.get("default_model", "claude-haiku-4-5-20251001"),
            max_tokens=512,
            temperature=0,
            system=_EXPLANATION_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt_text}],
        )
        raw = msg.content[0].text
    else:
        return {}
    # Parse JSON from response
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    return json.loads(m.group()) if m else {}


async def _generate_explanations(
    symbol: str,
    asset_class: str,
    signal_type: str,
    confidence: float,
    rationale: str,
    risk_params: dict,
    horizon: str,
) -> dict:
    prompt = (
        f"Symbol: {symbol}\nAsset class: {asset_class}\nSignal: {signal_type}\n"
        f"Horizon: {horizon}\nConfidence: {confidence:.0%}\nRationale: {rationale}\n"
        f"Stop loss: {risk_params.get('stop_loss_pct', 'N/A')}%  "
        f"Target: {risk_params.get('target_pct', 'N/A')}%  "
        f"R/R: {risk_params.get('r_r', 'N/A')}"
    )
    return await _call_llm_for_explanation(prompt)
```

Then in the `_persist` node function inside the graph (find the `persist` function near the bottom of the file), after `"metadata"` is built and before the `upsert` call, add:

```python
# Generate LLM explanations for retail feed (equity + MF only)
explanations = {}
if state.get("asset_class") in ("equity", "mf") and state.get("confidence", 0) >= 0.60:
    try:
        import asyncio
        explanations = asyncio.run(_generate_explanations(
            symbol=state["symbol"],
            asset_class=state["asset_class"],
            signal_type=state["signal_type"],
            confidence=state["confidence"],
            rationale=state.get("rationale", ""),
            risk_params=state.get("risk_params", {}),
            horizon=state.get("horizon", "short_term"),
        ))
    except Exception as e:
        logger.warning("explanation_failed", symbol=state["symbol"], error=str(e))

# Merge explanations into metadata
metadata = state.get("metadata", {}) or {}
if explanations:
    metadata["explanations"] = explanations
```

### Step 4: Run test to confirm it passes

```bash
python -m pytest tests/test_signal_explanation.py -v
```

Expected: PASS.

### Step 5: Commit

```bash
git add services/markets-worker/src/markets_worker/jobs/signal_generator.py \
        services/markets-worker/tests/test_signal_explanation.py
git commit -m "feat(retail): LLM explanation layer for equity/MF signals"
```

---

## Task 6: Frontend Hook — useRetailSignals

**Files:**
- Create: `src/features/markets/retail/hooks/useRetailSignals.ts`
- Test: `src/features/markets/retail/hooks/useRetailSignals.test.ts`

### Step 1: Write the failing test

```typescript
// src/features/markets/retail/hooks/useRetailSignals.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createWrapper } from '@/test/utils';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: { access_token: 'tok' }, roles: [] }),
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [
    {
      id: 's1', ts: '2026-05-18T10:00:00Z',
      instrument_id: 'instr-1', signal_type: 'buy',
      confidence: 0.73, horizon: 'short_term', asset_class: 'equity',
      metadata: { explanations: { beginner: 'Good buy.', casual: 'RSI rising.', self_directed: 'EMA cross.' } },
      instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
    },
  ],
}) as any;

describe('useRetailSignals', () => {
  it('fetches from /v1/retail/signals and returns RetailSignal[]', async () => {
    const { useRetailSignals } = await import('./useRetailSignals');
    const { result } = renderHook(() => useRetailSignals(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].instrument?.symbol).toBe('RELIANCE');
    expect(result.current.data![0].metadata.explanations?.beginner).toBe('Good buy.');
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/hooks/useRetailSignals.test.ts
```

### Step 3: Implement the hook

```typescript
// src/features/markets/retail/hooks/useRetailSignals.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { RetailSignal } from '../types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

interface RetailSignalFilters {
  assetClass?: string;
  horizon?: string;
  minConfidence?: number;
  limit?: number;
}

export function useRetailSignals(filters: RetailSignalFilters = {}) {
  const { session } = useAuth();

  return useQuery({
    queryKey: marketsKeys.retail.signals(filters),
    enabled: Boolean(session?.access_token),
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<RetailSignal[]> => {
      const params = new URLSearchParams();
      if (filters.assetClass)    params.set('asset_class', filters.assetClass);
      if (filters.horizon)       params.set('horizon', filters.horizon);
      if (filters.minConfidence) params.set('min_confidence', String(filters.minConfidence));
      if (filters.limit)         params.set('limit', String(filters.limit));

      const resp = await fetch(
        `${WORKER_URL}/v1/retail/signals?${params}`,
        { headers: { Authorization: `Bearer ${session!.access_token}` } },
      );
      if (!resp.ok) throw new Error(`retail signals: ${resp.status}`);
      return resp.json();
    },
  });
}
```

### Step 4: Run test to confirm pass

```bash
npx vitest run src/features/markets/retail/hooks/useRetailSignals.test.ts
```

### Step 5: Commit

```bash
git add src/features/markets/retail/hooks/useRetailSignals.ts \
        src/features/markets/retail/hooks/useRetailSignals.test.ts
git commit -m "feat(retail): useRetailSignals hook with worker fetch"
```

---

## Task 7: Onboarding Wizard

**Files:**
- Create: `src/features/markets/retail/onboarding/OnboardingWizard.tsx`
- Create: `src/features/markets/retail/onboarding/GoalSelector.tsx`
- Create: `src/features/markets/retail/onboarding/RiskQuiz.tsx`
- Create: `src/features/markets/retail/onboarding/TierSetup.tsx`
- Test: `src/features/markets/retail/onboarding/RiskQuiz.test.tsx`

### Step 1: Write test for quiz scoring

```typescript
// src/features/markets/retail/onboarding/RiskQuiz.test.tsx
import { describe, it, expect } from 'vitest';
import { computeRiskTag } from '../types';

describe('quiz risk scoring', () => {
  it('panic seller (all safe answers) → conservative', () => {
    // All "sell" / "ignore" / "sell anyway" / "No" answers = score 0
    expect(computeRiskTag(0)).toBe('conservative');
  });
  it('balanced investor → moderate', () => {
    expect(computeRiskTag(6)).toBe('moderate');
  });
  it('risk taker (all bold answers) → aggressive', () => {
    expect(computeRiskTag(10)).toBe('aggressive');
  });
});
```

### Step 2: Run to confirm pass (uses already-built computeRiskTag)

```bash
npx vitest run src/features/markets/retail/onboarding/RiskQuiz.test.tsx
```

Expected: PASS (logic already in types.ts).

### Step 3: Build GoalSelector component

```tsx
// src/features/markets/retail/onboarding/GoalSelector.tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { GOALS } from '../types';
import type { Goal } from '../types';

interface GoalSelectorProps {
  selected: string[];
  onChange: (goals: string[]) => void;
}

export function GoalSelector({ selected, onChange }: GoalSelectorProps) {
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((g) => g !== id)
        : selected.length < 3 ? [...selected, id] : selected,
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select up to 3 goals</p>
      {GOALS.map(({ id, label }) => (
        <div key={id} className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(id)}>
          <Checkbox id={id} checked={selected.includes(id)} onCheckedChange={() => toggle(id)} />
          <Label htmlFor={id} className="cursor-pointer text-sm">{label}</Label>
        </div>
      ))}
    </div>
  );
}
```

### Step 4: Build RiskQuiz component

```tsx
// src/features/markets/retail/onboarding/RiskQuiz.tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    text: 'Your ₹1 lakh investment drops to ₹75,000 in 3 months. You…',
    options: [
      { value: 'sell',      label: 'Sell immediately',        score: 0 },
      { value: 'hold',      label: 'Hold and wait',           score: 1 },
      { value: 'buy_more',  label: 'Buy more at lower price', score: 2 },
    ],
  },
  {
    id: 'q2',
    text: 'You see a trending stock tip on social media. You…',
    options: [
      { value: 'ignore',    label: 'Ignore it',               score: 0 },
      { value: 'research',  label: 'Investigate first',        score: 1 },
      { value: 'buy_small', label: 'Buy a small amount',      score: 2 },
    ],
  },
  {
    id: 'q3',
    text: 'Markets have fallen 20%. Your advisor says to wait. You…',
    options: [
      { value: 'sell',      label: 'Sell anyway',             score: 0 },
      { value: 'wait',      label: 'Wait as advised',         score: 1 },
      { value: 'invest',    label: 'Invest more',             score: 2 },
    ],
  },
  {
    id: 'q4',
    text: 'You need this money in 2 years. Would you invest in stocks?',
    options: [
      { value: 'no',        label: 'No',                      score: 0 },
      { value: 'some',      label: 'Some of it',              score: 1 },
      { value: 'yes',       label: 'Yes',                     score: 2 },
    ],
  },
] as const;

interface RiskQuizProps {
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}

export function RiskQuiz({ answers, onChange }: RiskQuizProps) {
  return (
    <div className="space-y-6">
      {QUIZ_QUESTIONS.map((q) => (
        <div key={q.id} className="space-y-3">
          <p className="text-sm font-medium">{q.text}</p>
          <RadioGroup
            value={answers[q.id] ?? ''}
            onValueChange={(v) => onChange({ ...answers, [q.id]: v })}
          >
            {q.options.map((opt) => (
              <div key={opt.value} className="flex items-center gap-3">
                <RadioGroupItem value={opt.value} id={`${q.id}-${opt.value}`} />
                <Label htmlFor={`${q.id}-${opt.value}`} className="text-sm cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ))}
    </div>
  );
}

export function computeQuizScore(answers: Record<string, string>): number {
  return QUIZ_QUESTIONS.reduce((total, q) => {
    const answer = q.options.find((o) => o.value === answers[q.id]);
    return total + (answer?.score ?? 0);
  }, 0);
}
```

### Step 5: Build TierSetup component

```tsx
// src/features/markets/retail/onboarding/TierSetup.tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TIER_DEFAULTS, type PortfolioTier } from '../types';
import { usePortfolios } from '../../hooks/usePortfolios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TierSetupProps {
  tiers: Array<{ tier_number: 1 | 2 | 3; portfolio_id: string | null; target_amount: number | null }>;
  onChange: (
    tierNumber: 1 | 2 | 3,
    field: 'portfolio_id' | 'target_amount',
    value: string | number | null,
  ) => void;
}

export function TierSetup({ tiers, onChange }: TierSetupProps) {
  const { data: portfolios = [] } = usePortfolios();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Assign each tier to a portfolio and set a target amount. You can change these anytime.
      </p>
      {TIER_DEFAULTS.map((def) => {
        const tier = tiers.find((t) => t.tier_number === def.tier_number);
        return (
          <div key={def.tier_number} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Tier {def.tier_number}</Badge>
              <span className="font-semibold text-sm">{def.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{def.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Portfolio</Label>
                <Select
                  value={tier?.portfolio_id ?? ''}
                  onValueChange={(v) => onChange(def.tier_number as 1|2|3, 'portfolio_id', v || null)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target Amount (₹)</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder="e.g. 500000"
                  value={tier?.target_amount ?? ''}
                  onChange={(e) =>
                    onChange(def.tier_number as 1|2|3, 'target_amount', e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### Step 6: Build OnboardingWizard

```tsx
// src/features/markets/retail/onboarding/OnboardingWizard.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { GoalSelector } from './GoalSelector';
import { RiskQuiz, computeQuizScore } from './RiskQuiz';
import { TierSetup } from './TierSetup';
import { computeRiskTag, TIER_DEFAULTS, type ExperienceLevel, type Goal } from '../types';
import { useUpsertRiskProfile } from '../hooks/useRiskProfile';
import { useUpsertPortfolioTier } from '../hooks/usePortfolioTiers';
import { toast } from 'sonner';

const STEPS = ['Experience', 'Goals', 'Timeline', 'Quiz', 'Tiers'];

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [goals, setGoals]           = useState<string[]>([]);
  const [timelines, setTimelines]   = useState<Record<string, number>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [tiers, setTiers] = useState(
    TIER_DEFAULTS.map((d) => ({ tier_number: d.tier_number, portfolio_id: null as string | null, target_amount: null as number | null }))
  );

  const upsertProfile = useUpsertRiskProfile();
  const upsertTier    = useUpsertPortfolioTier();

  const progress = ((step + 1) / STEPS.length) * 100;
  const canAdvance = step !== 1 || goals.length > 0;

  const updateTier = (tierNumber: 1 | 2 | 3, field: 'portfolio_id' | 'target_amount', value: string | number | null) => {
    setTiers((prev) => prev.map((t) => t.tier_number === tierNumber ? { ...t, [field]: value } : t));
  };

  const handleFinish = async () => {
    const score   = computeQuizScore(quizAnswers);
    const riskTag = computeRiskTag(score);
    const goalObjs: Goal[] = goals.map((g) => ({ goal: g, years: timelines[g] ?? 10 }));

    try {
      await upsertProfile.mutateAsync({
        experience_level: experience,
        risk_tag: riskTag,
        goals: goalObjs,
        quiz_answers: quizAnswers,
        behavioral_flags: score <= 2 ? { tends_panic_sell: true } : {},
        onboarding_complete: true,
      });
      await Promise.all(
        tiers.map((t) =>
          upsertTier.mutateAsync({
            tier_number: t.tier_number,
            name: TIER_DEFAULTS[t.tier_number - 1].name,
            portfolio_id: t.portfolio_id,
            target_amount: t.target_amount,
          }),
        ),
      );
      onComplete();
    } catch {
      toast.error('Setup failed. Please try again.');
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{STEPS[step]}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {step === 0 && 'What best describes you?'}
            {step === 1 && "What are you investing for?"}
            {step === 2 && 'How long is each goal?'}
            {step === 3 && 'Quick risk check'}
            {step === 4 && 'Set up your three tiers'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <RadioGroup value={experience} onValueChange={(v) => setExperience(v as ExperienceLevel)} className="space-y-3">
              {[
                { value: 'beginner',      label: 'Beginner',      desc: 'New to investing, want simple guidance' },
                { value: 'casual',        label: 'Casual',        desc: 'Know the basics, want to stay informed' },
                { value: 'self_directed', label: 'Self-directed', desc: 'Experienced, want full details and control' },
              ].map(({ value, label, desc }) => (
                <div key={value} className="flex items-start gap-3 cursor-pointer" onClick={() => setExperience(value as ExperienceLevel)}>
                  <RadioGroupItem value={value} id={value} className="mt-0.5" />
                  <Label htmlFor={value} className="cursor-pointer">
                    <span className="font-medium text-sm">{label}</span>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {step === 1 && (
            <GoalSelector selected={goals} onChange={setGoals} />
          )}

          {step === 2 && (
            <div className="space-y-6">
              {goals.map((g) => (
                <div key={g} className="space-y-2">
                  <Label className="capitalize text-sm">{g.replace('_', ' ')}</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      min={1} max={30} step={1}
                      value={[timelines[g] ?? 10]}
                      onValueChange={([v]) => setTimelines((t) => ({ ...t, [g]: v }))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-16 text-right">
                      {timelines[g] ?? 10} yr{(timelines[g] ?? 10) > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <RiskQuiz answers={quizAnswers} onChange={setQuizAnswers} />
          )}

          {step === 4 && (
            <TierSetup tiers={tiers} onChange={updateTier} />
          )}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1">
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance}
                className="flex-1"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={upsertProfile.isPending || upsertTier.isPending}
                className="flex-1"
              >
                {upsertProfile.isPending ? 'Saving…' : 'Start Investing'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 7: Commit

```bash
git add src/features/markets/retail/onboarding/
git commit -m "feat(retail): 5-step onboarding wizard — experience, goals, timeline, quiz, tiers"
```

---

## Task 8: Three-Tier Portfolio Dashboard

**Files:**
- Create: `src/features/markets/retail/dashboard/GoalProgressAnchor.tsx`
- Create: `src/features/markets/retail/dashboard/PortfolioTierView.tsx`
- Create: `src/features/markets/retail/dashboard/RetailDashboard.tsx`
- Test: `src/features/markets/retail/dashboard/GoalProgressAnchor.test.tsx`

### Step 1: Write the failing test

```tsx
// src/features/markets/retail/dashboard/GoalProgressAnchor.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GoalProgressAnchor } from './GoalProgressAnchor';

describe('GoalProgressAnchor', () => {
  it('shows progress percentage and goal label', () => {
    render(
      <GoalProgressAnchor
        currentValue={482300}
        targetValue={800000}
        goalLabel="Retirement"
        targetYear={2038}
      />,
    );
    expect(screen.getByText(/60%/)).toBeInTheDocument();
    expect(screen.getByText(/Retirement/)).toBeInTheDocument();
    expect(screen.getByText(/2038/)).toBeInTheDocument();
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/dashboard/GoalProgressAnchor.test.tsx
```

### Step 3: Build GoalProgressAnchor

```tsx
// src/features/markets/retail/dashboard/GoalProgressAnchor.tsx
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';

interface GoalProgressAnchorProps {
  currentValue: number;
  targetValue: number;
  goalLabel: string;
  targetYear: number;
}

export function GoalProgressAnchor({
  currentValue,
  targetValue,
  goalLabel,
  targetYear,
}: GoalProgressAnchorProps) {
  const pct = Math.min(Math.round((currentValue / targetValue) * 100), 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{goalLabel} goal</span>
        <span>on track for {targetYear}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{pct}% of {formatCurrency(targetValue)}</span>
        <span className="text-muted-foreground">Current: {formatCurrency(currentValue)}</span>
      </div>
    </div>
  );
}
```

> **Note:** If `formatCurrency` doesn't exist in `@/lib/utils`, add it:
> ```typescript
> export function formatCurrency(n: number, currency = '₹'): string {
>   return `${currency}${n.toLocaleString('en-IN')}`;
> }
> ```

### Step 4: Run test to confirm pass

```bash
npx vitest run src/features/markets/retail/dashboard/GoalProgressAnchor.test.tsx
```

### Step 5: Build PortfolioTierView

```tsx
// src/features/markets/retail/dashboard/PortfolioTierView.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortfolioTiers } from '../hooks/usePortfolioTiers';
import { usePortfolioPnL } from '../../hooks/usePortfolioPnL';
import { GoalProgressAnchor } from './GoalProgressAnchor';
import type { PortfolioTier } from '../types';

function TierCard({ tier }: { tier: PortfolioTier }) {
  const pnl = usePortfolioPnL(tier.portfolio_id ?? '', 365);
  const summary = pnl.data?.summary;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{tier.name}</CardTitle>
          <Badge variant={summary && summary.total_pnl >= 0 ? 'default' : 'destructive'} className="text-xs">
            {summary ? `${summary.pnl_pct >= 0 ? '+' : ''}${summary.pnl_pct.toFixed(1)}%` : '—'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current value</span>
          <span className="font-semibold">
            {summary ? `₹${summary.current_nav.toLocaleString('en-IN')}` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total P&L</span>
          <span className={summary && summary.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>
            {summary ? `₹${summary.total_pnl.toLocaleString('en-IN')}` : '—'}
          </span>
        </div>
        {tier.target_amount && summary && (
          <GoalProgressAnchor
            currentValue={summary.current_nav}
            targetValue={tier.target_amount}
            goalLabel={tier.goals[0] ?? tier.name}
            targetYear={new Date().getFullYear() + 10}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function PortfolioTierView() {
  const { data: tiers = [], isLoading } = usePortfolioTiers();

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading tiers…</div>;
  if (tiers.length === 0) return null;

  return (
    <Tabs defaultValue="1">
      <TabsList className="w-full">
        {tiers.map((t) => (
          <TabsTrigger key={t.tier_number} value={String(t.tier_number)} className="flex-1 text-xs">
            {t.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tiers.map((t) => (
        <TabsContent key={t.tier_number} value={String(t.tier_number)}>
          <TierCard tier={t} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

### Step 6: Build RetailDashboard

```tsx
// src/features/markets/retail/dashboard/RetailDashboard.tsx
import { PortfolioTierView } from './PortfolioTierView';
import type { RiskProfile } from '../types';

interface RetailDashboardProps {
  profile: RiskProfile;
}

export function RetailDashboard({ profile }: RetailDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your Portfolio</h2>
          <p className="text-xs text-muted-foreground capitalize">
            {profile.risk_tag} · {profile.experience_level.replace('_', '-')} investor
          </p>
        </div>
      </div>
      <PortfolioTierView />
    </div>
  );
}
```

### Step 7: Commit

```bash
git add src/features/markets/retail/dashboard/
git commit -m "feat(retail): three-tier dashboard — PortfolioTierView and GoalProgressAnchor"
```

---

## Task 9: Recommendation Signal Feed

**Files:**
- Create: `src/features/markets/retail/feed/SignalCard.tsx`
- Create: `src/features/markets/retail/feed/SignalFilter.tsx`
- Create: `src/features/markets/retail/feed/RetailSignalFeed.tsx`
- Test: `src/features/markets/retail/feed/SignalCard.test.tsx`

### Step 1: Write the failing test

```tsx
// src/features/markets/retail/feed/SignalCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../hooks/useActiveConnection', () => ({
  useActiveConnection: () => ({ connection: null, hasTradeableConnection: false, isLoading: false }),
}));

const mockSignal = {
  id: 's1', ts: '2026-05-18T10:00:00Z',
  instrument_id: 'instr-1', signal_type: 'buy',
  direction: 'long', confidence: 0.73, score: 73,
  horizon: 'short_term', asset_class: 'equity',
  rationale: 'EMA cross with volume confirmation',
  price_at_signal: 2890, expires_at: null, strategy_id: null,
  portfolio_id: null, generated_by: 'signal_generator',
  risk_params: { stop_loss_pct: 2.5, target_pct: 5.5, r_r: 2.2 },
  metadata: {
    explanations: {
      beginner: 'Reliance looks good to buy.',
      casual: 'RSI rising. Confidence 73%. Entry ₹2,890.',
      self_directed: 'EMA20 > EMA50. RSI 58. Vol +65%. Stop ₹2,820. Target ₹3,050.',
    },
  },
  instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
};

describe('SignalCard', () => {
  it('shows beginner explanation for beginner level', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard signal={mockSignal as any} experienceLevel="beginner" />
      </MemoryRouter>,
    );
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('Reliance looks good to buy.')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('shows confidence % for casual level', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard signal={mockSignal as any} experienceLevel="casual" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/73%/)).toBeInTheDocument();
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/feed/SignalCard.test.tsx
```

### Step 3: Build SignalCard

```tsx
// src/features/markets/retail/feed/SignalCard.tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ExperienceLevel, RetailSignal } from '../types';

function confidenceLabel(c: number): string {
  if (c >= 0.85) return 'High Conviction';
  if (c >= 0.70) return 'Strong';
  return 'Moderate';
}

function confidenceVariant(c: number): 'default' | 'secondary' | 'outline' {
  if (c >= 0.85) return 'default';
  if (c >= 0.70) return 'secondary';
  return 'outline';
}

interface SignalCardProps {
  signal: RetailSignal;
  experienceLevel: ExperienceLevel;
  onExecute?: (signal: RetailSignal) => void;
}

export function SignalCard({ signal, experienceLevel, onExecute }: SignalCardProps) {
  const { instrument, confidence = 0, metadata, signal_type, horizon } = signal;
  const expl = metadata?.explanations;
  const symbol = instrument?.symbol ?? '—';
  const isBuy = signal_type === 'buy';

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{symbol}</span>
            <Badge variant={isBuy ? 'default' : 'destructive'} className="text-xs uppercase">
              {signal_type}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {experienceLevel !== 'beginner' && (
              <span className="text-xs text-muted-foreground">{Math.round(confidence * 100)}%</span>
            )}
            <Badge variant={confidenceVariant(confidence)} className="text-xs">
              {confidenceLabel(confidence)}
            </Badge>
          </div>
        </div>

        {/* Adaptive explanation */}
        <p className="text-sm text-muted-foreground leading-snug">
          {experienceLevel === 'beginner' && (expl?.beginner ?? signal.rationale)}
          {experienceLevel === 'casual'   && (expl?.casual   ?? signal.rationale)}
          {experienceLevel === 'self_directed' && (expl?.self_directed ?? signal.rationale)}
        </p>

        {/* Self-directed extras */}
        {experienceLevel === 'self_directed' && metadata?.stop_loss && (
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>Stop <span className="text-foreground font-medium">₹{metadata.stop_loss}</span></div>
            <div>Target <span className="text-foreground font-medium">₹{metadata.target_price}</span></div>
            <div>R/R <span className="text-foreground font-medium">1:{signal.risk_params?.r_r ?? '—'}</span></div>
          </div>
        )}

        {/* Horizon + Execute */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground capitalize">
            {horizon?.replace('_', ' ')} · {instrument?.exchange}
          </span>
          {onExecute && (
            <Button
              size="sm"
              variant={isBuy ? 'default' : 'destructive'}
              className="h-7 px-3 text-xs"
              onClick={() => onExecute(signal)}
            >
              {isBuy ? 'Buy' : 'Sell'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 4: Run test to confirm pass

```bash
npx vitest run src/features/markets/retail/feed/SignalCard.test.tsx
```

### Step 5: Build SignalFilter

```tsx
// src/features/markets/retail/feed/SignalFilter.tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Filters {
  assetClass: string | undefined;
  horizon: string | undefined;
  minConfidence: number;
}

interface SignalFilterProps {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const ASSET_CLASSES = [
  { value: undefined,      label: 'All' },
  { value: 'equity',       label: 'Stocks' },
  { value: 'mutual_fund',  label: 'MF' },
];

const HORIZONS = [
  { value: undefined,      label: 'All' },
  { value: 'short_term',   label: 'Swing' },
  { value: 'long_term',    label: 'Long-term' },
];

export function SignalFilter({ filters, onChange }: SignalFilterProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {ASSET_CLASSES.map(({ value, label }) => (
          <Badge
            key={label}
            variant={filters.assetClass === value ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => onChange({ ...filters, assetClass: value })}
          >
            {label}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {HORIZONS.map(({ value, label }) => (
          <Badge
            key={label}
            variant={filters.horizon === value ? 'secondary' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => onChange({ ...filters, horizon: value })}
          >
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
```

### Step 6: Build RetailSignalFeed

```tsx
// src/features/markets/retail/feed/RetailSignalFeed.tsx
import { useState } from 'react';
import { SignalCard } from './SignalCard';
import { SignalFilter } from './SignalFilter';
import { useRetailSignals } from '../hooks/useRetailSignals';
import type { ExperienceLevel, RetailSignal } from '../types';

interface RetailSignalFeedProps {
  experienceLevel: ExperienceLevel;
  onExecute: (signal: RetailSignal) => void;
}

export function RetailSignalFeed({ experienceLevel, onExecute }: RetailSignalFeedProps) {
  const [filters, setFilters] = useState({
    assetClass: undefined as string | undefined,
    horizon:    undefined as string | undefined,
    minConfidence: 0.60,
  });

  const { data: signals = [], isLoading, isError } = useRetailSignals({
    assetClass:     filters.assetClass,
    horizon:        filters.horizon,
    minConfidence:  filters.minConfidence,
    limit: 30,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Signals</h3>
        <span className="text-xs text-muted-foreground">{signals.length} available</span>
      </div>
      <SignalFilter filters={filters} onChange={setFilters} />
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">Failed to load signals. Is the markets worker running?</p>
      )}
      {!isLoading && signals.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No signals match your filters right now.
        </p>
      )}
      <div className="space-y-3">
        {signals.map((s) => (
          <SignalCard key={s.id} signal={s} experienceLevel={experienceLevel} onExecute={onExecute} />
        ))}
      </div>
    </div>
  );
}
```

### Step 7: Commit

```bash
git add src/features/markets/retail/feed/
git commit -m "feat(retail): adaptive signal feed — SignalCard, SignalFilter, RetailSignalFeed"
```

---

## Task 10: ExecutionBottomSheet

**Files:**
- Create: `src/features/markets/retail/feed/ExecutionBottomSheet.tsx`
- Test: `src/features/markets/retail/feed/ExecutionBottomSheet.test.tsx`

### Step 1: Write the failing test

```tsx
// src/features/markets/retail/feed/ExecutionBottomSheet.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../hooks/useActiveConnection', () => ({
  useActiveConnection: () => ({
    connection: { id: 'conn-1', display_name: 'Zerodha', broker: 'zerodha' },
    hasTradeableConnection: true,
    isLoading: false,
  }),
}));

vi.mock('../../../components/OrderFormSheet', () => ({
  OrderFormSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="order-form">OrderForm</div> : null,
}));

const mockSignal = {
  id: 's1', signal_type: 'buy', confidence: 0.73,
  price_at_signal: 2890,
  instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
  metadata: {},
};

describe('ExecutionBottomSheet', () => {
  it('shows signal summary and SEBI disclaimer', async () => {
    const { ExecutionBottomSheet } = await import('./ExecutionBottomSheet');
    render(
      <MemoryRouter>
        <ExecutionBottomSheet
          signal={mockSignal as any}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText(/past performance/i)).toBeInTheDocument();
  });
});
```

### Step 2: Run to confirm failure

```bash
npx vitest run src/features/markets/retail/feed/ExecutionBottomSheet.test.tsx
```

### Step 3: Build ExecutionBottomSheet

```tsx
// src/features/markets/retail/feed/ExecutionBottomSheet.tsx
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderFormSheet } from '../../../components/OrderFormSheet';
import { useActiveConnection } from '../../../hooks/useActiveConnection';
import type { RetailSignal } from '../types';

interface ExecutionBottomSheetProps {
  signal: RetailSignal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutionBottomSheet({ signal, open, onOpenChange }: ExecutionBottomSheetProps) {
  const { connection, hasTradeableConnection } = useActiveConnection();
  const [orderOpen, setOrderOpen] = useState(false);

  if (!signal) return null;
  const { instrument, signal_type, confidence = 0, price_at_signal } = signal;
  const symbol = instrument?.symbol ?? '—';
  const side = signal_type === 'buy' ? 'BUY' : 'SELL';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[70vh]">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base">Confirm trade</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            {/* Signal summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <span className="font-semibold">{symbol}</span>
                <Badge
                  variant={side === 'BUY' ? 'default' : 'destructive'}
                  className="ml-2 text-xs"
                >
                  {side}
                </Badge>
              </div>
              <div className="text-right">
                {price_at_signal && (
                  <p className="text-sm font-medium">₹{price_at_signal.toLocaleString('en-IN')}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Confidence {Math.round(confidence * 100)}%
                </p>
              </div>
            </div>

            {/* SEBI mandatory disclaimer */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              Past performance is not indicative of future results. This signal is for informational
              purposes only and does not constitute investment advice. Invest only what you can afford to lose.
            </p>

            {/* Execute */}
            <Button
              className="w-full"
              variant={side === 'BUY' ? 'default' : 'destructive'}
              onClick={() => { onOpenChange(false); setOrderOpen(true); }}
              disabled={!connection}
            >
              {connection ? `Proceed to ${side}` : 'Connect broker to trade'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Full order form (existing QuickTradeButton pattern) */}
      {connection && (
        <OrderFormSheet
          open={orderOpen}
          onOpenChange={setOrderOpen}
          connectionId={connection.id}
          connectionName={connection.display_name}
          brokerName={connection.broker}
          canTrade={hasTradeableConnection}
          defaultSymbol={symbol}
          defaultExchange={instrument?.exchange ?? 'NSE'}
          defaultTransactionType={side}
        />
      )}
    </>
  );
}
```

### Step 4: Run test to confirm pass

```bash
npx vitest run src/features/markets/retail/feed/ExecutionBottomSheet.test.tsx
```

### Step 5: Commit

```bash
git add src/features/markets/retail/feed/ExecutionBottomSheet.tsx \
        src/features/markets/retail/feed/ExecutionBottomSheet.test.tsx
git commit -m "feat(retail): ExecutionBottomSheet — signal summary + SEBI disclaimer + broker order"
```

---

## Task 11: RetailMode Entry Point + Navigation

**Files:**
- Create: `src/features/markets/retail/RetailMode.tsx`
- Create: `src/features/markets/pages/RetailModePage.tsx`
- Modify: `src/App.tsx` — add `/dashboard/markets/retail` route
- Modify: `src/config/navigation.ts` (or equivalent nav config) — add Retail Mode entry

### Step 1: Build RetailMode gate component

```tsx
// src/features/markets/retail/RetailMode.tsx
import { useState } from 'react';
import { OnboardingWizard } from './onboarding/OnboardingWizard';
import { RetailDashboard } from './dashboard/RetailDashboard';
import { RetailSignalFeed } from './feed/RetailSignalFeed';
import { ExecutionBottomSheet } from './feed/ExecutionBottomSheet';
import { useRiskProfile } from './hooks/useRiskProfile';
import type { RetailSignal } from './types';

export function RetailMode() {
  const { data: profile, isLoading, hasOnboarded } = useRiskProfile();
  const [executing, setExecuting] = useState<RetailSignal | null>(null);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading your investment profile…</div>;
  }

  if (!hasOnboarded) {
    return <OnboardingWizard onComplete={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <RetailDashboard profile={profile!} />
      <hr className="border-border" />
      <RetailSignalFeed
        experienceLevel={profile!.experience_level}
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

### Step 2: Build RetailModePage

```tsx
// src/features/markets/pages/RetailModePage.tsx
import { RetailMode } from '../retail/RetailMode';

export default function RetailModePage() {
  return <RetailMode />;
}
```

### Step 3: Add route to App.tsx

Find the markets routes section in `src/App.tsx`. It will have a pattern like:

```tsx
<Route path="/dashboard/markets/signals" element={<Suspense ...><SignalsPage /></Suspense>} />
```

Add alongside it:

```tsx
<Route
  path="/dashboard/markets/retail"
  element={
    <Suspense fallback={<div />}>
      {React.lazy(() => import('@/features/markets/pages/RetailModePage'))}
    </Suspense>
  }
/>
```

> **Exact implementation:** Find the lazy import pattern in `App.tsx` for any existing markets page (e.g. `SignalsPage`) and replicate it exactly. The file uses `React.lazy` with dynamic imports.

### Step 4: Add to navigation config

Find the markets navigation config. Search for it:

```bash
grep -r "signals\|watchlist" src/config/ src/features/markets/ --include="*.ts" -l
```

Find the file that defines the markets sidebar/nav entries. Add a "Retail Mode" entry with:
- `path: '/dashboard/markets/retail'`
- `label: 'Retail Mode'`  
- `icon: 'TrendingUp'` (already imported in the nav file — check existing icons for what's available)

### Step 5: Create public index for retail sub-feature

```typescript
// src/features/markets/retail/index.ts
export { RetailMode } from './RetailMode';
export type { RiskProfile, PortfolioTier, RetailSignal, ExperienceLevel } from './types';
```

### Step 6: Commit

```bash
git add src/features/markets/retail/RetailMode.tsx \
        src/features/markets/retail/index.ts \
        src/features/markets/pages/RetailModePage.tsx \
        src/App.tsx
git commit -m "feat(retail): RetailMode entry point, route, and navigation entry"
```

---

## Task 12: End-to-End Smoke Test

### Step 1: Start the development environment

```bash
cd ~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform
npm run dev
```

### Step 2: Verify the route loads

Open browser → `http://localhost:5173/dashboard/markets/retail`

Expected: Onboarding wizard appears (since no risk profile exists in local DB).

### Step 3: Complete onboarding

1. Select experience level → click Next
2. Select 2 goals → click Next
3. Set timeline sliders → click Next
4. Answer all 4 quiz questions → click Next
5. Assign portfolios to tiers (skip if no portfolios exist) → click "Start Investing"

Expected: Dashboard loads with three-tier tabs and signal feed.

### Step 4: Verify signal feed

Expected: Signal cards appear (if markets-worker is running and has signals). If worker is not running, error state shows.

### Step 5: Verify type check passes

```bash
npm run typecheck
```

Expected: No type errors in the new `retail/` files.

### Step 6: Run all unit tests

```bash
npx vitest run src/features/markets/retail/
```

Expected: All tests pass.

### Step 7: Final commit (if any cleanup needed)

```bash
git add -p   # stage any leftover changes
git commit -m "feat(retail): Phase 1 complete — onboarding, three-tier portfolio, signal feed, execution"
```

---

## Phase 1 Deliverable Checklist

- [ ] DB: `markets.risk_profiles` and `markets.portfolio_tiers` tables with RLS
- [ ] Backend: `GET/POST /v1/retail/profile`, `GET/POST /v1/retail/tiers/{n}`, `GET /v1/retail/signals`
- [ ] Backend: Signal explanation layer (LLM, 3 levels, stored in `metadata.explanations`)
- [ ] Frontend: 5-step onboarding wizard (experience, goals, timeline, quiz, tiers)
- [ ] Frontend: Three-tier portfolio dashboard with per-tier P&L and goal progress
- [ ] Frontend: Adaptive recommendation feed (beginner / casual / self-directed cards)
- [ ] Frontend: One-tap ExecutionBottomSheet with SEBI disclaimer → OrderFormSheet
- [ ] Navigation: "Retail Mode" entry in markets nav
- [ ] All new unit tests passing
- [ ] `npm run typecheck` clean

---

**Plan complete and saved to `docs/plans/2026-05-18-retail-investment-platform-phase1.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** — dispatch fresh subagent per task, review between tasks, fast iteration with checkpoints

**2. Parallel Session (separate)** — open new session in the worktree at `~/.config/superpowers/worktrees/logic-nexus-ai/retail-investment-platform` and use `/executing-plans` skill

**Which approach?**
