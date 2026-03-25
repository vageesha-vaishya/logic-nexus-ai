type TemplatePermission = 'READ' | 'INSTANTIATE' | 'EXTEND';

export type TemplateRegistryRecord = {
  id: string;
  name: string;
  version: string;
  lifecycleState: string;
  validFrom: string | null;
  validTo: string | null;
  permissions: TemplatePermission[];
};

type TemplateRegistryAccessResult = {
  allowed: boolean;
  template: TemplateRegistryRecord | null;
};

type CacheRecord = {
  expiresAt: number;
  value: TemplateRegistryAccessResult;
};

type TemplateRegistryQuery = {
  tenantId: string;
  userId: string;
  templateId: string;
  requiredPermission: TemplatePermission;
  registryVersion?: string | null;
};

type TemplateRegistryListQuery = {
  tenantId: string;
  userId: string;
  registryVersion?: string | null;
};

const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE = new Map<string, CacheRecord>();

export class TemplateNotAccessibleException extends Error {
  readonly statusCode: number;

  constructor(message = 'template access denied by registry') {
    super(message);
    this.name = 'TemplateNotAccessibleException';
    this.statusCode = 403;
  }
}

function getRegistryEndpoint(): string {
  return process.env.AMRO_TEMPLATE_REGISTRY_GRPC_ENDPOINT || 'https://template-registry.amro.internal:443';
}

function buildCacheKey(query: TemplateRegistryQuery): string {
  return [
    `tenant:${query.tenantId}`,
    `user:${query.userId}`,
    `template:${query.templateId}`,
    `permission:${query.requiredPermission}`,
    `registry:${query.registryVersion || 'latest'}`,
  ].join('|');
}

function enforceCacheCapacity() {
  while (CACHE.size > CACHE_MAX_SIZE) {
    const oldest = CACHE.keys().next().value;
    if (!oldest) return;
    CACHE.delete(oldest);
  }
}

function parseTemplatePermissionSet(value: unknown): TemplatePermission[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item): item is TemplatePermission => item === 'READ' || item === 'INSTANTIATE' || item === 'EXTEND');
}

function parseTemplateRecord(payload: Record<string, unknown>): TemplateRegistryRecord {
  return {
    id: String(payload.id || '').trim(),
    name: String(payload.name || '').trim(),
    version: String(payload.version || '').trim(),
    lifecycleState: String(payload.lifecycleState || payload.lifecycle_state || '').trim().toUpperCase(),
    validFrom: payload.validFrom ? String(payload.validFrom) : payload.valid_from ? String(payload.valid_from) : null,
    validTo: payload.validTo ? String(payload.validTo) : payload.valid_to ? String(payload.valid_to) : null,
    permissions: parseTemplatePermissionSet(payload.permissions),
  };
}

function isWithinValidityWindow(record: TemplateRegistryRecord, now: Date): boolean {
  if (record.validFrom) {
    const from = Date.parse(record.validFrom);
    if (Number.isFinite(from) && from > now.getTime()) return false;
  }
  if (record.validTo) {
    const to = Date.parse(record.validTo);
    if (Number.isFinite(to) && to < now.getTime()) return false;
  }
  return true;
}

async function callTemplateRegistry(query: TemplateRegistryQuery): Promise<TemplateRegistryAccessResult> {
  const endpoint = getRegistryEndpoint();
  const url = `${endpoint}/amro.template.registry.v1.TemplateRegistryService/GetTemplateAccess`;
  const timeoutMs = Number.parseInt(String(process.env.AMRO_TEMPLATE_REGISTRY_TIMEOUT_MS || '800'), 10) || 800;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/grpc+json',
        'x-tenant-id': query.tenantId,
        'x-user-id': query.userId,
        'x-registry-version': query.registryVersion || 'latest',
      },
      body: JSON.stringify({
        tenantId: query.tenantId,
        userId: query.userId,
        templateId: query.templateId,
        requiredPermission: query.requiredPermission,
      }),
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`template registry request failed with ${response.status}`);
    }
    const payload = await response.json() as Record<string, unknown>;
    const allowed = payload.allowed === true;
    const templatePayload = payload.template && typeof payload.template === 'object'
      ? payload.template as Record<string, unknown>
      : null;
    if (!templatePayload) {
      return { allowed: false, template: null };
    }
    const record = parseTemplateRecord(templatePayload);
    if (!record.id || !record.version) {
      return { allowed: false, template: null };
    }
    return { allowed, template: record };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getTemplateRegistryAccess(query: TemplateRegistryQuery): Promise<TemplateRegistryAccessResult> {
  const key = buildCacheKey(query);
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  if (cached) {
    CACHE.delete(key);
  }
  const fresh = await callTemplateRegistry(query);
  CACHE.set(key, {
    value: fresh,
    expiresAt: now + CACHE_TTL_MS,
  });
  enforceCacheCapacity();
  return fresh;
}

export async function assertTemplateRegistryAccess(query: TemplateRegistryQuery): Promise<TemplateRegistryRecord> {
  const access = await getTemplateRegistryAccess(query);
  if (!access.allowed || !access.template) {
    throw new TemplateNotAccessibleException();
  }
  const record = access.template;
  if (record.lifecycleState !== 'ACTIVE') {
    throw new TemplateNotAccessibleException('template lifecycle state is not active');
  }
  if (!isWithinValidityWindow(record, new Date())) {
    throw new TemplateNotAccessibleException('template is outside validity window');
  }
  if (!record.permissions.includes(query.requiredPermission)) {
    throw new TemplateNotAccessibleException();
  }
  return record;
}

export function clearTemplateRegistryCache(): void {
  CACHE.clear();
}

export async function listTemplateRegistryEntries(query: TemplateRegistryListQuery): Promise<TemplateRegistryRecord[]> {
  const endpoint = getRegistryEndpoint();
  const url = `${endpoint}/amro.template.registry.v1.TemplateRegistryService/ListTemplates`;
  const timeoutMs = Number.parseInt(String(process.env.AMRO_TEMPLATE_REGISTRY_TIMEOUT_MS || '800'), 10) || 800;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/grpc+json',
        'x-tenant-id': query.tenantId,
        'x-user-id': query.userId,
        'x-registry-version': query.registryVersion || 'latest',
      },
      body: JSON.stringify({
        tenantId: query.tenantId,
        userId: query.userId,
        registryVersion: query.registryVersion || 'latest',
      }),
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`template registry list request failed with ${response.status}`);
    }
    const payload = await response.json() as Record<string, unknown>;
    const templates = Array.isArray(payload.templates) ? payload.templates : [];
    return templates
      .filter((item) => item && typeof item === 'object')
      .map((item) => parseTemplateRecord(item as Record<string, unknown>))
      .filter((item) => Boolean(item.id && item.version));
  } finally {
    clearTimeout(timeout);
  }
}
