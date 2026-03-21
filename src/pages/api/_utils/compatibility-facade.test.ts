import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from './compatibility-facade';
import type { ApiRequest, ApiResponse } from './types';

function buildRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    query: {},
    headers: {},
    ...overrides,
  };
}

describe('compatibility facade policy', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it('defaults to v1-pass when request does not ask for v2', () => {
    const decision = resolveGatewayCompatibility(buildRequest());
    expect(decision).toEqual({
      apiVersion: 'v1',
      compatMode: 'v1-pass',
    });
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
