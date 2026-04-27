import { PlatformWidgetSlot } from '@/components/ui/enterprise';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';
import { useDomain } from '@/contexts/DomainContext';
import { logger } from '@/lib/logger';
import {
  AMRO_ASYNCAPI_SPEC_PATH,
  AMRO_GRAPHQL_SUBGRAPH_PATH,
  AMRO_GRPC_PROTO_PATH,
  AMRO_HEALTH_PATH,
  AMRO_MODULE_CATALOG_PATH,
  AMRO_MIGRATION_PLAN_PATH,
  AMRO_OPENAPI_SPEC_PATH,
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AmroOwnedWorkspace } from '../components/AmroOwnedWorkspace';
import { AmroWorkOrdersListPage } from '../components/work-orders/AmroWorkOrdersListPage';
import { useAmroOverviewKpi } from '../hooks/useAmroOverviewKpi';

type AmroModuleShellProps = {
  children: ReactNode;
};

type AmroPhasePlanUiRow = AmroPhasePlanRow & { status?: AmroPhaseStatus };
type PersonaRole = 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user';
type AmroWorkspaceModuleKey =
  | 'overview'
  | 'primary-users'
  | 'work-orders'
  | 'task-execution'
  | 'scheduling'
  | 'parts'
  | 'compliance'
  | 'certification'
  | 'audit'
  | 'integration'
  | 'intelligence';
type AmroModuleKey = AmroWorkspaceModuleKey | 'workspace-documentation';
type AmroDocumentationCategory =
  | 'all'
  | 'contracts'
  | 'catalog'
  | 'screen-inventory'
  | 'layout'
  | 'behavior'
  | 'accessibility'
  | 'phase-1'
  | 'phase-plan';

type AmroHubVerticalPageProps = {
  moduleKey?: AmroModuleKey;
};

export type AmroOverviewWorkspaceTelemetry = {
  openWorkOrders?: number;
  aogCount?: number;
  complianceRiskCount?: number;
  deferredCount?: number;
  fillRatePct?: number;
  pipelineSnapshot?: string;
  riskHeatmapSummary?: string;
  forecastSummary?: string;
  confidenceSegmentation?: string;
  recommendedActions?: string;
  slaTrendSummary?: string;
  dataFreshness?: string;
  syncHealth?: string;
};

type AmroOverviewWorkspaceControls = {
  dateRange: '7d' | '30d' | '90d';
  regulatorProfile: 'FAA' | 'EASA' | 'CAAC';
  fleetFilter: string;
  stationFilter: string;
  onCycleDateRange: () => void;
  onCycleRegulatorProfile: () => void;
  onFleetFilterChange: (value: string) => void;
  onStationFilterChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  exporting?: boolean;
};

const AMRO_MODULE_PAGE_LABEL: Record<AmroModuleKey, string> = {
  overview: 'Overview',
  'primary-users': 'Primary Users',
  'work-orders': 'Work Packages',
  'task-execution': 'Task Execution',
  scheduling: 'Scheduling',
  parts: 'Parts',
  compliance: 'Compliance',
  certification: 'Certification',
  audit: 'Audit',
  integration: 'Integration',
  intelligence: 'Intelligence',
  'workspace-documentation': 'Workspace Documentation',
};

const AMRO_DOCUMENTATION_CATEGORY_LABEL: Record<Exclude<AmroDocumentationCategory, 'all'>, string> = {
  contracts: 'Contracts',
  catalog: 'Module Catalog',
  'screen-inventory': 'Screen Inventory',
  layout: 'Layout Contracts',
  behavior: 'UI/UX Rules',
  accessibility: 'Accessibility',
  'phase-1': 'Phase 1',
  'phase-plan': 'Phase Plan',
};
const OVERVIEW_WORK_PACKAGE_PAGE_SIZE = 10;
const OVERVIEW_TRENDS_PAGE_SIZE = 5;

type AmroDocumentationReference = {
  id: string;
  label: string;
  href: string;
  category: Exclude<AmroDocumentationCategory, 'all'>;
  external?: boolean;
};

type AmroEngineGapMatrixRow = {
  capability: string;
  dataModel: string;
  api: string;
  ui: string;
  validation: string;
  permissions: string;
};

type AmroEngineImplementationStatus = 'pending' | 'in_progress' | 'completed';
type AmroEngineCapability = 'Engine Serial Tracking' | 'Thrust Rating Management' | 'On-Wing Lifecycle';
type AmroEngineExecutionLayer = 'Data Model' | 'API' | 'UI' | 'Validation' | 'Permissions';

type AmroEngineImplementationExecutionRow = {
  id: string;
  capability: AmroEngineCapability;
  layer: AmroEngineExecutionLayer;
  task: string;
  targetPermission: string;
  status: AmroEngineImplementationStatus;
};

const AMRO_DOCUMENTATION_REFERENCES: AmroDocumentationReference[] = [
  { id: 'openapi', label: 'OpenAPI 3.1 Contract', href: AMRO_OPENAPI_SPEC_PATH, category: 'contracts', external: true },
  { id: 'graphql', label: 'GraphQL Subgraph Contract', href: AMRO_GRAPHQL_SUBGRAPH_PATH, category: 'contracts', external: true },
  { id: 'grpc', label: 'gRPC Proto Contract', href: AMRO_GRPC_PROTO_PATH, category: 'contracts', external: true },
  { id: 'asyncapi', label: 'AsyncAPI Event Contract', href: AMRO_ASYNCAPI_SPEC_PATH, category: 'contracts', external: true },
  { id: 'phase-api', label: 'Phase-Wise Plan API', href: AMRO_PHASE_PLAN_PATH, category: 'phase-plan', external: true },
  { id: 'phase-readiness', label: 'Phase 1 Readiness API', href: AMRO_PHASE_1_READINESS_PATH, category: 'phase-1', external: true },
  { id: 'module-catalog-api', label: 'Module Catalog API', href: AMRO_MODULE_CATALOG_PATH, category: 'catalog', external: true },
  { id: 'screen-inventory-api', label: 'Screen Inventory + UI/UX Contracts API', href: AMRO_SCREEN_INVENTORY_PATH, category: 'screen-inventory', external: true },
  { id: 'migration-plan-api', label: 'Migration Plan API', href: AMRO_MIGRATION_PLAN_PATH, category: 'phase-plan', external: true },
  { id: 'contract-health-api', label: 'Contract Health API', href: AMRO_HEALTH_PATH, category: 'contracts', external: true },
  { id: 'module-catalog-surface', label: 'AMRO 15.1 Module Catalog', href: '#amro-doc-module-catalog', category: 'catalog' },
  { id: 'screen-inventory-surface', label: 'AMRO 16.1 Screen Inventory', href: '#amro-doc-screen-inventory', category: 'screen-inventory' },
  { id: 'layout-surface', label: 'AMRO 16.2 Per-Screen Layout Contracts', href: '#amro-doc-layout-contracts', category: 'layout' },
  { id: 'behavior-surface', label: 'AMRO 16.3 UI/UX Behavior Rules', href: '#amro-doc-uiux', category: 'behavior' },
  { id: 'a11y-surface', label: 'AMRO 16.4 Accessibility and Internationalization', href: '#amro-doc-a11y', category: 'accessibility' },
  { id: 'phase1-surface', label: AMRO_PHASE_1_SCOPE.title, href: '#amro-doc-phase-1', category: 'phase-1' },
  { id: 'phase-plan-surface', label: 'AMRO Phase-Wise Implementation Plan', href: '#amro-doc-phase-plan', category: 'phase-plan' },
  { id: 'engine-gap-matrix-surface', label: 'AMRO Engine Gap-to-Implementation Matrix', href: '#amro-doc-engine-gap-matrix', category: 'phase-plan' },
];

