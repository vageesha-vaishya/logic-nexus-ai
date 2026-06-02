import { resolveProvider } from '../src/resolver/cascade.js';
import { ResolverError } from '../src/resolver/errors.js';
import { buildInMemoryStoresFromObject } from '../src/resolver/inMemoryStores.js';
import type { ProviderConfigRecord } from '../src/resolver/types.js';
import type { InvokeRequest } from '../src/types/gateway.types.js';

const baseReq: InvokeRequest = {
  tenant_id: 'tenant-A',
  module: 'compliance',
  feature: 'screening.hit_reasoning',
  prompt_key: 'compliance.screening.hit_reasoning',
  variables: { party: { name: 'ACME', country: 'US' } },
};

const baseConfigs: ProviderConfigRecord[] = [
  {
    scope_kind: 'platform_default',
    scope_id: '*',
    provider_kind: 'echo',
    model_id: 'echo-v1',
    is_pin: false,
    billing_mode: 'platform_paid',
  },
];

function stores(configs: ProviderConfigRecord[], extras: Partial<Parameters<typeof buildInMemoryStoresFromObject>[0]> = {}) {
  return buildInMemoryStoresFromObject({
    provider_configs: configs,
    provider_models: extras.provider_models ?? [
      { provider_kind: 'echo', model_id: 'echo-v1', capabilities: ['json_mode'] },
      { provider_kind: 'replay', model_id: 'replay-v1', capabilities: ['json_mode', 'tools', 'vision'] },
      { provider_kind: 'anthropic', model_id: 'claude-opus-4-7', capabilities: ['tools', 'vision', 'json_mode'] },
      { provider_kind: 'openai', model_id: 'gpt-4o', capabilities: ['tools', 'vision', 'json_mode'] },
    ],
    egress_policy: extras.egress_policy ?? [
      { provider_kind: 'echo', allowed_regions: ['us-east', 'eu-central', 'in-south'] },
      { provider_kind: 'replay', allowed_regions: ['us-east', 'eu-central', 'in-south'] },
      { provider_kind: 'anthropic', allowed_regions: ['us-east'] },
      { provider_kind: 'openai', allowed_regions: ['us-east'] },
    ],
  });
}

describe('cascade resolver — priority', () => {
  it('platform_default wins when no other config is set', async () => {
    const resolved = await resolveProvider(baseReq, {}, stores(baseConfigs));
    expect(resolved.resolved_scope_kind).toBe('platform_default');
    expect(resolved.provider_kind).toBe('echo');
    expect(resolved.model_id).toBe('echo-v1');
  });

  it('tenant override beats platform_default', async () => {
    const cfgs: ProviderConfigRecord[] = [
      ...baseConfigs,
      {
        scope_kind: 'tenant',
        scope_id: 'tenant-A',
        provider_kind: 'anthropic',
        model_id: 'claude-opus-4-7',
        is_pin: false,
        billing_mode: 'platform_paid',
      },
    ];
    const resolved = await resolveProvider(baseReq, {}, stores(cfgs));
    expect(resolved.resolved_scope_kind).toBe('tenant');
    expect(resolved.provider_kind).toBe('anthropic');
  });

  it('feature_pin beats every other scope', async () => {
    const cfgs: ProviderConfigRecord[] = [
      ...baseConfigs,
      {
        scope_kind: 'tenant',
        scope_id: 'tenant-A',
        provider_kind: 'openai',
        model_id: 'gpt-4o',
        is_pin: false,
        billing_mode: 'platform_paid',
      },
      {
        scope_kind: 'feature_pin',
        scope_id: 'compliance.screening.hit_reasoning',
        provider_kind: 'anthropic',
        model_id: 'claude-opus-4-7',
        is_pin: true,
        billing_mode: 'platform_paid',
      },
    ];
    const resolved = await resolveProvider(baseReq, { user_id: 'u-1' }, stores(cfgs));
    expect(resolved.resolved_scope_kind).toBe('feature_pin');
    expect(resolved.provider_kind).toBe('anthropic');
    expect(resolved.is_pin).toBe(true);
  });

  it('user override beats franchisee + tenant + domain', async () => {
    const cfgs: ProviderConfigRecord[] = [
      ...baseConfigs,
      { scope_kind: 'tenant',     scope_id: 'tenant-A',   provider_kind: 'echo',   model_id: 'echo-v1', is_pin: false, billing_mode: 'platform_paid' },
      { scope_kind: 'franchisee', scope_id: 'frch-1',     provider_kind: 'echo',   model_id: 'echo-v1', is_pin: false, billing_mode: 'platform_paid' },
      { scope_kind: 'user',       scope_id: 'u-1',        provider_kind: 'openai', model_id: 'gpt-4o',  is_pin: false, billing_mode: 'platform_paid' },
    ];
    const resolved = await resolveProvider(baseReq, { user_id: 'u-1', franchisee_id: 'frch-1' }, stores(cfgs));
    expect(resolved.resolved_scope_kind).toBe('user');
    expect(resolved.provider_kind).toBe('openai');
  });
});

