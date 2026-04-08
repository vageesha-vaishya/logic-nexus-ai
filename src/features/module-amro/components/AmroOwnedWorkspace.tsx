import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button, Checkbox, Input, Input as TextInput, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from '@/design-system';
import { CRMDatePicker as DatePicker } from '@/design-system/components/molecules';
import { useCRM } from '@/hooks/useCRM';
import { ArrowDownUp, ChevronDown, ChevronUp, Copy, Download, Eye, GripVertical, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAmroWorkspaceState } from '../hooks/useAmroWorkspaceState';
import type { AmroAuthorityLevel, AmroAssetType } from '../workspace/amroWorkspaceModel';
import { AmroPartsInventoryWorkbench } from './parts/AmroPartsInventoryWorkbench';
import {
  createAmroPartRecord,
  createAmroPartsCatalogApi,
  deleteAmroPartRecord,
  updateAmroPartRecord,
  type PartsMutationPayload,
} from './parts/livePartsCatalogApi';
import { usePartsCatalogState } from './parts/usePartsCatalogState';
import type { PartInventoryRecord } from './parts/mockPartsInventoryData';

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
const workPackageStatusFilters = ['all', 'planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'] as const;
const regulatorProfileOptions = ['FAA', 'EASA', 'CAAC'] as const;
const certificationAuthorityProfileOptions = ['FAA', 'EASA', 'CAAC'] as const;
const workspaceViewModes = ['kanban', 'card', 'grid', 'list'] as const;
const amroHeaderActionOrder = ['Search', 'Filter', 'View', 'Create', 'Refresh', 'Import/Export', 'Theme'] as const;
const workspaceThemeOptions = ['Azure Sky', 'Hangar Dark', 'Maintenance Slate'] as const;
const workPackagePageSizes = [10, 25, 50] as const;
const workspaceLocaleOptions = ['en-US', 'en-GB', 'fr-FR', 'de-DE'] as const;
const amroWorkspaceViewStorageKey = 'amro.workspace.view';
const amroWorkspaceThemeStorageKey = 'amro.workspace.theme';
const amroWorkPackagePageSizeStorageKey = 'amro.workspace.work-package-page-size';
const amroWorkspaceLocaleStorageKey = 'amro.workspace.locale';
const amroManualWorkPackageOrderStorageKey = 'amro.workspace.work-package-order';
const amroGridPreferencesStorageKey = 'amro-grid-preferences';
const amroDashboardLoadBenchmark = { targetMs: 1000, hardLimitMs: 1500 };
const amroWorkPackageFilterApplyBenchmark = { targetMs: 500, hardLimitMs: 900 };
const amroDetailTabSwitchBenchmark = { targetMs: 250, hardLimitMs: 500 };
const amroTaskStepSubmitBenchmark = { targetMs: 400, hardLimitMs: 800 };
type AmroUxRole = 'technician' | 'engineer' | 'inspector' | 'planner' | 'management';
type AmroWorkspaceModuleKey =
  | 'overview'
  | 'primary-users'
  | 'work-packages'
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
    openWorkPackages?: number;
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

type WorkPackageCreateTab = 'wp' | 'besting_wp' | 'task_payload' | 'workflow';

type WorkPackageCreateFormState = {
  packageNumber: string;
  topic: string;
  locationStation: string;
  planningDate: string;
  remarks: string;
  createdBy: string;
  aircraftId: string;
  selectedAircraftModel: string;
  selectedAircraftSerialOrRegistration: string;
  workPackageDetails: string;
  revision: string;
  selectedTaskIds: string[];
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  priority: 'low' | 'medium' | 'high' | 'critical';
  plannedStartDate: string;
  plannedEndDate: string;
  assignedRole: 'planner' | 'engineer' | 'inspector' | 'technician';
  workflowStatus: 'planning' | 'scheduled' | 'in_progress' | 'blocked';
};

type WorkPackageCreateFormErrors = Partial<Record<keyof WorkPackageCreateFormState, string>>;