const AMRO_ENGINE_GAP_IMPLEMENTATION_MATRIX: AmroEngineGapMatrixRow[] = [
  {
    capability: 'Engine Serial Tracking',
    dataModel: 'Implemented (aircraft-scoped): engine_install_history jsonb persisted on aircraft records with array constraints.',
    api: 'Implemented (aircraft endpoint): master-data normalization and write allowlist support engine_install_history payloads.',
    ui: 'Implemented (aircraft workspace): JSON-backed create/edit field plus engine dashboard serialized tracking surface.',
    validation: 'Partially implemented: JSON array schema validation in settings form; uniqueness and chronology guardrails still pending.',
    permissions: 'Gap remains: dedicated view/manage/approve engine serial permission split is not yet introduced.',
  },
  {
    capability: 'Thrust Rating Management',
    dataModel: 'Implemented (aircraft-scoped): thrust_rating_change_log jsonb stores rated thrust, derate mode, and authority references.',
    api: 'Implemented (aircraft endpoint): payload normalization accepts thrust_rating_change_log snapshots.',
    ui: 'Implemented (aircraft workspace): settings form captures rating history and engine dashboard renders rating timeline.',
    validation: 'Partially implemented: JSON array parsing is enforced; range/unit and overlap validation remain pending.',
    permissions: 'Gap remains: no dedicated edit_engine_configuration authority boundary for thrust changes.',
  },
  {
    capability: 'On-Wing Lifecycle',
    dataModel: 'Implemented (aircraft-scoped): on_wing_lifecycle_records jsonb persists install/remove/overhaul event rows.',
    api: 'Implemented (aircraft endpoint): create/update normalization accepts on_wing_lifecycle_records payloads.',
    ui: 'Implemented (aircraft workspace): form captures lifecycle events and engine dashboard shows on-wing event timeline.',
    validation: 'Partially implemented: JSON array validation is active; chronology and counter reset consistency checks remain pending.',
    permissions: 'Gap remains: record_engine_lifecycle_event and approve_lifecycle_reset split permissions are still pending.',
  },
];

const AMRO_DOC_BOOKMARKS_STORAGE_KEY = 'amro.workspace.documentation.bookmarks';
const AMRO_ENGINE_IMPLEMENTATION_STATUS_STORAGE_KEY = 'amro.workspace.documentation.engine-implementation-status';
const AMRO_ENGINE_IMPLEMENTATION_EXECUTION_MATRIX: AmroEngineImplementationExecutionRow[] = [
  {
    id: 'eng-serial-data-model',
    capability: 'Engine Serial Tracking',
    layer: 'Data Model',
    task: 'Create tenant/franchise scoped engine asset and installation history entities with unique serial constraints.',
    targetPermission: 'manage_engine_records',
    status: 'completed',
  },
  {
    id: 'eng-serial-api',
    capability: 'Engine Serial Tracking',
    layer: 'API',
    task: 'Deliver engine registry CRUD and installation timeline endpoints.',
    targetPermission: 'manage_engine_records',
    status: 'completed',
  },
  {
    id: 'eng-serial-ui',
    capability: 'Engine Serial Tracking',
    layer: 'UI',
    task: 'Build engine registry management surface with serial, position, install, and removal workflow controls.',
    targetPermission: 'manage_engine_records',
    status: 'in_progress',
  },
  {
    id: 'eng-thrust-data-model',
    capability: 'Thrust Rating Management',
    layer: 'Data Model',
    task: 'Add rated thrust and derate configuration fields with effective date lineage.',
    targetPermission: 'edit_engine_configuration',
    status: 'completed',
  },
  {
    id: 'eng-thrust-api',
    capability: 'Thrust Rating Management',
    layer: 'API',
    task: 'Expose rating update contract with immutable historical snapshots.',
    targetPermission: 'edit_engine_configuration',
    status: 'completed',
  },
  {
    id: 'eng-thrust-validation',
    capability: 'Thrust Rating Management',
    layer: 'Validation',
    task: 'Enforce unit/range checks and reject overlapping effective date windows.',
    targetPermission: 'edit_engine_configuration',
    status: 'in_progress',
  },
  {
    id: 'eng-lifecycle-data-model',
    capability: 'On-Wing Lifecycle',
    layer: 'Data Model',
    task: 'Persist installation and overhaul lifecycle events with on-wing counter baselines.',
    targetPermission: 'record_engine_lifecycle_event',
    status: 'completed',
  },
  {
    id: 'eng-lifecycle-api',
    capability: 'On-Wing Lifecycle',
    layer: 'API',
    task: 'Implement lifecycle event ingestion and counter recomputation APIs.',
    targetPermission: 'record_engine_lifecycle_event',
    status: 'completed',
  },
  {
    id: 'eng-lifecycle-ui',
    capability: 'On-Wing Lifecycle',
    layer: 'UI',
    task: 'Ship lifecycle timeline and reset approval flow for install/remove/overhaul actions.',
    targetPermission: 'approve_lifecycle_reset',
    status: 'in_progress',
  },
];
const AMRO_ENGINE_IMPLEMENTATION_CAPABILITIES: AmroEngineCapability[] = [
  'Engine Serial Tracking',
  'Thrust Rating Management',
  'On-Wing Lifecycle',
];
const AMRO_ENGINE_IMPLEMENTATION_LAYERS: AmroEngineExecutionLayer[] = ['Data Model', 'API', 'UI', 'Validation', 'Permissions'];
const AMRO_ENGINE_IMPLEMENTATION_STATUSES: AmroEngineImplementationStatus[] = ['pending', 'in_progress', 'completed'];

