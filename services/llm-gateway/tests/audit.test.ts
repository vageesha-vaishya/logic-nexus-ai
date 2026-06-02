import request from 'supertest';
import { createApp } from '../src/app.js';
import { setInvocationWriterForTesting, setResolverStoresForTesting } from '../src/routes/invoke.js';
import { buildInMemoryStoresFromObject } from '../src/resolver/inMemoryStores.js';
import { buildAuditPayload, type InvocationAuditPayload } from '../src/audit/invocationWriter.js';

const validBody = {
  tenant_id: '00000000-0000-4000-8000-000000000001',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME', country: 'US' } },
  subject: { type: 'party', id: 'party-1' },
};

describe('buildAuditPayload — pure shape', () => {
  it('flattens InvokeRequest + ResolvedProvider + result into a payload', () => {
    const payload = buildAuditPayload({
      invocation_id: 'inv-1',
      request_id: 'req-1',
      request: validBody,
      resolved: {
        resolved_scope_kind: 'tenant',
        resolved_scope_id: 'tenant-A',
        provider_kind: 'anthropic',
        model_id: 'claude-opus-4-7',
        billing_mode: 'platform_paid',
        is_pin: false,
      },
      usage: { prompt_tokens: 412, completion_tokens: 87, total_tokens: 499 },
      cost_usd: 0.012705,
      latency_ms: 432,
      warnings: ['echo_provider_used'],
    });
    expect(payload).toMatchObject({
      id: 'inv-1',
      request_id: 'req-1',
      tenant_id: validBody.tenant_id,
      prompt_key: validBody.prompt_key,
      module: 'compliance',
      feature: 'screening.hit_reasoning',
      subject_type: 'party',
      subject_id: 'party-1',
      resolved_scope_kind: 'tenant',
      resolved_scope_id: 'tenant-A',
      provider_kind: 'anthropic',
      model_id: 'claude-opus-4-7',
      billing_mode: 'platform_paid',
      fallback_used: false,
      cache_hit: false,
      prompt_tokens: 412,
      completion_tokens: 87,
      total_tokens: 499,
      provider_cost_usd: 0.012705,
      billed_cost_usd: 0.012705,
      latency_ms: 432,
      warnings: ['echo_provider_used'],
      parent_invocation_id: null,
      trace_id: null,
    });
  });

  it('omits subject when not provided', () => {
    const { subject: _omit, ...rest } = validBody;
    void _omit;
    const payload = buildAuditPayload({
      invocation_id: 'i', request_id: 'r',
      request: rest,
      resolved: {
        resolved_scope_kind: 'platform_default', resolved_scope_id: '*',
        provider_kind: 'echo', model_id: 'echo-v1',
        billing_mode: 'platform_paid', is_pin: false,
      },
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      cost_usd: 0,
      latency_ms: 5,
    });
    expect(payload.subject_type).toBeNull();
    expect(payload.subject_id).toBeNull();
  });
});

describe('audit writer integration — fire-and-forget via injected writer', () => {
  const captured: InvocationAuditPayload[] = [];

  beforeAll(() => {
    setResolverStoresForTesting(
      buildInMemoryStoresFromObject({
        provider_configs: [
          { scope_kind: 'platform_default', scope_id: '*', provider_kind: 'echo',
            model_id: 'echo-v1', is_pin: false, billing_mode: 'platform_paid' },
        ],
        provider_models: [
          { provider_kind: 'echo', model_id: 'echo-v1', capabilities: ['json_mode'] },
        ],
        egress_policy: [
          { provider_kind: 'echo', allowed_regions: ['us-east'] },
        ],
      }),
    );
    setInvocationWriterForTesting((payload) => { captured.push(payload); });
  });

  afterAll(() => {
    setResolverStoresForTesting(null);
    setInvocationWriterForTesting(null);
  });

  beforeEach(() => { captured.length = 0; });

  const app = createApp();

  it('records one row per successful invoke', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody);
    expect(res.status).toBe(200);
    // Writer is fire-and-forget but in this test we inject a sync writer,
    // so the row should already be captured by the time the response lands.
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      tenant_id: validBody.tenant_id,
      prompt_key: validBody.prompt_key,
      provider_kind: 'echo',
      model_id: 'echo-v1',
      resolved_scope_kind: 'platform_default',
      resolved_scope_id: '*',
      fallback_used: false,
      cache_hit: false,
    });
    expect(captured[0]?.id).toBe(res.body.invocation_id);
    expect(captured[0]?.request_id).toBe(res.headers['x-correlation-id']);
  });

  it('does NOT record when the request is rejected (400)', async () => {
    const res = await request(app).post('/v1/invoke').send({ tenant_id: validBody.tenant_id });
    expect(res.status).toBe(400);
    expect(captured).toHaveLength(0);
  });

  it('records cost + tokens from the provider result', async () => {
    await request(app).post('/v1/invoke').send(validBody);
    const p = captured[0]!;
    expect(p.total_tokens).toBe(p.prompt_tokens + p.completion_tokens);
    expect(p.provider_cost_usd).toBe(0); // echo is free
    expect(p.billed_cost_usd).toBe(0);
    expect(p.latency_ms).toBeGreaterThanOrEqual(0);
  });
});
