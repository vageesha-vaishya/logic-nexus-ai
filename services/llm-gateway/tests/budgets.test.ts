// Pure-function tests for budget enforcement + the in-memory store.

import {
  evaluateEnforcement,
  scopeIdFor,
  scopeOrder,
} from '../src/budgets/enforcement.js';
import { buildInMemoryBudgetStore, periodStart } from '../src/budgets/store.js';
import type { BudgetCap, CounterSnapshot, QuotaCap } from '../src/budgets/types.js';

function cap(overrides: Partial<BudgetCap> = {}): BudgetCap {
  return {
    scope_kind: 'tenant',
    scope_id: 'tenant-A',
    period_kind: 'monthly',
    limit_usd: 100,
    warning_pct: 80,
    hard_cap: true,
    tenant_paid_uncapped: false,
    ...overrides,
  };
}

function quota(overrides: Partial<QuotaCap> = {}): QuotaCap {
  return {
    scope_kind: 'tenant',
    scope_id: 'tenant-A',
    period_kind: 'monthly',
    limit_invocations: 1000,
    limit_tokens: null,
    hard_cap: true,
    ...overrides,
  };
}

function snap(overrides: Partial<CounterSnapshot>): CounterSnapshot {
  return {
    scope_kind: 'tenant',
    scope_id: 'tenant-A',
    period_kind: 'monthly',
    period_started_at: '2026-06-01T00:00:00Z',
    spent_usd: 0,
    invocations: 0,
    tokens: 0,
    ...overrides,
  };
}

function ctrs(rows: CounterSnapshot[]): Map<string, CounterSnapshot> {
  const m = new Map<string, CounterSnapshot>();
  for (const r of rows) m.set(`${r.scope_kind}::${r.scope_id}::${r.period_kind}`, r);
  return m;
}

