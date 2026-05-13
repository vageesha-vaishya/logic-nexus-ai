import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button, Checkbox, Input, Input as TextInput, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from '@/design-system';
import { CRMDatePicker as DatePicker } from '@/design-system/components/molecules';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { ArrowDownUp, ChevronDown, ChevronUp, Copy, Download, Eye, GripVertical, PauseCircle, PlayCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, memo, type MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAmroWorkspaceState } from '../hooks/useAmroWorkspaceState';
import type { AmroAuthorityLevel, AmroAssetType } from '../workspace/amroWorkspaceModel';
import { AmroPartsInventoryWorkbench } from './parts/AmroPartsInventoryWorkbench';
import { AmroItemMasterCatalogPanel } from './parts/AmroItemMasterCatalogPanel';
import { AmroStockLedgerPanel } from './parts/AmroStockLedgerPanel';
import { AmroPartsNavigationShell } from './parts/AmroPartsNavigationShell';
import { AnalyticsPanel, IssueConsumePanel, LocationsPanel, ReservationsPanel, RestockPanel } from './parts/AmroPartsModulePanels';
import { AmroKpiGrid, AmroModuleSurface } from './parts/AmroPartsUiStandards';
import type { PartsNavigationModuleId } from './parts/partsNavigationConfig';
import type { ItemMasterRecord } from './parts/itemMasterCatalogApi';
import {
  createAmroPartRecord,
  createAmroPartsCatalogApi,
  deleteAmroPartRecord,
  updateAmroPartRecord,
  type PartsMutationPayload,
} from './parts/livePartsCatalogApi';
import { usePartsCatalogState } from './parts/usePartsCatalogState';
import type { PartInventoryRecord } from './parts/mockPartsInventoryData';
import {
  PARTS_FORM_ADVANCED_FIELDS,
  PARTS_FORM_CORE_FIELDS,
  PARTS_FORM_REQUIRED_KEYS,
  type PartsFormFieldKey,
  type PartsFormFieldSchema,
} from './parts/partsDetailSchema';

const assetTypeLabel: Record<AmroAssetType, string> = {
  aircraft: 'Aircraft',
  engine: 'Engine',
  serialized_component: 'Serialized Component',
  heavy_asset: 'Heavy Asset',
};

const authorityLabel: Record<AmroAuthorityLevel, string> = {
  technician: 'Technician',
  supervisor: 'Supervisor',
  engineering: 'Engineering',
  qa: 'QA',
  compliance: 'Compliance',
};

const authorityOptions: AmroAuthorityLevel[] = ['technician', 'supervisor', 'engineering', 'qa', 'compliance'];
const workOrderStatusFilters = ['all', 'planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'] as const;
const regulatorProfileOptions = ['FAA', 'EASA', 'CAAC'] as const;
const certificationAuthorityProfileOptions = ['FAA', 'EASA', 'CAAC'] as const;
const workspaceViewModes = ['kanban', 'card', 'grid', 'list'] as const;
const amroHeaderActionOrder = ['Search', 'Filter', 'View', 'Create', 'Refresh', 'Import/Export', 'Theme'] as const;
const workspaceThemeOptions = ['Azure Sky', 'Hangar Dark', 'Maintenance Slate'] as const;
const workOrderPageSizes = [10, 25, 50] as const;
const workspaceLocaleOptions = ['en-US', 'en-GB', 'fr-FR', 'de-DE'] as const;
const amroWorkspaceViewStorageKey = 'amro.workspace.view';
const amroWorkspaceThemeStorageKey = 'amro.workspace.theme';
const amroWorkOrderPageSizeStorageKey = 'amro.workspace.work-order-page-size';
const amroWorkspaceLocaleStorageKey = 'amro.workspace.locale';
const amroManualWorkOrderOrderStorageKey = 'amro.workspace.work-order-order';
const amroGridPreferencesStorageKey = 'amro-grid-preferences';
const amroDashboardLoadBenchmark = { targetMs: 1000, hardLimitMs: 1500 };
const amroWorkOrderFilterApplyBenchmark = { targetMs: 500, hardLimitMs: 900 };
const amroDetailTabSwitchBenchmark = { targetMs: 250, hardLimitMs: 500 };
const amroTaskStepSubmitBenchmark = { targetMs: 400, hardLimitMs: 800 };
type AmroUxRole = 'technician' | 'engineer' | 'inspector' | 'planner' | 'management';
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

