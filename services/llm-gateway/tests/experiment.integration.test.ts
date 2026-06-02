// End-to-end via supertest: register two prompt versions, set an active
// experiment, hit /v1/invoke and verify the chosen variant is reflected
// in the rendered body + audit warnings.

import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  setAuthLookupForTesting,
  setExperimentStoreForTesting,
  setInvocationWriterForTesting,
  setInvokePromptStoreForTesting,
  setPolicyLookupForTesting,
  setResolverStoresForTesting,
} from '../src/routes/invoke.js';
import { setPromptStoreForTesting } from '../src/routes/prompts.js';
import { buildInMemoryStoresFromObject } from '../src/resolver/inMemoryStores.js';
import { buildInMemoryPromptStore, type PromptStore } from '../src/prompts/store.js';
import { buildInMemoryExperimentStore } from '../src/prompts/experimentStore.js';
import { DEFAULT_STRICT_POLICY } from '../src/pii/types.js';
import type { PromptExperiment } from '../src/prompts/experimentTypes.js';

let promptStore: PromptStore;
let experimentStore: ReturnType<typeof buildInMemoryExperimentStore>;
let versionA_id: string;
let versionB_id: string;

beforeAll(async () => {
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
  setPolicyLookupForTesting(async (tenantId: string) => ({
    tenant_id: tenantId,
    ...DEFAULT_STRICT_POLICY,
  }));

  promptStore = buildInMemoryPromptStore();
  setPromptStoreForTesting(promptStore);
  setInvokePromptStoreForTesting(promptStore);

  // Create two versions of the same prompt: A is the canonical "active"
  // version; B is a candidate we'll route experiment traffic to.
  const v1 = await promptStore.upsert({
    key: 'mod.feat',
    module: 'mod',
    feature: 'feat',
    body: 'variant-A: {{x}}',
  });
  versionA_id = v1.version_id;

  // Bump a new version as draft so it's stored but not auto-active
  const v2 = await promptStore.upsert({
    key: 'mod.feat',
    module: 'mod',
    feature: 'feat',
    body: 'variant-B: {{x}}',
    promote_active: false,
  });
  versionB_id = v2.version_id;

  experimentStore = buildInMemoryExperimentStore();
  setExperimentStoreForTesting(experimentStore);
});

afterAll(() => {
  setResolverStoresForTesting(null);
  setAuthLookupForTesting(null);
  setInvocationWriterForTesting(null);
  setPolicyLookupForTesting(null);
  setPromptStoreForTesting(null);
  setInvokePromptStoreForTesting(null);
  setExperimentStoreForTesting(null);
});

beforeEach(() => {
  experimentStore.clear();
});

const app = createApp();
const tenant_id = '00000000-0000-4000-8000-000000000001';

function invokeBody() {
  return {
    tenant_id,
    module: 'mod',
    feature: 'feat',
    prompt_key: 'mod.feat',
    variables: { x: 'hello' },
  };
}

function activeExperiment(traffic_split: number): PromptExperiment {
  return {
    id: 'exp-it-1',
    prompt_key: 'mod.feat',
    variant_a_version_id: versionA_id,
    variant_b_version_id: versionB_id,
    traffic_split,
    status: 'active',
    started_at: new Date().toISOString(),
  };
}

describe('experiment integration via /v1/invoke', () => {
  it('without experiment, uses the canonical active version (variant-A)', async () => {
    const res = await request(app).post('/v1/invoke').send(invokeBody());
    expect(res.status).toBe(200);
    const echo = (res.body.output as { echo: { rendered_body: string | null } }).echo;
    expect(echo.rendered_body).toBe('variant-A: hello');
    const warnings = (res.body.warnings as string[] | undefined) ?? [];
    expect(warnings.some((w) => w.startsWith('experiment:'))).toBe(false);
  });

  it('traffic_split=1.0 routes EVERY call to variant_b', async () => {
    experimentStore.setExperiment(activeExperiment(1.0));
    const res = await request(app).post('/v1/invoke').send(invokeBody());
    expect(res.status).toBe(200);
    const echo = (res.body.output as { echo: { rendered_body: string | null } }).echo;
    expect(echo.rendered_body).toBe('variant-B: hello');

    const warnings = (res.body.warnings as string[] | undefined) ?? [];
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/^experiment:exp-it-1:variant_b:bucket=\d+\/100$/)]),
    );
  });

  it('traffic_split=0.0 always picks variant_a, but still records experiment warning', async () => {
    experimentStore.setExperiment(activeExperiment(0.0));
    const res = await request(app).post('/v1/invoke').send(invokeBody());
    const echo = (res.body.output as { echo: { rendered_body: string | null } }).echo;
    expect(echo.rendered_body).toBe('variant-A: hello');
    const warnings = (res.body.warnings as string[] | undefined) ?? [];
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/^experiment:exp-it-1:variant_a:bucket=\d+\/0$/)]),
    );
  });

  it('traffic_split=0.5 produces roughly even split over 100 calls', async () => {
    experimentStore.setExperiment(activeExperiment(0.5));
    const labels: string[] = [];
    for (let i = 0; i < 100; i += 1) {
      const res = await request(app).post('/v1/invoke').send(invokeBody());
      const warnings = res.body.warnings as string[];
      const expWarning = warnings.find((w) => w.startsWith('experiment:'));
      expect(expWarning).toBeTruthy();
      labels.push(expWarning!.match(/variant_(a|b)/)![1]!);
    }
    const aCount = labels.filter((l) => l === 'a').length;
    const bCount = labels.filter((l) => l === 'b').length;
    // Each call has a random invocation_id (uuid) so picks should be ~50/50.
    // Tolerate 30-70 range to avoid flake.
    expect(aCount + bCount).toBe(100);
    expect(bCount).toBeGreaterThan(30);
    expect(bCount).toBeLessThan(70);
  });

  it('echo provider sees the chosen variant version_id in ctx', async () => {
    experimentStore.setExperiment(activeExperiment(1.0));
    const res = await request(app).post('/v1/invoke').send(invokeBody());
    const echo = (res.body.output as { echo: { prompt_version_id: string | null } }).echo;
    expect(echo.prompt_version_id).toBe(versionB_id);
  });
});
