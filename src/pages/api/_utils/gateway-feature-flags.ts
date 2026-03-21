import { createHash } from 'node:crypto';

export type GatewayModuleFlagConfig = {
  enabled: boolean;
  emergencyKillSwitch: boolean;
  rolloutPercent: number;
  tenantCohorts: string[];
  franchiseCohorts: string[];
};

export type GatewayFeatureFlagConfig = {
  version: number;
  modules: Record<string, GatewayModuleFlagConfig>;
  globalKillSwitch: boolean;
  updatedAt: string;
  checksum: string;
};

export type GatewayFeatureFlagResolutionInput = {
  moduleKey: string;
  tenantId?: string | null;
  franchiseId?: string | null;
};

export type GatewayFeatureFlagResolution = {
  moduleKey: string;
  enabled: boolean;
  reason:
    | 'global_kill_switch'
    | 'module_kill_switch'
    | 'module_disabled'
    | 'cohort_excluded'
    | 'rollout_excluded'
    | 'stale_config_version'
    | 'checksum_mismatch'
    | 'enabled';
  configVersion: number;
  checksum: string;
  cohortMatched: boolean;
  rolloutBucket: number;
  rolloutPercent: number;
};

type GatewayFeatureFlagUpdateInput = {
  expectedVersion?: number;
  expectedChecksum?: string;
  nextVersion: number;
  globalKillSwitch?: boolean;
  modules: Record<string, Partial<GatewayModuleFlagConfig> & { enabled?: boolean }>;
};

const DEFAULT_CONFIG_VERSION = 1;

function parseBoolean(value: string | undefined, fallback = false): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'on';
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.floor(value);
}

