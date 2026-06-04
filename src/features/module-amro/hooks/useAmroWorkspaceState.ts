import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDomain } from '@/contexts/DomainContext';
import { useAmroApiAvailability } from './useAmroApiAvailability';
import { useAmroHoldAuditTrail } from './useAmroHoldAuditTrail';
import { useAmroWorkOrderFilters } from './useAmroWorkOrderFilters';
import { useAmroWorkOrdersState } from './useAmroWorkOrdersState';
import { useAmroWorkOrdersFetch } from './useAmroWorkOrdersFetch';
import { useAmroModuleSurfacesFetch } from './useAmroModuleSurfacesFetch';
import { useAmroTasksFetch } from './useAmroTasksFetch';
import { useAmroScheduleBoardFetch } from './useAmroScheduleBoardFetch';
import { useAmroWorkOrderHoldMutations } from './useAmroWorkOrderHoldMutations';
import { useAmroOpenWorkOrderDetails } from './useAmroOpenWorkOrderDetails';
import { useAmroScheduleMutations } from './useAmroScheduleMutations';
import { useAmroWorkOrderMutations } from './useAmroWorkOrderMutations';
import { useAmroAdvanceLifecycle } from './useAmroAdvanceLifecycle';
import { useAmroMaterialsMutations } from './useAmroMaterialsMutations';
import { useAmroComplianceMutations } from './useAmroComplianceMutations';
import type {
  AmroAssetRegistryRecord,
  AmroAuthorityLevel,
  AmroComplianceRulePack,
  AmroEvidenceRecord,
  AmroMaterialPlanningRecord,
  AmroPredictiveRecommendation,
  AmroQualification,
  AmroWorkOrder,
  AmroWorkOrderLifecycleStage,
} from '../workspace/amroWorkspaceModel';
import {
  buildComplianceCoverage,
  buildMaterialsPlanningSummary,
  buildPredictiveMaintenanceSummary,
  canPerformAuthoritySignOff,
  canTransitionWorkOrderLifecycle,
  getNextWorkOrderLifecycleStage,
} from '../workspace/amroWorkspaceModel';
import type {
  ApiWorkOrder,
  WorkOrderStatus,
  ApiTask,
  ApiAsset,
  ApiQualification,
  ApiComplianceSummary,
  ApiEvidence,
  ApiMaterial,
  ApiRecommendation,
  ComplianceRegulatorProfile,
  ApiScheduleRow,
  ApiScheduleOptimizationRecommendation,
  ApiWorkOrderReplanOption,
  ApiEnvelope,
  V2WorkOrderItem,
  V2TaskItem,
  V2SchedulesResponse,
  V2WorkOrdersResponse,
  V2ScheduleOptimizationResponse,
  ComplianceExplainabilityState,
  ComplianceAuditReplayState,
  ComplianceAnomalyAlert,
  ComplianceRegulatorProfilePackState,
  CertificationAuthorityProfile,
  CertificationDecisionOption,
  CertificationQualificationStatusState,
  CertificationDecisionState,
  CertificationExpiryAutomationState,
  CertificationCompetencyAnalyticsState,
  CertificationTemplateState,
  CreateWorkOrderOptions,
} from './amroWorkspaceTypes';
import {
  parseJsonSafe,
  isNetworkConnectivityError,
  isNotFoundErrorMessage,
  isMissingAircraftIdErrorMessage,
  mapV2StatusToV1Status,
  getAmroApiBaseUrl,
  mapStatusToLifecycle,
  mapLifecycleToStatus,
  sanitizeSavedWorkOrderViews,
  resolveRoleTransitionTargets,
} from './amroWorkspaceHelpers';
import {
  initialAssets,
  initialQualifications,
  initialRulePacks,
  initialEvidenceChain,
  initialMaterials,
  initialPredictiveRecommendations,
} from './amroWorkspaceFixtures';

// Old in-file definitions removed; see ./amroWorkspaceTypes,
// ./amroWorkspaceHelpers, ./amroWorkspaceFixtures.


