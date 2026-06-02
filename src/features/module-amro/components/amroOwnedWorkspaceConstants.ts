// Constants + types + factory functions extracted from AmroOwnedWorkspace.tsx
// (Slice E / AMRO god-component split continuation). All static — no React state.

import type { AmroAuthorityLevel, AmroAssetType } from '../workspace/amroWorkspaceModel';

// ── Labels ──────────────────────────────────────────────────────────────────

export const assetTypeLabel: Record<AmroAssetType, string> = {
  aircraft: 'Aircraft',
  engine: 'Engine',
  serialized_component: 'Serialized Component',
  heavy_asset: 'Heavy Asset',
};

export const authorityLabel: Record<AmroAuthorityLevel, string> = {
  technician: 'Technician',
  supervisor: 'Supervisor',
  engineering: 'Engineering',
  qa: 'QA',
  compliance: 'Compliance',
};

// ── Option lists ────────────────────────────────────────────────────────────

export const authorityOptions: AmroAuthorityLevel[] = [
  'technician', 'supervisor', 'engineering', 'qa', 'compliance',
];

export const workOrderStatusFilters = [
  'all', 'planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled',
] as const;

export const regulatorProfileOptions = ['FAA', 'EASA', 'CAAC'] as const;
export const certificationAuthorityProfileOptions = ['FAA', 'EASA', 'CAAC'] as const;
export const workspaceViewModes = ['kanban', 'card', 'grid', 'list'] as const;
export const amroHeaderActionOrder = [
  'Search', 'Filter', 'View', 'Create', 'Refresh', 'Import/Export', 'Theme',
] as const;
export const workspaceThemeOptions = ['Azure Sky', 'Hangar Dark', 'Maintenance Slate'] as const;
export const workOrderPageSizes = [10, 25, 50] as const;
export const workspaceLocaleOptions = ['en-US', 'en-GB', 'fr-FR', 'de-DE'] as const;

// ── Storage keys (persisted user preferences) ───────────────────────────────

export const amroWorkspaceViewStorageKey = 'amro.workspace.view';
export const amroWorkspaceThemeStorageKey = 'amro.workspace.theme';
export const amroWorkOrderPageSizeStorageKey = 'amro.workspace.work-order-page-size';
export const amroWorkspaceLocaleStorageKey = 'amro.workspace.locale';
export const amroManualWorkOrderOrderStorageKey = 'amro.workspace.work-order-order';
export const amroGridPreferencesStorageKey = 'amro-grid-preferences';

// ── Performance benchmarks (used by perf telemetry) ─────────────────────────

export const amroDashboardLoadBenchmark = { targetMs: 1000, hardLimitMs: 1500 };
export const amroWorkOrderFilterApplyBenchmark = { targetMs: 500, hardLimitMs: 900 };
export const amroDetailTabSwitchBenchmark = { targetMs: 250, hardLimitMs: 500 };
export const amroTaskStepSubmitBenchmark = { targetMs: 400, hardLimitMs: 800 };

// ── Types ───────────────────────────────────────────────────────────────────

export type AmroUxRole = 'technician' | 'engineer' | 'inspector' | 'planner' | 'management';

export type AmroWorkspaceModuleKey =
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

