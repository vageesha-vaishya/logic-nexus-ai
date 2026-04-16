import { describe, expect, it, beforeEach } from 'vitest';
import type { ApiRequest } from '../../../../_utils/types';
import {
  enforceMobileSecurityHeaders,
  evaluateMobileThreatSignals,
  issueMobileSessionBinding,
  resetMobileSecurityTestState,
  rotateMobileSessionNonce,
  validateMobileSessionBinding,
} from './shared';

function buildRequest(headers: Record<string, string>): ApiRequest {
  return {
    method: 'POST',
    query: {},
    headers,
    body: {},
  };
}

describe('amro mobile security shared', () => {
  beforeEach(() => {
    resetMobileSecurityTestState();
  });

  it('accepts valid mobile security headers', () => {
    const req = buildRequest({
      'x-amro-mobile-platform': 'ios',
      'x-tls-version': '1.3',
      'x-amro-cert-pinning': 'strict',
      'x-amro-app-version': '2.4.1',
      'x-amro-app-build': '24101',
      'x-amro-device-id': 'device-001',
      'x-amro-attestation-provider': 'app_attest',
      'x-amro-attestation-token': 'abcdefghijklmnopqrstuvwxyz1234',
    });
    const context = enforceMobileSecurityHeaders(req);
    expect(context.platform).toBe('ios');
    expect(context.certificatePinningMode).toBe('strict');
  });

  it('blocks weak TLS and missing pinning', () => {
    const req = buildRequest({
      'x-amro-mobile-platform': 'android',
      'x-tls-version': '1.2',
      'x-amro-cert-pinning': 'report_only',
      'x-amro-app-version': '2.4.1',
      'x-amro-app-build': '24101',
      'x-amro-device-id': 'device-001',
      'x-amro-attestation-provider': 'play_integrity',
      'x-amro-attestation-token': 'abcdefghijklmnopqrstuvwxyz1234',
    });
    expect(() => enforceMobileSecurityHeaders(req)).toThrow(/Mobile TLS policy violation/);
  });

  it('assesses threat posture and blocks high risk', () => {
    const req = buildRequest({
      'x-amro-emulator': 'true',
      'x-amro-rooted-device': 'true',
      'x-amro-debugger-attached': 'true',
    });
    const result = evaluateMobileThreatSignals(req);
    expect(result.decision).toBe('block');
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('issues and validates mobile session binding with nonce rotation', () => {
    const binding = issueMobileSessionBinding({
      userId: 'user-1',
      tenantId: 'tenant-1',
      platform: 'ios',
      rawDeviceId: 'device-xyz',
      biometricStrength: 'strong',
    });
    const validated = validateMobileSessionBinding({
      bindingId: binding.bindingId,
      userId: 'user-1',
      rawDeviceId: 'device-xyz',
    });
    expect(validated.bindingId).toBe(binding.bindingId);
    const previousNonce = binding.sessionNonce;
    const rotated = rotateMobileSessionNonce({
      bindingId: binding.bindingId,
      expectedNonce: previousNonce,
    });
    expect(rotated.sessionNonce).not.toBe(previousNonce);
  });
});