function parseCsv(value: string | undefined): string[] {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeModule(input: Partial<GatewayModuleFlagConfig> | undefined): GatewayModuleFlagConfig {
  return {
    enabled: Boolean(input?.enabled),
    emergencyKillSwitch: Boolean(input?.emergencyKillSwitch),
    rolloutPercent: clampPercent(Number(input?.rolloutPercent ?? 0)),
    tenantCohorts: Array.from(new Set((input?.tenantCohorts || []).map((item) => String(item || '').trim()).filter(Boolean))),
    franchiseCohorts: Array.from(new Set((input?.franchiseCohorts || []).map((item) => String(item || '').trim()).filter(Boolean))),
  };
}

function toChecksumPayload(config: Omit<GatewayFeatureFlagConfig, 'checksum'>): string {
  const sortedModules = Object.keys(config.modules)
    .sort()
    .reduce<Record<string, GatewayModuleFlagConfig>>((acc, moduleKey) => {
      acc[moduleKey] = normalizeModule(config.modules[moduleKey]);
      return acc;
    }, {});

  return JSON.stringify({
    version: config.version,
    globalKillSwitch: config.globalKillSwitch,
    modules: sortedModules,
    updatedAt: config.updatedAt,
  });
}

export function computeGatewayFeatureFlagChecksum(config: Omit<GatewayFeatureFlagConfig, 'checksum'>): string {
  return createHash('sha256').update(toChecksumPayload(config)).digest('hex');
}

function buildConfigFromEnv(): GatewayFeatureFlagConfig {
  const version = parseInteger(process.env.GATEWAY_FLAG_CONFIG_VERSION, DEFAULT_CONFIG_VERSION);
  const updatedAt = new Date().toISOString();
  const fallbackCompatModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_COMPAT_FACADE_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_ROUTE_GLOBAL_REVERT_TO_V1, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_V2_PRIMARY_ROLLOUT_PERCENT, 0),
    tenantCohorts: parseCsv(process.env.GATEWAY_V2_PRIMARY_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_V2_PRIMARY_FRANCHISES),
  };
  const fallbackShadowModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_V2_SHADOW_READ, false),
    emergencyKillSwitch: false,
    rolloutPercent: parseInteger(process.env.GATEWAY_V2_SHADOW_ROLLOUT_PERCENT, 0),
    tenantCohorts: parseCsv(process.env.GATEWAY_V2_SHADOW_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_V2_SHADOW_FRANCHISES),
  };
  const fallbackRouteInventoryModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.ROUTE_INVENTORY_DASHBOARD_V1 || process.env.VITE_FF_ROUTE_INVENTORY_DASHBOARD_V1, false),
    emergencyKillSwitch: false,
    rolloutPercent: 100,
    tenantCohorts: [],
    franchiseCohorts: [],
  };
  const fallbackMonitoringModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.MIGRATION_BASELINE_SLO_V1 || process.env.VITE_FF_MIGRATION_BASELINE_SLO_V1, true),
    emergencyKillSwitch: false,
    rolloutPercent: 100,
    tenantCohorts: [],
    franchiseCohorts: [],
  };
  const fallbackVerticalExtractionModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_VERTICAL_EXTRACTION_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_VERTICAL_EXTRACTION_KILL_SWITCH, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_VERTICAL_EXTRACTION_ROLLOUT_PERCENT, 100),
    tenantCohorts: parseCsv(process.env.GATEWAY_VERTICAL_EXTRACTION_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_VERTICAL_EXTRACTION_FRANCHISES),
  };
  const fallbackDualRunReconciliationModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_DUAL_RUN_RECONCILIATION_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_DUAL_RUN_RECONCILIATION_KILL_SWITCH, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_DUAL_RUN_RECONCILIATION_ROLLOUT_PERCENT, 100),
    tenantCohorts: parseCsv(process.env.GATEWAY_DUAL_RUN_RECONCILIATION_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_DUAL_RUN_RECONCILIATION_FRANCHISES),
  };
  const fallbackIdentityPolicyCentralizationModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_IDENTITY_POLICY_CENTRALIZATION_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_IDENTITY_POLICY_CENTRALIZATION_KILL_SWITCH, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_IDENTITY_POLICY_CENTRALIZATION_ROLLOUT_PERCENT, 100),
    tenantCohorts: parseCsv(process.env.GATEWAY_IDENTITY_POLICY_CENTRALIZATION_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_IDENTITY_POLICY_CENTRALIZATION_FRANCHISES),
  };
  const fallbackServiceMeshDiscoveryModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_SERVICE_MESH_DISCOVERY_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_SERVICE_MESH_DISCOVERY_KILL_SWITCH, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_SERVICE_MESH_DISCOVERY_ROLLOUT_PERCENT, 100),
    tenantCohorts: parseCsv(process.env.GATEWAY_SERVICE_MESH_DISCOVERY_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_SERVICE_MESH_DISCOVERY_FRANCHISES),
  };
  const fallbackConfigSecretGovernanceModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_CONFIG_SECRET_GOVERNANCE_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_CONFIG_SECRET_GOVERNANCE_KILL_SWITCH, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_CONFIG_SECRET_GOVERNANCE_ROLLOUT_PERCENT, 100),
    tenantCohorts: parseCsv(process.env.GATEWAY_CONFIG_SECRET_GOVERNANCE_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_CONFIG_SECRET_GOVERNANCE_FRANCHISES),
  };
  const fallbackDatastoreCutoverModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_DATASTORE_CUTOVER_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_DATASTORE_CUTOVER_KILL_SWITCH, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_DATASTORE_CUTOVER_ROLLOUT_PERCENT, 100),
    tenantCohorts: parseCsv(process.env.GATEWAY_DATASTORE_CUTOVER_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_DATASTORE_CUTOVER_FRANCHISES),
  };
  const fallbackProjectionCachingModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_PROJECTION_CACHING_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_PROJECTION_CACHING_KILL_SWITCH, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_PROJECTION_CACHING_ROLLOUT_PERCENT, 100),
    tenantCohorts: parseCsv(process.env.GATEWAY_PROJECTION_CACHING_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_PROJECTION_CACHING_FRANCHISES),
  };
  const fallbackAutoscalingCostControlsModule: GatewayModuleFlagConfig = {
    enabled: parseBoolean(process.env.GATEWAY_AUTOSCALING_COST_CONTROLS_V1, true),
    emergencyKillSwitch: parseBoolean(process.env.GATEWAY_AUTOSCALING_COST_CONTROLS_KILL_SWITCH, false),
    rolloutPercent: parseInteger(process.env.GATEWAY_AUTOSCALING_COST_CONTROLS_ROLLOUT_PERCENT, 100),
    tenantCohorts: parseCsv(process.env.GATEWAY_AUTOSCALING_COST_CONTROLS_TENANTS),
    franchiseCohorts: parseCsv(process.env.GATEWAY_AUTOSCALING_COST_CONTROLS_FRANCHISES),
  };

  const base: Omit<GatewayFeatureFlagConfig, 'checksum'> = {
    version,
    globalKillSwitch: parseBoolean(process.env.GATEWAY_FLAG_GLOBAL_KILL_SWITCH, false),
    updatedAt,
    modules: {
      'gateway.compat-v2-primary': fallbackCompatModule,
      'gateway.compat-v2-shadow': fallbackShadowModule,
      'gateway.route-inventory': fallbackRouteInventoryModule,
      'gateway.monitoring-baseline': fallbackMonitoringModule,
      'gateway.vertical-extraction': fallbackVerticalExtractionModule,
      'gateway.dual-run-reconciliation': fallbackDualRunReconciliationModule,
      'gateway.identity-policy-centralization': fallbackIdentityPolicyCentralizationModule,
      'gateway.service-mesh-discovery': fallbackServiceMeshDiscoveryModule,
      'gateway.config-secret-governance': fallbackConfigSecretGovernanceModule,
      'gateway.datastore-cutover': fallbackDatastoreCutoverModule,
      'gateway.projection-caching': fallbackProjectionCachingModule,
      'gateway.autoscaling-cost-controls': fallbackAutoscalingCostControlsModule,
    },
  };

  const envJson = String(process.env.GATEWAY_MODULE_FLAG_CONFIG_JSON || '').trim();
  if (!envJson) {
    return {
      ...base,
      checksum: computeGatewayFeatureFlagChecksum(base),
    };
  }

  try {
    const parsed = JSON.parse(envJson) as Partial<GatewayFeatureFlagConfig>;
    const merged: Omit<GatewayFeatureFlagConfig, 'checksum'> = {
      version: Number(parsed.version || base.version),
      globalKillSwitch: parsed.globalKillSwitch ?? base.globalKillSwitch,
      updatedAt: String(parsed.updatedAt || base.updatedAt),
      modules: {
        ...base.modules,
        ...Object.entries(parsed.modules || {}).reduce<Record<string, GatewayModuleFlagConfig>>((acc, [moduleKey, moduleConfig]) => {
          acc[moduleKey] = normalizeModule(moduleConfig);
          return acc;
        }, {}),
      },
    };
    const computedChecksum = computeGatewayFeatureFlagChecksum(merged);
    return {
      ...merged,
      checksum: String(parsed.checksum || computedChecksum),
    };
  } catch {
    return {
      ...base,
      checksum: computeGatewayFeatureFlagChecksum(base),
    };
  }
}

