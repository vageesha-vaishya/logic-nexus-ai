import { createHash } from 'node:crypto';

type NamespaceStage = 'planned' | 'canary' | 'progressive' | 'full';
type MeshMode = 'mesh' | 'bypass';
type TrafficPolicyTemplate = 'baseline' | 'canary' | 'latency-sensitive' | 'bulk';

export type ServiceMeshProfile = {
  serviceName: string;
  namespace: string;
  sidecarInjected: boolean;
  meshMode: MeshMode;
  tlsMode: 'mtls' | 'tls';
  trafficPolicyTemplate: TrafficPolicyTemplate;
  retry: {
    attempts: number;
    perTryTimeoutMs: number;
  };
  timeoutMs: number;
  discoveryEndpoint: string;
  updatedAt: string;
};

export type NamespaceOnboardingState = {
  namespace: string;
  stage: NamespaceStage;
  onboardedPercent: number;
  updatedAt: string;
};

export type MeshTrafficDecision = {
  controlledByMesh: boolean;
  reason:
    | 'mesh_controlled'
    | 'service_bypass'
    | 'namespace_not_onboarded'
    | 'missing_sidecar'
    | 'unknown_service';
  caller: ServiceMeshProfile | null;
  target: ServiceMeshProfile | null;
  retryEnforced: boolean;
  timeoutEnforced: boolean;
  tlsPreserved: boolean;
};

const defaultProfiles: ServiceMeshProfile[] = [
  {
    serviceName: 'module-crm',
    namespace: 'tenant-core',
    sidecarInjected: true,
    meshMode: 'mesh',
    tlsMode: 'mtls',
    trafficPolicyTemplate: 'baseline',
    retry: { attempts: 3, perTryTimeoutMs: 250 },
    timeoutMs: 2000,
    discoveryEndpoint: 'dns:///module-crm.tenant-core.svc.cluster.local',
    updatedAt: new Date().toISOString(),
  },
  {
    serviceName: 'module-logistics',
    namespace: 'tenant-core',
    sidecarInjected: true,
    meshMode: 'mesh',
    tlsMode: 'mtls',
    trafficPolicyTemplate: 'latency-sensitive',
    retry: { attempts: 2, perTryTimeoutMs: 200 },
    timeoutMs: 1500,
    discoveryEndpoint: 'dns:///module-logistics.tenant-core.svc.cluster.local',
    updatedAt: new Date().toISOString(),
  },
  {
    serviceName: 'module-quotation',
    namespace: 'tenant-core',
    sidecarInjected: true,
    meshMode: 'mesh',
    tlsMode: 'mtls',
    trafficPolicyTemplate: 'canary',
    retry: { attempts: 3, perTryTimeoutMs: 300 },
    timeoutMs: 2400,
    discoveryEndpoint: 'dns:///module-quotation.tenant-core.svc.cluster.local',
    updatedAt: new Date().toISOString(),
  },
  {
    serviceName: 'module-finance',
    namespace: 'tenant-core',
    sidecarInjected: true,
    meshMode: 'mesh',
    tlsMode: 'mtls',
    trafficPolicyTemplate: 'bulk',
    retry: { attempts: 3, perTryTimeoutMs: 350 },
    timeoutMs: 2600,
    discoveryEndpoint: 'dns:///module-finance.tenant-core.svc.cluster.local',
    updatedAt: new Date().toISOString(),
  },
];

const defaultNamespaces: NamespaceOnboardingState[] = [
  { namespace: 'tenant-core', stage: 'canary', onboardedPercent: 25, updatedAt: new Date().toISOString() },
];

const profileStore = new Map<string, ServiceMeshProfile>();
const namespaceStore = new Map<string, NamespaceOnboardingState>();

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.floor(value);
}

function safeAttempts(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (value < 1) return 1;
  if (value > 10) return 10;
  return Math.floor(value);
}

function safeTimeout(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < 50) return 50;
  if (value > 30000) return 30000;
  return Math.floor(value);
}

