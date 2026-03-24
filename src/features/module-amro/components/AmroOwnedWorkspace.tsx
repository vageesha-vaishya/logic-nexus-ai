import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useRef, useState } from 'react';
import { useAmroWorkspaceState } from '../hooks/useAmroWorkspaceState';
import type { AmroAuthorityLevel, AmroAssetType } from '../workspace/amroWorkspaceModel';

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

export function AmroOwnedWorkspace({
  moduleKey,
  overviewPersona: _overviewPersona = 'tenant_admin',
  overviewControls: _overviewControls,
  overviewTelemetry: _overviewTelemetry,
}: AmroOwnedWorkspaceProps) {
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
  const [workPackageSortField, setWorkPackageSortField] = useState<'packageNumber' | 'lifecycleStage'>('packageNumber');
  const [workPackageSortDirection, setWorkPackageSortDirection] = useState<'asc' | 'desc'>('asc');
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
  const [lastWorkspaceExportAt, setLastWorkspaceExportAt] = useState<string | null>(null);
  const workspaceLoadStartedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const workspaceLoadMetricPublishedRef = useRef(false);
  const filterApplyStartedAtRef = useRef<number | null>(null);
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
      ? [
          {
            id: 'work-packages-create',
            label: 'Create Work Package',
            onClick: () => void handleCreateWorkPackage(),
            disabled: !newWorkPackageTitle.trim() || !state.canCreateWorkPackage,
            disabledReason: !state.canCreateWorkPackage ? 'Current role cannot create work packages.' : !newWorkPackageTitle.trim() ? 'Enter a work package title first.' : 'Ready.',
          },
          {
            id: 'work-packages-advance',
            label: 'Advance Lifecycle',
            onClick: () => void state.advanceWorkPackageLifecycle(),
            disabled: !state.selectedWorkPackageId || !state.canAdvanceLifecycle,
            disabledReason: !state.selectedWorkPackageId ? 'Select a work package first.' : !state.canAdvanceLifecycle ? 'Lifecycle transition is not allowed for current stage.' : 'Ready.',
          },
          {
            id: 'work-packages-delete',
            label: 'Delete Work Package',
            onClick: () => void state.deleteSelectedWorkPackage(),
            disabled: !state.selectedWorkPackageId || !state.canDeleteWorkPackage,
            disabledReason: !state.selectedWorkPackageId ? 'Select a work package first.' : !state.canDeleteWorkPackage ? 'Current role cannot delete work packages.' : 'Ready.',
          },
        ]
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
  const filteredWorkPackages = state.workPackages.filter((workPackage) => {
    const assetTag = state.assets.find((asset) => asset.id === workPackage.assetId)?.assetTag || '';
    const stationCode = state.scheduleBoardRows.find((row) => row.work_package_id === workPackage.id)?.station_code || '';
    const fleetMatch = selectedFleetFilter === 'all' || assetTag === selectedFleetFilter;
    const stationMatch = selectedStationFilter === 'all' || stationCode === selectedStationFilter;
    return fleetMatch && stationMatch;
  });
  const sortedWorkPackages = [...filteredWorkPackages].sort((left, right) => {
    const leftValue = workPackageSortField === 'packageNumber' ? left.packageNumber : left.lifecycleStage;
    const rightValue = workPackageSortField === 'packageNumber' ? right.packageNumber : right.lifecycleStage;
    const compare = leftValue.localeCompare(rightValue);
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
  const dataFreshnessLabel = state.loadingWorkPackages ? 'Refreshing now' : 'Within SLA window';
  const syncHealthLabel = state.realtimeConnected ? 'Healthy sync' : 'Degraded sync';
  const taskActionDisabledReason = canDirectTaskExecution ? '' : 'Disabled by policy: management role cannot submit technician execution actions.';
  const selectedWorkPackageAssignee = state.selectedWorkPackage?.tasks?.[0]?.assignedRole || 'Unassigned';
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
  };

  const handleOpenComplianceGate = async () => {
    const ok = await state.loadComplianceGateExplainability();
    if (ok) {
      state.setComplianceGateModalOpen(true);
      setLastInteractionMessage('Compliance gate explainability loaded.');
      return;
    }
    setLastInteractionMessage('Unable to load compliance gate explainability.');
  };

  const handleOpenWorkPackage = (workPackageId: string, packageNumber: string) => {
    state.setSelectedWorkPackageId(workPackageId);
    setLastInteractionMessage(`Opened work package ${packageNumber}.`);
  };

  const handleScheduleWorkPackage = async (workPackageId: string, packageNumber: string) => {
    state.setSelectedWorkPackageId(workPackageId);
    setBusyWorkPackageActionId(`schedule-${workPackageId}`);
    const ok = await state.assignSelectedWorkPackageToNextSlot();
    setBusyWorkPackageActionId(null);
    setLastInteractionMessage(ok ? `Scheduled work package ${packageNumber}.` : `Unable to schedule work package ${packageNumber}.`);
  };

  const handleHoldWorkPackage = async (workPackageId: string, packageNumber: string) => {
    state.setSelectedWorkPackageId(workPackageId);
    setBusyWorkPackageActionId(`hold-${workPackageId}`);
    const ok = await state.advanceWorkPackageLifecycle();
    setBusyWorkPackageActionId(null);
    setLastInteractionMessage(ok ? `Lifecycle transition submitted for ${packageNumber}.` : `Lifecycle transition failed for ${packageNumber}.`);
  };

  const handleCloneWorkPackage = async (packageNumber: string) => {
    setBusyWorkPackageActionId(`clone-${packageNumber}`);
    const ok = await state.createWorkPackage(`${packageNumber} Clone`);
    setBusyWorkPackageActionId(null);
    setLastInteractionMessage(ok ? `Cloned from ${packageNumber}.` : `Clone failed for ${packageNumber}.`);
  };

  const handleWorkPackageExport = (workPackageId: string, packageNumber: string) => {
    publishWorkspaceExport('work-package', {
      workPackageId,
      packageNumber,
      moduleKey: moduleKey || 'amro',
      view: workspaceViewMode,
      theme: workspaceTheme,
    });
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

  const handleDragHandleInteraction = (packageNumber: string) => {
    setLastInteractionMessage(`Drag interaction registered for ${packageNumber}.`);
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
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs" role="status" aria-live="polite">
        Workspace status: {dataFreshnessLabel}. Sync health: {syncHealthLabel}.
      </div>
      <div className="rounded-md border px-3 py-2 text-xs" role="status" aria-live="polite">
        Interaction status: {lastInteractionMessage}
      </div>
      {state.loadingWorkPackages ? (
        <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          Loading latest AMRO workspace data...
        </div>
      ) : null}
      {state.workPackagesError ? (
        <div className="rounded-md border border-destructive/50 px-3 py-2 text-xs text-destructive" role="alert">
          {state.workPackagesError}
        </div>
      ) : null}
      {moduleKey ? (
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
              ) : (
                <p className="text-muted-foreground">All module actions are ready.</p>
              )}
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
          <CardTitle>Work Package and Task Lifecycle Orchestration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3" data-amro-screen="SCR-AMRO-002" role="region" aria-label="SCR-AMRO-002 Work Package List">
            <p className="text-sm font-semibold">SCR-AMRO-002 Work Package List</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Columns: WO# | Aircraft | Priority | Type | Station | Due | Status | Owner
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Frozen identifiers: WO# / Aircraft</Badge>
              <Button variant="outline" size="sm" onClick={() => setWorkPackageSortField('packageNumber')}>Sort WO#</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkPackageSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))}
              >
                Sort Direction: {workPackageSortDirection.toUpperCase()}
              </Button>
            </div>
            <div className="mt-2 space-y-2">
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
                pagedWorkPackages.map((workPackage) => (
                  <div
                    key={`list-${workPackage.id}`}
                    className={`rounded-md border p-2 text-xs ${
                      (state.scheduleBoardRows.find((row) => row.work_package_id === workPackage.id)?.slot_end
                      && new Date(state.scheduleBoardRows.find((row) => row.work_package_id === workPackage.id)?.slot_end || nowEpoch).getTime() < nowEpoch)
                        ? 'border-destructive/40 bg-destructive/5'
                        : ''
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-8">
                      <span>{workPackage.packageNumber}</span>
                      <span>{workPackage.assetId}</span>
                      <span>normal</span>
                      <span>line</span>
                      <span>{state.scheduleBoardRows.find((row) => row.work_package_id === workPackage.id)?.station_code || 'N/A'}</span>
                      <span>{state.scheduleBoardRows.find((row) => row.work_package_id === workPackage.id)?.slot_end || 'TBD'}</span>
                      <span><Badge variant="outline">{workPackage.lifecycleStage}</Badge></span>
                      <span>{activeUxRole}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Open work package ${workPackage.packageNumber}`}
                        onClick={() => handleOpenWorkPackage(workPackage.id, workPackage.packageNumber)}
                        disabled={busyWorkPackageActionId !== null}
                      >
                        Open
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Schedule work package ${workPackage.packageNumber}`}
                        onClick={() => void handleScheduleWorkPackage(workPackage.id, workPackage.packageNumber)}
                        disabled={busyWorkPackageActionId !== null}
                      >
                        Schedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Hold work package ${workPackage.packageNumber}`}
                        onClick={() => void handleHoldWorkPackage(workPackage.id, workPackage.packageNumber)}
                        disabled={busyWorkPackageActionId !== null}
                      >
                        Hold
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Clone work package ${workPackage.packageNumber}`}
                        onClick={() => void handleCloneWorkPackage(workPackage.packageNumber)}
                        disabled={busyWorkPackageActionId !== null}
                      >
                        Clone
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Export work package ${workPackage.packageNumber}`}
                        onClick={() => handleWorkPackageExport(workPackage.id, workPackage.packageNumber)}
                        disabled={busyWorkPackageActionId !== null}
                      >
                        Export
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Drag handle for ${workPackage.packageNumber}`}
                        onClick={() => handleDragHandleInteraction(workPackage.packageNumber)}
                      >
                        Drag Handle
                      </Button>
                    </div>
                  </div>
                ))
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
              <Button onClick={state.advanceWorkPackageLifecycle} disabled={!state.canAdvanceLifecycle}>
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
              onClick={state.deleteSelectedWorkPackage}
              disabled={!state.selectedWorkPackageId || !state.canDeleteWorkPackage}
            >
              Delete Selected
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3" data-amro-screen="SCR-AMRO-004" role="region" aria-label="SCR-AMRO-004 Work Package Detail Sheet">
            <div className="xl:col-span-2">
              {state.selectedWorkPackage ? (
                <Tabs value={detailTab} onValueChange={handleDetailTabChange}>
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
                  Sticky actions: Assign | Schedule | Run gate check | Hold | Close
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" aria-label="Assign work package" onClick={() => void handleStickyAssignAction()}>Assign</Button>
                  <Button variant="outline" size="sm" aria-label="Schedule work package" onClick={() => void handleStickyScheduleAction()}>Schedule</Button>
                  <Button variant="outline" size="sm" aria-label="Run compliance gate check" onClick={() => void handleStickyGateCheckAction()}>Gate Check</Button>
                  <Button variant="outline" size="sm" aria-label="Hold work package" onClick={() => void handleStickyHoldAction()}>Hold</Button>
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
              <p className="text-muted-foreground">Activity feed: latest updates synchronized with compliance replay and task signatures.</p>
              <p className="text-muted-foreground">Signature state: {state.canSignOff ? 'Ready for certifying signature' : 'Signature not permitted for current authority'}</p>
              <p className="text-muted-foreground">Pending blockers: {state.complianceAnomalyAlerts.length}</p>
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
              onClick={state.assignSelectedWorkPackageToNextSlot}
              disabled={!state.selectedWorkPackageId}
            >
              Assign Next Slot
            </Button>
            <Button variant="outline" onClick={state.fetchScheduleOptimizationRecommendations}>
              Refresh Optimization Recommendations
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
        <DialogContent>
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
      <Dialog open={closureConfirmOpen} onOpenChange={setClosureConfirmOpen}>
        <DialogContent>
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
      <Dialog open={overrideConfirmOpen} onOpenChange={setOverrideConfirmOpen}>
        <DialogContent>
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
        <DialogContent>
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