function AmroModuleShell({ children }: AmroModuleShellProps) {
  return (
    <section data-module-shell="module-amro" className="h-full w-full">
      {children}
    </section>
  );
}

function AmroWorkspaceSurface({
  moduleKey,
  overviewPersona,
  overviewControls,
  overviewTelemetry,
}: {
  moduleKey?: AmroWorkspaceModuleKey;
  overviewPersona?: PersonaRole;
  overviewControls?: AmroOverviewWorkspaceControls;
  overviewTelemetry?: AmroOverviewWorkspaceTelemetry;
}) {
  return (
    <AmroOwnedWorkspace
      moduleKey={moduleKey}
      overviewPersona={overviewPersona}
      overviewControls={overviewControls}
      overviewTelemetry={overviewTelemetry}
    />
  );
}

function AmroWorkspaceDocumentationReference({
  phasePlanRows,
  phasePlanSource,
}: {
  phasePlanRows: AmroPhasePlanUiRow[];
  phasePlanSource: 'api' | 'fallback';
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AmroDocumentationCategory>('all');
  const [bookmarkedReferenceIds, setBookmarkedReferenceIds] = useState<string[]>([]);
  const [engineImplementationStatusByTask, setEngineImplementationStatusByTask] = useState<Record<string, AmroEngineImplementationStatus>>({});
  const [engineTaskSearchQuery, setEngineTaskSearchQuery] = useState('');
  const [engineCapabilityFilter, setEngineCapabilityFilter] = useState<'all' | AmroEngineCapability>('all');
  const [engineLayerFilter, setEngineLayerFilter] = useState<'all' | AmroEngineExecutionLayer>('all');
  const [engineStatusFilter, setEngineStatusFilter] = useState<'all' | AmroEngineImplementationStatus>('all');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(AMRO_DOC_BOOKMARKS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setBookmarkedReferenceIds(parsed.filter((item): item is string => typeof item === 'string'));
      }
    } catch {
      setBookmarkedReferenceIds([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(AMRO_ENGINE_IMPLEMENTATION_STATUS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const normalizedEntries = Object.entries(parsed).reduce<Record<string, AmroEngineImplementationStatus>>((accumulator, [key, value]) => {
          if (value === 'pending' || value === 'in_progress' || value === 'completed') {
            accumulator[key] = value;
          }
          return accumulator;
        }, {});
        setEngineImplementationStatusByTask(normalizedEntries);
      }
    } catch {
      setEngineImplementationStatusByTask({});
    }
  }, []);

  const filteredReferences = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return AMRO_DOCUMENTATION_REFERENCES.filter((reference) => {
      const categoryMatch = categoryFilter === 'all' || reference.category === categoryFilter;
      const searchMatch = !normalized || reference.label.toLowerCase().includes(normalized) || reference.href.toLowerCase().includes(normalized);
      return categoryMatch && searchMatch;
    });
  }, [categoryFilter, searchQuery]);

  const bookmarkedReferences = useMemo(
    () => AMRO_DOCUMENTATION_REFERENCES.filter((reference) => bookmarkedReferenceIds.includes(reference.id)),
    [bookmarkedReferenceIds],
  );

  const toggleBookmark = (referenceId: string) => {
    setBookmarkedReferenceIds((current) => {
      const next = current.includes(referenceId) ? current.filter((id) => id !== referenceId) : [...current, referenceId];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AMRO_DOC_BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const getEffectiveEngineTaskStatus = (taskId: string): AmroEngineImplementationStatus =>
    engineImplementationStatusByTask[taskId] ?? AMRO_ENGINE_IMPLEMENTATION_EXECUTION_MATRIX.find((row) => row.id === taskId)?.status ?? 'pending';

  const persistEngineImplementationStatus = (next: Record<string, AmroEngineImplementationStatus>) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AMRO_ENGINE_IMPLEMENTATION_STATUS_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const cycleEngineTaskStatus = (taskId: string) => {
    setEngineImplementationStatusByTask((current) => {
      const currentStatus = current[taskId] ?? getEffectiveEngineTaskStatus(taskId);
      const nextStatus: AmroEngineImplementationStatus =
        currentStatus === 'pending' ? 'in_progress' : currentStatus === 'in_progress' ? 'completed' : 'pending';
      const next = { ...current, [taskId]: nextStatus };
      persistEngineImplementationStatus(next);
      return next;
    });
  };

  const updateVisibleEngineTaskStatuses = (nextStatus: AmroEngineImplementationStatus, taskIds: string[]) => {
    if (!taskIds.length) return;
    setEngineImplementationStatusByTask((current) => {
      const next = { ...current };
      taskIds.forEach((taskId) => {
        next[taskId] = nextStatus;
      });
      persistEngineImplementationStatus(next);
      return next;
    });
  };

  const clearEngineImplementationStatuses = () => {
    setEngineImplementationStatusByTask({});
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AMRO_ENGINE_IMPLEMENTATION_STATUS_STORAGE_KEY);
    }
  };

  const engineExecutionSummary = useMemo(
    () =>
      AMRO_ENGINE_IMPLEMENTATION_EXECUTION_MATRIX.reduce(
        (accumulator, row) => {
          const status = getEffectiveEngineTaskStatus(row.id);
          accumulator.total += 1;
          if (status === 'pending') accumulator.pending += 1;
          if (status === 'in_progress') accumulator.inProgress += 1;
          if (status === 'completed') accumulator.completed += 1;
          return accumulator;
        },
        { total: 0, pending: 0, inProgress: 0, completed: 0 },
      ),
    [engineImplementationStatusByTask],
  );

  const filteredEngineExecutionRows = useMemo(() => {
    const normalized = engineTaskSearchQuery.trim().toLowerCase();
    return AMRO_ENGINE_IMPLEMENTATION_EXECUTION_MATRIX.filter((row) => {
      const capabilityMatch = engineCapabilityFilter === 'all' || row.capability === engineCapabilityFilter;
      const layerMatch = engineLayerFilter === 'all' || row.layer === engineLayerFilter;
      const status = getEffectiveEngineTaskStatus(row.id);
      const statusMatch = engineStatusFilter === 'all' || status === engineStatusFilter;
      const searchMatch =
        !normalized ||
        row.task.toLowerCase().includes(normalized) ||
        row.targetPermission.toLowerCase().includes(normalized) ||
        row.capability.toLowerCase().includes(normalized) ||
        row.layer.toLowerCase().includes(normalized);
      return capabilityMatch && layerMatch && statusMatch && searchMatch;
    });
  }, [engineCapabilityFilter, engineImplementationStatusByTask, engineLayerFilter, engineStatusFilter, engineTaskSearchQuery]);

  return (
    <div className="space-y-4">
      <Card data-amro-docs-surface="workspace-documentation">
        <CardHeader className="pb-2">
          <CardTitle>Workspace Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Document reference workspace with searchable links, category filtering, and saved bookmarks for AMRO contracts and implementation references.
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search references"
              aria-label="Search documentation references"
            />
            <Button variant={categoryFilter === 'all' ? 'default' : 'outline'} onClick={() => setCategoryFilter('all')}>
              All Categories
            </Button>
            <Badge variant="outline" className="justify-center px-3 py-2 text-xs">
              Filtered References: {filteredReferences.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AMRO_DOCUMENTATION_CATEGORY_LABEL) as Array<Exclude<AmroDocumentationCategory, 'all'>>).map((category) => (
              <Button
                key={category}
                variant={categoryFilter === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(category)}
              >
                {AMRO_DOCUMENTATION_CATEGORY_LABEL[category]}
              </Button>
            ))}
          </div>
          {bookmarkedReferences.length ? (
            <div className="rounded-md border p-3">
              <p className="text-xs font-semibold">Bookmarked References</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                {bookmarkedReferences.map((reference) => (
                  <a
                    key={`bookmark-${reference.id}`}
                    className="rounded-md border p-2 hover:bg-muted/30"
                    href={reference.href}
                    target={reference.external ? '_blank' : undefined}
                    rel={reference.external ? 'noreferrer' : undefined}
                  >
                    {reference.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {filteredReferences.map((reference) => {
              const isBookmarked = bookmarkedReferenceIds.includes(reference.id);
              return (
                <div key={reference.id} className="flex items-center gap-2 rounded-md border p-2">
                  <a
                    className="flex-1 hover:text-primary"
                    href={reference.href}
                    target={reference.external ? '_blank' : undefined}
                    rel={reference.external ? 'noreferrer' : undefined}
                  >
                    {reference.label}
                  </a>
                  <Button variant={isBookmarked ? 'default' : 'outline'} size="sm" onClick={() => toggleBookmark(reference.id)}>
                    {isBookmarked ? 'Saved' : 'Save'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card id="amro-doc-contracts" data-amro-contracts-surface="integration-contracts">
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
            {AMRO_DOCUMENTATION_REFERENCES.filter((reference) => reference.external).map((reference) => (
              <a key={reference.id} className="rounded-md border p-2 hover:bg-muted/30" href={reference.href} target="_blank" rel="noreferrer">
                {reference.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card id="amro-doc-module-catalog" data-amro-module-catalog-surface="module-catalog">
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
      <Card id="amro-doc-screen-inventory" data-amro-screen-inventory-surface="screen-inventory">
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
      <Card id="amro-doc-layout-contracts" data-amro-layout-contract-surface="layout-contracts">
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
      <Card id="amro-doc-uiux" data-amro-uiux-behavior-surface="behavior-rules">
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
            {AMRO_UIUX_BEHAVIOR_RULES.irreversibleActionProtection.dualConfirmationRequired ? 'enabled' : 'disabled'}; rationale capture:{' '}
            {AMRO_UIUX_BEHAVIOR_RULES.irreversibleActionProtection.rationaleCaptureRequired ? 'required' : 'optional'}.
          </div>
        </CardContent>
      </Card>
      <Card id="amro-doc-a11y" data-amro-a11y-i18n-surface="a11y-i18n">
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
      <Card id="amro-doc-phase-1" data-amro-phase-1-surface="phase-1-core-workflows">
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
      <Card id="amro-doc-phase-plan" data-amro-phase-plan-surface="phase-plan">
        <CardHeader className="pb-2">
          <CardTitle>AMRO Phase-Wise Implementation Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Delivery is sequenced by phases to preserve backward compatibility and controlled tenant/franchise rollout.
          </p>
          <Badge variant="outline">Phase Plan Source: {phasePlanSource === 'api' ? 'Live API' : 'Fallback Model'}</Badge>
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
      <Card id="amro-doc-engine-gap-matrix" data-amro-engine-gap-matrix-surface="engine-gap-matrix">
        <CardHeader className="pb-2">
          <CardTitle>AMRO Engine Gap-to-Implementation Matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Strict field-by-field implementation baseline for engine serial tracking, thrust rating, and on-wing lifecycle.
          </p>
          <Badge variant="outline">Status: Engine record model rollout in progress</Badge>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Execution Tasks: {engineExecutionSummary.total}</Badge>
            <Badge variant="outline">Pending: {engineExecutionSummary.pending}</Badge>
            <Badge variant="outline">In Progress: {engineExecutionSummary.inProgress}</Badge>
            <Badge variant="outline">Completed: {engineExecutionSummary.completed}</Badge>
            <Badge variant="outline">Visible Tasks: {filteredEngineExecutionRows.length}</Badge>
          </div>
          <div className="space-y-3">
            {AMRO_ENGINE_GAP_IMPLEMENTATION_MATRIX.map((row) => (
              <div key={row.capability} className="rounded-md border p-3">
                <p className="text-sm font-semibold">{row.capability}</p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                  <div className="rounded-md border p-2">
                    <p className="font-medium">Data Model</p>
                    <p className="mt-1 text-muted-foreground">{row.dataModel}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="font-medium">API</p>
                    <p className="mt-1 text-muted-foreground">{row.api}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="font-medium">UI</p>
                    <p className="mt-1 text-muted-foreground">{row.ui}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="font-medium">Validation</p>
                    <p className="mt-1 text-muted-foreground">{row.validation}</p>
                  </div>
                  <div className="rounded-md border p-2 md:col-span-2">
                    <p className="font-medium">Permissions</p>
                    <p className="mt-1 text-muted-foreground">{row.permissions}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Implementation Execution Matrix</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <Input
                value={engineTaskSearchQuery}
                onChange={(event) => setEngineTaskSearchQuery(event.target.value)}
                placeholder="Search execution tasks"
                aria-label="Search execution tasks"
              />
              <Button variant={engineCapabilityFilter === 'all' ? 'default' : 'outline'} onClick={() => setEngineCapabilityFilter('all')}>
                All Capabilities
              </Button>
              <Button variant={engineLayerFilter === 'all' ? 'default' : 'outline'} onClick={() => setEngineLayerFilter('all')}>
                All Layers
              </Button>
              <Button variant={engineStatusFilter === 'all' ? 'default' : 'outline'} onClick={() => setEngineStatusFilter('all')}>
                All Statuses
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {AMRO_ENGINE_IMPLEMENTATION_CAPABILITIES.map((capability) => (
                <Button
                  key={capability}
                  variant={engineCapabilityFilter === capability ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEngineCapabilityFilter(capability)}
                >
                  {capability}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {AMRO_ENGINE_IMPLEMENTATION_LAYERS.map((layer) => (
                <Button key={layer} variant={engineLayerFilter === layer ? 'default' : 'outline'} size="sm" onClick={() => setEngineLayerFilter(layer)}>
                  {layer}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {AMRO_ENGINE_IMPLEMENTATION_STATUSES.map((status) => (
                <Button
                  key={status}
                  variant={engineStatusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEngineStatusFilter(status)}
                >
                  {status === 'in_progress' ? 'in progress' : status}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateVisibleEngineTaskStatuses('pending', filteredEngineExecutionRows.map((row) => row.id))}
              >
                Mark Visible Pending
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateVisibleEngineTaskStatuses('in_progress', filteredEngineExecutionRows.map((row) => row.id))}
              >
                Mark Visible In Progress
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateVisibleEngineTaskStatuses('completed', filteredEngineExecutionRows.map((row) => row.id))}
              >
                Mark Visible Completed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEngineTaskSearchQuery('');
                  setEngineCapabilityFilter('all');
                  setEngineLayerFilter('all');
                  setEngineStatusFilter('all');
                }}
              >
                Reset Filters
              </Button>
              <Button variant="outline" size="sm" onClick={clearEngineImplementationStatuses}>
                Clear Saved Status
              </Button>
            </div>
            <div className="space-y-2">
              {filteredEngineExecutionRows.map((row) => {
                const status = getEffectiveEngineTaskStatus(row.id);
                const statusLabel = status === 'in_progress' ? 'in progress' : status;
                const statusBadgeVariant = status === 'completed' ? 'default' : status === 'in_progress' ? 'secondary' : 'outline';
                return (
                  <div key={row.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium">{row.capability}</p>
                        <p className="text-xs text-muted-foreground">{row.layer}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                        <Button variant="outline" size="sm" onClick={() => cycleEngineTaskStatus(row.id)}>
                          Update Status
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{row.task}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Target Permission: {row.targetPermission}</p>
                  </div>
                );
              })}
              {!filteredEngineExecutionRows.length ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No execution tasks match current filters.</div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AmroHubVerticalPage({ moduleKey }: AmroHubVerticalPageProps = {}) {
  const { t } = useTranslation();
  const {
    currentDomain,
    availableDomains = [],
    isLoading: isDomainLoading = false,
    setDomain,
  } = useDomain();
  const { hasRole, isPlatformAdmin } = useAuth();
  const { context } = useCRM();
  const hasAmroDomainAssigned = useMemo(
    () => availableDomains.some((domain) => String(domain.code || '').trim().toUpperCase() === 'AMRO'),
    [availableDomains],
  );
  const isAmroDomainActive = String(currentDomain?.code || '').trim().toUpperCase() === 'AMRO';
  const effectiveDomainCode = useMemo(
    () => (hasAmroDomainAssigned ? 'AMRO' : currentDomain?.code || null),
    [currentDomain?.code, hasAmroDomainAssigned],
  );
  const overviewScope = useMemo(
    () => ({
      tenantId: context.tenantId,
      franchiseId: context.franchiseId,
      userId: context.userId,
      domainCode: effectiveDomainCode,
    }),
    [context.franchiseId, context.tenantId, context.userId, effectiveDomainCode],
  );
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
    loadTrends,
  } = useAmroOverviewKpi(overviewScope);
  const overviewTelemetry = useMemo<AmroOverviewWorkspaceTelemetry>(() => {
    if (!dashboard) {
      return {};
    }
    const getKpiValue = (key: string) => dashboard.kpi_cards.find((card) => card.key === key)?.value;
    const openWorkOrders = dashboard.executive_summary.active_work_orders;
    const aogCount = getKpiValue('aog_count') ?? 0;
    const complianceRiskCount = getKpiValue('compliance_alerts') ?? dashboard.anomaly_flags.length;
    const deferredCount = dashboard.executive_summary.overdue_tasks;
    const fillRatePct = Number.isFinite(dashboard.executive_summary.compliance_status_pct)
      ? Math.max(0, Math.min(100, Math.round(dashboard.executive_summary.compliance_status_pct)))
      : undefined;
    const pipelineStages = ['planning', 'scheduled', 'in_progress'] as const;
    const pipelineSummary = pipelineStages
      .map((stage) => `${stage} ${dashboard.work_order_overview.filter((item) => item.status === stage).length}`)
      .join(' / ');
    const blockedCount = dashboard.work_order_overview.filter((item) => item.status === 'blocked').length;
    const criticalHeatmapCount = dashboard.risk_heatmap.cells.filter((cell) => String(cell.severity || '').toLowerCase() === 'high').length;
    const warningHeatmapCount = dashboard.risk_heatmap.cells.filter((cell) => String(cell.severity || '').toLowerCase() === 'medium').length;
    const recommendations = trends?.forecast_recommendation_hub || [];
    const highRiskRecommendations = recommendations.filter((item) => item.risk_score >= 80).length;
    const confidenceHigh = recommendations.filter((item) => item.confidence_pct >= 80).length;
    const confidenceMedium = recommendations.filter((item) => item.confidence_pct >= 50 && item.confidence_pct < 80).length;
    const confidenceLow = recommendations.filter((item) => item.confidence_pct < 50).length;
    const absoluteVariance = Math.abs(trends?.variance || 0);
    const slaTrendSummary = absoluteVariance <= 1 ? '7d / 30d stable' : `7d / 30d variance ${Math.round(absoluteVariance * 10) / 10}`;
    const dataFreshness = dashboard.freshness_warning || 'Within SLA window';
    const syncHealth = dashboard.integration_monitor.status === 'healthy' ? 'Healthy sync' : dashboard.integration_monitor.status;
    return {
      openWorkOrders,
      aogCount,
      complianceRiskCount,
      deferredCount,
      fillRatePct,
      pipelineSnapshot: `${pipelineSummary} with blocked ${blockedCount}`,
      riskHeatmapSummary: `critical ${criticalHeatmapCount}, warning ${warningHeatmapCount}`,
      forecastSummary: `recommendations ${recommendations.length} / high risk ${highRiskRecommendations}`,
      confidenceSegmentation: `high ${confidenceHigh} · medium ${confidenceMedium} · low ${confidenceLow}`,
      recommendedActions: recommendations[0]?.recommendation || 'maintenance interventions prioritized by risk and schedule impact.',
      slaTrendSummary,
      dataFreshness,
      syncHealth,
    };
  }, [dashboard, trends]);
  const [phasePlanRows, setPhasePlanRows] = useState<AmroPhasePlanUiRow[]>([...AMRO_PHASE_PLAN_MATRIX]);
  const [phasePlanSource, setPhasePlanSource] = useState<'api' | 'fallback'>('fallback');
  const [plannerFilter, setPlannerFilter] = useState<string>('');
  const [engineerFilter, setEngineerFilter] = useState<string>('');
  const [overviewDateRange, setOverviewDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [overviewRegionFilter, setOverviewRegionFilter] = useState<'all' | 'amer' | 'emea' | 'apac'>('all');
  const [overviewRegulatorProfile, setOverviewRegulatorProfile] = useState<'FAA' | 'EASA' | 'CAAC'>('FAA');
  const [overviewFleetFilter, setOverviewFleetFilter] = useState<string>('all');
  const [overviewStationFilter, setOverviewStationFilter] = useState<string>('all');
  const [overviewWorkOrderPage, setOverviewWorkOrderPage] = useState<number>(1);
  const [overviewTrendsPage, setOverviewTrendsPage] = useState<number>(1);
  const isWorkspaceDocumentationRoute = moduleKey === 'workspace-documentation';
  const isOverviewDashboardRoute = moduleKey === 'overview';
  const workspaceModuleKey = moduleKey === 'workspace-documentation' ? undefined : moduleKey;
  const isWorkspaceOnlyModuleRoute = Boolean(
    workspaceModuleKey && workspaceModuleKey !== 'overview',
  );
  const modulePageLabel = moduleKey ? AMRO_MODULE_PAGE_LABEL[moduleKey] : 'Operations Overview';

  useEffect(() => {
    if (isDomainLoading || isAmroDomainActive || !hasAmroDomainAssigned) {
      return;
    }
    void setDomain('AMRO');
  }, [hasAmroDomainAssigned, isAmroDomainActive, isDomainLoading, setDomain]);

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
  const overviewRealtimeState = useMemo(() => {
    if (error || dashboard?.integration_monitor.status === 'degraded') {
      return 'degraded';
    }
    if (loading || !dashboard) {
      return 'syncing';
    }
    return 'live';
  }, [dashboard, error, loading]);
  const overviewCriticalCards = useMemo(
    () => (dashboard?.kpi_cards || []).filter((card) => getMetricTier(card.key) === 'critical'),
    [dashboard?.kpi_cards, getMetricTier],
  );
  const overviewStandardCards = useMemo(
    () => (dashboard?.kpi_cards || []).filter((card) => getMetricTier(card.key) === 'standard'),
    [dashboard?.kpi_cards, getMetricTier],
  );
  const buildDateRangeWindow = (window: '7d' | '30d' | '90d'): string => {
    const days = window === '7d' ? 7 : window === '90d' ? 90 : 30;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    return `${start.toISOString()}|${end.toISOString()}`;
  };
  const formatDisplayDate = (value?: string) => {
    const normalized = String(value || '').trim();
    if (!normalized) return 'N/A';
    const parsed = Date.parse(normalized);
    if (!Number.isFinite(parsed)) return normalized;
    return new Date(parsed).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  };
  const formatPercent = (value?: number) => {
    if (!Number.isFinite(value)) return '0%';
    return `${Math.round(Number(value) * 10) / 10}%`;
  };
  const buildOverviewDashboardRequest = (page: number = overviewWorkOrderPage) => ({
    dateRange: buildDateRangeWindow(overviewDateRange),
    regionIds: overviewRegionFilter !== 'all' ? [overviewRegionFilter.toUpperCase()] : undefined,
    stationIds: overviewStationFilter !== 'all' ? [overviewStationFilter] : undefined,
    fleetIds: overviewFleetFilter !== 'all' ? [overviewFleetFilter] : undefined,
    regulatorProfile: overviewRegulatorProfile,
    plannerId: plannerFilter.trim() || undefined,
    engineerId: engineerFilter.trim() || undefined,
    page,
    pageSize: OVERVIEW_WORK_PACKAGE_PAGE_SIZE,
  });
  const buildOverviewTrendsRequest = (page: number = overviewTrendsPage) => ({
    metricKey: 'schedule_adherence',
    window: overviewDateRange,
    compareWindow: '30d',
    page,
    pageSize: OVERVIEW_TRENDS_PAGE_SIZE,
  });
  const applyScopeFilters = async () => {
    setOverviewWorkOrderPage(1);
    setOverviewTrendsPage(1);
    await Promise.all([
      loadDashboard(buildOverviewDashboardRequest(1)),
      loadTrends(buildOverviewTrendsRequest(1)),
    ]);
  };
  const handleOverviewWorkspaceRefresh = async () => {
    await Promise.all([
      loadDashboard(buildOverviewDashboardRequest()),
      loadTrends(buildOverviewTrendsRequest()),
    ]);
  };
  const handleOverviewWorkspaceExport = async () => {
    await exportSnapshot({
      format: 'pdf',
      dateRange: buildDateRangeWindow(overviewDateRange),
      selectedWidgets: ['kpi_cards', 'risk_heatmap', 'trend_lines', 'anomaly_flags'],
    });
  };
  const handleOverviewDateRangeCycle = () => {
    setOverviewDateRange((previous) => (previous === '7d' ? '30d' : previous === '30d' ? '90d' : '7d'));
  };
  const handleOverviewRegionCycle = () => {
    setOverviewRegionFilter((previous) => (previous === 'all' ? 'amer' : previous === 'amer' ? 'emea' : previous === 'emea' ? 'apac' : 'all'));
  };
  const handleOverviewRegulatorProfileCycle = () => {
    setOverviewRegulatorProfile((previous) => (previous === 'FAA' ? 'EASA' : previous === 'EASA' ? 'CAAC' : 'FAA'));
  };
  const overviewControls: AmroOverviewWorkspaceControls = {
    dateRange: overviewDateRange,
    regulatorProfile: overviewRegulatorProfile,
    fleetFilter: overviewFleetFilter,
    stationFilter: overviewStationFilter,
    onCycleDateRange: handleOverviewDateRangeCycle,
    onCycleRegulatorProfile: handleOverviewRegulatorProfileCycle,
    onFleetFilterChange: setOverviewFleetFilter,
    onStationFilterChange: setOverviewStationFilter,
    onRefresh: () => {
      void handleOverviewWorkspaceRefresh();
    },
    onExport: () => {
      void handleOverviewWorkspaceExport();
    },
    exporting,
  };
  const handleOverviewRouteRefresh = async () => {
    logger.info('AMRO overview dashboard refresh triggered', {
      component: 'AmroHubVerticalPage',
      route: 'overview',
      persona: activePersona,
      domain: effectiveDomainCode,
    });
    await Promise.all([
      loadDashboard(buildOverviewDashboardRequest()),
      loadTrends(buildOverviewTrendsRequest()),
    ]);
  };
  const handleOverviewRouteExport = async () => {
    logger.info('AMRO overview dashboard export triggered', {
      component: 'AmroHubVerticalPage',
      route: 'overview',
      persona: activePersona,
      domain: effectiveDomainCode,
    });
    await exportSnapshot({
      format: 'pdf',
      dateRange: buildDateRangeWindow(overviewDateRange),
      selectedWidgets: ['kpi_cards', 'risk_heatmap', 'trend_lines', 'anomaly_flags'],
    });
  };
  const handleOverviewRouteExportExcel = async () => {
    logger.info('AMRO overview dashboard excel export triggered', {
      component: 'AmroHubVerticalPage',
      route: 'overview',
      persona: activePersona,
      domain: effectiveDomainCode,
    });
    await exportSnapshot({
      format: 'xlsx',
      dateRange: buildDateRangeWindow(overviewDateRange),
      selectedWidgets: ['kpi_cards', 'risk_heatmap', 'trend_lines', 'anomaly_flags'],
    });
  };
  const overviewTrendSeries = useMemo(() => {
    const fromTrendEndpoint = trends?.time_series?.map((point) => ({
      date: point.date,
      value: point.value,
    })) || [];
    if (fromTrendEndpoint.length > 0) {
      return fromTrendEndpoint;
    }
    const fallbackSeries = dashboard?.trend_lines?.[0]?.points?.map((point) => ({
      date: point.date,
      value: point.value,
    })) || [];
    return fallbackSeries;
  }, [dashboard?.trend_lines, trends?.time_series]);
  const overviewRiskBySeverity = useMemo(() => {
    const bucket = new Map<string, number>();
    (dashboard?.risk_heatmap?.cells || []).forEach((cell) => {
      const severity = cell.severity || 'unknown';
      bucket.set(severity, (bucket.get(severity) || 0) + cell.score);
    });
    return Array.from(bucket.entries()).map(([severity, score]) => ({ severity, score }));
  }, [dashboard?.risk_heatmap?.cells]);
  const workOrderCurrentPage = dashboard?.pagination?.page || overviewWorkOrderPage;
  const workOrderTotalPages = dashboard?.pagination?.total_pages || 1;
  const trendsCurrentPage = trends?.pagination?.page || overviewTrendsPage;
  const trendsTotalRows = Math.max(
    trends?.pagination?.audit_timeline_total_rows || 0,
    trends?.pagination?.certification_queue_total_rows || 0,
  );
  const trendsPageSize = trends?.pagination?.page_size || OVERVIEW_TRENDS_PAGE_SIZE;
  const trendsTotalPages = Math.max(1, Math.ceil((trendsTotalRows || (trends?.audit_timeline?.length || 0)) / trendsPageSize));
  const handleWorkOrderPageChange = async (nextPage: number) => {
    const safePage = Math.max(1, nextPage);
    setOverviewWorkOrderPage(safePage);
    await loadDashboard(buildOverviewDashboardRequest(safePage));
  };
  const handleTrendsPageChange = async (nextPage: number) => {
    const safePage = Math.max(1, nextPage);
    setOverviewTrendsPage(safePage);
    await loadTrends(buildOverviewTrendsRequest(safePage));
  };

  useEffect(() => {
    if (!isWorkspaceDocumentationRoute) {
      setPhasePlanSource('fallback');
      return;
    }
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
  }, [isWorkspaceDocumentationRoute]);

  return (
    <DashboardLayout>
      <AmroModuleShell>
        <div className="flex-1 space-y-4 p-6" data-amro-uiux="base-preserved">
          {isOverviewDashboardRoute ? (
            <Card data-amro-overview-surface="next-gen">
              <CardHeader className="pb-2">
                <CardTitle>{t('amro.overview.intelligenceHub', { defaultValue: 'AMRO Operations Intelligence Hub' })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <p className="text-sm text-muted-foreground">
                  {t('amro.overview.description', {
                    defaultValue: 'Live operations, predictive recommendations, and compliance command for AMRO tenant workflows.',
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={isAmroDomainActive ? 'secondary' : 'destructive'}>
                    {isAmroDomainActive
                      ? t('amro.overview.domainActive', { defaultValue: 'AMRO Domain Context Active' })
                      : t('amro.overview.domainRequired', { defaultValue: 'AMRO Domain Context Required' })}
                  </Badge>
                  <Badge variant="outline">{t('amro.overview.persona', { defaultValue: 'Persona' })}: {activePersona.replace('_', ' ')}</Badge>
                  <Badge variant="outline">
                    {t('amro.overview.criticalRefresh', { defaultValue: 'Critical Refresh' })}: {Math.round(refreshCadence.criticalMs / 1000)}s
                  </Badge>
                  <Badge variant="outline">
                    {t('amro.overview.standardRefresh', { defaultValue: 'Standard Refresh' })}: {Math.round(refreshCadence.standardMs / 1000)}s
                  </Badge>
                  <Badge variant={overviewRealtimeState === 'degraded' ? 'destructive' : 'outline'}>
                    {t('amro.overview.realtimeState', { defaultValue: 'Realtime State' })}: {overviewRealtimeState}
                  </Badge>
                  {lastDashboardRefreshAt ? (
                    <Badge variant="outline">
                      {t('amro.overview.lastDashboardRefresh', { defaultValue: 'Dashboard Refresh' })}: {lastDashboardRefreshAt}
                    </Badge>
                  ) : null}
                  {lastTrendsRefreshAt ? (
                    <Badge variant="outline">
                      {t('amro.overview.lastTrendsRefresh', { defaultValue: 'Trend Refresh' })}: {lastTrendsRefreshAt}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleOverviewDateRangeCycle} aria-label="Cycle date range filter">
                    {t('amro.overview.dateRange', { defaultValue: 'Date Range' })}: {overviewDateRange}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleOverviewRegionCycle} aria-label="Cycle region filter">
                    {t('amro.overview.region', { defaultValue: 'Region' })}: {overviewRegionFilter.toUpperCase()}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleOverviewRouteRefresh()}>
                    {t('amro.overview.refreshAction', { defaultValue: 'Refresh Overview' })}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void applyScopeFilters()}>
                    {t('amro.overview.applyFilters', { defaultValue: 'Apply Filters' })}
                  </Button>
                  {canExportKpiSnapshot ? (
                    <>
                      <Button size="sm" variant="outline" disabled={exporting} onClick={() => void handleOverviewRouteExport()}>
                        {exporting
                          ? t('amro.overview.exporting', { defaultValue: 'Exporting Snapshot...' })
                          : t('amro.overview.exportPdfAction', { defaultValue: 'Export PDF' })}
                      </Button>
                      <Button size="sm" variant="outline" disabled={exporting} onClick={() => void handleOverviewRouteExportExcel()}>
                        {exporting
                          ? t('amro.overview.exporting', { defaultValue: 'Exporting Snapshot...' })
                          : t('amro.overview.exportExcelAction', { defaultValue: 'Export Excel' })}
                      </Button>
                    </>
                  ) : (
                    <Badge variant="outline">
                      {t('amro.overview.exportRestricted', { defaultValue: 'Export restricted to tenant/platform admin persona' })}
                    </Badge>
                  )}
                </div>
                {error ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3" role="alert" aria-live="polite">
                    <p className="font-semibold">{t('amro.overview.degradedTitle', { defaultValue: 'Overview Degraded State' })}</p>
                    <p className="mt-1 text-muted-foreground">{error}</p>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" role="region" aria-label="AMRO Next Gen Overview KPI Grid">
                  {overviewCriticalCards.concat(overviewStandardCards).slice(0, 6).map((card) => (
                    <div key={card.key} className="rounded-md border p-3">
                      <p className="text-[11px] text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-base font-semibold">{card.value}</p>
                      <Badge className="mt-2" variant={getMetricTier(card.key) === 'critical' ? 'destructive' : 'secondary'}>
                        {t('amro.overview.trend', { defaultValue: 'Trend' })} {card.trend}
                      </Badge>
                    </div>
                  ))}
                  {!dashboard?.kpi_cards?.length ? (
                    <div className="rounded-md border p-3 text-muted-foreground">
                      {t('amro.overview.noKpis', { defaultValue: 'No KPI cards available for the active scope.' })}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                  <div className="rounded-md border p-3 xl:col-span-6" role="region" aria-label="Trend Analysis Chart">
                    <p className="font-semibold">{t('amro.overview.trendAnalysis', { defaultValue: 'Trend Analysis' })}</p>
                    <div className="mt-3 h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={overviewTrendSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" hide />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-md border p-3 xl:col-span-6" role="region" aria-label="Risk Heatmap Severity Chart">
                    <p className="font-semibold">{t('amro.overview.riskHeatmap', { defaultValue: 'Risk Heatmap by Severity' })}</p>
                    <div className="mt-3 h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={overviewRiskBySeverity}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="severity" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="score" fill="hsl(var(--destructive))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="rounded-md border p-3 xl:col-span-4" role="region" aria-label="Critical Signal Board">
                    <p className="font-semibold">{t('amro.overview.criticalSignalBoard', { defaultValue: 'Critical Signal Board' })}</p>
                    <p className="mt-2 text-muted-foreground">
                      {t('amro.overview.activeWorkOrders', { defaultValue: 'Active Work Packages' })}: {dashboard?.executive_summary.active_work_orders ?? 0}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t('amro.overview.overdueTasks', { defaultValue: 'Overdue Tasks' })}: {dashboard?.executive_summary.overdue_tasks ?? 0}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t('amro.overview.complianceStatus', { defaultValue: 'Compliance Status %' })}: {dashboard?.executive_summary.compliance_status_pct ?? 0}
                    </p>
                  </div>
                  <div className="rounded-md border p-3 xl:col-span-4" role="region" aria-label="Predictive Recommendation Queue">
                    <p className="font-semibold">{t('amro.overview.predictiveQueue', { defaultValue: 'Predictive Recommendation Queue' })}</p>
                    <div className="mt-2 space-y-1">
                      {(trends?.forecast_recommendation_hub || []).slice(0, 5).map((item) => (
                        <div key={item.recommendation_id} className="rounded-md border p-2">
                          {item.recommendation} | {t('amro.overview.confidence', { defaultValue: 'Confidence' })}: {item.confidence_pct}% | {t('amro.overview.risk', { defaultValue: 'Risk' })}:{' '}
                          {item.risk_score}
                        </div>
                      ))}
                      {!trends?.forecast_recommendation_hub?.length ? (
                        <p className="text-muted-foreground">
                          {t('amro.overview.noRecommendations', { defaultValue: 'No predictive recommendations returned.' })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-md border p-3 xl:col-span-4" role="region" aria-label="Compliance and Integration Command">
                    <p className="font-semibold">{t('amro.overview.complianceIntegrationCommand', { defaultValue: 'Compliance and Integration Command' })}</p>
                    <p className="mt-2 text-muted-foreground">
                      {t('amro.overview.integrationHealth', { defaultValue: 'Integration Health' })}: {dashboard?.integration_monitor?.status || 'unknown'}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t('amro.overview.failureRate', { defaultValue: 'Failure Rate' })}: {dashboard?.integration_monitor?.failure_rate_pct || 0}%
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t('amro.overview.complianceQueue', { defaultValue: 'Compliance Gates' })}: {dashboard?.compliance_gate_status?.length || 0}
                    </p>
                  </div>
                </div>
                {(dashboard?.data_issues?.length || trends?.data_issues?.length) ? (
                  <div className="rounded-md border border-warning/50 bg-warning/10 p-3" aria-live="polite">
                    <p className="font-semibold">{t('amro.overview.dataIssues', { defaultValue: 'Data Connectivity Issues' })}</p>
                    {dashboard?.data_issues?.slice(0, 3).map((issue) => (
                      <p key={`dashboard-overview-${issue}`} className="mt-1 text-muted-foreground">{issue}</p>
                    ))}
                    {trends?.data_issues?.slice(0, 3).map((issue) => (
                      <p key={`trends-overview-${issue}`} className="mt-1 text-muted-foreground">{issue}</p>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <>
              {moduleKey === 'work-orders' ? (
                <AmroWorkOrdersListPage />
              ) : isWorkspaceDocumentationRoute ? (
                <AmroWorkspaceDocumentationReference phasePlanRows={phasePlanRows} phasePlanSource={phasePlanSource} />
              ) : (
                <AmroWorkspaceSurface
                  moduleKey={workspaceModuleKey}
                  overviewPersona={activePersona}
                  overviewControls={overviewControls}
                  overviewTelemetry={overviewTelemetry}
                />
              )}
            </>
          )}
        </div>
      </AmroModuleShell>
    </DashboardLayout>
  );
}

export function AmroOverviewPage() {
  return <AmroHubVerticalPage moduleKey="overview" />;
}

export function AmroPrimaryUsersPage() {
  return <AmroHubVerticalPage moduleKey="primary-users" />;
}

export function AmroWorkOrdersPage() {
  return <AmroHubVerticalPage moduleKey="work-orders" />;
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

export function AmroWorkspaceDocumentationPage() {
  return <AmroHubVerticalPage moduleKey="workspace-documentation" />;
}