function normalizeProfile(input: Partial<ServiceMeshProfile> & { serviceName: string }): ServiceMeshProfile {
  const existing = profileStore.get(input.serviceName);
  return {
    serviceName: input.serviceName,
    namespace: String(input.namespace || existing?.namespace || 'tenant-core'),
    sidecarInjected: input.sidecarInjected ?? existing?.sidecarInjected ?? true,
    meshMode: input.meshMode || existing?.meshMode || 'mesh',
    tlsMode: input.tlsMode || existing?.tlsMode || 'mtls',
    trafficPolicyTemplate: input.trafficPolicyTemplate || existing?.trafficPolicyTemplate || 'baseline',
    retry: {
      attempts: safeAttempts(Number(input.retry?.attempts ?? existing?.retry.attempts ?? 3)),
      perTryTimeoutMs: safeTimeout(Number(input.retry?.perTryTimeoutMs ?? existing?.retry.perTryTimeoutMs ?? 250), 250),
    },
    timeoutMs: safeTimeout(Number(input.timeoutMs ?? existing?.timeoutMs ?? 2000), 2000),
    discoveryEndpoint:
      String(input.discoveryEndpoint || existing?.discoveryEndpoint || `dns:///${input.serviceName}.tenant-core.svc.cluster.local`).trim(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeNamespace(input: Partial<NamespaceOnboardingState> & { namespace: string }): NamespaceOnboardingState {
  const existing = namespaceStore.get(input.namespace);
  const stage = (input.stage || existing?.stage || 'planned') as NamespaceStage;
  const onboardedPercent = input.onboardedPercent !== undefined
    ? clampPercent(input.onboardedPercent)
    : existing?.onboardedPercent ?? (stage === 'full' ? 100 : stage === 'progressive' ? 60 : stage === 'canary' ? 10 : 0);
  return {
    namespace: input.namespace,
    stage,
    onboardedPercent: stage === 'full' ? 100 : onboardedPercent,
    updatedAt: new Date().toISOString(),
  };
}

function stableBucket(seed: string): number {
  return Number.parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16) % 100;
}

export function upsertServiceMeshProfile(input: Partial<ServiceMeshProfile> & { serviceName: string }): ServiceMeshProfile {
  const normalized = normalizeProfile(input);
  if (normalized.meshMode === 'bypass') {
    normalized.tlsMode = 'tls';
  }
  profileStore.set(normalized.serviceName, normalized);
  return { ...normalized };
}

export function getServiceMeshProfile(serviceName: string): ServiceMeshProfile | null {
  const profile = profileStore.get(String(serviceName || '').trim());
  return profile ? { ...profile } : null;
}

export function listServiceMeshProfiles(): ServiceMeshProfile[] {
  return Array.from(profileStore.values())
    .sort((a, b) => a.serviceName.localeCompare(b.serviceName))
    .map((item) => ({ ...item }));
}

export function setNamespaceOnboardingState(input: Partial<NamespaceOnboardingState> & { namespace: string }): NamespaceOnboardingState {
  const state = normalizeNamespace(input);
  namespaceStore.set(state.namespace, state);
  return { ...state };
}

export function listNamespaceOnboardingStates(): NamespaceOnboardingState[] {
  return Array.from(namespaceStore.values())
    .sort((a, b) => a.namespace.localeCompare(b.namespace))
    .map((item) => ({ ...item }));
}

export function evaluateMeshTrafficControl(input: {
  callerService: string;
  targetService: string;
  tenantId?: string | null;
}): MeshTrafficDecision {
  const caller = profileStore.get(String(input.callerService || '').trim()) || null;
  const target = profileStore.get(String(input.targetService || '').trim()) || null;
  if (!caller || !target) {
    return {
      controlledByMesh: false,
      reason: 'unknown_service',
      caller,
      target,
      retryEnforced: false,
      timeoutEnforced: false,
      tlsPreserved: false,
    };
  }

  const namespaceState = namespaceStore.get(caller.namespace) || null;
  if (!namespaceState || namespaceState.stage === 'planned') {
    return {
      controlledByMesh: false,
      reason: 'namespace_not_onboarded',
      caller: { ...caller },
      target: { ...target },
      retryEnforced: false,
      timeoutEnforced: false,
      tlsPreserved: caller.tlsMode === 'mtls' || target.tlsMode === 'mtls',
    };
  }

  const bypass = caller.meshMode === 'bypass' || target.meshMode === 'bypass';
  if (bypass) {
    return {
      controlledByMesh: false,
      reason: 'service_bypass',
      caller: { ...caller },
      target: { ...target },
      retryEnforced: false,
      timeoutEnforced: false,
      tlsPreserved: ['tls', 'mtls'].includes(caller.tlsMode) && ['tls', 'mtls'].includes(target.tlsMode),
    };
  }

  if (!caller.sidecarInjected || !target.sidecarInjected) {
    return {
      controlledByMesh: false,
      reason: 'missing_sidecar',
      caller: { ...caller },
      target: { ...target },
      retryEnforced: false,
      timeoutEnforced: false,
      tlsPreserved: caller.tlsMode === 'mtls' && target.tlsMode === 'mtls',
    };
  }

  const stagedAllowed = namespaceState.stage === 'full'
    ? true
    : stableBucket([caller.serviceName, target.serviceName, input.tenantId || '*'].join('|')) < namespaceState.onboardedPercent;

  if (!stagedAllowed) {
    return {
      controlledByMesh: false,
      reason: 'namespace_not_onboarded',
      caller: { ...caller },
      target: { ...target },
      retryEnforced: false,
      timeoutEnforced: false,
      tlsPreserved: caller.tlsMode === 'mtls' && target.tlsMode === 'mtls',
    };
  }

  return {
    controlledByMesh: true,
    reason: 'mesh_controlled',
    caller: { ...caller },
    target: { ...target },
    retryEnforced: caller.retry.attempts > 0 && target.retry.attempts > 0,
    timeoutEnforced: caller.timeoutMs > 0 && target.timeoutMs > 0,
    tlsPreserved: caller.tlsMode === 'mtls' && target.tlsMode === 'mtls',
  };
}

export function getMeshCoverageSummary() {
  const profiles = listServiceMeshProfiles();
  const total = profiles.length;
  const meshControlled = profiles.filter((item) => item.meshMode === 'mesh' && item.sidecarInjected).length;
  const namespaces = listNamespaceOnboardingStates();
  const fullyOnboarded = namespaces.every((ns) => ns.stage === 'full');
  const coveragePercent = total > 0 ? Math.round((meshControlled / total) * 100) : 0;
  return {
    totalServices: total,
    meshControlledServices: meshControlled,
    coveragePercent,
    namespaceCount: namespaces.length,
    fullyOnboarded,
    allTrafficUnderMeshControl: coveragePercent === 100 && fullyOnboarded,
  };
}

export function resetServiceMeshDiscoveryState(): void {
  profileStore.clear();
  namespaceStore.clear();
  for (const profile of defaultProfiles) {
    profileStore.set(profile.serviceName, {
      ...profile,
      updatedAt: new Date().toISOString(),
    });
  }
  for (const namespace of defaultNamespaces) {
    namespaceStore.set(namespace.namespace, {
      ...namespace,
      updatedAt: new Date().toISOString(),
    });
  }
}

resetServiceMeshDiscoveryState();