describe('evaluateEnforcement — budget caps', () => {
  it('allows when no caps configured', () => {
    const v = evaluateEnforcement({
      caps: [], quotas: [], counters: ctrs([]), billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('allow');
    expect(v.kind === 'allow' && v.warnings).toEqual([]);
  });

  it('allows when current spend below cap', () => {
    const v = evaluateEnforcement({
      caps: [cap({ limit_usd: 100 })],
      quotas: [],
      counters: ctrs([snap({ spent_usd: 50 })]),
      billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('allow');
  });

  it('rejects with BUDGET_EXCEEDED when current spend ≥ cap', () => {
    const v = evaluateEnforcement({
      caps: [cap({ limit_usd: 100 })],
      quotas: [],
      counters: ctrs([snap({ spent_usd: 100 })]),
      billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('reject');
    if (v.kind === 'reject') {
      expect(v.code).toBe('BUDGET_EXCEEDED');
      expect(v.scope_kind).toBe('tenant');
      expect(v.details).toMatchObject({ limit_usd: 100, spent_usd: 100 });
    }
  });

  it('rejects on first-hit when most-specific scope (tenant_feature) tops up first', () => {
    const v = evaluateEnforcement({
      caps: [
        cap({ scope_kind: 'tenant_feature', scope_id: 'tA::feat', limit_usd: 20 }),
        cap({ scope_kind: 'tenant',         scope_id: 'tA',       limit_usd: 1000 }),
      ],
      quotas: [],
      counters: ctrs([
        snap({ scope_kind: 'tenant_feature', scope_id: 'tA::feat', spent_usd: 25 }),
        snap({ scope_kind: 'tenant',         scope_id: 'tA',       spent_usd: 25 }),
      ]),
      billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('reject');
    if (v.kind === 'reject') expect(v.scope_kind).toBe('tenant_feature');
  });

  it('emits warning when spend ≥ warning_pct but < limit', () => {
    const v = evaluateEnforcement({
      caps: [cap({ limit_usd: 100, warning_pct: 80 })],
      quotas: [],
      counters: ctrs([snap({ spent_usd: 85 })]),
      billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('allow');
    if (v.kind === 'allow') {
      expect(v.warnings[0]).toMatch(/^budget_warning:tenant:monthly:85%_of_100/);
    }
  });

  it('tenant_paid_uncapped + billing_mode=tenant_paid → skip cap', () => {
    const v = evaluateEnforcement({
      caps: [cap({ limit_usd: 100, tenant_paid_uncapped: true })],
      quotas: [],
      counters: ctrs([snap({ spent_usd: 999 })]),
      billing_mode_tenant_paid: true,
    });
    expect(v.kind).toBe('allow');
  });

  it('tenant_paid_uncapped=false → still enforced for tenant_paid calls', () => {
    const v = evaluateEnforcement({
      caps: [cap({ limit_usd: 100, tenant_paid_uncapped: false })],
      quotas: [],
      counters: ctrs([snap({ spent_usd: 999 })]),
      billing_mode_tenant_paid: true,
    });
    expect(v.kind).toBe('reject');
  });

  it('hard_cap=false → never rejects even when over', () => {
    const v = evaluateEnforcement({
      caps: [cap({ limit_usd: 100, hard_cap: false })],
      quotas: [],
      counters: ctrs([snap({ spent_usd: 999 })]),
      billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('allow');
  });
});

describe('evaluateEnforcement — quota caps', () => {
  it('rejects on invocation quota', () => {
    const v = evaluateEnforcement({
      caps: [], quotas: [quota({ limit_invocations: 100 })],
      counters: ctrs([snap({ invocations: 100 })]),
      billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('reject');
    if (v.kind === 'reject') expect(v.code).toBe('QUOTA_EXCEEDED');
  });

  it('rejects on token quota', () => {
    const v = evaluateEnforcement({
      caps: [], quotas: [quota({ limit_invocations: null, limit_tokens: 10_000 })],
      counters: ctrs([snap({ tokens: 10_000 })]),
      billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('reject');
    if (v.kind === 'reject') expect(v.details).toMatchObject({ limit_tokens: 10_000, tokens: 10_000 });
  });

  it('allows when below both limits', () => {
    const v = evaluateEnforcement({
      caps: [], quotas: [quota({ limit_invocations: 100, limit_tokens: 1000 })],
      counters: ctrs([snap({ invocations: 50, tokens: 500 })]),
      billing_mode_tenant_paid: false,
    });
    expect(v.kind).toBe('allow');
  });
});

describe('scopeIdFor + scopeOrder', () => {
  it('scopeOrder is most-specific first', () => {
    expect(scopeOrder()).toEqual(['tenant_feature', 'tenant', 'franchisee', 'platform']);
  });

  it('scopeIdFor handles all scope_kinds correctly', () => {
    expect(scopeIdFor('platform', 'tA', 'feat')).toBe('*');
    expect(scopeIdFor('tenant', 'tA', 'feat')).toBe('tA');
    expect(scopeIdFor('tenant_feature', 'tA', 'feat')).toBe('tA::feat');
    expect(scopeIdFor('franchisee', 'tA', 'feat', 'frX')).toBe('frX');
    expect(scopeIdFor('franchisee', 'tA', 'feat')).toBe('');
  });
});

describe('periodStart helper', () => {
  it('daily snaps to UTC midnight', () => {
    const result = periodStart('daily', new Date('2026-06-15T13:45:30Z'));
    expect(result.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('monthly snaps to first-of-month UTC', () => {
    const result = periodStart('monthly', new Date('2026-06-15T13:45:30Z'));
    expect(result.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('weekly snaps to Monday', () => {
    // 2026-06-15 is a Monday (UTC)
    const result = periodStart('weekly', new Date('2026-06-17T13:45:30Z'));
    expect(result.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('weekly handles Sunday correctly', () => {
    // 2026-06-21 is a Sunday; week starts 2026-06-15
    const result = periodStart('weekly', new Date('2026-06-21T23:00:00Z'));
    expect(result.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });
});

describe('in-memory budget store', () => {
  it('loadEnforcementSnapshot picks up matching caps + skips unrelated', async () => {
    const store = buildInMemoryBudgetStore();
    store.setCap(cap({ scope_kind: 'tenant', scope_id: 'tA' }));
    store.setCap(cap({ scope_kind: 'tenant', scope_id: 'OTHER', limit_usd: 5 }));
    const snap1 = await store.loadEnforcementSnapshot({ tenant_id: 'tA', feature: 'feat' });
    expect(snap1.caps).toHaveLength(1);
    expect(snap1.caps[0]?.scope_id).toBe('tA');
  });

  it('incrementCounters accumulates within the same period', async () => {
    const store = buildInMemoryBudgetStore();
    store.setCap(cap({ scope_kind: 'tenant', scope_id: 'tA' }));
    const fixedNow = new Date('2026-06-15T12:00:00Z');
    await store.incrementCounters({ tenant_id: 'tA', feature: 'feat', spent_usd: 1.5, invocations: 1, tokens: 100, now: fixedNow });
    await store.incrementCounters({ tenant_id: 'tA', feature: 'feat', spent_usd: 2.5, invocations: 1, tokens: 200, now: fixedNow });
    const snaps = store.listCounters();
    const tenantSnap = snaps.find((s) => s.scope_kind === 'tenant' && s.scope_id === 'tA' && s.period_kind === 'monthly');
    expect(tenantSnap?.spent_usd).toBe(4);
    expect(tenantSnap?.invocations).toBe(2);
    expect(tenantSnap?.tokens).toBe(300);
  });

  it('incrementCounters resets when crossing into a new period', async () => {
    const store = buildInMemoryBudgetStore();
    store.setCap(cap({ scope_kind: 'tenant', scope_id: 'tA', period_kind: 'daily', limit_usd: 100 }));
    await store.incrementCounters({ tenant_id: 'tA', feature: 'feat', spent_usd: 5, invocations: 1, tokens: 100, now: new Date('2026-06-15T12:00:00Z') });
    await store.incrementCounters({ tenant_id: 'tA', feature: 'feat', spent_usd: 7, invocations: 1, tokens: 200, now: new Date('2026-06-16T12:00:00Z') });
    const dailySnap = store.listCounters().find((s) => s.period_kind === 'daily');
    // After the second day's increment, the in-memory store replaced
    // the prior day's snapshot (period_started_at moved forward).
    expect(dailySnap?.spent_usd).toBe(7);
  });
});
