import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeGatewayFeatureFlagChecksum,
  getGatewayFeatureFlagConfigSnapshot,
  resetGatewayFeatureFlagConfig,
  resolveGatewayFeatureFlag,
  updateGatewayFeatureFlagConfig,
} from './gateway-feature-flags';

describe('gateway feature flag platform', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    resetGatewayFeatureFlagConfig();
  });

  afterEach(() => {
    process.env = { ...envBackup };
    resetGatewayFeatureFlagConfig();
  });

  it('enables module for matching tenant cohort within rollout percent', () => {
    const current = getGatewayFeatureFlagConfigSnapshot();
    updateGatewayFeatureFlagConfig({
      expectedVersion: current.version,
      expectedChecksum: current.checksum,
      nextVersion: current.version + 1,
      modules: {
        'crm.leads-v2': {
          enabled: true,
          emergencyKillSwitch: false,
          rolloutPercent: 100,
          tenantCohorts: ['tenant-alpha'],
          franchiseCohorts: [],
        },
      },
    });

    const decision = resolveGatewayFeatureFlag({
      moduleKey: 'crm.leads-v2',
      tenantId: 'tenant-alpha',
    });
    expect(decision.enabled).toBe(true);
    expect(decision.reason).toBe('enabled');
  });

  it('supports emergency kill switch rollback per module', () => {
    const current = getGatewayFeatureFlagConfigSnapshot();
    updateGatewayFeatureFlagConfig({
      expectedVersion: current.version,
      expectedChecksum: current.checksum,
      nextVersion: current.version + 1,
      modules: {
        'crm.opportunities-v2': {
          enabled: true,
          emergencyKillSwitch: true,
          rolloutPercent: 100,
          tenantCohorts: [],
          franchiseCohorts: [],
        },
      },
    });

    const decision = resolveGatewayFeatureFlag({
      moduleKey: 'crm.opportunities-v2',
      tenantId: 'tenant-1',
    });
    expect(decision.enabled).toBe(false);
    expect(decision.reason).toBe('module_kill_switch');
  });

  it('rejects stale config by pinned version and checksum', () => {
    const current = getGatewayFeatureFlagConfigSnapshot();
    updateGatewayFeatureFlagConfig({
      expectedVersion: current.version,
      expectedChecksum: current.checksum,
      nextVersion: current.version + 1,
      modules: {
        'gateway.monitoring-baseline': {
          enabled: true,
          emergencyKillSwitch: false,
          rolloutPercent: 100,
          tenantCohorts: [],
          franchiseCohorts: [],
        },
      },
    });

    process.env.GATEWAY_FLAG_CONFIG_PIN_VERSION = String(current.version);
    process.env.GATEWAY_FLAG_CONFIG_PIN_CHECKSUM = 'invalid-checksum';

    const decision = resolveGatewayFeatureFlag({
      moduleKey: 'gateway.monitoring-baseline',
      tenantId: 'tenant-1',
    });
    expect(decision.enabled).toBe(false);
    expect(decision.reason).toBe('stale_config_version');
  });

  it('computes deterministic checksum payload for config updates', () => {
    const current = getGatewayFeatureFlagConfigSnapshot();
    const checksumA = computeGatewayFeatureFlagChecksum({
      version: current.version,
      globalKillSwitch: current.globalKillSwitch,
      modules: current.modules,
      updatedAt: current.updatedAt,
    });
    const checksumB = computeGatewayFeatureFlagChecksum({
      version: current.version,
      globalKillSwitch: current.globalKillSwitch,
      modules: current.modules,
      updatedAt: current.updatedAt,
    });
    expect(checksumA).toBe(checksumB);
    expect(checksumA.length).toBe(64);
  });
});
