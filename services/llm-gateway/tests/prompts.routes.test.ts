// Route-level tests: GET /v1/prompts/:key + POST /v1/prompts/:key/render +
// POST /v1/admin/prompts. Uses the in-memory prompt store via the
// test escape hatch.

import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildInMemoryPromptStore, type PromptStore } from '../src/prompts/store.js';
import { setPromptStoreForTesting } from '../src/routes/prompts.js';
import { setAuthLookupForTesting } from '../src/routes/invoke.js';

let store: PromptStore;

beforeAll(async () => {
  // Open auth so we can test scopes via the route only. Auth tests
  // already cover the enforcement matrix in tests/auth.test.ts.
  setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
  store = buildInMemoryPromptStore();
  setPromptStoreForTesting(store);
  // Seed one prompt
  await store.upsert({
    key: 'compliance.screening.hit_reasoning',
    module: 'compliance',
    feature: 'screening.hit_reasoning',
    body: 'Evaluate {{party.name}} ({{party.country}}) against {{hits | length}} hits.',
    description: 'Screening hit reasoning prompt',
  });
});

afterAll(() => {
  setAuthLookupForTesting(null);
  setPromptStoreForTesting(null);
});

const app = createApp();

describe('GET /v1/prompts/:key', () => {
  it('returns active version', async () => {
    const res = await request(app).get('/v1/prompts/compliance.screening.hit_reasoning');
    expect(res.status).toBe(200);
    expect(res.body.prompt.key).toBe('compliance.screening.hit_reasoning');
    expect(res.body.active_version.status).toBe('active');
    expect(res.body.active_version.version_number).toBe(1);
    expect(res.body.active_version.body).toMatch(/{{party.name}}/);
  });

  it('returns 404 PROMPT_NOT_FOUND for unknown key', async () => {
    const res = await request(app).get('/v1/prompts/does.not.exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROMPT_NOT_FOUND');
  });
});

describe('POST /v1/prompts/:key/render', () => {
  it('renders template with variables', async () => {
    const res = await request(app)
      .post('/v1/prompts/compliance.screening.hit_reasoning/render')
      .send({ variables: { party: { name: 'ACME', country: 'US' }, hits: [1, 2, 3] } });
    expect(res.status).toBe(200);
    // Our renderer doesn't support filters; `hits | length` becomes empty since
    // path "hits | length" doesn't resolve. The point of this test is to verify
    // wiring + applied_paths, not filter syntax.
    expect(res.body.rendered).toMatch(/ACME/);
    expect(res.body.rendered).toMatch(/US/);
    expect(res.body.applied_paths).toEqual(expect.arrayContaining(['party.name', 'party.country']));
    expect(res.body.version_number).toBe(1);
  });

  it('reports missing_paths when variables incomplete', async () => {
    const res = await request(app)
      .post('/v1/prompts/compliance.screening.hit_reasoning/render')
      .send({ variables: { party: { name: 'ACME' } } });
    expect(res.status).toBe(200);
    expect(res.body.missing_paths).toContain('party.country');
  });

  it('returns 400 when variables is not an object', async () => {
    const res = await request(app)
      .post('/v1/prompts/compliance.screening.hit_reasoning/render')
      .send({ variables: 'not-an-object' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 404 for unknown key', async () => {
    const res = await request(app)
      .post('/v1/prompts/no.such.key/render')
      .send({ variables: {} });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROMPT_NOT_FOUND');
  });

  it('uses provider variant when provider_kind supplied', async () => {
    // Bump a new version with a provider-specific variant
    await store.upsert({
      key: 'compliance.screening.hit_reasoning',
      module: 'compliance',
      feature: 'screening.hit_reasoning',
      body: 'canonical: {{party.name}}',
      body_variants: { anthropic: 'anthropic-tuned: {{party.name}}' },
    });
    const res = await request(app)
      .post('/v1/prompts/compliance.screening.hit_reasoning/render')
      .send({ variables: { party: { name: 'ACME' } }, provider_kind: 'anthropic' });
    expect(res.body.rendered).toBe('anthropic-tuned: ACME');
    expect(res.body.provider_kind).toBe('anthropic');
  });
});

describe('POST /v1/admin/prompts', () => {
  it('creates a new prompt + first version (201)', async () => {
    const res = await request(app)
      .post('/v1/admin/prompts')
      .send({
        key: 'sales.lead.score',
        module: 'sales',
        feature: 'lead.score',
        body: 'Score {{lead.name}} on a 1-10 scale.',
        description: 'lead scoring prompt',
      });
    expect(res.status).toBe(201);
    expect(res.body.version_number).toBe(1);
    expect(res.body.version_id).toBeTruthy();
  });

  it('rejects when required fields missing', async () => {
    const res = await request(app)
      .post('/v1/admin/prompts')
      .send({ key: 'incomplete' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.details?.missing).toEqual(
      expect.arrayContaining(['module', 'feature', 'body']),
    );
  });

  it('bumps version on existing key', async () => {
    await request(app)
      .post('/v1/admin/prompts')
      .send({ key: 'sales.lead.score', module: 'sales', feature: 'lead.score', body: 'v2 body' });
    const res = await request(app)
      .post('/v1/admin/prompts')
      .send({ key: 'sales.lead.score', module: 'sales', feature: 'lead.score', body: 'v3 body' });
    expect(res.status).toBe(201);
    expect(res.body.version_number).toBeGreaterThanOrEqual(3);
  });
});
