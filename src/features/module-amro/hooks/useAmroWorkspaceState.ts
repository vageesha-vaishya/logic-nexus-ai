import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDomain } from '@/contexts/DomainContext';
import type {
  AmroAssetRegistryRecord,
  AmroAuthorityLevel,
  AmroComplianceRulePack,
  AmroEvidenceRecord,
  AmroMaterialPlanningRecord,
  AmroPredictiveRecommendation,
  AmroQualification,
  AmroWorkPackage,
  AmroWorkPackageLifecycleStage,
} from '../workspace/amroWorkspaceModel';
import {
  buildComplianceCoverage,
  buildMaterialsPlanningSummary,
  buildPredictiveMaintenanceSummary,
  canPerformAuthoritySignOff,
  canTransitionWorkPackageLifecycle,
  getNextWorkPackageLifecycleStage,
} from '../workspace/amroWorkspaceModel';

const initialAssets: AmroAssetRegistryRecord[] = [
  {
    id: 'asset-1',
    assetTag: 'A320-9M-ANX',
    assetType: 'aircraft',
    serialNumber: 'MSN-20411',
    configurationState: 'Line maintenance configuration baseline v12',
    tenantId: 'tenant-ops-01',
    franchiseId: 'franchise-gulf-01',
  },
  {
    id: 'asset-2',
    assetTag: 'CFM56-7B-ENG-442',
    assetType: 'engine',
    serialNumber: 'ENG-SN-884214',
    configurationState: 'Engine LLP tracking profile v7',
    tenantId: 'tenant-ops-01',
    franchiseId: 'franchise-gulf-01',
  },
  {
    id: 'asset-3',
    assetTag: 'SER-COMP-ATA27-991',
    assetType: 'serialized_component',
    serialNumber: 'CMP-SN-112390',
    configurationState: 'Flight control component revision C',
    tenantId: 'tenant-ops-01',
    franchiseId: 'franchise-gulf-01',
  },
  {
    id: 'asset-4',
    assetTag: 'HEAVY-RIG-DOCK-10',
    assetType: 'heavy_asset',
    serialNumber: 'HA-SN-44291',
    configurationState: 'Hangar dock tooling calibration active',
    tenantId: 'tenant-ops-01',
    franchiseId: 'franchise-gulf-01',
  },
];

type ApiWorkPackage = {
  id: string;
  aircraft_id: string;
  work_order_number?: string;
  work_package_number?: string;
  status: string;
  title: string;
  maintenance_type?: string;
};

type ApiTask = {
  id: string;
  work_package_id: string;
  title: string;
  status: string;
};

type ApiAsset = {
  id: string;
  tenant_id: string;
  franchise_id?: string | null;
  registration: string;
  aircraft_type: string;
  serial_number: string;
  status: string;
};

type ApiQualification = {
  id: string;
  qualification_name: string;
  rating: string;
  can_certify_release: boolean;
  expiration_date?: string | null;
};

type ApiComplianceSummary = {
  authorityCoverage?: string[];
  activeRulePacks?: number;
};

type ApiEvidence = {
  id: string;
  entity_type: 'work_package' | 'task' | 'inspection' | 'release';
  entity_id: string;
  hash: string;
  immutable: boolean;
  created_at: string;
};

type ApiMaterial = {
  id: string;
  part_number: string;
  status: 'pending' | 'ordered' | 'received' | 'installed' | 'cancelled' | 'returned';
  action: 'install' | 'remove' | 'inspect' | 'repair';
  received_date?: string | null;
};

type ApiRecommendation = {
  id: string;
  digital_twin_reference: string;
  risk_score: number;
  trigger: 'telemetry' | 'calendar' | 'reliability';
  recommendation: string;
};

type ComplianceRegulatorProfile = 'FAA' | 'EASA' | 'CAAC';

type ApiScheduleRow = {
  schedule_id: string;
  work_package_id: string;
  station_code: string;
  slot_start: string;
  slot_end: string;
  assigned_team_size: number;
  capacity: number;
  status: string;
};

type ApiScheduleOptimizationRecommendation = {
  recommendation_id: string;
  title: string;
  station_code: string;
  schedule_date: string;
  expected_delay_reduction_pct: number;
  confidence: number;
  rationale: string;
};

type ApiEnvelope<T> = {
  data: T;
};

type V2WorkPackageItem = {
  id: string;
  code?: string;
  status: string;
};

type V2TaskItem = {
  id: string;
  workPackageId: string;
  title: string;
  status: string;
};

type V2SavedWorkPackageView = {
  id: string;
  name: string;
  filters: {
    status: string;
    search: string;
  };
};

const DEFAULT_WORK_PACKAGE_SAVED_VIEW: V2SavedWorkPackageView = {
  id: 'default-all',
  name: 'All Work Packages',
  filters: {
    status: 'all',
    search: '',
  },
};

type V2SchedulesResponse = {
  output?: {
    schedules?: ApiScheduleRow[];
  };
  error?: string;
};

type V2WorkPackagesResponse = {
  data?: {
    workPackages?: V2WorkPackageItem[];
  };
  savedViews?: V2SavedWorkPackageView[];
  error?: string;
};

type V2ScheduleOptimizationResponse = {
  output?: {
    recommendations?: ApiScheduleOptimizationRecommendation[];
  };
  error?: string;
};

type ComplianceExplainabilityState = {
  decision: 'pass' | 'fail';
  blockerCount: number;
  blockers: string[];
  policyVersion: string;
};

type ComplianceAuditReplayState = {
  capability: 'work-packages' | 'tasks' | 'compliance-gates';
  format: 'csv' | 'json';
  eventCount: number;
  events: Array<{ sequence: number; recordId: string; action: string; createdAt: string }>;
};

type ComplianceAnomalyAlert = {
  severity: string;
  code: string;
  metric: number;
};

type ComplianceRegulatorProfilePackState = {
  regulatorProfile: ComplianceRegulatorProfile;
  obligations: string[];
  gateRules: string[];
};

type CertificationAuthorityProfile = 'FAA' | 'EASA' | 'CAAC';

type CertificationDecisionOption = 'approve' | 'reject' | 'defer';

type CertificationQualificationStatusState = {
  lifecycle: 'active' | 'warning' | 'suspended';
  daysUntilExpiry: number;
  reason: string;
};

type CertificationDecisionState = {
  actionStatus: string;
  nextAction: string;
  blockers: string[];
};

type CertificationExpiryAutomationState = {
  warningCount: number;
  suspensionCount: number;
  evaluatedCount: number;
};