type AmroOwnedWorkspaceProps = {
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

type AmroModuleAction = {
  id: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  disabledReason: string;
};

type AmroRoleVariant = {
  primaryViews: string;
  coreActions: string;
  restrictedActions: string;
};

type WorkOrderCreateTab = 'wp' | 'besting_wp' | 'task_payload' | 'workflow';

type WorkOrderCreateFormState = {
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

type WorkOrderCreateFormErrors = Partial<Record<keyof WorkOrderCreateFormState, string>>;

type WorkOrderCreateAircraftOption = {
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

type WorkOrderCreateTaskOption = {
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

type TaskConflictInfo = {
  taskId: string;
  reason: string;
};

type WorkOrderGridColumnKey = 'packageNumber' | 'aircraft' | 'priority' | 'category' | 'station' | 'due' | 'status' | 'owner';

type WorkOrderGridSortKey = WorkOrderGridColumnKey;

type WorkOrderGridPreferences = {
  visibleColumns: Record<WorkOrderGridColumnKey, boolean>;
  columnWidths: Record<WorkOrderGridColumnKey, number>;
};

type WorkOrderGridRuntimeRow = {
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

type PartsFormSectionKey = 'basic' | 'stock' | 'location' | 'supplier';

const defaultGridVisibleColumns: Record<WorkOrderGridColumnKey, boolean> = {
  packageNumber: true,
  aircraft: true,
  priority: true,
  category: true,
  station: true,
  due: true,
  status: true,
  owner: true,
};

const defaultGridColumnWidths: Record<WorkOrderGridColumnKey, number> = {
  packageNumber: 140,
  aircraft: 160,
  priority: 110,
  category: 120,
  station: 120,
  due: 170,
  status: 130,
  owner: 120,
};

const workOrderGridColumnLabels: Record<WorkOrderGridColumnKey, string> = {
  packageNumber: 'Work Order #',
  aircraft: 'Aircraft',
  priority: 'Priority',
  category: 'Maintenance Category',
  station: 'Station',
  due: 'Due / Slot End',
  status: 'Lifecycle Status',
  owner: 'Owner',
};

const workOrderGridSortableColumns: WorkOrderGridSortKey[] = ['packageNumber', 'aircraft', 'priority', 'category', 'station', 'due', 'status', 'owner'];

const amroRoleVariants: Record<AmroUxRole, AmroRoleVariant> = {
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

const createDefaultWorkOrderCreateFormState = (): WorkOrderCreateFormState => {
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

/**
 * Memoized Aircraft Search Component
 * Extracted to prevent flickering caused by parent component re-renders
 */
const AircraftSearchSection = memo(function AircraftSearchSection({
  aircraftSearchTerm,
  onSearchChange,
  filteredAircraftOptions,
  selectedAircraftId,
  onSelectAircraft,
  isLoading,
  selectedAircraft,
}: {
  aircraftSearchTerm: string;
  onSearchChange: (value: string) => void;
  filteredAircraftOptions: WorkOrderCreateAircraftOption[];
  selectedAircraftId: string | undefined;
  onSelectAircraft: (id: string) => void;
  isLoading: boolean;
  selectedAircraft: WorkOrderCreateAircraftOption | null;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="wp-aircraft-search">Aircraft</Label>
      <TextInput id="wp-aircraft-search" value={aircraftSearchTerm} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search model, registration, serial" />
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading aircraft...</p>
        ) : filteredAircraftOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No aircraft found in tenant scope.</p>
        ) : (
          filteredAircraftOptions.map((aircraft) => (
            <Button
              key={aircraft.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectAircraft(aircraft.id)}
              className={`h-auto w-full justify-start rounded-md border px-3 py-2 text-left text-xs ${selectedAircraftId === aircraft.id ? 'border-primary bg-primary/10' : 'border-border'}`}
              aria-pressed={selectedAircraftId === aircraft.id}
            >
              <p className="font-medium">{aircraft.aircraftModel || 'Unknown Model'} · {aircraft.registration || '-'}</p>
              <p className="text-muted-foreground">SN {aircraft.serialNumber || '-'} · Station {aircraft.stationCode || '-'}</p>
            </Button>
          ))
        )}
      </div>
      {selectedAircraft ? (
        <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-xs">
          <div>Model: {selectedAircraft.aircraftModel || '-'}</div>
          <div>Serial: {selectedAircraft.serialNumber || '-'}</div>
          <div>Registration: {selectedAircraft.registration || '-'}</div>
          <div>Hours/Cycles: {selectedAircraft.currentFlightHours}/{selectedAircraft.currentCycles}</div>
          <div>Status: {selectedAircraft.status || '-'}</div>
          <div>Operator: {selectedAircraft.operatorCode || '-'}</div>
        </div>
      ) : null}
    </div>
  );
});

export function AmroOwnedWorkspace({
  moduleKey,
  overviewPersona: _overviewPersona = 'tenant_admin',
  overviewControls: _overviewControls,
  overviewTelemetry: _overviewTelemetry,
}: AmroOwnedWorkspaceProps) {
  const { scopedDb, context } = useCRM();
  const { session, hasRole } = useAuth();
  const state = useAmroWorkspaceState();
  const [newWorkOrderTitle, setNewWorkOrderTitle] = useState('');
  const [savedViewName, setSavedViewName] = useState('');
  const [detailTab, setDetailTab] = useState('overview');
  const [detailDraft, setDetailDraft] = useState('');
  const [lastSavedDetailDraft, setLastSavedDetailDraft] = useState('');
  const [workspaceViewMode, setWorkspaceViewMode] = useState<(typeof workspaceViewModes)[number]>('kanban');
  const [workspaceTheme, setWorkspaceTheme] = useState<(typeof workspaceThemeOptions)[number]>('Azure Sky');
  const [workspaceLocale, setWorkspaceLocale] = useState<(typeof workspaceLocaleOptions)[number]>('en-US');
  const [workOrderPageSize, setWorkOrderPageSize] = useState<number>(workOrderPageSizes[0]);
  const [workOrderPage, setWorkOrderPage] = useState(1);
  const [workOrderSortField, setWorkOrderSortField] = useState<'manual' | WorkOrderGridSortKey>('manual');
  const [workOrderSortDirection, setWorkOrderSortDirection] = useState<'asc' | 'desc'>('asc');
  const [workOrderGridVisibleColumns, setWorkOrderGridVisibleColumns] = useState<Record<WorkOrderGridColumnKey, boolean>>(defaultGridVisibleColumns);
  const [workOrderGridColumnWidths, setWorkOrderGridColumnWidths] = useState<Record<WorkOrderGridColumnKey, number>>(defaultGridColumnWidths);
  const [workOrderGridFilters, setWorkOrderGridFilters] = useState<Record<WorkOrderGridColumnKey, string>>({
    packageNumber: '',
    aircraft: '',
    priority: '',
    category: '',
    station: '',
    due: '',
    status: '',
    owner: '',
  });
  const [debouncedWorkOrderGridFilters, setDebouncedWorkOrderGridFilters] = useState<Record<WorkOrderGridColumnKey, string>>({
    packageNumber: '',
    aircraft: '',
    priority: '',
    category: '',
    station: '',
    due: '',
    status: '',
    owner: '',
  });
  const [selectedFleetFilter, setSelectedFleetFilter] = useState('all');
  const [selectedStationFilter, setSelectedStationFilter] = useState('all');
  const [closureConfirmOpen, setClosureConfirmOpen] = useState(false);
  const [closureRationale, setClosureRationale] = useState('');
  const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
  const [overrideRationale, setOverrideRationale] = useState('');
  const [deferralConfirmOpen, setDeferralConfirmOpen] = useState(false);
  const [deferralRationale, setDeferralRationale] = useState('');
  const [lastInteractionMessage, setLastInteractionMessage] = useState('Ready for module actions.');
  const [busyWorkOrderActionId, setBusyWorkOrderActionId] = useState<string | null>(null);
  const [manualWorkOrderOrder, setManualWorkOrderOrder] = useState<string[]>([]);
  const [draggingWorkOrderId, setDraggingWorkOrderId] = useState<string | null>(null);
  const [lastWorkspaceExportAt, setLastWorkspaceExportAt] = useState<string | null>(null);
  const [workOrderCreateDialogOpen, setWorkOrderCreateDialogOpen] = useState(false);
  const [workOrderCreateTab, setWorkOrderCreateTab] = useState<WorkOrderCreateTab>('wp');
  const [workOrderCreateForm, setWorkOrderCreateForm] = useState<WorkOrderCreateFormState>(() => createDefaultWorkOrderCreateFormState());
  const [workOrderCreateErrors, setWorkOrderCreateErrors] = useState<WorkOrderCreateFormErrors>({});
  const [maintenanceTaskSelectionOptions, setMaintenanceTaskSelectionOptions] = useState<WorkOrderCreateTaskOption[]>([]);
  const [workOrderAircraftOptions, setWorkOrderAircraftOptions] = useState<WorkOrderCreateAircraftOption[]>([]);
  const [aircraftSearchTerm, setAircraftSearchTerm] = useState('');
  const [debouncedAircraftSearchTerm, setDebouncedAircraftSearchTerm] = useState('');
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [debouncedTaskSearchTerm, setDebouncedTaskSearchTerm] = useState('');

  // Debounce aircraft search to prevent flickering during typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAircraftSearchTerm(aircraftSearchTerm);
    }, 200); // 200ms debounce delay
    return () => clearTimeout(timer);
  }, [aircraftSearchTerm]);

  // Debounce task search to prevent flickering during typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTaskSearchTerm(taskSearchTerm);
    }, 200); // 200ms debounce delay
    return () => clearTimeout(timer);
  }, [taskSearchTerm]);
  const [taskConflictById, setTaskConflictById] = useState<Record<string, TaskConflictInfo>>({});
  const [taskSelectionLoading, setTaskSelectionLoading] = useState(false);
  const [aircraftSelectionLoading, setAircraftSelectionLoading] = useState(false);
  const [reviewSubmitDialogOpen, setReviewSubmitDialogOpen] = useState(false);
  const [workOrderCreateSubmitting, setWorkOrderCreateSubmitting] = useState(false);
  const workOrderCreateDraftCacheRef = useRef<Map<WorkOrderCreateTab, WorkOrderCreateFormState>>(new Map());
  const workspaceLoadStartedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const workspaceLoadMetricPublishedRef = useRef(false);
  const filterApplyStartedAtRef = useRef<number | null>(null);
  const gridResizeActiveRef = useRef<{
    columnKey: WorkOrderGridColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);
  const hasUnsavedDetailChanges = detailDraft.trim() !== lastSavedDetailDraft.trim();
  const activeUxRole: AmroUxRole = state.activeRole === 'technician'
    ? 'technician'
    : state.activeRole === 'engineer'
      ? 'engineer'
      : state.activeRole === 'inspector'
        ? 'inspector'
        : state.activeRole === 'planner'
          ? 'planner'
          : 'management';
  const roleVariant = amroRoleVariants[activeUxRole];
  const selectedTask = state.selectedWorkOrder?.tasks?.[0] ?? null;
  const mobileQueuedEvents = Math.max(0, (state.selectedWorkOrder?.tasks?.filter((task) => !task.completed).length ?? 0) - 1);
  const canRunWorkOrderClosure = activeUxRole !== 'technician';
  const canRunComplianceOverride = activeUxRole !== 'technician';
  const canEditPartsAllocation = activeUxRole !== 'inspector';
  const canDirectTaskExecution = activeUxRole !== 'management';
  const canRunRegulatoryFinalSignOff = activeUxRole !== 'engineer';
  const canRunCertifyingRelease = activeUxRole !== 'planner';
  const trainerMetadataRole = String(
    session?.user?.user_metadata?.role
      || session?.user?.app_metadata?.role
      || '',
  ).trim().toLowerCase();
  const trainerUserMetadataRolesRaw = session?.user?.user_metadata?.roles;
  const trainerAppMetadataRolesRaw = session?.user?.app_metadata?.roles;
  const trainerUserMetadataRoles = Array.isArray(trainerUserMetadataRolesRaw) ? trainerUserMetadataRolesRaw : [];
  const trainerAppMetadataRoles = Array.isArray(trainerAppMetadataRolesRaw) ? trainerAppMetadataRolesRaw : [];
  const trainerMetadataRoles = [
    ...trainerUserMetadataRoles,
    ...trainerAppMetadataRoles,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  const isTrainerRole = trainerMetadataRole === 'trainer' || trainerMetadataRoles.includes('trainer');
  const canShowPartsTourAgain =
    hasRole('platform_admin')
    || hasRole('tenant_admin')
    || hasRole('franchise_admin')
    || isTrainerRole;
  function renderPartsModuleSurface(moduleId: PartsNavigationModuleId): JSX.Element {
    if (moduleId === 'overview') {
      return (
        <AmroModuleSurface
          title="Overview"
          subtitle="Unified inventory command center with standardized search, filters, KPIs, and CRUD surface."
          moduleId="inventory-core.overview"
          status={partsCatalog.error ? 'warning' : partsCatalog.loading ? 'loading' : 'ready'}
        >
          <AmroKpiGrid
            items={[
              { label: 'Total Records', value: String(filteredOverviewRecords.length) },
              { label: 'Low Stock', value: String(filteredOverviewRecords.filter((record) => record.status === 'low_stock').length), tone: 'warning' },
              { label: 'Reserved', value: String(filteredOverviewRecords.filter((record) => record.quantity_reserved > 0).length), tone: 'success' },
            ]}
          />
          {partsCatalog.dataSource === 'fallback' ? (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">
              Live API unavailable - showing fallback data for visibility.
            </p>
            {partsCatalog.fallbackAuthDiagnostics?.reasonCode ? (
            <p className="mt-1 text-xs">
              reason_code: {partsCatalog.fallbackAuthDiagnostics.reasonCode}
            </p>
            ) : null}
            {partsCatalog.fallbackAuthDiagnostics?.remediation ? (
            <p className="mt-1 text-xs">
              remediation: {partsCatalog.fallbackAuthDiagnostics.remediation}
            </p>
            ) : null}
            {partsApiDiagnosticMessage ? (
            <p className="mt-1 text-xs">
              diagnostic: {partsApiDiagnosticMessage}
            </p>
            ) : null}
            <div className="mt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={partsApiDiagnosticRunning}
                onClick={() => {
                  void runPartsLiveApiDiagnostics();
                }}
              >
                {partsApiDiagnosticRunning ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Reconnect Live API
              </Button>
            </div>
          </div>
          ) : null}
          <AmroPartsInventoryWorkbench
            records={filteredOverviewRecords}
            state={partsCatalog.loading && filteredOverviewRecords.length === 0 ? 'loading' : partsCatalog.error ? 'error' : filteredOverviewRecords.length ? 'ready' : 'empty'}
            errorMessage={partsCatalog.error?.message || 'Unable to load live AMRO parts inventory'}
            viewMode="horizontal-split"
            density="normal"
            scrollBehavior="virtualization"
            pageSize={40}
            title="AMRO Parts Inventory (Live API)"
            subtitle="Real-time data from /api/v2/amro/parts with CRUD-ready detail workflow."
            onRefresh={() => {
              void partsCatalog.refresh();
            }}
            onCreatePart={openCreatePartDialog}
            onCreateRecord={openCreatePartDialog}
            onUpdateRecord={openEditPartDialog}
            onDeleteRecord={openDeletePartDialog}
            canShowTourAgain={canShowPartsTourAgain}
          />
        </AmroModuleSurface>
      );
    }
    if (moduleId === 'item-master') {
      return (
        <AmroItemMasterCatalogPanel
          apiScope={partsApiScope}
          onCreatePart={openCreatePartDialog}
          onCreatePartFromItemMaster={openCreatePartDialogFromItemMaster}
        />
      );
    }
    if (moduleId === 'stock-ledger') {
      return <AmroStockLedgerPanel apiScope={partsApiScope} />;
    }
    if (moduleId === 'reservations') {
      return <ReservationsPanel records={partsCatalog.records} />;
    }
    if (moduleId === 'issue-consume') {
      return <IssueConsumePanel records={partsCatalog.records} />;
    }
    if (moduleId === 'restock') {
      return <RestockPanel records={partsCatalog.records} />;
    }
    if (moduleId === 'locations') {
      return <LocationsPanel records={partsCatalog.records} />;
    }
    return <AnalyticsPanel records={partsCatalog.records} />;
  }
  const partsApiScope = useMemo(() => ({
    tenantId: context?.tenantId || null,
    franchiseId: context?.franchiseId || null,
    userId: context?.userId || null,
    accessToken: session?.access_token || null,
  }), [context?.franchiseId, context?.tenantId, context?.userId, session?.access_token]);
  const partsCatalogApi = useMemo(() => createAmroPartsCatalogApi(fetch, partsApiScope), [partsApiScope]);
  const partsCatalog = usePartsCatalogState({
    pageSize: 80,
    api: partsCatalogApi,
  });
  const [partsCreateOpen, setPartsCreateOpen] = useState(false);
  const [partsEditOpen, setPartsEditOpen] = useState(false);
  const [partsDeleteOpen, setPartsDeleteOpen] = useState(false);
  const [partsSubmitting, setPartsSubmitting] = useState(false);
  const [partsCreateItemMasterLink, setPartsCreateItemMasterLink] = useState<{ id: string; partNumber: string } | null>(null);
  const [partsApiDiagnosticRunning, setPartsApiDiagnosticRunning] = useState(false);
  const [partsApiDiagnosticMessage, setPartsApiDiagnosticMessage] = useState<string | null>(null);
  const [overviewSearch, setOverviewSearch] = useState('');
  const [partsTargetRecord, setPartsTargetRecord] = useState<PartInventoryRecord | null>(null);
  const [partsFormSection, setPartsFormSection] = useState<PartsFormSectionKey>('basic');
  const [partsAdvancedOpen, setPartsAdvancedOpen] = useState(false);
  const [partsFormErrors, setPartsFormErrors] = useState<Partial<Record<PartsFormFieldKey, string>>>({});
  const [partsFormTouched, setPartsFormTouched] = useState<Partial<Record<PartsFormFieldKey, boolean>>>({});
  const [partsForm, setPartsForm] = useState<PartsMutationPayload>({
    part_number: '',
    serial_number: '',
    description: '',
    status: 'available',
    lifecycle_status: 'serviceable',
    quantity_on_hand: 0,
    quantity_reserved: 0,
    warehouse_location: '',
    supplier_name: '',
    criticality: 'normal',
    ata_chapter: '',
  });
  const isScopedToModule = Boolean(moduleKey);
  const showOverviewModule = !moduleKey || moduleKey === 'overview';
  const showPrimaryUsersModule = !moduleKey || moduleKey === 'primary-users';
  const showWorkOrdersModule = !moduleKey || moduleKey === 'work-orders';
  const showTaskExecutionModule = !moduleKey || moduleKey === 'task-execution';
  const showSchedulingModule = !moduleKey || moduleKey === 'scheduling';
  const showPartsModule = !moduleKey || moduleKey === 'parts';
  const showComplianceModule = !moduleKey || moduleKey === 'compliance';
  const showCertificationModule = !moduleKey || moduleKey === 'certification';
  const showAuditModule = !moduleKey || moduleKey === 'audit';
  const showIntegrationModule = !moduleKey || moduleKey === 'integration';
  const showIntelligenceModule = !moduleKey || moduleKey === 'intelligence';

  useEffect(() => {
    if (!showPartsModule) return;
    if (!partsCatalog.loading && partsCatalog.records.length === 0) {
      void partsCatalog.refresh();
    }
  }, [showPartsModule, partsCatalog.loading, partsCatalog.records.length, partsCatalog.refresh]);

  const filteredOverviewRecords = useMemo(() => {
    const term = overviewSearch.trim().toLowerCase();
    if (!term) return partsCatalog.records;
    return partsCatalog.records.filter((record) => {
      return (
        record.part_number.toLowerCase().includes(term) ||
        record.description.toLowerCase().includes(term) ||
        record.supplier_name.toLowerCase().includes(term) ||
        record.warehouse_location.toLowerCase().includes(term)
      );
    });
  }, [overviewSearch, partsCatalog.records]);

  const resetPartsForm = useCallback(() => {
    setPartsForm({
      part_number: '',
      serial_number: '',
      description: '',
      status: 'available',
      lifecycle_status: 'serviceable',
      quantity_on_hand: 0,
      quantity_reserved: 0,
      warehouse_location: '',
      supplier_name: '',
      criticality: 'normal',
      ata_chapter: '',
    });
    setPartsFormErrors({});
    setPartsFormTouched({});
    setPartsAdvancedOpen(false);
    setPartsFormSection('basic');
  }, []);

  const partsRequiredFieldSet = useMemo(() => new Set<PartsFormFieldKey>(PARTS_FORM_REQUIRED_KEYS), []);
  const validatePartsField = useCallback((key: PartsFormFieldKey, value: PartsMutationPayload[PartsFormFieldKey]): string => {
    if (partsRequiredFieldSet.has(key)) {
      if (typeof value === 'number') {
        if (Number.isNaN(value) || value < 0) return 'Value must be zero or greater.';
      } else if (String(value || '').trim().length === 0) {
        return 'This field is required.';
      }
    }
    if ((key === 'quantity_on_hand' || key === 'quantity_reserved') && typeof value === 'number' && value < 0) {
      return 'Quantity cannot be negative.';
    }
    if (key === 'quantity_reserved' && typeof value === 'number' && value > partsForm.quantity_on_hand) {
      return 'Reserved quantity cannot exceed on-hand quantity.';
    }
    if (key === 'part_number' && String(value || '').trim().length > 0 && String(value || '').trim().length < 3) {
      return 'Part number must contain at least 3 characters.';
    }
    return '';
  }, [partsForm.quantity_on_hand, partsRequiredFieldSet]);
  const updatePartsFormField = useCallback(<K extends PartsFormFieldKey>(key: K, value: PartsMutationPayload[K]) => {
    setPartsForm((current) => ({ ...current, [key]: value }));
    setPartsFormTouched((current) => ({ ...current, [key]: true }));
  }, []);
  const isPartsFormFieldRequired = useCallback((key: PartsFormFieldKey) => partsRequiredFieldSet.has(key), [partsRequiredFieldSet]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextErrors: Partial<Record<PartsFormFieldKey, string>> = {};
      for (const key of Object.keys(partsForm) as PartsFormFieldKey[]) {
        const message = validatePartsField(key, partsForm[key]);
        if (message) nextErrors[key] = message;
      }
      setPartsFormErrors(nextErrors);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [partsForm, validatePartsField]);
  const isPartsFormValid = useMemo(() => (
    PARTS_FORM_REQUIRED_KEYS.every((key) => {
      const value = partsForm[key];
      if (typeof value === 'number') return !Number.isNaN(value) && value >= 0;
      return String(value || '').trim().length > 0;
    }) && Object.values(partsFormErrors).every((message) => !message)
  ), [partsForm, partsFormErrors]);
  const renderPartsFormField = useCallback((field: PartsFormFieldSchema, mode: 'create' | 'edit') => {
    const inputId = `parts-${mode}-${field.key.replace(/_/g, '-')}`;
    const errorId = `${inputId}-error`;
    const value = partsForm[field.key];
    const required = isPartsFormFieldRequired(field.key);
    const touched = Boolean(partsFormTouched[field.key]);
    const message = touched ? String(partsFormErrors[field.key] || '') : '';
    return (
      <div key={`${mode}-${field.key}`} className={`space-y-1 ${field.colSpan === 2 ? 'md:col-span-2' : ''}`}>
        <Label htmlFor={inputId}>
          {field.label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        {field.control === 'textarea' ? (
          <Textarea
            id={inputId}
            value={String(value || '')}
            onBlur={() => setPartsFormTouched((current) => ({ ...current, [field.key]: true }))}
            onChange={(event) => updatePartsFormField(field.key, event.target.value as never)}
            aria-invalid={message ? 'true' : 'false'}
            aria-describedby={message ? errorId : undefined}
          />
        ) : field.control === 'number' ? (
          <TextInput
            id={inputId}
            type="number"
            value={String(typeof value === 'number' ? value : 0)}
            onBlur={() => setPartsFormTouched((current) => ({ ...current, [field.key]: true }))}
            onChange={(event) => updatePartsFormField(field.key, Number(event.target.value || 0) as never)}
            aria-invalid={message ? 'true' : 'false'}
            aria-describedby={message ? errorId : undefined}
          />
        ) : field.control === 'select' ? (
          <Select value={String(value || '')} onValueChange={(next) => updatePartsFormField(field.key, next as never)}>
            <SelectTrigger
              id={inputId}
              onBlur={() => setPartsFormTouched((current) => ({ ...current, [field.key]: true }))}
              aria-invalid={message ? 'true' : 'false'}
              aria-describedby={message ? errorId : undefined}
            ><SelectValue /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map((option) => <SelectItem key={`${inputId}-${option}`} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <TextInput
            id={inputId}
            value={String(value || '')}
            onBlur={() => setPartsFormTouched((current) => ({ ...current, [field.key]: true }))}
            onChange={(event) => updatePartsFormField(field.key, event.target.value as never)}
            aria-invalid={message ? 'true' : 'false'}
            aria-describedby={message ? errorId : undefined}
          />
        )}
        {message ? <p id={errorId} className="text-xs text-destructive">{message}</p> : null}
      </div>
    );
  }, [isPartsFormFieldRequired, partsForm, partsFormErrors, partsFormTouched, updatePartsFormField]);
  const partsAdditionalFields = useMemo<PartsFormFieldSchema[]>(() => ([
    { key: 'supplier_name', label: 'Supplier Name', control: 'text' },
    { key: 'criticality', label: 'Criticality', control: 'select', options: ['critical', 'high', 'normal', 'low'] },
    { key: 'ata_chapter', label: 'ATA Chapter', control: 'text' },
  ]), []);
  const partsFieldsByKey = useMemo(() => {
    return new Map<PartsFormFieldKey, PartsFormFieldSchema>([
      ...PARTS_FORM_CORE_FIELDS,
      ...PARTS_FORM_ADVANCED_FIELDS,
      ...partsAdditionalFields,
    ].map((field) => [field.key, field]));
  }, [partsAdditionalFields]);
  const basicInfoFields = useMemo(
    () => ['part_number', 'serial_number', 'description', 'status', 'lifecycle_status']
      .map((key) => partsFieldsByKey.get(key as PartsFormFieldKey))
      .filter((field): field is PartsFormFieldSchema => Boolean(field)),
    [partsFieldsByKey],
  );
  const stockLevelFields = useMemo(
    () => ['quantity_on_hand', 'quantity_reserved']
      .map((key) => partsFieldsByKey.get(key as PartsFormFieldKey))
      .filter((field): field is PartsFormFieldSchema => Boolean(field)),
    [partsFieldsByKey],
  );
  const locationFields = useMemo(
    () => ['warehouse_location']
      .map((key) => partsFieldsByKey.get(key as PartsFormFieldKey))
      .filter((field): field is PartsFormFieldSchema => Boolean(field)),
    [partsFieldsByKey],
  );
  const supplierFields = useMemo(
    () => ['supplier_name', 'criticality']
      .map((key) => partsFieldsByKey.get(key as PartsFormFieldKey))
      .filter((field): field is PartsFormFieldSchema => Boolean(field)),
    [partsFieldsByKey],
  );

  const openCreatePartDialog = useCallback(() => {
    setPartsTargetRecord(null);
    setPartsCreateItemMasterLink(null);
    resetPartsForm();
    setPartsCreateOpen(true);
  }, [resetPartsForm]);

  const openCreatePartDialogFromItemMaster = useCallback((record: ItemMasterRecord) => {
    setPartsTargetRecord(null);
    setPartsCreateItemMasterLink({ id: record.id, partNumber: record.partNumber });
    setPartsForm({
      part_number: record.partNumber,
      serial_number: '',
      description: record.description || '',
      status: 'available',
      lifecycle_status: record.lifecycleStatus || 'serviceable',
      quantity_on_hand: 0,
      quantity_reserved: 0,
      warehouse_location: '',
      supplier_name: record.manufacturerName || '',
      criticality: 'normal',
      ata_chapter: '',
    });
    setPartsFormErrors({});
    setPartsFormTouched({});
    setPartsAdvancedOpen(false);
    setPartsFormSection('basic');
    setPartsCreateOpen(true);
  }, []);

  const openEditPartDialog = useCallback((record: PartInventoryRecord) => {
    setPartsTargetRecord(record);
    setPartsForm({
      part_number: record.part_number,
      serial_number: record.serial_number,
      description: record.description,
      status: record.status,
      lifecycle_status: record.lifecycle_status || 'serviceable',
      quantity_on_hand: record.quantity_on_hand,
      quantity_reserved: record.quantity_reserved,
      warehouse_location: record.warehouse_location,
      supplier_name: record.supplier_name,
      criticality: record.criticality,
      ata_chapter: record.ata_chapter,
    });
    setPartsFormErrors({});
    setPartsFormTouched({});
    setPartsAdvancedOpen(false);
    setPartsFormSection('basic');
    setPartsEditOpen(true);
  }, []);

  const openDeletePartDialog = useCallback((record: PartInventoryRecord) => {
    setPartsTargetRecord(record);
    setPartsDeleteOpen(true);
  }, []);

  const submitCreatePart = useCallback(async () => {
    setPartsSubmitting(true);
    try {
      const createPayload: PartsMutationPayload = partsCreateItemMasterLink
        ? {
          ...partsForm,
          metadata: {
            item_master_id: partsCreateItemMasterLink.id,
            item_master_part_number: partsCreateItemMasterLink.partNumber,
            linkage_source: 'amro_item_master',
            linked_at: new Date().toISOString(),
          },
        }
        : partsForm;
      await createAmroPartRecord(createPayload, fetch, partsApiScope);
      setPartsCreateOpen(false);
      setPartsCreateItemMasterLink(null);
      resetPartsForm();
      toast.success('Part created successfully.');
      await partsCatalog.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create part.');
    } finally {
      setPartsSubmitting(false);
    }
  }, [partsApiScope, partsCatalog, partsCreateItemMasterLink, partsForm, resetPartsForm]);

  const submitUpdatePart = useCallback(async () => {
    if (!partsTargetRecord?.id) return;
    setPartsSubmitting(true);
    try {
      await updateAmroPartRecord(partsTargetRecord.id, partsForm, fetch, partsApiScope);
      setPartsEditOpen(false);
      setPartsTargetRecord(null);
      toast.success('Part updated successfully.');
      await partsCatalog.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update part.');
    } finally {
      setPartsSubmitting(false);
    }
  }, [partsApiScope, partsCatalog, partsForm, partsTargetRecord]);

  const submitDeletePart = useCallback(async () => {
    if (!partsTargetRecord?.id) return;
    setPartsSubmitting(true);
    try {
      await deleteAmroPartRecord(partsTargetRecord.id, fetch, partsApiScope);
      setPartsDeleteOpen(false);
      setPartsTargetRecord(null);
      toast.success('Part deleted successfully.');
      await partsCatalog.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete part.');
    } finally {
      setPartsSubmitting(false);
    }
  }, [partsApiScope, partsCatalog, partsTargetRecord]);

  const runPartsLiveApiDiagnostics = useCallback(async () => {
    setPartsApiDiagnosticRunning(true);
    setPartsApiDiagnosticMessage(null);
    try {
      const tokenPresent = Boolean(String(partsApiScope.accessToken || '').trim());
      const tenantPresent = Boolean(String(partsApiScope.tenantId || '').trim());
      const franchisePresent = Boolean(String(partsApiScope.franchiseId || '').trim());
      const userPresent = Boolean(String(partsApiScope.userId || '').trim());
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(tokenPresent ? { Authorization: `Bearer ${String(partsApiScope.accessToken).trim()}` } : {}),
        ...(tenantPresent ? { 'x-tenant-id': String(partsApiScope.tenantId).trim() } : {}),
        ...(franchisePresent ? { 'x-franchise-id': String(partsApiScope.franchiseId).trim() } : {}),
        ...(userPresent ? { 'x-user-id': String(partsApiScope.userId).trim() } : {}),
        'x-domain-id': 'AMRO',
      };
      const response = await fetch('/api/v2/amro/parts?page=1&page_size=1', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      let payload: Record<string, unknown> = {};
      try {
        const parsed = await response.json();
        if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
      } catch {
        payload = {};
      }
      const code = String(payload.code || '');
      const error = String(payload.error || '');
      const authDiagnostics = payload.auth_diagnostics && typeof payload.auth_diagnostics === 'object'
        ? payload.auth_diagnostics as Record<string, unknown>
        : null;
      const reasonCode = String(authDiagnostics?.reason_code || code || '').trim();
      const statusLine = `status=${response.status}`;
      const headerLine = `token=${tokenPresent ? 'yes' : 'no'}, tenant=${tenantPresent ? 'yes' : 'no'}, franchise=${franchisePresent ? 'yes' : 'no'}, user=${userPresent ? 'yes' : 'no'}`;
      const reasonLine = reasonCode ? `reason=${reasonCode}` : '';
      const errorLine = error ? `error=${error}` : '';
      const message = [statusLine, headerLine, reasonLine, errorLine].filter(Boolean).join(' | ');
      setPartsApiDiagnosticMessage(message);
      if (response.ok) {
        toast.success(`Live API diagnostic passed: ${message}`);
      } else {
        toast.error(`Live API diagnostic failed: ${message}`);
      }
    } catch (error) {
      const message = `status=network_error | ${error instanceof Error ? error.message : 'unknown failure'}`;
      setPartsApiDiagnosticMessage(message);
      toast.error(`Live API diagnostic failed: ${message}`);
    } finally {
      setPartsApiDiagnosticRunning(false);
    }
  }, [partsApiScope.accessToken, partsApiScope.franchiseId, partsApiScope.tenantId, partsApiScope.userId]);
  const moduleActionBarTitle = moduleKey
    ? moduleKey.replace(/-/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
    : 'AMRO';
  const selectedTaskId = selectedTask?.id || '';
  const moduleActions: AmroModuleAction[] = moduleKey === 'overview'
    ? [
        {
          id: 'overview-refresh',
          label: 'Refresh Workspace',
          onClick: state.refreshWorkOrders,
          disabled: state.loadingWorkOrders,
          disabledReason: state.loadingWorkOrders ? 'Work package refresh is already running.' : 'Ready.',
        },
        {
          id: 'overview-anomalies',
          label: 'Detect Anomalies',
          onClick: state.detectComplianceAnomalies,
          disabled: false,
          disabledReason: 'Ready.',
        },
        {
          id: 'overview-compliance-gate',
          label: 'Load Compliance Gate',
          onClick: () => void handleOpenComplianceGate(),
          disabled: !state.selectedWorkOrderId,
          disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
        },
      ]
    : moduleKey === 'work-orders'
      ? []
      : moduleKey === 'primary-users'
        ? [
            {
              id: 'primary-users-refresh',
              label: 'Refresh Workspace',
              onClick: state.refreshWorkOrders,
              disabled: state.loadingWorkOrders,
              disabledReason: state.loadingWorkOrders ? 'Work package refresh is already running.' : 'Ready.',
            },
            {
              id: 'primary-users-anomaly',
              label: 'Detect Anomalies',
              onClick: () => void state.detectComplianceAnomalies(),
              disabled: false,
              disabledReason: 'Ready.',
            },
          ]
      : moduleKey === 'task-execution'
        ? [
            {
              id: 'task-execution-start',
              label: 'Start Task Step',
              onClick: () => void trackTaskStepSubmitInteraction(selectedTaskId, 'start'),
              disabled: !selectedTaskId,
              disabledReason: selectedTaskId ? 'Ready.' : 'Select a work package with tasks first.',
            },
            {
              id: 'task-execution-evidence',
              label: 'Upload Evidence',
              onClick: () => void state.uploadTaskEvidence(selectedTaskId),
              disabled: !selectedTaskId,
              disabledReason: selectedTaskId ? 'Ready.' : 'Select a work package with tasks first.',
            },
            {
              id: 'task-execution-signature',
              label: 'Submit Signature',
              onClick: () => void state.submitTaskSignature(selectedTaskId),
              disabled: !selectedTaskId || !state.canSignOff,
              disabledReason: !selectedTaskId ? 'Select a work package with tasks first.' : !state.canSignOff ? 'Selected certifier does not meet sign-off authority.' : 'Ready.',
            },
          ]
        : moduleKey === 'scheduling'
          ? [
              {
                id: 'scheduling-assign',
                label: 'Assign Next Slot',
                onClick: () => void state.assignSelectedWorkOrderToNextSlot(),
                disabled: !state.selectedWorkOrderId,
                disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
              },
              {
                id: 'scheduling-replan-simulate',
                label: 'Run Replan Simulation',
                onClick: () => void state.runWorkOrderReplanSimulation(),
                disabled: !state.selectedWorkOrderId,
                disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
              },
              {
                id: 'scheduling-replan-confirm',
                label: 'Confirm Replan',
                onClick: () => void state.confirmWorkOrderReplan(),
                disabled: state.workOrderReplanOptions.length === 0,
                disabledReason: state.workOrderReplanOptions.length > 0 ? 'Ready.' : 'Run simulation first.',
              },
              {
                id: 'scheduling-refresh-optimization',
                label: 'Refresh Optimization',
                onClick: () => void state.fetchScheduleOptimizationRecommendations(),
                disabled: false,
                disabledReason: 'Ready.',
              },
            ]
          : moduleKey === 'parts'
            ? [
                {
                  id: 'parts-build-allocation',
                  label: 'Build Allocation',
                  onClick: () => void state.reservePartsAllocationForSelectedWorkOrder(),
                  disabled: !state.selectedWorkOrderId,
                  disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                },
                {
                  id: 'parts-run-optimization',
                  label: 'Run Inventory Optimization',
                  onClick: () => void state.runInventoryOptimizationModel(),
                  disabled: !state.selectedWorkOrderId,
                  disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                },
                {
                  id: 'parts-sync-eta',
                  label: 'Sync Supplier ETA',
                  onClick: () => void state.syncSupplierEtaForSelectedWorkOrder(),
                  disabled: !state.selectedWorkOrderId,
                  disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                },
                {
                  id: 'parts-sync-procurement',
                  label: 'Sync ASN + ERP',
                  onClick: () => void state.syncSupplierAsnAndErpProcurement(),
                  disabled: false,
                  disabledReason: 'Ready.',
                },
              ]
            : moduleKey === 'compliance'
              ? [
                  {
                    id: 'compliance-gate',
                    label: 'Load Compliance Gate',
                    onClick: () => void handleOpenComplianceGate(),
                    disabled: !state.selectedWorkOrderId,
                    disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                  },
                  {
                    id: 'compliance-replay',
                    label: 'Load Audit Replay',
                    onClick: () => void state.loadAuditReplayTimeline(),
                    disabled: !state.selectedWorkOrderId,
                    disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                  },
                  {
                    id: 'compliance-anomaly',
                    label: 'Detect Anomalies',
                    onClick: () => void state.detectComplianceAnomalies(),
                    disabled: false,
                    disabledReason: 'Ready.',
                  },
                ]
              : moduleKey === 'certification'
                ? [
                    {
                      id: 'certification-validate',
                      label: 'Validate Privilege',
                      onClick: () => void state.validateCertifyingPrivilege(),
                      disabled: false,
                      disabledReason: 'Ready.',
                    },
                    {
                      id: 'certification-approve',
                      label: 'Approve Decision',
                      onClick: () => void state.submitCertificationDecision('approve'),
                      disabled: !state.selectedWorkOrderId,
                      disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                    },
                    {
                      id: 'certification-deferral',
                      label: 'Run Expiry Automation',
                      onClick: () => void state.runExpiryWarningAndSuspension(),
                      disabled: false,
                      disabledReason: 'Ready.',
                    },
                  ]
                : moduleKey === 'audit'
                  ? [
                      {
                        id: 'audit-replay',
                        label: 'Load Audit Replay',
                        onClick: () => void state.loadAuditReplayTimeline(),
                        disabled: !state.selectedWorkOrderId,
                        disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                      },
                      {
                        id: 'audit-anomaly',
                        label: 'Detect Anomalies',
                        onClick: () => void state.detectComplianceAnomalies(),
                        disabled: false,
                        disabledReason: 'Ready.',
                      },
                    ]
                  : moduleKey === 'integration'
                    ? [
                        {
                          id: 'integration-refresh',
                          label: 'Refresh Workspace',
                          onClick: state.refreshWorkOrders,
                          disabled: state.loadingWorkOrders,
                          disabledReason: state.loadingWorkOrders ? 'Work package refresh is already running.' : 'Ready.',
                        },
                        {
                          id: 'integration-audit-replay',
                          label: 'Open Replay Feed',
                          onClick: () => void state.loadAuditReplayTimeline(),
                          disabled: !state.selectedWorkOrderId,
                          disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                        },
                      ]
                    : moduleKey === 'intelligence'
                      ? [
                          {
                            id: 'intelligence-optimization',
                            label: 'Run Inventory Optimization',
                            onClick: () => void state.runInventoryOptimizationModel(),
                            disabled: !state.selectedWorkOrderId,
                            disabledReason: state.selectedWorkOrderId ? 'Ready.' : 'Select a work package first.',
                          },
                          {
                            id: 'intelligence-anomalies',
                            label: 'Detect Anomalies',
                            onClick: () => void state.detectComplianceAnomalies(),
                            disabled: false,
                            disabledReason: 'Ready.',
                          },
                        ]
                      : [];
  const moduleActionStates = moduleActions.map((action) => ({
    ...action,
    stateLabel: action.disabled ? 'disabled' : 'enabled',
    stateReason: action.disabled ? action.disabledReason : 'Ready.',
  }));
  const nowEpoch = Date.now();
  const fleetOptions = ['all', ...Array.from(new Set(state.assets.map((asset) => asset.assetTag)))];
  const stationOptions = ['all', ...Array.from(new Set(state.scheduleBoardRows.map((row) => row.station_code)))];
  useEffect(() => {
    let active = true;
    const loadAircraftSelectionOptions = async () => {
      setAircraftSelectionLoading(true);
      const { data, error } = await scopedDb
        .from('aircraft')
        .select('id, registration, serial_number, aircraft_model, aircraft_type, operator_code, owner_name, station_code, status, current_flight_hours, current_cycles')
        .order('registration', { ascending: true })
        .limit(500);
      if (!active) {
        return;
      }
      if (error) {
        setWorkOrderAircraftOptions([]);
        setAircraftSelectionLoading(false);
        return;
      }
      const options = ((data ?? []) as Array<{
        id: string;
        registration: string | null;
        serial_number: string | null;
        aircraft_model: string | null;
        aircraft_type: string | null;
        operator_code: string | null;
        owner_name: string | null;
        station_code: string | null;
        status: string | null;
        current_flight_hours: number | null;
        current_cycles: number | null;
      }>)
        .map((item) => {
          return {
            id: item.id,
            registration: String(item.registration || '').trim(),
            serialNumber: String(item.serial_number || '').trim(),
            aircraftModel: String(item.aircraft_model || '').trim(),
            aircraftType: String(item.aircraft_type || '').trim(),
            operatorCode: String(item.operator_code || '').trim(),
            ownerName: String(item.owner_name || '').trim(),
            stationCode: String(item.station_code || '').trim(),
            status: String(item.status || '').trim(),
            currentFlightHours: Number(item.current_flight_hours || 0),
            currentCycles: Number(item.current_cycles || 0),
          };
        });
      setWorkOrderAircraftOptions(options);
      setAircraftSelectionLoading(false);
    };
    void loadAircraftSelectionOptions();
    return () => {
      active = false;
    };
  }, [scopedDb]);
  useEffect(() => {
    let active = true;
    const loadMaintenanceTaskSelectionOptions = async () => {
      if (!workOrderCreateForm.aircraftId) {
        setMaintenanceTaskSelectionOptions([]);
        setTaskConflictById({});
        return;
      }
      setTaskSelectionLoading(true);
      const { data, error } = await scopedDb
        .from('task_templates')
        .select('id, code_form_no, description, interval_hours, interval_cycles, interval_months, estimated_man_hours, category_code, revision_status')
        .order('code_form_no', { ascending: true })
        .limit(1000);
      if (!active) {
        return;
      }
      if (error) {
        setMaintenanceTaskSelectionOptions([]);
        setTaskSelectionLoading(false);
        return;
      }
      const selectedModel = workOrderCreateForm.selectedAircraftModel.trim().toLowerCase();
      const normalizedModelTokens = selectedModel.length > 0
        ? selectedModel.split(/[\s/-]+/).map((token) => token.trim()).filter((token) => token.length >= 3)
        : [];
      const allOptions = ((data ?? []) as Array<{
        id: string;
        code_form_no: string | null;
        description: string | null;
        interval_hours: number | null;
        interval_cycles: number | null;
        interval_months: number | null;
        estimated_man_hours: number | null;
        category_code: string | null;
        revision_status: string | null;
      }>).map((item) => {
        const taskNumber = String(item.code_form_no || '').trim() || item.id;
        const title = String(item.description || '').trim() || 'Untitled Task';
        const dueBasis = item.interval_hours
          ? `FH ${item.interval_hours}`
          : item.interval_cycles
            ? `FC ${item.interval_cycles}`
            : item.interval_months
              ? `MO ${item.interval_months}`
              : 'On condition';
        const dueDate = item.interval_months ? `${item.interval_months} months` : '-';
        const modelTags = normalizedModelTokens.filter((token) => title.toLowerCase().includes(token) || taskNumber.toLowerCase().includes(token));
        return {
          value: item.id,
          taskNumber,
          title,
          dueBasis,
          dueDate,
          estimatedManHours: item.estimated_man_hours ? `${item.estimated_man_hours}` : '-',
          status: String(item.revision_status || 'pending').trim(),
          category: String(item.category_code || 'GEN').trim(),
          modelTags,
        };
      });
      const matchedByModel = normalizedModelTokens.length > 0
        ? allOptions.filter((item) => item.modelTags.length > 0)
        : allOptions;
      setMaintenanceTaskSelectionOptions(matchedByModel.length > 0 ? matchedByModel : allOptions);
      setTaskSelectionLoading(false);
    };
    void loadMaintenanceTaskSelectionOptions();
    return () => {
      active = false;
    };
  }, [scopedDb, workOrderCreateForm.aircraftId, workOrderCreateForm.selectedAircraftModel]);
  useEffect(() => {
    let active = true;
    const loadTaskConflicts = async () => {
      if (!workOrderCreateForm.aircraftId || maintenanceTaskSelectionOptions.length === 0) {
        setTaskConflictById({});
        return;
      }
      const { data: linkedTasks, error: linkedTasksError } = await scopedDb
        .from('aircraft_maintenance_tasks')
        .select('task_id')
        .eq('aircraft_id', workOrderCreateForm.aircraftId)
        .eq('is_active', true)
        .limit(2000);
      if (!active) {
        return;
      }
      if (linkedTasksError) {
        setTaskConflictById({});
        return;
      }
      const existingTaskIds = new Set(((linkedTasks ?? []) as Array<{ task_id: string | null }>)
        .map((item) => String(item.task_id || '').trim())
        .filter((id) => id.length > 0));
      const nextConflictMap: Record<string, TaskConflictInfo> = {};
      maintenanceTaskSelectionOptions.forEach((task) => {
        if (existingTaskIds.has(task.value)) {
          nextConflictMap[task.value] = {
            taskId: task.value,
            reason: 'Task already assigned to this aircraft.',
          };
        }
      });
      setTaskConflictById(nextConflictMap);
      const selectedConflicts = workOrderCreateForm.selectedTaskIds.filter((taskId) => Boolean(nextConflictMap[taskId]));
      if (selectedConflicts.length > 0) {
        handleWorkOrderCreateFormChange('selectedTaskIds', workOrderCreateForm.selectedTaskIds.filter((taskId) => !nextConflictMap[taskId]));
      }
    };
    void loadTaskConflicts();
    return () => {
      active = false;
    };
  }, [scopedDb, workOrderCreateForm.aircraftId, maintenanceTaskSelectionOptions]);
  useEffect(() => {
    setManualWorkOrderOrder((current) => {
      const liveIds = state.workOrders.map((workOrder) => workOrder.id);
      const retained = current.filter((id) => liveIds.includes(id));
      const appended = liveIds.filter((id) => !retained.includes(id));
      return [...retained, ...appended];
    });
  }, [state.workOrders]);
  const workOrderRuntimeRows = useMemo<Record<string, WorkOrderGridRuntimeRow>>(
    () =>
      state.workOrders.reduce<Record<string, WorkOrderGridRuntimeRow>>((accumulator, workOrder) => {
        const assetTag = state.assets.find((asset) => asset.id === workOrder.assetId)?.assetTag || workOrder.assetId;
        const scheduleRow = state.scheduleBoardRows.find((row) => row.work_order_id === workOrder.id);
        const dueLabel = scheduleRow?.slot_end || 'TBD';
        accumulator[workOrder.id] = {
          id: workOrder.id,
          packageNumber: workOrder.packageNumber,
          aircraft: assetTag,
          priority: 'Normal',
          category: 'Line',
          station: scheduleRow?.station_code || 'N/A',
          due: dueLabel,
          status: String(workOrder.lifecycleStage),
          owner: activeUxRole,
          dueEpoch: dueLabel === 'TBD' ? Number.MAX_SAFE_INTEGER : new Date(dueLabel).getTime(),
        };
        return accumulator;
      }, {}),
    [activeUxRole, state.assets, state.scheduleBoardRows, state.workOrders],
  );
  const filteredWorkOrders = state.workOrders.filter((workOrder) => {
    const runtimeRow = workOrderRuntimeRows[workOrder.id];
    const fleetMatch = selectedFleetFilter === 'all' || runtimeRow.aircraft === selectedFleetFilter;
    const stationMatch = selectedStationFilter === 'all' || runtimeRow.station === selectedStationFilter;
    const columnFilterMatch = (Object.entries(debouncedWorkOrderGridFilters) as Array<[WorkOrderGridColumnKey, string]>).every(([columnKey, rawFilterValue]) => {
      const normalizedFilterValue = rawFilterValue.trim().toLowerCase();
      if (!normalizedFilterValue) return true;
      return String(runtimeRow[columnKey]).toLowerCase().includes(normalizedFilterValue);
    });
    return fleetMatch && stationMatch && columnFilterMatch;
  });
  const manuallyOrderedWorkOrders = [...filteredWorkOrders].sort((left, right) => {
    const leftIndex = manualWorkOrderOrder.indexOf(left.id);
    const rightIndex = manualWorkOrderOrder.indexOf(right.id);
    if (leftIndex === -1 && rightIndex === -1) return 0;
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
  const sortedWorkOrders = workOrderSortField === 'manual'
    ? manuallyOrderedWorkOrders
    : [...filteredWorkOrders].sort((left, right) => {
      const leftRuntime = workOrderRuntimeRows[left.id];
      const rightRuntime = workOrderRuntimeRows[right.id];
      if (workOrderSortField === 'due') {
        const compareDue = leftRuntime.dueEpoch - rightRuntime.dueEpoch;
        return workOrderSortDirection === 'asc' ? compareDue : compareDue * -1;
      }
      const compare = String(leftRuntime[workOrderSortField]).localeCompare(String(rightRuntime[workOrderSortField]));
      return workOrderSortDirection === 'asc' ? compare : compare * -1;
    });
  const workOrderTotalPages = Math.max(1, Math.ceil(sortedWorkOrders.length / workOrderPageSize));
  const pagedWorkOrders = sortedWorkOrders.slice((workOrderPage - 1) * workOrderPageSize, workOrderPage * workOrderPageSize);
  const hasAnyWorkOrders = state.workOrders.length > 0;
  const hasVisibleWorkOrders = pagedWorkOrders.length > 0;
  const hasActiveScopeFilters = state.workOrderStatusFilter !== 'all'
    || state.workOrderSearch.trim().length > 0
    || state.selectedSavedViewId !== 'default-all'
    || selectedFleetFilter !== 'all'
    || selectedStationFilter !== 'all';
  const isFilterScopedEmpty = hasAnyWorkOrders && filteredWorkOrders.length === 0;
  const isWorkspaceEmpty = !state.loadingWorkOrders && !hasVisibleWorkOrders;
  const predictiveRiskSegments = state.predictiveRecommendations.reduce(
    (summary, recommendation) => {
      if (recommendation.riskScore >= 80) summary.high += 1;
      else if (recommendation.riskScore >= 50) summary.medium += 1;
      else summary.low += 1;
      return summary;
    },
    { high: 0, medium: 0, low: 0 },
  );
  const visibleWorkspaceError = state.workOrdersError?.trim().toLowerCase() === 'not found' ? null : state.workOrdersError;
  const taskActionDisabledReason = canDirectTaskExecution ? '' : 'Disabled by policy: management role cannot submit technician execution actions.';
  const selectedWorkOrderAssignee = state.selectedWorkOrder?.tasks?.[0]?.assignedRole || 'Unassigned';
  const selectedAircraft = useMemo(() => 
    workOrderAircraftOptions.find((aircraft) => aircraft.id === workOrderCreateForm.aircraftId) || null,
    [workOrderAircraftOptions, workOrderCreateForm.aircraftId]
  );
  
  // Memoized aircraft filtering using debounced search to prevent flickering
  const filteredAircraftOptions = useMemo(() => {
    const searchTerm = debouncedAircraftSearchTerm.trim();
    if (!searchTerm) return workOrderAircraftOptions;
    
    const token = searchTerm.toLowerCase();
    return workOrderAircraftOptions.filter((aircraft) =>
      [
        aircraft.aircraftModel,
        aircraft.registration,
        aircraft.serialNumber,
        aircraft.operatorCode,
      ].some((entry) => entry?.toLowerCase().includes(token))
    );
  }, [workOrderAircraftOptions, debouncedAircraftSearchTerm]);
  
  // Memoized task filtering using debounced search to prevent flickering
  const taskSelectionOptions = useMemo(() => {
    const searchTerm = debouncedTaskSearchTerm.trim();
    if (!searchTerm) return maintenanceTaskSelectionOptions;
    
    const token = searchTerm.toLowerCase();
    return maintenanceTaskSelectionOptions.filter((task) =>
      [
        task.taskNumber,
        task.title,
        task.category,
        task.status,
      ].some((entry) => entry?.toLowerCase().includes(token))
    );
  }, [maintenanceTaskSelectionOptions, debouncedTaskSearchTerm]);
  const selectedTaskOptions = maintenanceTaskSelectionOptions
    .filter((task) => workOrderCreateForm.selectedTaskIds.includes(task.value));
  const selectedTaskCount = selectedTaskOptions.length;
  const selectedTaskConflicts = selectedTaskOptions.filter((task) => taskConflictById[task.value]);
  const workOrderValidationSummary = Array.from(new Set(Object.values(workOrderCreateErrors).filter(Boolean)));
  const canSelectTasks = Boolean(workOrderCreateForm.aircraftId);
  const formatDateTime = (value: string | number) => new Intl.DateTimeFormat(workspaceLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

  const emitPerformanceMetric = (
    metricName: string,
    durationMs: number,
    targetMs: number,
    hardLimitMs: number,
    metadata: Record<string, unknown> = {},
  ) => {
    if (typeof window === 'undefined') return;
    const roundedDurationMs = Number(durationMs.toFixed(2));
    const status = roundedDurationMs <= targetMs ? 'target_met' : roundedDurationMs <= hardLimitMs ? 'target_at_risk' : 'hard_limit_breached';
    window.dispatchEvent(new CustomEvent('amro:performance-metric', {
      detail: {
        metricName,
        durationMs: roundedDurationMs,
        targetMs,
        hardLimitMs,
        status,
        metadata,
      },
    }));
    if (status === 'hard_limit_breached') {
      window.dispatchEvent(new CustomEvent('amro:performance-alert', {
        detail: {
          metricName,
          durationMs: roundedDurationMs,
          hardLimitMs,
          metadata,
        },
      }));
    }
  };

  const startFilterApplyTimer = (trigger: string) => {
    filterApplyStartedAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('amro:performance-trace', {
      detail: {
        interaction: 'work_order_filter_apply',
        trigger,
        startedAt: new Date().toISOString(),
      },
    }));
  };

  const trackTaskStepSubmitInteraction = async (taskId: string, action: 'start' | 'complete' | 'block' | 'reopen') => {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    await state.updateTaskExecutionStatus(taskId, action);
    const completedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    emitPerformanceMetric('task_step_submit_online', completedAt - startedAt, amroTaskStepSubmitBenchmark.targetMs, amroTaskStepSubmitBenchmark.hardLimitMs, { action });
  };

  const publishWorkspaceExport = (scope: string, payload: Record<string, unknown>) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amro:workspace-export', {
        detail: {
          scope,
          payload,
          exportedAt: new Date().toISOString(),
        },
      }));
    }
    const exportedAtLabel = new Date().toISOString();
    setLastWorkspaceExportAt(exportedAtLabel);
    setLastInteractionMessage(`Export prepared for ${scope} at ${formatDateTime(exportedAtLabel)}.`);
    toast.success(`Export prepared for ${scope}.`);
  };

  const handleOpenComplianceGate = async () => {
    const ok = await state.loadComplianceGateExplainability();
    if (ok) {
      state.setComplianceGateModalOpen(true);
      setLastInteractionMessage('Compliance gate explainability loaded.');
      toast.success('Compliance gate loaded.');
      return;
    }
    setLastInteractionMessage('Unable to load compliance gate explainability.');
    toast.error('Unable to load compliance gate.');
  };

  const handleOpenWorkOrder = async (workOrderId: string, packageNumber: string) => {
    setBusyWorkOrderActionId(`open-${workOrderId}`);
    try {
      const ok = await state.openWorkOrderDetails(workOrderId);
      setLastInteractionMessage(ok ? `Opened work package ${packageNumber}.` : `Unable to open work package ${packageNumber}.`);
      if (ok) {
        toast.success(`Opened ${packageNumber}.`);
      } else {
        toast.error(`Unable to open ${packageNumber}.`);
      }
    } finally {
      setBusyWorkOrderActionId(null);
    }
  };

  const handleScheduleWorkOrder = async (workOrderId: string, packageNumber: string) => {
    state.setSelectedWorkOrderId(workOrderId);
    setBusyWorkOrderActionId(`schedule-${workOrderId}`);
    try {
      const ok = await state.updateWorkOrderScheduling(workOrderId);
      setLastInteractionMessage(ok ? `Scheduled work package ${packageNumber}.` : `Unable to schedule work package ${packageNumber}.`);
      if (ok) {
        toast.success(`Scheduled ${packageNumber}.`);
      } else {
        toast.error(`Unable to schedule ${packageNumber}.`);
      }
    } finally {
      setBusyWorkOrderActionId(null);
    }
  };

  const handleHoldWorkOrder = async (workOrderId: string, packageNumber: string) => {
    state.setSelectedWorkOrderId(workOrderId);
    setBusyWorkOrderActionId(`hold-${workOrderId}`);
    try {
      const ok = await state.toggleWorkOrderHold(workOrderId);
      setLastInteractionMessage(ok ? `Hold status updated for ${packageNumber}.` : `Unable to update hold status for ${packageNumber}.`);
      if (ok) {
        toast.success(`Hold status updated for ${packageNumber}.`);
      } else {
        toast.error(`Unable to update hold for ${packageNumber}.`);
      }
    } finally {
      setBusyWorkOrderActionId(null);
    }
  };

  const handleCloneWorkOrder = async (workOrderId: string, packageNumber: string) => {
    setBusyWorkOrderActionId(`clone-${workOrderId}`);
    try {
      const ok = await state.cloneWorkOrderFromTemplate(workOrderId);
      setLastInteractionMessage(ok ? `Cloned from ${packageNumber}.` : `Clone failed for ${packageNumber}.`);
      if (ok) {
        toast.success(`Cloned ${packageNumber}.`);
      } else {
        toast.error(`Clone failed for ${packageNumber}.`);
      }
    } finally {
      setBusyWorkOrderActionId(null);
    }
  };

  const handleWorkOrderExport = (workOrderId: string, packageNumber: string) => {
    const workOrder = state.workOrders.find((item) => item.id === workOrderId);
    if (!workOrder) {
      toast.error(`Unable to export ${packageNumber}.`);
      return;
    }
    const assetTag = state.assets.find((asset) => asset.id === workOrder.assetId)?.assetTag || 'Unknown';
    const exportRows = [
      {
        workOrderId: workOrder.id,
        packageNumber: workOrder.packageNumber,
        lifecycleStage: workOrder.lifecycleStage,
        assetTag,
      },
    ];
    const exportPayload = {
      workOrderId,
      packageNumber,
      moduleKey: moduleKey || 'amro',
      view: workspaceViewMode,
      theme: workspaceTheme,
      exportedAt: new Date().toISOString(),
    };
    publishWorkspaceExport('work-order', {
      ...exportPayload,
    });
    if (typeof window !== 'undefined') {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'WorkOrder');
      XLSX.writeFile(workbook, `${packageNumber}-export.xlsx`);
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      autoTable(pdf, {
        head: [['Work Package ID', 'Package Number', 'Lifecycle Stage', 'Asset']],
        body: exportRows.map((row) => [row.workOrderId, row.packageNumber, row.lifecycleStage, row.assetTag]),
      });
      pdf.save(`${packageNumber}-export.pdf`);
    }
    toast.success(`Exported ${packageNumber} to XLSX and PDF.`);
  };

  const handleWorkspaceImportExport = () => {
    publishWorkspaceExport('workspace-shell', {
      moduleKey: moduleKey || 'amro',
      view: workspaceViewMode,
      theme: workspaceTheme,
      locale: workspaceLocale,
      visibleWorkOrders: pagedWorkOrders.length,
    });
  };

  const handleWorkspaceThemeCycle = () => {
    const currentIndex = workspaceThemeOptions.indexOf(workspaceTheme);
    const nextTheme = workspaceThemeOptions[(currentIndex + 1) % workspaceThemeOptions.length];
    setWorkspaceTheme(nextTheme);
    setLastInteractionMessage(`Workspace theme switched to ${nextTheme}.`);
  };

  const handleBulkWorkOrderAction = async () => {
    if (!state.selectedWorkOrderId) {
      setLastInteractionMessage('Select a work package before running bulk actions.');
      return;
    }
    const ok = await state.advanceWorkOrderLifecycle();
    setLastInteractionMessage(ok ? 'Bulk action completed for selected work package.' : 'Bulk action failed for selected work package.');
  };

  const handleStickyAssignAction = async () => {
    if (!state.selectedWorkOrder) {
      setLastInteractionMessage('Select a work package before assigning.');
      return;
    }
    await handleScheduleWorkOrder(state.selectedWorkOrder.id, state.selectedWorkOrder.packageNumber);
  };

  const handleStickyScheduleAction = async () => {
    if (!state.selectedWorkOrder) {
      setLastInteractionMessage('Select a work package before scheduling.');
      return;
    }
    await handleScheduleWorkOrder(state.selectedWorkOrder.id, state.selectedWorkOrder.packageNumber);
  };

  const handleStickyGateCheckAction = async () => {
    if (!state.selectedWorkOrderId) {
      setLastInteractionMessage('Select a work package before running compliance gate checks.');
      return;
    }
    await handleOpenComplianceGate();
  };

  const handleStickyHoldAction = async () => {
    if (!state.selectedWorkOrder) {
      setLastInteractionMessage('Select a work package before placing hold transition.');
      return;
    }
    await handleHoldWorkOrder(state.selectedWorkOrder.id, state.selectedWorkOrder.packageNumber);
  };

  const handleEscalateAction = (target: 'engineering' | 'compliance') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amro:escalation-requested', {
        detail: {
          target,
          workOrderId: state.selectedWorkOrderId || null,
          requestedAt: new Date().toISOString(),
        },
      }));
    }
    setLastInteractionMessage(`Escalation request submitted to ${target}.`);
  };

  const handleDragHandleInteraction = (workOrderId: string, packageNumber: string) => {
    state.setSelectedWorkOrderId(workOrderId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amro:work-order-drag-handle', {
        detail: {
          packageNumber,
          selectedWorkOrderId: workOrderId,
          triggeredAt: new Date().toISOString(),
        },
      }));
    }
    setLastInteractionMessage(`Drag interaction registered for ${packageNumber}.`);
    toast.success(`Drag handle active for ${packageNumber}.`);
  };

  const handleWorkOrderReorder = (sourceWorkOrderId: string, targetWorkOrderId: string) => {
    if (sourceWorkOrderId === targetWorkOrderId) return;
    const sourceWorkOrder = state.workOrders.find((workOrder) => workOrder.id === sourceWorkOrderId);
    const targetWorkOrder = state.workOrders.find((workOrder) => workOrder.id === targetWorkOrderId);
    let reorderedOutput: string[] = [];
    setManualWorkOrderOrder((current) => {
      const order = current.length > 0 ? current : state.workOrders.map((workOrder) => workOrder.id);
      const sourceIndex = order.indexOf(sourceWorkOrderId);
      const targetIndex = order.indexOf(targetWorkOrderId);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      const reordered = [...order];
      const [movedItem] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, movedItem);
      reorderedOutput = reordered;
      return reordered;
    });
    setWorkOrderSortField('manual');
    if (typeof window !== 'undefined' && reorderedOutput.length > 0) {
      window.localStorage.setItem(amroManualWorkOrderOrderStorageKey, JSON.stringify(reorderedOutput));
      window.dispatchEvent(new CustomEvent('amro:work-order-order-updated', {
        detail: {
          orderedWorkOrderIds: reorderedOutput,
          updatedAt: new Date().toISOString(),
        },
      }));
    }
    setLastInteractionMessage(`Reordered ${sourceWorkOrder?.packageNumber || sourceWorkOrderId} before ${targetWorkOrder?.packageNumber || targetWorkOrderId}.`);
    toast.success(`Reordered ${sourceWorkOrder?.packageNumber || 'work package'}.`);
  };

  const handleIntegrationRefresh = () => {
    void state.refreshWorkOrders();
    void state.loadAuditReplayTimeline();
    setLastInteractionMessage('Integration monitor refreshed with latest workspace and replay feed.');
  };

  const handleIntegrationReplayConsole = () => {
    void state.loadAuditReplayTimeline();
    setLastInteractionMessage('Replay console feed loaded.');
  };

  const handleIntegrationExportSnapshot = () => {
    publishWorkspaceExport('integration-monitor', {
      replayEventCount: state.complianceAuditReplay?.eventCount || 0,
      anomalyCount: state.complianceAnomalyAlerts.length,
      moduleKey: moduleKey || 'integration',
    });
  };

  const handleDetailTabChange = (nextTab: string) => {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setDetailTab(nextTab);
    const completedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    emitPerformanceMetric('detail_tab_switch', completedAt - startedAt, amroDetailTabSwitchBenchmark.targetMs, amroDetailTabSwitchBenchmark.hardLimitMs, { tab: nextTab });
  };

  const handleStatusFilterChange = (value: string) => {
    startFilterApplyTimer('status');
    state.setWorkOrderStatusFilter(value);
  };

  const handleSearchFilterChange = (value: string) => {
    startFilterApplyTimer('search');
    state.setWorkOrderSearch(value);
  };

  /**
   * Updates a per-column filter value used by the AMRO work package data grid.
   */
  const handleGridFilterChange = (columnKey: WorkOrderGridColumnKey, value: string) => {
    startFilterApplyTimer(`column_${columnKey}`);
    setWorkOrderGridFilters((current) => ({
      ...current,
      [columnKey]: value,
    }));
    setWorkOrderPage(1);
  };

  /**
   * Clears a single per-column filter while preserving other active column filters.
   */
  const handleGridFilterClear = (columnKey: WorkOrderGridColumnKey) => {
    handleGridFilterChange(columnKey, '');
  };

  /**
   * Sorts by clicking a semantic column header and toggles ascending/descending.
   */
  const handleGridSortToggle = (columnKey: WorkOrderGridSortKey) => {
    if (workOrderSortField === columnKey) {
      setWorkOrderSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setWorkOrderSortField(columnKey);
    setWorkOrderSortDirection('asc');
  };

  /**
   * Toggles a column visibility preference while preserving at least one visible column.
   */
  const handleGridColumnVisibilityToggle = (columnKey: WorkOrderGridColumnKey) => {
    setWorkOrderGridVisibleColumns((current) => {
      const currentlyVisible = Object.values(current).filter(Boolean).length;
      if (current[columnKey] && currentlyVisible === 1) return current;
      return {
        ...current,
        [columnKey]: !current[columnKey],
      };
    });
  };

  /**
   * Starts pointer-driven column resizing with hard min/max width constraints.
   */
  const handleGridResizeStart = (columnKey: WorkOrderGridColumnKey, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    gridResizeActiveRef.current = {
      columnKey,
      startX: event.clientX,
      startWidth: workOrderGridColumnWidths[columnKey],
    };
  };

  const handleSavedViewChange = (value: string) => {
    startFilterApplyTimer('saved_view');
    state.setSelectedSavedViewId(value);
  };

  const handleResetWorkOrderScope = () => {
    setSelectedFleetFilter('all');
    setSelectedStationFilter('all');
    state.setSelectedSavedViewId('default-all');
    state.setWorkOrderStatusFilter('all');
    state.setWorkOrderSearch('');
    setWorkOrderPage(1);
    setLastInteractionMessage('Work package scope reset to defaults.');
  };

  const handleRetryWorkspaceLoad = () => {
    void state.refreshWorkOrders();
    setLastInteractionMessage('Work package refresh requested.');
  };

  const handleCreateStarterWorkOrder = async () => {
    const ok = await state.createWorkOrder('Starter Work Package');
    setLastInteractionMessage(ok ? 'Starter work package created.' : 'Unable to create starter work package.');
  };

  const handleCreateWorkOrder = async () => {
    const ok = await state.createWorkOrder(newWorkOrderTitle);
    if (ok) {
      setNewWorkOrderTitle('');
    }
  };

  const handleOpenWorkOrderCreateDialog = () => {
    const cached = workOrderCreateDraftCacheRef.current.get(workOrderCreateTab);
    const defaultState = createDefaultWorkOrderCreateFormState();
    setWorkOrderCreateForm({
      ...defaultState,
      ...cached,
    });
    setWorkOrderCreateErrors({});
    setTaskSearchTerm('');
    setAircraftSearchTerm('');
    setTaskConflictById({});
    setReviewSubmitDialogOpen(false);
    setWorkOrderCreateDialogOpen(true);
  };

  const handleWorkOrderCreateTabChange = (nextTab: WorkOrderCreateTab) => {
    workOrderCreateDraftCacheRef.current.set(workOrderCreateTab, workOrderCreateForm);
    const cachedNext = workOrderCreateDraftCacheRef.current.get(nextTab);
    if (cachedNext) {
      setWorkOrderCreateForm(cachedNext);
    }
    setWorkOrderCreateTab(nextTab);
  };

  const handleWorkOrderCreateFormChange = useCallback(<K extends keyof WorkOrderCreateFormState>(key: K, value: WorkOrderCreateFormState[K]) => {
    setWorkOrderCreateForm((current) => ({
      ...current,
      [key]: value,
    }));
    setWorkOrderCreateErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[key];
      return nextErrors;
    });
  }, []);

  const handleSelectWorkOrderAircraft = useCallback((aircraftId: string) => {
    const selected = workOrderAircraftOptions.find((aircraft) => aircraft.id === aircraftId);
    handleWorkOrderCreateFormChange('aircraftId', aircraftId);
    handleWorkOrderCreateFormChange('selectedAircraftModel', selected?.aircraftModel || '');
    handleWorkOrderCreateFormChange('selectedAircraftSerialOrRegistration', selected?.serialNumber || selected?.registration || '');
    handleWorkOrderCreateFormChange('locationStation', selected?.stationCode || '');
    handleWorkOrderCreateFormChange('selectedTaskIds', []);
    setTaskConflictById({});
  }, [workOrderAircraftOptions, handleWorkOrderCreateFormChange]);

  const handleToggleWorkOrderCreateTaskSelection = (taskId: string, checked: boolean) => {
    if (taskConflictById[taskId]) {
      return;
    }
    const selected = workOrderCreateForm.selectedTaskIds;
    const nextSelected = checked
      ? selected.includes(taskId) ? selected : [...selected, taskId]
      : selected.filter((id) => id !== taskId);
    handleWorkOrderCreateFormChange('selectedTaskIds', nextSelected);
  };

  const handleOpenWorkOrderSubmitReview = () => {
    const validationErrors = validateWorkOrderCreateForm(workOrderCreateForm);
    if (Object.keys(validationErrors).length > 0) {
      setWorkOrderCreateErrors(validationErrors);
      toast.error('Validation failed for work package form.');
      return;
    }
    setReviewSubmitDialogOpen(true);
  };

  const validateWorkOrderCreateForm = (values: WorkOrderCreateFormState): WorkOrderCreateFormErrors => {
    const nextErrors: WorkOrderCreateFormErrors = {};
    if (!values.aircraftId.trim()) {
      nextErrors.aircraftId = 'Aircraft is required before task selection.';
    }
    if (!values.packageNumber.trim()) {
      nextErrors.packageNumber = 'Work package number is required.';
    }
    if (!values.topic.trim()) {
      nextErrors.topic = 'Topic is required.';
    }
    if (!values.workOrderDetails.trim()) {
      nextErrors.workOrderDetails = 'Work package details is required.';
    }
    if (!values.locationStation.trim()) {
      nextErrors.locationStation = 'Location or station is required.';
    }
    const revisionValue = Number(values.revision);
    if (!Number.isInteger(revisionValue) || revisionValue < 1) {
      nextErrors.revision = 'Revision must be a positive integer.';
    }
    if (values.selectedTaskIds.length === 0) {
      nextErrors.selectedTaskIds = 'Select at least one task.';
    }
    if (values.selectedTaskIds.some((taskId) => Boolean(taskConflictById[taskId]))) {
      nextErrors.selectedTaskIds = 'Remove conflicted tasks before submission.';
    }
    if (!values.plannedStartDate) {
      nextErrors.plannedStartDate = 'Planned start date is required.';
    }
    if (!values.plannedEndDate) {
      nextErrors.plannedEndDate = 'Planned end date is required.';
    }
    if (values.plannedStartDate && values.plannedEndDate && values.plannedStartDate > values.plannedEndDate) {
      nextErrors.plannedEndDate = 'Planned end date must be on or after planned start date.';
    }
    return nextErrors;
  };

  const handleSubmitWorkOrderCreateForm = async () => {
    const validationErrors = validateWorkOrderCreateForm(workOrderCreateForm);
    if (Object.keys(validationErrors).length > 0) {
      setWorkOrderCreateErrors(validationErrors);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('amro:work-order-form-validation-error', {
          detail: {
            errors: validationErrors,
            submittedAt: new Date().toISOString(),
          },
        }));
      }
      setLastInteractionMessage('Fix validation errors before adding a work package.');
      toast.error('Validation failed for work package form.');
      return;
    }
    const selectedTaskLabels = selectedTaskOptions.map((task) => `${task.taskNumber} · ${task.title}`);
    setWorkOrderCreateSubmitting(true);
    const ok = await state.createWorkOrder(
      workOrderCreateForm.topic || workOrderCreateForm.workOrderDetails || workOrderCreateForm.packageNumber,
      {
        aircraftId: workOrderCreateForm.aircraftId,
        maintenanceType: workOrderCreateForm.maintenanceType,
        priority: workOrderCreateForm.priority,
        plannedStartIso: `${workOrderCreateForm.plannedStartDate}T00:00:00.000Z`,
        plannedEndIso: `${workOrderCreateForm.plannedEndDate}T23:59:59.000Z`,
        station: workOrderCreateForm.locationStation || (selectedStationFilter === 'all' ? undefined : selectedStationFilter),
        scopeItems: [
          workOrderCreateForm.packageNumber,
          workOrderCreateForm.topic,
          workOrderCreateForm.workOrderDetails,
          ...selectedTaskLabels,
        ].filter((item) => item.trim().length > 0),
        taskPlan: workOrderCreateForm.selectedTaskIds,
        revision: workOrderCreateForm.revision,
        assignedRole: workOrderCreateForm.assignedRole,
        workflowStatus: workOrderCreateForm.workflowStatus,
        taskSnapshot: selectedTaskOptions.map((task) => ({
          id: task.value,
          taskNumber: task.taskNumber,
          title: task.title,
          dueBasis: task.dueBasis,
          estimatedManHours: task.estimatedManHours,
          category: task.category,
        })),
        clientMetadata: {
          createdBy: workOrderCreateForm.createdBy,
          createdAt: new Date().toISOString(),
          clientTimestamp: new Date().toISOString(),
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          duplicateCheckPassed: selectedTaskConflicts.length === 0,
          planningDate: workOrderCreateForm.planningDate,
          remarks: workOrderCreateForm.remarks,
          serialOrRegistration: workOrderCreateForm.selectedAircraftSerialOrRegistration,
          aircraftModel: workOrderCreateForm.selectedAircraftModel,
        },
      },
    );
    setWorkOrderCreateSubmitting(false);
    if (!ok) {
      setLastInteractionMessage('Unable to add work package. Retry after resolving API issues.');
      toast.error('Unable to add work package.');
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amro:work-order-created', {
        detail: {
          source: 'work-order-create-dialog',
          ...workOrderCreateForm,
          selectedTaskCount: selectedTaskOptions.length,
          createdAt: new Date().toISOString(),
        },
      }));
    }
    workOrderCreateDraftCacheRef.current.clear();
    setWorkOrderCreateForm(createDefaultWorkOrderCreateFormState());
    setWorkOrderCreateErrors({});
    setTaskConflictById({});
    setReviewSubmitDialogOpen(false);
    setWorkOrderCreateDialogOpen(false);
    setLastInteractionMessage('Work package added successfully.');
    toast.success('Work package added.');
  };

  const handleDeleteWorkOrder = async (workOrderId: string, packageNumber: string) => {
    if (!state.canDeleteWorkOrder) {
      toast.error('Insufficient permissions to delete work package.');
      return;
    }
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Soft delete work package ${packageNumber}?`);
      if (!confirmed) {
        return;
      }
    }
    state.setSelectedWorkOrderId(workOrderId);
    setBusyWorkOrderActionId(`delete-${workOrderId}`);
    try {
      const ok = await state.softDeleteWorkOrder(workOrderId);
      setLastInteractionMessage(ok ? `Deleted work package ${packageNumber}.` : `Unable to delete work package ${packageNumber}.`);
      if (ok) {
        toast.success(`Deleted ${packageNumber}.`, {
          action: {
            label: 'Undo',
            onClick: () => {
              void state.restoreSoftDeletedWorkOrder(workOrderId).then((restored) => {
                if (restored) {
                  setLastInteractionMessage(`Recovered work package ${packageNumber}.`);
                  toast.success(`Recovered ${packageNumber}.`);
                  return;
                }
                toast.error(`Unable to recover ${packageNumber}.`);
              });
            },
          },
        });
      } else {
        toast.error(`Unable to delete ${packageNumber}.`);
      }
    } finally {
      setBusyWorkOrderActionId(null);
    }
  };

  const handleSaveCurrentView = async () => {
    const ok = await state.saveCurrentWorkOrderView(savedViewName);
    if (ok) {
      setSavedViewName('');
    }
  };

  const handlePersistDetailDraft = () => {
    setLastSavedDetailDraft(detailDraft);
  };

  const handleConfirmWorkOrderClosure = async () => {
    if (!closureRationale.trim()) return;
    await state.advanceWorkOrderLifecycle();
    setClosureConfirmOpen(false);
    setClosureRationale('');
  };

  const handleConfirmComplianceOverride = () => {
    if (!overrideRationale.trim()) return;
    setOverrideConfirmOpen(false);
    setOverrideRationale('');
  };

  const handleConfirmDeferral = async () => {
    if (!deferralRationale.trim()) return;
    await state.submitCertificationDecision('defer');
    setDeferralConfirmOpen(false);
    setDeferralRationale('');
  };

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedDetailChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, [hasUnsavedDetailChanges]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedViewMode = window.localStorage.getItem(amroWorkspaceViewStorageKey);
    if (storedViewMode && workspaceViewModes.includes(storedViewMode as (typeof workspaceViewModes)[number])) {
      setWorkspaceViewMode(storedViewMode as (typeof workspaceViewModes)[number]);
    }
    const storedTheme = window.localStorage.getItem(amroWorkspaceThemeStorageKey);
    if (storedTheme && workspaceThemeOptions.includes(storedTheme as (typeof workspaceThemeOptions)[number])) {
      setWorkspaceTheme(storedTheme as (typeof workspaceThemeOptions)[number]);
    }
    const storedPageSize = Number(window.localStorage.getItem(amroWorkOrderPageSizeStorageKey));
    if (workOrderPageSizes.includes(storedPageSize as (typeof workOrderPageSizes)[number])) {
      setWorkOrderPageSize(storedPageSize);
    }
    const storedLocale = window.localStorage.getItem(amroWorkspaceLocaleStorageKey);
    if (storedLocale && workspaceLocaleOptions.includes(storedLocale as (typeof workspaceLocaleOptions)[number])) {
      setWorkspaceLocale(storedLocale as (typeof workspaceLocaleOptions)[number]);
    }
    const storedManualOrder = window.localStorage.getItem(amroManualWorkOrderOrderStorageKey);
    if (storedManualOrder) {
      try {
        const parsed = JSON.parse(storedManualOrder);
        if (Array.isArray(parsed)) {
          setManualWorkOrderOrder(parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0));
        }
      } catch {
        setManualWorkOrderOrder([]);
      }
    }
    const storedGridPreferences = window.localStorage.getItem(amroGridPreferencesStorageKey);
    if (storedGridPreferences) {
      try {
        const parsed = JSON.parse(storedGridPreferences) as Partial<WorkOrderGridPreferences>;
        if (parsed.visibleColumns) {
          setWorkOrderGridVisibleColumns((current) => ({
            ...current,
            ...parsed.visibleColumns,
          }));
        }
        if (parsed.columnWidths) {
          setWorkOrderGridColumnWidths((current) => {
            const next = { ...current };
            (Object.keys(current) as WorkOrderGridColumnKey[]).forEach((columnKey) => {
              const candidate = Number(parsed.columnWidths?.[columnKey]);
              if (Number.isFinite(candidate)) {
                next[columnKey] = Math.max(80, Math.min(400, candidate));
              }
            });
            return next;
          });
        }
      } catch {
        setWorkOrderGridVisibleColumns(defaultGridVisibleColumns);
        setWorkOrderGridColumnWidths(defaultGridColumnWidths);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(amroWorkspaceViewStorageKey, workspaceViewMode);
  }, [workspaceViewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(amroWorkspaceThemeStorageKey, workspaceTheme);
  }, [workspaceTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(amroWorkOrderPageSizeStorageKey, String(workOrderPageSize));
  }, [workOrderPageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(amroWorkspaceLocaleStorageKey, workspaceLocale);
  }, [workspaceLocale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(amroManualWorkOrderOrderStorageKey, JSON.stringify(manualWorkOrderOrder));
  }, [manualWorkOrderOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      amroGridPreferencesStorageKey,
      JSON.stringify({
        visibleColumns: workOrderGridVisibleColumns,
        columnWidths: workOrderGridColumnWidths,
      } satisfies WorkOrderGridPreferences),
    );
  }, [workOrderGridColumnWidths, workOrderGridVisibleColumns]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedWorkOrderGridFilters(workOrderGridFilters);
    }, 300);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [workOrderGridFilters]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const activeResize = gridResizeActiveRef.current;
      if (!activeResize) return;
      const nextWidth = activeResize.startWidth + (event.clientX - activeResize.startX);
      setWorkOrderGridColumnWidths((current) => ({
        ...current,
        [activeResize.columnKey]: Math.max(80, Math.min(400, nextWidth)),
      }));
    };
    const releaseResize = () => {
      gridResizeActiveRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', releaseResize);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', releaseResize);
    };
  }, []);

  useEffect(() => {
    if (workOrderPage <= workOrderTotalPages) return;
    setWorkOrderPage(workOrderTotalPages);
  }, [workOrderPage, workOrderTotalPages]);

  useEffect(() => {
    if (state.loadingWorkOrders || workspaceLoadMetricPublishedRef.current) return;
    const completedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    emitPerformanceMetric(
      'overview_dashboard_initial_load',
      completedAt - workspaceLoadStartedAtRef.current,
      amroDashboardLoadBenchmark.targetMs,
      amroDashboardLoadBenchmark.hardLimitMs,
      { workOrderCount: state.workOrders.length },
    );
    workspaceLoadMetricPublishedRef.current = true;
  }, [state.loadingWorkOrders, state.workOrders.length]);

  useEffect(() => {
    if (state.loadingWorkOrders || filterApplyStartedAtRef.current === null) return;
    const completedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    emitPerformanceMetric(
      'work_order_list_filter_apply',
      completedAt - filterApplyStartedAtRef.current,
      amroWorkOrderFilterApplyBenchmark.targetMs,
      amroWorkOrderFilterApplyBenchmark.hardLimitMs,
      {
        statusFilter: state.workOrderStatusFilter,
        searchFilterLength: state.workOrderSearch.length,
        savedViewId: state.selectedSavedViewId || null,
      },
    );
    filterApplyStartedAtRef.current = null;
  }, [state.loadingWorkOrders, state.selectedSavedViewId, state.workOrderSearch, state.workOrderStatusFilter]);

  return (
    <section className="space-y-4" aria-label="AMRO workspace">
      {state.loadingWorkOrders ? (
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          Loading latest AMRO workspace data...
        </div>
      ) : null}
      {visibleWorkspaceError ? (
        <div className="rounded-md border border-destructive/50 px-3 py-2 text-xs text-destructive" role="alert">
          {visibleWorkspaceError}
        </div>
      ) : null}
      {moduleKey && moduleKey !== 'work-orders' && moduleKey !== 'parts' ? (
        <Card data-amro-owned-surface="module-action-bar">
          <CardHeader className="pb-2">
            <CardTitle>{moduleActionBarTitle} Module Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {moduleActions.map((action) => (
                <Button key={action.id} variant={action.disabled ? 'outline' : 'secondary'} size="sm" onClick={action.onClick} disabled={action.disabled}>
                  {action.label}
                </Button>
              ))}
            </div>
            <div className="rounded-md border p-2 text-xs">
              {moduleActionStates.length > 0 ? (
                moduleActionStates.map((action) => (
                  <p key={`${action.id}-reason`} className="text-muted-foreground">
                    {action.label} ({action.stateLabel}): {action.stateReason}
                  </p>
                ))
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {!isScopedToModule ? (
        <>
      <Card data-amro-boundary="tenant-franchise-isolation">
        <CardHeader className="pb-2">
          <CardTitle>AMRO Bounded Context Boundary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline">Platform → Admin → Multi-Tenant → Multi-Franchisee</Badge>
          <Badge variant="outline">{state.isAmroAuthorized ? 'AMRO Authorized Context' : 'AMRO Authorization Required'}</Badge>
          <Badge variant={state.realtimeConnected ? 'secondary' : 'outline'}>
            {state.realtimeConnected ? 'Realtime Connected' : 'Realtime Disconnected'}
          </Badge>
        </CardContent>
      </Card>

      <Card data-amro-uiux-shell="ux-amro-architecture">
        <CardHeader className="pb-2">
          <CardTitle>AMRO UI/UX Unified Module Shell</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Header Controls</Badge>
            <Badge variant="outline">Workspace</Badge>
            <Badge variant="outline">Context Panel</Badge>
            <Badge variant="outline">Bottom Summary</Badge>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs font-semibold">Header Controls</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {amroHeaderActionOrder.map((action) => (
                <Badge key={action} variant="secondary">
                  {action}
                </Badge>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
              <Input value={state.workOrderSearch} onChange={(event) => handleSearchFilterChange(event.target.value)} placeholder="Search" />
              <Select value={state.workOrderStatusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  {workOrderStatusFilters.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={workspaceViewMode} onValueChange={(value) => setWorkspaceViewMode(value as (typeof workspaceViewModes)[number])}>
                <SelectTrigger>
                  <SelectValue placeholder="View" />
                </SelectTrigger>
                <SelectContent>
                  {workspaceViewModes.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreateWorkOrder} disabled={!newWorkOrderTitle.trim() || !state.canCreateWorkOrder}>
                Create
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button variant="outline" onClick={state.refreshWorkOrders} disabled={state.loadingWorkOrders}>
                {state.loadingWorkOrders ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="outline" onClick={handleWorkspaceImportExport}>Import/Export</Button>
              <Button variant="outline" onClick={handleWorkspaceThemeCycle}>Theme</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
            <div className="rounded-md border p-3">
              <p className="text-xs font-semibold">Workspace</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Active role: {activeUxRole}. Primary view set: {roleVariant.primaryViews}.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs font-semibold">Context Panel</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Audit feed, validation hints, and activity timeline are rendered through compliance replay and qualification status.
              </p>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs font-semibold">Bottom Summary</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <div className="rounded-md border p-2">MTTR: 6.4h</div>
              <div className="rounded-md border p-2">Schedule Adherence: 93%</div>
              <div className="rounded-md border p-2">Compliance: {state.complianceCoverage.activePacks}/{state.complianceCoverage.totalPacks}</div>
              <div className="rounded-md border p-2">Parts Fill Rate: {Math.max(0, 100 - state.materialsSummary.shortageCount * 5)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-amro-uiux-shell="ux-amro-role-variants">
        <CardHeader className="pb-2">
          <CardTitle>AMRO Role-Based UX Variants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 text-xs">
            <p className="font-semibold">Current Role Context</p>
            <p className="mt-1 text-muted-foreground">Role: {activeUxRole}</p>
            <p className="mt-1 text-muted-foreground">Core Actions: {roleVariant.coreActions}</p>
            <p className="mt-1 text-muted-foreground">Restricted Actions: {roleVariant.restrictedActions}</p>
          </div>
          <div className="space-y-2">
            {Object.entries(amroRoleVariants).map(([role, variant]) => (
              <div key={role} className="rounded-md border p-3 text-xs">
                <p className="font-semibold">{role}</p>
                <p className="mt-1 text-muted-foreground">Primary Views: {variant.primaryViews}</p>
                <p className="mt-1 text-muted-foreground">Core Actions: {variant.coreActions}</p>
                <p className="mt-1 text-muted-foreground">Restricted Actions: {variant.restrictedActions}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Button variant="outline" disabled={!canRunWorkOrderClosure} onClick={() => setClosureConfirmOpen(true)} aria-label="Run work package closure transition">
              Work Package Closure
            </Button>
            <Button variant="outline" disabled={!canRunComplianceOverride} onClick={() => setOverrideConfirmOpen(true)} aria-label="Run compliance override transition">
              Compliance Override
            </Button>
            <Button variant="outline" disabled={!canEditPartsAllocation}>
              Parts Allocation Edits
            </Button>
            <Button variant="outline" disabled={!canRunRegulatoryFinalSignOff}>
              Regulatory Final Sign-off
            </Button>
            <Button variant="outline" disabled={!canRunCertifyingRelease}>
              Certifying Release
            </Button>
            <Button variant="outline" disabled={!canDirectTaskExecution}>
              Direct Task Execution
            </Button>
          </div>
        </CardContent>
      </Card>
        </>
      ) : null}

      {showOverviewModule ? (
      <Card data-amro-screen="SCR-AMRO-001" role="region" aria-label="SCR-AMRO-001 Overview Dashboard">
        <CardHeader className="pb-2">
          <CardTitle>SCR-AMRO-001 AMRO Command Center</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Overview dashboard UI has been cleared.
          </div>
        </CardContent>
      </Card>
      ) : null}

      {showPrimaryUsersModule ? (
      <Card data-amro-owned-surface="primary-users-management" role="region" aria-label="Primary Users Management">
        <CardHeader className="pb-2">
          <CardTitle>Primary Users Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-5">
            <div className="rounded-md border p-2">Management: KPI oversight and approvals</div>
            <div className="rounded-md border p-2">Planner: package, capacity, and slot planning</div>
            <div className="rounded-md border p-2">Engineer: task and material orchestration</div>
            <div className="rounded-md border p-2">Technician: execution and evidence capture</div>
            <div className="rounded-md border p-2">Compliance Lead: gates, replay, and dossier checks</div>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
            <div className="rounded-md border p-2">AMRO Authorized: {state.isAmroAuthorized ? 'Yes' : 'No'}</div>
            <div className="rounded-md border p-2">Active Role: {state.activeRole}</div>
            <div className="rounded-md border p-2">Create Scope: {state.canCreateWorkOrder ? 'Enabled' : 'Restricted'}</div>
            <div className="rounded-md border p-2">Certifying Sign-off: {state.canSignOff ? 'Available' : 'Blocked'}</div>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {!isScopedToModule ? (
      <Card data-amro-owned-surface="asset-registry-configuration-state">
        <CardHeader className="pb-2">
          <CardTitle>Asset Registry and Configuration State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.assets.map((asset) => (
            <div key={asset.id} className="rounded-md border p-2 text-sm">
              <p className="font-medium">{asset.assetTag}</p>
              <p className="text-xs text-muted-foreground">
                {assetTypeLabel[asset.assetType]} · {asset.serialNumber}
              </p>
              <p className="text-xs text-muted-foreground">{asset.configurationState}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      ) : null}

      {showWorkOrdersModule ? (
      <Card data-amro-owned-surface="work-order-task-lifecycle-orchestration">
        <CardHeader className="pb-2">
          <CardTitle>Work Packages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3" data-amro-screen="SCR-AMRO-002" role="region" aria-label="Work Package List">
            <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Input
                  value={state.workOrderSearch}
                  onChange={(event) => handleSearchFilterChange(event.target.value)}
                  placeholder="Search"
                  className="w-[180px]"
                />
                <Select value={state.workOrderStatusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-[120px]" aria-label="Filters">
                    <SelectValue placeholder="Filters" />
                  </SelectTrigger>
                  <SelectContent>
                    {workOrderStatusFilters.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={`${workOrderSortField}:${workOrderSortDirection}`} onValueChange={(value) => {
                  const [field, direction] = value.split(':') as ['manual' | WorkOrderGridSortKey, 'asc' | 'desc'];
                  setWorkOrderSortField(field);
                  setWorkOrderSortDirection(direction);
                }}>
                  <SelectTrigger className="w-[140px]" aria-label="Group">
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual:asc">Manual Order</SelectItem>
                    <SelectItem value="packageNumber:asc">Group WO# ↑</SelectItem>
                    <SelectItem value="packageNumber:desc">Group WO# ↓</SelectItem>
                    <SelectItem value="status:asc">Group Status ↑</SelectItem>
                    <SelectItem value="status:desc">Group Status ↓</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={state.selectedSavedViewId} onValueChange={handleSavedViewChange}>
                  <SelectTrigger className="w-[140px]" aria-label="Saved View">
                    <SelectValue placeholder="Saved View" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.savedWorkOrderViews.map((view) => (
                      <SelectItem key={view.id} value={view.id}>
                        {view.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleCreateStarterWorkOrder()} disabled={!state.canCreateWorkOrder}>
                  New WP
                </Button>
                <Button onClick={handleOpenWorkOrderCreateDialog} disabled={!state.canCreateWorkOrder}>
                  Add WP
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Frozen identifiers: WO# / Aircraft</Badge>
              <Badge variant="outline">Sort: {workOrderSortField === 'manual' ? 'Manual' : workOrderSortField}</Badge>
              <Button variant="outline" size="sm" onClick={() => setWorkOrderSortField('manual')}>Manual Order</Button>
              <Button variant="outline" size="sm" onClick={() => setWorkOrderSortField('packageNumber')}>Sort WO#</Button>
              <Button variant="outline" size="sm" onClick={() => setWorkOrderSortField('status')}>Sort Status</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkOrderSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))}
                disabled={workOrderSortField === 'manual'}
              >
                Sort Direction: {workOrderSortDirection.toUpperCase()}
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Risk High: {predictiveRiskSegments.high}</Badge>
              <Badge variant="outline">Risk Medium: {predictiveRiskSegments.medium}</Badge>
              <Badge variant="outline">Risk Low: {predictiveRiskSegments.low}</Badge>
              <Badge variant="outline">Compliance Alerts: {state.complianceAnomalyAlerts.length}</Badge>
              <Badge variant="outline">Shortages: {state.materialsSummary.shortageCount}</Badge>
            </div>
            <div className="mt-2 space-y-2">
              <div className="rounded-md border bg-muted/20 p-2 text-xs">
                {lastInteractionMessage}
              </div>
              {isWorkspaceEmpty ? (
                <div className="rounded-md border border-dashed p-3 text-xs">
                  <p className="font-medium">
                    {state.workOrdersError
                      ? 'Unable to load AMRO work packages.'
                      : isFilterScopedEmpty
                        ? 'No work packages match the current scope.'
                        : 'No AMRO work packages are available yet.'}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {state.workOrdersError
                      ? 'Retry workspace refresh or reset scope filters to recover.'
                      : isFilterScopedEmpty
                        ? 'Clear dashboard scope or filters to restore list visibility.'
                        : 'Create a starter package to initialize the module surfaces.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleRetryWorkspaceLoad} disabled={state.loadingWorkOrders}>
                      {state.loadingWorkOrders ? 'Refreshing...' : 'Retry Refresh'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetWorkOrderScope} disabled={!hasActiveScopeFilters}>
                      Clear Scope
                    </Button>
                    <Button size="sm" onClick={() => void handleCreateStarterWorkOrder()} disabled={!state.canCreateWorkOrder}>
                      Create Starter Package
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2 text-xs">
                    {(Object.keys(workOrderGridColumnLabels) as WorkOrderGridColumnKey[]).map((columnKey) => (
                      <Button
                        key={`toggle-${columnKey}`}
                        type="button"
                        size="sm"
                        variant={workOrderGridVisibleColumns[columnKey] ? 'default' : 'outline'}
                        onClick={() => handleGridColumnVisibilityToggle(columnKey)}
                        className="h-7 px-2 text-[11px]"
                        aria-pressed={workOrderGridVisibleColumns[columnKey]}
                      >
                        {workOrderGridColumnLabels[columnKey]}
                      </Button>
                    ))}
                  </div>
                  {state.loadingWorkOrders ? (
                    <div className="space-y-2">
                      {Array.from({ length: Math.min(workOrderPageSize, 5) }).map((_, index) => (
                        <div key={`grid-skeleton-${index}`} className="animate-pulse rounded-md border p-2">
                          <div className="h-4 w-3/4 rounded bg-muted/60" />
                          <div className="mt-2 h-4 w-1/2 rounded bg-muted/50" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <div
                        className="grid min-w-[920px] items-center bg-muted/30 px-2 py-2 text-[11px] font-semibold text-muted-foreground"
                        style={{
                          gridTemplateColumns: `${workOrderGridSortableColumns
                            .filter((columnKey) => workOrderGridVisibleColumns[columnKey])
                            .map((columnKey) => `minmax(80px, ${workOrderGridColumnWidths[columnKey]}px)`)
                            .join(' ')} 156px`,
                        }}
                      >
                        {workOrderGridSortableColumns
                          .filter((columnKey) => workOrderGridVisibleColumns[columnKey])
                          .map((columnKey) => (
                            <div key={`header-${columnKey}`} className="flex min-w-0 items-center gap-1 pr-2">
                              <button
                                type="button"
                                className="inline-flex min-w-0 items-center gap-1 truncate text-left text-[11px] transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                onClick={() => handleGridSortToggle(columnKey)}
                                aria-label={`Sort by ${workOrderGridColumnLabels[columnKey]}`}
                              >
                                <span className="truncate">{workOrderGridColumnLabels[columnKey]}</span>
                                {workOrderSortField === columnKey ? (
                                  workOrderSortDirection === 'asc' ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <ArrowDownUp className="h-4 w-4 opacity-50" aria-hidden="true" />
                                )}
                              </button>
                              <button
                                type="button"
                                className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded transition-colors duration-200 hover:bg-muted"
                                onMouseDown={(event) => handleGridResizeStart(columnKey, event)}
                                aria-label={`Resize ${workOrderGridColumnLabels[columnKey]} column`}
                              >
                                <GripVertical className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        <span className="px-1">Actions</span>
                      </div>
                      <div
                        className="grid min-w-[920px] items-center border-t bg-muted/10 px-2 py-2"
                        style={{
                          gridTemplateColumns: `${workOrderGridSortableColumns
                            .filter((columnKey) => workOrderGridVisibleColumns[columnKey])
                            .map((columnKey) => `minmax(80px, ${workOrderGridColumnWidths[columnKey]}px)`)
                            .join(' ')} 156px`,
                        }}
                      >
                        {workOrderGridSortableColumns
                          .filter((columnKey) => workOrderGridVisibleColumns[columnKey])
                          .map((columnKey) => (
                            <div key={`filter-${columnKey}`} className="pr-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  value={workOrderGridFilters[columnKey]}
                                  onChange={(event) => handleGridFilterChange(columnKey, event.target.value)}
                                  placeholder={`Filter ${workOrderGridColumnLabels[columnKey]}`}
                                  className="h-7 text-[11px]"
                                  aria-label={`Filter ${workOrderGridColumnLabels[columnKey]}`}
                                />
                                {workOrderGridFilters[columnKey] ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => handleGridFilterClear(columnKey)}
                                    aria-label={`Clear filter ${workOrderGridColumnLabels[columnKey]}`}
                                  >
                                    Clear
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        <div />
                      </div>
                      {pagedWorkOrders.map((workOrder) => {
                        const runtimeRow = workOrderRuntimeRows[workOrder.id];
                        const isOverdue = runtimeRow.dueEpoch !== Number.MAX_SAFE_INTEGER && runtimeRow.dueEpoch < nowEpoch;
                        const gridTemplateColumns = `${workOrderGridSortableColumns
                          .filter((columnKey) => workOrderGridVisibleColumns[columnKey])
                          .map((columnKey) => `minmax(80px, ${workOrderGridColumnWidths[columnKey]}px)`)
                          .join(' ')} 156px`;
                        return (
                          <div
                            key={`list-${workOrder.id}`}
                            draggable
                            onDragStart={() => {
                              setDraggingWorkOrderId(workOrder.id);
                              handleDragHandleInteraction(workOrder.id, workOrder.packageNumber);
                            }}
                            onDragEnd={() => setDraggingWorkOrderId(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => {
                              if (!draggingWorkOrderId) return;
                              handleWorkOrderReorder(draggingWorkOrderId, workOrder.id);
                              setDraggingWorkOrderId(null);
                            }}
                            className={`grid min-w-[920px] items-center border-t px-2 py-2 text-xs transition-colors duration-200 hover:bg-muted/40 ${
                              isOverdue
                                ? 'border-destructive/40 bg-destructive/5'
                                : state.selectedWorkOrderId === workOrder.id
                                  ? 'border-primary bg-primary/5'
                                  : ''
                            } ${draggingWorkOrderId === workOrder.id ? 'opacity-60 ring-2 ring-primary' : ''}`}
                            style={{ gridTemplateColumns }}
                          >
                            {workOrderGridSortableColumns
                              .filter((columnKey) => workOrderGridVisibleColumns[columnKey])
                              .map((columnKey) => (
                                <span key={`${workOrder.id}-${columnKey}`} className="truncate pr-2">
                                  {columnKey === 'status' ? <Badge variant="outline">{runtimeRow.status}</Badge> : runtimeRow[columnKey]}
                                </span>
                              ))}
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Open work package ${workOrder.packageNumber}`}
                                onClick={() => void handleOpenWorkOrder(workOrder.id, workOrder.packageNumber)}
                                disabled={busyWorkOrderActionId !== null}
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Schedule work package ${workOrder.packageNumber}`}
                                onClick={() => void handleScheduleWorkOrder(workOrder.id, workOrder.packageNumber)}
                                disabled={busyWorkOrderActionId !== null}
                              >
                                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Hold work package ${workOrder.packageNumber}`}
                                onClick={() => void handleHoldWorkOrder(workOrder.id, workOrder.packageNumber)}
                                disabled={busyWorkOrderActionId !== null}
                              >
                                <PauseCircle className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Clone work package ${workOrder.packageNumber}`}
                                onClick={() => void handleCloneWorkOrder(workOrder.id, workOrder.packageNumber)}
                                disabled={busyWorkOrderActionId !== null}
                              >
                                <Copy className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Export work package ${workOrder.packageNumber}`}
                                onClick={() => handleWorkOrderExport(workOrder.id, workOrder.packageNumber)}
                                disabled={busyWorkOrderActionId !== null}
                              >
                                <Download className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Delete work package ${workOrder.packageNumber}`}
                                onClick={() => void handleDeleteWorkOrder(workOrder.id, workOrder.packageNumber)}
                                disabled={busyWorkOrderActionId !== null || !state.canDeleteWorkOrder}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Drag handle for ${workOrder.packageNumber}`}
                                onClick={() => handleDragHandleInteraction(workOrder.id, workOrder.packageNumber)}
                              >
                                <GripVertical className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-md border p-2 text-xs">
                <p className="font-medium">Right Rail Summary</p>
                <p className="text-muted-foreground">Parts readiness: {state.materialsSummary.shortageCount === 0 ? 'Ready' : 'At risk'}</p>
                <p className="text-muted-foreground">Compliance blockers: {state.complianceAnomalyAlerts.length}</p>
                <p className="text-muted-foreground">Assignee: {selectedWorkOrderAssignee}</p>
              </div>
              <div className="rounded-md border p-2 text-xs md:col-span-2">
                <p className="font-medium">Footer Controls</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWorkOrderPage((current) => Math.max(1, current - 1))} disabled={workOrderPage === 1}>
                    Previous
                  </Button>
                  <Badge variant="outline">Page {workOrderPage} / {workOrderTotalPages}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setWorkOrderPage((current) => Math.min(workOrderTotalPages, current + 1))} disabled={workOrderPage === workOrderTotalPages}>
                    Next
                  </Button>
                  <Select value={String(workOrderPageSize)} onValueChange={(value) => { setWorkOrderPageSize(Number(value)); setWorkOrderPage(1); }}>
                    <SelectTrigger className="w-[120px]" aria-label="Page size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {workOrderPageSizes.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => void handleBulkWorkOrderAction()}>Bulk Actions</Button>
                  <Badge variant="outline">Export state: ready</Badge>
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void state.assignSelectedWorkOrderToNextSlot()}>
                Assign
              </Button>
              <Button variant="outline" size="sm" onClick={() => void state.fetchScheduleOptimizationRecommendations()}>
                Shift Window
              </Button>
              <Button variant="outline" size="sm" disabled={!canEditPartsAllocation} onClick={() => void state.reservePartsAllocationForSelectedWorkOrder()}>
                Material Reserve
              </Button>
              <Button variant="outline" size="sm" onClick={() => void state.syncSupplierEtaForSelectedWorkOrder()} disabled={!state.selectedWorkOrderId}>
                Supplier ETA
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleOpenComplianceGate()}>
                Compliance Precheck
              </Button>
            </div>
          </div>
          {state.workOrdersError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {state.workOrdersError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              value={newWorkOrderTitle}
              onChange={(event) => setNewWorkOrderTitle(event.target.value)}
              placeholder="New work package title"
            />
            <Button onClick={handleCreateWorkOrder} disabled={!newWorkOrderTitle.trim() || !state.canCreateWorkOrder}>
              Create Work Package
            </Button>
            <Button variant="outline" onClick={state.refreshWorkOrders} disabled={state.loadingWorkOrders}>
              {state.loadingWorkOrders ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-amro-screen="SCR-AMRO-003" role="region" aria-label="SCR-AMRO-003 Work Package Create Drawer">
            <div className="space-y-1">
              <Label>Status Filter</Label>
              <Select value={state.workOrderStatusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workOrderStatusFilters.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Search</Label>
              <Input value={state.workOrderSearch} onChange={(event) => handleSearchFilterChange(event.target.value)} placeholder="Search code or id" />
            </div>
            <div className="space-y-1">
              <Label>Saved View</Label>
              <Select value={state.selectedSavedViewId} onValueChange={handleSavedViewChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.savedWorkOrderViews.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Save Current View</Label>
              <div className="flex gap-2">
                <Input value={savedViewName} onChange={(event) => setSavedViewName(event.target.value)} placeholder="View name" />
                <Button variant="outline" onClick={handleSaveCurrentView} disabled={!savedViewName.trim()}>
                  Save
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Work Package</Label>
              <Select value={state.selectedWorkOrderId} onValueChange={state.setSelectedWorkOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select work package" />
                </SelectTrigger>
                <SelectContent>
                  {state.workOrders.map((workOrder) => (
                    <SelectItem key={workOrder.id} value={workOrder.id}>
                      {workOrder.packageNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Lifecycle Stage</p>
              <p className="text-sm font-medium">{state.selectedWorkOrder?.lifecycleStage ?? 'N/A'}</p>
            </div>
            <div className="flex items-center">
              <Button onClick={() => void state.advanceWorkOrderLifecycle()} disabled={!state.canAdvanceLifecycle}>
                Advance Stage
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Role: {state.activeRole}</Badge>
            <Badge variant={state.canCreateWorkOrder ? 'secondary' : 'outline'}>
              {state.canCreateWorkOrder ? 'Create Allowed' : 'Create Restricted'}
            </Badge>
            <Badge variant={state.canDeleteWorkOrder ? 'secondary' : 'outline'}>
              {state.canDeleteWorkOrder ? 'Delete Allowed' : 'Delete Restricted'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (!state.selectedWorkOrder) return;
                void handleDeleteWorkOrder(state.selectedWorkOrder.id, state.selectedWorkOrder.packageNumber);
              }}
              disabled={!state.selectedWorkOrderId || !state.canDeleteWorkOrder}
            >
              Delete Selected
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3" data-amro-screen="SCR-AMRO-004" role="region" aria-label="SCR-AMRO-004 Work Package Detail Sheet">
            <div className="xl:col-span-2">
              {state.selectedWorkOrder ? (
                <Tabs value={detailTab} onValueChange={handleDetailTabChange}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{state.selectedWorkOrder.packageNumber}</span>
                <Badge variant="outline">{state.selectedWorkOrder.lifecycleStage}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" aria-label="Update work package status" onClick={() => void handleStickyHoldAction()}>Status</Button>
                <Button variant="outline" size="sm" aria-label="Assign work package" onClick={() => void handleStickyAssignAction()}>Assign</Button>
                <Button variant="outline" size="sm" aria-label="Schedule work package" onClick={() => void handleStickyScheduleAction()}>Schedule</Button>
                <Button variant="outline" size="sm" aria-label="Run compliance gate check" onClick={() => void handleStickyGateCheckAction()}>Gate Check</Button>
                <Button size="sm" disabled={!canRunWorkOrderClosure} onClick={() => setClosureConfirmOpen(true)} aria-label="Close work package with confirmation">
                  Close
                </Button>
              </div>
            </div>
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-2">
              <div className="rounded-md border p-2 text-xs">
                <p className="font-medium">Sticky Top Actions</p>
                <p className="mt-1 text-muted-foreground">
                  Sticky actions: Status | Assign | Schedule | Gate Check | Close
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" aria-label="Update work package status" onClick={() => void handleStickyHoldAction()}>Status</Button>
                  <Button variant="outline" size="sm" aria-label="Assign work package" onClick={() => void handleStickyAssignAction()}>Assign</Button>
                  <Button variant="outline" size="sm" aria-label="Schedule work package" onClick={() => void handleStickyScheduleAction()}>Schedule</Button>
                  <Button variant="outline" size="sm" aria-label="Run compliance gate check" onClick={() => void handleStickyGateCheckAction()}>Gate Check</Button>
                  <Button size="sm" disabled={!canRunWorkOrderClosure} onClick={() => setClosureConfirmOpen(true)} aria-label="Close work package with confirmation">
                    Close
                  </Button>
                </div>
              </div>
              <div className="rounded-md border p-2 text-xs">
                <p className="font-medium">Detail Draft</p>
                <Textarea
                  value={detailDraft}
                  onChange={(event) => setDetailDraft(event.target.value)}
                  placeholder="Enter work package detail notes"
                  className="mt-2 min-h-[96px]"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" onClick={handlePersistDetailDraft} disabled={!hasUnsavedDetailChanges}>
                    Save Draft
                  </Button>
                  <Badge variant={hasUnsavedDetailChanges ? 'destructive' : 'secondary'}>
                    {hasUnsavedDetailChanges ? 'Unsaved Changes' : 'All Changes Saved'}
                  </Badge>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="tasks" className="space-y-2">
              {(state.selectedWorkOrder?.tasks ?? []).map((task) => (
                <div key={task.id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.lifecycleStage} · {task.assignedRole}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void trackTaskStepSubmitInteraction(task.id, 'start')} aria-label={`Start task ${task.id}`}>
                      Start
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void trackTaskStepSubmitInteraction(task.id, 'complete')} aria-label={`Complete task ${task.id}`}>
                      Complete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void trackTaskStepSubmitInteraction(task.id, 'block')} aria-label={`Block task ${task.id}`}>
                      Block
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => state.uploadTaskEvidence(task.id)} aria-label={`Upload evidence for task ${task.id}`}>
                      Bind Evidence
                    </Button>
                    <Button size="sm" onClick={() => state.submitTaskSignature(task.id)} disabled={!state.canSignOff} aria-label={`Submit signature for task ${task.id}`}>
                      E-Sign
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="materials" className="space-y-2">
              {state.materials.map((material) => (
                <div key={`detail-material-${material.id}`} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{material.partNumber}</p>
                  <p className="text-muted-foreground">
                    Required/Allocated status: {material.reservationStatus} · shortage: {material.shortageSeverity}
                  </p>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="compliance" className="space-y-2">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Regulator Profile</Label>
                  <Select
                    value={state.selectedRegulatorProfile}
                    onValueChange={(value) => state.setSelectedRegulatorProfile(value as 'FAA' | 'EASA' | 'CAAC')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {regulatorProfileOptions.map((profile) => (
                        <SelectItem key={profile} value={profile}>
                          {profile}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border p-2">Rule Packs: {state.complianceCoverage.totalPacks}</div>
                <div className="rounded-md border p-2">Active Packs: {state.complianceCoverage.activePacks}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={state.ingestAdSbObligations} disabled={!state.selectedWorkOrderId}>
                  Ingest AD/SB
                </Button>
                <Button variant="outline" size="sm" onClick={state.evaluateMelCdlDeferral} disabled={!state.selectedWorkOrderId}>
                  Evaluate MEL/CDL
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleOpenComplianceGate()} disabled={!state.selectedWorkOrderId}>
                  Open Gate Modal
                </Button>
                <Button variant="outline" size="sm" onClick={state.loadAuditReplayTimeline}>
                  Load Audit Replay
                </Button>
                <Button variant="outline" size="sm" onClick={state.detectComplianceAnomalies}>
                  Detect Anomalies
                </Button>
                <Button variant="outline" size="sm" onClick={state.loadRegulatorProfilePack}>
                  Load Profile Pack
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-md border p-2 text-xs">
                  AD/SB Mapping: {state.obligationIngestionSummary ? `${state.obligationIngestionSummary.total} total` : 'not loaded'}
                </div>
                <div className="rounded-md border p-2 text-xs">
                  Deferral Decision: {state.deferralDecision?.decision || 'not evaluated'}
                </div>
                <div className="rounded-md border p-2 text-xs">
                  Audit Replay Events: {state.complianceAuditReplay?.eventCount || 0}
                </div>
                <div className="rounded-md border p-2 text-xs">
                  Anomaly Alerts: {state.complianceAnomalyAlerts.length}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.complianceCoverage.authorityCoverage.map((authority) => (
                  <Badge key={authority} variant="outline">
                    {authority}
                  </Badge>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="notes" className="space-y-2">
              <Textarea
                value={detailDraft}
                onChange={(event) => setDetailDraft(event.target.value)}
                placeholder="Operational notes and escalation context"
                className="min-h-[96px]"
              />
            </TabsContent>
            <TabsContent value="attachments" className="space-y-2">
              <div className="rounded-md border p-2 text-xs">Attachment tray for evidence packets and signed forms.</div>
            </TabsContent>
            <TabsContent value="audit" className="space-y-2">
              <div className="rounded-md border p-2 text-xs">Audit evidence and replay entries mapped to work package lifecycle transitions.</div>
            </TabsContent>
          </Tabs>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-xs">
                  <p className="font-medium">No work package selected for the detail sheet.</p>
                  <p className="mt-1 text-muted-foreground">Select a row from SCR-AMRO-002 or create a starter package to unlock detail tabs.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!state.workOrders[0]) return;
                        handleOpenWorkOrder(state.workOrders[0].id, state.workOrders[0].packageNumber);
                      }}
                      disabled={!state.workOrders[0]}
                    >
                      Select First Package
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRetryWorkspaceLoad} disabled={state.loadingWorkOrders}>
                      {state.loadingWorkOrders ? 'Refreshing...' : 'Retry Refresh'}
                    </Button>
                    <Button size="sm" onClick={() => void handleCreateStarterWorkOrder()} disabled={!state.canCreateWorkOrder}>
                      Create Starter Package
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-md border p-3 text-xs">
              <p className="font-medium">Side Panel</p>
              <div className="space-y-1 rounded-md border p-2">
                <p className="font-medium">Activity Feed</p>
                <p className="text-muted-foreground">Latest updates synchronized with compliance replay and task signatures.</p>
              </div>
              <div className="space-y-1 rounded-md border p-2">
                <p className="font-medium">Signatures</p>
                <p className="text-muted-foreground">{state.canSignOff ? 'Ready for certifying signature' : 'Signature not permitted for current authority'}</p>
              </div>
              <div className="space-y-1 rounded-md border p-2">
                <p className="font-medium">Overrides</p>
                <p className="text-muted-foreground">Pending blockers: {state.complianceAnomalyAlerts.length}</p>
              </div>
              <div className="space-y-1 rounded-md border p-2">
                <p className="font-medium">Gate Outcomes</p>
                <p className="text-muted-foreground">Compliance gate outcomes are available in replay and anomaly traces.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEscalateAction('engineering')}>Escalate to Engineering</Button>
                <Button variant="outline" size="sm" onClick={() => handleEscalateAction('compliance')}>Escalate to Compliance</Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">enabled</Badge>
                <Badge variant="outline">disabled-with-reason</Badge>
                <Badge variant="outline">hidden-by-permission</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {showTaskExecutionModule ? (
      <Card data-amro-screen="SCR-AMRO-005" role="region" aria-label="SCR-AMRO-005 Task Execution Card">
        <CardHeader className="pb-2">
          <CardTitle>SCR-AMRO-005 Task Execution Card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <p className="font-semibold">
              Task {selectedTask ? selectedTask.id : 'N/A'} [{selectedTask?.lifecycleStage || 'pending'}]
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Elapsed/Target: 00:32 / 00:45 · Offline queue: {mobileQueuedEvents} pending
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Procedure: ATA 32-41-00</p>
            <div className="mt-2 space-y-1 text-xs">
              <p>1. Remove panel fasteners · state: completed · evidence: mandatory</p>
              <p>2. Inspect harness routing · state: in progress · evidence: mandatory</p>
              <p>3. Refit and torque check · state: pending · evidence: mandatory</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Offline Sync Status: {mobileQueuedEvents > 0 ? 'Queued events pending upload' : 'All events synced'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-w-[120px]"
                aria-label="Capture photo evidence"
                onClick={() => {
                  if (!selectedTaskId) return;
                  void state.uploadTaskEvidence(selectedTaskId);
                }}
              >
                Photo
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-w-[120px]"
                aria-label="Upload evidence packet"
                onClick={() => {
                  if (!selectedTaskId) return;
                  void state.uploadTaskEvidence(selectedTaskId);
                }}
              >
                Upload
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-w-[120px]"
                aria-label="Add note evidence"
                onClick={() => {
                  if (!selectedTaskId) return;
                  void state.uploadTaskEvidence(selectedTaskId);
                }}
              >
                Note
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-w-[120px]"
                aria-label="Sign using PIN"
                onClick={() => {
                  if (!selectedTaskId) return;
                  void state.submitTaskSignature(selectedTaskId);
                }}
              >
                PIN
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-w-[120px]"
                aria-label="Sign using digital certificate"
                onClick={() => {
                  if (!selectedTaskId) return;
                  void state.submitTaskSignature(selectedTaskId);
                }}
              >
                Digital Cert
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Integrity status: evidence hash chain verified</p>
            <p className="mt-2 text-xs text-muted-foreground">Sync Queue: {mobileQueuedEvents} queued events</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-w-[140px]"
                aria-label="Save signed task event to offline queue"
                onClick={() => {
                  if (!selectedTaskId) return;
                  void trackTaskStepSubmitInteraction(selectedTaskId, 'start');
                }}
              >
                Save Offline
              </Button>
              <Button
                size="sm"
                disabled={!canDirectTaskExecution}
                className="h-11 min-w-[140px]"
                aria-label="Submit task actions"
                onClick={() => {
                  if (!selectedTaskId) return;
                  void trackTaskStepSubmitInteraction(selectedTaskId, 'complete');
                }}
              >
                Submit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 min-w-[140px]"
                aria-label="Request execution support"
                onClick={() => {
                  if (!selectedTaskId) return;
                  void trackTaskStepSubmitInteraction(selectedTaskId, 'block');
                }}
              >
                Request Support
              </Button>
            </div>
            {!canDirectTaskExecution ? <p className="text-xs text-muted-foreground">{taskActionDisabledReason}</p> : null}
          </div>
        </CardContent>
      </Card>
      ) : null}

      {showSchedulingModule ? (
      <Card data-amro-screen="SCR-AMRO-006" data-amro-owned-surface="scheduling-board-slot-timeline" role="region" aria-label="SCR-AMRO-006 Scheduling Board">
        <CardHeader className="pb-2">
          <CardTitle>SCR-AMRO-006 Scheduling Board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void state.assignSelectedWorkOrderToNextSlot()}
              disabled={!state.selectedWorkOrderId}
            >
              Assign Next Slot
            </Button>
            <Button variant="outline" onClick={state.fetchScheduleOptimizationRecommendations}>
              Refresh Optimization Recommendations
            </Button>
            <Button variant="outline" onClick={() => void state.runWorkOrderReplanSimulation()} disabled={!state.selectedWorkOrderId}>
              Run Replan Simulation
            </Button>
            <Button variant="outline" onClick={() => void state.confirmWorkOrderReplan()} disabled={state.workOrderReplanOptions.length === 0}>
              Confirm Replan
            </Button>
          </div>
          <div className="space-y-2">
            {state.scheduleBoardRows.length === 0 ? (
              <div className="rounded-md border p-2 text-xs text-muted-foreground">No schedule rows available.</div>
            ) : (
              state.scheduleBoardRows.map((row) => (
                <div key={row.schedule_id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{row.schedule_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.work_order_id} · {row.station_code}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(row.slot_start)} → {formatDateTime(row.slot_end)}</p>
                  <p className="text-xs text-muted-foreground">
                    Team {row.assigned_team_size} / Capacity {row.capacity} · {row.status}
                  </p>
                  <div className="mt-2">
                    <Button
                      variant="secondary"
                      onClick={() => state.acknowledgeScheduleUpdate(row.schedule_id, row.work_order_id)}
                    >
                      Acknowledge Schedule Update
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="space-y-2">
            {state.scheduleOptimizationRecommendations.map((item) => (
              <div key={item.recommendation_id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground">
                  {item.station_code} · {item.schedule_date}
                </p>
                <p className="text-muted-foreground">
                  Delay reduction {item.expected_delay_reduction_pct}% · Confidence {item.confidence}
                </p>
                <p className="text-muted-foreground">{item.rationale}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {state.workOrderReplanOptions.map((option) => (
              <div key={option.option_id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{option.title}</p>
                <p className="text-muted-foreground">Option {option.option_id}</p>
                <p className="text-muted-foreground">Impact score {option.impact_score}</p>
              </div>
            ))}
            {state.lastConfirmedReplanScheduleId ? (
              <Badge variant="secondary">Replan confirmed: {state.lastConfirmedReplanScheduleId}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
      ) : null}

      {showCertificationModule ? (
        <>
      <Card data-amro-owned-surface="qualification-authority-validation" data-amro-boundary="signoff-authority-control">
        <CardHeader className="pb-2">
          <CardTitle>Qualification and Authority Validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Certifying Staff</Label>
              <Select value={state.selectedQualificationId} onValueChange={state.setSelectedQualificationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.qualifications.map((qualification) => (
                    <SelectItem key={qualification.id} value={qualification.id}>
                      {qualification.staffName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Required Sign-off Authority</Label>
              <Select
                value={state.requiredAuthority}
                onValueChange={(value) => state.setRequiredAuthority(value as AmroAuthorityLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {authorityOptions.map((authority) => (
                    <SelectItem key={authority} value={authority}>
                      {authorityLabel[authority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Badge variant={state.canSignOff ? 'secondary' : 'destructive'}>
            {state.canSignOff ? 'Sign-off Authority Validated' : 'Sign-off Authority Not Satisfied'}
          </Badge>
        </CardContent>
      </Card>

      <Card data-amro-screen="SCR-AMRO-009" data-amro-owned-surface="certification-management-workflow" role="region" aria-label="SCR-AMRO-009 Certification Decision Panel">
        <CardHeader className="pb-2">
          <CardTitle>SCR-AMRO-009 Certification Decision Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Authority Profile Template</Label>
              <Select
                value={state.selectedCertificationAuthorityProfile}
                onValueChange={(value) => state.setSelectedCertificationAuthorityProfile(value as 'FAA' | 'EASA' | 'CAAC')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {certificationAuthorityProfileOptions.map((profile) => (
                    <SelectItem key={profile} value={profile}>
                      {profile}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Selected Certifier</Label>
              <div className="rounded-md border p-2 text-sm">
                {state.selectedQualification ? state.selectedQualification.staffName : 'No certifier selected'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                state.qualificationStatusIndicator?.lifecycle === 'active'
                  ? 'secondary'
                  : state.qualificationStatusIndicator?.lifecycle === 'warning'
                    ? 'outline'
                    : 'destructive'
              }
            >
              Qualification {state.qualificationStatusIndicator?.lifecycle || 'unknown'}
            </Badge>
            <Badge variant={state.certifyingPrivilegeValidated ? 'secondary' : 'outline'}>
              {state.certifyingPrivilegeValidated ? 'Certifying Privilege Valid' : 'Certifying Privilege Unverified'}
            </Badge>
            <Badge variant="outline">
              Days to Expiry {state.qualificationStatusIndicator?.daysUntilExpiry ?? 'n/a'}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={state.validateCertifyingPrivilege}>
              Validate Privilege
            </Button>
            <Button size="sm" onClick={() => state.submitCertificationDecision('approve')} disabled={!state.selectedWorkOrderId}>
              Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => state.submitCertificationDecision('reject')} disabled={!state.selectedWorkOrderId}>
              Reject
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeferralConfirmOpen(true)} disabled={!state.selectedWorkOrderId} aria-label="Defer certification decision with rationale">
              Defer
            </Button>
            <Button variant="outline" size="sm" onClick={state.runExpiryWarningAndSuspension}>
              Run Expiry Automation
            </Button>
            <Button variant="outline" size="sm" onClick={state.loadCompetencyAnalyticsDashboard}>
              Load Competency Analytics
            </Button>
            <Button variant="outline" size="sm" onClick={state.loadAuthorityCertificationTemplate}>
              Load Authority Template
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-md border p-2 text-xs">
              Decision Status: {state.latestCertificationDecision?.actionStatus || 'not submitted'}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Next Action: {state.latestCertificationDecision?.nextAction || 'none'}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Blockers: {state.latestCertificationDecision?.blockers.length || 0}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Expiry Warnings: {state.expiryAutomationSummary?.warningCount || 0}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Suspensions: {state.expiryAutomationSummary?.suspensionCount || 0}
            </div>
            <div className="rounded-md border p-2 text-xs">
              Qualified Staff: {state.competencyAnalytics?.totalQualifiedStaff || 0}
            </div>
          </div>
          {state.competencyAnalytics ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">Competency Analytics Dashboard</p>
              <div className="grid grid-cols-2 gap-2">
                <div>Active Certifiers: {state.competencyAnalytics.activeCertifiers}</div>
                <div>Warning Window: {state.competencyAnalytics.warningWindowStaff}</div>
                <div>Suspended Certifiers: {state.competencyAnalytics.suspendedCertifiers}</div>
                <div>Authority Bands: {Object.keys(state.competencyAnalytics.authorityDistribution).length}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(state.competencyAnalytics.authorityDistribution).map(([authority, count]) => (
                  <Badge key={authority} variant="outline">
                    {authority}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {state.authorityCertificationTemplate ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">
                {state.authorityCertificationTemplate.templateId} · {state.authorityCertificationTemplate.authorityProfile}
              </p>
              <p className="text-muted-foreground">
                Max Defer Days: {state.authorityCertificationTemplate.deferMaxDays}
              </p>
              <div>
                <p className="font-medium">Required Signatures</p>
                <div className="flex flex-wrap gap-1">
                  {state.authorityCertificationTemplate.requiredSignatures.map((signature) => (
                    <Badge key={signature} variant="outline">
                      {signature}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium">Mandatory Checks</p>
                <div className="flex flex-wrap gap-1">
                  {state.authorityCertificationTemplate.mandatoryChecks.map((check) => (
                    <Badge key={check} variant="outline">
                      {check}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
        </>
      ) : null}

      {showComplianceModule || showAuditModule ? (
      <Card data-amro-owned-surface="compliance-evidence-controls" data-amro-boundary="immutable-evidence-chain">
        <CardHeader className="pb-2">
          <CardTitle>Compliance and Evidence Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border p-2">Rule Packs: {state.complianceCoverage.totalPacks}</div>
            <div className="rounded-md border p-2">Active Packs: {state.complianceCoverage.activePacks}</div>
          </div>
          <div className="rounded-md border p-2 text-xs">
            Regulator Pack: {state.regulatorProfilePack ? `${state.regulatorProfilePack.regulatorProfile} loaded` : 'not loaded'}
          </div>
          {state.regulatorProfilePack ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">Gate Rules</p>
              {state.regulatorProfilePack.gateRules.map((rule) => (
                <p key={rule} className="text-muted-foreground">{rule}</p>
              ))}
            </div>
          ) : null}
          {state.complianceAuditReplay ? (
            <div className="space-y-1 rounded-md border p-2 text-xs" data-amro-screen="SCR-AMRO-010" role="region" aria-label="SCR-AMRO-010 Audit Replay Timeline">
              <p className="font-medium">SCR-AMRO-010 Audit Replay Timeline</p>
              {state.complianceAuditReplay.events.slice(0, 5).map((event) => (
                <p key={`${event.recordId}-${event.sequence}`} className="text-muted-foreground">{event.sequence}. {event.action} · {formatDateTime(event.createdAt)}</p>
              ))}
            </div>
          ) : null}
          {state.complianceAnomalyAlerts.length > 0 ? (
            <div className="space-y-1 rounded-md border p-2 text-xs">
              <p className="font-medium">Anomaly Alerts</p>
              {state.complianceAnomalyAlerts.map((alert) => (
                <p key={alert.code} className="text-muted-foreground">
                  {alert.severity.toUpperCase()} · {alert.code} · {alert.metric}
                </p>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {state.complianceCoverage.authorityCoverage.map((authority) => (
              <Badge key={authority} variant="outline">
                {authority}
              </Badge>
            ))}
          </div>
          {state.evidenceChain.map((evidence) => (
            <div key={evidence.id} className="rounded-md border p-2 text-xs">
              <p className="font-medium">{evidence.entityType} · {evidence.entityId}</p>
              <p className="text-muted-foreground">{evidence.hash}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      ) : null}

      {showPartsModule || showIntelligenceModule ? (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {showPartsModule ? (
        <div className="xl:col-span-2">
          <AmroPartsNavigationShell
            activeRole={activeUxRole}
            renderModule={renderPartsModuleSurface}
            onModuleChange={(nextModule) => {
              setLastInteractionMessage(`Parts module switched to ${nextModule}.`);
            }}
          />
        </div>
        ) : null}

        {showIntelligenceModule ? (
        <Card data-amro-screen="SCR-AMRO-012" data-amro-owned-surface="predictive-maintenance-digital-twin" role="region" aria-label="SCR-AMRO-012 Forecast Recommendation Hub">
          <CardHeader className="pb-2">
            <CardTitle>SCR-AMRO-012 Forecast Recommendation Hub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">High Risk: {state.predictiveSummary.highRisk}</div>
              <div className="rounded-md border p-2">Telemetry Triggers: {state.predictiveSummary.telemetryTriggers}</div>
              <div className="rounded-md border p-2">Avg Risk: {state.predictiveSummary.averageRisk}</div>
              <div className="rounded-md border p-2">Recommendations: {state.predictiveSummary.totalRecommendations}</div>
            </div>
            {state.predictiveRecommendations.map((recommendation) => (
              <div key={recommendation.id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{recommendation.digitalTwinReference}</p>
                <p className="text-muted-foreground">Risk {recommendation.riskScore} · {recommendation.trigger}</p>
                <p className="text-muted-foreground">{recommendation.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        ) : null}
      </div>
      ) : null}
      {showIntegrationModule ? (
      <Card data-amro-screen="SCR-AMRO-011" role="region" aria-label="SCR-AMRO-011 Integration Monitor Console">
        <CardHeader className="pb-2">
          <CardTitle>SCR-AMRO-011 Integration Monitor Console</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="rounded-md border p-2">Inbound adapters: healthy</div>
            <div className="rounded-md border p-2">Outbound callbacks: healthy</div>
            <div className="rounded-md border p-2">Replay queue: 0 pending</div>
            <div className="rounded-md border p-2">Dead-letter queue: 0</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleIntegrationRefresh}>Refresh Integration Status</Button>
            <Button variant="outline" size="sm" onClick={handleIntegrationReplayConsole}>Open Replay Console</Button>
            <Button variant="outline" size="sm" onClick={handleIntegrationExportSnapshot}>Export Incident Snapshot</Button>
          </div>
        </CardContent>
      </Card>
      ) : null}
      {showComplianceModule ? (
      <Dialog open={state.complianceGateModalOpen} onOpenChange={state.setComplianceGateModalOpen}>
        <DialogContent className="mdm-template-dialog">
          <DialogHeader>
            <DialogTitle>SCR-AMRO-008 Compliance Gate Modal</DialogTitle>
          </DialogHeader>
          {state.complianceExplainability ? (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border p-2">
                Decision: {state.complianceExplainability.decision.toUpperCase()} · Blockers: {state.complianceExplainability.blockerCount}
              </div>
              <div className="rounded-md border p-2 text-xs">
                Policy Snapshot: {state.complianceExplainability.policyVersion}
              </div>
              <div className="space-y-1 rounded-md border p-2 text-xs">
                <p className="font-medium">Explainability Panel</p>
                {state.complianceExplainability.blockers.length > 0 ? (
                  state.complianceExplainability.blockers.map((blocker) => (
                    <p key={blocker} className="text-muted-foreground">{blocker}</p>
                  ))
                ) : (
                  <p className="text-muted-foreground">No blockers detected.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No explainability data loaded.</div>
          )}
        </DialogContent>
      </Dialog>
      ) : null}
      <Dialog open={partsCreateOpen} onOpenChange={setPartsCreateOpen}>
        <DialogContent className="w-[calc(100vw-48px)] max-w-[960px] p-6" onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setPartsCreateOpen(false);
          }
        }}>
          <DialogHeader>
            <DialogTitle>Create Part Inventory Record</DialogTitle>
          </DialogHeader>
          <form
            className="mx-auto w-full max-w-[960px] space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCreatePart();
            }}
          >
            {partsCreateItemMasterLink ? (
              <p className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                Prefilled from Item Master: {partsCreateItemMasterLink.partNumber}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={partsFormSection === 'basic' ? 'default' : 'outline'} onClick={() => setPartsFormSection('basic')}>Basic Info</Button>
              <Button type="button" size="sm" variant={partsFormSection === 'stock' ? 'default' : 'outline'} onClick={() => setPartsFormSection('stock')}>Stock Levels</Button>
              <Button type="button" size="sm" variant={partsFormSection === 'location' ? 'default' : 'outline'} onClick={() => setPartsFormSection('location')}>Location</Button>
              <Button type="button" size="sm" variant={partsFormSection === 'supplier' ? 'default' : 'outline'} onClick={() => setPartsFormSection('supplier')}>Supplier</Button>
            </div>
            {partsFormSection === 'basic' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{basicInfoFields.map((field) => renderPartsFormField(field, 'create'))}</div> : null}
            {partsFormSection === 'stock' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{stockLevelFields.map((field) => renderPartsFormField(field, 'create'))}</div> : null}
            {partsFormSection === 'location' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{locationFields.map((field) => renderPartsFormField(field, 'create'))}</div> : null}
            {partsFormSection === 'supplier' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{supplierFields.map((field) => renderPartsFormField(field, 'create'))}</div> : null}
            <div className="rounded-md border p-3">
              <Button type="button" size="sm" variant="outline" onClick={() => setPartsAdvancedOpen((previous) => !previous)}>
                {partsAdvancedOpen ? 'Hide Advanced' : 'Show Advanced'}
              </Button>
              {partsAdvancedOpen ? (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {PARTS_FORM_ADVANCED_FIELDS.map((field) => renderPartsFormField(field, 'create'))}
                  {renderPartsFormField({ key: 'ata_chapter', label: 'ATA Chapter', control: 'text' }, 'create')}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPartsCreateOpen(false)} disabled={partsSubmitting}>Cancel</Button>
              <Button type="submit" disabled={partsSubmitting || !isPartsFormValid}>
                {partsSubmitting ? 'Creating...' : 'Create Part'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={partsEditOpen} onOpenChange={setPartsEditOpen}>
        <DialogContent className="w-[calc(100vw-48px)] max-w-[960px] p-6" onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setPartsEditOpen(false);
          }
        }}>
          <DialogHeader>
            <DialogTitle>Edit Part Inventory Record</DialogTitle>
          </DialogHeader>
          <form
            className="mx-auto w-full max-w-[960px] space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitUpdatePart();
            }}
          >
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={partsFormSection === 'basic' ? 'default' : 'outline'} onClick={() => setPartsFormSection('basic')}>Basic Info</Button>
              <Button type="button" size="sm" variant={partsFormSection === 'stock' ? 'default' : 'outline'} onClick={() => setPartsFormSection('stock')}>Stock Levels</Button>
              <Button type="button" size="sm" variant={partsFormSection === 'location' ? 'default' : 'outline'} onClick={() => setPartsFormSection('location')}>Location</Button>
              <Button type="button" size="sm" variant={partsFormSection === 'supplier' ? 'default' : 'outline'} onClick={() => setPartsFormSection('supplier')}>Supplier</Button>
            </div>
            {partsFormSection === 'basic' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{basicInfoFields.map((field) => renderPartsFormField(field, 'edit'))}</div> : null}
            {partsFormSection === 'stock' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{stockLevelFields.map((field) => renderPartsFormField(field, 'edit'))}</div> : null}
            {partsFormSection === 'location' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{locationFields.map((field) => renderPartsFormField(field, 'edit'))}</div> : null}
            {partsFormSection === 'supplier' ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{supplierFields.map((field) => renderPartsFormField(field, 'edit'))}</div> : null}
            <div className="rounded-md border p-3">
              <Button type="button" size="sm" variant="outline" onClick={() => setPartsAdvancedOpen((previous) => !previous)}>
                {partsAdvancedOpen ? 'Hide Advanced' : 'Show Advanced'}
              </Button>
              {partsAdvancedOpen ? (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {PARTS_FORM_ADVANCED_FIELDS.map((field) => renderPartsFormField(field, 'edit'))}
                  {renderPartsFormField({ key: 'ata_chapter', label: 'ATA Chapter', control: 'text' }, 'edit')}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPartsEditOpen(false)} disabled={partsSubmitting}>Cancel</Button>
              <Button type="submit" disabled={partsSubmitting || !partsTargetRecord?.id || !isPartsFormValid}>
                {partsSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={partsDeleteOpen} onOpenChange={setPartsDeleteOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Delete Part Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete {partsTargetRecord?.part_number || 'this part'} permanently?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPartsDeleteOpen(false)} disabled={partsSubmitting}>Cancel</Button>
            <Button variant="destructive" onClick={() => void submitDeletePart()} disabled={partsSubmitting || !partsTargetRecord?.id}>
              {partsSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={closureConfirmOpen} onOpenChange={setClosureConfirmOpen}>
        <DialogContent className="mdm-template-dialog">
          <DialogHeader>
            <DialogTitle>Confirm Work Package Closure</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Closure requires explicit rationale and acknowledgement.</p>
            <Textarea
              value={closureRationale}
              onChange={(event) => setClosureRationale(event.target.value)}
              placeholder="Enter closure rationale"
              aria-label="Closure rationale"
              className="min-h-[96px]"
            />
            <Button onClick={() => void handleConfirmWorkOrderClosure()} disabled={!closureRationale.trim()} aria-label="Confirm closure with rationale">
              Confirm Closure
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={workOrderCreateDialogOpen} onOpenChange={setWorkOrderCreateDialogOpen}>
        <DialogContent className="mdm-template-dialog mdm-template-dialog-large h-[92vh] w-[96vw] max-h-[92vh] max-w-[1600px] overflow-hidden p-0">
          <DialogHeader className="border-b border-[#efefef] px-5 py-3">
            <DialogTitle className="text-[32px] font-semibold leading-none text-[#4c4c4c]">Add Work Package</DialogTitle>
          </DialogHeader>
          {workOrderValidationSummary.length > 0 ? (
            <div className="mx-3 mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {workOrderValidationSummary.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}
          <div className="grid h-[calc(92vh-148px)] grid-cols-1 gap-2 overflow-hidden bg-[#f8f8f8] px-3 pb-2 pt-1 lg:grid-cols-[1.06fr_0.94fr]">
            <div className="space-y-3 overflow-y-auto border border-[#e5e5e5] bg-white p-2.5">
              <div className="border-b border-[#efefef] bg-[#fafafa] px-[10px] py-[6px] text-[13px] font-semibold text-[#757575]">Work Package details</div>
              <AircraftSearchSection
                aircraftSearchTerm={aircraftSearchTerm}
                onSearchChange={setAircraftSearchTerm}
                filteredAircraftOptions={filteredAircraftOptions}
                selectedAircraftId={workOrderCreateForm.aircraftId}
                onSelectAircraft={handleSelectWorkOrderAircraft}
                isLoading={aircraftSelectionLoading}
                selectedAircraft={selectedAircraft}
              />
              {workOrderCreateErrors.aircraftId ? <p className="text-xs text-destructive">{workOrderCreateErrors.aircraftId}</p> : null}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="wp-number">Package Number</Label>
                  <TextInput id="wp-number" value={workOrderCreateForm.packageNumber} onChange={(event) => handleWorkOrderCreateFormChange('packageNumber', event.target.value)} />
                  {workOrderCreateErrors.packageNumber ? <p className="text-xs text-destructive">{workOrderCreateErrors.packageNumber}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wp-topic">Topic</Label>
                  <TextInput id="wp-topic" value={workOrderCreateForm.topic} onChange={(event) => handleWorkOrderCreateFormChange('topic', event.target.value)} />
                  {workOrderCreateErrors.topic ? <p className="text-xs text-destructive">{workOrderCreateErrors.topic}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wp-location">Location/Station</Label>
                  <TextInput id="wp-location" value={workOrderCreateForm.locationStation} onChange={(event) => handleWorkOrderCreateFormChange('locationStation', event.target.value)} />
                  {workOrderCreateErrors.locationStation ? <p className="text-xs text-destructive">{workOrderCreateErrors.locationStation}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wp-planning-date">Planning Date</Label>
                  <DatePicker id="wp-planning-date" value={workOrderCreateForm.planningDate} onChange={(event) => handleWorkOrderCreateFormChange('planningDate', event.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wp-details">Work Package Details</Label>
                <Textarea id="wp-details" value={workOrderCreateForm.workOrderDetails} onChange={(event) => handleWorkOrderCreateFormChange('workOrderDetails', event.target.value)} />
                {workOrderCreateErrors.workOrderDetails ? <p className="text-xs text-destructive">{workOrderCreateErrors.workOrderDetails}</p> : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="wp-remarks">Remarks</Label>
                <Textarea id="wp-remarks" value={workOrderCreateForm.remarks} onChange={(event) => handleWorkOrderCreateFormChange('remarks', event.target.value)} />
              </div>
            </div>
            <div className="space-y-3 overflow-hidden border border-[#e5e5e5] bg-white p-2.5">
              <Tabs value={workOrderCreateTab} onValueChange={(value) => handleWorkOrderCreateTabChange(value as WorkOrderCreateTab)}>
                <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0">
                  <TabsTrigger value="wp" className="h-[20px] rounded-none border border-r-0 border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">Tasks</TabsTrigger>
                  <TabsTrigger value="besting_wp" className="h-[20px] rounded-none border border-r-0 border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">Tools/Spares</TabsTrigger>
                  <TabsTrigger value="task_payload" className="h-[20px] rounded-none border border-r-0 border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">Planning</TabsTrigger>
                  <TabsTrigger value="workflow" className="h-[20px] rounded-none border border-[#d7d7d7] px-[7px] text-[10px] font-semibold leading-none text-[#6a6a6a] data-[state=active]:border-[#12aeb1] data-[state=active]:bg-[#12aeb1] data-[state=active]:text-white">Review</TabsTrigger>
                </TabsList>
                <TabsContent value="wp" className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="wp-task-search">Task Search</Label>
                    <TextInput id="wp-task-search" value={taskSearchTerm} onChange={(event) => setTaskSearchTerm(event.target.value)} disabled={!canSelectTasks} placeholder={canSelectTasks ? 'Search tasks' : 'Select aircraft first'} />
                  </div>
                  <div className="max-h-72 overflow-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2 text-left">Sel</th>
                          <th className="p-2 text-left">Task</th>
                          <th className="p-2 text-left">Title</th>
                          <th className="p-2 text-left">Due</th>
                          <th className="p-2 text-left">MH</th>
                          <th className="p-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskSelectionLoading ? (
                          <tr><td className="p-2 text-muted-foreground" colSpan={6}>Loading tasks...</td></tr>
                        ) : taskSelectionOptions.length === 0 ? (
                          <tr><td className="p-2 text-muted-foreground" colSpan={6}>No tasks available.</td></tr>
                        ) : taskSelectionOptions.map((task) => {
                          const checked = workOrderCreateForm.selectedTaskIds.includes(task.value);
                          const conflict = taskConflictById[task.value];
                          return (
                            <tr key={task.value} className={conflict ? 'bg-amber-50/40' : ''}>
                              <td className="p-2"><Checkbox checked={checked} onCheckedChange={(value) => handleToggleWorkOrderCreateTaskSelection(task.value, Boolean(value))} disabled={!canSelectTasks || Boolean(conflict)} /></td>
                              <td className="p-2">{task.taskNumber}</td>
                              <td className="p-2"><p>{task.title}</p>{conflict ? <p className="text-amber-700">{conflict.reason}</p> : null}</td>
                              <td className="p-2">{task.dueBasis}</td>
                              <td className="p-2">{task.estimatedManHours}</td>
                              <td className="p-2">{task.status}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <p>{selectedTaskCount} selected</p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleWorkOrderCreateFormChange('selectedTaskIds', taskSelectionOptions.filter((task) => !taskConflictById[task.value]).map((task) => task.value))}>Select all valid</Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleWorkOrderCreateFormChange('selectedTaskIds', [])}>Clear</Button>
                    </div>
                  </div>
                  {workOrderCreateErrors.selectedTaskIds ? <p className="text-xs text-destructive">{workOrderCreateErrors.selectedTaskIds}</p> : null}
                </TabsContent>
                <TabsContent value="besting_wp" className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Maintenance Type</Label>
                      <select
                        value={workOrderCreateForm.maintenanceType}
                        onChange={(event) => handleWorkOrderCreateFormChange('maintenanceType', event.target.value as WorkOrderCreateFormState['maintenanceType'])}
                        className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-sm text-[#4f4f4f] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="line">Line</option>
                        <option value="base">Base</option>
                        <option value="hangar">Hangar</option>
                        <option value="shop">Shop</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Priority</Label>
                      <select
                        value={workOrderCreateForm.priority}
                        onChange={(event) => handleWorkOrderCreateFormChange('priority', event.target.value as WorkOrderCreateFormState['priority'])}
                        className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-sm text-[#4f4f4f] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="task_payload" className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="wp-planned-start">Planned Start</Label>
                      <DatePicker id="wp-planned-start" value={workOrderCreateForm.plannedStartDate} onChange={(event) => handleWorkOrderCreateFormChange('plannedStartDate', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wp-planned-end">Planned End</Label>
                      <DatePicker id="wp-planned-end" value={workOrderCreateForm.plannedEndDate} onChange={(event) => handleWorkOrderCreateFormChange('plannedEndDate', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wp-created-by">Created By</Label>
                      <TextInput id="wp-created-by" value={workOrderCreateForm.createdBy} onChange={(event) => handleWorkOrderCreateFormChange('createdBy', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wp-revision">Revision</Label>
                      <TextInput id="wp-revision" type="number" min={1} value={workOrderCreateForm.revision} onChange={(event) => handleWorkOrderCreateFormChange('revision', event.target.value)} />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="workflow" className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Assigned Role</Label>
                      <select
                        value={workOrderCreateForm.assignedRole}
                        onChange={(event) => handleWorkOrderCreateFormChange('assignedRole', event.target.value as WorkOrderCreateFormState['assignedRole'])}
                        className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-sm text-[#4f4f4f] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="planner">Planner</option>
                        <option value="engineer">Engineer</option>
                        <option value="inspector">Inspector</option>
                        <option value="technician">Technician</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Workflow Status</Label>
                      <select
                        value={workOrderCreateForm.workflowStatus}
                        onChange={(event) => handleWorkOrderCreateFormChange('workflowStatus', event.target.value as WorkOrderCreateFormState['workflowStatus'])}
                        className="flex h-9 w-full rounded-md border border-input bg-white px-2.5 py-1.5 text-sm text-[#4f4f4f] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="planning">Planning</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>
                  </div>
                  <div className="rounded-md border p-3 text-xs">
                    <p>Aircraft: {selectedAircraft?.aircraftModel || '-'} · {selectedAircraft?.registration || selectedAircraft?.serialNumber || '-'}</p>
                    <p>Tasks selected: {selectedTaskCount}</p>
                    <p>Conflicts: {selectedTaskConflicts.length}</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-end gap-2 border-t border-[#ececec] bg-white px-3 py-2">
            <Button variant="outline" onClick={() => setWorkOrderCreateDialogOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={handleOpenWorkOrderSubmitReview} disabled={workOrderCreateSubmitting}>Review</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={reviewSubmitDialogOpen} onOpenChange={setReviewSubmitDialogOpen}>
        <DialogContent className="mdm-template-dialog max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Work Package Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Aircraft: {selectedAircraft?.aircraftModel || '-'} · {selectedAircraft?.registration || selectedAircraft?.serialNumber || '-'}</p>
            <p>Package Number: {workOrderCreateForm.packageNumber || '-'}</p>
            <p>Topic: {workOrderCreateForm.topic || '-'}</p>
            <p>Tasks: {selectedTaskCount}</p>
            <p>Conflicts: {selectedTaskConflicts.length}</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setReviewSubmitDialogOpen(false)}>Back</Button>
            <Button onClick={() => void handleSubmitWorkOrderCreateForm()} disabled={workOrderCreateSubmitting || selectedTaskConflicts.length > 0}>
              {workOrderCreateSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={overrideConfirmOpen} onOpenChange={setOverrideConfirmOpen}>
        <DialogContent className="mdm-template-dialog">
          <DialogHeader>
            <DialogTitle>Confirm Compliance Override</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Compliance override requires documented rationale.</p>
            <Textarea
              value={overrideRationale}
              onChange={(event) => setOverrideRationale(event.target.value)}
              placeholder="Enter override rationale"
              aria-label="Compliance override rationale"
              className="min-h-[96px]"
            />
            <Button onClick={handleConfirmComplianceOverride} disabled={!overrideRationale.trim()} aria-label="Confirm compliance override">
              Confirm Override
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deferralConfirmOpen} onOpenChange={setDeferralConfirmOpen}>
        <DialogContent className="mdm-template-dialog">
          <DialogHeader>
            <DialogTitle>Confirm Certification Deferral</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Deferral requires rationale before submission.</p>
            <Textarea
              value={deferralRationale}
              onChange={(event) => setDeferralRationale(event.target.value)}
              placeholder="Enter deferral rationale"
              aria-label="Certification deferral rationale"
              className="min-h-[96px]"
            />
            <Button onClick={() => void handleConfirmDeferral()} disabled={!deferralRationale.trim()} aria-label="Confirm certification deferral">
              Confirm Deferral
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Separator />
    </section>
  );
}
