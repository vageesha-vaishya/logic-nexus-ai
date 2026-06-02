// End-to-end via supertest: configure budget store with caps + a
// near-limit counter, hit /v1/invoke, verify behavior.

import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  setAuthLookupForTesting,
  setBudgetStoreForTesting,
  setInvocationWriterForTesting,
  setInvokePromptStoreForTesting,
  setPolicyLookupForTesting,
  setResolverStoresForTesting,
} from '../src/routes/invoke.js';
import { buildInMemoryStoresFromObject } from '../src/resolver/inMemoryStores.js';
import { buildInMemoryBudgetStore } from '../src/budgets/store.js';
import { DEFAULT_STRICT_POLICY } from '../src/pii/types.js';

let budgetStore: ReturnType<typeof buildInMemoryBudgetStore>;

beforeAll(() => {
  setResolverStoresForTesting(
    buildInMemoryStoresFromObject({
      provider_configs: [
        { scope_kind: 'platform_default', scope_id: '*', provider_kind: 'echo',
          model_id: 'echo-v1', is_pin: false, billing_mode: 'platform_paid' },
      ],
      provider_models: [{ provider_kind: 'echo', model_id: 'echo-v1', capabilities: ['json_mode'] }],
      egress_policy: [{ provider_kind: 'echo', allowed_regions: ['us-east'] }],
    }),
  );
  setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
  setInvocationWriterForTesting(() => undefined);
  setInvokePromptStoreForTesting(null);
  setPolicyLookupForTesting(async (tenantId) => ({ tenant_id: tenantId, ...DEFAULT_STRICT_POLICY }));

  budgetStore = buildInMemoryBudgetStore();
  setBudgetStoreForTesting(budgetStore);
});

afterAll(() => {
  setResolverStoresForTesting(null);
  setAuthLookupForTesting(null);
  setInvocationWriterForTesting(null);
  setPolicyLookupForTesting(null);
  setBudgetStoreForTesting(null);
});

beforeEach(() => budgetStore.clear());

const app = createApp();

const validBody = () => ({
  tenant_id: '00000000-0000-4000-8000-000000000001',
  module: 'mod',
  feature: 'feat',
  prompt_key: 'mod.feat',
  variables: {},
});

describe('budgets integration via /v1/invoke', () => {
  it('200 when no caps configured (legacy behavior)', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody());
    expect(res.status).toBe(200);
    const warnings = (res.body.warnings as string[] | undefined) ?? [];
    expect(warnings.some((w) => w.startsWith('budget_warning'))).toBe(false);
  });

  it('429 BUDGET_EXCEEDED when tenant has hit cap', async () => {
    budgetStore.setCap({
      scope_kind: 'tenant',
      scope_id: '00000000-0000-4000-8000-000000000001',
      period_kind: 'monthly',
      limit_usd: 10,
      warning_pct: 80,
      hard_cap: true,
      tenant_paid_uncapped: false,
    });
    budgetStore.setCounter({
      scope_kind: 'tenant',
      scope_id: '00000000-0000-4000-8000-000000000001',
      period_kind: 'monthly',
      period_started_at: new Date().toISOString(),
      spent_usd: 10,
      invocations: 100,
      tokens: 1000,
    });
    const res = await request(app).post('/v1/invoke').send(validBody());
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('BUDGET_EXCEEDED');
    expect(res.body.error.details).toMatchObject({
      scope_kind: 'tenant',
      period_kind: 'monthly',
      limit_usd: 10,
      spent_usd: 10,
    });
  });

  it('200 + budget_warning when ≥ warning_pct utilization', async () => {
    budgetStore.setCap({
      scope_kind: 'tenant',
      scope_id: '00000000-0000-4000-8000-000000000001',
      period_kind: 'monthly',
      limit_usd: 10,
      warning_pct: 80,
      hard_cap: true,
      tenant_paid_uncapped: false,
    });
    budgetStore.setCounter({
      scope_kind: 'tenant',
      scope_id: '00000000-0000-4000-8000-000000000001',
      period_kind: 'monthly',
      period_started_at: new Date().toISOString(),
      spent_usd: 8,
      invocations: 80,
      tokens: 800,
    });
    const res = await request(app).post('/v1/invoke').send(validBody());
    expect(res.status).toBe(200);
    const warnings = (res.body.warnings as string[] | undefined) ?? [];
    expect(warnings.some((w) => w.startsWith('budget_warning:tenant:monthly:'))).toBe(true);
  });

  it('429 QUOTA_EXCEEDED on invocation quota', async () => {
    budgetStore.setQuota({
      scope_kind: 'tenant',
      scope_id: '00000000-0000-4000-8000-000000000001',
      period_kind: 'monthly',
      limit_invocations: 100,
      limit_tokens: null,
      hard_cap: true,
    });
    budgetStore.setCounter({
      scope_kind: 'tenant',
      scope_id: '00000000-0000-4000-8000-000000000001',
      period_kind: 'monthly',
      period_started_at: new Date().toISOString(),
      spent_usd: 0,
      invocations: 100,
      tokens: 0,
    });
    const res = await request(app).post('/v1/invoke').send(validBody());
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
  });

  it('most-specific cap (tenant_feature) hit first', async () => {
    budgetStore.setCap({
      scope_kind: 'tenant_feature',
      scope_id: '00000000-0000-4000-8000-000000000001::feat',
      period_kind: 'monthly',
      limit_usd: 1,
      warning_pct: 80,
      hard_cap: true,
      tenant_paid_uncapped: false,
    });
    budgetStore.setCap({
      scope_kind: 'tenant',
      scope_id: '00000000-0000-4000-8000-000000000001',
      period_kind: 'monthly',
      limit_usd: 10_000,
      warning_pct: 80,
      hard_cap: true,
      tenant_paid_uncapped: false,
    });
    budgetStore.setCounter({
      scope_kind: 'tenant_feature',
      scope_id: '00000000-0000-4000-8000-000000000001::feat',
      period_kind: 'monthly',
      period_started_at: new Date().toISOString(),
      spent_usd: 2,
      invocations: 1,
      tokens: 10,
    });
    const res = await request(app).post('/v1/invoke').send(validBody());
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('BUDGET_EXCEEDED');
    expect(res.body.error.details).toMatchObject({ scope_kind: 'tenant_feature' });
  });

  it('counter increments after a successful invoke', async () => {
    budgetStore.setCap({
      scope_kind: 'tenant',
      scope_id: '00000000-0000-4000-8000-000000000001',
      period_kind: 'monthly',
      limit_usd: 1000,
      warning_pct: 80,
      hard_cap: true,
      tenant_paid_uncapped: false,
    });
    const res = await request(app).post('/v1/invoke').send(validBody());
    expect(res.status).toBe(200);
    // Increment is fire-and-forget; with the sync in-memory store it
    // should already be visible on the next tick.
    await new Promise((r) => setTimeout(r, 10));
    const counters = budgetStore.listCounters();
    const tenantSnap = counters.find(
      (c) => c.scope_kind === 'tenant' && c.scope_id === '00000000-0000-4000-8000-000000000001' && c.period_kind === 'monthly',
    );
    expect(tenantSnap?.invocations).toBe(1);
    expect(tenantSnap?.tokens).toBeGreaterThan(0);
  });
});