type CertificationCompetencyAnalyticsState = {
  totalQualifiedStaff: number;
  activeCertifiers: number;
  warningWindowStaff: number;
  suspendedCertifiers: number;
  authorityDistribution: Record<string, number>;
};

type CertificationTemplateState = {
  templateId: string;
  authorityProfile: CertificationAuthorityProfile;
  requiredSignatures: string[];
  mandatoryChecks: string[];
  deferMaxDays: number;
};

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw.trim()) {
    return null;
  }
  return JSON.parse(raw) as T;
}

function isNetworkConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return normalized.includes('failed to fetch') || normalized.includes('networkerror') || normalized.includes('econnrefused');
}

function mapV2StatusToV1Status(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'planned') return 'planning';
  if (normalized === 'blocked') return 'on_hold';
  return normalized;
}

function getAmroApiBaseUrl(): string {
  const runtimeEnv =
    typeof window !== 'undefined'
      ? ((window as unknown as { __ENV__?: Record<string, unknown>; __APP_CONFIG__?: Record<string, unknown> }).__ENV__ ||
        (window as unknown as { __APP_CONFIG__?: Record<string, unknown> }).__APP_CONFIG__ ||
        {})
      : {};
  const rawBase = String(import.meta.env.VITE_AMRO_API_BASE_URL || runtimeEnv.VITE_AMRO_API_BASE_URL || '/api/amro').trim();
  const normalizedBase = rawBase === '' || rawBase === '/' ? '/api/amro' : rawBase;
  const withoutTrailingSlash = normalizedBase.replace(/\/$/, '');
  const withoutLegacyProxyPrefix = withoutTrailingSlash.replace(/\/api\/amro$/i, '').replace(/\/api$/i, '');
  return withoutLegacyProxyPrefix === '/' ? '' : withoutLegacyProxyPrefix;
}

function mapStatusToLifecycle(status: string): AmroWorkPackageLifecycleStage {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'approved') return 'plan';
  if (normalized === 'planning') return 'create';
  if (normalized === 'scheduled') return 'schedule';
  if (normalized === 'blocked' || normalized === 'on_hold') return 'blocked';
  if (normalized === 'in_progress') return 'execute';
  if (normalized === 'completed' || normalized === 'closed' || normalized === 'cancelled') return 'close';
  return 'create';
}

function mapLifecycleToStatus(stage: AmroWorkPackageLifecycleStage): string {
  if (stage === 'create') return 'planning';
  if (stage === 'plan') return 'approved';
  if (stage === 'schedule') return 'scheduled';
  if (stage === 'execute') return 'in_progress';
  if (stage === 'blocked') return 'blocked';
  return 'closed';
}

function sanitizeSavedWorkPackageViews(views: unknown): V2SavedWorkPackageView[] {
  if (!Array.isArray(views)) {
    return [DEFAULT_WORK_PACKAGE_SAVED_VIEW];
  }
  const dedupe = new Map<string, V2SavedWorkPackageView>();
  views.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const item = entry as Partial<V2SavedWorkPackageView>;
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim();
    if (!id || !name) {
      return;
    }
    dedupe.set(id, {
      id,
      name,
      filters: {
        status: String(item.filters?.status || 'all').trim() || 'all',
        search: String(item.filters?.search || ''),
      },
    });
  });
  if (!dedupe.has(DEFAULT_WORK_PACKAGE_SAVED_VIEW.id)) {
    dedupe.set(DEFAULT_WORK_PACKAGE_SAVED_VIEW.id, DEFAULT_WORK_PACKAGE_SAVED_VIEW);
  }
  return Array.from(dedupe.values());
}

function resolveRoleTransitionTargets(role: string): string[] {
  if (role === 'tenant_admin') return ['planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled'];
  if (role === 'planner') return ['planning', 'scheduled', 'blocked'];
  if (role === 'engineer') return ['scheduled', 'in_progress', 'blocked'];
  if (role === 'technician') return ['in_progress'];
  if (role === 'inspector') return ['completed', 'blocked'];
  return [];
}

const initialQualifications: AmroQualification[] = [
  {
    id: 'qual-1',
    staffName: 'Alex Santos',
    authorityLevel: 'supervisor',
    roleConstraint: 'B1 mechanical certifier',
    signOffAuthority: true,
    validUntil: '2027-05-01T00:00:00.000Z',
  },
  {
    id: 'qual-2',
    staffName: 'Meera Patel',
    authorityLevel: 'compliance',
    roleConstraint: 'Regulatory release verifier',
    signOffAuthority: true,
    validUntil: '2028-02-15T00:00:00.000Z',
  },
  {
    id: 'qual-3',
    staffName: 'Jonah Wright',
    authorityLevel: 'technician',
    roleConstraint: 'Powerplant technician',
    signOffAuthority: false,
    validUntil: '2026-09-01T00:00:00.000Z',
  },
];

const initialRulePacks: AmroComplianceRulePack[] = [
  { id: 'rc-1', authority: 'FAA', ruleVersion: '2026.1', active: true },
  { id: 'rc-2', authority: 'EASA', ruleVersion: '2026.2', active: true },
  { id: 'rc-3', authority: 'CAAC', ruleVersion: '2026.1', active: true },
  { id: 'rc-4', authority: 'SACAA', ruleVersion: '2026.1', active: true },
  { id: 'rc-5', authority: 'ISO_55000', ruleVersion: '2014.9', active: true },
];

const initialEvidenceChain: AmroEvidenceRecord[] = [
  { id: 'ev-1', entityType: 'work_package', entityId: 'wp-1', hash: 'sha256:8df2a39aaad9', immutable: true, createdAt: '2026-03-20T11:40:00.000Z' },
  { id: 'ev-2', entityType: 'task', entityId: 'task-3', hash: 'sha256:9ab12cdaa8be', immutable: true, createdAt: '2026-03-20T12:30:00.000Z' },
  { id: 'ev-3', entityType: 'inspection', entityId: 'task-4', hash: 'sha256:5a72c3ef8a71', immutable: true, createdAt: '2026-03-20T12:55:00.000Z' },
];

