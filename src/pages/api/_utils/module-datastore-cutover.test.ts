import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDatastoreReplayArtifact,
  enforceModuleWriteBoundary,
  evaluateControlledReadPath,
  getDatastoreCutoverStatus,
  resetModuleDatastoreCutoverState,
  setDatastoreFallbackProfile,
} from './module-datastore-cutover';

describe('module datastore cutover', () => {
  beforeEach(() => {
    resetModuleDatastoreCutoverState();
  });

  it('enforces module-owned write boundaries', () => {
    const allowed = enforceModuleWriteBoundary({
      moduleKey: 'module-crm',
      tableName: 'crm_leads',
      actor: 'module-crm-service',
    });
    const blocked = enforceModuleWriteBoundary({
      moduleKey: 'module-crm',
      tableName: 'finance_invoices',
      actor: 'module-crm-service',
    });
    expect(allowed.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('cross_module_blocked');
  });

  it('supports controlled read fallback via compatibility profile', () => {
    setDatastoreFallbackProfile({
      enabled: true,
      reason: 'read inconsistency mitigation',
      strictAuditLogging: true,
      modules: ['module-crm'],
    });
    const decision = evaluateControlledReadPath({ moduleKey: 'module-crm', maxAuthoritativeLagMs: 1000 });
    expect(decision.mode).toBe('compatibility_view');
    expect(decision.reason).toBe('fallback_profile');
    expect(decision.replayRequired).toBe(true);
  });

  it('creates replay artifacts and reports enforcement readiness', () => {
    const artifact = createDatastoreReplayArtifact({
      moduleKey: 'module-crm',
      viewName: 'compat.crm_leads_vw',
    });
    expect(artifact.replayId).toBeTruthy();
    const status = getDatastoreCutoverStatus();
    expect(status.writeBoundaryEnforced).toBe(true);
    expect(status.modulesFullyHardened).toBeGreaterThan(0);
  });
});
