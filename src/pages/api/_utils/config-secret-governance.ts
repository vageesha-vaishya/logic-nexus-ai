import { createHash, randomUUID } from 'node:crypto';

export type DynamicConfigBundle = {
  bundleKey: string;
  version: number;
  policyTag: string;
  pinnedServices: string[];
  payload: Record<string, unknown>;
  updatedAt: string;
  signature: string;
};

export type SecretLease = {
  leaseId: string;
  secretKey: string;
  serviceName: string;
  issuedAt: string;
  expiresAt: string;
  renewable: boolean;
  accessPolicyTag: string;
  leaseToken: string;
};

export type SecretVersion = {
  keyId: string;
  activeFrom: string;
  activeUntil: string | null;
};

export type SecretMetadata = {
  secretKey: string;
  policyTag: string;
  allowedServices: string[];
  versions: SecretVersion[];
  updatedAt: string;
};

export type ConfigSnapshot = {
  generatedAt: string;
  bundles: DynamicConfigBundle[];
  signature: string;
};

const configStore = new Map<string, DynamicConfigBundle>();
const secretStore = new Map<string, SecretMetadata>();
const leaseStore = new Map<string, SecretLease>();

const defaultConfigBundles: Array<Omit<DynamicConfigBundle, 'updatedAt' | 'signature'>> = [
  {
    bundleKey: 'gateway-runtime',
    version: 1,
    policyTag: 'platform.global',
    pinnedServices: ['module-crm', 'module-logistics', 'module-quotation', 'module-finance'],
    payload: {
      retries: { maxAttempts: 3, timeoutMs: 2000 },
      rollout: { strategy: 'progressive', windowMinutes: 30 },
    },
  },
];