let runtimeConfig: GatewayFeatureFlagConfig = buildConfigFromEnv();

function computeRolloutBucket(moduleKey: string, tenantId: string | null, franchiseId: string | null): number {
  const hash = createHash('sha256')
    .update([moduleKey, tenantId || 'tenant:*', franchiseId || 'franchise:*'].join('|'))
    .digest('hex')
    .slice(0, 8);
  const numeric = Number.parseInt(hash, 16);
  return Number.isFinite(numeric) ? numeric % 100 : 0;
}

export function getGatewayFeatureFlagConfigSnapshot(): GatewayFeatureFlagConfig {
  return JSON.parse(JSON.stringify(runtimeConfig)) as GatewayFeatureFlagConfig;
}

export function resetGatewayFeatureFlagConfig(): GatewayFeatureFlagConfig {
  runtimeConfig = buildConfigFromEnv();
  return getGatewayFeatureFlagConfigSnapshot();
}

export function updateGatewayFeatureFlagConfig(input: GatewayFeatureFlagUpdateInput): GatewayFeatureFlagConfig {
  if (input.expectedVersion !== undefined && Number(input.expectedVersion) !== runtimeConfig.version) {
    throw new Error('Gateway flag config version pin mismatch');
  }
  if (input.expectedChecksum && String(input.expectedChecksum).trim() !== runtimeConfig.checksum) {
    throw new Error('Gateway flag config checksum mismatch');
  }
  const updatedAt = new Date().toISOString();
  const mergedModules = {
    ...runtimeConfig.modules,
    ...Object.entries(input.modules || {}).reduce<Record<string, GatewayModuleFlagConfig>>((acc, [moduleKey, moduleConfig]) => {
      acc[moduleKey] = normalizeModule({
        ...runtimeConfig.modules[moduleKey],
        ...moduleConfig,
      });
      return acc;
    }, {}),
  };
  const base: Omit<GatewayFeatureFlagConfig, 'checksum'> = {
    version: Number(input.nextVersion),
    globalKillSwitch: input.globalKillSwitch ?? runtimeConfig.globalKillSwitch,
    modules: mergedModules,
    updatedAt,
  };
  runtimeConfig = {
    ...base,
    checksum: computeGatewayFeatureFlagChecksum(base),
  };
  return getGatewayFeatureFlagConfigSnapshot();
}

