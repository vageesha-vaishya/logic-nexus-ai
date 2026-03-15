import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('CRM module navigation workflow consistency', () => {
  it('uses unified header navigation in all CRM modules', () => {
    const modulesUsingModuleState = [
      'src/pages/dashboard/Accounts.tsx',
      'src/pages/dashboard/Contacts.tsx',
      'src/pages/dashboard/Opportunities.tsx',
      'src/pages/dashboard/Activities.tsx',
      'src/pages/dashboard/Quotes.tsx',
    ];

    const leadsContent = read('src/pages/dashboard/Leads.tsx');
    const leadsPipelineContent = read('src/pages/dashboard/LeadsPipeline.tsx');
    expect(leadsContent).toContain('CRMModuleHeaderNavigation');
    expect(leadsContent).toContain('useLeadsViewState');
    expect(leadsPipelineContent).toContain('CRMModuleHeaderNavigation');
    expect(leadsPipelineContent).toContain('createLabel="New Lead"');

    modulesUsingModuleState.forEach((modulePath) => {
      const content = read(modulePath);
      expect(content).toContain('CRMModuleHeaderNavigation');
      expect(content).toContain('useCRMModuleNavigationState');
      expect(content).toContain("theme: 'Azure Sky'");
    });
  });

  it('keeps Azure Sky as persisted default theme', () => {
    const moduleStateHook = read('src/hooks/useCRMModuleNavigationState.ts');
    const leadsStateHook = read('src/hooks/useLeadsViewState.tsx');
    const leadsPage = read('src/pages/dashboard/Leads.tsx');
    expect(moduleStateHook).toContain("const DEFAULT_THEME = 'Azure Sky'");
    expect(leadsStateHook).toContain("const DEFAULT_THEME = 'Azure Sky'");
    expect(leadsStateHook).toContain("view: 'pipeline'");
    expect(leadsPage).toContain('createLabel="New Lead"');
  });

  it('enforces unified header control ordering contract', () => {
    const headerComponent = read('src/components/crm/CRMModuleHeaderNavigation.tsx');
    const orderedSegments = [
      'VIEW_MODE_SEQUENCE.map',
      '{toLabel(mode)}',
      '{createLabel}',
      'Refresh',
      'Import/Export',
      '<Select value={theme} onValueChange={onThemeChange}>',
    ];
    let cursor = -1;
    orderedSegments.forEach((segment) => {
      const next = headerComponent.indexOf(segment, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    });
    expect(headerComponent).not.toContain('Set as Default');
  });

  it('registers activities and opportunities import export routes', () => {
    const appContent = read('src/App.tsx');
    expect(appContent).toContain('/dashboard/activities/import-export');
    expect(appContent).toContain('/dashboard/opportunities/import-export');
  });
});
