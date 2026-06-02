// P3.2 — prompts wired into /v1/invoke. End-to-end through the echo
// provider so we can verify the rendered_body reached the provider.

import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  setAuthLookupForTesting,
  setInvocationWriterForTesting,
  setInvokePromptStoreForTesting,
  setPolicyLookupForTesting,
  setResolverStoresForTesting,
} from '../src/routes/invoke.js';
import { setPromptStoreForTesting } from '../src/routes/prompts.js';
import { buildInMemoryStoresFromObject } from '../src/resolver/inMemoryStores.js';
import { buildInMemoryPromptStore, type PromptStore } from '../src/prompts/store.js';
import { DEFAULT_STRICT_POLICY } from '../src/pii/types.js';

let promptStore: PromptStore;

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

  // Share one in-memory prompt store between the prompts routes (for
  // setup via /v1/admin/prompts) and the invoke pipeline (for lookups).
  promptStore = buildInMemoryPromptStore();
  setPromptStoreForTesting(promptStore);
  setInvokePromptStoreForTesting(promptStore);

  // Seed a prompt the invoke flow will resolve.
  await promptStore.upsert({
    key: 'compliance.screening.hit_reasoning',
    module: 'compliance',
    feature: 'screening.hit_reasoning',
    body: 'Evaluate {{party.name}} ({{party.country}}). subject_id={{subject_id}}.',
  });
});

afterAll(() => {
  setResolverStoresForTesting(null);
  setAuthLookupForTesting(null);
  setInvocationWriterForTesting(null);
  setPolicyLookupForTesting(null);
  setPromptStoreForTesting(null);
  setInvokePromptStoreForTesting(null);
});

const app = createApp();
const tenant_id = '00000000-0000-4000-8000-000000000001';

describe('P3.2 — prompt store wired into /v1/invoke', () => {
  it('renders registered prompt and passes it to the provider', async () => {
    const res = await request(app).post('/v1/invoke').send({
      tenant_id,
      module: 'compliance',
      feature: 'screening.hit_reasoning',
      prompt_key: 'compliance.screening.hit_reasoning',
      variables: { party: { name: 'ACME', country: 'US' }, subject_id: 'party-1' },
    });
    expect(res.status).toBe(200);

    const echo = (res.body.output as {
      echo: {
        rendered_body: string | null;
        prompt_version_id: string | null;
        prompt_version_number: number | null;
      };
    }).echo;

    expect(echo.rendered_body).toBe('Evaluate ACME (US). subject_id=party-1.');
    expect(echo.prompt_version_id).toBeTruthy();
    expect(echo.prompt_version_number).toBe(1);

    // No `prompt_not_registered_*` warning
    const warnings = (res.body.warnings as string[] | undefined) ?? [];
    expect(warnings.some((w) => w.startsWith('prompt_not_registered'))).toBe(false);
  });

  it('falls back to scaffold + adds warning when prompt is not registered', async () => {
    const res = await request(app).post('/v1/invoke').send({
      tenant_id,
      module: 'unknown',
      feature: 'unknown',
      prompt_key: 'unknown.prompt.key',
      variables: { foo: 'bar' },
    });
    expect(res.status).toBe(200);

    const echo = (res.body.output as { echo: { rendered_body: string | null } }).echo;
    expect(echo.rendered_body).toBeNull();

    const warnings = (res.body.warnings as string[] | undefined) ?? [];
    expect(warnings).toContain('prompt_not_registered_using_scaffold');
  });

  it('surfaces missing-variable paths as a warning (not a hard error)', async () => {
    const res = await request(app).post('/v1/invoke').send({
      tenant_id,
      module: 'compliance',
      feature: 'screening.hit_reasoning',
      prompt_key: 'compliance.screening.hit_reasoning',
      variables: { party: { name: 'ACME' } }, // country + subject_id missing
    });
    expect(res.status).toBe(200);

    const warnings = (res.body.warnings as string[] | undefined) ?? [];
    const missing = warnings.find((w) => w.startsWith('prompt_missing_variables:'));
    expect(missing).toBeTruthy();
    expect(missing).toMatch(/party\.country/);
    expect(missing).toMatch(/subject_id/);
  });

  it('uses per-provider body variant when available', async () => {
    await promptStore.upsert({
      key: 'mod.with_variant',
      module: 'mod',
      feature: 'with_variant',
      body: 'canonical: {{x}}',
      body_variants: { echo: 'echo-tuned: {{x}}' },
    });

    const res = await request(app).post('/v1/invoke').send({
      tenant_id,
      module: 'mod',
      feature: 'with_variant',
      prompt_key: 'mod.with_variant',
      variables: { x: 'hello' },
    });
    expect(res.status).toBe(200);
    const echo = (res.body.output as { echo: { rendered_body: string | null } }).echo;
    expect(echo.rendered_body).toBe('echo-tuned: hello');
  });

  it('still works with PII redaction in front (rendered body sees redacted vars)', async () => {
    await promptStore.upsert({
      key: 'mod.pii_aware',
      module: 'mod',
      feature: 'pii_aware',
      body: 'contact={{contact}}',
    });
    const res = await request(app).post('/v1/invoke').send({
      tenant_id,
      module: 'mod',
      feature: 'pii_aware',
      prompt_key: 'mod.pii_aware',
      variables: { contact: 'alice@example.com' },
    });
    expect(res.status).toBe(200);
    const echo = (res.body.output as { echo: { rendered_body: string | null } }).echo;
    // Redactor ran first; the rendered body should never expose the email.
    expect(echo.rendered_body).toMatch(/^contact=<PII:EMAIL_1>$/);
    expect(echo.rendered_body).not.toMatch(/alice@example\.com/);
  });
});
