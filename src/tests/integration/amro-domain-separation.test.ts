import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('amro domain separation strategy', () => {
  it('preserves base UI shell and layers AMRO enhancements additively', () => {
    const hubPage = read('src/features/module-amro/pages/AmroHubVerticalPage.tsx');
    expect(hubPage).toContain('DashboardLayout');
    expect(hubPage).toContain('data-amro-uiux="base-preserved"');
    expect(hubPage).toContain('Open AMRO Domain Workspace Enhancements');
    expect(hubPage).toContain('data-amro-base-surface="operations-overview"');
  });

  it('implements all AMRO-owned bounded-context capability surfaces', () => {
    const workspaceSurface = read('src/features/module-amro/components/AmroOwnedWorkspace.tsx');
    expect(workspaceSurface).toContain('data-amro-owned-surface="asset-registry-configuration-state"');
    expect(workspaceSurface).toContain('data-amro-owned-surface="work-package-task-lifecycle-orchestration"');
    expect(workspaceSurface).toContain('data-amro-owned-surface="qualification-authority-validation"');
    expect(workspaceSurface).toContain('data-amro-owned-surface="compliance-evidence-controls"');
    expect(workspaceSurface).toContain('data-amro-owned-surface="materials-repair-loop-orchestration"');
    expect(workspaceSurface).toContain('data-amro-owned-surface="predictive-maintenance-digital-twin"');
  });

  it('enforces AMRO boundaries for hierarchy, sign-off, and immutable evidence', () => {
    const workspaceSurface = read('src/features/module-amro/components/AmroOwnedWorkspace.tsx');
    expect(workspaceSurface).toContain('data-amro-boundary="tenant-franchise-isolation"');
    expect(workspaceSurface).toContain('data-amro-boundary="signoff-authority-control"');
    expect(workspaceSurface).toContain('data-amro-boundary="immutable-evidence-chain"');
  });

  it('contains bounded-context lifecycle and capability model rules', () => {
    const modelContent = read('src/features/module-amro/workspace/amroWorkspaceModel.ts');
    expect(modelContent).toContain("'create' | 'plan' | 'schedule' | 'execute' | 'close'");
    expect(modelContent).toContain('canTransitionWorkPackageLifecycle');
    expect(modelContent).toContain('canPerformAuthoritySignOff');
    expect(modelContent).toContain('buildComplianceCoverage');
    expect(modelContent).toContain('buildMaterialsPlanningSummary');
    expect(modelContent).toContain('buildPredictiveMaintenanceSummary');
  });
});