const initialMaterials: AmroMaterialPlanningRecord[] = [
  {
    id: 'mat-1',
    partNumber: 'PN-ATA72-889',
    reservationStatus: 'reserved',
    repairAction: 'install',
    supplierEta: '2026-03-24T09:00:00.000Z',
    shortageSeverity: 'none',
    etaStatus: 'on_time',
    rotableStatus: 'serviceable',
    llpRemainingCycles: 1240,
    traceabilityStatus: 'verified',
  },
  {
    id: 'mat-2',
    partNumber: 'PN-ATA27-190',
    reservationStatus: 'pending',
    repairAction: 'repair',
    supplierEta: '2026-03-26T09:00:00.000Z',
    shortageSeverity: 'watch',
    etaStatus: 'at_risk',
    rotableStatus: 'serviceable',
    llpRemainingCycles: 620,
    traceabilityStatus: 'verified',
  },
  {
    id: 'mat-3',
    partNumber: 'PN-ATA32-672',
    reservationStatus: 'shortage',
    repairAction: 'remove',
    supplierEta: '2026-03-29T09:00:00.000Z',
    shortageSeverity: 'critical',
    etaStatus: 'late',
    rotableStatus: 'quarantined',
    llpRemainingCycles: 420,
    traceabilityStatus: 'quarantined',
  },
];

