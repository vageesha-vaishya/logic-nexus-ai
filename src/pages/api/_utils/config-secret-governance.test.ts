import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedLocalConfigSnapshot,
  detectConfigDrift,
  issueSecretLease,
  resetConfigSecretGovernanceState,
  rotateSecretVersion,
  upsertDynamicConfigBundle,
  verifySignedLocalConfigSnapshot,
} from './config-secret-governance';

describe('config and secret governance', () => {
  beforeEach(() => {
    resetConfigSecretGovernanceState();
  });

  it('upserts dynamic config bundle and signs payload', () => {
    const bundle = upsertDynamicConfigBundle({
      bundleKey: 'mesh-runtime',
      policyTag: 'platform.mesh',
      payload: { retries: 3 },
      pinnedServices: ['platform-service-mesh'],
    });
    expect(bundle.bundleKey).toBe('mesh-runtime');
    expect(bundle.version).toBeGreaterThan(0);
    expect(bundle.signature.length).toBeGreaterThan(20);
  });

  it('leases secret for authorized service and rotates with overlap window', () => {
    const lease = issueSecretLease({
      secretKey: 'jwt-signing-key',
      serviceName: 'platform-identity-access',
      ttlSeconds: 900,
    });
    expect(lease.leaseId).toBeTruthy();
    expect(lease.leaseToken.endsWith('...')).toBe(true);
    const rotated = rotateSecretVersion({
      secretKey: 'jwt-signing-key',
      nextKeyId: 'jwt-key-v2',
      overlapWindowSeconds: 1200,
    });
    expect(rotated.versions.length).toBeGreaterThan(1);
    expect(rotated.versions.some((version) => version.keyId === 'jwt-key-v2')).toBe(true);
  });

  it('creates signed local snapshot and detects drift', () => {
    const snapshot = createSignedLocalConfigSnapshot();
    expect(verifySignedLocalConfigSnapshot(snapshot)).toBe(true);
    upsertDynamicConfigBundle({
      bundleKey: 'gateway-runtime',
      policyTag: 'platform.global',
      payload: { retries: { maxAttempts: 5 } },
      nextVersion: 3,
    });
    const drift = detectConfigDrift(snapshot);
    expect(drift.driftDetected).toBe(true);
    expect(drift.changedBundles).toContain('gateway-runtime');
  });
});
