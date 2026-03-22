import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useDomain } from '@/contexts/DomainContext';
import {
  AMRO_ASYNCAPI_SPEC_PATH,
  AMRO_GRAPHQL_SUBGRAPH_PATH,
  AMRO_GRPC_PROTO_PATH,
  AMRO_HEALTH_PATH,
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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AmroOwnedWorkspace } from '../components/AmroOwnedWorkspace';
import { useAmroOverviewKpi } from '../hooks/useAmroOverviewKpi';

type AmroModuleShellProps = {
  children: ReactNode;
};

type AmroPhasePlanUiRow = AmroPhasePlanRow & { status?: AmroPhaseStatus };
type PersonaRole = 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user';
type AmroModuleKey =
  | 'overview'
  | 'work-packages'
  | 'task-execution'
  | 'scheduling'
  | 'parts'
  | 'compliance'
  | 'certification'
  | 'audit'
  | 'integration'
  | 'intelligence';

type AmroHubVerticalPageProps = {
  moduleKey?: AmroModuleKey;
};

const AMRO_MODULE_ROUTE_BY_NAME: Record<string, AmroModuleKey> = {
  Overview: 'overview',
  'Work Package': 'work-packages',
  'Task Execution': 'task-execution',
  Scheduling: 'scheduling',
  Parts: 'parts',
  Compliance: 'compliance',
  Certification: 'certification',
  Audit: 'audit',
  Integration: 'integration',
  Intelligence: 'intelligence',
};

const AMRO_MODULE_PAGE_LABEL: Record<AmroModuleKey, string> = {
  overview: 'AMRO Overview',
  'work-packages': 'AMRO Work Packages',
  'task-execution': 'AMRO Task Execution',
  scheduling: 'AMRO Scheduling',
  parts: 'AMRO Parts',
  compliance: 'AMRO Compliance',
  certification: 'AMRO Certification',
  audit: 'AMRO Audit',
  integration: 'AMRO Integration',
  intelligence: 'AMRO Intelligence',
};

function AmroModuleShell({ children }: AmroModuleShellProps) {
  return (
    <section data-module-shell="module-amro" className="h-full w-full">
      {children}
    </section>
  );
}

function AmroWorkspaceSurface({ moduleKey }: { moduleKey?: AmroModuleKey }) {
  return <AmroOwnedWorkspace moduleKey={moduleKey} />;
}

function getAmroModuleRoutePath(moduleName: string) {
  const moduleKey = AMRO_MODULE_ROUTE_BY_NAME[moduleName] || 'overview';
  return `/dashboard/amro/${moduleKey}`;
}

