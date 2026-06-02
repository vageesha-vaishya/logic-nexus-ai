// Integration: PII redaction wired into POST /v1/invoke via the echo
// provider. Verifies that:
//   - Variables reaching the provider are redacted (we read provider
//     output which echoes the variables back)
//   - Response warnings contain the pii_redacted:* marker
//   - Captured audit payload also has the redacted variables (no PII
//     leaks into gateway.llm_invocations)

import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  setAuthLookupForTesting,
  setInvocationWriterForTesting,
  setPolicyLookupForTesting,
  setResolverStoresForTesting,
} from '../src/routes/invoke.js';
import { buildInMemoryStoresFromObject } from '../src/resolver/inMemoryStores.js';
import type { InvocationAuditPayload } from '../src/audit/invocationWriter.js';
import { DEFAULT_STRICT_POLICY, type TenantPiiPolicy } from '../src/pii/types.js';

const captured: InvocationAuditPayload[] = [];

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
  setInvocationWriterForTesting((p) => { captured.push(p); });
  setAuthLookupForTesting(async () => ({ authenticated: true, open_mode: true }));
});

afterAll(() => {
  setResolverStoresForTesting(null);
  setInvocationWriterForTesting(null);
  setAuthLookupForTesting(null);
  setPolicyLookupForTesting(null);
});

beforeEach(() => {
  captured.length = 0;
});

const app = createApp();

function policyForTest(overrides: Partial<TenantPiiPolicy> = {}): TenantPiiPolicy {
  return { tenant_id: '00000000-0000-4000-8000-000000000001', ...DEFAULT_STRICT_POLICY, ...overrides };
}

describe('PII integration — strict policy (default)', () => {
  it('redacts email + phone in provider input, marks in warnings, leaks nothing to audit', async () => {
    setPolicyLookupForTesting(async () => policyForTest());
    const res = await request(app).post('/v1/invoke').send({
      tenant_id: '00000000-0000-4000-8000-000000000001',
      module: 'compliance',
      feature: 'screening.hit_reasoning',
      prompt_key: 'compliance.screening.hit_reasoning',
      variables: {
        note: 'contact alice@example.com or 415-555-1234',
        nested: { ssn: 'SSN 123-45-6789' },
      },
    });
    expect(res.status).toBe(200);

    // The echo provider includes the variables it saw in its output.
    const echo = (res.body.output as { echo: { variables: { note: string; nested: { ssn: string } } } }).echo;
    expect(echo.variables.note).toMatch(/<PII:EMAIL_1>/);
    expect(echo.variables.note).toMatch(/<PII:PHONE_1>/);
    expect(echo.variables.nested.ssn).toMatch(/<PII:SSN_1>/);
    // No raw plaintext should leak into what the provider saw
    expect(echo.variables.note).not.toMatch(/alice@example\.com/);
    expect(echo.variables.note).not.toMatch(/415-555-1234/);
    expect(echo.variables.nested.ssn).not.toMatch(/123-45-6789/);

    // Warnings list includes pii_redacted:* with the kinds that fired
    expect(res.body.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/^pii_redacted:.*email/)]),
    );

    // Audit payload also got redacted variables (via safeRequest)
    expect(captured).toHaveLength(1);
    expect(captured[0]?.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/^pii_redacted:/)]),
    );
  });

  it('no warnings when there is no PII to redact', async () => {
    setPolicyLookupForTesting(async () => policyForTest());
    const res = await request(app).post('/v1/invoke').send({
      tenant_id: '00000000-0000-4000-8000-000000000001',
      module: 'compliance',
      feature: 'feat',
      prompt_key: 'mod.feat',
      variables: { msg: 'no PII here', count: 5 },
    });
    expect(res.status).toBe(200);
    const warnings = res.body.warnings as string[] | undefined;
    expect((warnings ?? []).some((w) => w.startsWith('pii_redacted:'))).toBe(false);
  });
});

describe('PII integration — moderate policy', () => {
  it('still redacts but adds pii_moderate_mode_used', async () => {
    setPolicyLookupForTesting(async () => policyForTest({ policy_kind: 'moderate' }));
    const res = await request(app).post('/v1/invoke').send({
      tenant_id: '00000000-0000-4000-8000-000000000001',
      module: 'compliance',
      feature: 'feat',
      prompt_key: 'mod.feat',
      variables: { msg: 'alice@example.com' },
    });
    expect(res.status).toBe(200);
    expect(res.body.warnings).toEqual(
      expect.arrayContaining(['pii_moderate_mode_used', expect.stringMatching(/^pii_redacted:.*email/)]),
    );
  });
});

describe('PII integration — pass_through policy', () => {
  it('without consent returns 422 PII_PASS_THROUGH_NOT_CONSENTED', async () => {
    setPolicyLookupForTesting(async () =>
      policyForTest({ policy_kind: 'pass_through', pii_pass_through_consented_at: null }),
    );
    const res = await request(app).post('/v1/invoke').send({
      tenant_id: '00000000-0000-4000-8000-000000000001',
      module: 'compliance',
      feature: 'feat',
      prompt_key: 'mod.feat',
      variables: { msg: 'alice@example.com' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PII_PASS_THROUGH_NOT_CONSENTED');
  });

  it('with consent passes plaintext through unchanged', async () => {
    setPolicyLookupForTesting(async () =>
      policyForTest({
        policy_kind: 'pass_through',
        pii_pass_through_consented_at: '2026-01-01T00:00:00Z',
      }),
    );
    const res = await request(app).post('/v1/invoke').send({
      tenant_id: '00000000-0000-4000-8000-000000000001',
      module: 'compliance',
      feature: 'feat',
      prompt_key: 'mod.feat',
      variables: { msg: 'alice@example.com' },
    });
    expect(res.status).toBe(200);
    const echo = (res.body.output as { echo: { variables: { msg: string } } }).echo;
    expect(echo.variables.msg).toBe('alice@example.com');
    expect(res.body.warnings).toEqual(expect.arrayContaining(['pii_pass_through_consented']));
  });
});