describe('cascade resolver — is_pin short-circuit', () => {
  it('is_pin=true ignores InvokeOptions.provider_override', async () => {
    const cfgs: ProviderConfigRecord[] = [
      {
        scope_kind: 'feature_pin',
        scope_id: 'compliance.screening.hit_reasoning',
        provider_kind: 'anthropic',
        model_id: 'claude-opus-4-7',
        is_pin: true,
        billing_mode: 'platform_paid',
      },
      ...baseConfigs,
    ];
    const req: InvokeRequest = { ...baseReq, options: { provider_override: 'openai', model_override: 'gpt-4o' } };
    const resolved = await resolveProvider(req, {}, stores(cfgs));
    expect(resolved.provider_kind).toBe('anthropic');
    expect(resolved.model_id).toBe('claude-opus-4-7');
  });

  it('is_pin=false honors InvokeOptions overrides', async () => {
    const cfgs: ProviderConfigRecord[] = [
      {
        scope_kind: 'tenant',
        scope_id: 'tenant-A',
        provider_kind: 'echo',
        model_id: 'echo-v1',
        is_pin: false,
        billing_mode: 'platform_paid',
      },
      ...baseConfigs,
    ];
    const req: InvokeRequest = { ...baseReq, options: { provider_override: 'openai', model_override: 'gpt-4o' } };
    const resolved = await resolveProvider(req, {}, stores(cfgs));
    expect(resolved.provider_kind).toBe('openai');
    expect(resolved.model_id).toBe('gpt-4o');
  });
});

describe('cascade resolver — egress', () => {
  it('rejects EU tenant when provider only allowed in us-east', async () => {
    const cfgs: ProviderConfigRecord[] = [
      {
        scope_kind: 'tenant',
        scope_id: 'tenant-A',
        provider_kind: 'anthropic',
        model_id: 'claude-opus-4-7',
        is_pin: false,
        billing_mode: 'platform_paid',
      },
    ];
    await expect(resolveProvider(baseReq, { tenant_residency: 'eu-central' }, stores(cfgs)))
      .rejects.toMatchObject({ code: 'EGRESS_FORBIDDEN' });
  });

  it('allows when residency is in allowed_regions', async () => {
    const cfgs: ProviderConfigRecord[] = [
      {
        scope_kind: 'tenant',
        scope_id: 'tenant-A',
        provider_kind: 'anthropic',
        model_id: 'claude-opus-4-7',
        is_pin: false,
        billing_mode: 'platform_paid',
      },
    ];
    const resolved = await resolveProvider(baseReq, { tenant_residency: 'us-east' }, stores(cfgs));
    expect(resolved.provider_kind).toBe('anthropic');
  });
});

describe('cascade resolver — capabilities', () => {
  it('rejects when required capability missing from model catalog', async () => {
    const cfgs: ProviderConfigRecord[] = [
      {
        scope_kind: 'tenant',
        scope_id: 'tenant-A',
        provider_kind: 'echo',
        model_id: 'echo-v1',
        is_pin: false,
        billing_mode: 'platform_paid',
        required_capabilities: ['vision'],
      },
    ];
    await expect(resolveProvider(baseReq, {}, stores(cfgs)))
      .rejects.toMatchObject({ code: 'MODEL_CAPABILITY_MISMATCH' });
  });

  it('accepts when all required capabilities supported', async () => {
    const cfgs: ProviderConfigRecord[] = [
      {
        scope_kind: 'tenant',
        scope_id: 'tenant-A',
        provider_kind: 'anthropic',
        model_id: 'claude-opus-4-7',
        is_pin: false,
        billing_mode: 'platform_paid',
        required_capabilities: ['tools', 'vision'],
      },
    ];
    const resolved = await resolveProvider(baseReq, {}, stores(cfgs));
    expect(resolved.provider_kind).toBe('anthropic');
  });

  it('merges per-call required_capabilities with config-level', async () => {
    const cfgs: ProviderConfigRecord[] = [
      {
        scope_kind: 'tenant',
        scope_id: 'tenant-A',
        provider_kind: 'echo',
        model_id: 'echo-v1',
        is_pin: false,
        billing_mode: 'platform_paid',
        required_capabilities: ['json_mode'],
      },
    ];
    // echo lacks 'tools' — per-call request should bump the requirement and fail
    const req: InvokeRequest = { ...baseReq, required_capabilities: ['tools'] };
    await expect(resolveProvider(req, {}, stores(cfgs)))
      .rejects.toMatchObject({ code: 'MODEL_CAPABILITY_MISMATCH' });
  });
});

describe('cascade resolver — no config', () => {
  it('throws PROVIDER_NOT_CONFIGURED when nothing matches', async () => {
    await expect(resolveProvider(baseReq, {}, stores([])))
      .rejects.toBeInstanceOf(ResolverError);
  });
});
