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

  it('removes redundant Back to List controls from lead forms and fallback states', () => {
    const leadNew = read('src/pages/dashboard/LeadNew.tsx');
    const leadDetail = read('src/pages/dashboard/LeadDetail.tsx');
    expect(leadNew).not.toContain('ArrowLeft');
    expect(leadDetail).not.toContain('Back to Leads');
  });

  it('hides duplicate Back to List action in leads import export header', () => {
    const dataImportExport = read('src/components/system/DataImportExport.tsx');
    const leadsImportExport = read('src/pages/dashboard/LeadsImportExport.tsx');
    expect(dataImportExport).toContain('showBackToListButton = true');
    expect(leadsImportExport).toContain('showBackToListButton={false}');
  });

  it('removes pipeline Select All and Select None controls from filter row', () => {
    const leadsPipeline = read('src/pages/dashboard/LeadsPipeline.tsx');
    expect(leadsPipeline).not.toContain("t('leads.filters.selectAll', 'Select All')");
    expect(leadsPipeline).not.toContain("t('leads.filters.selectNone', 'Select None')");
    expect(leadsPipeline).not.toContain('handleSelectAllStages');
    expect(leadsPipeline).not.toContain('handleSelectNoStages');
  });

  it('renders visible statuses row only for selected status filters', () => {
    const leadsPipeline = read('src/pages/dashboard/LeadsPipeline.tsx');
    expect(leadsPipeline).toContain('{selectedStages.length > 0 && (');
    expect(leadsPipeline).toContain('{selectedStages.map((stage) => (');
    expect(leadsPipeline).not.toContain('{visibleStages.map((stage) => (');
  });

  it('keeps header global search resilient with module fallback results', () => {
    const globalSearch = read('src/components/ui/global-search.tsx');
    const dashboardLayout = read('src/components/layout/DashboardLayout.tsx');
    expect(globalSearch).toContain('Promise.allSettled');
    expect(globalSearch).toContain('APP_MENU.flatMap');
    expect(globalSearch).toContain('setResults(moduleResults)');
    expect(globalSearch).toContain('if (!scopedDb || typeof scopedDb.from !== "function")');
    expect(globalSearch).toContain('window.addEventListener("shell:open-global-search", openSearch)');
    expect(globalSearch).toContain('commandProps={{ shouldFilter: false }}');
    expect(globalSearch).toContain('value={`${result.type} ${result.title} ${result.subtitle || ""}`.toLowerCase()}');
    expect(globalSearch).toContain('"module"');
    expect(globalSearch).toContain('["module", "lead", "account", "contact", "quote", "opportunity"]');
    expect(globalSearch).toContain('"w-44 sm:w-56 lg:w-64"');
    expect(globalSearch).toContain('SEARCH_HISTORY_KEY');
    expect(globalSearch).toContain('Recent Searches');
    expect(dashboardLayout).toContain('<GlobalSearch />');
    expect(dashboardLayout).not.toContain("window.dispatchEvent(new CustomEvent('shell:open-global-search'))");
  });
});