export function resolveGatewayFeatureFlag(input: GatewayFeatureFlagResolutionInput): GatewayFeatureFlagResolution {
  const moduleConfig = runtimeConfig.modules[input.moduleKey];
  const fallbackModule = normalizeModule({
    enabled: false,
    emergencyKillSwitch: false,
    rolloutPercent: 0,
    tenantCohorts: [],
    franchiseCohorts: [],
  });
  const effectiveModule = moduleConfig ? normalizeModule(moduleConfig) : fallbackModule;
  const tenantId = String(input.tenantId || '').trim() || null;
  const franchiseId = String(input.franchiseId || '').trim() || null;
  const rolloutBucket = computeRolloutBucket(input.moduleKey, tenantId, franchiseId);
  const cohortMatched = Boolean(
    (!effectiveModule.tenantCohorts.length && !effectiveModule.franchiseCohorts.length) ||
    (tenantId && effectiveModule.tenantCohorts.includes(tenantId)) ||
    (franchiseId && effectiveModule.franchiseCohorts.includes(franchiseId))
  );

  const pinnedVersion = parseInteger(process.env.GATEWAY_FLAG_CONFIG_PIN_VERSION, runtimeConfig.version);
  if (runtimeConfig.version !== pinnedVersion) {
    return {
      moduleKey: input.moduleKey,
      enabled: false,
      reason: 'stale_config_version',
      configVersion: runtimeConfig.version,
      checksum: runtimeConfig.checksum,
      cohortMatched,
      rolloutBucket,
      rolloutPercent: effectiveModule.rolloutPercent,
    };
  }

  const pinnedChecksum = String(process.env.GATEWAY_FLAG_CONFIG_PIN_CHECKSUM || '').trim();
  if (pinnedChecksum && pinnedChecksum !== runtimeConfig.checksum) {
    return {
      moduleKey: input.moduleKey,
      enabled: false,
      reason: 'checksum_mismatch',
      configVersion: runtimeConfig.version,
      checksum: runtimeConfig.checksum,
      cohortMatched,
      rolloutBucket,
      rolloutPercent: effectiveModule.rolloutPercent,
    };
  }

  if (runtimeConfig.globalKillSwitch) {
    return {
      moduleKey: input.moduleKey,
      enabled: false,
      reason: 'global_kill_switch',
      configVersion: runtimeConfig.version,
      checksum: runtimeConfig.checksum,
      cohortMatched,
      rolloutBucket,
      rolloutPercent: effectiveModule.rolloutPercent,
    };
  }

  if (effectiveModule.emergencyKillSwitch) {
    return {
      moduleKey: input.moduleKey,
      enabled: false,
      reason: 'module_kill_switch',
      configVersion: runtimeConfig.version,
      checksum: runtimeConfig.checksum,
      cohortMatched,
      rolloutBucket,
      rolloutPercent: effectiveModule.rolloutPercent,
    };
  }

  if (!effectiveModule.enabled) {
    return {
      moduleKey: input.moduleKey,
      enabled: false,
      reason: 'module_disabled',
      configVersion: runtimeConfig.version,
      checksum: runtimeConfig.checksum,
      cohortMatched,
      rolloutBucket,
      rolloutPercent: effectiveModule.rolloutPercent,
    };
  }

  if (!cohortMatched) {
    return {
      moduleKey: input.moduleKey,
      enabled: false,
      reason: 'cohort_excluded',
      configVersion: runtimeConfig.version,
      checksum: runtimeConfig.checksum,
      cohortMatched: false,
      rolloutBucket,
      rolloutPercent: effectiveModule.rolloutPercent,
    };
  }

  if (rolloutBucket >= effectiveModule.rolloutPercent) {
    return {
      moduleKey: input.moduleKey,
      enabled: false,
      reason: 'rollout_excluded',
      configVersion: runtimeConfig.version,
      checksum: runtimeConfig.checksum,
      cohortMatched,
      rolloutBucket,
      rolloutPercent: effectiveModule.rolloutPercent,
    };
  }

  return {
    moduleKey: input.moduleKey,
    enabled: true,
    reason: 'enabled',
    configVersion: runtimeConfig.version,
    checksum: runtimeConfig.checksum,
    cohortMatched,
    rolloutBucket,
    rolloutPercent: effectiveModule.rolloutPercent,
  };
}
