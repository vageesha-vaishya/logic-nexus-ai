import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDomain } from '@/contexts/DomainContext';
import {
  AMRO_ASYNCAPI_SPEC_PATH,
  AMRO_GRAPHQL_SUBGRAPH_PATH,
  AMRO_GRPC_PROTO_PATH,
  AMRO_MODULE_CATALOG_PATH,
  AMRO_MIGRATION_PLAN_PATH,
  AMRO_OPENAPI_SPEC_PATH,
  AMRO_OVERVIEW_KPI_PATH,
  AMRO_PHASE_1_READINESS_PATH,
  AMRO_PHASE_PLAN_PATH,
  AMRO_SCREEN_INVENTORY_PATH,
} from '@/pages/api/v2/amro/integration-contracts';
import { AMRO_PHASE_1_DELIVERABLES, AMRO_PHASE_1_SCOPE } from '@/pages/api/v2/amro/phase-1-core-workflows';
import { AMRO_MODULE_CATALOG } from '@/pages/api/v2/amro/module-catalog-model';
import { AMRO_PHASE_PLAN_MATRIX, type AmroPhasePlanRow, type AmroPhaseStatus } from '@/pages/api/v2/amro/phase-plan-model';
import {
  AMRO_ACCESSIBILITY_I18N_REQUIREMENTS,
  AMRO_SCREEN_INVENTORY,
  AMRO_SCREEN_LAYOUT_CONTRACTS,
  AMRO_UIUX_BEHAVIOR_RULES,
} from '@/pages/api/v2/amro/screen-inventory-model';
import { useEffect, useState, type ReactNode } from 'react';
import { AmroOwnedWorkspace } from '../components/AmroOwnedWorkspace';
import { useAmroOverviewKpi } from '../hooks/useAmroOverviewKpi';

type AmroModuleShellProps = {
  children: ReactNode;
};

type AmroPhasePlanUiRow = AmroPhasePlanRow & { status?: AmroPhaseStatus };

function AmroModuleShell({ children }: AmroModuleShellProps) {
  return (
    <section data-module-shell="module-amro" className="h-full w-full">
      {children}
    </section>
  );
}

function AmroWorkspaceSurface() {
  return <AmroOwnedWorkspace />;
}

