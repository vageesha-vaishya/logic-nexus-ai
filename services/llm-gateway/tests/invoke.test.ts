import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

const validBody = {
  tenant_id: '00000000-0000-4000-8000-000000000001',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME Corp', country: 'US' } },
};

describe('GET /healthz', () => {
  it('returns ok with provider list', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('llm-gateway');
    expect(res.body.phase).toBe('P0');
    expect(res.body.providers_available).toContain('echo');
  });
});

describe('POST /v1/invoke', () => {
  it('returns echo response for a valid request', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.invocation_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.provider_kind).toBe('echo');
    expect(res.body.cache_hit).toBe(false);
    expect(res.body.cost_usd).toBe(0);
    expect(res.body.usage.total_tokens).toBeGreaterThan(0);
    expect(res.body.scaffold_phase).toBe('P0');
    expect(res.body.output).toMatchObject({
      kind: 'echo',
      prompt_key: validBody.prompt_key,
      tenant_id: validBody.tenant_id,
    });
    expect(res.body.warnings).toContain('echo_provider_used');
  });

  it('returns x-correlation-id header', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody);
    expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-request-id']).toBe(res.headers['x-correlation-id']);
  });

  it('respects incoming x-correlation-id header', async () => {
    const corrId = 'abcd-test-correlation-id-12345';
    const res = await request(app)
      .post('/v1/invoke')
      .set('x-correlation-id', corrId)
      .send(validBody);
    expect(res.headers['x-correlation-id']).toBe(corrId);
  });

  it('rejects missing tenant_id with INVALID_REQUEST', async () => {
    const body = { ...validBody } as Record<string, unknown>;
    delete body.tenant_id;
    const res = await request(app).post('/v1/invoke').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toMatch(/tenant_id/);
    expect(res.body.error.request_id).toBeTruthy();
  });

  it('rejects missing module + feature + prompt_key with collected list', async () => {
    const res = await request(app).post('/v1/invoke').send({ tenant_id: validBody.tenant_id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.details?.missing).toEqual(
      expect.arrayContaining(['module', 'feature', 'prompt_key']),
    );
  });

  it('rejects when variables is not an object', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .send({ ...validBody, variables: 'not-an-object' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toMatch(/variables/);
  });

  it('rejects malformed subject', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .send({ ...validBody, subject: { type: 'party' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('determinism: identical input produces identical token counts', async () => {
    const a = await request(app).post('/v1/invoke').send(validBody);
    const b = await request(app).post('/v1/invoke').send(validBody);
    expect(a.body.usage).toEqual(b.body.usage);
    // invocation_id and latency_ms naturally differ
    expect(a.body.invocation_id).not.toBe(b.body.invocation_id);
  });
});

describe('Error envelope', () => {
  it('500 on unknown provider', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .send({ ...validBody, options: { provider_override: 'openai' } });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(res.body.error.message).toMatch(/PROVIDER_NOT_CONFIGURED/);
  });
});
