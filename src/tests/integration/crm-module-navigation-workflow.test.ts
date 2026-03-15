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
    const leadsWorkspace = read('src/pages/dashboard/Leads.tsx');
    const leadsPipeline = read('src/pages/dashboard/LeadsPipeline.tsx');
    const dashboardLayout = read('src/components/layout/DashboardLayout.tsx');
    const controlOrder = "['pipeline', 'list', 'create', 'card', 'grid', 'refresh', 'analytics', 'importExport', 'theme']";
    expect(leadsWorkspace).toContain(`controlSequence={${controlOrder}}`);
    expect(leadsPipeline).toContain(`controlSequence={${controlOrder}}`);
    expect(dashboardLayout).toContain('overflow-x-hidden');
  });

  it('registers activities and opportunities import export routes', () => {
    const appContent = read('src/App.tsx');
    expect(appContent).toContain('/dashboard/activities/import-export');
    expect(appContent).toContain('/dashboard/opportunities/import-export');
  });

  it('keeps DataTable list rendering contained without horizontal overflow', () => {
    const dataTable = read('src/components/system/DataTable.tsx');
    expect(dataTable).toContain('rounded-md border overflow-hidden [&>div]:overflow-x-hidden');
    expect(dataTable).toContain('<Table className="table-fixed">');
    expect(dataTable).toContain("className={cn('max-w-0 break-words', col.className)}");
  });
});