type WorkPackageCreateAircraftOption = {
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

type WorkPackageCreateTaskOption = {
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

type WorkPackageGridColumnKey = 'packageNumber' | 'aircraft' | 'priority' | 'category' | 'station' | 'due' | 'status' | 'owner';

type WorkPackageGridSortKey = WorkPackageGridColumnKey;

type WorkPackageGridPreferences = {
  visibleColumns: Record<WorkPackageGridColumnKey, boolean>;
  columnWidths: Record<WorkPackageGridColumnKey, number>;
};

type WorkPackageGridRuntimeRow = {
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

const defaultGridVisibleColumns: Record<WorkPackageGridColumnKey, boolean> = {
  packageNumber: true,
  aircraft: true,
  priority: true,
  category: true,
  station: true,
  due: true,
  status: true,
  owner: true,
};

const defaultGridColumnWidths: Record<WorkPackageGridColumnKey, number> = {
  packageNumber: 140,
  aircraft: 160,
  priority: 110,
  category: 120,
  station: 120,
  due: 170,
  status: 130,
  owner: 120,
};

const workPackageGridColumnLabels: Record<WorkPackageGridColumnKey, string> = {
  packageNumber: 'Work Order #',
  aircraft: 'Aircraft',
  priority: 'Priority',
  category: 'Maintenance Category',
  station: 'Station',
  due: 'Due / Slot End',
  status: 'Lifecycle Status',
  owner: 'Owner',
};

const workPackageGridSortableColumns: WorkPackageGridSortKey[] = ['packageNumber', 'aircraft', 'priority', 'category', 'station', 'due', 'status', 'owner'];

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

const createDefaultWorkPackageCreateFormState = (): WorkPackageCreateFormState => {
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
    workPackageDetails: '',
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

export function AmroOwnedWorkspace({
  moduleKey,
  overviewPersona: _overviewPersona = 'tenant_admin',
  overviewControls: _overviewControls,
  overviewTelemetry: _overviewTelemetry,
}: AmroOwnedWorkspaceProps) {
  const { scopedDb } = useCRM();
  const state = useAmroWorkspaceState();
  const [newWorkPackageTitle, setNewWorkPackageTitle] = useState('');
  const [savedViewName, setSavedViewName] = useState('');
  const [detailTab, setDetailTab] = useState('overview');
  const [detailDraft, setDetailDraft] = useState('');
  const [lastSavedDetailDraft, setLastSavedDetailDraft] = useState('');
  const [workspaceViewMode, setWorkspaceViewMode] = useState<(typeof workspaceViewModes)[number]>('kanban');
  const [workspaceTheme, setWorkspaceTheme] = useState<(typeof workspaceThemeOptions)[number]>('Azure Sky');
  const [workspaceLocale, setWorkspaceLocale] = useState<(typeof workspaceLocaleOptions)[number]>('en-US');
  const [workPackagePageSize, setWorkPackagePageSize] = useState<number>(workPackagePageSizes[0]);
  const [workPackagePage, setWorkPackagePage] = useState(1);
  const [workPackageSortField, setWorkPackageSortField] = useState<'manual' | WorkPackageGridSortKey>('manual');
  const [workPackageSortDirection, setWorkPackageSortDirection] = useState<'asc' | 'desc'>('asc');
  const [workPackageGridVisibleColumns, setWorkPackageGridVisibleColumns] = useState<Record<WorkPackageGridColumnKey, boolean>>(defaultGridVisibleColumns);
  const [workPackageGridColumnWidths, setWorkPackageGridColumnWidths] = useState<Record<WorkPackageGridColumnKey, number>>(defaultGridColumnWidths);
  const [workPackageGridFilters, setWorkPackageGridFilters] = useState<Record<WorkPackageGridColumnKey, string>>({
    packageNumber: '',
    aircraft: '',
    priority: '',
    category: '',
    station: '',
    due: '',
    status: '',
    owner: '',
  });
  const [debouncedWorkPackageGridFilters, setDebouncedWorkPackageGridFilters] = useState<Record<WorkPackageGridColumnKey, string>>({
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
  const [busyWorkPackageActionId, setBusyWorkPackageActionId] = useState<string | null>(null);
  const [manualWorkPackageOrder, setManualWorkPackageOrder] = useState<string[]>([]);
  const [draggingWorkPackageId, setDraggingWorkPackageId] = useState<string | null>(null);
  const [lastWorkspaceExportAt, setLastWorkspaceExportAt] = useState<string | null>(null);
  const [workPackageCreateDialogOpen, setWorkPackageCreateDialogOpen] = useState(false);
  const [workPackageCreateTab, setWorkPackageCreateTab] = useState<WorkPackageCreateTab>('wp');
  const [workPackageCreateForm, setWorkPackageCreateForm] = useState<WorkPackageCreateFormState>(() => createDefaultWorkPackageCreateFormState());
  const [workPackageCreateErrors, setWorkPackageCreateErrors] = useState<WorkPackageCreateFormErrors>({});
  const [maintenanceTaskSelectionOptions, setMaintenanceTaskSelectionOptions] = useState<WorkPackageCreateTaskOption[]>([]);
  const [workPackageAircraftOptions, setWorkPackageAircraftOptions] = useState<WorkPackageCreateAircraftOption[]>([]);
  const [aircraftSearchTerm, setAircraftSearchTerm] = useState('');
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [taskConflictById, setTaskConflictById] = useState<Record<string, TaskConflictInfo>>({});
  const [taskSelectionLoading, setTaskSelectionLoading] = useState(false);
  const [aircraftSelectionLoading, setAircraftSelectionLoading] = useState(false);
  const [reviewSubmitDialogOpen, setReviewSubmitDialogOpen] = useState(false);
  const [workPackageCreateSubmitting, setWorkPackageCreateSubmitting] = useState(false);
  const workPackageCreateDraftCacheRef = useRef<Map<WorkPackageCreateTab, WorkPackageCreateFormState>>(new Map());
  const workspaceLoadStartedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const workspaceLoadMetricPublishedRef = useRef(false);
  const filterApplyStartedAtRef = useRef<number | null>(null);
  const gridResizeActiveRef = useRef<{
    columnKey: WorkPackageGridColumnKey;
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
  const selectedTask = state.selectedWorkPackage?.tasks?.[0] ?? null;
  const mobileQueuedEvents = Math.max(0, (state.selectedWorkPackage?.tasks?.filter((task) => !task.completed).length ?? 0) - 1);
  const canRunWorkPackageClosure = activeUxRole !== 'technician';
  const canRunComplianceOverride = activeUxRole !== 'technician';
  const canEditPartsAllocation = activeUxRole !== 'inspector';
  const canDirectTaskExecution = activeUxRole !== 'management';
  const canRunRegulatoryFinalSignOff = activeUxRole !== 'engineer';
  const canRunCertifyingRelease = activeUxRole !== 'planner';
  const partsCatalogApi = useMemo(() => createAmroPartsCatalogApi(), []);
  const partsCatalog = usePartsCatalogState({
    pageSize: 80,
    api: partsCatalogApi,
  });
  const [partsCreateOpen, setPartsCreateOpen] = useState(false);
  const [partsEditOpen, setPartsEditOpen] = useState(false);
  const [partsDeleteOpen, setPartsDeleteOpen] = useState(false);
  const [partsSubmitting, setPartsSubmitting] = useState(false);
  const [partsTargetRecord, setPartsTargetRecord] = useState<PartInventoryRecord | null>(null);
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
  const showWorkPackagesModule = !moduleKey || moduleKey === 'work-packages';
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
  }, []);

  const openCreatePartDialog = useCallback(() => {
    setPartsTargetRecord(null);
    resetPartsForm();
    setPartsCreateOpen(true);
  }, [resetPartsForm]);

  const openEditPartDialog = useCallback((record: PartInventoryRecord) => {
    setPartsTargetRecord(record);
    setPartsForm({
      part_number: record.part_number,
      serial_number: record.serial_number,
      description: record.description,
      status: record.status,
      lifecycle_status: 'serviceable',
      quantity_on_hand: record.quantity_on_hand,
      quantity_reserved: record.quantity_reserved,
      warehouse_location: record.warehouse_location,
      supplier_name: record.supplier_name,
      criticality: record.criticality,
      ata_chapter: record.ata_chapter,
    });
    setPartsEditOpen(true);
  }, []);

  const openDeletePartDialog = useCallback((record: PartInventoryRecord) => {
    setPartsTargetRecord(record);
    setPartsDeleteOpen(true);
  }, []);

  const submitCreatePart = useCallback(async () => {
    setPartsSubmitting(true);
    try {
      await createAmroPartRecord(partsForm);
      setPartsCreateOpen(false);
      resetPartsForm();
      toast.success('Part created successfully.');
      await partsCatalog.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create part.');
    } finally {
      setPartsSubmitting(false);
    }
  }, [partsCatalog, partsForm, resetPartsForm]);

  const submitUpdatePart = useCallback(async () => {
    if (!partsTargetRecord?.id) return;
    setPartsSubmitting(true);
    try {
      await updateAmroPartRecord(partsTargetRecord.id, partsForm);
      setPartsEditOpen(false);
      setPartsTargetRecord(null);
      toast.success('Part updated successfully.');
      await partsCatalog.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update part.');
    } finally {
      setPartsSubmitting(false);
    }
  }, [partsCatalog, partsForm, partsTargetRecord]);

  const submitDeletePart = useCallback(async () => {
    if (!partsTargetRecord?.id) return;
    setPartsSubmitting(true);
    try {
      await deleteAmroPartRecord(partsTargetRecord.id);
      setPartsDeleteOpen(false);
      setPartsTargetRecord(null);
      toast.success('Part deleted successfully.');
      await partsCatalog.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete part.');
    } finally {
      setPartsSubmitting(false);
    }
  }, [partsCatalog, partsTargetRecord]);
  const moduleActionBarTitle = moduleKey
    ? moduleKey.replace(/-/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase())
    : 'AMRO';
  const selectedTaskId = selectedTask?.id || '';
  const moduleActions: AmroModuleAction[] = moduleKey === 'overview'
    ? [
        {
          id: 'overview-refresh',
          label: 'Refresh Workspace',
          onClick: state.refreshWorkPackages,
          disabled: state.loadingWorkPackages,
          disabledReason: state.loadingWorkPackages ? 'Work package refresh is already running.' : 'Ready.',
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
          disabled: !state.selectedWorkPackageId,
          disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
        },
      ]
    : moduleKey === 'work-packages'
      ? []
      : moduleKey === 'primary-users'
        ? [
            {
              id: 'primary-users-refresh',
              label: 'Refresh Workspace',
              onClick: state.refreshWorkPackages,
              disabled: state.loadingWorkPackages,
              disabledReason: state.loadingWorkPackages ? 'Work package refresh is already running.' : 'Ready.',
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
                onClick: () => void state.assignSelectedWorkPackageToNextSlot(),
                disabled: !state.selectedWorkPackageId,
                disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
              },
              {
                id: 'scheduling-replan-simulate',
                label: 'Run Replan Simulation',
                onClick: () => void state.runWorkPackageReplanSimulation(),
                disabled: !state.selectedWorkPackageId,
                disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
              },
              {
                id: 'scheduling-replan-confirm',
                label: 'Confirm Replan',
                onClick: () => void state.confirmWorkPackageReplan(),
                disabled: state.workPackageReplanOptions.length === 0,
                disabledReason: state.workPackageReplanOptions.length > 0 ? 'Ready.' : 'Run simulation first.',
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
                  onClick: () => void state.reservePartsAllocationForSelectedWorkPackage(),
                  disabled: !state.selectedWorkPackageId,
                  disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
                },
                {
                  id: 'parts-run-optimization',
                  label: 'Run Inventory Optimization',
                  onClick: () => void state.runInventoryOptimizationModel(),
                  disabled: !state.selectedWorkPackageId,
                  disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
                },
                {
                  id: 'parts-sync-eta',
                  label: 'Sync Supplier ETA',
                  onClick: () => void state.syncSupplierEtaForSelectedWorkPackage(),
                  disabled: !state.selectedWorkPackageId,
                  disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
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
                    disabled: !state.selectedWorkPackageId,
                    disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
                  },
                  {
                    id: 'compliance-replay',
                    label: 'Load Audit Replay',
                    onClick: () => void state.loadAuditReplayTimeline(),
                    disabled: !state.selectedWorkPackageId,
                    disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
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
                      disabled: !state.selectedWorkPackageId,
                      disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
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
                        disabled: !state.selectedWorkPackageId,
                        disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
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
                          onClick: state.refreshWorkPackages,
                          disabled: state.loadingWorkPackages,
                          disabledReason: state.loadingWorkPackages ? 'Work package refresh is already running.' : 'Ready.',
                        },
                        {
                          id: 'integration-audit-replay',
                          label: 'Open Replay Feed',
                          onClick: () => void state.loadAuditReplayTimeline(),
                          disabled: !state.selectedWorkPackageId,
                          disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
                        },
                      ]
                    : moduleKey === 'intelligence'
                      ? [
                          {
                            id: 'intelligence-optimization',
                            label: 'Run Inventory Optimization',
                            onClick: () => void state.runInventoryOptimizationModel(),
                            disabled: !state.selectedWorkPackageId,
                            disabledReason: state.selectedWorkPackageId ? 'Ready.' : 'Select a work package first.',
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
        setWorkPackageAircraftOptions([]);
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
      setWorkPackageAircraftOptions(options);
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
      if (!workPackageCreateForm.aircraftId) {
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
      const selectedModel = workPackageCreateForm.selectedAircraftModel.trim().toLowerCase();
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
  }, [scopedDb, workPackageCreateForm.aircraftId, workPackageCreateForm.selectedAircraftModel]);
  useEffect(() => {
    let active = true;
    const loadTaskConflicts = async () => {
      if (!workPackageCreateForm.aircraftId || maintenanceTaskSelectionOptions.length === 0) {
        setTaskConflictById({});
        return;
      }
      const { data: linkedTasks, error: linkedTasksError } = await scopedDb
        .from('aircraft_maintenance_tasks')
        .select('task_id')
        .eq('aircraft_id', workPackageCreateForm.aircraftId)
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
      const selectedConflicts = workPackageCreateForm.selectedTaskIds.filter((taskId) => Boolean(nextConflictMap[taskId]));
      if (selectedConflicts.length > 0) {
        handleWorkPackageCreateFormChange('selectedTaskIds', workPackageCreateForm.selectedTaskIds.filter((taskId) => !nextConflictMap[taskId]));
      }
    };
    void loadTaskConflicts();
    return () => {
      active = false;
    };
  }, [scopedDb, workPackageCreateForm.aircraftId, maintenanceTaskSelectionOptions]);
  useEffect(() => {
    setManualWorkPackageOrder((current) => {
      const liveIds = state.workPackages.map((workPackage) => workPackage.id);
      const retained = current.filter((id) => liveIds.includes(id));
      const appended = liveIds.filter((id) => !retained.includes(id));
      return [...retained, ...appended];
    });
  }, [state.workPackages]);
  const workPackageRuntimeRows = useMemo<Record<string, WorkPackageGridRuntimeRow>>(
    () =>
      state.workPackages.reduce<Record<string, WorkPackageGridRuntimeRow>>((accumulator, workPackage) => {
        const assetTag = state.assets.find((asset) => asset.id === workPackage.assetId)?.assetTag || workPackage.assetId;
        const scheduleRow = state.scheduleBoardRows.find((row) => row.work_package_id === workPackage.id);
        const dueLabel = scheduleRow?.slot_end || 'TBD';
        accumulator[workPackage.id] = {
          id: workPackage.id,
          packageNumber: workPackage.packageNumber,
          aircraft: assetTag,
          priority: 'Normal',
          category: 'Line',
          station: scheduleRow?.station_code || 'N/A',
          due: dueLabel,
          status: String(workPackage.lifecycleStage),
          owner: activeUxRole,
          dueEpoch: dueLabel === 'TBD' ? Number.MAX_SAFE_INTEGER : new Date(dueLabel).getTime(),
        };
        return accumulator;
      }, {}),
    [activeUxRole, state.assets, state.scheduleBoardRows, state.workPackages],
  );
  const filteredWorkPackages = state.workPackages.filter((workPackage) => {
    const runtimeRow = workPackageRuntimeRows[workPackage.id];
    const fleetMatch = selectedFleetFilter === 'all' || runtimeRow.aircraft === selectedFleetFilter;
    const stationMatch = selectedStationFilter === 'all' || runtimeRow.station === selectedStationFilter;
    const columnFilterMatch = (Object.entries(debouncedWorkPackageGridFilters) as Array<[WorkPackageGridColumnKey, string]>).every(([columnKey, rawFilterValue]) => {
      const normalizedFilterValue = rawFilterValue.trim().toLowerCase();
      if (!normalizedFilterValue) return true;
      return String(runtimeRow[columnKey]).toLowerCase().includes(normalizedFilterValue);
    });
    return fleetMatch && stationMatch && columnFilterMatch;
  });
  const manuallyOrderedWorkPackages = [...filteredWorkPackages].sort((left, right) => {
    const leftIndex = manualWorkPackageOrder.indexOf(left.id);
    const rightIndex = manualWorkPackageOrder.indexOf(right.id);
    if (leftIndex === -1 && rightIndex === -1) return 0;
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
  const sortedWorkPackages = workPackageSortField === 'manual'
    ? manuallyOrderedWorkPackages
    : [...filteredWorkPackages].sort((left, right) => {
      const leftRuntime = workPackageRuntimeRows[left.id];
      const rightRuntime = workPackageRuntimeRows[right.id];
      if (workPackageSortField === 'due') {
        const compareDue = leftRuntime.dueEpoch - rightRuntime.dueEpoch;
        return workPackageSortDirection === 'asc' ? compareDue : compareDue * -1;
      }
      const compare = String(leftRuntime[workPackageSortField]).localeCompare(String(rightRuntime[workPackageSortField]));
      return workPackageSortDirection === 'asc' ? compare : compare * -1;
    });
  const workPackageTotalPages = Math.max(1, Math.ceil(sortedWorkPackages.length / workPackagePageSize));
  const pagedWorkPackages = sortedWorkPackages.slice((workPackagePage - 1) * workPackagePageSize, workPackagePage * workPackagePageSize);
  const hasAnyWorkPackages = state.workPackages.length > 0;
  const hasVisibleWorkPackages = pagedWorkPackages.length > 0;
  const hasActiveScopeFilters = state.workPackageStatusFilter !== 'all'
    || state.workPackageSearch.trim().length > 0
    || state.selectedSavedViewId !== 'default-all'
    || selectedFleetFilter !== 'all'
    || selectedStationFilter !== 'all';
  const isFilterScopedEmpty = hasAnyWorkPackages && filteredWorkPackages.length === 0;
  const isWorkspaceEmpty = !state.loadingWorkPackages && !hasVisibleWorkPackages;
  const predictiveRiskSegments = state.predictiveRecommendations.reduce(
    (summary, recommendation) => {
      if (recommendation.riskScore >= 80) summary.high += 1;
      else if (recommendation.riskScore >= 50) summary.medium += 1;
      else summary.low += 1;
      return summary;
    },
    { high: 0, medium: 0, low: 0 },
  );
  const visibleWorkspaceError = state.workPackagesError?.trim().toLowerCase() === 'not found' ? null : state.workPackagesError;
  const taskActionDisabledReason = canDirectTaskExecution ? '' : 'Disabled by policy: management role cannot submit technician execution actions.';
  const selectedWorkPackageAssignee = state.selectedWorkPackage?.tasks?.[0]?.assignedRole || 'Unassigned';
  const selectedAircraft = workPackageAircraftOptions.find((aircraft) => aircraft.id === workPackageCreateForm.aircraftId) || null;
  const filteredAircraftOptions = aircraftSearchTerm.trim()
    ? workPackageAircraftOptions.filter((aircraft) => {
      const token = aircraftSearchTerm.trim().toLowerCase();
      return [
        aircraft.aircraftModel,
        aircraft.registration,
        aircraft.serialNumber,
        aircraft.operatorCode,
      ].some((entry) => entry.toLowerCase().includes(token));
    })
    : workPackageAircraftOptions;
  const taskSelectionOptions = taskSearchTerm.trim()
    ? maintenanceTaskSelectionOptions.filter((task) => {
      const token = taskSearchTerm.trim().toLowerCase();
      return [
        task.taskNumber,
        task.title,
        task.category,
        task.status,
      ].some((entry) => entry.toLowerCase().includes(token));
    })
    : maintenanceTaskSelectionOptions;
  const selectedTaskOptions = maintenanceTaskSelectionOptions
    .filter((task) => workPackageCreateForm.selectedTaskIds.includes(task.value));
  const selectedTaskCount = selectedTaskOptions.length;
  const selectedTaskConflicts = selectedTaskOptions.filter((task) => taskConflictById[task.value]);
  const workPackageValidationSummary = Array.from(new Set(Object.values(workPackageCreateErrors).filter(Boolean)));
  const canSelectTasks = Boolean(workPackageCreateForm.aircraftId);
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
        interaction: 'work_package_filter_apply',
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

  const handleOpenWorkPackage = async (workPackageId: string, packageNumber: string) => {
    setBusyWorkPackageActionId(`open-${workPackageId}`);
    try {
      const ok = await state.openWorkPackageDetails(workPackageId);
      setLastInteractionMessage(ok ? `Opened work package ${packageNumber}.` : `Unable to open work package ${packageNumber}.`);
      if (ok) {
        toast.success(`Opened ${packageNumber}.`);
      } else {
        toast.error(`Unable to open ${packageNumber}.`);
      }
    } finally {
      setBusyWorkPackageActionId(null);
    }
  };

  const handleScheduleWorkPackage = async (workPackageId: string, packageNumber: string) => {
    state.setSelectedWorkPackageId(workPackageId);
    setBusyWorkPackageActionId(`schedule-${workPackageId}`);
    try {
      const ok = await state.updateWorkPackageScheduling(workPackageId);
      setLastInteractionMessage(ok ? `Scheduled work package ${packageNumber}.` : `Unable to schedule work package ${packageNumber}.`);
      if (ok) {
        toast.success(`Scheduled ${packageNumber}.`);
      } else {
        toast.error(`Unable to schedule ${packageNumber}.`);
      }
    } finally {
      setBusyWorkPackageActionId(null);
    }
  };

  const handleHoldWorkPackage = async (workPackageId: string, packageNumber: string) => {
    state.setSelectedWorkPackageId(workPackageId);
    setBusyWorkPackageActionId(`hold-${workPackageId}`);
    try {
      const ok = await state.toggleWorkPackageHold(workPackageId);
      setLastInteractionMessage(ok ? `Hold status updated for ${packageNumber}.` : `Unable to update hold status for ${packageNumber}.`);
      if (ok) {
        toast.success(`Hold status updated for ${packageNumber}.`);
      } else {
        toast.error(`Unable to update hold for ${packageNumber}.`);
      }
    } finally {
      setBusyWorkPackageActionId(null);
    }
  };

  const handleCloneWorkPackage = async (workPackageId: string, packageNumber: string) => {
    setBusyWorkPackageActionId(`clone-${workPackageId}`);
    try {
      const ok = await state.cloneWorkPackageFromTemplate(workPackageId);
      setLastInteractionMessage(ok ? `Cloned from ${packageNumber}.` : `Clone failed for ${packageNumber}.`);
      if (ok) {
        toast.success(`Cloned ${packageNumber}.`);
      } else {
        toast.error(`Clone failed for ${packageNumber}.`);
      }
    } finally {
      setBusyWorkPackageActionId(null);
    }
  };

  const handleWorkPackageExport = (workPackageId: string, packageNumber: string) => {
    const workPackage = state.workPackages.find((item) => item.id === workPackageId);
    if (!workPackage) {
      toast.error(`Unable to export ${packageNumber}.`);
      return;
    }
    const assetTag = state.assets.find((asset) => asset.id === workPackage.assetId)?.assetTag || 'Unknown';
    const exportRows = [
      {
        workPackageId: workPackage.id,
        packageNumber: workPackage.packageNumber,
        lifecycleStage: workPackage.lifecycleStage,
        assetTag,
      },
    ];
    const exportPayload = {
      workPackageId,
      packageNumber,
      moduleKey: moduleKey || 'amro',
      view: workspaceViewMode,
      theme: workspaceTheme,
      exportedAt: new Date().toISOString(),
    };
    publishWorkspaceExport('work-package', {
      ...exportPayload,
    });
    if (typeof window !== 'undefined') {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'WorkPackage');
      XLSX.writeFile(workbook, `${packageNumber}-export.xlsx`);
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      autoTable(pdf, {
        head: [['Work Package ID', 'Package Number', 'Lifecycle Stage', 'Asset']],
        body: exportRows.map((row) => [row.workPackageId, row.packageNumber, row.lifecycleStage, row.assetTag]),
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
      visibleWorkPackages: pagedWorkPackages.length,
    });
  };

  const handleWorkspaceThemeCycle = () => {
    const currentIndex = workspaceThemeOptions.indexOf(workspaceTheme);
    const nextTheme = workspaceThemeOptions[(currentIndex + 1) % workspaceThemeOptions.length];
    setWorkspaceTheme(nextTheme);
    setLastInteractionMessage(`Workspace theme switched to ${nextTheme}.`);
  };

  const handleBulkWorkPackageAction = async () => {
    if (!state.selectedWorkPackageId) {
      setLastInteractionMessage('Select a work package before running bulk actions.');
      return;
    }
    const ok = await state.advanceWorkPackageLifecycle();
    setLastInteractionMessage(ok ? 'Bulk action completed for selected work package.' : 'Bulk action failed for selected work package.');
  };

  const handleStickyAssignAction = async () => {
    if (!state.selectedWorkPackage) {
      setLastInteractionMessage('Select a work package before assigning.');
      return;
    }
    await handleScheduleWorkPackage(state.selectedWorkPackage.id, state.selectedWorkPackage.packageNumber);
  };

  const handleStickyScheduleAction = async () => {
    if (!state.selectedWorkPackage) {
      setLastInteractionMessage('Select a work package before scheduling.');
      return;
    }
    await handleScheduleWorkPackage(state.selectedWorkPackage.id, state.selectedWorkPackage.packageNumber);
  };

  const handleStickyGateCheckAction = async () => {
    if (!state.selectedWorkPackageId) {
      setLastInteractionMessage('Select a work package before running compliance gate checks.');
      return;
    }
    await handleOpenComplianceGate();
  };

  const handleStickyHoldAction = async () => {
    if (!state.selectedWorkPackage) {
      setLastInteractionMessage('Select a work package before placing hold transition.');
      return;
    }
    await handleHoldWorkPackage(state.selectedWorkPackage.id, state.selectedWorkPackage.packageNumber);
  };

  const handleEscalateAction = (target: 'engineering' | 'compliance') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amro:escalation-requested', {
        detail: {
          target,
          workPackageId: state.selectedWorkPackageId || null,
          requestedAt: new Date().toISOString(),
        },
      }));
    }
    setLastInteractionMessage(`Escalation request submitted to ${target}.`);
  };

  const handleDragHandleInteraction = (workPackageId: string, packageNumber: string) => {
    state.setSelectedWorkPackageId(workPackageId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amro:work-package-drag-handle', {
        detail: {
          packageNumber,
          selectedWorkPackageId: workPackageId,
          triggeredAt: new Date().toISOString(),
        },
      }));
    }
    setLastInteractionMessage(`Drag interaction registered for ${packageNumber}.`);
    toast.success(`Drag handle active for ${packageNumber}.`);
  };

  const handleWorkPackageReorder = (sourceWorkPackageId: string, targetWorkPackageId: string) => {
    if (sourceWorkPackageId === targetWorkPackageId) return;
    const sourceWorkPackage = state.workPackages.find((workPackage) => workPackage.id === sourceWorkPackageId);
    const targetWorkPackage = state.workPackages.find((workPackage) => workPackage.id === targetWorkPackageId);
    let reorderedOutput: string[] = [];
    setManualWorkPackageOrder((current) => {
      const order = current.length > 0 ? current : state.workPackages.map((workPackage) => workPackage.id);
      const sourceIndex = order.indexOf(sourceWorkPackageId);
      const targetIndex = order.indexOf(targetWorkPackageId);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      const reordered = [...order];
      const [movedItem] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, movedItem);
      reorderedOutput = reordered;
      return reordered;
    });
    setWorkPackageSortField('manual');
    if (typeof window !== 'undefined' && reorderedOutput.length > 0) {
      window.localStorage.setItem(amroManualWorkPackageOrderStorageKey, JSON.stringify(reorderedOutput));
      window.dispatchEvent(new CustomEvent('amro:work-package-order-updated', {
        detail: {
          orderedWorkPackageIds: reorderedOutput,
          updatedAt: new Date().toISOString(),
        },
      }));
    }
    setLastInteractionMessage(`Reordered ${sourceWorkPackage?.packageNumber || sourceWorkPackageId} before ${targetWorkPackage?.packageNumber || targetWorkPackageId}.`);
    toast.success(`Reordered ${sourceWorkPackage?.packageNumber || 'work package'}.`);
  };

  const handleIntegrationRefresh = () => {
    void state.refreshWorkPackages();
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
    state.setWorkPackageStatusFilter(value);
  };

  const handleSearchFilterChange = (value: string) => {
    startFilterApplyTimer('search');
    state.setWorkPackageSearch(value);
  };

  /**
   * Updates a per-column filter value used by the AMRO work package data grid.
   */
  const handleGridFilterChange = (columnKey: WorkPackageGridColumnKey, value: string) => {
    startFilterApplyTimer(`column_${columnKey}`);
    setWorkPackageGridFilters((current) => ({
      ...current,
      [columnKey]: value,
    }));
    setWorkPackagePage(1);
  };

  /**
   * Clears a single per-column filter while preserving other active column filters.
   */
  const handleGridFilterClear = (columnKey: WorkPackageGridColumnKey) => {
    handleGridFilterChange(columnKey, '');
  };

  /**
   * Sorts by clicking a semantic column header and toggles ascending/descending.
   */
  const handleGridSortToggle = (columnKey: WorkPackageGridSortKey) => {
    if (workPackageSortField === columnKey) {
      setWorkPackageSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setWorkPackageSortField(columnKey);
    setWorkPackageSortDirection('asc');
  };

  /**
   * Toggles a column visibility preference while preserving at least one visible column.
   */
  const handleGridColumnVisibilityToggle = (columnKey: WorkPackageGridColumnKey) => {
    setWorkPackageGridVisibleColumns((current) => {
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
  const handleGridResizeStart = (columnKey: WorkPackageGridColumnKey, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    gridResizeActiveRef.current = {
      columnKey,
      startX: event.clientX,
      startWidth: workPackageGridColumnWidths[columnKey],
    };
  };

  const handleSavedViewChange = (value: string) => {
    startFilterApplyTimer('saved_view');
    state.setSelectedSavedViewId(value);
  };

  const handleResetWorkPackageScope = () => {
    setSelectedFleetFilter('all');
    setSelectedStationFilter('all');
    state.setSelectedSavedViewId('default-all');
    state.setWorkPackageStatusFilter('all');
    state.setWorkPackageSearch('');
    setWorkPackagePage(1);
    setLastInteractionMessage('Work package scope reset to defaults.');
  };

  const handleRetryWorkspaceLoad = () => {
    void state.refreshWorkPackages();
    setLastInteractionMessage('Work package refresh requested.');
  };

  const handleCreateStarterWorkPackage = async () => {
    const ok = await state.createWorkPackage('Starter Work Package');
    setLastInteractionMessage(ok ? 'Starter work package created.' : 'Unable to create starter work package.');
  };

  const handleCreateWorkPackage = async () => {
    const ok = await state.createWorkPackage(newWorkPackageTitle);
    if (ok) {
      setNewWorkPackageTitle('');
    }
  };

  const handleOpenWorkPackageCreateDialog = () => {
    const cached = workPackageCreateDraftCacheRef.current.get(workPackageCreateTab);
    const defaultState = createDefaultWorkPackageCreateFormState();
    setWorkPackageCreateForm({
      ...defaultState,
      ...cached,
    });
    setWorkPackageCreateErrors({});
    setTaskSearchTerm('');
    setAircraftSearchTerm('');
    setTaskConflictById({});
    setReviewSubmitDialogOpen(false);
    setWorkPackageCreateDialogOpen(true);
  };

  const handleWorkPackageCreateTabChange = (nextTab: WorkPackageCreateTab) => {
    workPackageCreateDraftCacheRef.current.set(workPackageCreateTab, workPackageCreateForm);
    const cachedNext = workPackageCreateDraftCacheRef.current.get(nextTab);
    if (cachedNext) {
      setWorkPackageCreateForm(cachedNext);
    }
    setWorkPackageCreateTab(nextTab);
  };

  const handleWorkPackageCreateFormChange = <K extends keyof WorkPackageCreateFormState>(key: K, value: WorkPackageCreateFormState[K]) => {
    setWorkPackageCreateForm((current) => ({
      ...current,
      [key]: value,
    }));
    setWorkPackageCreateErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[key];
      return nextErrors;
    });
  };

  const handleSelectWorkPackageAircraft = (aircraftId: string) => {
    const selected = workPackageAircraftOptions.find((aircraft) => aircraft.id === aircraftId);
    handleWorkPackageCreateFormChange('aircraftId', aircraftId);
    handleWorkPackageCreateFormChange('selectedAircraftModel', selected?.aircraftModel || '');
    handleWorkPackageCreateFormChange('selectedAircraftSerialOrRegistration', selected?.serialNumber || selected?.registration || '');
    handleWorkPackageCreateFormChange('locationStation', selected?.stationCode || '');
    handleWorkPackageCreateFormChange('selectedTaskIds', []);
    setTaskConflictById({});
  };

  const handleToggleWorkPackageCreateTaskSelection = (taskId: string, checked: boolean) => {
    if (taskConflictById[taskId]) {
      return;
    }
    const selected = workPackageCreateForm.selectedTaskIds;
    const nextSelected = checked
      ? selected.includes(taskId) ? selected : [...selected, taskId]
      : selected.filter((id) => id !== taskId);
    handleWorkPackageCreateFormChange('selectedTaskIds', nextSelected);
  };

  const handleOpenWorkPackageSubmitReview = () => {
    const validationErrors = validateWorkPackageCreateForm(workPackageCreateForm);
    if (Object.keys(validationErrors).length > 0) {
      setWorkPackageCreateErrors(validationErrors);
      toast.error('Validation failed for work package form.');
      return;
    }
    setReviewSubmitDialogOpen(true);
  };

  const validateWorkPackageCreateForm = (values: WorkPackageCreateFormState): WorkPackageCreateFormErrors => {
    const nextErrors: WorkPackageCreateFormErrors = {};
    if (!values.aircraftId.trim()) {
      nextErrors.aircraftId = 'Aircraft is required before task selection.';
    }
    if (!values.packageNumber.trim()) {
      nextErrors.packageNumber = 'Work package number is required.';
    }
    if (!values.topic.trim()) {
      nextErrors.topic = 'Topic is required.';
    }
    if (!values.workPackageDetails.trim()) {
      nextErrors.workPackageDetails = 'Work package details is required.';
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

  const handleSubmitWorkPackageCreateForm = async () => {
    const validationErrors = validateWorkPackageCreateForm(workPackageCreateForm);
    if (Object.keys(validationErrors).length > 0) {
      setWorkPackageCreateErrors(validationErrors);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('amro:work-package-form-validation-error', {
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
    setWorkPackageCreateSubmitting(true);
    const ok = await state.createWorkPackage(
      workPackageCreateForm.topic || workPackageCreateForm.workPackageDetails || workPackageCreateForm.packageNumber,
      {
        aircraftId: workPackageCreateForm.aircraftId,
        maintenanceType: workPackageCreateForm.maintenanceType,
        priority: workPackageCreateForm.priority,
        plannedStartIso: `${workPackageCreateForm.plannedStartDate}T00:00:00.000Z`,
        plannedEndIso: `${workPackageCreateForm.plannedEndDate}T23:59:59.000Z`,
        station: workPackageCreateForm.locationStation || (selectedStationFilter === 'all' ? undefined : selectedStationFilter),
        scopeItems: [
          workPackageCreateForm.packageNumber,
          workPackageCreateForm.topic,
          workPackageCreateForm.workPackageDetails,
          ...selectedTaskLabels,
        ].filter((item) => item.trim().length > 0),
        taskPlan: workPackageCreateForm.selectedTaskIds,
        revision: workPackageCreateForm.revision,
        assignedRole: workPackageCreateForm.assignedRole,
        workflowStatus: workPackageCreateForm.workflowStatus,
        taskSnapshot: selectedTaskOptions.map((task) => ({
          id: task.value,
          taskNumber: task.taskNumber,
          title: task.title,
          dueBasis: task.dueBasis,
          estimatedManHours: task.estimatedManHours,
          category: task.category,
        })),
        clientMetadata: {
          createdBy: workPackageCreateForm.createdBy,
          createdAt: new Date().toISOString(),
          clientTimestamp: new Date().toISOString(),
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          duplicateCheckPassed: selectedTaskConflicts.length === 0,
          planningDate: workPackageCreateForm.planningDate,
          remarks: workPackageCreateForm.remarks,
          serialOrRegistration: workPackageCreateForm.selectedAircraftSerialOrRegistration,
          aircraftModel: workPackageCreateForm.selectedAircraftModel,
        },
      },
    );
    setWorkPackageCreateSubmitting(false);
    if (!ok) {
      setLastInteractionMessage('Unable to add work package. Retry after resolving API issues.');
      toast.error('Unable to add work package.');
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amro:work-package-created', {
        detail: {
          source: 'work-package-create-dialog',
          ...workPackageCreateForm,
          selectedTaskCount: selectedTaskOptions.length,
          createdAt: new Date().toISOString(),
        },
      }));
    }
    workPackageCreateDraftCacheRef.current.clear();
    setWorkPackageCreateForm(createDefaultWorkPackageCreateFormState());
    setWorkPackageCreateErrors({});
    setTaskConflictById({});
    setReviewSubmitDialogOpen(false);
    setWorkPackageCreateDialogOpen(false);
    setLastInteractionMessage('Work package added successfully.');
    toast.success('Work package added.');
  };

  const handleDeleteWorkPackage = async (workPackageId: string, packageNumber: string) => {
    if (!state.canDeleteWorkPackage) {
      toast.error('Insufficient permissions to delete work package.');
      return;
    }
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Soft delete work package ${packageNumber}?`);
      if (!confirmed) {
        return;
      }
    }
    state.setSelectedWorkPackageId(workPackageId);
    setBusyWorkPackageActionId(`delete-${workPackageId}`);
    try {
      const ok = await state.softDeleteWorkPackage(workPackageId);
      setLastInteractionMessage(ok ? `Deleted work package ${packageNumber}.` : `Unable to delete work package ${packageNumber}.`);
      if (ok) {
        toast.success(`Deleted ${packageNumber}.`, {
          action: {
            label: 'Undo',
            onClick: () => {
              void state.restoreSoftDeletedWorkPackage(workPackageId).then((restored) => {
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
      setBusyWorkPackageActionId(null);
    }
  };

  const handleSaveCurrentView = async () => {
    const ok = await state.saveCurrentWorkPackageView(savedViewName);
    if (ok) {
      setSavedViewName('');
    }
  };

  const handlePersistDetailDraft = () => {
    setLastSavedDetailDraft(detailDraft);
  };

  const handleConfirmWorkPackageClosure = async () => {
    if (!closureRationale.trim()) return;
    await state.advanceWorkPackageLifecycle();
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
    const storedPageSize = Number(window.localStorage.getItem(amroWorkPackagePageSizeStorageKey));
    if (workPackagePageSizes.includes(storedPageSize as (typeof workPackagePageSizes)[number])) {
      setWorkPackagePageSize(storedPageSize);
    }
    const storedLocale = window.localStorage.getItem(amroWorkspaceLocaleStorageKey);
    if (storedLocale && workspaceLocaleOptions.includes(storedLocale as (typeof workspaceLocaleOptions)[number])) {
      setWorkspaceLocale(storedLocale as (typeof workspaceLocaleOptions)[number]);
    }
    const storedManualOrder = window.localStorage.getItem(amroManualWorkPackageOrderStorageKey);
    if (storedManualOrder) {
      try {
        const parsed = JSON.parse(storedManualOrder);
        if (Array.isArray(parsed)) {
          setManualWorkPackageOrder(parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0));
        }
      } catch {
        setManualWorkPackageOrder([]);
      }
    }
    const storedGridPreferences = window.localStorage.getItem(amroGridPreferencesStorageKey);
    if (storedGridPreferences) {
      try {
        const parsed = JSON.parse(storedGridPreferences) as Partial<WorkPackageGridPreferences>;
        if (parsed.visibleColumns) {
          setWorkPackageGridVisibleColumns((current) => ({
            ...current,
            ...parsed.visibleColumns,
          }));
        }
        if (parsed.columnWidths) {
          setWorkPackageGridColumnWidths((current) => {
            const next = { ...current };
            (Object.keys(current) as WorkPackageGridColumnKey[]).forEach((columnKey) => {
              const candidate = Number(parsed.columnWidths?.[columnKey]);
              if (Number.isFinite(candidate)) {
                next[columnKey] = Math.max(80, Math.min(400, candidate));
              }
            });
            return next;
          });
        }
      } catch {
        setWorkPackageGridVisibleColumns(defaultGridVisibleColumns);
        setWorkPackageGridColumnWidths(defaultGridColumnWidths);
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
    window.localStorage.setItem(amroWorkPackagePageSizeStorageKey, String(workPackagePageSize));
  }, [workPackagePageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(amroWorkspaceLocaleStorageKey, workspaceLocale);
  }, [workspaceLocale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(amroManualWorkPackageOrderStorageKey, JSON.stringify(manualWorkPackageOrder));
  }, [manualWorkPackageOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      amroGridPreferencesStorageKey,
      JSON.stringify({
        visibleColumns: workPackageGridVisibleColumns,
        columnWidths: workPackageGridColumnWidths,
      } satisfies WorkPackageGridPreferences),
    );
  }, [workPackageGridColumnWidths, workPackageGridVisibleColumns]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedWorkPackageGridFilters(workPackageGridFilters);
    }, 300);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [workPackageGridFilters]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const activeResize = gridResizeActiveRef.current;
      if (!activeResize) return;
      const nextWidth = activeResize.startWidth + (event.clientX - activeResize.startX);
      setWorkPackageGridColumnWidths((current) => ({
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
    if (workPackagePage <= workPackageTotalPages) return;
    setWorkPackagePage(workPackageTotalPages);
  }, [workPackagePage, workPackageTotalPages]);

  useEffect(() => {
    if (state.loadingWorkPackages || workspaceLoadMetricPublishedRef.current) return;
    const completedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    emitPerformanceMetric(
      'overview_dashboard_initial_load',
      completedAt - workspaceLoadStartedAtRef.current,
      amroDashboardLoadBenchmark.targetMs,
      amroDashboardLoadBenchmark.hardLimitMs,
      { workPackageCount: state.workPackages.length },
    );
    workspaceLoadMetricPublishedRef.current = true;
  }, [state.loadingWorkPackages, state.workPackages.length]);

  useEffect(() => {
    if (state.loadingWorkPackages || filterApplyStartedAtRef.current === null) return;
    const completedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    emitPerformanceMetric(
      'work_package_list_filter_apply',
      completedAt - filterApplyStartedAtRef.current,
      amroWorkPackageFilterApplyBenchmark.targetMs,
      amroWorkPackageFilterApplyBenchmark.hardLimitMs,
      {
        statusFilter: state.workPackageStatusFilter,
        searchFilterLength: state.workPackageSearch.length,
        savedViewId: state.selectedSavedViewId || null,
      },
    );
    filterApplyStartedAtRef.current = null;
  }, [state.loadingWorkPackages, state.selectedSavedViewId, state.workPackageSearch, state.workPackageStatusFilter]);

  return (
    <section className="space-y-4" aria-label="AMRO workspace">
      {state.loadingWorkPackages ? (
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          Loading latest AMRO workspace data...
        </div>
      ) : null}
      {visibleWorkspaceError ? (
        <div className="rounded-md border border-destructive/50 px-3 py-2 text-xs text-destructive" role="alert">
          {visibleWorkspaceError}
        </div>
      ) : null}
      {moduleKey && moduleKey !== 'work-packages' ? (
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
              <Input value={state.workPackageSearch} onChange={(event) => handleSearchFilterChange(event.target.value)} placeholder="Search" />
              <Select value={state.workPackageStatusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  {workPackageStatusFilters.map((status) => (
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
              <Button onClick={handleCreateWorkPackage} disabled={!newWorkPackageTitle.trim() || !state.canCreateWorkPackage}>
                Create
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button variant="outline" onClick={state.refreshWorkPackages} disabled={state.loadingWorkPackages}>
                {state.loadingWorkPackages ? 'Refreshing...' : 'Refresh'}
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
            <Button variant="outline" disabled={!canRunWorkPackageClosure} onClick={() => setClosureConfirmOpen(true)} aria-label="Run work package closure transition">
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
            <div className="rounded-md border p-2">Create Scope: {state.canCreateWorkPackage ? 'Enabled' : 'Restricted'}</div>
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

      {showWorkPackagesModule ? (
      <Card data-amro-owned-surface="work-package-task-lifecycle-orchestration">
        <CardHeader className="pb-2">
          <CardTitle>Work Packages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3" data-amro-screen="SCR-AMRO-002" role="region" aria-label="Work Package List">
            <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Input
                  value={state.workPackageSearch}
                  onChange={(event) => handleSearchFilterChange(event.target.value)}
                  placeholder="Search"
                  className="w-[180px]"
                />
                <Select value={state.workPackageStatusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-[120px]" aria-label="Filters">
                    <SelectValue placeholder="Filters" />
                  </SelectTrigger>
                  <SelectContent>
                    {workPackageStatusFilters.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={`${workPackageSortField}:${workPackageSortDirection}`} onValueChange={(value) => {
                  const [field, direction] = value.split(':') as ['manual' | WorkPackageGridSortKey, 'asc' | 'desc'];
                  setWorkPackageSortField(field);
                  setWorkPackageSortDirection(direction);
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
                    {state.savedWorkPackageViews.map((view) => (
                      <SelectItem key={view.id} value={view.id}>
                        {view.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleCreateStarterWorkPackage()} disabled={!state.canCreateWorkPackage}>
                  New WP
                </Button>
                <Button onClick={handleOpenWorkPackageCreateDialog} disabled={!state.canCreateWorkPackage}>
                  Add WP
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Frozen identifiers: WO# / Aircraft</Badge>
              <Badge variant="outline">Sort: {workPackageSortField === 'manual' ? 'Manual' : workPackageSortField}</Badge>
              <Button variant="outline" size="sm" onClick={() => setWorkPackageSortField('manual')}>Manual Order</Button>
              <Button variant="outline" size="sm" onClick={() => setWorkPackageSortField('packageNumber')}>Sort WO#</Button>
              <Button variant="outline" size="sm" onClick={() => setWorkPackageSortField('status')}>Sort Status</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkPackageSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))}
                disabled={workPackageSortField === 'manual'}
              >
                Sort Direction: {workPackageSortDirection.toUpperCase()}
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
                    {state.workPackagesError
                      ? 'Unable to load AMRO work packages.'
                      : isFilterScopedEmpty
                        ? 'No work packages match the current scope.'
                        : 'No AMRO work packages are available yet.'}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {state.workPackagesError
                      ? 'Retry workspace refresh or reset scope filters to recover.'
                      : isFilterScopedEmpty
                        ? 'Clear dashboard scope or filters to restore list visibility.'
                        : 'Create a starter package to initialize the module surfaces.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleRetryWorkspaceLoad} disabled={state.loadingWorkPackages}>
                      {state.loadingWorkPackages ? 'Refreshing...' : 'Retry Refresh'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleResetWorkPackageScope} disabled={!hasActiveScopeFilters}>
                      Clear Scope
                    </Button>
                    <Button size="sm" onClick={() => void handleCreateStarterWorkPackage()} disabled={!state.canCreateWorkPackage}>
                      Create Starter Package
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2 text-xs">
                    {(Object.keys(workPackageGridColumnLabels) as WorkPackageGridColumnKey[]).map((columnKey) => (
                      <Button
                        key={`toggle-${columnKey}`}
                        type="button"
                        size="sm"
                        variant={workPackageGridVisibleColumns[columnKey] ? 'default' : 'outline'}
                        onClick={() => handleGridColumnVisibilityToggle(columnKey)}
                        className="h-7 px-2 text-[11px]"
                        aria-pressed={workPackageGridVisibleColumns[columnKey]}
                      >
                        {workPackageGridColumnLabels[columnKey]}
                      </Button>
                    ))}
                  </div>
                  {state.loadingWorkPackages ? (
                    <div className="space-y-2">
                      {Array.from({ length: Math.min(workPackagePageSize, 5) }).map((_, index) => (
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
                          gridTemplateColumns: `${workPackageGridSortableColumns
                            .filter((columnKey) => workPackageGridVisibleColumns[columnKey])
                            .map((columnKey) => `minmax(80px, ${workPackageGridColumnWidths[columnKey]}px)`)
                            .join(' ')} 156px`,
                        }}
                      >
                        {workPackageGridSortableColumns
                          .filter((columnKey) => workPackageGridVisibleColumns[columnKey])
                          .map((columnKey) => (
                            <div key={`header-${columnKey}`} className="flex min-w-0 items-center gap-1 pr-2">
                              <button
                                type="button"
                                className="inline-flex min-w-0 items-center gap-1 truncate text-left text-[11px] transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                onClick={() => handleGridSortToggle(columnKey)}
                                aria-label={`Sort by ${workPackageGridColumnLabels[columnKey]}`}
                              >
                                <span className="truncate">{workPackageGridColumnLabels[columnKey]}</span>
                                {workPackageSortField === columnKey ? (
                                  workPackageSortDirection === 'asc' ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <ArrowDownUp className="h-4 w-4 opacity-50" aria-hidden="true" />
                                )}
                              </button>
                              <button
                                type="button"
                                className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded transition-colors duration-200 hover:bg-muted"
                                onMouseDown={(event) => handleGridResizeStart(columnKey, event)}
                                aria-label={`Resize ${workPackageGridColumnLabels[columnKey]} column`}
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
                          gridTemplateColumns: `${workPackageGridSortableColumns
                            .filter((columnKey) => workPackageGridVisibleColumns[columnKey])
                            .map((columnKey) => `minmax(80px, ${workPackageGridColumnWidths[columnKey]}px)`)
                            .join(' ')} 156px`,
                        }}
                      >
                        {workPackageGridSortableColumns
                          .filter((columnKey) => workPackageGridVisibleColumns[columnKey])
                          .map((columnKey) => (
                            <div key={`filter-${columnKey}`} className="pr-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  value={workPackageGridFilters[columnKey]}
                                  onChange={(event) => handleGridFilterChange(columnKey, event.target.value)}
                                  placeholder={`Filter ${workPackageGridColumnLabels[columnKey]}`}
                                  className="h-7 text-[11px]"
                                  aria-label={`Filter ${workPackageGridColumnLabels[columnKey]}`}
                                />
                                {workPackageGridFilters[columnKey] ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => handleGridFilterClear(columnKey)}
                                    aria-label={`Clear filter ${workPackageGridColumnLabels[columnKey]}`}
                                  >
                                    Clear
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        <div />
                      </div>
                      {pagedWorkPackages.map((workPackage) => {
                        const runtimeRow = workPackageRuntimeRows[workPackage.id];
                        const isOverdue = runtimeRow.dueEpoch !== Number.MAX_SAFE_INTEGER && runtimeRow.dueEpoch < nowEpoch;
                        const gridTemplateColumns = `${workPackageGridSortableColumns
                          .filter((columnKey) => workPackageGridVisibleColumns[columnKey])
                          .map((columnKey) => `minmax(80px, ${workPackageGridColumnWidths[columnKey]}px)`)
                          .join(' ')} 156px`;
                        return (
                          <div
                            key={`list-${workPackage.id}`}
                            draggable
                            onDragStart={() => {
                              setDraggingWorkPackageId(workPackage.id);
                              handleDragHandleInteraction(workPackage.id, workPackage.packageNumber);
                            }}
                            onDragEnd={() => setDraggingWorkPackageId(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => {
                              if (!draggingWorkPackageId) return;
                              handleWorkPackageReorder(draggingWorkPackageId, workPackage.id);
                              setDraggingWorkPackageId(null);
                            }}
                            className={`grid min-w-[920px] items-center border-t px-2 py-2 text-xs transition-colors duration-200 hover:bg-muted/40 ${
                              isOverdue
                                ? 'border-destructive/40 bg-destructive/5'
                                : state.selectedWorkPackageId === workPackage.id
                                  ? 'border-primary bg-primary/5'
                                  : ''
                            } ${draggingWorkPackageId === workPackage.id ? 'opacity-60 ring-2 ring-primary' : ''}`}
                            style={{ gridTemplateColumns }}
                          >
                            {workPackageGridSortableColumns
                              .filter((columnKey) => workPackageGridVisibleColumns[columnKey])
                              .map((columnKey) => (
                                <span key={`${workPackage.id}-${columnKey}`} className="truncate pr-2">
                                  {columnKey === 'status' ? <Badge variant="outline">{runtimeRow.status}</Badge> : runtimeRow[columnKey]}
                                </span>
                              ))}
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Open work package ${workPackage.packageNumber}`}
                                onClick={() => void handleOpenWorkPackage(workPackage.id, workPackage.packageNumber)}
                                disabled={busyWorkPackageActionId !== null}
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Schedule work package ${workPackage.packageNumber}`}
                                onClick={() => void handleScheduleWorkPackage(workPackage.id, workPackage.packageNumber)}
                                disabled={busyWorkPackageActionId !== null}
                              >
                                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Hold work package ${workPackage.packageNumber}`}
                                onClick={() => void handleHoldWorkPackage(workPackage.id, workPackage.packageNumber)}
                                disabled={busyWorkPackageActionId !== null}
                              >
                                <PauseCircle className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Clone work package ${workPackage.packageNumber}`}
                                onClick={() => void handleCloneWorkPackage(workPackage.id, workPackage.packageNumber)}
                                disabled={busyWorkPackageActionId !== null}
                              >
                                <Copy className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Export work package ${workPackage.packageNumber}`}
                                onClick={() => handleWorkPackageExport(workPackage.id, workPackage.packageNumber)}
                                disabled={busyWorkPackageActionId !== null}
                              >
                                <Download className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Delete work package ${workPackage.packageNumber}`}
                                onClick={() => void handleDeleteWorkPackage(workPackage.id, workPackage.packageNumber)}
                                disabled={busyWorkPackageActionId !== null || !state.canDeleteWorkPackage}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-105"
                                aria-label={`Drag handle for ${workPackage.packageNumber}`}
                                onClick={() => handleDragHandleInteraction(workPackage.id, workPackage.packageNumber)}
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
                <p className="text-muted-foreground">Assignee: {selectedWorkPackageAssignee}</p>
              </div>
              <div className="rounded-md border p-2 text-xs md:col-span-2">
                <p className="font-medium">Footer Controls</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWorkPackagePage((current) => Math.max(1, current - 1))} disabled={workPackagePage === 1}>
                    Previous
                  </Button>
                  <Badge variant="outline">Page {workPackagePage} / {workPackageTotalPages}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setWorkPackagePage((current) => Math.min(workPackageTotalPages, current + 1))} disabled={workPackagePage === workPackageTotalPages}>
                    Next
                  </Button>
                  <Select value={String(workPackagePageSize)} onValueChange={(value) => { setWorkPackagePageSize(Number(value)); setWorkPackagePage(1); }}>
                    <SelectTrigger className="w-[120px]" aria-label="Page size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {workPackagePageSizes.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => void handleBulkWorkPackageAction()}>Bulk Actions</Button>
                  <Badge variant="outline">Export state: ready</Badge>
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void state.assignSelectedWorkPackageToNextSlot()}>
                Assign
              </Button>
              <Button variant="outline" size="sm" onClick={() => void state.fetchScheduleOptimizationRecommendations()}>
                Shift Window
              </Button>
              <Button variant="outline" size="sm" disabled={!canEditPartsAllocation} onClick={() => void state.reservePartsAllocationForSelectedWorkPackage()}>
                Material Reserve
              </Button>
              <Button variant="outline" size="sm" onClick={() => void state.syncSupplierEtaForSelectedWorkPackage()} disabled={!state.selectedWorkPackageId}>
                Supplier ETA
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleOpenComplianceGate()}>
                Compliance Precheck
              </Button>
            </div>
          </div>
          {state.workPackagesError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {state.workPackagesError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              value={newWorkPackageTitle}
              onChange={(event) => setNewWorkPackageTitle(event.target.value)}
              placeholder="New work package title"
            />
            <Button onClick={handleCreateWorkPackage} disabled={!newWorkPackageTitle.trim() || !state.canCreateWorkPackage}>
              Create Work Package
            </Button>
            <Button variant="outline" onClick={state.refreshWorkPackages} disabled={state.loadingWorkPackages}>
              {state.loadingWorkPackages ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-amro-screen="SCR-AMRO-003" role="region" aria-label="SCR-AMRO-003 Work Package Create Drawer">
            <div className="space-y-1">
              <Label>Status Filter</Label>
              <Select value={state.workPackageStatusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workPackageStatusFilters.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Search</Label>
              <Input value={state.workPackageSearch} onChange={(event) => handleSearchFilterChange(event.target.value)} placeholder="Search code or id" />
            </div>
            <div className="space-y-1">
              <Label>Saved View</Label>
              <Select value={state.selectedSavedViewId} onValueChange={handleSavedViewChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.savedWorkPackageViews.map((view) => (
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
              <Select value={state.selectedWorkPackageId} onValueChange={state.setSelectedWorkPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select work package" />
                </SelectTrigger>
                <SelectContent>
                  {state.workPackages.map((workPackage) => (
                    <SelectItem key={workPackage.id} value={workPackage.id}>
                      {workPackage.packageNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Lifecycle Stage</p>
              <p className="text-sm font-medium">{state.selectedWorkPackage?.lifecycleStage ?? 'N/A'}</p>
            </div>
            <div className="flex items-center">
              <Button onClick={() => void state.advanceWorkPackageLifecycle()} disabled={!state.canAdvanceLifecycle}>
                Advance Stage
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Role: {state.activeRole}</Badge>
            <Badge variant={state.canCreateWorkPackage ? 'secondary' : 'outline'}>
              {state.canCreateWorkPackage ? 'Create Allowed' : 'Create Restricted'}
            </Badge>
            <Badge variant={state.canDeleteWorkPackage ? 'secondary' : 'outline'}>
              {state.canDeleteWorkPackage ? 'Delete Allowed' : 'Delete Restricted'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (!state.selectedWorkPackage) return;
                void handleDeleteWorkPackage(state.selectedWorkPackage.id, state.selectedWorkPackage.packageNumber);
              }}
              disabled={!state.selectedWorkPackageId || !state.canDeleteWorkPackage}
            >
              Delete Selected
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3" data-amro-screen="SCR-AMRO-004" role="region" aria-label="SCR-AMRO-004 Work Package Detail Sheet">
            <div className="xl:col-span-2">
              {state.selectedWorkPackage ? (
                <Tabs value={detailTab} onValueChange={handleDetailTabChange}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{state.selectedWorkPackage.packageNumber}</span>
                <Badge variant="outline">{state.selectedWorkPackage.lifecycleStage}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" aria-label="Update work package status" onClick={() => void handleStickyHoldAction()}>Status</Button>
                <Button variant="outline" size="sm" aria-label="Assign work package" onClick={() => void handleStickyAssignAction()}>Assign</Button>
                <Button variant="outline" size="sm" aria-label="Schedule work package" onClick={() => void handleStickyScheduleAction()}>Schedule</Button>
                <Button variant="outline" size="sm" aria-label="Run compliance gate check" onClick={() => void handleStickyGateCheckAction()}>Gate Check</Button>
                <Button size="sm" disabled={!canRunWorkPackageClosure} onClick={() => setClosureConfirmOpen(true)} aria-label="Close work package with confirmation">
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
                  <Button size="sm" disabled={!canRunWorkPackageClosure} onClick={() => setClosureConfirmOpen(true)} aria-label="Close work package with confirmation">
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
              {(state.selectedWorkPackage?.tasks ?? []).map((task) => (
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
                <Button variant="outline" size="sm" onClick={state.ingestAdSbObligations} disabled={!state.selectedWorkPackageId}>
                  Ingest AD/SB
                </Button>
                <Button variant="outline" size="sm" onClick={state.evaluateMelCdlDeferral} disabled={!state.selectedWorkPackageId}>
                  Evaluate MEL/CDL
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleOpenComplianceGate()} disabled={!state.selectedWorkPackageId}>
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
                        if (!state.workPackages[0]) return;
                        handleOpenWorkPackage(state.workPackages[0].id, state.workPackages[0].packageNumber);
                      }}
                      disabled={!state.workPackages[0]}
                    >
                      Select First Package
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRetryWorkspaceLoad} disabled={state.loadingWorkPackages}>
                      {state.loadingWorkPackages ? 'Refreshing...' : 'Retry Refresh'}
                    </Button>
                    <Button size="sm" onClick={() => void handleCreateStarterWorkPackage()} disabled={!state.canCreateWorkPackage}>
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
              onClick={() => void state.assignSelectedWorkPackageToNextSlot()}
              disabled={!state.selectedWorkPackageId}
            >
              Assign Next Slot
            </Button>
            <Button variant="outline" onClick={state.fetchScheduleOptimizationRecommendations}>
              Refresh Optimization Recommendations
            </Button>
            <Button variant="outline" onClick={() => void state.runWorkPackageReplanSimulation()} disabled={!state.selectedWorkPackageId}>
              Run Replan Simulation
            </Button>
            <Button variant="outline" onClick={() => void state.confirmWorkPackageReplan()} disabled={state.workPackageReplanOptions.length === 0}>
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
                    {row.work_package_id} · {row.station_code}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(row.slot_start)} → {formatDateTime(row.slot_end)}</p>
                  <p className="text-xs text-muted-foreground">
                    Team {row.assigned_team_size} / Capacity {row.capacity} · {row.status}
                  </p>
                  <div className="mt-2">
                    <Button
                      variant="secondary"
                      onClick={() => state.acknowledgeScheduleUpdate(row.schedule_id, row.work_package_id)}
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
            {state.workPackageReplanOptions.map((option) => (
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
            <Button size="sm" onClick={() => state.submitCertificationDecision('approve')} disabled={!state.selectedWorkPackageId}>
              Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => state.submitCertificationDecision('reject')} disabled={!state.selectedWorkPackageId}>
              Reject
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeferralConfirmOpen(true)} disabled={!state.selectedWorkPackageId} aria-label="Defer certification decision with rationale">
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
        <Card data-amro-screen="SCR-AMRO-007" data-amro-owned-surface="materials-repair-loop-orchestration" role="region" aria-label="SCR-AMRO-007 Materials Reservation Panel">
          <CardHeader className="pb-2">
            <CardTitle>SCR-AMRO-007 Materials Reservation Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">Shortages: {state.materialsSummary.shortageCount}</div>
              <div className="rounded-md border p-2">Pending Reservations: {state.materialsSummary.pendingReservations}</div>
              <div className="rounded-md border p-2">ETA At Risk: {state.materialsSummary.atRiskEtaCount}</div>
              <div className="rounded-md border p-2">LLP Alerts: {state.materialsSummary.llpAlertCount}</div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Button variant="outline" onClick={state.reservePartsAllocationForSelectedWorkPackage} disabled={!state.selectedWorkPackageId}>
                Build Allocation
              </Button>
              <Button variant="outline" onClick={state.processCriticalShortageResponse} disabled={state.materialsSummary.shortageCount === 0}>
                Process Shortage
              </Button>
              <Button variant="outline" onClick={state.runInventoryOptimizationModel} disabled={!state.selectedWorkPackageId}>
                Run Optimization
              </Button>
              <Button variant="outline" onClick={state.syncSupplierAsnAndErpProcurement}>
                Sync ASN + ERP
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="rounded-md border p-2">
                Optimization Run: {state.lastInventoryOptimizationRunId || 'Not started'}
              </div>
              <div className="rounded-md border p-2">
                Procurement Sync: {state.lastProcurementSyncId || 'Not started'}
              </div>
            </div>
            {state.materials.map((material) => (
              <div key={material.id} className="space-y-2 rounded-md border p-2 text-xs">
                <p className="font-medium">{material.partNumber}</p>
                <p className="text-muted-foreground">
                  {material.reservationStatus} · {material.repairAction}
                </p>
                <p className="text-muted-foreground">
                  ETA {material.etaStatus} · Shortage {material.shortageSeverity}
                </p>
                <p className="text-muted-foreground">
                  Rotable {material.rotableStatus} · LLP {material.llpRemainingCycles} cycles · Traceability {material.traceabilityStatus}
                </p>
                <div>
                  <Button variant="secondary" size="sm" onClick={() => state.applyRotableLlpTraceability(material.id)}>
                    Trace Rotable/LLP
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        ) : null}

        {showPartsModule ? (
        <div className="xl:col-span-2">
          <AmroPartsInventoryWorkbench
            records={partsCatalog.records}
            state={partsCatalog.loading && partsCatalog.records.length === 0 ? 'loading' : partsCatalog.error ? 'error' : partsCatalog.records.length ? 'ready' : 'empty'}
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
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Create Part Inventory Record</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="parts-create-part-number">Part Number</Label>
              <TextInput id="parts-create-part-number" value={partsForm.part_number} onChange={(event) => setPartsForm((current) => ({ ...current, part_number: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-create-serial-number">Serial Number</Label>
              <TextInput id="parts-create-serial-number" value={partsForm.serial_number || ''} onChange={(event) => setPartsForm((current) => ({ ...current, serial_number: event.target.value }))} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="parts-create-description">Description</Label>
              <Textarea id="parts-create-description" value={partsForm.description || ''} onChange={(event) => setPartsForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-create-status">Status</Label>
              <Select value={partsForm.status} onValueChange={(value) => setPartsForm((current) => ({ ...current, status: value as PartsMutationPayload['status'] }))}>
                <SelectTrigger id="parts-create-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">available</SelectItem>
                  <SelectItem value="reserved">reserved</SelectItem>
                  <SelectItem value="low_stock">low_stock</SelectItem>
                  <SelectItem value="quarantined">quarantined</SelectItem>
                  <SelectItem value="unserviceable">unserviceable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-create-criticality">Criticality</Label>
              <Select value={partsForm.criticality || 'normal'} onValueChange={(value) => setPartsForm((current) => ({ ...current, criticality: value as PartsMutationPayload['criticality'] }))}>
                <SelectTrigger id="parts-create-criticality"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">critical</SelectItem>
                  <SelectItem value="high">high</SelectItem>
                  <SelectItem value="normal">normal</SelectItem>
                  <SelectItem value="low">low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-create-on-hand">Quantity On Hand</Label>
              <TextInput id="parts-create-on-hand" type="number" value={String(partsForm.quantity_on_hand)} onChange={(event) => setPartsForm((current) => ({ ...current, quantity_on_hand: Number(event.target.value || 0) }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-create-reserved">Quantity Reserved</Label>
              <TextInput id="parts-create-reserved" type="number" value={String(partsForm.quantity_reserved)} onChange={(event) => setPartsForm((current) => ({ ...current, quantity_reserved: Number(event.target.value || 0) }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-create-location">Warehouse Location</Label>
              <TextInput id="parts-create-location" value={partsForm.warehouse_location} onChange={(event) => setPartsForm((current) => ({ ...current, warehouse_location: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-create-supplier">Supplier Name</Label>
              <TextInput id="parts-create-supplier" value={partsForm.supplier_name || ''} onChange={(event) => setPartsForm((current) => ({ ...current, supplier_name: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-create-ata">ATA Chapter</Label>
              <TextInput id="parts-create-ata" value={partsForm.ata_chapter || ''} onChange={(event) => setPartsForm((current) => ({ ...current, ata_chapter: event.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPartsCreateOpen(false)} disabled={partsSubmitting}>Cancel</Button>
            <Button onClick={() => void submitCreatePart()} disabled={partsSubmitting || !partsForm.part_number.trim() || !partsForm.warehouse_location.trim()}>
              {partsSubmitting ? 'Creating...' : 'Create Part'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={partsEditOpen} onOpenChange={setPartsEditOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit Part Inventory Record</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="parts-edit-part-number">Part Number</Label>
              <TextInput id="parts-edit-part-number" value={partsForm.part_number} onChange={(event) => setPartsForm((current) => ({ ...current, part_number: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-edit-status">Status</Label>
              <Select value={partsForm.status} onValueChange={(value) => setPartsForm((current) => ({ ...current, status: value as PartsMutationPayload['status'] }))}>
                <SelectTrigger id="parts-edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">available</SelectItem>
                  <SelectItem value="reserved">reserved</SelectItem>
                  <SelectItem value="low_stock">low_stock</SelectItem>
                  <SelectItem value="quarantined">quarantined</SelectItem>
                  <SelectItem value="unserviceable">unserviceable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-edit-on-hand">Quantity On Hand</Label>
              <TextInput id="parts-edit-on-hand" type="number" value={String(partsForm.quantity_on_hand)} onChange={(event) => setPartsForm((current) => ({ ...current, quantity_on_hand: Number(event.target.value || 0) }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="parts-edit-reserved">Quantity Reserved</Label>
              <TextInput id="parts-edit-reserved" type="number" value={String(partsForm.quantity_reserved)} onChange={(event) => setPartsForm((current) => ({ ...current, quantity_reserved: Number(event.target.value || 0) }))} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="parts-edit-description">Description</Label>
              <Textarea id="parts-edit-description" value={partsForm.description || ''} onChange={(event) => setPartsForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPartsEditOpen(false)} disabled={partsSubmitting}>Cancel</Button>
            <Button onClick={() => void submitUpdatePart()} disabled={partsSubmitting || !partsTargetRecord?.id}>
              {partsSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
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
            <Button onClick={() => void handleConfirmWorkPackageClosure()} disabled={!closureRationale.trim()} aria-label="Confirm closure with rationale">
              Confirm Closure
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={workPackageCreateDialogOpen} onOpenChange={setWorkPackageCreateDialogOpen}>
        <DialogContent className="mdm-template-dialog mdm-template-dialog-large h-[92vh] w-[96vw] max-h-[92vh] max-w-[1600px] overflow-hidden p-0">
          <DialogHeader className="border-b border-[#efefef] px-5 py-3">
            <DialogTitle className="text-[32px] font-semibold leading-none text-[#4c4c4c]">Add Work Package</DialogTitle>
          </DialogHeader>
          {workPackageValidationSummary.length > 0 ? (
            <div className="mx-3 mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {workPackageValidationSummary.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}
          <div className="grid h-[calc(92vh-148px)] grid-cols-1 gap-2 overflow-hidden bg-[#f8f8f8] px-3 pb-2 pt-1 lg:grid-cols-[1.06fr_0.94fr]">
            <div className="space-y-3 overflow-y-auto border border-[#e5e5e5] bg-white p-2.5">
              <div className="border-b border-[#efefef] bg-[#fafafa] px-[10px] py-[6px] text-[13px] font-semibold text-[#757575]">Work Package details</div>
              <div className="space-y-1">
                <Label htmlFor="wp-aircraft-search">Aircraft</Label>
                <TextInput id="wp-aircraft-search" value={aircraftSearchTerm} onChange={(event) => setAircraftSearchTerm(event.target.value)} placeholder="Search model, registration, serial" />
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
                {aircraftSelectionLoading ? (
                  <p className="text-xs text-muted-foreground">Loading aircraft...</p>
                ) : filteredAircraftOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No aircraft found in tenant scope.</p>
                ) : filteredAircraftOptions.map((aircraft) => (
                  <Button
                    key={aircraft.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectWorkPackageAircraft(aircraft.id)}
                    className={`h-auto w-full justify-start rounded-md border px-3 py-2 text-left text-xs ${workPackageCreateForm.aircraftId === aircraft.id ? 'border-primary bg-primary/10' : 'border-border'}`}
                    aria-pressed={workPackageCreateForm.aircraftId === aircraft.id}
                  >
                    <p className="font-medium">{aircraft.aircraftModel || 'Unknown Model'} · {aircraft.registration || '-'}</p>
                    <p className="text-muted-foreground">SN {aircraft.serialNumber || '-'} · Station {aircraft.stationCode || '-'}</p>
                  </Button>
                ))}
              </div>
              {workPackageCreateErrors.aircraftId ? <p className="text-xs text-destructive">{workPackageCreateErrors.aircraftId}</p> : null}
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="wp-number">Package Number</Label>
                  <TextInput id="wp-number" value={workPackageCreateForm.packageNumber} onChange={(event) => handleWorkPackageCreateFormChange('packageNumber', event.target.value)} />
                  {workPackageCreateErrors.packageNumber ? <p className="text-xs text-destructive">{workPackageCreateErrors.packageNumber}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wp-topic">Topic</Label>
                  <TextInput id="wp-topic" value={workPackageCreateForm.topic} onChange={(event) => handleWorkPackageCreateFormChange('topic', event.target.value)} />
                  {workPackageCreateErrors.topic ? <p className="text-xs text-destructive">{workPackageCreateErrors.topic}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wp-location">Location/Station</Label>
                  <TextInput id="wp-location" value={workPackageCreateForm.locationStation} onChange={(event) => handleWorkPackageCreateFormChange('locationStation', event.target.value)} />
                  {workPackageCreateErrors.locationStation ? <p className="text-xs text-destructive">{workPackageCreateErrors.locationStation}</p> : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="wp-planning-date">Planning Date</Label>
                  <DatePicker id="wp-planning-date" value={workPackageCreateForm.planningDate} onChange={(event) => handleWorkPackageCreateFormChange('planningDate', event.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wp-details">Work Package Details</Label>
                <Textarea id="wp-details" value={workPackageCreateForm.workPackageDetails} onChange={(event) => handleWorkPackageCreateFormChange('workPackageDetails', event.target.value)} />
                {workPackageCreateErrors.workPackageDetails ? <p className="text-xs text-destructive">{workPackageCreateErrors.workPackageDetails}</p> : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="wp-remarks">Remarks</Label>
                <Textarea id="wp-remarks" value={workPackageCreateForm.remarks} onChange={(event) => handleWorkPackageCreateFormChange('remarks', event.target.value)} />
              </div>
            </div>
            <div className="space-y-3 overflow-hidden border border-[#e5e5e5] bg-white p-2.5">
              <Tabs value={workPackageCreateTab} onValueChange={(value) => handleWorkPackageCreateTabChange(value as WorkPackageCreateTab)}>
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
                          const checked = workPackageCreateForm.selectedTaskIds.includes(task.value);
                          const conflict = taskConflictById[task.value];
                          return (
                            <tr key={task.value} className={conflict ? 'bg-amber-50/40' : ''}>
                              <td className="p-2"><Checkbox checked={checked} onCheckedChange={(value) => handleToggleWorkPackageCreateTaskSelection(task.value, Boolean(value))} disabled={!canSelectTasks || Boolean(conflict)} /></td>
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
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleWorkPackageCreateFormChange('selectedTaskIds', taskSelectionOptions.filter((task) => !taskConflictById[task.value]).map((task) => task.value))}>Select all valid</Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleWorkPackageCreateFormChange('selectedTaskIds', [])}>Clear</Button>
                    </div>
                  </div>
                  {workPackageCreateErrors.selectedTaskIds ? <p className="text-xs text-destructive">{workPackageCreateErrors.selectedTaskIds}</p> : null}
                </TabsContent>
                <TabsContent value="besting_wp" className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Maintenance Type</Label>
                      <select
                        value={workPackageCreateForm.maintenanceType}
                        onChange={(event) => handleWorkPackageCreateFormChange('maintenanceType', event.target.value as WorkPackageCreateFormState['maintenanceType'])}
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
                        value={workPackageCreateForm.priority}
                        onChange={(event) => handleWorkPackageCreateFormChange('priority', event.target.value as WorkPackageCreateFormState['priority'])}
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
                      <DatePicker id="wp-planned-start" value={workPackageCreateForm.plannedStartDate} onChange={(event) => handleWorkPackageCreateFormChange('plannedStartDate', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wp-planned-end">Planned End</Label>
                      <DatePicker id="wp-planned-end" value={workPackageCreateForm.plannedEndDate} onChange={(event) => handleWorkPackageCreateFormChange('plannedEndDate', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wp-created-by">Created By</Label>
                      <TextInput id="wp-created-by" value={workPackageCreateForm.createdBy} onChange={(event) => handleWorkPackageCreateFormChange('createdBy', event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wp-revision">Revision</Label>
                      <TextInput id="wp-revision" type="number" min={1} value={workPackageCreateForm.revision} onChange={(event) => handleWorkPackageCreateFormChange('revision', event.target.value)} />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="workflow" className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Assigned Role</Label>
                      <select
                        value={workPackageCreateForm.assignedRole}
                        onChange={(event) => handleWorkPackageCreateFormChange('assignedRole', event.target.value as WorkPackageCreateFormState['assignedRole'])}
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
                        value={workPackageCreateForm.workflowStatus}
                        onChange={(event) => handleWorkPackageCreateFormChange('workflowStatus', event.target.value as WorkPackageCreateFormState['workflowStatus'])}
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
            <Button variant="outline" onClick={() => setWorkPackageCreateDialogOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={handleOpenWorkPackageSubmitReview} disabled={workPackageCreateSubmitting}>Review</Button>
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
            <p>Package Number: {workPackageCreateForm.packageNumber || '-'}</p>
            <p>Topic: {workPackageCreateForm.topic || '-'}</p>
            <p>Tasks: {selectedTaskCount}</p>
            <p>Conflicts: {selectedTaskConflicts.length}</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setReviewSubmitDialogOpen(false)}>Back</Button>
            <Button onClick={() => void handleSubmitWorkPackageCreateForm()} disabled={workPackageCreateSubmitting || selectedTaskConflicts.length > 0}>
              {workPackageCreateSubmitting ? 'Submitting...' : 'Submit'}
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