export function useAmroWorkspaceState() {
  const { hasPermission, hasRole, isPlatformAdmin: isAuthPlatformAdmin, session } = useAuth();
  const {
    currentDomain,
    availableDomains,
    setDomain,
    refreshDomains,
    isPlatformAdmin: isDomainPlatformAdmin,
    isLoading: isDomainLoading = false,
  } = useDomain();
  const token = session?.access_token || null;
  const apiBaseUrl = useMemo(() => getAmroApiBaseUrl(), []);
  const [assets, setAssets] = useState<AmroAssetRegistryRecord[]>(initialAssets);
  const [assetsLoadedFromApi, setAssetsLoadedFromApi] = useState<boolean>(false);
  // Phase 8f.3b: work-orders core state (6 vars) lifted to
  // useAmroWorkOrdersState. Pure state lift — all 136 orchestrator
  // setter touchpoints continue to call the setters via the destructure.
  const {
    workOrders, setWorkOrders,
    selectedWorkOrderId, setSelectedWorkOrderId,
    loadingWorkOrders, setLoadingWorkOrders,
    workOrdersError, setWorkOrdersError,
    hasV1WorkOrderConnectivity, setHasV1WorkOrderConnectivity,
    realtimeConnected, setRealtimeConnected,
  } = useAmroWorkOrdersState();
  // Phase 8f.3a: filter + saved-view state extracted to useAmroWorkOrderFilters.
  // applySavedWorkOrderView moved into the hook. saveCurrentWorkOrderView
  // stays here because it also writes setWorkOrdersError (orchestrator-owned).
  const {
    workOrderStatusFilter,
    setWorkOrderStatusFilter,
    workOrderSearch,
    setWorkOrderSearch,
    selectedSavedViewId,
    setSelectedSavedViewId,
    savedWorkOrderViews,
    setSavedWorkOrderViews,
    applySavedWorkOrderView,
  } = useAmroWorkOrderFilters();
  // Phase 8f.2: hold + soft-delete tracking maps + audit trail extracted to
  // useAmroHoldAuditTrail. The orchestrator's toggleWorkOrderHold,
  // softDeleteWorkOrder, restoreSoftDeletedWorkOrder callbacks call the
  // helpers below (the callbacks themselves stay here because they reach
  // into work-orders state — extracted in slice 8f.next).
  const {
    holdReleaseStatusByWorkOrder,
    softDeletedWorkOrderStatusById,
    holdAuditTrail,
    rememberPreHoldStatus,
    forgetPreHoldStatus,
    rememberPreSoftDeleteStatus,
    forgetPreSoftDeleteStatus,
    appendHoldAuditEntry,
  } = useAmroHoldAuditTrail();
  // (realtimeConnected lifted to useAmroWorkOrdersState above — Phase 8f.3b)
  const [requiredAuthority, setRequiredAuthority] = useState<AmroAuthorityLevel>('supervisor');
  const [selectedQualificationId, setSelectedQualificationId] = useState<string>(initialQualifications[0]?.id ?? '');
  const [qualifications, setQualifications] = useState<AmroQualification[]>(initialQualifications);
  const [rulePacks, setRulePacks] = useState<AmroComplianceRulePack[]>(initialRulePacks);
  const [evidenceChain, setEvidenceChain] = useState<AmroEvidenceRecord[]>(initialEvidenceChain);
  const [materials, setMaterials] = useState<AmroMaterialPlanningRecord[]>(initialMaterials);
  const [predictiveRecommendations, setPredictiveRecommendations] = useState<AmroPredictiveRecommendation[]>(initialPredictiveRecommendations);
  const [scheduleBoardRows, setScheduleBoardRows] = useState<ApiScheduleRow[]>([]);
  const [scheduleOptimizationRecommendations, setScheduleOptimizationRecommendations] = useState<ApiScheduleOptimizationRecommendation[]>([]);
  const [workOrderReplanOptions, setWorkOrderReplanOptions] = useState<ApiWorkOrderReplanOption[]>([]);
  const [lastConfirmedReplanScheduleId, setLastConfirmedReplanScheduleId] = useState<string>('');
  const [lastInventoryOptimizationRunId, setLastInventoryOptimizationRunId] = useState<string>('');
  const [lastProcurementSyncId, setLastProcurementSyncId] = useState<string>('');
  const [complianceGateModalOpen, setComplianceGateModalOpen] = useState<boolean>(false);
  const [complianceExplainability, setComplianceExplainability] = useState<ComplianceExplainabilityState | null>(null);
  const [complianceAuditReplay, setComplianceAuditReplay] = useState<ComplianceAuditReplayState | null>(null);
  const [complianceAnomalyAlerts, setComplianceAnomalyAlerts] = useState<ComplianceAnomalyAlert[]>([]);
  const [selectedRegulatorProfile, setSelectedRegulatorProfile] = useState<ComplianceRegulatorProfile>('FAA');
  const [regulatorProfilePack, setRegulatorProfilePack] = useState<ComplianceRegulatorProfilePackState | null>(null);
  const [obligationIngestionSummary, setObligationIngestionSummary] = useState<{ total: number; adCount: number; sbCount: number } | null>(null);
  const [deferralDecision, setDeferralDecision] = useState<{ decision: string; actions: string[] } | null>(null);
  const [selectedCertificationAuthorityProfile, setSelectedCertificationAuthorityProfile] = useState<CertificationAuthorityProfile>('FAA');
  const [qualificationStatusIndicator, setQualificationStatusIndicator] = useState<CertificationQualificationStatusState | null>(null);
  const [certifyingPrivilegeValidated, setCertifyingPrivilegeValidated] = useState<boolean>(false);
  const [latestCertificationDecision, setLatestCertificationDecision] = useState<CertificationDecisionState | null>(null);
  const [expiryAutomationSummary, setExpiryAutomationSummary] = useState<CertificationExpiryAutomationState | null>(null);
  const [competencyAnalytics, setCompetencyAnalytics] = useState<CertificationCompetencyAnalyticsState | null>(null);
  const [authorityCertificationTemplate, setAuthorityCertificationTemplate] = useState<CertificationTemplateState | null>(null);
  const [domainRefreshAttempted, setDomainRefreshAttempted] = useState<boolean>(false);

  const authHeaders = useMemo(
    () =>
      token
        ? {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        : null,
    [token],
  );
  const isAmroDomainActive = useMemo(
    () => String(currentDomain?.code || '').trim().toUpperCase() === 'AMRO',
    [currentDomain],
  );
  const hasAmroDomainAssignment = useMemo(
    () => isAmroDomainActive || availableDomains.some((domain) => String(domain.code || '').trim().toUpperCase() === 'AMRO'),
    [availableDomains, isAmroDomainActive],
  );
  const amroAccessErrorMessage = useMemo(
    () =>
      isDomainLoading
        ? 'Resolving AMRO domain assignment...'
        : hasAmroDomainAssignment
        ? 'AMRO domain context required - switch to AMRO domain'
        : 'Access denied - AMRO domain assignment required',
    [hasAmroDomainAssignment, isDomainLoading],
  );
  const hasAmroPermissionScope = useMemo(
    () =>
      isAuthPlatformAdmin() ||
      isDomainPlatformAdmin ||
      hasRole('tenant_admin') ||
      hasRole('franchise_admin') ||
      hasPermission('*') ||
      hasPermission('dashboards.view') ||
      hasPermission('dashboards.manage') ||
      hasPermission('reports.view') ||
      hasPermission('reports.manage'),
    [hasPermission, hasRole, isAuthPlatformAdmin, isDomainPlatformAdmin],
  );
  const hasAmroAccess = useMemo(
    () => hasAmroPermissionScope && hasAmroDomainAssignment && isAmroDomainActive,
    [hasAmroDomainAssignment, hasAmroPermissionScope, isAmroDomainActive],
  );
  const isAwaitingAmroDomainActivation = useMemo(
    () => hasAmroPermissionScope && hasAmroDomainAssignment && !isAmroDomainActive,
    [hasAmroDomainAssignment, hasAmroPermissionScope, isAmroDomainActive],
  );

  useEffect(() => {
    if (isDomainLoading || domainRefreshAttempted) {
      return;
    }
    if (!token || !hasAmroPermissionScope || hasAmroDomainAssignment) {
      return;
    }
    setDomainRefreshAttempted(true);
    void refreshDomains(true);
  }, [
    domainRefreshAttempted,
    hasAmroDomainAssignment,
    hasAmroPermissionScope,
    isDomainLoading,
    refreshDomains,
    token,
  ]);

  // Phase 8f.1: API-availability cooldown extracted to useAmroApiAvailability.
  // Orchestrator wires onUnavailable to also drop the realtime flag (the
  // cross-slice side effect the original markApiTemporarilyUnavailable did).
  const { isApiTemporarilyUnavailable, markApiTemporarilyUnavailable } =
    useAmroApiAvailability({
      onUnavailable: useCallback(() => setRealtimeConnected(false), []),
    });

  useEffect(() => {
    if (!isAwaitingAmroDomainActivation) {
      return;
    }
    void setDomain('AMRO').catch(() => {
      setWorkOrdersError('AMRO domain context required - switch to AMRO domain');
    });
  }, [isAwaitingAmroDomainActivation, setDomain]);

  const mapWorkOrderRecord = useCallback((item: { id: string; packageNumber: string; status: string; assetId: string }) => ({
    id: item.id,
    packageNumber: item.packageNumber,
    lifecycleStage: mapStatusToLifecycle(item.status),
    assetId: item.assetId,
    tasks: [],
  }), []);

  // Phase 8f.3c — fetchWorkOrders carved into useAmroWorkOrdersFetch.
  // Orchestrator passes deps as a typed input; behavior identical.
  const fetchWorkOrders = useAmroWorkOrdersFetch({
    apiBaseUrl,
    authHeaders,
    hasAmroAccess,
    isAwaitingAmroDomainActivation,
    amroAccessErrorMessage,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    hasV1WorkOrderConnectivity,
    setHasV1WorkOrderConnectivity,
    setWorkOrders,
    setSelectedWorkOrderId,
    setLoadingWorkOrders,
    setWorkOrdersError,
    workOrderStatusFilter,
    workOrderSearch,
    selectedSavedViewId,
    setSavedWorkOrderViews,
    mapWorkOrderRecord,
  });

  // Phase 8f.3d — fetchModuleSurfaces carved into useAmroModuleSurfacesFetch.
  const fetchModuleSurfaces = useAmroModuleSurfacesFetch({
    apiBaseUrl,
    authHeaders,
    hasAmroAccess,
    isAwaitingAmroDomainActivation,
    amroAccessErrorMessage,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    selectedWorkOrderId,
    setAssets,
    setAssetsLoadedFromApi,
    setQualifications,
    setSelectedQualificationId,
    setRulePacks,
    setEvidenceChain,
    setMaterials,
    setPredictiveRecommendations,
  });

  // Phase 8f.3e — fetchTasksForWorkOrder carved into useAmroTasksFetch.
  const fetchTasksForWorkOrder = useAmroTasksFetch({
    apiBaseUrl,
    authHeaders,
    hasAmroAccess,
    isAwaitingAmroDomainActivation,
    amroAccessErrorMessage,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrders,
    setWorkOrdersError,
  });

  // Phase 8f.3f — fetchScheduleBoard carved into useAmroScheduleBoardFetch.
  const fetchScheduleBoard = useAmroScheduleBoardFetch({
    apiBaseUrl,
    authHeaders,
    hasAmroAccess,
    isAwaitingAmroDomainActivation,
    amroAccessErrorMessage,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setScheduleBoardRows,
    setWorkOrdersError,
  });

  useEffect(() => {
    void fetchWorkOrders();
  }, [fetchWorkOrders]);

  useEffect(() => {
    void fetchModuleSurfaces();
  }, [fetchModuleSurfaces]);

  useEffect(() => {
    if (!selectedWorkOrderId) {
      return;
    }
    void fetchTasksForWorkOrder(selectedWorkOrderId);
  }, [fetchTasksForWorkOrder, selectedWorkOrderId]);

  useEffect(() => {
    void fetchScheduleBoard();
  }, [fetchScheduleBoard]);

  useEffect(() => {
    if (!token) {
      setRealtimeConnected(false);
      return;
    }
    if (!hasAmroAccess) {
      setRealtimeConnected(false);
      return;
    }
    if (!hasV1WorkOrderConnectivity) {
      setRealtimeConnected(false);
      return;
    }
    if (isApiTemporarilyUnavailable()) {
      return;
    }
    const streamUrl = `${apiBaseUrl}/api/v1/work-orders/stream?access_token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);
    source.addEventListener('connected', () => {
      setRealtimeConnected(true);
    });
    source.addEventListener('work-order-change', () => {
      void fetchWorkOrders();
      void fetchModuleSurfaces();
      if (selectedWorkOrderId) {
        void fetchTasksForWorkOrder(selectedWorkOrderId);
      }
    });
    source.onerror = () => {
      setRealtimeConnected(false);
      setHasV1WorkOrderConnectivity(false);
      markApiTemporarilyUnavailable();
      source.close();
    };
    return () => {
      source.close();
      setRealtimeConnected(false);
    };
  }, [
    apiBaseUrl,
    fetchModuleSurfaces,
    fetchTasksForWorkOrder,
    fetchWorkOrders,
    isApiTemporarilyUnavailable,
    hasAmroAccess,
    hasV1WorkOrderConnectivity,
    markApiTemporarilyUnavailable,
    selectedWorkOrderId,
    token,
  ]);

  useEffect(() => {
    if (!authHeaders || hasV1WorkOrderConnectivity) {
      return;
    }
    const intervalId = setInterval(() => {
      void fetchWorkOrders();
      void fetchModuleSurfaces();
      void fetchScheduleBoard();
      if (selectedWorkOrderId) {
        void fetchTasksForWorkOrder(selectedWorkOrderId);
      }
    }, 30000);
    return () => {
      clearInterval(intervalId);
    };
  }, [
    authHeaders,
    fetchModuleSurfaces,
    fetchTasksForWorkOrder,
    fetchWorkOrders,
    fetchScheduleBoard,
    hasV1WorkOrderConnectivity,
    selectedWorkOrderId,
  ]);

  const selectedWorkOrder = useMemo(
    () => workOrders.find((item) => item.id === selectedWorkOrderId) ?? workOrders[0] ?? null,
    [selectedWorkOrderId, workOrders],
  );

  const selectedQualification = useMemo(
    () => qualifications.find((item) => item.id === selectedQualificationId) ?? qualifications[0] ?? null,
    [qualifications, selectedQualificationId]
  );

  const isAmroAuthorized = hasAmroAccess;

  const activeRole = useMemo(() => {
    if (hasRole('tenant_admin')) return 'tenant_admin';
    if (hasPermission('dashboards.manage')) return 'planner';
    if (hasPermission('reports.manage')) return 'engineer';
    if (hasPermission('reports.view')) return 'technician';
    if (hasPermission('dashboards.view')) return 'inspector';
    return 'viewer';
  }, [hasPermission, hasRole]);

  const canCreateWorkOrder = useMemo(
    () => isAmroAuthorized || hasPermission('dashboards.manage') || hasPermission('reports.manage'),
    [hasPermission, isAmroAuthorized],
  );

  const canDeleteWorkOrder = useMemo(
    () => isAuthPlatformAdmin() || isDomainPlatformAdmin || hasRole('tenant_admin') || hasPermission('dashboards.manage'),
    [hasPermission, hasRole, isAuthPlatformAdmin, isDomainPlatformAdmin],
  );

  const canAdvanceLifecycle = useMemo(() => {
    if (!isAmroAuthorized || !selectedWorkOrder) return false;
    if (selectedWorkOrder.lifecycleStage === 'close') return false;
    const nextStage = getNextWorkOrderLifecycleStage(selectedWorkOrder.lifecycleStage);
    const nextStatus = mapLifecycleToStatus(nextStage);
    return resolveRoleTransitionTargets(activeRole).includes(nextStatus);
  }, [activeRole, isAmroAuthorized, selectedWorkOrder]);

  const canSignOff = useMemo(() => {
    if (!selectedQualification) return false;
    return canPerformAuthoritySignOff(selectedQualification, requiredAuthority);
  }, [requiredAuthority, selectedQualification]);

  useEffect(() => {
    if (!selectedQualification) {
      setQualificationStatusIndicator(null);
      return;
    }
    const daysUntilExpiry = Math.floor((Date.parse(selectedQualification.validUntil) - Date.now()) / 86_400_000);
    const lifecycle = daysUntilExpiry < 0
      ? 'suspended'
      : daysUntilExpiry <= 30
        ? 'warning'
        : 'active';
    const reason = lifecycle === 'suspended'
      ? 'Qualification expired'
      : lifecycle === 'warning'
        ? 'Qualification near expiry'
        : 'Qualification valid';
    setQualificationStatusIndicator({
      lifecycle,
      daysUntilExpiry,
      reason,
    });
  }, [selectedQualification]);

  const complianceCoverage = useMemo(() => buildComplianceCoverage(rulePacks), [rulePacks]);
  const materialsSummary = useMemo(() => buildMaterialsPlanningSummary(materials), [materials]);
  const predictiveSummary = useMemo(
    () => buildPredictiveMaintenanceSummary(predictiveRecommendations),
    [predictiveRecommendations]
  );

  // Phase 8f.4g — 11 compliance + certification mutators (and 2 internal
  // interface helpers) carved into useAmroComplianceMutations.
  const {
    loadComplianceGateExplainability,
    loadAuditReplayTimeline,
    detectComplianceAnomalies,
    loadRegulatorProfilePack,
    ingestAdSbObligations,
    evaluateMelCdlDeferral,
    validateCertifyingPrivilege,
    submitCertificationDecision,
    runExpiryWarningAndSuspension,
    loadCompetencyAnalyticsDashboard,
    loadAuthorityCertificationTemplate,
  } = useAmroComplianceMutations({
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    selectedWorkOrderId,
    selectedWorkOrder,
    selectedQualification,
    selectedRegulatorProfile,
    selectedCertificationAuthorityProfile,
    qualifications,
    compliancePackCount: complianceCoverage.activePacks,
    shortageCount: materialsSummary.shortageCount,
    setComplianceExplainability,
    setComplianceGateModalOpen,
    setComplianceAuditReplay,
    setComplianceAnomalyAlerts,
    setRegulatorProfilePack,
    setRulePacks,
    setObligationIngestionSummary,
    setDeferralDecision,
    setCertifyingPrivilegeValidated,
    setLatestCertificationDecision,
    setExpiryAutomationSummary,
    setCompetencyAnalytics,
    setAuthorityCertificationTemplate,
  });

  const shouldUseLocalWorkOrderFallback = useCallback((errorMessage: string) => {
    const normalized = errorMessage.toLowerCase();
    return normalized.includes('temporarily unavailable')
      || normalized.includes('endpoint is disabled')
      || normalized.includes('not enabled for this rollout cohort')
      || normalized.includes('(404)')
      || normalized.includes('failed to fetch');
  }, []);

  const applyLocalLifecycleTransition = useCallback(
    (workOrderId: string, nextStage: AmroWorkOrderLifecycleStage) => {
      setWorkOrders((current) => current.map((item) => (
        item.id === workOrderId
          ? {
              ...item,
              lifecycleStage: nextStage,
            }
          : item
      )));
      setSelectedWorkOrderId(workOrderId);
      return nextStage;
    },
    [],
  );

  const createLocalWorkOrder = useCallback(
    (title: string) => {
      const now = Date.now();
      const localWorkOrder: AmroWorkOrder = {
        id: `local-wp-${now}`,
        packageNumber: `WP-LOCAL-${String(now).slice(-6)}`,
        lifecycleStage: 'create',
        assetId: assets[0]?.id || 'asset-local',
        tasks: [],
      };
      setWorkOrders((current) => [localWorkOrder, ...current]);
      setSelectedWorkOrderId(localWorkOrder.id);
      return true;
    },
    [assets],
  );

  const appendLocalScheduleRow = useCallback((workOrderId: string) => {
    const now = Date.now();
    const slotStart = new Date(now + 3600000).toISOString();
    const slotEnd = new Date(now + 7200000).toISOString();
    setScheduleBoardRows((current) => [
      {
        schedule_id: `local-schedule-${now}`,
        work_order_id: workOrderId,
        station_code: 'station-a',
        slot_start: slotStart,
        slot_end: slotEnd,
        assigned_team_size: 1,
        capacity: 2,
        status: 'assigned',
      },
      ...current.filter((item) => item.work_order_id !== workOrderId),
    ]);
    return true;
  }, []);

  // Phase 8f.4e — advanceWorkOrderLifecycle carved into useAmroAdvanceLifecycle.
  const advanceWorkOrderLifecycle = useAmroAdvanceLifecycle({
    apiBaseUrl,
    authHeaders,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    workOrders,
    selectedWorkOrder,
    evidenceChain,
    canSignOff,
    fetchWorkOrders,
    fetchTasksForWorkOrder,
    applyLocalLifecycleTransition,
    shouldUseLocalWorkOrderFallback,
  });

  // Phase 8f.4d — 5 work-order CRUD mutators carved into useAmroWorkOrderMutations.
  const {
    createWorkOrder,
    cloneWorkOrderFromTemplate,
    assignSelectedWorkOrderToNextSlot,
    updateWorkOrderStatusById,
    updateWorkOrderScheduling,
  } = useAmroWorkOrderMutations({
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    workOrders,
    selectedWorkOrder,
    selectedWorkOrderId,
    setSelectedWorkOrderId,
    setWorkOrdersError,
    assets,
    assetsLoadedFromApi,
    activeRole,
    scheduleBoardRows,
    fetchWorkOrders,
    fetchScheduleBoard,
    shouldUseLocalWorkOrderFallback,
    applyLocalLifecycleTransition,
    createLocalWorkOrder,
    appendLocalScheduleRow,
  });

  // Phase 8f.4a — toggleWorkOrderHold + softDeleteWorkOrder +
  // restoreSoftDeletedWorkOrder carved into useAmroWorkOrderHoldMutations.
  const {
    toggleWorkOrderHold,
    softDeleteWorkOrder,
    restoreSoftDeletedWorkOrder,
  } = useAmroWorkOrderHoldMutations({
    workOrders,
    selectedWorkOrder,
    activeRole,
    updateWorkOrderStatusById,
    holdReleaseStatusByWorkOrder,
    softDeletedWorkOrderStatusById,
    rememberPreHoldStatus,
    forgetPreHoldStatus,
    rememberPreSoftDeleteStatus,
    forgetPreSoftDeleteStatus,
    appendHoldAuditEntry,
  });

  // Phase 8f.4b — openWorkOrderDetails carved into useAmroOpenWorkOrderDetails.
  const openWorkOrderDetails = useAmroOpenWorkOrderDetails({
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setSelectedWorkOrderId,
    setWorkOrders,
    setWorkOrdersError,
    fetchTasksForWorkOrder,
  });

  // Phase 8f.4c — 4 schedule mutators carved into useAmroScheduleMutations.
  const {
    acknowledgeScheduleUpdate,
    fetchScheduleOptimizationRecommendations,
    runWorkOrderReplanSimulation,
    confirmWorkOrderReplan,
  } = useAmroScheduleMutations({
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    scheduleBoardRows,
    assets,
    selectedWorkOrderId,
    selectedWorkOrder,
    activeRole,
    workOrderReplanOptions,
    setWorkOrderReplanOptions,
    setScheduleOptimizationRecommendations,
    setLastConfirmedReplanScheduleId,
    fetchScheduleBoard,
    fetchWorkOrders,
  });

  // Phase 8f.4f — 6 materials/supplier/inventory mutators carved into useAmroMaterialsMutations.
  const {
    reservePartsAllocationForSelectedWorkOrder,
    processCriticalShortageResponse,
    applyRotableLlpTraceability,
    runInventoryOptimizationModel,
    syncSupplierEtaForSelectedWorkOrder,
    syncSupplierAsnAndErpProcurement,
  } = useAmroMaterialsMutations({
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    materials,
    setMaterials,
    predictiveRecommendations,
    selectedWorkOrderId,
    setLastInventoryOptimizationRunId,
    setLastProcurementSyncId,
    fetchModuleSurfaces,
  });

  // Phase 8f.3a: applySavedWorkOrderView now lives in useAmroWorkOrderFilters
  // (destructured above). saveCurrentWorkOrderView stays here because it
  // writes setWorkOrdersError on transient failures.

  const saveCurrentWorkOrderView = useCallback(
    async (name: string) => {
      if (!authHeaders) return false;
      const cleanName = name.trim();
      if (!cleanName) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders?interface=save-work-order-view`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            view_name: cleanName,
            filters: {
              status: workOrderStatusFilter,
              search: workOrderSearch,
            },
          }),
        });
        const payload = await parseJsonSafe<{ output?: { saved_view_id?: string; view_name?: string; filters?: { status?: string; search?: string } }; error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to save view (${response.status})`);
        }
        const savedViewId = String(payload?.output?.saved_view_id || '').trim();
        if (savedViewId) {
          setSavedWorkOrderViews((previous) => {
            const next = previous.filter((item) => item.id !== savedViewId);
            next.push({
              id: savedViewId,
              name: String(payload?.output?.view_name || cleanName),
              filters: {
                status: String(payload?.output?.filters?.status || workOrderStatusFilter),
                search: String(payload?.output?.filters?.search || workOrderSearch),
              },
            });
            return sanitizeSavedWorkOrderViews(next);
          });
          setSelectedSavedViewId(savedViewId);
        }
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to save work package view');
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      workOrderSearch,
      workOrderStatusFilter,
    ],
  );

  const updateTaskExecutionStatus = useCallback(
    async (taskId: string, action: 'start' | 'complete' | 'block' | 'reopen') => {
      if (!authHeaders || !selectedWorkOrderId) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(`${apiBaseUrl}/api/v2/amro/tasks?interface=update-task-step`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            task_id: taskId,
            step_id: `step-${taskId}`,
            action,
            performed_at: new Date().toISOString(),
            device_id: 'amro-ui-workspace',
          }),
        });
        const payload = await parseJsonSafe<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to update task step (${response.status})`);
        }
        await fetchTasksForWorkOrder(selectedWorkOrderId);
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to update task step');
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      fetchTasksForWorkOrder,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      selectedWorkOrderId,
    ],
  );

  const uploadTaskEvidence = useCallback(
    async (taskId: string) => {
      if (!authHeaders) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const now = Date.now();
        const response = await fetch(`${apiBaseUrl}/api/v2/amro/tasks?interface=upload-evidence`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            task_id: taskId,
            evidence_type: 'photo',
            media_ref: `amro://evidence/${taskId}/${now}`,
            checksum: `sha256-${now}`,
          }),
        });
        const payload = await parseJsonSafe<{ output?: { evidence_id?: string }; error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to upload evidence (${response.status})`);
        }
        const evidenceId = String(payload?.output?.evidence_id || `${taskId}-${now}`);
        setEvidenceChain((previous) => [
          ...previous,
          {
            id: evidenceId,
            entityType: 'task',
            entityId: taskId,
            hash: `sha256-${now}`,
            immutable: true,
            createdAt: new Date(now).toISOString(),
          },
        ]);
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to upload task evidence');
        return false;
      }
    },
    [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable],
  );

  const submitTaskSignature = useCallback(
    async (taskId: string) => {
      if (!authHeaders || !selectedQualification) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(`${apiBaseUrl}/api/v2/amro/tasks?interface=submit-signature`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            task_id: taskId,
            signer_id: selectedQualification.id,
            signature_payload: `sig-${selectedQualification.id}-${Date.now()}`,
            method: 'digital_certificate',
          }),
        });
        const payload = await parseJsonSafe<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to submit signature (${response.status})`);
        }
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to submit signature');
        return false;
      }
    },
    [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, selectedQualification],
  );

  const deleteSelectedWorkOrder = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/work-orders/${selectedWorkOrderId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (!response.ok && response.status !== 204) {
          const payload = await parseJsonSafe<{ error?: string }>(response);
          throw new Error(payload?.error || `Failed to delete work package (${response.status})`);
        }
      } catch (error) {
        const deleteIdempotencyKey = `wp-delete-${selectedWorkOrderId}-${Date.now()}`;
        const v2Response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders/${selectedWorkOrderId}`, {
          method: 'DELETE',
          headers: {
            ...authHeaders,
            'idempotency-key': deleteIdempotencyKey,
          },
          body: JSON.stringify({
            idempotency_key: deleteIdempotencyKey,
            decision_trace_id: `wp-delete-${selectedWorkOrderId}`,
            scope_context: {
              domain_id: 'amro',
            },
          }),
        });
        const v2Payload = await parseJsonSafe<{ error?: string }>(v2Response);
        if (!v2Response.ok) {
          throw new Error(v2Payload?.error || `Failed to delete work package (${v2Response.status})`);
        }
      }
      await fetchWorkOrders();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to delete work package');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchWorkOrders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkOrderId,
  ]);

  return {
    assets,
    workOrders,
    selectedWorkOrder,
    selectedWorkOrderId,
    setSelectedWorkOrderId,
    requiredAuthority,
    setRequiredAuthority,
    qualifications,
    selectedQualificationId,
    setSelectedQualificationId,
    selectedQualification,
    rulePacks,
    evidenceChain,
    materials,
    predictiveRecommendations,
    scheduleBoardRows,
    scheduleOptimizationRecommendations,
    workOrderReplanOptions,
    lastConfirmedReplanScheduleId,
    lastInventoryOptimizationRunId,
    lastProcurementSyncId,
    complianceGateModalOpen,
    setComplianceGateModalOpen,
    complianceExplainability,
    complianceAuditReplay,
    complianceAnomalyAlerts,
    selectedRegulatorProfile,
    setSelectedRegulatorProfile,
    regulatorProfilePack,
    obligationIngestionSummary,
    deferralDecision,
    selectedCertificationAuthorityProfile,
    setSelectedCertificationAuthorityProfile,
    qualificationStatusIndicator,
    certifyingPrivilegeValidated,
    latestCertificationDecision,
    expiryAutomationSummary,
    competencyAnalytics,
    authorityCertificationTemplate,
    isAmroAuthorized,
    canAdvanceLifecycle,
    canSignOff,
    canCreateWorkOrder,
    canDeleteWorkOrder,
    activeRole,
    complianceCoverage,
    materialsSummary,
    predictiveSummary,
    advanceWorkOrderLifecycle,
    loadingWorkOrders,
    workOrdersError,
    realtimeConnected,
    refreshWorkOrders: fetchWorkOrders,
    workOrderStatusFilter,
    setWorkOrderStatusFilter,
    workOrderSearch,
    setWorkOrderSearch,
    selectedSavedViewId,
    setSelectedSavedViewId: applySavedWorkOrderView,
    savedWorkOrderViews,
    saveCurrentWorkOrderView,
    createWorkOrder,
    cloneWorkOrderFromTemplate,
    assignSelectedWorkOrderToNextSlot,
    updateWorkOrderScheduling,
    toggleWorkOrderHold,
    holdAuditTrail,
    openWorkOrderDetails,
    softDeleteWorkOrder,
    restoreSoftDeletedWorkOrder,
    updateTaskExecutionStatus,
    uploadTaskEvidence,
    submitTaskSignature,
    acknowledgeScheduleUpdate,
    fetchScheduleOptimizationRecommendations,
    runWorkOrderReplanSimulation,
    confirmWorkOrderReplan,
    reservePartsAllocationForSelectedWorkOrder,
    processCriticalShortageResponse,
    applyRotableLlpTraceability,
    runInventoryOptimizationModel,
    syncSupplierEtaForSelectedWorkOrder,
    syncSupplierAsnAndErpProcurement,
    deleteSelectedWorkOrder,
    loadComplianceGateExplainability,
    loadAuditReplayTimeline,
    detectComplianceAnomalies,
    loadRegulatorProfilePack,
    ingestAdSbObligations,
    evaluateMelCdlDeferral,
    validateCertifyingPrivilege,
    submitCertificationDecision,
    runExpiryWarningAndSuspension,
    loadCompetencyAnalyticsDashboard,
    loadAuthorityCertificationTemplate,
  };
}
