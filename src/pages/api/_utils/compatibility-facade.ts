import type { ApiRequest, ApiResponse } from './types';
import { resolveGatewayFeatureFlag } from './gateway-feature-flags';

export type CompatibilityMode = 'v1-pass' | 'v2-shadow' | 'v2-primary';
export type CompatibilityVersion = 'v1' | 'v2';

export type CompatibilityContext = {
  tenantId?: string | null;
  franchiseId?: string | null;
};

export type CompatibilityDecision = {
  apiVersion: CompatibilityVersion;
  compatMode: CompatibilityMode;
};

export type CompatibilityTransitionReason =
  | 'policy_resolution'
  | 'global_revert_toggle'
  | 'facade_disabled';

export type CompatibilityTransitionTelemetryRecord = {
  key: string;
  tenantId: string | null;
  franchiseId: string | null;
  from: CompatibilityDecision;
  to: CompatibilityDecision;
  reason: CompatibilityTransitionReason;
  count: number;
  lastObservedAt: string;
};

const transitionTelemetryCounters = new Map<string, CompatibilityTransitionTelemetryRecord>();
const TRANSITION_TELEMETRY_MAX_KEYS = 2000;

function readHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function parseCsvEnv(input: string): Set<string> {
  return new Set(
    String(input || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function parseBooleanEnv(input: string, fallback = false): boolean {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function normalizeScope(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
}

function buildTransitionCounterKey(
  from: CompatibilityDecision,
  to: CompatibilityDecision,
  reason: CompatibilityTransitionReason,
  tenantId: string | null,
  franchiseId: string | null
): string {
  return [
    reason,
    `${from.apiVersion}:${from.compatMode}`,
    `${to.apiVersion}:${to.compatMode}`,
    tenantId || 'tenant:*',
    franchiseId || 'franchise:*',
  ].join('|');
}

function trimTransitionTelemetryStore() {
  if (transitionTelemetryCounters.size < TRANSITION_TELEMETRY_MAX_KEYS) return;
  const oldestKey = transitionTelemetryCounters.keys().next().value;
  if (oldestKey) transitionTelemetryCounters.delete(oldestKey);
}

function recordCompatibilityTransitionTelemetry(
  from: CompatibilityDecision,
  to: CompatibilityDecision,
  reason: CompatibilityTransitionReason,
  ctx: CompatibilityContext
) {
  const tenantId = normalizeScope(ctx.tenantId);
  const franchiseId = normalizeScope(ctx.franchiseId);
  const key = buildTransitionCounterKey(from, to, reason, tenantId, franchiseId);
  const now = new Date().toISOString();
  const existing = transitionTelemetryCounters.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastObservedAt = now;
    transitionTelemetryCounters.set(key, existing);
    return;
  }
  trimTransitionTelemetryStore();
  transitionTelemetryCounters.set(key, {
    key,
    tenantId,
    franchiseId,
    from,
    to,
    reason,
    count: 1,
    lastObservedAt: now,
  });
}

function resolveRequestedVersion(req: ApiRequest): CompatibilityVersion {
  const versionHeader = readHeader(req.headers['x-api-version']).trim().toLowerCase();
  if (versionHeader === 'v2') return 'v2';
  const pathHint = String(req.query.api_version || '').trim().toLowerCase();
  if (pathHint === 'v2') return 'v2';
  return 'v1';
}

export function resolveGatewayCompatibility(req: ApiRequest, ctx: CompatibilityContext = {}): CompatibilityDecision {
  const requestedApiVersion = resolveRequestedVersion(req);
  const facadeGate = resolveGatewayFeatureFlag({
    moduleKey: 'gateway.compat-v2-primary',
    tenantId: ctx.tenantId,
    franchiseId: ctx.franchiseId,
  });
  const shadowGate = resolveGatewayFeatureFlag({
    moduleKey: 'gateway.compat-v2-shadow',
    tenantId: ctx.tenantId,
    franchiseId: ctx.franchiseId,
  });
  const facadeEnabled = parseBooleanEnv(process.env.GATEWAY_COMPAT_FACADE_V1 || 'true', true);
  const globalRevertToLegacy = parseBooleanEnv(process.env.GATEWAY_ROUTE_GLOBAL_REVERT_TO_V1 || 'false', false);
  let policyDecision: CompatibilityDecision = {
    apiVersion: requestedApiVersion,
    compatMode: 'v1-pass',
  };

  if (requestedApiVersion === 'v1') {
    policyDecision = { apiVersion: 'v1', compatMode: 'v1-pass' };
  } else {
    const tenantId = String(ctx.tenantId || '').trim();
    const franchiseId = String(ctx.franchiseId || '').trim();
    const primaryTenants = parseCsvEnv(process.env.GATEWAY_V2_PRIMARY_TENANTS || '');
    const primaryFranchises = parseCsvEnv(process.env.GATEWAY_V2_PRIMARY_FRANCHISES || '');
    const primaryEnabled = parseBooleanEnv(process.env.GATEWAY_V2_PRIMARY_ENABLED || 'false', false) || facadeGate.enabled;
    const shadowEnabled = parseBooleanEnv(process.env.GATEWAY_V2_SHADOW_READ || 'false', false) || shadowGate.enabled;
    const shadowTenants = parseCsvEnv(process.env.GATEWAY_V2_SHADOW_TENANTS || '');
    const shadowFranchises = parseCsvEnv(process.env.GATEWAY_V2_SHADOW_FRANCHISES || '');

    if (
      primaryEnabled ||
      (tenantId && primaryTenants.has(tenantId)) ||
      (franchiseId && primaryFranchises.has(franchiseId))
    ) {
      policyDecision = { apiVersion: 'v2', compatMode: 'v2-primary' };
    } else if (
      shadowEnabled ||
      (tenantId && shadowTenants.has(tenantId)) ||
      (franchiseId && shadowFranchises.has(franchiseId))
    ) {
      policyDecision = { apiVersion: 'v2', compatMode: 'v2-shadow' };
    } else {
      policyDecision = { apiVersion: 'v2', compatMode: 'v1-pass' };
    }
  }

  if (!facadeEnabled) {
    const finalDecision = { apiVersion: 'v1', compatMode: 'v1-pass' } as CompatibilityDecision;
    recordCompatibilityTransitionTelemetry(policyDecision, finalDecision, 'facade_disabled', ctx);
    return finalDecision;
  }
  if (globalRevertToLegacy) {
    const finalDecision = { apiVersion: 'v1', compatMode: 'v1-pass' } as CompatibilityDecision;
    recordCompatibilityTransitionTelemetry(policyDecision, finalDecision, 'global_revert_toggle', ctx);
    return finalDecision;
  }
  recordCompatibilityTransitionTelemetry(policyDecision, policyDecision, 'policy_resolution', ctx);
  return policyDecision;
}

export function applyCompatibilityResponseHeaders(
  res: ApiResponse,
  decision: CompatibilityDecision,
  correlationId: string
): void {
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-api-version', decision.apiVersion);
  res.setHeader('x-compat-mode', decision.compatMode);
}

export function getCompatibilityTransitionTelemetrySnapshot(limit = 200): CompatibilityTransitionTelemetryRecord[] {
  const safeLimit = Math.max(1, Math.min(Number(limit || 200), 1000));
  return Array.from(transitionTelemetryCounters.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastObservedAt.localeCompare(a.lastObservedAt);
    })
    .slice(0, safeLimit);
}

export function resetCompatibilityTransitionTelemetry(): void {
  transitionTelemetryCounters.clear();
}
