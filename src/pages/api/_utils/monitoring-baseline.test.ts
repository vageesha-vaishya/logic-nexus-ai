import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateMonitoringBaselinePayload } from './monitoring-baseline';
import { resetCompatibilityTransitionTelemetry, resolveGatewayCompatibility } from './compatibility-facade';
import { resetGatewayFeatureFlagConfig } from './gateway-feature-flags';
import type { ApiRequest } from './types';

function buildRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    query: {},
    headers: {},
    ...overrides,
  };
}

describe('monitoring baseline payload', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    resetCompatibilityTransitionTelemetry();
    resetGatewayFeatureFlagConfig();
  });

  afterEach(() => {
    process.env = { ...envBackup };
    resetCompatibilityTransitionTelemetry();
    resetGatewayFeatureFlagConfig();
  });

  it('returns p95 p99 error budget and alert policies', () => {
    resolveGatewayCompatibility(buildRequest({ headers: { 'x-api-version': 'v2' } }), {
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
    });
    resolveGatewayCompatibility(buildRequest({ headers: { 'x-api-version': 'v2' } }), {
      tenantId: 'tenant-2',
      franchiseId: 'fr-2',
    });

    const payload = generateMonitoringBaselinePayload();
    expect(payload.goldenSignals.latency.p95Ms).toBeGreaterThan(0);
    expect(payload.goldenSignals.latency.p99Ms).toBeGreaterThan(0);
    expect(payload.goldenSignals.errorRate.errorBudgetRemainingPercent).toBeGreaterThanOrEqual(0);
    expect(payload.alerts.policies.length).toBeGreaterThan(0);
    expect(payload.alerts.noisyAlertMitigation.burnRateWindows.length).toBeGreaterThan(0);
  });
});