const initialPredictiveRecommendations: AmroPredictiveRecommendation[] = [
  {
    id: 'pr-1',
    digitalTwinReference: 'DT-A320-9M-ANX',
    riskScore: 0.87,
    trigger: 'telemetry',
    recommendation: 'Advance hydraulic line inspection before next 50-cycle check',
  },
  {
    id: 'pr-2',
    digitalTwinReference: 'DT-CFM56-7B-442',
    riskScore: 0.72,
    trigger: 'reliability',
    recommendation: 'Schedule compressor wash at next available night stop',
  },
  {
    id: 'pr-3',
    digitalTwinReference: 'DT-COMP-ATA27-991',
    riskScore: 0.65,
    trigger: 'calendar',
    recommendation: 'Run calibration verification in upcoming maintenance window',
  },
];

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
  const [apiUnavailableUntil, setApiUnavailableUntil] = useState<number>(0);
  const [hasV1WorkPackageConnectivity, setHasV1WorkPackageConnectivity] = useState<boolean>(false);
  const [workPackages, setWorkPackages] = useState<AmroWorkPackage[]>([]);
  const [selectedWorkPackageId, setSelectedWorkPackageId] = useState<string>('');
  const [loadingWorkPackages, setLoadingWorkPackages] = useState<boolean>(false);
  const [workPackagesError, setWorkPackagesError] = useState<string | null>(null);
  const [workPackageStatusFilter, setWorkPackageStatusFilter] = useState<string>('all');
  const [workPackageSearch, setWorkPackageSearch] = useState<string>('');
  const [selectedSavedViewId, setSelectedSavedViewId] = useState<string>(DEFAULT_WORK_PACKAGE_SAVED_VIEW.id);
  const [savedWorkPackageViews, setSavedWorkPackageViews] = useState<V2SavedWorkPackageView[]>([DEFAULT_WORK_PACKAGE_SAVED_VIEW]);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [requiredAuthority, setRequiredAuthority] = useState<AmroAuthorityLevel>('supervisor');
  const [selectedQualificationId, setSelectedQualificationId] = useState<string>(initialQualifications[0]?.id ?? '');
  const [qualifications, setQualifications] = useState<AmroQualification[]>(initialQualifications);
  const [rulePacks, setRulePacks] = useState<AmroComplianceRulePack[]>(initialRulePacks);
  const [evidenceChain, setEvidenceChain] = useState<AmroEvidenceRecord[]>(initialEvidenceChain);
  const [materials, setMaterials] = useState<AmroMaterialPlanningRecord[]>(initialMaterials);
  const [predictiveRecommendations, setPredictiveRecommendations] = useState<AmroPredictiveRecommendation[]>(initialPredictiveRecommendations);
  const [scheduleBoardRows, setScheduleBoardRows] = useState<ApiScheduleRow[]>([]);
  const [scheduleOptimizationRecommendations, setScheduleOptimizationRecommendations] = useState<ApiScheduleOptimizationRecommendation[]>([]);
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

  const isApiTemporarilyUnavailable = useCallback(() => Date.now() < apiUnavailableUntil, [apiUnavailableUntil]);

  const markApiTemporarilyUnavailable = useCallback(() => {
    setApiUnavailableUntil(Date.now() + 30000);
    setRealtimeConnected(false);
  }, []);

  useEffect(() => {
    if (!isAwaitingAmroDomainActivation) {
      return;
    }
    void setDomain('AMRO').catch(() => {
      setWorkPackagesError('AMRO domain context required - switch to AMRO domain');
    });
  }, [isAwaitingAmroDomainActivation, setDomain]);

  const mapWorkPackageRecord = useCallback((item: { id: string; packageNumber: string; status: string; assetId: string }) => ({
    id: item.id,
    packageNumber: item.packageNumber,
    lifecycleStage: mapStatusToLifecycle(item.status),
    assetId: item.assetId,
    tasks: [],
  }), []);

  const fetchWorkPackages = useCallback(async () => {
    if (!authHeaders) {
      setWorkPackages([]);
      setSelectedWorkPackageId('');
      return;
    }
    if (!hasAmroAccess) {
      setWorkPackagesError(
        isAwaitingAmroDomainActivation ? 'Switching to AMRO domain context...' : amroAccessErrorMessage,
      );
      return;
    }
    if (isApiTemporarilyUnavailable()) {
      return;
    }
    setLoadingWorkPackages(true);
    setWorkPackagesError(null);
    try {
      let next: AmroWorkPackage[] = [];
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/work-packages`, { headers: authHeaders });
        const payload = await parseJsonSafe<ApiEnvelope<ApiWorkPackage[]> & { error?: string }>(response);
        if (!response.ok || !Array.isArray(payload?.data)) {
          throw new Error(payload?.error || `Failed to load work packages (${response.status})`);
        }
        setHasV1WorkPackageConnectivity(true);
        next = payload.data.map((item) => mapWorkPackageRecord({
          id: item.id,
          packageNumber: item.work_order_number || item.work_package_number || item.id,
          status: item.status,
          assetId: item.aircraft_id,
        })) as AmroWorkPackage[];
      } catch (error) {
        if (!isNetworkConnectivityError(error)) {
          throw error;
        }
        setHasV1WorkPackageConnectivity(false);
        const query = new URLSearchParams();
        if (workPackageStatusFilter !== 'all') {
          query.set('status', workPackageStatusFilter);
        }
        if (workPackageSearch.trim()) {
          query.set('search', workPackageSearch.trim());
        }
        if (selectedSavedViewId && selectedSavedViewId !== 'default-all') {
          query.set('saved_view', selectedSavedViewId);
        }
        const endpoint = query.size
          ? `${apiBaseUrl}/api/v2/amro/work-packages?${query.toString()}`
          : `${apiBaseUrl}/api/v2/amro/work-packages`;
        const v2Response = await fetch(endpoint, { headers: authHeaders });
        const v2Payload = await parseJsonSafe<V2WorkPackagesResponse>(v2Response);
        const v2Items = v2Payload?.data?.workPackages;
        if (!v2Response.ok || !Array.isArray(v2Items)) {
          throw new Error(v2Payload?.error || `Failed to load work packages (${v2Response.status})`);
        }
        if (Array.isArray(v2Payload?.savedViews) && v2Payload.savedViews.length > 0) {
          setSavedWorkPackageViews(sanitizeSavedWorkPackageViews(v2Payload.savedViews));
        }
        next = v2Items.map((item) =>
          mapWorkPackageRecord({
            id: item.id,
            packageNumber: item.code || item.id,
            status: mapV2StatusToV1Status(item.status),
            assetId: '',
          }),
        ) as AmroWorkPackage[];
      }
      if (hasV1WorkPackageConnectivity) {
        const normalizedSearch = workPackageSearch.trim().toLowerCase();
        next = next.filter((item) => {
          const status = mapLifecycleToStatus(item.lifecycleStage);
          const statusMatch = workPackageStatusFilter === 'all' ? true : status === workPackageStatusFilter;
          const searchMatch = !normalizedSearch
            ? true
            : item.packageNumber.toLowerCase().includes(normalizedSearch) || item.id.toLowerCase().includes(normalizedSearch);
          return statusMatch && searchMatch;
        });
      }
      setWorkPackages(next);
      setSelectedWorkPackageId((previous) => {
        if (previous && next.some((item) => item.id === previous)) {
          return previous;
        }
        return next[0]?.id || '';
      });
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load work packages');
    } finally {
      setLoadingWorkPackages(false);
    }
  }, [
    apiBaseUrl,
    authHeaders,
    hasV1WorkPackageConnectivity,
    isApiTemporarilyUnavailable,
    mapWorkPackageRecord,
    markApiTemporarilyUnavailable,
    selectedSavedViewId,
    hasAmroAccess,
    amroAccessErrorMessage,
    workPackageSearch,
    workPackageStatusFilter,
    isAwaitingAmroDomainActivation,
  ]);

  const fetchModuleSurfaces = useCallback(async () => {
    if (!authHeaders) {
      return;
    }
    if (!hasAmroAccess) {
      setWorkPackagesError(
        isAwaitingAmroDomainActivation ? 'Switching to AMRO domain context...' : amroAccessErrorMessage,
      );
      return;
    }
    if (isApiTemporarilyUnavailable()) {
      return;
    }
    try {
      const [
        assetsResponse,
        qualificationsResponse,
        complianceResponse,
        evidenceResponse,
        materialsResponse,
        recommendationsResponse,
      ] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/assets`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/v1/qualifications`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/v1/compliance/summary`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/v1/evidence`, { headers: authHeaders }),
        selectedWorkPackageId
          ? fetch(`${apiBaseUrl}/api/v1/work-packages/${selectedWorkPackageId}/materials`, { headers: authHeaders })
          : Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 })),
        fetch(`${apiBaseUrl}/api/v1/forecast/recommendations`, { headers: authHeaders }),
      ]);

      if (assetsResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiAsset[]>>(assetsResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setAssets(
            payload.data.map((item) => ({
              id: item.id,
              assetTag: item.registration,
              assetType: item.aircraft_type.toLowerCase().includes('engine') ? 'engine' : 'aircraft',
              serialNumber: item.serial_number,
              configurationState: `Operational status: ${item.status}`,
              tenantId: item.tenant_id,
              franchiseId: item.franchise_id || 'unassigned',
            })),
          );
          setAssetsLoadedFromApi(true);
        } else {
          setAssetsLoadedFromApi(false);
        }
      } else {
        setAssetsLoadedFromApi(false);
      }

      if (qualificationsResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiQualification[]>>(qualificationsResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          const mapped = payload.data.map((item) => ({
            id: item.id,
            staffName: item.qualification_name,
            authorityLevel: (String(item.rating || '').toLowerCase() === 'compliance'
              ? 'compliance'
              : String(item.rating || '').toLowerCase() === 'engineering'
                ? 'engineering'
                : String(item.rating || '').toLowerCase() === 'qa'
                  ? 'qa'
                  : String(item.rating || '').toLowerCase() === 'supervisor'
                    ? 'supervisor'
                    : 'technician') as AmroAuthorityLevel,
            roleConstraint: item.qualification_name,
            signOffAuthority: item.can_certify_release,
            validUntil: item.expiration_date || new Date(Date.now() + 86400000 * 365).toISOString(),
          }));
          setQualifications(mapped);
          setSelectedQualificationId((previous) => previous || mapped[0]?.id || '');
        }
      }

      if (complianceResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiComplianceSummary>>(complianceResponse);
        const authorities = payload?.data?.authorityCoverage ?? [];
        const activeCount = payload?.data?.activeRulePacks ?? authorities.length;
        const mappedAuthorities = authorities.length > 0 ? authorities : ['FAA', 'EASA'];
        const mappedRulePacks = mappedAuthorities.map((authority, index) => ({
          id: `rule-pack-${index + 1}`,
          authority: (authority as AmroComplianceRulePack['authority']) || 'FAA',
          ruleVersion: '2026.1',
          active: index < activeCount,
        }));
        if (mappedRulePacks.length > 0) {
          setRulePacks(mappedRulePacks);
        }
      }

      if (evidenceResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiEvidence[]>>(evidenceResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setEvidenceChain(
            payload.data.map((item) => ({
              id: item.id,
              entityType: item.entity_type,
              entityId: item.entity_id,
              hash: item.hash,
              immutable: item.immutable,
              createdAt: item.created_at,
            })),
          );
        }
      }

      if (materialsResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiMaterial[]>>(materialsResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setMaterials(
            payload.data.map((item) => ({
              id: item.id,
              partNumber: item.part_number,
              reservationStatus:
                item.status === 'pending' || item.status === 'ordered'
                  ? 'pending'
                  : item.status === 'received' || item.status === 'installed'
                    ? 'reserved'
                    : 'shortage',
              repairAction: item.action === 'inspect' ? 'repair' : item.action,
              supplierEta: item.received_date || new Date(Date.now() + 86400000 * 3).toISOString(),
              shortageSeverity:
                item.status === 'cancelled' || item.status === 'returned'
                  ? 'critical'
                  : item.status === 'pending' || item.status === 'ordered'
                    ? 'watch'
                    : 'none',
              etaStatus:
                item.status === 'cancelled' || item.status === 'returned'
                  ? 'late'
                  : item.status === 'pending' || item.status === 'ordered'
                    ? 'at_risk'
                    : 'on_time',
              rotableStatus:
                item.status === 'cancelled' || item.status === 'returned'
                  ? 'quarantined'
                  : 'serviceable',
              llpRemainingCycles: item.status === 'installed' ? 1200 : item.status === 'received' ? 800 : 460,
              traceabilityStatus:
                item.status === 'cancelled' || item.status === 'returned'
                  ? 'quarantined'
                  : 'verified',
            })),
          );
        }
      }

      if (recommendationsResponse.ok) {
        const payload = await parseJsonSafe<ApiEnvelope<ApiRecommendation[]>>(recommendationsResponse);
        if (Array.isArray(payload?.data) && payload.data.length > 0) {
          setPredictiveRecommendations(
            payload.data.map((item) => ({
              id: item.id,
              digitalTwinReference: item.digital_twin_reference,
              riskScore: item.risk_score,
              trigger: item.trigger,
              recommendation: item.recommendation,
            })),
          );
        }
      }
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load AMRO module data');
    }
  }, [apiBaseUrl, amroAccessErrorMessage, authHeaders, hasAmroAccess, isApiTemporarilyUnavailable, isAwaitingAmroDomainActivation, markApiTemporarilyUnavailable, selectedWorkPackageId]);

  const fetchTasksForWorkPackage = useCallback(
    async (workPackageId: string) => {
      if (!authHeaders || !workPackageId) {
        return;
      }
      if (!hasAmroAccess) {
        setWorkPackagesError(
          isAwaitingAmroDomainActivation ? 'Switching to AMRO domain context...' : amroAccessErrorMessage,
        );
        return;
      }
      if (isApiTemporarilyUnavailable()) {
        return;
      }
      try {
        let tasks: ApiTask[] = [];
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/work-packages/${workPackageId}/tasks`, { headers: authHeaders });
          const payload = await parseJsonSafe<ApiEnvelope<ApiTask[]> & { error?: string }>(response);
          if (!response.ok || !Array.isArray(payload?.data)) {
            throw new Error(payload?.error || `Failed to load tasks (${response.status})`);
          }
          tasks = payload.data;
        } catch (error) {
          if (!isNetworkConnectivityError(error)) {
            throw error;
          }
          const v2Response = await fetch(`${apiBaseUrl}/api/v2/amro/tasks?workPackageId=${encodeURIComponent(workPackageId)}`, { headers: authHeaders });
          const v2Payload = await parseJsonSafe<{ data?: { tasks?: V2TaskItem[] }; error?: string }>(v2Response);
          const v2Tasks = v2Payload?.data?.tasks;
          if (!v2Response.ok || !Array.isArray(v2Tasks)) {
            throw new Error(v2Payload?.error || `Failed to load tasks (${v2Response.status})`);
          }
          tasks = v2Tasks.map((task) => ({
            id: task.id,
            work_package_id: task.workPackageId,
            title: task.title,
            status: mapV2StatusToV1Status(task.status),
          }));
        }
        setWorkPackages((previous) =>
          previous.map((item) =>
            item.id === workPackageId
              ? {
                  ...item,
                  tasks: tasks.map((task) => ({
                    id: task.id,
                    workPackageId: task.work_package_id,
                    title: task.title,
                    lifecycleStage: mapStatusToLifecycle(task.status),
                    assignedRole: 'planner',
                    completed: mapStatusToLifecycle(task.status) === 'close',
                  })),
                }
              : item,
          ),
        );
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
          return;
        }
        setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load tasks');
      }
    },
    [apiBaseUrl, amroAccessErrorMessage, authHeaders, hasAmroAccess, isApiTemporarilyUnavailable, isAwaitingAmroDomainActivation, markApiTemporarilyUnavailable],
  );

  const fetchScheduleBoard = useCallback(async () => {
    if (!authHeaders) {
      setScheduleBoardRows([]);
      return;
    }
    if (!hasAmroAccess) {
      setWorkPackagesError(
        isAwaitingAmroDomainActivation ? 'Switching to AMRO domain context...' : amroAccessErrorMessage,
      );
      return;
    }
    if (isApiTemporarilyUnavailable()) {
      return;
    }
    try {
      const todayIso = new Date().toISOString();
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/schedules?date=${encodeURIComponent(todayIso)}`, { headers: authHeaders });
      const payload = await parseJsonSafe<V2SchedulesResponse>(response);
      const rows = payload?.output?.schedules;
      if (!response.ok || !Array.isArray(rows)) {
        throw new Error(payload?.error || `Failed to load schedules (${response.status})`);
      }
      setScheduleBoardRows(rows);
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load scheduling board');
    }
  }, [apiBaseUrl, amroAccessErrorMessage, authHeaders, hasAmroAccess, isApiTemporarilyUnavailable, isAwaitingAmroDomainActivation, markApiTemporarilyUnavailable]);

  useEffect(() => {
    void fetchWorkPackages();
  }, [fetchWorkPackages]);

  useEffect(() => {
    void fetchModuleSurfaces();
  }, [fetchModuleSurfaces]);

  useEffect(() => {
    if (!selectedWorkPackageId) {
      return;
    }
    void fetchTasksForWorkPackage(selectedWorkPackageId);
  }, [fetchTasksForWorkPackage, selectedWorkPackageId]);

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
    if (!hasV1WorkPackageConnectivity) {
      setRealtimeConnected(false);
      return;
    }
    if (isApiTemporarilyUnavailable()) {
      return;
    }
    const streamUrl = `${apiBaseUrl}/api/v1/work-packages/stream?access_token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);
    source.addEventListener('connected', () => {
      setRealtimeConnected(true);
    });
    source.addEventListener('work-package-change', () => {
      void fetchWorkPackages();
      void fetchModuleSurfaces();
      if (selectedWorkPackageId) {
        void fetchTasksForWorkPackage(selectedWorkPackageId);
      }
    });
    source.onerror = () => {
      setRealtimeConnected(false);
      setHasV1WorkPackageConnectivity(false);
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
    fetchTasksForWorkPackage,
    fetchWorkPackages,
    isApiTemporarilyUnavailable,
    hasAmroAccess,
    hasV1WorkPackageConnectivity,
    markApiTemporarilyUnavailable,
    selectedWorkPackageId,
    token,
  ]);

  useEffect(() => {
    if (!authHeaders || hasV1WorkPackageConnectivity) {
      return;
    }
    const intervalId = setInterval(() => {
      void fetchWorkPackages();
      void fetchModuleSurfaces();
      void fetchScheduleBoard();
      if (selectedWorkPackageId) {
        void fetchTasksForWorkPackage(selectedWorkPackageId);
      }
    }, 30000);
    return () => {
      clearInterval(intervalId);
    };
  }, [
    authHeaders,
    fetchModuleSurfaces,
    fetchTasksForWorkPackage,
    fetchWorkPackages,
    fetchScheduleBoard,
    hasV1WorkPackageConnectivity,
    selectedWorkPackageId,
  ]);

  const selectedWorkPackage = useMemo(
    () => workPackages.find((item) => item.id === selectedWorkPackageId) ?? workPackages[0] ?? null,
    [selectedWorkPackageId, workPackages],
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

  const canCreateWorkPackage = useMemo(
    () => isAmroAuthorized || hasPermission('dashboards.manage') || hasPermission('reports.manage'),
    [hasPermission, isAmroAuthorized],
  );

  const canDeleteWorkPackage = useMemo(
    () => isAuthPlatformAdmin() || isDomainPlatformAdmin || hasRole('tenant_admin') || hasPermission('dashboards.manage'),
    [hasPermission, hasRole, isAuthPlatformAdmin, isDomainPlatformAdmin],
  );

  const canAdvanceLifecycle = useMemo(() => {
    if (!isAmroAuthorized || !selectedWorkPackage) return false;
    if (selectedWorkPackage.lifecycleStage === 'close') return false;
    const nextStage = getNextWorkPackageLifecycleStage(selectedWorkPackage.lifecycleStage);
    const nextStatus = mapLifecycleToStatus(nextStage);
    return resolveRoleTransitionTargets(activeRole).includes(nextStatus);
  }, [activeRole, isAmroAuthorized, selectedWorkPackage]);

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
    if (!selectedWorkPackageId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('load-compliance-gate-explainability', {
        context: { type: 'work_package', id: selectedWorkPackageId },
        policy_version_snapshot: 'policy-v2026.03.22',
        required_obligations: [
          { obligation_id: `${selectedWorkPackageId}-ad-1`, fulfilled: true },
          { obligation_id: `${selectedWorkPackageId}-sb-1`, fulfilled: true },
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load compliance explainability');
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkPackageId,
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
        capability: String(exportFilters.capability || 'compliance-gates') as 'work-packages' | 'tasks' | 'compliance-gates',
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load audit replay timeline');
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to detect compliance anomalies');
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load regulator profile pack');
      return false;
    }
  }, [callComplianceInterface, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, selectedRegulatorProfile]);

  const ingestAdSbObligations = useCallback(async () => {
    if (!selectedWorkPackageId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('ingest-ad-sb-obligations', {
        work_package_id: selectedWorkPackageId,
        regulator_profile: selectedRegulatorProfile,
        source_adapter: 'ad-sb-feed-v1',
        obligations: [
          {
            obligation_id: `${selectedWorkPackageId}-ad-001`,
            obligation_type: 'ad',
            reference_number: 'AD-2026-001',
            due_at: new Date(Date.now() + 86400000 * 10).toISOString(),
            applicability: { aircraft_id: selectedWorkPackage?.assetId || 'asset-1' },
          },
          {
            obligation_id: `${selectedWorkPackageId}-sb-001`,
            obligation_type: 'sb',
            reference_number: 'SB-A320-27-1121',
            due_at: new Date(Date.now() + 86400000 * 14).toISOString(),
            applicability: { aircraft_id: selectedWorkPackage?.assetId || 'asset-1' },
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to ingest AD/SB obligations');
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedRegulatorProfile,
    selectedWorkPackage?.assetId,
    selectedWorkPackageId,
  ]);

  const evaluateMelCdlDeferral = useCallback(async () => {
    if (!selectedWorkPackageId || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callComplianceInterface('evaluate-mel-cdl-deferral', {
        work_package_id: selectedWorkPackageId,
        deferral_type: 'mel',
        item_reference: `${selectedWorkPackageId}-mel-001`,
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to evaluate MEL/CDL deferral');
      return false;
    }
  }, [
    callComplianceInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkPackageId,
  ]);

  const validateCertifyingPrivilege = useCallback(async () => {
    if (!selectedQualification || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('validate-certifying-authority', {
        actor_id: selectedQualification.id,
        timestamp: new Date().toISOString(),
        aircraft_scope: [selectedWorkPackage?.assetId || 'asset-1'],
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setCertifyingPrivilegeValidated(false);
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to validate certifying privilege');
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedQualification,
    selectedWorkPackage?.assetId,
  ]);

  const submitCertificationDecision = useCallback(async (decision: CertificationDecisionOption) => {
    if (!selectedWorkPackageId || !selectedQualification || isApiTemporarilyUnavailable()) return false;
    try {
      const payload = await callCertificationInterface('submit-certification-decision', {
        work_package_id: selectedWorkPackageId,
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to submit certification decision');
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedQualification,
    selectedWorkPackageId,
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to run expiry warning automation');
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load competency analytics');
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load authority certification template');
      return false;
    }
  }, [
    callCertificationInterface,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedCertificationAuthorityProfile,
  ]);

  const advanceWorkPackageLifecycle = async () => {
    if (!selectedWorkPackage || !canAdvanceLifecycle) return false;
    const nextStage = getNextWorkPackageLifecycleStage(selectedWorkPackage.lifecycleStage);
    if (!canTransitionWorkPackageLifecycle(selectedWorkPackage.lifecycleStage, nextStage)) return false;
    if (!authHeaders) {
      return false;
    }
    try {
      if (nextStage === 'close') {
        const selectedTasks = selectedWorkPackage.tasks || [];
        const completedTasks = selectedTasks.filter((task) => task.completed).length;
        const evidenceForPackage = evidenceChain.filter(
          (record) =>
            (record.entityType === 'work_package' && record.entityId === selectedWorkPackage.id)
            || (record.entityType === 'task' && selectedTasks.some((task) => task.id === record.entityId)),
        ).length;
        const signaturePending = canSignOff ? 0 : 1;
        const qualityGateResponse = await fetch(
          `${apiBaseUrl}/api/v2/amro/compliance-gates?interface=evaluate-closure-quality-gate`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              work_package_id: selectedWorkPackage.id,
              open_findings: selectedTasks.length - completedTasks,
              unresolved_deferrals: 0,
              pending_signatures: signaturePending,
              evidence_coverage_pct: selectedTasks.length > 0 ? Math.min(100, (evidenceForPackage / selectedTasks.length) * 100) : 0,
            }),
          },
        );
        const qualityGatePayload = await parseJsonSafe<{ output?: { release_ready?: boolean }; error?: string }>(qualityGateResponse);
        if (!qualityGateResponse.ok || !qualityGatePayload?.output?.release_ready) {
          throw new Error(qualityGatePayload?.error || 'Closure quality gate is not satisfied');
        }
      }
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/work-packages/${selectedWorkPackage.id}`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({
            status: mapLifecycleToStatus(nextStage),
          }),
        });
        if (!response.ok) {
          const payload = await parseJsonSafe<{ error?: string }>(response);
          throw new Error(payload?.error || `Failed to update work package (${response.status})`);
        }
      } catch (error) {
        if (!isNetworkConnectivityError(error)) {
          throw error;
        }
        const v2Response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages?interface=transition-work-package`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            work_package_id: selectedWorkPackage.id,
            current_status: mapLifecycleToStatus(selectedWorkPackage.lifecycleStage),
            target_status: mapLifecycleToStatus(nextStage),
            reason_code: 'ui-transition',
            actor_signature: `ui-${Date.now()}`,
          }),
        });
        const v2Payload = await parseJsonSafe<{ error?: string }>(v2Response);
        if (!v2Response.ok) {
          throw new Error(v2Payload?.error || `Failed to update work package (${v2Response.status})`);
        }
      }
      await fetchWorkPackages();
      await fetchTasksForWorkPackage(selectedWorkPackage.id);
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to advance lifecycle');
      return false;
    }
    return nextStage;
  };

  const createWorkPackage = useCallback(
    async (title: string) => {
      if (!authHeaders) return false;
      const cleanTitle = title.trim();
      if (!cleanTitle) return false;
      const configuredAircraftId = String(import.meta.env.VITE_AMRO_DEFAULT_AIRCRAFT_ID || '').trim();
      const seededAircraftId = String(assets[0]?.id || '').trim();
      const defaultAircraftId = configuredAircraftId || (assetsLoadedFromApi ? seededAircraftId : '');
      if (isApiTemporarilyUnavailable()) {
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const v2AircraftId = defaultAircraftId || seededAircraftId || 'amro-fallback-aircraft';
        const now = Date.now();
        const plannedWindow = `${new Date(now).toISOString()}|${new Date(now + 86400000).toISOString()}`;
        const defaultStation = String(import.meta.env.VITE_AMRO_DEFAULT_STATION || 'station-a').trim() || 'station-a';
        const v2Response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages?interface=create-work-package`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            aircraft_id: v2AircraftId,
            maintenance_type: 'line',
            planned_window: plannedWindow,
            station: defaultStation,
            priority: 'medium',
            scope_items: [cleanTitle],
          }),
        });
        const v2Payload = await parseJsonSafe<{ error?: string }>(v2Response);
        if (!v2Response.ok) {
          throw new Error(v2Payload?.error || `Failed to create work package (${v2Response.status})`);
        }
        await fetchWorkPackages();
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkPackagesError(error instanceof Error ? error.message : 'Failed to create work package');
        return false;
      }
    },
    [
      apiBaseUrl,
      assets,
      assetsLoadedFromApi,
      authHeaders,
      fetchWorkPackages,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
    ],
  );

  const assignSelectedWorkPackageToNextSlot = useCallback(async () => {
    if (!authHeaders || !selectedWorkPackageId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const now = Date.now();
      const slotStart = new Date(now + 3600000).toISOString();
      const slotEnd = new Date(now + 7200000).toISOString();
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/schedules?interface=assign-maintenance-slot`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          work_package_id: selectedWorkPackageId,
          station_code: 'station-a',
          slot_start: slotStart,
          slot_end: slotEnd,
          station_capacity: 2,
          existing_slots: scheduleBoardRows.map((item) => ({ slot_start: item.slot_start, slot_end: item.slot_end })),
          assigned_team: [{ member_id: 'tech-ui-1', qualifications: ['station-a'] }],
        }),
      });
      const payload = await parseJsonSafe<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to assign maintenance slot (${response.status})`);
      }
      await fetchScheduleBoard();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to assign maintenance slot');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchScheduleBoard,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    scheduleBoardRows,
    selectedWorkPackageId,
  ]);

  const acknowledgeScheduleUpdate = useCallback(
    async (scheduleId: string, workPackageId: string) => {
      if (!authHeaders) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(`${apiBaseUrl}/api/v2/amro/schedules?interface=acknowledge-schedule-update`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            schedule_id: scheduleId,
            work_package_id: workPackageId,
            acknowledged_at: new Date().toISOString(),
            device_id: 'mobile-ui-emulator',
          }),
        });
        const payload = await parseJsonSafe<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to acknowledge schedule (${response.status})`);
        }
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkPackagesError(error instanceof Error ? error.message : 'Failed to acknowledge schedule');
        return false;
      }
    },
    [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable],
  );

  const fetchScheduleOptimizationRecommendations = useCallback(async () => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v2/amro/schedules/replan?interface=generate-schedule-optimization-recommendations`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            schedule_date: new Date().toISOString().slice(0, 10),
            station_code: 'station-a',
            demand_pressure: 0.74,
            disruption_risk: 0.58,
            recommendation_count: 3,
          }),
        },
      );
      const payload = await parseJsonSafe<V2ScheduleOptimizationResponse>(response);
      const recommendations = payload?.output?.recommendations;
      if (!response.ok || !Array.isArray(recommendations)) {
        throw new Error(payload?.error || `Failed to load schedule optimization recommendations (${response.status})`);
      }
      setScheduleOptimizationRecommendations(recommendations);
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to load schedule optimization recommendations');
      return false;
    }
  }, [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable]);

  const reservePartsAllocationForSelectedWorkPackage = useCallback(async () => {
    if (!authHeaders || !selectedWorkPackageId || materials.length === 0) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const demandLines = materials.slice(0, 2).map((material, index) => ({
        part_number: material.partNumber,
        quantity: index === 0 ? 1 : 2,
        serial: index === 0 ? `${material.id}-serial` : undefined,
      }));
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages?interface=reserve-parts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          work_package_id: selectedWorkPackageId,
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to reserve parts');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchModuleSurfaces,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    materials,
    selectedWorkPackageId,
  ]);

  const processCriticalShortageResponse = useCallback(async () => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const shortageMaterial = materials.find((item) => item.reservationStatus === 'shortage') || materials[0];
      if (!shortageMaterial) return false;
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages?interface=process-shortage-response`, {
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to process shortage response');
      return false;
    }
  }, [apiBaseUrl, authHeaders, fetchModuleSurfaces, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, materials]);

  const applyRotableLlpTraceability = useCallback(async (materialId: string) => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const targetMaterial = materials.find((item) => item.id === materialId);
      if (!targetMaterial) return false;
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages?interface=trace-rotable-llp`, {
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to apply rotable/LLP traceability');
      return false;
    }
  }, [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, materials]);

  const runInventoryOptimizationModel = useCallback(async () => {
    if (!authHeaders || !selectedWorkPackageId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages?interface=run-inventory-optimization`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          work_package_id: selectedWorkPackageId,
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to run inventory optimization');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    predictiveRecommendations,
    selectedWorkPackageId,
  ]);

  const syncSupplierAsnAndErpProcurement = useCallback(async () => {
    if (!authHeaders) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages?interface=sync-supplier-asn-erp`, {
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
          impacted_work_packages: selectedWorkPackageId ? [selectedWorkPackageId] : [],
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
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to sync supplier ASN and ERP procurement');
      return false;
    }
  }, [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, materials, selectedWorkPackageId]);

  const applySavedWorkPackageView = useCallback((viewId: string) => {
    const selectedView = savedWorkPackageViews.find((item) => item.id === viewId)
      || savedWorkPackageViews.find((item) => item.id === DEFAULT_WORK_PACKAGE_SAVED_VIEW.id)
      || savedWorkPackageViews[0]
      || DEFAULT_WORK_PACKAGE_SAVED_VIEW;
    setSelectedSavedViewId(selectedView.id);
    setWorkPackageStatusFilter(selectedView.filters.status || 'all');
    setWorkPackageSearch(selectedView.filters.search || '');
  }, [savedWorkPackageViews]);

  const saveCurrentWorkPackageView = useCallback(
    async (name: string) => {
      if (!authHeaders) return false;
      const cleanName = name.trim();
      if (!cleanName) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages?interface=save-work-package-view`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            view_name: cleanName,
            filters: {
              status: workPackageStatusFilter,
              search: workPackageSearch,
            },
          }),
        });
        const payload = await parseJsonSafe<{ output?: { saved_view_id?: string; view_name?: string; filters?: { status?: string; search?: string } }; error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to save view (${response.status})`);
        }
        const savedViewId = String(payload?.output?.saved_view_id || '').trim();
        if (savedViewId) {
          setSavedWorkPackageViews((previous) => {
            const next = previous.filter((item) => item.id !== savedViewId);
            next.push({
              id: savedViewId,
              name: String(payload?.output?.view_name || cleanName),
              filters: {
                status: String(payload?.output?.filters?.status || workPackageStatusFilter),
                search: String(payload?.output?.filters?.search || workPackageSearch),
              },
            });
            return sanitizeSavedWorkPackageViews(next);
          });
          setSelectedSavedViewId(savedViewId);
        }
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkPackagesError(error instanceof Error ? error.message : 'Failed to save work package view');
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      workPackageSearch,
      workPackageStatusFilter,
    ],
  );

  const updateTaskExecutionStatus = useCallback(
    async (taskId: string, action: 'start' | 'complete' | 'block' | 'reopen') => {
      if (!authHeaders || !selectedWorkPackageId) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
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
        await fetchTasksForWorkPackage(selectedWorkPackageId);
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkPackagesError(error instanceof Error ? error.message : 'Failed to update task step');
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      fetchTasksForWorkPackage,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      selectedWorkPackageId,
    ],
  );

  const uploadTaskEvidence = useCallback(
    async (taskId: string) => {
      if (!authHeaders) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
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
          setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkPackagesError(error instanceof Error ? error.message : 'Failed to upload task evidence');
        return false;
      }
    },
    [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable],
  );

  const submitTaskSignature = useCallback(
    async (taskId: string) => {
      if (!authHeaders || !selectedQualification) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
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
          setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkPackagesError(error instanceof Error ? error.message : 'Failed to submit signature');
        return false;
      }
    },
    [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, selectedQualification],
  );

  const deleteSelectedWorkPackage = useCallback(async () => {
    if (!authHeaders || !selectedWorkPackageId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/work-packages/${selectedWorkPackageId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (!response.ok && response.status !== 204) {
          const payload = await parseJsonSafe<{ error?: string }>(response);
          throw new Error(payload?.error || `Failed to delete work package (${response.status})`);
        }
      } catch (error) {
        if (!isNetworkConnectivityError(error)) {
          throw error;
        }
        const v2Response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages/${selectedWorkPackageId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        const v2Payload = await parseJsonSafe<{ error?: string }>(v2Response);
        if (!v2Response.ok) {
          throw new Error(v2Payload?.error || `Failed to delete work package (${v2Response.status})`);
        }
      }
      await fetchWorkPackages();
      return true;
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markApiTemporarilyUnavailable();
        setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      setWorkPackagesError(error instanceof Error ? error.message : 'Failed to delete work package');
      return false;
    }
  }, [
    apiBaseUrl,
    authHeaders,
    fetchWorkPackages,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    selectedWorkPackageId,
  ]);

  return {
    assets,
    workPackages,
    selectedWorkPackage,
    selectedWorkPackageId,
    setSelectedWorkPackageId,
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
    canCreateWorkPackage,
    canDeleteWorkPackage,
    activeRole,
    complianceCoverage,
    materialsSummary,
    predictiveSummary,
    advanceWorkPackageLifecycle,
    loadingWorkPackages,
    workPackagesError,
    realtimeConnected,
    refreshWorkPackages: fetchWorkPackages,
    workPackageStatusFilter,
    setWorkPackageStatusFilter,
    workPackageSearch,
    setWorkPackageSearch,
    selectedSavedViewId,
    setSelectedSavedViewId: applySavedWorkPackageView,
    savedWorkPackageViews,
    saveCurrentWorkPackageView,
    createWorkPackage,
    assignSelectedWorkPackageToNextSlot,
    updateTaskExecutionStatus,
    uploadTaskEvidence,
    submitTaskSignature,
    acknowledgeScheduleUpdate,
    fetchScheduleOptimizationRecommendations,
    reservePartsAllocationForSelectedWorkPackage,
    processCriticalShortageResponse,
    applyRotableLlpTraceability,
    runInventoryOptimizationModel,
    syncSupplierAsnAndErpProcurement,
    deleteSelectedWorkPackage,
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
