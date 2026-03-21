import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyCompatibilityResponseHeaders,
  getCompatibilityTransitionTelemetrySnapshot,
  resetCompatibilityTransitionTelemetry,
  resolveGatewayCompatibility,
} from './compatibility-facade';
import type { ApiRequest, ApiResponse } from './types';

function buildRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    query: {},
    headers: {},
    ...overrides,
  };
}

type ReplayCase = {
  id: string;
  request: ApiRequest;
  context?: { tenantId?: string; franchiseId?: string };
};

function replayCompatibility(cases: ReplayCase[]): Record<string, string> {
  return cases.reduce<Record<string, string>>((acc, entry) => {
    const decision = resolveGatewayCompatibility(entry.request, entry.context || {});
    acc[entry.id] = `${decision.apiVersion}:${decision.compatMode}`;
    return acc;
  }, {});
}

describe('compatibility facade policy', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    resetCompatibilityTransitionTelemetry();
    vi.restoreAllMocks();
  });

  it('defaults to v1-pass when request does not ask for v2', () => {
    const decision = resolveGatewayCompatibility(buildRequest());
    expect(decision).toEqual({
      apiVersion: 'v1',
      compatMode: 'v1-pass',
    });
    const telemetry = getCompatibilityTransitionTelemetrySnapshot();
    expect(telemetry[0]).toEqual(
      expect.objectContaining({
        tenantId: null,
        franchiseId: null,
        reason: 'policy_resolution',
        from: { apiVersion: 'v1', compatMode: 'v1-pass' },
        to: { apiVersion: 'v1', compatMode: 'v1-pass' },
        count: 1,
      })
    );
  });

  it('resolves v2-shadow when shadow flag is enabled', () => {
    process.env.GATEWAY_V2_SHADOW_READ = 'true';
    const decision = resolveGatewayCompatibility(buildRequest({
      headers: { 'x-api-version': 'v2' },
    }));
    expect(decision).toEqual({
      apiVersion: 'v2',
      compatMode: 'v2-shadow',
    });
  });

  it('resolves v2-primary when tenant is in primary rollout list', () => {
    process.env.GATEWAY_V2_PRIMARY_TENANTS = 'tenant-alpha,tenant-bravo';
    const decision = resolveGatewayCompatibility(
      buildRequest({ headers: { 'x-api-version': 'v2' } }),
      { tenantId: 'tenant-bravo' }
    );
    expect(decision).toEqual({
      apiVersion: 'v2',
      compatMode: 'v2-primary',
    });
  });

  it('falls back to v1-pass for v2 requests when rollout flags are off', () => {
    const decision = resolveGatewayCompatibility(buildRequest({
      headers: { 'x-api-version': 'v2' },
    }));
    expect(decision).toEqual({
      apiVersion: 'v2',
      compatMode: 'v1-pass',
    });
  });

  it('forces global rollback to legacy handlers when revert toggle is enabled', () => {
    process.env.GATEWAY_ROUTE_GLOBAL_REVERT_TO_V1 = 'true';
    process.env.GATEWAY_V2_PRIMARY_ENABLED = 'true';
    process.env.GATEWAY_V2_SHADOW_READ = 'true';
    const decision = resolveGatewayCompatibility(
      buildRequest({ headers: { 'x-api-version': 'v2' } }),
      { tenantId: 'tenant-priority' }
    );
    expect(decision).toEqual({
      apiVersion: 'v1',
      compatMode: 'v1-pass',
    });
    const rollbackTelemetry = getCompatibilityTransitionTelemetrySnapshot().find(
      (item) => item.reason === 'global_revert_toggle'
    );
    expect(rollbackTelemetry).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-priority',
        franchiseId: null,
        from: { apiVersion: 'v2', compatMode: 'v2-primary' },
        to: { apiVersion: 'v1', compatMode: 'v1-pass' },
        count: 1,
      })
    );
  });
});

describe('compatibility facade headers', () => {
  it('writes correlation, version, and compatibility headers', () => {
    const setHeader = vi.fn();
    const res: ApiResponse = {
      setHeader,
      status: vi.fn() as any,
    };
    applyCompatibilityResponseHeaders(
      res,
      { apiVersion: 'v2', compatMode: 'v2-shadow' },
      'corr-1'
    );

    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'corr-1');
    expect(setHeader).toHaveBeenCalledWith('x-api-version', 'v2');
    expect(setHeader).toHaveBeenCalledWith('x-compat-mode', 'v2-shadow');
  });
});

