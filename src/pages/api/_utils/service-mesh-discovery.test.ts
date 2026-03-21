import { beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateMeshTrafficControl,
  getMeshCoverageSummary,
  resetServiceMeshDiscoveryState,
  setNamespaceOnboardingState,
  upsertServiceMeshProfile,
} from './service-mesh-discovery';

describe('service mesh discovery', () => {
  beforeEach(() => {
    resetServiceMeshDiscoveryState();
  });

  it('enforces mesh control after namespace full onboarding', () => {
    setNamespaceOnboardingState({ namespace: 'tenant-core', stage: 'full', onboardedPercent: 100 });
    const decision = evaluateMeshTrafficControl({
      callerService: 'module-crm',
      targetService: 'module-quotation',
      tenantId: 'tenant-1',
    });
    expect(decision.controlledByMesh).toBe(true);
    expect(decision.reason).toBe('mesh_controlled');
    expect(decision.retryEnforced).toBe(true);
    expect(decision.timeoutEnforced).toBe(true);
  });

  it('supports per-service bypass while preserving tls controls', () => {
    setNamespaceOnboardingState({ namespace: 'tenant-core', stage: 'full', onboardedPercent: 100 });
    upsertServiceMeshProfile({ serviceName: 'module-crm', meshMode: 'bypass', tlsMode: 'tls' });
    const decision = evaluateMeshTrafficControl({
      callerService: 'module-crm',
      targetService: 'module-logistics',
      tenantId: 'tenant-1',
    });
    expect(decision.controlledByMesh).toBe(false);
    expect(decision.reason).toBe('service_bypass');
    expect(decision.tlsPreserved).toBe(true);
  });

  it('reports full mesh coverage once all services and namespace are onboarded', () => {
    setNamespaceOnboardingState({ namespace: 'tenant-core', stage: 'full', onboardedPercent: 100 });
    const summary = getMeshCoverageSummary();
    expect(summary.coveragePercent).toBe(100);
    expect(summary.allTrafficUnderMeshControl).toBe(true);
  });
});
