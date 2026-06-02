import request from 'supertest';
import { createApp } from '../src/app.js';
import { echoEmbedProvider } from '../src/embeddings/echo.js';
import { setAuthLookupForTesting } from '../src/routes/invoke.js';

const app = createApp();

beforeAll(() => {
  setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
});
afterAll(() => {
  setAuthLookupForTesting(null);
});

describe('echo embeddings provider — pure', () => {
  it('produces deterministic vectors of fixed dimension', async () => {
    const r1 = await echoEmbedProvider.embed(
      { tenant_id: 't', inputs: ['hello world'] },
      { invocation_id: 'i', model_id: 'echo-embed-v1', started_at: 0, request_id: 'r' },
    );
    const r2 = await echoEmbedProvider.embed(
      { tenant_id: 't', inputs: ['hello world'] },
      { invocation_id: 'i', model_id: 'echo-embed-v1', started_at: 0, request_id: 'r' },
    );
    expect(r1.embeddings).toEqual(r2.embeddings);
    expect(r1.embeddings).toHaveLength(1);
    expect(r1.embeddings[0]).toHaveLength(256);
  });

  it('different inputs produce different vectors', async () => {
    const r = await echoEmbedProvider.embed(
      { tenant_id: 't', inputs: ['alpha', 'beta'] },
      { invocation_id: 'i', model_id: 'echo-embed-v1', started_at: 0, request_id: 'r' },
    );
    expect(r.embeddings).toHaveLength(2);
    expect(r.embeddings[0]).not.toEqual(r.embeddings[1]);
  });

  it('all vector values are in [-1, 1]', async () => {
    const r = await echoEmbedProvider.embed(
      { tenant_id: 't', inputs: ['x'] },
      { invocation_id: 'i', model_id: 'echo-embed-v1', started_at: 0, request_id: 'r' },
    );
    for (const v of r.embeddings[0]!) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('POST /v1/embed — route validation', () => {
  it('400 when tenant_id missing', async () => {
    const res = await request(app).post('/v1/embed').send({ inputs: ['x'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('400 when inputs missing', async () => {
    const res = await request(app).post('/v1/embed').send({ tenant_id: 't' });
    expect(res.status).toBe(400);
  });

  it('400 when inputs empty array', async () => {
    const res = await request(app).post('/v1/embed').send({ tenant_id: 't', inputs: [] });
    expect(res.status).toBe(400);
  });

  it('400 when inputs exceeds MAX_INPUTS', async () => {
    const big = Array.from({ length: 300 }, (_, i) => `t-${i}`);
    const res = await request(app).post('/v1/embed').send({ tenant_id: 't', inputs: big });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toMatchObject({ max: 256 });
  });

  it('400 when an input is not a string', async () => {
    const res = await request(app).post('/v1/embed').send({ tenant_id: 't', inputs: [{ x: 1 }] });
    expect(res.status).toBe(400);
  });

  it('400 when an input exceeds MAX_INPUT_BYTES', async () => {
    const huge = 'x'.repeat(40_000);
    const res = await request(app).post('/v1/embed').send({ tenant_id: 't', inputs: [huge] });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toMatchObject({ index: 0 });
  });
});

describe('POST /v1/embed — happy path (defaults to openai provider)', () => {
  it('PROVIDER_NOT_CONFIGURED:openai when no OPENAI_API_KEY (route default)', async () => {
    // The route defaults to openai; with no key set the provider throws.
    // We surface it as 500 with INTERNAL since there's no resolver
    // mapping yet for embed. This documents current behavior — a future
    // slice would adopt the same cascade as /v1/invoke.
    delete process.env.OPENAI_API_KEY;
    const res = await request(app)
      .post('/v1/embed')
      .send({ tenant_id: 't', inputs: ['x'] });
    expect(res.status).toBe(500);
    expect(res.body.error.message).toMatch(/PROVIDER_NOT_CONFIGURED:openai/);
  });
});
