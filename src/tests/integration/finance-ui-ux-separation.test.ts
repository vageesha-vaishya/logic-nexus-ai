import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('finance UI UX separation', () => {
  it('implements finance-owned invoice, tax, journal, reconciliation, and analytics surfaces', () => {
    const workspaceSurface = read('src/features/module-finance/components/FinanceOwnedWorkspace.tsx');
    expect(workspaceSurface).toContain('data-finance-owned-surface="invoice-lifecycle"');
    expect(workspaceSurface).toContain('data-finance-owned-surface="tax-breakdown"');
    expect(workspaceSurface).toContain('data-finance-owned-surface="journal-review"');
    expect(workspaceSurface).toContain('data-finance-owned-surface="reconciliation-dashboard"');
    expect(workspaceSurface).toContain('data-finance-owned-surface="margin-receivables-analytics"');
  });

  it('enforces finance mutation boundaries and linked cross-module references', () => {
    const workspaceSurface = read('src/features/module-finance/components/FinanceOwnedWorkspace.tsx');
    const hookContent = read('src/features/module-finance/hooks/useFinanceWorkspaceState.ts');
    const modelContent = read('src/features/module-finance/workspace/financeWorkspaceModel.ts');
    expect(workspaceSurface).toContain('data-finance-boundary="mutation-role-guard"');
    expect(workspaceSurface).toContain('data-finance-boundary="cross-module-links"');
    expect(hookContent).toContain("hasPermission('admin.settings.manage')");
    expect(modelContent).toContain('canRunFinanceMutation');
  });

  it('locks committed tax and ledger records and exposes compensating workflows', () => {
    const workspaceSurface = read('src/features/module-finance/components/FinanceOwnedWorkspace.tsx');
    const modelContent = read('src/features/module-finance/workspace/financeWorkspaceModel.ts');
    expect(workspaceSurface).toContain('data-immutable-record={line.committed ? \'locked\' : \'editable\'}');
    expect(workspaceSurface).toContain('Open Compensating Workflow');
    expect(workspaceSurface).toContain('data-discrepancy-pointer={item.sourcePointer}');
    expect(modelContent).toContain('getCompensatingWorkflowPath');
  });
});