export default function AmroHubVerticalPage() {
  const { currentDomain } = useDomain();
  const isAmroDomainActive = currentDomain?.code === 'AMRO';
  const { dashboard, trends, lastExport, loading, exporting, error, exportSnapshot } = useAmroOverviewKpi();
  const [phasePlanRows, setPhasePlanRows] = useState<AmroPhasePlanUiRow[]>([...AMRO_PHASE_PLAN_MATRIX]);
  const [phasePlanSource, setPhasePlanSource] = useState<'api' | 'fallback'>('fallback');

  useEffect(() => {
    let active = true;
    const loadPhasePlan = async () => {
      try {
        const response = await fetch(AMRO_PHASE_PLAN_PATH);
        const payload = await response.json() as {
          data?: { phasePlan?: { rows?: AmroPhasePlanUiRow[] } };
        };
        const rows = payload?.data?.phasePlan?.rows;
        if (!response.ok || !Array.isArray(rows) || rows.length === 0 || !active) {
          return;
        }
        setPhasePlanRows(rows);
        setPhasePlanSource('api');
      } catch {
        if (active) {
          setPhasePlanSource('fallback');
        }
      }
    };
    void loadPhasePlan();
    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardLayout>
      <AmroModuleShell>
        <div className="flex-1 space-y-4 p-6" data-amro-uiux="base-preserved">
          <Card data-amro-base-surface="operations-overview">
            <CardHeader className="pb-2">
              <CardTitle>AMRO Operations Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Core dashboard shell, navigation, and platform look-and-feel remain unchanged while AMRO capabilities
                are layered as module-owned enhancements.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Base Platform UI Preserved</Badge>
                <Badge variant={isAmroDomainActive ? 'secondary' : 'destructive'}>
                  {isAmroDomainActive ? 'AMRO Domain Context Active' : 'AMRO Domain Context Required'}
                </Badge>
                <Badge variant="outline">KPI Data Source: {AMRO_OVERVIEW_KPI_PATH}</Badge>
                {loading ? <Badge variant="outline">KPI Loading</Badge> : null}
                {error ? <Badge variant="destructive">KPI Error</Badge> : null}
              </div>
              {dashboard ? (
                <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="font-semibold">KPI Cards</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dashboard.kpi_cards.map((card) => (
                        <Badge key={card.key} variant="secondary">{`${card.label}: ${card.value} (${card.trend})`}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="font-semibold">Operational Trends</p>
                    <p className="mt-2 text-muted-foreground">
                      Variance: {typeof trends?.variance === 'number' ? trends.variance : 'N/A'} | Threshold breaches:{' '}
                      {trends?.threshold_breaches?.length || 0}
                    </p>
                    {dashboard.freshness_warning ? (
                      <p className="mt-2 text-muted-foreground">Freshness: {dashboard.freshness_warning}</p>
                    ) : null}
                    <div className="mt-3">
                      <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportSnapshot()}>
                        {exporting ? 'Exporting KPI Snapshot...' : 'Export KPI Snapshot'}
                      </Button>
                    </div>
                    {lastExport ? (
                      <p className="mt-2 text-muted-foreground">
                        Last export job: {lastExport.export_job_id} | {lastExport.generated_at}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Accordion type="single" collapsible className="w-full" defaultValue="amro-enhancement-workspace">
            <AccordionItem value="amro-enhancement-workspace" className="rounded-md border px-3">
              <AccordionTrigger>Open AMRO Domain Workspace Enhancements</AccordionTrigger>
              <AccordionContent className="space-y-4 pb-2">
                <Card data-amro-contracts-surface="integration-contracts">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO Integration Contracts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Contract artifacts are published for REST, GraphQL, gRPC, and AsyncAPI to support coexistence and migration validation.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Dual-Read Deterministic Comparison</Badge>
                      <Badge variant="outline">Dual-Write Idempotency + Reconciliation</Badge>
                      <Badge variant="outline">Tenant/Franchise Cohort Flags</Badge>
                      <Badge variant="outline">Legacy Fallback with Queue Drain</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_OPENAPI_SPEC_PATH} target="_blank" rel="noreferrer">
                        OpenAPI 3.1 Contract
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_GRAPHQL_SUBGRAPH_PATH} target="_blank" rel="noreferrer">
                        GraphQL Subgraph Contract
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_GRPC_PROTO_PATH} target="_blank" rel="noreferrer">
                        gRPC Proto Contract
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_ASYNCAPI_SPEC_PATH} target="_blank" rel="noreferrer">
                        AsyncAPI Event Contract
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_PHASE_PLAN_PATH} target="_blank" rel="noreferrer">
                        Phase-Wise Plan API
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_PHASE_1_READINESS_PATH} target="_blank" rel="noreferrer">
                        Phase 1 Readiness API
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_MODULE_CATALOG_PATH} target="_blank" rel="noreferrer">
                        Module Catalog API
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_SCREEN_INVENTORY_PATH} target="_blank" rel="noreferrer">
                        Screen Inventory + UI/UX Contracts API
                      </a>
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_MIGRATION_PLAN_PATH} target="_blank" rel="noreferrer">
                        Migration Plan API
                      </a>
                    </div>
                  </CardContent>
                </Card>
                <Card data-amro-module-catalog-surface="module-catalog">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO 15.1 Module Catalog</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {AMRO_MODULE_CATALOG.map((row) => (
                        <div key={row.module} className="rounded-md border p-3">
                          <p className="text-sm font-semibold">{row.module}</p>
                          <p className="mt-2 text-xs font-medium">Primary Users</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.primaryUsers.map((user) => (
                              <Badge key={`${row.module}-${user}`} variant="secondary">
                                {user}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-xs font-medium">Primary Inputs</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.primaryInputs.join(', ')}</p>
                          <p className="mt-2 text-xs font-medium">Primary Outputs</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.primaryOutputs.join(', ')}</p>
                          <p className="mt-2 text-xs font-medium">Core Dependencies</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.coreDependencies.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card data-amro-screen-inventory-surface="screen-inventory">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO 16.1 Screen Inventory</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {AMRO_SCREEN_INVENTORY.map((row) => (
                        <div key={row.screenId} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">{row.screenId}</p>
                            <Badge variant="outline">{row.module}</Badge>
                          </div>
                          <p className="mt-1 text-sm font-semibold">{row.screenName}</p>
                          <p className="mt-2 text-xs font-medium">Primary Persona</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.primaryPersona.map((persona) => (
                              <Badge key={`${row.screenId}-${persona}`} variant="secondary">
                                {persona}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-xs font-medium">Device</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.device.map((device) => (
                              <Badge key={`${row.screenId}-${device}`} variant="secondary">
                                {device}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card data-amro-layout-contract-surface="layout-contracts">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO 16.2 Per-Screen Layout Contracts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {AMRO_SCREEN_LAYOUT_CONTRACTS.map((contract) => (
                        <div key={contract.screenId} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">{contract.screenId}</p>
                            <Badge variant="outline">{contract.screenName}</Badge>
                          </div>
                          <div className="mt-2 space-y-2">
                            {contract.sections.map((section) => (
                              <div key={`${contract.screenId}-${section.region}`}>
                                <p className="text-xs font-medium">{section.region}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{section.requirements.join(', ')}</p>
                              </div>
                            ))}
                          </div>
                          {contract.guardrails?.length ? (
                            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/80 p-2 dark:border-amber-900 dark:bg-amber-950/30">
                              <p className="text-xs font-medium">Guardrails</p>
                              <p className="mt-1 text-xs text-muted-foreground">{contract.guardrails.join(', ')}</p>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card data-amro-uiux-behavior-surface="behavior-rules">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO 16.3 UI/UX Behavior Rules</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-semibold">Stable Action Order</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {AMRO_UIUX_BEHAVIOR_RULES.stableActionOrder.map((action) => (
                          <Badge key={action} variant="secondary">
                            {action}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-xs font-semibold">Primary Action States</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {AMRO_UIUX_BEHAVIOR_RULES.primaryActionStates.map((state) => (
                            <Badge key={state} variant="secondary">
                              {state}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs font-semibold">Deterministic Color Semantics</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {AMRO_UIUX_BEHAVIOR_RULES.deterministicColorSemantics.map((semantic) => (
                            <Badge key={semantic} variant="secondary">
                              {semantic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3 text-xs text-muted-foreground">
                        View/theme persistence: {AMRO_UIUX_BEHAVIOR_RULES.persistence.view}; restore on remount:{' '}
                        {AMRO_UIUX_BEHAVIOR_RULES.persistence.restoreOnRemount ? 'enabled' : 'disabled'}.
                      </div>
                      <div className="rounded-md border p-3 text-xs text-muted-foreground">
                        Server pagination default: {AMRO_UIUX_BEHAVIOR_RULES.serverPagination.defaultEnabled ? 'enabled' : 'disabled'}; page
                        size preservation: {AMRO_UIUX_BEHAVIOR_RULES.serverPagination.preserveUserPageSize ? 'enabled' : 'disabled'}.
                      </div>
                    </div>
                    <div className="rounded-md border border-red-200 bg-red-50/80 p-3 text-xs text-muted-foreground dark:border-red-900 dark:bg-red-950/30">
                      Irreversible actions require dual confirmation:{' '}
                      {AMRO_UIUX_BEHAVIOR_RULES.irreversibleActionProtection.dualConfirmationRequired ? 'enabled' : 'disabled'}; rationale
                      capture:{' '}
                      {AMRO_UIUX_BEHAVIOR_RULES.irreversibleActionProtection.rationaleCaptureRequired ? 'required' : 'optional'}.
                    </div>
                  </CardContent>
                </Card>
                <Card data-amro-a11y-i18n-surface="a11y-i18n">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO 16.4 Accessibility and Internationalization</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {AMRO_ACCESSIBILITY_I18N_REQUIREMENTS.map((item) => (
                        <div key={item.area} className="rounded-md border p-3">
                          <p className="text-xs font-semibold">{item.area}</p>
                          <p className="mt-1 text-xs">{item.requirement}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{item.acceptanceCriteria}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card data-amro-phase-1-surface="phase-1-core-workflows">
                  <CardHeader className="pb-2">
                    <CardTitle>{AMRO_PHASE_1_SCOPE.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{AMRO_PHASE_1_SCOPE.phase}</Badge>
                      <Badge variant="outline">{AMRO_PHASE_1_SCOPE.duration}</Badge>
                      <Badge variant="outline">{AMRO_PHASE_1_SCOPE.allocation}</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="font-semibold">Goals</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {AMRO_PHASE_1_SCOPE.goals.map((goal) => (
                            <Badge key={goal} variant="secondary">
                              {goal}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="font-semibold">Dependencies</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {AMRO_PHASE_1_SCOPE.blockersAndDependencies.map((dependency) => (
                            <Badge key={dependency} variant="secondary">
                              {dependency}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {AMRO_PHASE_1_DELIVERABLES.map((deliverable) => (
                        <div key={deliverable.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">{deliverable.id}</p>
                            <Badge variant="outline">{deliverable.owner}</Badge>
                          </div>
                          <p className="mt-1 text-sm">{deliverable.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{deliverable.acceptanceCriteria}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{deliverable.effort}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-semibold">Success Metrics</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {AMRO_PHASE_1_SCOPE.successMetrics.map((metric) => (
                          <Badge key={metric} variant="secondary">
                            {metric}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card data-amro-phase-plan-surface="phase-plan">
                  <CardHeader className="pb-2">
                    <CardTitle>AMRO Phase-Wise Implementation Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Delivery is sequenced by phases to preserve backward compatibility and controlled tenant/franchise rollout.
                    </p>
                    <Badge variant="outline">
                      Phase Plan Source: {phasePlanSource === 'api' ? 'Live API' : 'Fallback Model'}
                    </Badge>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {phasePlanRows.map((phase) => (
                        <div key={phase.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{phase.label}</p>
                            {phase.status ? <Badge variant="secondary">{phase.status}</Badge> : null}
                          </div>
                          <p className="mt-2 text-xs font-medium">Backend Build Scope</p>
                          <p className="text-xs text-muted-foreground">{phase.backendBuildScope}</p>
                          <p className="mt-2 text-xs font-medium">Frontend Build Scope</p>
                          <p className="text-xs text-muted-foreground">{phase.frontendBuildScope}</p>
                          <p className="mt-2 text-xs font-medium">Data and Security Scope</p>
                          <p className="text-xs text-muted-foreground">{phase.dataAndSecurityScope}</p>
                          <p className="mt-2 text-xs font-medium">Test Scope</p>
                          <p className="text-xs text-muted-foreground">{phase.testScope}</p>
                          <p className="mt-2 text-xs font-medium">Deliverables</p>
                          <p className="text-xs text-muted-foreground">{phase.deliverables}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <PlatformWidgetSlot
                  widgets={[
                    {
                      id: 'amro-asset-contract',
                      title: 'AMRO Asset Contract',
                      content: 'Asset registry and configuration states are AMRO-owned and tenant/franchise scoped.',
                    },
                    {
                      id: 'amro-work-package-contract',
                      title: 'AMRO Work Package Contract',
                      content:
                        'Work package lifecycle transitions run through AMRO policy stages create-plan-schedule-execute-close.',
                    },
                    {
                      id: 'amro-compliance-contract',
                      title: 'AMRO Compliance Contract',
                      content: 'Compliance evidence and authority sign-off controls remain AMRO-owned with immutable chain records.',
                    },
                    {
                      id: 'amro-service-boundaries',
                      title: 'AMRO Service Boundaries',
                      content:
                        'Work-order, scheduling, compliance, materials, and audit-ledger services stay AMRO-bounded with scoped ownership.',
                    },
                  ]}
                >
                  <AmroWorkspaceSurface />
                </PlatformWidgetSlot>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </AmroModuleShell>
    </DashboardLayout>
  );
}