describe('compatibility facade replay diff', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    resetCompatibilityTransitionTelemetry();
    vi.restoreAllMocks();
  });

  it('keeps primary precedence when replay routes match both primary and shadow cohorts', () => {
    process.env.GATEWAY_V2_PRIMARY_TENANTS = 'tenant-priority';
    process.env.GATEWAY_V2_SHADOW_TENANTS = 'tenant-priority,tenant-shadow';
    process.env.GATEWAY_V2_SHADOW_READ = 'true';

    const replayCases: ReplayCase[] = [
      {
        id: 'lead-list-primary-shadow-overlap',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-priority' },
      },
      {
        id: 'domain-list-primary-shadow-overlap',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-priority', franchiseId: 'fr-1' },
      },
      {
        id: 'shadow-only-route',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-shadow' },
      },
    ];

    const replay = replayCompatibility(replayCases);

    expect(replay['lead-list-primary-shadow-overlap']).toBe('v2:v2-primary');
    expect(replay['domain-list-primary-shadow-overlap']).toBe('v2:v2-primary');
    expect(replay['shadow-only-route']).toBe('v2:v2-shadow');
  });

  it('produces scoped replay diffs when promoting one tenant from shadow to primary', () => {
    const replayCases: ReplayCase[] = [
      {
        id: 'tenant-a-leads',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-a' },
      },
      {
        id: 'tenant-b-leads',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-b' },
      },
      {
        id: 'tenant-c-leads',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-c' },
      },
    ];

    process.env.GATEWAY_V2_SHADOW_TENANTS = 'tenant-a,tenant-b';
    const baselineReplay = replayCompatibility(replayCases);

    process.env.GATEWAY_V2_PRIMARY_TENANTS = 'tenant-a';
    process.env.GATEWAY_V2_SHADOW_TENANTS = 'tenant-b';
    const promotedReplay = replayCompatibility(replayCases);

    expect(baselineReplay).toEqual({
      'tenant-a-leads': 'v2:v2-shadow',
      'tenant-b-leads': 'v2:v2-shadow',
      'tenant-c-leads': 'v2:v1-pass',
    });
    expect(promotedReplay).toEqual({
      'tenant-a-leads': 'v2:v2-primary',
      'tenant-b-leads': 'v2:v2-shadow',
      'tenant-c-leads': 'v2:v1-pass',
    });
  });

  it('replays full rollback to v1-pass when global revert toggle is activated', () => {
    const replayCases: ReplayCase[] = [
      {
        id: 'tenant-a-leads',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-a' },
      },
      {
        id: 'tenant-b-leads',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-b' },
      },
      {
        id: 'tenant-c-leads',
        request: buildRequest({ headers: { 'x-api-version': 'v2' } }),
        context: { tenantId: 'tenant-c' },
      },
    ];

    process.env.GATEWAY_V2_PRIMARY_TENANTS = 'tenant-a';
    process.env.GATEWAY_V2_SHADOW_TENANTS = 'tenant-b';
    const baselineReplay = replayCompatibility(replayCases);

    process.env.GATEWAY_ROUTE_GLOBAL_REVERT_TO_V1 = 'true';
    const rollbackReplay = replayCompatibility(replayCases);

    expect(baselineReplay).toEqual({
      'tenant-a-leads': 'v2:v2-primary',
      'tenant-b-leads': 'v2:v2-shadow',
      'tenant-c-leads': 'v2:v1-pass',
    });
    expect(rollbackReplay).toEqual({
      'tenant-a-leads': 'v1:v1-pass',
      'tenant-b-leads': 'v1:v1-pass',
      'tenant-c-leads': 'v1:v1-pass',
    });

    const rollbackTelemetry = getCompatibilityTransitionTelemetrySnapshot()
      .filter((item) => item.reason === 'global_revert_toggle')
      .reduce((sum, item) => sum + item.count, 0);
    expect(rollbackTelemetry).toBe(3);
  });
});
