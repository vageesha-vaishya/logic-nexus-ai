import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('compliance UI UX separation', () => {
  it('implements compliance-owned case, decision, escalation, document, timeline, and evidence surfaces', () => {
    const workspaceSurface = read('src/features/module-compliance/components/ComplianceOwnedWorkspace.tsx');
    expect(workspaceSurface).toContain('data-compliance-owned-surface="screening-cases"');
    expect(workspaceSurface).toContain('data-compliance-owned-surface="policy-decision-review"');
    expect(workspaceSurface).toContain('data-compliance-owned-surface="escalation-workbench"');
    expect(workspaceSurface).toContain('data-compliance-owned-surface="document-obligation-tracking"');
    expect(workspaceSurface).toContain('data-compliance-owned-surface="risk-timeline"');
    expect(workspaceSurface).toContain('data-compliance-owned-surface="evidence-trail"');
  });

  it('enforces compliance adjudication ownership and upstream read-only contract consumption', () => {
    const workspaceSurface = read('src/features/module-compliance/components/ComplianceOwnedWorkspace.tsx');
    const hookContent = read('src/features/module-compliance/hooks/useComplianceWorkspaceState.ts');
    const contractContent = read('src/features/module-compliance/components/ComplianceStatusBadgeContract.tsx');
    expect(workspaceSurface).toContain('data-compliance-boundary="adjudication-owned"');
    expect(workspaceSurface).toContain('data-compliance-boundary="upstream-readonly-contracts"');
    expect(hookContent).toContain('canAdjudicateSelectedCase');
    expect(contractContent).toContain('data-compliance-contract="readonly-status-summary"');
  });

  it('keeps evidence links signed and exposes policy version, rule trace, escalation state, and acknowledgment flow', () => {
    const workspaceSurface = read('src/features/module-compliance/components/ComplianceOwnedWorkspace.tsx');
    const modelContent = read('src/features/module-compliance/workspace/complianceWorkspaceModel.ts');
    expect(workspaceSurface).toContain('data-evidence-signed-reference={artifact.signedReference}');
    expect(workspaceSurface).toContain('Policy Version');
    expect(workspaceSurface).toContain('Rule Trace');
    expect(workspaceSurface).toContain('Escalation State');
    expect(workspaceSurface).toContain('Acknowledge Alert');
    expect(modelContent).toContain('acknowledgeObligationAlert');
    expect(modelContent).toContain('isSignedEvidenceReference');
  });
});