export type AmroOwnedWorkspaceProps = {
  moduleKey?: AmroWorkspaceModuleKey;
  overviewPersona?: 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user';
  overviewControls?: {
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
  overviewTelemetry?: {
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
};

export type AmroModuleAction = {
  id: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  disabledReason: string;
};

export type AmroRoleVariant = {
  primaryViews: string;
  coreActions: string;
  restrictedActions: string;
};

export type WorkOrderCreateTab = 'wp' | 'besting_wp' | 'task_payload' | 'workflow';

export type WorkOrderCreateFormState = {
  packageNumber: string;
  topic: string;
  locationStation: string;
  planningDate: string;
  remarks: string;
  createdBy: string;
  aircraftId: string;
  selectedAircraftModel: string;
  selectedAircraftSerialOrRegistration: string;
  workOrderDetails: string;
  revision: string;
  selectedTaskIds: string[];
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  priority: 'low' | 'medium' | 'high' | 'critical';
  plannedStartDate: string;
  plannedEndDate: string;
  assignedRole: 'planner' | 'engineer' | 'inspector' | 'technician';
  workflowStatus: 'planning' | 'scheduled' | 'in_progress' | 'blocked';
};

export type WorkOrderCreateFormErrors = Partial<Record<keyof WorkOrderCreateFormState, string>>;

export type WorkOrderCreateAircraftOption = {
  id: string;
  registration: string;
  serialNumber: string;
  aircraftModel: string;
  aircraftType: string;
  operatorCode: string;
  ownerName: string;
  stationCode: string;
  status: string;
  currentFlightHours: number;
  currentCycles: number;
};

export type WorkOrderCreateTaskOption = {
  value: string;
  taskNumber: string;
  title: string;
  dueBasis: string;
  dueDate: string;
  estimatedManHours: string;
  status: string;
  category: string;
  modelTags: string[];
};

export type TaskConflictInfo = {
  taskId: string;
  reason: string;
};

export type WorkOrderGridColumnKey =
  | 'packageNumber' | 'aircraft' | 'priority' | 'category' | 'station' | 'due' | 'status' | 'owner';

export type WorkOrderGridSortKey = WorkOrderGridColumnKey;

export type WorkOrderGridPreferences = {
  visibleColumns: Record<WorkOrderGridColumnKey, boolean>;
  columnWidths: Record<WorkOrderGridColumnKey, number>;
};

export type WorkOrderGridRuntimeRow = {
  id: string;
  packageNumber: string;
  aircraft: string;
  priority: string;
  category: string;
  station: string;
  due: string;
  status: string;
  owner: string;
  dueEpoch: number;
};

export type PartsFormSectionKey = 'basic' | 'stock' | 'location' | 'supplier';

// ── Grid defaults ───────────────────────────────────────────────────────────

export const defaultGridVisibleColumns: Record<WorkOrderGridColumnKey, boolean> = {
  packageNumber: true,
  aircraft: true,
  priority: true,
  category: true,
  station: true,
  due: true,
  status: true,
  owner: true,
};

export const defaultGridColumnWidths: Record<WorkOrderGridColumnKey, number> = {
  packageNumber: 140,
  aircraft: 160,
  priority: 110,
  category: 120,
  station: 120,
  due: 170,
  status: 130,
  owner: 120,
};

export const workOrderGridColumnLabels: Record<WorkOrderGridColumnKey, string> = {
  packageNumber: 'Work Order #',
  aircraft: 'Aircraft',
  priority: 'Priority',
  category: 'Maintenance Category',
  station: 'Station',
  due: 'Due / Slot End',
  status: 'Lifecycle Status',
  owner: 'Owner',
};

export const workOrderGridSortableColumns: WorkOrderGridSortKey[] = [
  'packageNumber', 'aircraft', 'priority', 'category', 'station', 'due', 'status', 'owner',
];

// ── Role variants (UX role → capability description) ────────────────────────

export const amroRoleVariants: Record<AmroUxRole, AmroRoleVariant> = {
  technician: {
    primaryViews: 'Task cards, assigned work package details',
    coreActions: 'Execute steps, capture evidence, request support',
    restrictedActions: 'Work package closure, compliance override',
  },
  engineer: {
    primaryViews: 'Work package detail, materials, schedule board',
    coreActions: 'Plan tasks, assign resources, adjust estimates',
    restrictedActions: 'Regulatory final sign-off',
  },
  inspector: {
    primaryViews: 'Compliance gate, audit timeline, evidence review',
    coreActions: 'Validate evidence, approve/reject tasks',
    restrictedActions: 'Parts allocation edits',
  },
  planner: {
    primaryViews: 'Work package list, scheduler board, capacity views',
    coreActions: 'Create/plan/schedule work packages',
    restrictedActions: 'Certifying release',
  },
  management: {
    primaryViews: 'Overview dashboards, SLA/compliance analytics',
    coreActions: 'Monitor KPIs, approve exceptions',
    restrictedActions: 'Direct task execution',
  },
};

// ── Factory ─────────────────────────────────────────────────────────────────

export const createDefaultWorkOrderCreateFormState = (): WorkOrderCreateFormState => {
  const start = new Date();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const today = start.toISOString().slice(0, 10);
  return {
    packageNumber: '',
    topic: '',
    locationStation: '',
    planningDate: today,
    remarks: '',
    createdBy: 'planner',
    aircraftId: '',
    selectedAircraftModel: '',
    selectedAircraftSerialOrRegistration: '',
    workOrderDetails: '',
    revision: '1',
    selectedTaskIds: [],
    maintenanceType: 'line',
    priority: 'medium',
    plannedStartDate: start.toISOString().slice(0, 10),
    plannedEndDate: end.toISOString().slice(0, 10),
    assignedRole: 'planner',
    workflowStatus: 'planning',
  };
};
