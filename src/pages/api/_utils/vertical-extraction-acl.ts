import { createHash } from 'node:crypto';

export type VerticalModuleKey =
  | 'module-crm'
  | 'module-logistics'
  | 'module-quotation'
  | 'module-finance';

export type LegacyLeadRow = {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  lead_name: string;
  primary_email: string | null;
  stage_code: string;
  source_code: string | null;
  created_at: string;
  updated_at: string;
};

export type CanonicalLeadDto = {
  leadId: string;
  tenantId: string;
  franchiseId: string | null;
  displayName: string;
  email: string | null;
  stage: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompatibilityAdapterResult = {
  moduleKey: VerticalModuleKey;
  extractionEnabled: boolean;
  aclLegacyPathEnabled: boolean;
  routePath: 'extracted' | 'acl-legacy';
  reason:
    | 'extracted_enabled'
    | 'extracted_disabled'
    | 'rollback_toggle'
    | 'module_acl_disabled';
};

export type AclWritePlan = {
  allowed: boolean;
  directWrite: boolean;
  writePath: 'direct' | 'acl-legacy-proxy' | 'blocked';
  sourceModule: VerticalModuleKey;
  targetModule: VerticalModuleKey | 'unknown';
  tableName: string;
  reason:
    | 'owner_match'
    | 'cross_module_acl_proxy'
    | 'unknown_table'
    | 'acl_legacy_disabled'
    | 'rollback_to_legacy';
  translatedPayload: Record<string, unknown>;
};

type ModuleExtractionConfig = {
  extractionEnabled: boolean;
  aclLegacyPathEnabled: boolean;
  rollbackToLegacy: boolean;
};

type AclWriteRequest = {
  sourceModule: VerticalModuleKey;
  tableName: string;
  payload: Record<string, unknown>;
};

const tableOwnership: Record<string, VerticalModuleKey> = {
  leads: 'module-crm',
  opportunities: 'module-crm',
  shipments: 'module-logistics',
  transport_legs: 'module-logistics',
  quotations: 'module-quotation',
  quote_versions: 'module-quotation',
  invoices: 'module-finance',
  journal_entries: 'module-finance',
};

const moduleConfigs = new Map<VerticalModuleKey, ModuleExtractionConfig>([
  ['module-crm', { extractionEnabled: true, aclLegacyPathEnabled: true, rollbackToLegacy: false }],
  ['module-logistics', { extractionEnabled: true, aclLegacyPathEnabled: true, rollbackToLegacy: false }],
  ['module-quotation', { extractionEnabled: true, aclLegacyPathEnabled: true, rollbackToLegacy: false }],
  ['module-finance', { extractionEnabled: true, aclLegacyPathEnabled: true, rollbackToLegacy: false }],
]);

function parseBoolean(value: string | undefined, fallback = false): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'on';
}

function normalizeModuleKey(raw: string): VerticalModuleKey {
  if (raw === 'module-crm' || raw === 'module-logistics' || raw === 'module-quotation' || raw === 'module-finance') {
    return raw;
  }
  throw new Error(`Unsupported module key: ${raw}`);
}

function getEnvScopedKey(moduleKey: VerticalModuleKey, suffix: string): string {
  const normalized = moduleKey.replace(/-/g, '_').toUpperCase();
  return `${normalized}_${suffix}`;
}

