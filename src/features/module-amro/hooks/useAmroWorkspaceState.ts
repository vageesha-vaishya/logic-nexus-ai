import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
  const base = String(import.meta.env.VITE_AMRO_API_BASE_URL || runtimeEnv.VITE_AMRO_API_BASE_URL || '/api/amro');
  return base.replace(/\/$/, '');
}

function mapStatusToLifecycle(status: string): AmroWorkPackageLifecycleStage {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'approved') return 'plan';
  if (normalized === 'planning') return 'create';
  if (normalized === 'scheduled') return 'schedule';
  if (normalized === 'in_progress' || normalized === 'on_hold') return 'execute';
  if (normalized === 'completed' || normalized === 'closed' || normalized === 'cancelled') return 'close';
  return 'create';
}

function mapLifecycleToStatus(stage: AmroWorkPackageLifecycleStage): string {
  if (stage === 'create') return 'planning';
  if (stage === 'plan') return 'approved';
  if (stage === 'schedule') return 'scheduled';
  if (stage === 'execute') return 'in_progress';
  return 'closed';
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
  { id: 'rc-3', authority: 'SACAA', ruleVersion: '2026.1', active: true },
  { id: 'rc-4', authority: 'ISO_55000', ruleVersion: '2014.9', active: true },
];

const initialEvidenceChain: AmroEvidenceRecord[] = [
  { id: 'ev-1', entityType: 'work_package', entityId: 'wp-1', hash: 'sha256:8df2a39aaad9', immutable: true, createdAt: '2026-03-20T11:40:00.000Z' },
  { id: 'ev-2', entityType: 'task', entityId: 'task-3', hash: 'sha256:9ab12cdaa8be', immutable: true, createdAt: '2026-03-20T12:30:00.000Z' },
  { id: 'ev-3', entityType: 'inspection', entityId: 'task-4', hash: 'sha256:5a72c3ef8a71', immutable: true, createdAt: '2026-03-20T12:55:00.000Z' },
];

const initialMaterials: AmroMaterialPlanningRecord[] = [
  { id: 'mat-1', partNumber: 'PN-ATA72-889', reservationStatus: 'reserved', repairAction: 'install', supplierEta: '2026-03-24T09:00:00.000Z' },
  { id: 'mat-2', partNumber: 'PN-ATA27-190', reservationStatus: 'pending', repairAction: 'repair', supplierEta: '2026-03-26T09:00:00.000Z' },
  { id: 'mat-3', partNumber: 'PN-ATA32-672', reservationStatus: 'shortage', repairAction: 'remove', supplierEta: '2026-03-29T09:00:00.000Z' },
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
  const { hasPermission, hasRole, isPlatformAdmin, session } = useAuth();
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
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);
  const [requiredAuthority, setRequiredAuthority] = useState<AmroAuthorityLevel>('supervisor');
  const [selectedQualificationId, setSelectedQualificationId] = useState<string>(initialQualifications[0]?.id ?? '');
  const [qualifications, setQualifications] = useState<AmroQualification[]>(initialQualifications);
  const [rulePacks, setRulePacks] = useState<AmroComplianceRulePack[]>(initialRulePacks);
  const [evidenceChain, setEvidenceChain] = useState<AmroEvidenceRecord[]>(initialEvidenceChain);
  const [materials, setMaterials] = useState<AmroMaterialPlanningRecord[]>(initialMaterials);
  const [predictiveRecommendations, setPredictiveRecommendations] = useState<AmroPredictiveRecommendation[]>(initialPredictiveRecommendations);

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

  const isApiTemporarilyUnavailable = useCallback(() => Date.now() < apiUnavailableUntil, [apiUnavailableUntil]);

  const markApiTemporarilyUnavailable = useCallback(() => {
    setApiUnavailableUntil(Date.now() + 30000);
    setRealtimeConnected(false);
  }, []);

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
        const v2Response = await fetch(`${apiBaseUrl}/api/v2/amro/work-packages`, { headers: authHeaders });
        const v2Payload = await parseJsonSafe<{ data?: { workPackages?: V2WorkPackageItem[] }; error?: string }>(v2Response);
        const v2Items = v2Payload?.data?.workPackages;
        if (!v2Response.ok || !Array.isArray(v2Items)) {
          throw new Error(v2Payload?.error || `Failed to load work packages (${v2Response.status})`);
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
  }, [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, mapWorkPackageRecord, markApiTemporarilyUnavailable]);

  const fetchModuleSurfaces = useCallback(async () => {
    if (!authHeaders) {
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
  }, [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, selectedWorkPackageId]);

  const fetchTasksForWorkPackage = useCallback(
    async (workPackageId: string) => {
      if (!authHeaders || !workPackageId) {
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
    [apiBaseUrl, authHeaders, isApiTemporarilyUnavailable, markApiTemporarilyUnavailable],
  );

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
    if (!token) {
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

  const isAmroAuthorized = useMemo(() => {
    if (isPlatformAdmin()) return true;
    return hasPermission('*') || hasRole('tenant_admin') || hasRole('franchise_admin');
  }, [hasPermission, hasRole, isPlatformAdmin]);

  const canAdvanceLifecycle = useMemo(() => {
    if (!isAmroAuthorized || !selectedWorkPackage) return false;
    return selectedWorkPackage.lifecycleStage !== 'close';
  }, [isAmroAuthorized, selectedWorkPackage]);

  const canSignOff = useMemo(() => {
    if (!selectedQualification) return false;
    return canPerformAuthoritySignOff(selectedQualification, requiredAuthority);
  }, [requiredAuthority, selectedQualification]);

  const complianceCoverage = useMemo(() => buildComplianceCoverage(rulePacks), [rulePacks]);
  const materialsSummary = useMemo(() => buildMaterialsPlanningSummary(materials), [materials]);
  const predictiveSummary = useMemo(
    () => buildPredictiveMaintenanceSummary(predictiveRecommendations),
    [predictiveRecommendations]
  );

  const advanceWorkPackageLifecycle = async () => {
    if (!selectedWorkPackage || !canAdvanceLifecycle) return false;
    const nextStage = getNextWorkPackageLifecycleStage(selectedWorkPackage.lifecycleStage);
    if (!canTransitionWorkPackageLifecycle(selectedWorkPackage.lifecycleStage, nextStage)) return false;
    if (!authHeaders) {
      return false;
    }
    try {
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

  const deleteSelectedWorkPackage = useCallback(async () => {
    if (!authHeaders || !selectedWorkPackageId) return false;
    if (isApiTemporarilyUnavailable()) {
      setWorkPackagesError('AMRO API is temporarily unavailable. Retrying shortly.');
      return false;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/work-packages/${selectedWorkPackageId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!response.ok && response.status !== 204) {
        const payload = await parseJsonSafe<{ error?: string }>(response);
        throw new Error(payload?.error || `Failed to delete work package (${response.status})`);
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
    isAmroAuthorized,
    canAdvanceLifecycle,
    canSignOff,
    complianceCoverage,
    materialsSummary,
    predictiveSummary,
    advanceWorkPackageLifecycle,
    loadingWorkPackages,
    workPackagesError,
    realtimeConnected,
    refreshWorkPackages: fetchWorkPackages,
    createWorkPackage,
    deleteSelectedWorkPackage,
  };
}