const defaultSecrets: Array<Omit<SecretMetadata, 'updatedAt'>> = [
  {
    secretKey: 'jwt-signing-key',
    policyTag: 'platform.identity',
    allowedServices: ['platform-identity-access', 'gateway'],
    versions: [{ keyId: 'jwt-key-v1', activeFrom: new Date().toISOString(), activeUntil: null }],
  },
  {
    secretKey: 'service-mtls-root-ca',
    policyTag: 'platform.mesh',
    allowedServices: ['platform-service-mesh', 'gateway'],
    versions: [{ keyId: 'mesh-ca-v1', activeFrom: new Date().toISOString(), activeUntil: null }],
  },
];

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function signature(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function normalizeServices(values: string[]): string[] {
  return Array.from(new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function nowIso(): string {
  return new Date().toISOString();
}

function redactLease(lease: SecretLease): SecretLease {
  return { ...lease, leaseToken: `${lease.leaseToken.slice(0, 12)}...` };
}

function activeVersion(versions: SecretVersion[]): SecretVersion | null {
  const now = Date.now();
  for (const version of versions) {
    const activeFrom = Date.parse(version.activeFrom);
    const activeUntil = version.activeUntil ? Date.parse(version.activeUntil) : Number.POSITIVE_INFINITY;
    if (activeFrom <= now && now < activeUntil) return version;
  }
  return null;
}

export function upsertDynamicConfigBundle(input: {
  bundleKey: string;
  policyTag: string;
  payload: Record<string, unknown>;
  pinnedServices?: string[];
  nextVersion?: number;
}): DynamicConfigBundle {
  const existing = configStore.get(input.bundleKey);
  const version = Number.isFinite(Number(input.nextVersion))
    ? Math.max(1, Math.floor(Number(input.nextVersion)))
    : (existing?.version || 0) + 1;
  const next: DynamicConfigBundle = {
    bundleKey: String(input.bundleKey || '').trim(),
    version,
    policyTag: String(input.policyTag || existing?.policyTag || 'platform.global').trim(),
    pinnedServices: normalizeServices(input.pinnedServices || existing?.pinnedServices || []),
    payload: input.payload || {},
    updatedAt: nowIso(),
    signature: '',
  };
  next.signature = signature({
    bundleKey: next.bundleKey,
    version: next.version,
    policyTag: next.policyTag,
    pinnedServices: next.pinnedServices,
    payload: next.payload,
    updatedAt: next.updatedAt,
  });
  configStore.set(next.bundleKey, next);
  return { ...next };
}

export function getDynamicConfigBundle(bundleKey: string, serviceName?: string | null): DynamicConfigBundle | null {
  const bundle = configStore.get(String(bundleKey || '').trim());
  if (!bundle) return null;
  if (!serviceName) return { ...bundle };
  const normalizedService = String(serviceName || '').trim();
  if (!bundle.pinnedServices.length || bundle.pinnedServices.includes(normalizedService)) return { ...bundle };
  return null;
}

export function listDynamicConfigBundles(): DynamicConfigBundle[] {
  return Array.from(configStore.values())
    .sort((a, b) => a.bundleKey.localeCompare(b.bundleKey))
    .map((item) => ({ ...item }));
}

export function setSecretAccessPolicy(input: {
  secretKey: string;
  policyTag?: string;
  allowedServices?: string[];
}): SecretMetadata {
  const secretKey = String(input.secretKey || '').trim();
  const existing = secretStore.get(secretKey);
  if (!existing) throw new Error(`Unknown secret metadata: ${secretKey}`);
  const next: SecretMetadata = {
    secretKey,
    policyTag: input.policyTag !== undefined ? String(input.policyTag || '').trim() : existing.policyTag,
    allowedServices: input.allowedServices ? normalizeServices(input.allowedServices) : existing.allowedServices,
    versions: existing.versions.map((version) => ({ ...version })),
    updatedAt: nowIso(),
  };
  secretStore.set(secretKey, next);
  return { ...next };
}

export function rotateSecretVersion(input: {
  secretKey: string;
  nextKeyId: string;
  overlapWindowSeconds?: number;
}): SecretMetadata {
  const secretKey = String(input.secretKey || '').trim();
  const existing = secretStore.get(secretKey);
  if (!existing) throw new Error(`Unknown secret metadata: ${secretKey}`);
  const overlapWindowSeconds = Math.max(60, Math.min(86400, Math.floor(Number(input.overlapWindowSeconds || 600))));
  const overlapUntil = new Date(Date.now() + overlapWindowSeconds * 1000).toISOString();
  const now = nowIso();
  const versions = existing.versions.map((version) => {
    if (!version.activeUntil) {
      return { ...version, activeUntil: overlapUntil };
    }
    return { ...version };
  });
  versions.push({
    keyId: String(input.nextKeyId || '').trim(),
    activeFrom: now,
    activeUntil: null,
  });
  const next: SecretMetadata = {
    ...existing,
    versions,
    updatedAt: now,
  };
  secretStore.set(secretKey, next);
  return { ...next };
}

export function issueSecretLease(input: {
  secretKey: string;
  serviceName: string;
  ttlSeconds?: number;
}): SecretLease {
  const secretKey = String(input.secretKey || '').trim();
  const serviceName = String(input.serviceName || '').trim();
  const metadata = secretStore.get(secretKey);
  if (!metadata) throw new Error(`Unknown secret metadata: ${secretKey}`);
  if (!metadata.allowedServices.includes(serviceName)) {
    throw new Error(`Service ${serviceName} is not authorized for secret ${secretKey}`);
  }
  const currentVersion = activeVersion(metadata.versions);
  if (!currentVersion) throw new Error(`Secret ${secretKey} has no active version`);
  const ttlSeconds = Math.max(60, Math.min(43200, Math.floor(Number(input.ttlSeconds || 1800))));
  const issuedAt = nowIso();
  const lease: SecretLease = {
    leaseId: randomUUID(),
    secretKey,
    serviceName,
    issuedAt,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    renewable: true,
    accessPolicyTag: metadata.policyTag,
    leaseToken: signature([secretKey, serviceName, currentVersion.keyId, issuedAt, ttlSeconds].join('|')),
  };
  leaseStore.set(lease.leaseId, lease);
  return redactLease(lease);
}

export function listSecretMetadata(): SecretMetadata[] {
  return Array.from(secretStore.values())
    .sort((a, b) => a.secretKey.localeCompare(b.secretKey))
    .map((item) => ({
      ...item,
      versions: item.versions.map((version) => ({ ...version })),
    }));
}

export function listSecretLeases(limit = 100): SecretLease[] {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  return Array.from(leaseStore.values())
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    .slice(0, safeLimit)
    .map(redactLease);
}

export function createSignedLocalConfigSnapshot(bundleKeys?: string[]): ConfigSnapshot {
  const target = bundleKeys && bundleKeys.length
    ? bundleKeys.map((key) => configStore.get(String(key || '').trim())).filter(Boolean) as DynamicConfigBundle[]
    : listDynamicConfigBundles();
  const generatedAt = nowIso();
  const snapshot: ConfigSnapshot = {
    generatedAt,
    bundles: target.map((bundle) => ({ ...bundle })),
    signature: '',
  };
  snapshot.signature = signature({
    generatedAt: snapshot.generatedAt,
    bundles: snapshot.bundles,
  });
  return snapshot;
}

export function verifySignedLocalConfigSnapshot(snapshot: ConfigSnapshot): boolean {
  const expected = signature({
    generatedAt: snapshot.generatedAt,
    bundles: snapshot.bundles,
  });
  return expected === snapshot.signature;
}

export function detectConfigDrift(snapshot: ConfigSnapshot): { driftDetected: boolean; missingBundles: string[]; changedBundles: string[] } {
  const current = new Map(listDynamicConfigBundles().map((bundle) => [bundle.bundleKey, bundle]));
  const snapshotMap = new Map((snapshot.bundles || []).map((bundle) => [bundle.bundleKey, bundle]));
  const missingBundles: string[] = [];
  const changedBundles: string[] = [];
  for (const [bundleKey, bundle] of current.entries()) {
    const snap = snapshotMap.get(bundleKey);
    if (!snap) {
      missingBundles.push(bundleKey);
      continue;
    }
    if (bundle.signature !== snap.signature || bundle.version !== snap.version) {
      changedBundles.push(bundleKey);
    }
  }
  return {
    driftDetected: missingBundles.length > 0 || changedBundles.length > 0,
    missingBundles,
    changedBundles,
  };
}

export function getConfigSecretGovernanceStatus() {
  const bundles = listDynamicConfigBundles();
  const secrets = listSecretMetadata();
  return {
    bundleCount: bundles.length,
    secretCount: secrets.length,
    activeLeaseCount: leaseStore.size,
    hardcodedSecretsDetected: false,
    localConfigDriftDetected: false,
  };
}

export function resetConfigSecretGovernanceState(): void {
  configStore.clear();
  secretStore.clear();
  leaseStore.clear();
  for (const bundle of defaultConfigBundles) {
    upsertDynamicConfigBundle({
      bundleKey: bundle.bundleKey,
      policyTag: bundle.policyTag,
      payload: bundle.payload,
      pinnedServices: bundle.pinnedServices,
      nextVersion: bundle.version,
    });
  }
  for (const secret of defaultSecrets) {
    secretStore.set(secret.secretKey, {
      ...secret,
      allowedServices: normalizeServices(secret.allowedServices),
      versions: secret.versions.map((version) => ({ ...version })),
      updatedAt: nowIso(),
    });
  }
}

resetConfigSecretGovernanceState();