export function mapLegacyLeadToCanonicalDto(row: LegacyLeadRow): CanonicalLeadDto {
  return {
    leadId: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    franchiseId: row.franchise_id ? String(row.franchise_id) : null,
    displayName: String(row.lead_name || ''),
    email: row.primary_email ? String(row.primary_email).trim().toLowerCase() : null,
    stage: String(row.stage_code || ''),
    source: row.source_code ? String(row.source_code) : null,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function mapCanonicalLeadToLegacyRow(dto: CanonicalLeadDto): LegacyLeadRow {
  return {
    id: String(dto.leadId || ''),
    tenant_id: String(dto.tenantId || ''),
    franchise_id: dto.franchiseId ? String(dto.franchiseId) : null,
    lead_name: String(dto.displayName || ''),
    primary_email: dto.email ? String(dto.email).trim().toLowerCase() : null,
    stage_code: String(dto.stage || ''),
    source_code: dto.source ? String(dto.source) : null,
    created_at: String(dto.createdAt || ''),
    updated_at: String(dto.updatedAt || ''),
  };
}

export function translateLegacySchemaRecord(
  entityKey: 'crm.lead',
  direction: 'legacy_to_canonical' | 'canonical_to_legacy',
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (entityKey !== 'crm.lead') {
    throw new Error(`Unsupported entity translator: ${entityKey}`);
  }
  if (direction === 'legacy_to_canonical') {
    return mapLegacyLeadToCanonicalDto(payload as LegacyLeadRow) as unknown as Record<string, unknown>;
  }
  return mapCanonicalLeadToLegacyRow(payload as CanonicalLeadDto) as unknown as Record<string, unknown>;
}

function resolveModuleConfig(moduleKey: VerticalModuleKey): ModuleExtractionConfig {
  const baseConfig = moduleConfigs.get(moduleKey);
  if (!baseConfig) {
    throw new Error(`Missing extraction config for module: ${moduleKey}`);
  }
  return {
    extractionEnabled: parseBoolean(process.env[getEnvScopedKey(moduleKey, 'EXTRACTED_ENABLED')], baseConfig.extractionEnabled),
    aclLegacyPathEnabled: parseBoolean(process.env[getEnvScopedKey(moduleKey, 'ACL_LEGACY_ENABLED')], baseConfig.aclLegacyPathEnabled),
    rollbackToLegacy: parseBoolean(process.env[getEnvScopedKey(moduleKey, 'ROLLBACK_TO_LEGACY')], baseConfig.rollbackToLegacy),
  };
}

export function getAclCompatibilityAdapter(moduleKey: VerticalModuleKey): CompatibilityAdapterResult {
  const config = resolveModuleConfig(moduleKey);
  if (config.rollbackToLegacy) {
    return {
      moduleKey,
      extractionEnabled: config.extractionEnabled,
      aclLegacyPathEnabled: config.aclLegacyPathEnabled,
      routePath: 'acl-legacy',
      reason: 'rollback_toggle',
    };
  }
  if (!config.extractionEnabled) {
    return {
      moduleKey,
      extractionEnabled: config.extractionEnabled,
      aclLegacyPathEnabled: config.aclLegacyPathEnabled,
      routePath: 'acl-legacy',
      reason: 'extracted_disabled',
    };
  }
  if (!config.aclLegacyPathEnabled) {
    return {
      moduleKey,
      extractionEnabled: config.extractionEnabled,
      aclLegacyPathEnabled: config.aclLegacyPathEnabled,
      routePath: 'extracted',
      reason: 'module_acl_disabled',
    };
  }
  return {
    moduleKey,
    extractionEnabled: config.extractionEnabled,
    aclLegacyPathEnabled: config.aclLegacyPathEnabled,
    routePath: 'extracted',
    reason: 'extracted_enabled',
  };
}

export function setAclModuleExtractionConfig(
  moduleKey: VerticalModuleKey,
  patch: Partial<ModuleExtractionConfig>
): CompatibilityAdapterResult {
  const existing = moduleConfigs.get(moduleKey);
  if (!existing) throw new Error(`Missing extraction config for module: ${moduleKey}`);
  moduleConfigs.set(moduleKey, {
    extractionEnabled: patch.extractionEnabled ?? existing.extractionEnabled,
    aclLegacyPathEnabled: patch.aclLegacyPathEnabled ?? existing.aclLegacyPathEnabled,
    rollbackToLegacy: patch.rollbackToLegacy ?? existing.rollbackToLegacy,
  });
  return getAclCompatibilityAdapter(moduleKey);
}

export function resetAclExtractionConfigs(): void {
  moduleConfigs.set('module-crm', { extractionEnabled: true, aclLegacyPathEnabled: true, rollbackToLegacy: false });
  moduleConfigs.set('module-logistics', { extractionEnabled: true, aclLegacyPathEnabled: true, rollbackToLegacy: false });
  moduleConfigs.set('module-quotation', { extractionEnabled: true, aclLegacyPathEnabled: true, rollbackToLegacy: false });
  moduleConfigs.set('module-finance', { extractionEnabled: true, aclLegacyPathEnabled: true, rollbackToLegacy: false });
}

function checksumPayload(payload: Record<string, unknown>): string {
  const ordered = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}

function buildAclProxyPayload(sourceModule: VerticalModuleKey, targetModule: VerticalModuleKey, payload: Record<string, unknown>) {
  return {
    acl_forwarded_from_module: sourceModule,
    acl_target_module: targetModule,
    acl_payload_checksum: checksumPayload(payload),
    payload,
  };
}

export function resolveAclWritePlan(input: AclWriteRequest): AclWritePlan {
  const sourceModule = normalizeModuleKey(input.sourceModule);
  const tableName = String(input.tableName || '').trim().toLowerCase();
  const targetModule = tableOwnership[tableName] || 'unknown';
  const sourceConfig = resolveModuleConfig(sourceModule);
  if (sourceConfig.rollbackToLegacy) {
    return {
      allowed: true,
      directWrite: false,
      writePath: 'acl-legacy-proxy',
      sourceModule,
      targetModule: targetModule === 'unknown' ? sourceModule : targetModule,
      tableName,
      reason: 'rollback_to_legacy',
      translatedPayload: buildAclProxyPayload(sourceModule, targetModule === 'unknown' ? sourceModule : targetModule, input.payload),
    };
  }
  if (targetModule === 'unknown') {
    return {
      allowed: false,
      directWrite: false,
      writePath: 'blocked',
      sourceModule,
      targetModule,
      tableName,
      reason: 'unknown_table',
      translatedPayload: {},
    };
  }
  if (targetModule === sourceModule) {
    return {
      allowed: true,
      directWrite: true,
      writePath: 'direct',
      sourceModule,
      targetModule,
      tableName,
      reason: 'owner_match',
      translatedPayload: input.payload,
    };
  }
  if (!sourceConfig.aclLegacyPathEnabled) {
    return {
      allowed: false,
      directWrite: false,
      writePath: 'blocked',
      sourceModule,
      targetModule,
      tableName,
      reason: 'acl_legacy_disabled',
      translatedPayload: {},
    };
  }
  return {
    allowed: true,
    directWrite: false,
    writePath: 'acl-legacy-proxy',
    sourceModule,
    targetModule,
    tableName,
    reason: 'cross_module_acl_proxy',
    translatedPayload: buildAclProxyPayload(sourceModule, targetModule, input.payload),
  };
}