export default function AmroHubVerticalPage({ moduleKey }: AmroHubVerticalPageProps = {}) {
  const { currentDomain } = useDomain();
  const { hasRole, isPlatformAdmin } = useAuth();
  const isAmroDomainActive = currentDomain?.code === 'AMRO';
  const {
    dashboard,
    trends,
    lastExport,
    loading,
    exporting,
    error,
    exportSnapshot,
    refreshAll,
    getMetricTier,
    refreshCadence,
    lastDashboardRefreshAt,
    lastTrendsRefreshAt,
    loadDashboard,
  } = useAmroOverviewKpi();
  const [phasePlanRows, setPhasePlanRows] = useState<AmroPhasePlanUiRow[]>([...AMRO_PHASE_PLAN_MATRIX]);
  const [phasePlanSource, setPhasePlanSource] = useState<'api' | 'fallback'>('fallback');
  const [plannerFilter, setPlannerFilter] = useState<string>('');
  const [engineerFilter, setEngineerFilter] = useState<string>('');
  const moduleScopedScreens = useMemo(
    () => (moduleKey ? AMRO_SCREEN_INVENTORY.filter((row) => AMRO_MODULE_ROUTE_BY_NAME[row.module] === moduleKey) : AMRO_SCREEN_INVENTORY),
    [moduleKey]
  );
  const modulePageLabel = moduleKey ? AMRO_MODULE_PAGE_LABEL[moduleKey] : 'AMRO Operations Overview';
  const activePersona = useMemo<PersonaRole>(() => {
    if (isPlatformAdmin()) return 'platform_admin';
    if (hasRole('tenant_admin')) return 'tenant_admin';
    if (hasRole('franchise_admin')) return 'franchise_admin';
    return 'user';
  }, [hasRole, isPlatformAdmin]);
  const canViewAnomalyFlags = activePersona !== 'user';
  const canExportKpiSnapshot = activePersona === 'platform_admin' || activePersona === 'tenant_admin';
  const canViewDetailedOps = activePersona !== 'user';
  const canViewCertificationQueue = activePersona === 'platform_admin' || activePersona === 'tenant_admin' || activePersona === 'franchise_admin';
  const criticalCards = useMemo(
    () => (dashboard?.kpi_cards || []).filter((card) => getMetricTier(card.key) === 'critical'),
    [dashboard?.kpi_cards, getMetricTier]
  );
  const standardCards = useMemo(
    () => (dashboard?.kpi_cards || []).filter((card) => getMetricTier(card.key) === 'standard'),
    [dashboard?.kpi_cards, getMetricTier]
  );
  const applyScopeFilters = async () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    await loadDashboard({
      dateRange: `${start.toISOString()}|${end.toISOString()}`,
      plannerId: plannerFilter.trim() || undefined,
      engineerId: engineerFilter.trim() || undefined,
    });
  };

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
              <CardTitle>{modulePageLabel}</CardTitle>
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
                {moduleKey ? <Badge variant="outline">Module Route: /dashboard/amro/{moduleKey}</Badge> : null}
                <Badge variant="outline">Persona: {activePersona.replace('_', ' ')}</Badge>
                <Badge variant="outline">Critical Refresh: {Math.round(refreshCadence.criticalMs / 1000)}s</Badge>
                <Badge variant="outline">Standard Refresh: {Math.round(refreshCadence.standardMs / 1000)}s</Badge>
                {loading ? <Badge variant="outline">KPI Loading</Badge> : null}
                {error ? <Badge variant="destructive">KPI Error</Badge> : null}
              </div>
              <div className="grid grid-cols-1 gap-3 rounded-md border p-3 text-xs md:grid-cols-4" role="region" aria-label="AMRO Dashboard CRUD Controls">
                <div className="md:col-span-1">
                  <p className="font-semibold">Planner Filter</p>
                  <Input value={plannerFilter} onChange={(event) => setPlannerFilter(event.target.value)} placeholder="planner_id" />
                </div>
                <div className="md:col-span-1">
                  <p className="font-semibold">Engineer Filter</p>
                  <Input value={engineerFilter} onChange={(event) => setEngineerFilter(event.target.value)} placeholder="engineer_id" />
                </div>
                <div className="flex items-end gap-2 md:col-span-2">
                  <Button size="sm" variant="outline" onClick={() => void applyScopeFilters()}>
                    Apply Dashboard Scope
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPlannerFilter('');
                      setEngineerFilter('');
                      void loadDashboard({
                        dateRange: `${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}|${new Date().toISOString()}`,
                      });
                    }}
                  >
                    Clear Scope
                  </Button>
                </div>
              </div>
              <div className="rounded-md border p-3 text-xs" role="region" aria-label="Module CRUD Hub">
                <p className="font-semibold">AMRO Module CRUD Hub</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {moduleScopedScreens.map((row) => (
                    <div key={`crud-${row.screenId}`} className="rounded-md border p-2">
                      <p className="font-medium">{row.screenId}</p>
                      <p className="text-muted-foreground">{row.screenName}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <a
                          className="rounded-md border px-2 py-1 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          href={`${getAmroModuleRoutePath(row.module)}?screen=${encodeURIComponent(row.screenId)}&mode=create`}
                        >
                          Create
                        </a>
                        <a
                          className="rounded-md border px-2 py-1 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          href={`${getAmroModuleRoutePath(row.module)}?screen=${encodeURIComponent(row.screenId)}&mode=read`}
                        >
                          Read
                        </a>
                        <a
                          className="rounded-md border px-2 py-1 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          href={`${getAmroModuleRoutePath(row.module)}?screen=${encodeURIComponent(row.screenId)}&mode=update`}
                        >
                          Update
                        </a>
                        <a
                          className="rounded-md border px-2 py-1 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          href={`${getAmroModuleRoutePath(row.module)}?screen=${encodeURIComponent(row.screenId)}&mode=delete`}
                        >
                          Delete
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs" role="alert" aria-live="polite">
                  <p className="font-semibold">Overview Widget Error State</p>
                  <p className="mt-1 text-muted-foreground">{error}</p>
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => void refreshAll()}>
                      Retry KPI Refresh
                    </Button>
                  </div>
                </div>
              ) : null}
              {dashboard ? (
                <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-md border p-3" role="region" aria-label="Executive Summary Panel">
                    <p className="font-semibold">Executive Summary Panel</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-md border p-2">
                        <p className="text-[11px] text-muted-foreground">Active Work Packages</p>
                        <p className="mt-1 text-base font-semibold">{dashboard.executive_summary.active_work_packages}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-[11px] text-muted-foreground">Overdue Tasks</p>
                        <p className="mt-1 text-base font-semibold">{dashboard.executive_summary.overdue_tasks}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-[11px] text-muted-foreground">Compliance Status %</p>
                        <p className="mt-1 text-base font-semibold">{dashboard.executive_summary.compliance_status_pct}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-[11px] text-muted-foreground">Forecast Accuracy %</p>
                        <p className="mt-1 text-base font-semibold">{dashboard.executive_summary.forecast_accuracy_pct}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md border p-3" role="region" aria-label="Critical KPI Metrics">
                    <p className="font-semibold">Critical KPI Metrics</p>
                    {criticalCards.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {criticalCards.map((card) => (
                          <Badge key={card.key} variant="destructive">{`${card.label}: ${card.value} (${card.trend})`}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-muted-foreground">No critical metrics returned for this scope.</p>
                    )}
                    {lastDashboardRefreshAt ? (
                      <p className="mt-2 text-muted-foreground">Last critical refresh: {lastDashboardRefreshAt}</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border p-3" role="region" aria-label="Standard KPI Metrics">
                    <p className="font-semibold">Standard KPI Metrics</p>
                    {standardCards.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {standardCards.map((card) => (
                          <Badge key={card.key} variant="secondary">{`${card.label}: ${card.value} (${card.trend})`}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-muted-foreground">No standard metrics returned for this scope.</p>
                    )}
                    {dashboard.freshness_warning ? (
                      <p className="mt-2 text-muted-foreground">Freshness: {dashboard.freshness_warning}</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border p-3" role="region" aria-label="Operational Trends and Export">
                    <p className="font-semibold">Task Execution Monitor</p>
                    <p className="mt-2 text-muted-foreground">
                      Technician productivity: {trends?.task_execution_monitor?.average_productivity_pct ?? 0}% | Mobile completion:{' '}
                      {trends?.task_execution_monitor?.mobile_completion_rate_pct ?? 0}%
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Completed tasks: {trends?.task_execution_monitor?.completed_tasks ?? 0} | Technicians:{' '}
                      {trends?.task_execution_monitor?.technician_count ?? 0}
                    </p>
                    <p className="mt-3 font-semibold">Operational Trends</p>
                    <p className="mt-2 text-muted-foreground">
                      Variance: {typeof trends?.variance === 'number' ? trends.variance : 'N/A'} | Threshold breaches:{' '}
                      {trends?.threshold_breaches?.length || 0}
                    </p>
                    {lastTrendsRefreshAt ? (
                      <p className="mt-2 text-muted-foreground">Last standard refresh: {lastTrendsRefreshAt}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void refreshAll()}>
                        Refresh Widgets
                      </Button>
                      {canExportKpiSnapshot ? (
                        <Button size="sm" variant="outline" disabled={exporting} onClick={() => void exportSnapshot()}>
                          {exporting ? 'Exporting KPI Snapshot...' : 'Export KPI Snapshot'}
                        </Button>
                      ) : (
                        <Badge variant="outline">Export restricted to tenant/platform admin persona</Badge>
                      )}
                    </div>
                    {lastExport ? (
                      <p className="mt-2 text-muted-foreground">
                        Last export job: {lastExport.export_job_id} | {lastExport.generated_at}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2 xl:col-span-4" role="region" aria-label="Work Package Overview Grid">
                    <p className="font-semibold">Work Package Overview Grid</p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse">
                        <thead>
                          <tr className="text-left">
                            <th className="border-b py-1 pr-2">Work Package</th>
                            <th className="border-b py-1 pr-2">Status</th>
                            <th className="border-b py-1 pr-2">Planner</th>
                            <th className="border-b py-1 pr-2">Engineer</th>
                            <th className="border-b py-1 pr-2">Due</th>
                            <th className="border-b py-1 pr-2">Progress %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(dashboard.work_package_overview || []).map((item) => (
                            <tr key={item.work_package_id}>
                              <td className="border-b py-1 pr-2">{item.title}</td>
                              <td className="border-b py-1 pr-2">{item.status}</td>
                              <td className="border-b py-1 pr-2">{item.planner_id}</td>
                              <td className="border-b py-1 pr-2">{item.engineer_id}</td>
                              <td className="border-b py-1 pr-2">{item.due_at || 'N/A'}</td>
                              <td className="border-b py-1 pr-2">{item.progress_pct}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2" role="region" aria-label="Scheduling Board Snapshot">
                    <p className="font-semibold">Scheduling Board Snapshot</p>
                    <p className="mt-2 text-muted-foreground">
                      Resource utilization: {trends?.scheduling_board_snapshot?.resource_utilization_pct ?? 0}%
                    </p>
                    <div className="mt-2 space-y-1">
                      {(trends?.scheduling_board_snapshot?.upcoming_slots || []).slice(0, 5).map((slot) => (
                        <div key={slot.slot_id} className="rounded-md border p-2">
                          {slot.station} | {slot.resource} | {slot.start_at || 'unscheduled'}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2" role="region" aria-label="Materials Reservation Alert Panel">
                    <p className="font-semibold">Materials Reservation Alert Panel</p>
                    <div className="mt-2 space-y-1">
                      {(dashboard.materials_reservation_alerts || []).slice(0, 5).map((alert) => (
                        <div key={`${alert.part_number}-${alert.location}`} className="rounded-md border p-2">
                          {alert.part_number} | {alert.location} | Shortage: {alert.shortage_qty}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2" role="region" aria-label="Compliance Gate Status">
                    <p className="font-semibold">Compliance Gate Status</p>
                    <div className="mt-2 space-y-1">
                      {(dashboard.compliance_gate_status || []).slice(0, 5).map((gate) => (
                        <div key={gate.gate_id} className="rounded-md border p-2">
                          {gate.gate_name} | {gate.status} | {gate.due_at || 'No due date'}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2" role="region" aria-label="Certification Decision Queue">
                    <p className="font-semibold">Certification Decision Queue</p>
                    {canViewCertificationQueue ? (
                      <div className="mt-2 space-y-1">
                        {(trends?.certification_decision_queue || []).slice(0, 5).map((item) => (
                          <div key={item.certification_id} className="rounded-md border p-2">
                            {item.certification_id} | {item.authority} | {item.status}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-muted-foreground">Certification queue is hidden for current persona.</p>
                    )}
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2" role="region" aria-label="Audit Timeline Widget">
                    <p className="font-semibold">Audit Timeline Widget</p>
                    {canViewDetailedOps ? (
                      <div className="mt-2 space-y-1">
                        {(trends?.audit_timeline || []).slice(0, 5).map((event) => (
                          <div key={event.event_id} className="rounded-md border p-2">
                            {event.action} | {event.actor} | {event.outcome}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-muted-foreground">Audit timeline is hidden for current persona.</p>
                    )}
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2" role="region" aria-label="Integration Monitor">
                    <p className="font-semibold">Integration Monitor</p>
                    <p className="mt-2 text-muted-foreground">
                      Health: {dashboard.integration_monitor?.status || 'unknown'} | Failed attempts: {dashboard.integration_monitor?.failed_attempts || 0} | Failure rate:{' '}
                      {dashboard.integration_monitor?.failure_rate_pct || 0}%
                    </p>
                    <div className="mt-2 space-y-1">
                      {(dashboard.integration_monitor?.recent_failures || []).slice(0, 4).map((failure) => (
                        <div key={`${failure.integration_id}-${failure.last_attempt_at}`} className="rounded-md border p-2">
                          {failure.integration_id} | {failure.status} | {failure.error_message || 'No error details'}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2" role="region" aria-label="Forecast Recommendation Hub">
                    <p className="font-semibold">Forecast Recommendation Hub</p>
                    <div className="mt-2 space-y-1">
                      {(trends?.forecast_recommendation_hub || []).slice(0, 5).map((item) => (
                        <div key={item.recommendation_id} className="rounded-md border p-2">
                          {item.recommendation} | Confidence: {item.confidence_pct}% | Risk: {item.risk_score}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2 xl:col-span-4" role="region" aria-label="Quick Navigation">
                    <p className="font-semibold">Quick Navigation to 16.1 Screen Modules</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {moduleScopedScreens.map((row) => (
                        <a
                          key={row.screenId}
                          className="rounded-md border p-2 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          href={`${getAmroModuleRoutePath(row.module)}?screen=${encodeURIComponent(row.screenId)}`}
                        >
                          {row.screenId} | {row.screenName}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 md:col-span-2 xl:col-span-4" role="region" aria-label="Anomaly Flags">
                    <p className="font-semibold">Anomaly Flags</p>
                    {canViewAnomalyFlags ? (
                      dashboard.anomaly_flags.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {dashboard.anomaly_flags.map((flag) => (
                            <Badge key={flag.id} variant="secondary">{`${flag.metric_key}: ${flag.message}`}</Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-muted-foreground">No anomalies detected for the active scope.</p>
                      )
                    ) : (
                      <p className="mt-2 text-muted-foreground">
                        Role Controls: anomaly intelligence is hidden for user persona.
                      </p>
                    )}
                    {(dashboard.data_issues?.length || trends?.data_issues?.length) ? (
                      <div className="mt-3 rounded-md border border-warning/50 bg-warning/10 p-2" aria-live="polite">
                        <p className="font-semibold">Data Connectivity Issues</p>
                        {dashboard.data_issues?.slice(0, 3).map((issue) => (
                          <p key={`dashboard-${issue}`} className="mt-1 text-muted-foreground">{issue}</p>
                        ))}
                        {trends?.data_issues?.slice(0, 3).map((issue) => (
                          <p key={`trends-${issue}`} className="mt-1 text-muted-foreground">{issue}</p>
                        ))}
                      </div>
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
                      <a className="rounded-md border p-2 hover:bg-muted/30" href={AMRO_HEALTH_PATH} target="_blank" rel="noreferrer">
                        Contract Health API
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
                  <AmroWorkspaceSurface moduleKey={moduleKey} />
                </PlatformWidgetSlot>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </AmroModuleShell>
    </DashboardLayout>
  );
}

export function AmroOverviewPage() {
  return <AmroHubVerticalPage moduleKey="overview" />;
}

export function AmroWorkPackagesPage() {
  return <AmroHubVerticalPage moduleKey="work-packages" />;
}

export function AmroTaskExecutionPage() {
  return <AmroHubVerticalPage moduleKey="task-execution" />;
}

export function AmroSchedulingPage() {
  return <AmroHubVerticalPage moduleKey="scheduling" />;
}

export function AmroPartsPage() {
  return <AmroHubVerticalPage moduleKey="parts" />;
}

export function AmroCompliancePage() {
  return <AmroHubVerticalPage moduleKey="compliance" />;
}

export function AmroCertificationPage() {
  return <AmroHubVerticalPage moduleKey="certification" />;
}

export function AmroAuditPage() {
  return <AmroHubVerticalPage moduleKey="audit" />;
}

export function AmroIntegrationPage() {
  return <AmroHubVerticalPage moduleKey="integration" />;
}

export function AmroIntelligencePage() {
  return <AmroHubVerticalPage moduleKey="intelligence" />;
}
