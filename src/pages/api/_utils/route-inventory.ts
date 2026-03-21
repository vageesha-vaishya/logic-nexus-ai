import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getCompatibilityTransitionTelemetrySnapshot } from './compatibility-facade';
import { getGatewayFeatureFlagConfigSnapshot } from './gateway-feature-flags';

type RouteInventoryPayload = {
  generatedAt: string;
  featureFlag: {
    key: string;
    enabled: boolean;
  };
  featureFlagPlatform: {
    version: number;
    checksum: string;
    updatedAt: string;
    globalKillSwitch: boolean;
    modules: Array<{
      key: string;
      enabled: boolean;
      emergencyKillSwitch: boolean;
      rolloutPercent: number;
      tenantCohorts: number;
      franchiseCohorts: number;
    }>;
  };
  gateway: {
    globalRevertToLegacy: boolean;
    facadeEnabled: boolean;
    v2PrimaryEnabled: boolean;
    v2ShadowEnabled: boolean;
    transitionTelemetry: {
      records: Array<{
        key: string;
        tenantId: string | null;
        franchiseId: string | null;
        from: { apiVersion: 'v1' | 'v2'; compatMode: 'v1-pass' | 'v2-shadow' | 'v2-primary' };
        to: { apiVersion: 'v1' | 'v2'; compatMode: 'v1-pass' | 'v2-shadow' | 'v2-primary' };
        reason: 'policy_resolution' | 'global_revert_toggle' | 'facade_disabled';
        count: number;
        lastObservedAt: string;
      }>;
      totalEvents: number;
      rollbackEvents: number;
    };
  };
  web: {
    appRoutes: string[];
    menuRoutes: string[];
  };
  api: {
    routes: string[];
  };
  counts: {
    appRoutes: number;
    menuRoutes: number;
    apiRoutes: number;
  };
};

const projectRoot = process.cwd();
const apiRoot = path.join(projectRoot, 'src/pages/api');
const appFilePath = path.join(projectRoot, 'src/App.tsx');
const navigationFilePath = path.join(projectRoot, 'src/config/navigation.ts');

function normalizeRoutePath(routePath: string): string {
  return routePath.replace(/\\/g, '/');
}

function walkFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isRouteInventoryEnabled(): boolean {
  const directFlag = process.env.ROUTE_INVENTORY_DASHBOARD_V1;
  const viteFlag = process.env.VITE_FF_ROUTE_INVENTORY_DASHBOARD_V1;
  return parseBooleanEnv(directFlag || viteFlag || 'false', false);
}

function collectApiRoutes(): string[] {
  const files = walkFiles(apiRoot)
    .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
    .filter((filePath) => !filePath.includes(`${path.sep}_utils${path.sep}`))
    .filter((filePath) => !/\.test\.tsx?$/.test(filePath));

  const routes = files.map((filePath) => {
    const relative = path.relative(apiRoot, filePath).replace(/\.(ts|tsx)$/, '');
    const withoutIndex = relative.replace(/\/index$/, '');
    return normalizeRoutePath(`/api/${withoutIndex}`);
  });
  return Array.from(new Set(routes)).sort();
}

function collectRoutesByPattern(filePath: string, pattern: RegExp): string[] {
  const source = readFileSync(filePath, 'utf8');
  const routes: string[] = [];
  let match = pattern.exec(source);
  while (match) {
    const route = String(match[1] || '').trim();
    if (route.startsWith('/')) routes.push(route);
    match = pattern.exec(source);
  }
  return Array.from(new Set(routes)).sort();
}

function buildRouteInventoryPayload(enabled: boolean): RouteInventoryPayload {
  const appRoutes = enabled ? collectRoutesByPattern(appFilePath, /path\s*=\s*["'`]([^"'`]+)["'`]/g) : [];
  const menuRoutes = enabled ? collectRoutesByPattern(navigationFilePath, /path:\s*['"]([^'"]+)['"]/g) : [];
  const apiRoutes = enabled ? collectApiRoutes() : [];
  const transitionTelemetryRecords = getCompatibilityTransitionTelemetrySnapshot(300);
  const featureFlagConfig = getGatewayFeatureFlagConfigSnapshot();
  const featureFlagModules = Object.entries(featureFlagConfig.modules || {})
    .map(([key, module]) => ({
      key,
      enabled: module.enabled,
      emergencyKillSwitch: module.emergencyKillSwitch,
      rolloutPercent: module.rolloutPercent,
      tenantCohorts: module.tenantCohorts.length,
      franchiseCohorts: module.franchiseCohorts.length,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const totalEvents = transitionTelemetryRecords.reduce((sum, record) => sum + record.count, 0);
  const rollbackEvents = transitionTelemetryRecords
    .filter((record) => record.reason === 'global_revert_toggle')
    .reduce((sum, record) => sum + record.count, 0);

  return {
    generatedAt: new Date().toISOString(),
    featureFlag: {
      key: 'ROUTE_INVENTORY_DASHBOARD_V1',
      enabled,
    },
    featureFlagPlatform: {
      version: featureFlagConfig.version,
      checksum: featureFlagConfig.checksum,
      updatedAt: featureFlagConfig.updatedAt,
      globalKillSwitch: featureFlagConfig.globalKillSwitch,
      modules: featureFlagModules,
    },
    gateway: {
      globalRevertToLegacy: parseBooleanEnv(process.env.GATEWAY_ROUTE_GLOBAL_REVERT_TO_V1, false),
      facadeEnabled: parseBooleanEnv(process.env.GATEWAY_COMPAT_FACADE_V1, true),
      v2PrimaryEnabled: parseBooleanEnv(process.env.GATEWAY_V2_PRIMARY_ENABLED, false),
      v2ShadowEnabled: parseBooleanEnv(process.env.GATEWAY_V2_SHADOW_READ, false),
      transitionTelemetry: {
        records: transitionTelemetryRecords,
        totalEvents,
        rollbackEvents,
      },
    },
    web: {
      appRoutes,
      menuRoutes,
    },
    api: {
      routes: apiRoutes,
    },
    counts: {
      appRoutes: appRoutes.length,
      menuRoutes: menuRoutes.length,
      apiRoutes: apiRoutes.length,
    },
  };
}

export function generateGatewayRouteInventory(): RouteInventoryPayload {
  const enabled = isRouteInventoryEnabled();
  return buildRouteInventoryPayload(enabled);
}
