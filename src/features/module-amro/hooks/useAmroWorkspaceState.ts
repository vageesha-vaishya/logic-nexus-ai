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

  const callComplianceInterface = useCallback(async (interfaceName: string, body: Record<string, unknown>) => {
    if (!authHeaders) {
      throw new Error('Authorization required');
    }
    const response = await fetch(`${apiBaseUrl}/api/v2/amro/compliance-gates?interface=${interfaceName}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    const payload = await parseJsonSafe<{ output?: Record<string, unknown>; error?: string }>(response);
    if (!response.ok) {
      throw new Error(payload?.error || `Compliance request failed (${response.status})`);
    }
    return payload;
  }, [apiBaseUrl, authHeaders]);

  const callCertificationInterface = useCallback(async (interfaceName: string, body: Record<string, unknown>) => {
    if (!authHeaders) {
      throw new Error('Authorization required');
    }
    const response = await fetch(`${apiBaseUrl}/api/v2/amro/certification?interface=${interfaceName}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    const payload = await parseJsonSafe<{ output?: Record<string, unknown>; error?: string }>(response);
    if (!response.ok) {
      throw new Error(payload?.error || `Certification request failed (${response.status})`);
    }
    return payload;
  }, [apiBaseUrl, authHeaders]);

  const loadComplianceGateExplainability = useCallback(async () => {
    if (!selectedWorkOrderId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('load-compliance-gate-explainability', {
        context: { type: 'work_order', id: selectedWorkOrderId },
        policy_version_snapshot: 'policy-v2026.03.22',
        required_obligations: [
          { obligation_id: `${selectedWorkOrderId}-ad-1`, fulfilled: true },
          { obligation_id: `${selectedWorkOrderId}-sb-1`, fulfilled: true },
        ],
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const explainabilityPanel = (output.explainability_panel || {}) as Record<string, unknown>;
      const blockers = Array.isArray(explainabilityPanel.blockers)
        ? explainabilityPanel.blockers.map((item) => String(item))
        : [];
      setComplianceExplainability({
        decision: String(output.decision || 'fail').toLowerCase() === 'pass' ? 'pass' : 'fail',
        blockerCount: Number((output.gate_modal as Record<string, unknown> | undefined)?.blocker_count || blockers.length || 0),
        blockers,
        policyVersion: String(explainabilityPanel.policy_version_snapshot || 'policy-v2026.03.22'),
      });
      setComplianceGateModalOpen(true);
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to load compliance explainability');
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkOrderId,
  ]);

  const loadAuditReplayTimeline = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('load-audit-replay-timeline', {
        export_filters: {
          capability: 'compliance-gates',
          action: 'evaluate-compliance-gate',
          format: 'csv',
          limit: 50,
        },
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const replayTimeline = (output.replay_timeline || {}) as Record<string, unknown>;
      const exportFilters = (output.export_filters || {}) as Record<string, unknown>;
      const events = Array.isArray(replayTimeline.events) ? replayTimeline.events : [];
      setComplianceAuditReplay({
        capability: String(exportFilters.capability || 'compliance-gates') as 'work-orders' | 'tasks' | 'compliance-gates',
        format: String(exportFilters.format || 'csv') as 'csv' | 'json',
        eventCount: Number(replayTimeline.event_count || events.length || 0),
        events: events.map((entry) => {
          const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
          return {
            sequence: Number(item.sequence || 0),
            recordId: String(item.record_id || ''),
            action: String(item.action || ''),
            createdAt: String(item.created_at || ''),
          };
        }),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to load audit replay timeline');
      return false;
    }
  }, [callComplianceInterface, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable]);

  const detectComplianceAnomalies = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('detect-compliance-anomalies', {
        detection_window: 'P30D',
        review_population: Math.max(10, complianceCoverage.activePacks * 15),
        overdue_obligations: Math.max(2, materialsSummary.shortageCount * 3),
        exception_escalations: Math.max(1, complianceCoverage.activePacks - 1),
        mel_cdl_deferral_count: Math.max(1, complianceCoverage.activePacks),
        anomaly_threshold: 0.2,
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const alertsRaw = Array.isArray(output.alerts) ? output.alerts : [];
      const alerts = alertsRaw.map((entry) => {
        const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
        return {
          severity: String(item.severity || 'low'),
          code: String(item.code || 'unclassified-anomaly'),
          metric: Number(item.metric || 0),
        };
      });
      setComplianceAnomalyAlerts(alerts);
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to detect compliance anomalies');
      return false;
    }
  }, [
    callComplianceInterface,
    complianceCoverage.activePacks,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    materialsSummary.shortageCount,
  ]);

  const loadRegulatorProfilePack = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('load-regulator-profile-pack', {
        regulator_profile: selectedRegulatorProfile,
        effective_at: new Date().toISOString(),
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const profilePack = (output.profile_pack || {}) as Record<string, unknown>;
      const obligations = Array.isArray(profilePack.obligations) ? profilePack.obligations.map((item) => String(item)) : [];
      const gateRules = Array.isArray(profilePack.gateRules) ? profilePack.gateRules.map((item) => String(item)) : [];
      setRegulatorProfilePack({
        regulatorProfile: selectedRegulatorProfile,
        obligations,
        gateRules,
      });
      const packVersion = selectedRegulatorProfile === 'FAA' ? '2026.1' : selectedRegulatorProfile === 'EASA' ? '2026.2' : '2026.1';
      setRulePacks((previous) => {
        const next = previous.map((pack) =>
          pack.authority === selectedRegulatorProfile ? { ...pack, ruleVersion: packVersion, active: true } : pack
        );
        if (next.some((pack) => pack.authority === selectedRegulatorProfile)) {
          return next;
        }
        return [...next, { id: `rc-${Date.now()}`, authority: selectedRegulatorProfile, ruleVersion: packVersion, active: true }];
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to load regulator profile pack');
      return false;
    }
  }, [callComplianceInterface, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, selectedRegulatorProfile]);

  const ingestAdSbObligations = useCallback(async () => {
    if (!selectedWorkOrderId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('ingest-ad-sb-obligations', {
        work_order_id: selectedWorkOrderId,
        regulator_profile: selectedRegulatorProfile,
        source_adapter: 'ad-sb-feed-v1',
        obligations: [
          {
            obligation_id: `${selectedWorkOrderId}-ad-001`,
            obligation_type: 'ad',
            reference_number: 'AD-2026-001',
            due_at: new Date(Date.now() + 86400000 * 10).toISOString(),
            applicability: { aircraft_id: selectedWorkOrder?.assetId || 'asset-1' },
          },
          {
            obligation_id: `${selectedWorkOrderId}-sb-001`,
            obligation_type: 'sb',
            reference_number: 'SB-A320-27-1121',
            due_at: new Date(Date.now() + 86400000 * 14).toISOString(),
            applicability: { aircraft_id: selectedWorkOrder?.assetId || 'asset-1' },
          },
        ],
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const summary = (output.mapping_summary || {}) as Record<string, unknown>;
      setObligationIngestionSummary({
        total: Number(summary.total || 0),
        adCount: Number(summary.ad_count || 0),
        sbCount: Number(summary.sb_count || 0),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to ingest AD/SB obligations');
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedRegulatorProfile,
    selectedWorkOrder?.assetId,
    selectedWorkOrderId,
  ]);

  const evaluateMelCdlDeferral = useCallback(async () => {
    if (!selectedWorkOrderId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('evaluate-mel-cdl-deferral', {
        work_order_id: selectedWorkOrderId,
        deferral_type: 'mel',
        item_reference: `${selectedWorkOrderId}-mel-001`,
        deferral_category: 'B',
        dispatch_conditions: ['operational-limitation-logged', 'next-flight-crew-briefed'],
        expires_at: new Date(Date.now() + 3600000 * 36).toISOString(),
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const actions = Array.isArray(output.required_actions) ? output.required_actions.map((item) => String(item)) : [];
      setDeferralDecision({
        decision: String(output.deferral_decision || 'reject'),
        actions,
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to evaluate MEL/CDL deferral');
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkOrderId,
  ]);

  const validateCertifyingPrivilege = useCallback(async () => {
    if (!selectedQualification || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('validate-certifying-authority', {
        actor_id: selectedQualification.id,
        timestamp: new Date().toISOString(),
        aircraft_scope: [selectedWorkOrder?.assetId || 'asset-1'],
        maintenance_scope: ['line'],
        required_privileges: ['release_approval'],
        authority: {
          valid_from: new Date(Date.now() - 86_400_000).toISOString(),
          valid_to: selectedQualification.validUntil,
          aircraft_scope: ['*'],
          maintenance_scope: ['line', 'base'],
          can_certify_release: selectedQualification.signOffAuthority,
          granted_privileges: selectedQualification.signOffAuthority ? ['release_approval'] : [],
        },
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      setCertifyingPrivilegeValidated(String(output.validation_result || '').toLowerCase() === 'valid');
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setCertifyingPrivilegeValidated(false);
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to validate certifying privilege');
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedQualification,
    selectedWorkOrder?.assetId,
  ]);

  const submitCertificationDecision = useCallback(async (decision: CertificationDecisionOption) => {
    if (!selectedWorkOrderId || !selectedQualification || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('submit-certification-decision', {
        work_order_id: selectedWorkOrderId,
        decision,
        unresolved_blockers: ['none'],
        defer_reason: decision === 'defer' ? 'Additional engineering review required' : undefined,
        follow_up_due_at: decision === 'defer' ? new Date(Date.now() + 172_800_000).toISOString() : undefined,
        signatures: [
          {
            signer_id: selectedQualification.id,
            mandatory: true,
            signature: selectedQualification.signOffAuthority ? `sig-${selectedQualification.id}-${Date.now()}` : '',
          },
        ],
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const workflow = (output.workflow || {}) as Record<string, unknown>;
      setLatestCertificationDecision({
        actionStatus: String(output.action_status || 'pending'),
        nextAction: String(workflow.next_action || ''),
        blockers: Array.isArray(output.blockers) ? output.blockers.map((item) => String(item)) : [],
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to submit certification decision');
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedQualification,
    selectedWorkOrderId,
  ]);

  const runExpiryWarningAndSuspension = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('automate-expiry-suspension', {
        timestamp: new Date().toISOString(),
        warning_window_days: 30,
        qualifications: qualifications.map((qualification) => ({
          id: qualification.id,
          valid_to: qualification.validUntil,
          can_certify_release: qualification.signOffAuthority,
          status: 'active',
        })),
      });
      const summary = ((payload?.output || {}) as Record<string, unknown>).summary as Record<string, unknown> | undefined;
      setExpiryAutomationSummary({
        warningCount: Number(summary?.warning_count || 0),
        suspensionCount: Number(summary?.suspension_count || 0),
        evaluatedCount: Number(summary?.evaluated_count || 0),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to run expiry warning automation');
      return false;
    }
  }, [callCertificationInterface, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, qualifications]);

  const loadCompetencyAnalyticsDashboard = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('load-competency-analytics-dashboard', {
        qualifications: qualifications.map((qualification) => ({
          id: qualification.id,
          authority_level: qualification.authorityLevel,
          valid_to: qualification.validUntil,
          can_certify_release: qualification.signOffAuthority,
        })),
      });
      const output = (payload?.output || {}) as Record<string, unknown>;
      const cards = (output.kpi_cards || {}) as Record<string, unknown>;
      const distribution = (output.authority_distribution || {}) as Record<string, unknown>;
      setCompetencyAnalytics({
        totalQualifiedStaff: Number(cards.total_qualified_staff || 0),
        activeCertifiers: Number(cards.active_certifiers || 0),
        warningWindowStaff: Number(cards.warning_window_staff || 0),
        suspendedCertifiers: Number(cards.suspended_certifiers || 0),
        authorityDistribution: Object.keys(distribution).reduce<Record<string, number>>((acc, key) => {
          acc[key] = Number(distribution[key] || 0);
          return acc;
        }, {}),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to load competency analytics');
      return false;
    }
  }, [callCertificationInterface, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, qualifications]);

  const loadAuthorityCertificationTemplate = useCallback(async () => {
    if (isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('load-authority-certification-template', {
        authority_profile: selectedCertificationAuthorityProfile,
      });
      const template = (((payload?.output || {}) as Record<string, unknown>).template || {}) as Record<string, unknown>;
      const deferPolicy = (template.defer_policy || {}) as Record<string, unknown>;
      setAuthorityCertificationTemplate({
        templateId: String(template.template_id || ''),
        authorityProfile: selectedCertificationAuthorityProfile,
        requiredSignatures: Array.isArray(template.required_signatures)
          ? template.required_signatures.map((item) => String(item))
          : [],
        mandatoryChecks: Array.isArray(template.mandatory_checks)
          ? template.mandatory_checks.map((item) => String(item))
          : [],
        deferMaxDays: Number(deferPolicy.max_defer_days || 0),
      });
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to load authority certification template');
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedCertificationAuthorityProfile,
  ]);

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

  const reservePartsAllocationForSelectedWorkOrder = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId || materials.length === 0) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const demandLines = materials.slice(0, 2).map((material, index) => ({
        part_number: material.partNumber,
        quantity: index === 0 ? 1 : 2,
        serial: index === 0 ? `${material.id}-serial` : undefined,
      }));
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders?interface=reserve-parts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          work_order_id: selectedWorkOrderId,
          demand_lines: demandLines,
        }),
      });
      const payload = await parseJsonSafe<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to reserve parts (${response.status})`);
      }
      await fetchModuleSurfaces();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to reserve parts');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchModuleSurfaces,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    materials,
    selectedWorkOrderId,
  ]);

  const processCriticalShortageResponse = useCallback(async () => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const shortageMaterial = materials.find((item) => item.reservationStatus === 'shortage') || materials[0];
      if (!shortageMaterial) return false;
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders?interface=process-shortage-response`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          shortage_id: shortageMaterial.id,
          action: 'escalate',
          supplier_ref: shortageMaterial.partNumber,
        }),
      });
      const payload = await parseJsonSafe<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to process shortage response (${response.status})`);
      }
      await fetchModuleSurfaces();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to process shortage response');
      return false;
    }
  }, [apiBaseUrl, authHeaders, fetchModuleSurfaces, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, materials]);

  const applyRotableLlpTraceability = useCallback(async (materialId: string) => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const targetMaterial = materials.find((item) => item.id === materialId);
      if (!targetMaterial) return false;
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders?interface=trace-rotable-llp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          component_id: targetMaterial.id,
          part_number: targetMaterial.partNumber,
          serial_number: `${targetMaterial.id}-serial`,
          rotable_status: targetMaterial.rotableStatus,
          llp_remaining_cycles: targetMaterial.llpRemainingCycles,
          traceability_action: targetMaterial.rotableStatus === 'quarantined' ? 'release' : 'verify',
        }),
      });
      const payload = await parseJsonSafe<{ output?: { traceability_status?: 'verified' | 'quarantined' | 'released' }; error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to apply traceability controls (${response.status})`);
      }
      const nextStatus = payload?.output?.traceability_status || 'verified';
      setMaterials((previous) =>
        previous.map((material) =>
          material.id === materialId
            ? {
                ...material,
                traceabilityStatus: nextStatus,
                rotableStatus: nextStatus === 'quarantined' ? 'quarantined' : 'serviceable',
              }
            : material,
        ),
      );
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to apply rotable/LLP traceability');
      return false;
    }
  }, [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, materials]);

  const runInventoryOptimizationModel = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders?interface=run-inventory-optimization`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          work_order_id: selectedWorkOrderId,
          forecast_signal_ids: predictiveRecommendations.slice(0, 3).map((item) => item.id),
          optimization_window: 'P14D',
        }),
      });
      const payload = await parseJsonSafe<{ output?: { optimization_run_id?: string }; error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to run inventory optimization (${response.status})`);
      }
      setLastInventoryOptimizationRunId(String(payload?.output?.optimization_run_id || ''));
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to run inventory optimization');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    predictiveRecommendations,
    selectedWorkOrderId,
  ]);

  const syncSupplierEtaForSelectedWorkOrder = useCallback(async () => {
    if (!authHeaders || !selectedWorkOrderId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const targetMaterial = materials.find((item) => item.reservationStatus === 'shortage') || materials[0];
      if (!targetMaterial) return false;
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders?interface=sync-supplier-eta`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          supplier_event_id: `supplier-eta-${Date.now()}`,
          part_number: targetMaterial.partNumber,
          eta: new Date(Date.now() + 86400000).toISOString(),
          quantity_confirmed: targetMaterial.reservationStatus === 'shortage' ? 0 : 1,
          supplier_source: 'vendor_portal',
          impacted_work_orders: [selectedWorkOrderId],
        }),
      });
      const payload = await parseJsonSafe<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to sync supplier ETA (${response.status})`);
      }
      await fetchModuleSurfaces();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to sync supplier ETA');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchModuleSurfaces,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    materials,
    selectedWorkOrderId,
  ]);

  const syncSupplierAsnAndErpProcurement = useCallback(async () => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-orders?interface=sync-supplier-asn-erp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          asn_event_id: `asn-${Date.now()}`,
          procurement_source: 'sap-pm',
          po_number: `PO-${Date.now()}`,
          line_items: materials.slice(0, 2).map((material) => ({
            part_number: material.partNumber,
            qty: material.reservationStatus === 'shortage' ? 2 : 1,
          })),
          impacted_work_orders: selectedWorkOrderId ? [selectedWorkOrderId] : [],
        }),
      });
      const payload = await parseJsonSafe<{ output?: { procurement_sync_id?: string }; error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to sync supplier ASN and ERP procurement (${response.status})`);
      }
      setLastProcurementSyncId(String(payload?.output?.procurement_sync_id || ''));
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkOrdersError(error instanceof Error ? error.message : 'Failed to sync supplier ASN and ERP procurement');
      return false;
    }
  }, [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, materials, selectedWorkOrderId]);

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
