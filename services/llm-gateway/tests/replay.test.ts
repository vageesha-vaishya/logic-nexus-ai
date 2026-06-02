import request from 'supertest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createApp } from '../src/app.js';
import { setResolverStoresForTesting } from '../src/routes/invoke.js';
import { buildInMemoryStoresFromObject } from '../src/resolver/inMemoryStores.js';

let fixturesDir: string;

beforeAll(() => {
  fixturesDir = mkdtempSync(join(tmpdir(), 'llm-gateway-fixtures-'));
  process.env.LLM_GATEWAY_FIXTURES_DIR = fixturesDir;

  writeFileSync(
    join(fixturesDir, 'compliance.screening.hit_reasoning.json'),
    JSON.stringify({
      output: { verdict: 'false_positive', confidence: 0.92, reasoning: 'fixture' },
      model_used: 'claude-opus-4-7',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      cost_usd: 0.005,
    }),
  );
  writeFileSync(
    join(fixturesDir, '_default.json'),
    JSON.stringify({ output: { kind: 'default' }, usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
  );

  // Resolver returns replay for every call in this test.
  setResolverStoresForTesting(
    buildInMemoryStoresFromObject({
      provider_configs: [
        {
          scope_kind: 'platform_default',
          scope_id: '*',
          provider_kind: 'replay',
          model_id: 'replay-v1',
          is_pin: false,
          billing_mode: 'platform_paid',
        },
      ],
      provider_models: [
        { provider_kind: 'replay', model_id: 'replay-v1', capabilities: ['json_mode', 'tools', 'vision'] },
      ],
      egress_policy: [
        { provider_kind: 'replay', allowed_regions: ['us-east', 'eu-central', 'in-south'] },
      ],
    }),
  );
});

afterAll(() => {
  setResolverStoresForTesting(null);
  delete process.env.LLM_GATEWAY_FIXTURES_DIR;
  rmSync(fixturesDir, { recursive: true, force: true });
});

const app = createApp();

const validBody = {
  tenant_id: '00000000-0000-4000-8000-000000000001',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME', country: 'US' } },
};

describe('replay provider via resolver', () => {
  it('serves the prompt-keyed fixture', async () => {
    const res = await request(app).post('/v1/invoke').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.provider_kind).toBe('replay');
    expect(res.body.model_used).toBe('claude-opus-4-7');
    expect(res.body.output).toMatchObject({ verdict: 'false_positive' });
    expect(res.body.usage).toEqual({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 });
    expect(res.body.cost_usd).toBe(0.005);
    expect(res.body.warnings).toContain('replay_provider_used');
  });

  it('falls back to _default.json for unknown prompt keys', async () => {
    const res = await request(app)
      .post('/v1/invoke')
      .send({ ...validBody, prompt_key: 'unknown.prompt.key' });
    expect(res.status).toBe(200);
    expect(res.body.output).toMatchObject({ kind: 'default' });
  });
});
