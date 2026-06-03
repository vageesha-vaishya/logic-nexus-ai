// Admin list endpoints — read-only views over the gateway DB.
// In dev (no Supabase env vars) the endpoints must still respond with
// `{ items: [], note: ... }` instead of 500-ing, so the admin UI in
// preview/local environments still renders.

import { jest } from '@jest/globals';
import request from 'supertest';

const { createApp } = await import('../src/app.js');
const { setAuthLookupForTesting } = await import('../src/routes/invoke.js');
const { setAdminListClientForTesting } = await import('../src/routes/adminLists.js');

describe('admin list endpoints (no DB configured)', () => {
  const app = createApp();

  beforeAll(() => {
    setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
    setAdminListClientForTesting(null);
    // Force-clear env so getClient() returns null.
    delete process.env.LLM_GATEWAY_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
  });
  afterAll(() => {
    setAuthLookupForTesting(null);
  });

  it('GET /v1/admin/prompts returns empty items + note when DB unconfigured', async () => {
    const res = await request(app).get('/v1/admin/prompts');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(typeof res.body.note).toBe('string');
  });

  it('GET /v1/admin/experiments returns empty items + note', async () => {
    const res = await request(app).get('/v1/admin/experiments');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('GET /v1/admin/audit returns empty items + note', async () => {
    const res = await request(app).get('/v1/admin/audit?prompt_key=foo&status=succeeded&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('GET /v1/admin/budget-status returns empty items + note', async () => {
    const res = await request(app).get('/v1/admin/budget-status');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});

describe('admin list endpoints (mocked client)', () => {
  const app = createApp();

  // Minimal Supabase-client fake: from(table).select().order().limit() returns a
  // thenable that resolves to { data, error }. Each test rebuilds the fake to
  // return different shapes per table.
  function makeFakeClient(tables: Record<string, unknown[]>) {
    const builder = (tableName: string) => {
      const rows = tables[tableName] ?? [];
      const chain: Record<string, unknown> = {};
      const proxy: Record<string, (...a: unknown[]) => unknown> = new Proxy(chain, {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
              resolve({ data: rows, error: null });
          }
          return () => proxy;
        },
      }) as unknown as Record<string, (...a: unknown[]) => unknown>;
      return proxy;
    };
    return { from: jest.fn(builder) } as unknown as Parameters<typeof setAdminListClientForTesting>[0];
  }

  beforeAll(() => {
    setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
  });
  afterAll(() => {
    setAuthLookupForTesting(null);
    setAdminListClientForTesting(null);
  });

  it('GET /v1/admin/prompts shapes rows + counts versions per key', async () => {
    setAdminListClientForTesting(makeFakeClient({
      prompts: [
        {
          key: 'compliance.screening.hit_reasoning',
          module: 'compliance', feature: 'screening.hit_reasoning',
          description: 'demo', active_version_id: 'v-1',
          updated_at: '2026-06-02T00:00:00Z',
          default_capability: 'reasoning-medium', safety_class: 'restricted',
        },
        {
          key: 'comms.inbound.classify',
          module: 'comms', feature: 'inbound.classify',
          description: null, active_version_id: 'v-2',
          updated_at: '2026-06-01T00:00:00Z',
          default_capability: 'chat-fast', safety_class: 'standard',
        },
      ],
      prompt_versions: [
        { prompt_key: 'compliance.screening.hit_reasoning' },
        { prompt_key: 'compliance.screening.hit_reasoning' },
        { prompt_key: 'comms.inbound.classify' },
      ],
    }));
    const res = await request(app).get('/v1/admin/prompts');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const compl = res.body.items.find((i: { key: string }) => i.key === 'compliance.screening.hit_reasoning');
    expect(compl.total_versions).toBe(2);
    expect(compl.safety_class).toBe('restricted');
    const comms = res.body.items.find((i: { key: string }) => i.key === 'comms.inbound.classify');
    expect(comms.total_versions).toBe(1);
  });

  it('GET /v1/admin/audit echoes the row set the client returns', async () => {
    setAdminListClientForTesting(makeFakeClient({
      invocation_audit: [
        { id: 'a1', ts: 't', prompt_key: 'p', status: 'succeeded', cost_usd: 0.0012 },
        { id: 'a2', ts: 't2', prompt_key: 'p', status: 'failed', error_code: 'PROVIDER_UNAVAILABLE' },
      ],
    }));
    const res = await request(app).get('/v1/admin/audit?prompt_key=p&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[1].error_code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('GET /v1/admin/budget-status joins caps + counters and computes utilization', async () => {
    setAdminListClientForTesting(makeFakeClient({
      budget_caps: [
        // 80% spent, warning_pct 75 → status 'warning'
        { scope_kind: 'tenant', scope_id: 'tenant-A', period_kind: 'daily',
          limit_usd: 10, warning_pct: 75, hard_cap: true, tenant_paid_uncapped: false },
        // 100% spent → status 'exceeded'
        { scope_kind: 'tenant', scope_id: 'tenant-B', period_kind: 'daily',
          limit_usd: 5, warning_pct: 80, hard_cap: true, tenant_paid_uncapped: false },
        // 0% spent → status 'ok'
        { scope_kind: 'tenant', scope_id: 'tenant-C', period_kind: 'monthly',
          limit_usd: 200, warning_pct: 80, hard_cap: false, tenant_paid_uncapped: false },
      ],
      budget_counters: [
        { scope_kind: 'tenant', scope_id: 'tenant-A', period_kind: 'daily',
          period_started_at: '2026-06-03T00:00:00Z', spent_usd: 8,
          invocations: 40, tokens: 12000, updated_at: '2026-06-03T03:00:00Z' },
        { scope_kind: 'tenant', scope_id: 'tenant-B', period_kind: 'daily',
          period_started_at: '2026-06-03T00:00:00Z', spent_usd: 5,
          invocations: 25, tokens: 7000, updated_at: '2026-06-03T03:00:00Z' },
      ],
    }));
    const res = await request(app).get('/v1/admin/budget-status');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0]).toMatchObject({ scope_id: 'tenant-B', utilization_pct: 100, status: 'exceeded' });
    expect(res.body.items[1]).toMatchObject({ scope_id: 'tenant-A', utilization_pct: 80, status: 'warning' });
    expect(res.body.items[2]).toMatchObject({ scope_id: 'tenant-C', utilization_pct: 0, status: 'ok' });
  });

  it('GET /v1/admin/experiments shapes rows including verdict when present', async () => {
    setAdminListClientForTesting(makeFakeClient({
      prompt_experiments: [
        {
          id: 'e1', prompt_key: 'p', status: 'active', traffic_split: 0.5,
          variant_a_version_id: 'va', variant_b_version_id: 'vb',
          started_at: '2026-06-01T00:00:00Z', evaluated_at: null,
          verdict: null, sample_size: 240,
        },
      ],
    }));
    const res = await request(app).get('/v1/admin/experiments');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].traffic_split).toBe(0.5);
    expect(res.body.items[0].sample_size).toBe(240);
  });
});
