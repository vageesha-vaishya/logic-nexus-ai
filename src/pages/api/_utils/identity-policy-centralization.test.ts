import { describe, expect, it, beforeEach } from 'vitest';
import {
  evaluateCentralPolicyDecision,
  getPolicyCentralizationStatus,
  introspectServiceToken,
  resetIdentityPolicyCentralizationState,
  setPolicyBypassProfile,
  setPolicyRolloutState,
} from './identity-policy-centralization';

function activeToken(subject = 'module-crm') {
  const now = Math.floor(Date.now() / 1000);
  return `svc:${subject}:platform-identity-access:tenant-1:fr-1:${now - 10}:${now + 600}:svc.call,policy.evaluate`;
}

describe('identity policy centralization', () => {
  beforeEach(() => {
    resetIdentityPolicyCentralizationState();
  });

  it('introspects active service token', () => {
    const result = introspectServiceToken(activeToken());
    expect(result.active).toBe(true);
    expect(result.subject).toBe('module-crm');
    expect(result.reason).toBe('active');
  });

  it('authorizes policy rule when rollout is full', () => {
    setPolicyRolloutState({ stage: 'full' });
    const decision = evaluateCentralPolicyDecision({
      callerService: 'module-crm',
      targetService: 'module-quotation',
      action: 'publish',
      resource: 'crm.opportunity.converted',
      token: activeToken('module-crm'),
      tenantId: 'tenant-1',
      franchiseId: 'fr-1',
    });
    expect(decision.authorized).toBe(true);
    expect(decision.reason).toBe('policy_allowed');
    expect(decision.enforcedByCentralPolicy).toBe(true);
  });

  it('enables bypass profile with strict audit requirement', () => {
    setPolicyRolloutState({ stage: 'full' });
    setPolicyBypassProfile({
      enabled: true,
      reason: 'temporary outage',
      strictAuditLogging: true,
    });
    const decision = evaluateCentralPolicyDecision({
      callerService: 'module-crm',
      targetService: 'module-finance',
      action: 'write',
      resource: 'invoice.create',
      token: activeToken('module-crm'),
      tenantId: 'tenant-1',
    });
    expect(decision.authorized).toBe(true);
    expect(decision.reason).toBe('policy_bypass_profile');
    expect(decision.strictAuditRequired).toBe(true);
  });

  it('returns centralization readiness status', () => {
    setPolicyRolloutState({ stage: 'full' });
    const status = getPolicyCentralizationStatus();
    expect(status.centralPolicyFullyEnforced).toBe(true);
    expect(status.ruleCount).toBeGreaterThan(0);
  });
});
