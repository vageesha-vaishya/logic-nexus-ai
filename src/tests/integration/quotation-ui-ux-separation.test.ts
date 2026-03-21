import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('quotation UI UX separation', () => {
  it('implements quotation owned surfaces for compose compare versions workflow and jobs', () => {
    const workspaceSurface = read('src/features/module-quotation/components/QuotationOwnedWorkspace.tsx');
    expect(workspaceSurface).toContain('data-quotation-owned-surface="quote-composer"');
    expect(workspaceSurface).toContain('data-quotation-owned-surface="option-comparison"');
    expect(workspaceSurface).toContain('data-quotation-owned-surface="version-history"');
    expect(workspaceSurface).toContain('data-quotation-owned-surface="approval-acceptance"');
    expect(workspaceSurface).toContain('data-quotation-owned-surface="document-import-export"');
  });

  it('enforces plugin microkernel contracts and module-side validation ownership', () => {
    const workspaceSurface = read('src/features/module-quotation/components/QuotationOwnedWorkspace.tsx');
    const hookContent = read('src/features/module-quotation/hooks/useQuotationWorkspaceState.ts');
    const modelContent = read('src/features/module-quotation/workspace/quotationWorkspaceModel.ts');
    expect(hookContent).toContain('PluginRegistry.getFormConfigByDomain');
    expect(hookContent).toContain('validatePluginFormBlocks');
    expect(modelContent).toContain('validatePluginFormBlocks');
    expect(workspaceSurface).toContain('data-quotation-owned-surface="plugin-form-blocks"');
    expect(workspaceSurface).toContain('contract="quotation.route.projection.v1"');
    expect(workspaceSurface).toContain('contract="quotation.compliance.projection.v1"');
  });

  it('separates immutable snapshots from current draft and gates acceptance action', () => {
    const workspaceSurface = read('src/features/module-quotation/components/QuotationOwnedWorkspace.tsx');
    const modelContent = read('src/features/module-quotation/workspace/quotationWorkspaceModel.ts');
    expect(workspaceSurface).toContain('data-snapshot-marker={version.snapshotType === \'immutable_snapshot\' ? \'immutable\' : \'draft\'}');
    expect(workspaceSurface).toContain('Finalize Acceptance');
    expect(modelContent).toContain('canFinalizeAcceptance');
  });
});
