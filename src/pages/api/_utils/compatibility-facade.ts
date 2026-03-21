import type { ApiRequest, ApiResponse } from './types';

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

function resolveRequestedVersion(req: ApiRequest): CompatibilityVersion {
  const versionHeader = readHeader(req.headers['x-api-version']).trim().toLowerCase();
  if (versionHeader === 'v2') return 'v2';
  const pathHint = String(req.query.api_version || '').trim().toLowerCase();
  if (pathHint === 'v2') return 'v2';
  return 'v1';
}

export function resolveGatewayCompatibility(req: ApiRequest, ctx: CompatibilityContext = {}): CompatibilityDecision {
  const apiVersion = resolveRequestedVersion(req);
  const facadeEnabled = parseBooleanEnv(process.env.GATEWAY_COMPAT_FACADE_V1 || 'true', true);
  if (!facadeEnabled) {
    return { apiVersion: 'v1', compatMode: 'v1-pass' };
  }

  if (apiVersion === 'v1') {
    return { apiVersion: 'v1', compatMode: 'v1-pass' };
  }

  const tenantId = String(ctx.tenantId || '').trim();
  const franchiseId = String(ctx.franchiseId || '').trim();
  const primaryTenants = parseCsvEnv(process.env.GATEWAY_V2_PRIMARY_TENANTS || '');
  const primaryFranchises = parseCsvEnv(process.env.GATEWAY_V2_PRIMARY_FRANCHISES || '');
  const primaryEnabled = parseBooleanEnv(process.env.GATEWAY_V2_PRIMARY_ENABLED || 'false', false);
  const shadowEnabled = parseBooleanEnv(process.env.GATEWAY_V2_SHADOW_READ || 'false', false);
  const shadowTenants = parseCsvEnv(process.env.GATEWAY_V2_SHADOW_TENANTS || '');
  const shadowFranchises = parseCsvEnv(process.env.GATEWAY_V2_SHADOW_FRANCHISES || '');

  if (
    primaryEnabled ||
    (tenantId && primaryTenants.has(tenantId)) ||
    (franchiseId && primaryFranchises.has(franchiseId))
  ) {
    return { apiVersion: 'v2', compatMode: 'v2-primary' };
  }

  if (
    shadowEnabled ||
    (tenantId && shadowTenants.has(tenantId)) ||
    (franchiseId && shadowFranchises.has(franchiseId))
  ) {
    return { apiVersion: 'v2', compatMode: 'v2-shadow' };
  }

  return { apiVersion: 'v2', compatMode: 'v1-pass' };
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
