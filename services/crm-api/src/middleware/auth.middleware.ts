import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  tenantId?: string;
  franchiseId?: string | null;
  userId?: string;
  user?: unknown;
}

type UserRoleScope = {
  role: string;
  tenant_id: string | null;
  franchise_id: string | null;
};

type ParsedAuthorizationHeader = {
  present: boolean;
  rawLength: number;
  scheme: string | null;
  token: string | null;
  parseError: 'missing' | 'malformed' | 'unsupported_scheme' | null;
};

const authHeaderMonitoringOptions = {
  windowMs: Number(process.env.CRM_AUTH_HEADER_MONITORING_WINDOW_MS || 300000),
  minSamples: Number(process.env.CRM_AUTH_HEADER_MONITORING_MIN_SAMPLES || 30),
  alertFailurePercent: Number(process.env.CRM_AUTH_HEADER_ALERT_FAILURE_PERCENT || 2),
  minAlertIntervalMs: Number(process.env.CRM_AUTH_HEADER_MIN_ALERT_INTERVAL_MS || 60000),
};

const authHeaderMonitoringState = {
  totalChecks: 0,
  totalSuccess: 0,
  totalFailure: 0,
  failuresByReason: {} as Record<string, number>,
  lastAlertAt: 0,
  window: [] as Array<{ at: number; success: boolean; reason: string }>,
};

function parseAuthorizationHeader(authHeader: string | string[] | undefined): ParsedAuthorizationHeader {
  const raw = typeof authHeader === 'string'
    ? authHeader
    : Array.isArray(authHeader)
      ? String(authHeader[0] || '')
      : '';
  const normalized = raw.trim();
  if (!normalized) {
    return {
      present: false,
      rawLength: 0,
      scheme: null,
      token: null,
      parseError: 'missing',
    };
  }
  const parts = normalized.split(/\s+/);
  if (parts.length !== 2) {
    return {
      present: true,
      rawLength: normalized.length,
      scheme: null,
      token: null,
      parseError: 'malformed',
    };
  }
  const [rawScheme, rawToken] = parts;
  const scheme = String(rawScheme || '').toLowerCase();
  const token = String(rawToken || '').trim();
  if (!token) {
    return {
      present: true,
      rawLength: normalized.length,
      scheme,
      token: null,
      parseError: 'malformed',
    };
  }
  if (scheme !== 'bearer') {
    return {
      present: true,
      rawLength: normalized.length,
      scheme,
      token: null,
      parseError: 'unsupported_scheme',
    };
  }
  return {
    present: true,
    rawLength: normalized.length,
    scheme,
    token,
    parseError: null,
  };
}

function parseFlag(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isAuthFlowLoggingEnabled(): boolean {
  return parseFlag(process.env.CRM_AUTH_HEADER_FLOW_LOG, true);
}

function recordAuthHeaderResult(success: boolean, reason: string, correlationId: string, pathName: string): void {
  const now = Date.now();
  authHeaderMonitoringState.totalChecks += 1;
  if (success) {
    authHeaderMonitoringState.totalSuccess += 1;
  } else {
    authHeaderMonitoringState.totalFailure += 1;
    authHeaderMonitoringState.failuresByReason[reason] =
      (authHeaderMonitoringState.failuresByReason[reason] || 0) + 1;
  }
  authHeaderMonitoringState.window.push({ at: now, success, reason });
  authHeaderMonitoringState.window = authHeaderMonitoringState.window.filter(
    (entry) => now - entry.at <= authHeaderMonitoringOptions.windowMs,
  );
  const sampleCount = authHeaderMonitoringState.window.length;
  const failureCount = authHeaderMonitoringState.window.filter((entry) => !entry.success).length;
  const failurePercent = sampleCount > 0 ? (failureCount / sampleCount) * 100 : 0;
  const shouldAlert = sampleCount >= authHeaderMonitoringOptions.minSamples
    && failurePercent >= authHeaderMonitoringOptions.alertFailurePercent
    && now - authHeaderMonitoringState.lastAlertAt >= authHeaderMonitoringOptions.minAlertIntervalMs;
  if (shouldAlert) {
    authHeaderMonitoringState.lastAlertAt = now;
    logger.error('[Monitoring Alert] Elevated authentication header failure rate', {
      correlationId,
      path: pathName,
      windowMs: authHeaderMonitoringOptions.windowMs,
      sampleCount,
      failureCount,
      failurePercent: Number(failurePercent.toFixed(2)),
      thresholdPercent: authHeaderMonitoringOptions.alertFailurePercent,
    });
  }
}

export function getAuthHeaderMonitoringSnapshot(): {
  totals: { checks: number; success: number; failure: number };
  failuresByReason: Record<string, number>;
  window: {
    sampleCount: number;
    failureCount: number;
    failurePercent: number;
    windowMs: number;
  };
  options: typeof authHeaderMonitoringOptions;
} {
  const now = Date.now();
  const windowEntries = authHeaderMonitoringState.window.filter(
    (entry) => now - entry.at <= authHeaderMonitoringOptions.windowMs,
  );
  const failureCount = windowEntries.filter((entry) => !entry.success).length;
  const sampleCount = windowEntries.length;
  return {
    totals: {
      checks: authHeaderMonitoringState.totalChecks,
      success: authHeaderMonitoringState.totalSuccess,
      failure: authHeaderMonitoringState.totalFailure,
    },
    failuresByReason: { ...authHeaderMonitoringState.failuresByReason },
    window: {
      sampleCount,
      failureCount,
      failurePercent: sampleCount > 0 ? Number(((failureCount / sampleCount) * 100).toFixed(2)) : 0,
      windowMs: authHeaderMonitoringOptions.windowMs,
    },
    options: authHeaderMonitoringOptions,
  };
}

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    const first = value[0]?.trim();
    return first ? first : null;
  }
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRequestedScope(req: AuthRequest): { tenantId: string | null; franchiseId: string | null } {
  const tenantId = normalizeHeaderValue(req.headers['x-tenant-id']);
  const franchiseId = normalizeHeaderValue(req.headers['x-franchise-id']);
  return { tenantId, franchiseId };
}

function isPlatformAdminRole(role: UserRoleScope): boolean {
  return role.role === 'platform_admin';
}

function canAccessScope(
  roles: UserRoleScope[],
  requestedTenantId: string,
  requestedFranchiseId: string | null
): boolean {
  return roles.some((role) => {
    if (role.tenant_id !== requestedTenantId) return false;
    if (!requestedFranchiseId) return true;
    if (role.role === 'tenant_admin' && !role.franchise_id) return true;
    return role.franchise_id === requestedFranchiseId;
  });
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const correlationHeader = typeof req.header === 'function'
      ? req.header('x-correlation-id')
      : req.headers['x-correlation-id'];
    const correlationId = String(
      Array.isArray(correlationHeader) ? correlationHeader[0] || '' : correlationHeader || '',
    );
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      res.status(500).json({
        error: 'Missing service environment configuration',
        code: 'MISSING_ENV',
        statusCode: 500
      });
      return;
    }

    const parsedHeader = parseAuthorizationHeader(req.headers.authorization);
    const token = parsedHeader.token;
    if (isAuthFlowLoggingEnabled()) {
      logger.info('Auth header flow check', {
        correlationId,
        path: req.path,
        method: req.method,
        headerPresent: parsedHeader.present,
        headerLength: parsedHeader.rawLength,
        scheme: parsedHeader.scheme,
        parseError: parsedHeader.parseError,
      });
    }
    if (!token) {
      recordAuthHeaderResult(false, parsedHeader.parseError || 'missing', correlationId, req.path);
      logger.warn('Authorization header validation failed', {
        correlationId,
        path: req.path,
        method: req.method,
        headerPresent: parsedHeader.present,
        scheme: parsedHeader.scheme,
        parseError: parsedHeader.parseError,
      });
      res.status(401).json({
        error: 'Missing or malformed Authorization header',
        code: 'MISSING_TOKEN',
        statusCode: 401
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      recordAuthHeaderResult(false, 'invalid_token', correlationId, req.path);
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
        statusCode: 401
      });
      return;
    }

    req.userId = data.user.id;
    req.user = data.user;

    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', data.user.id);

    if (roleError || !Array.isArray(userRoles) || userRoles.length === 0) {
      res.status(401).json({
        error: 'User has no tenant assignment',
        code: 'NO_TENANT_ASSIGNMENT',
        statusCode: 401
      });
      return;
    }

    const roles = userRoles as UserRoleScope[];
    const { tenantId: requestedTenantId, franchiseId: requestedFranchiseId } = resolveRequestedScope(req);
    const hasPlatformAdmin = roles.some(isPlatformAdminRole);

    if (requestedTenantId) {
      if (!hasPlatformAdmin && !canAccessScope(roles, requestedTenantId, requestedFranchiseId)) {
        res.status(403).json({
          error: 'Requested tenant/franchise scope is not assigned to the user',
          code: 'FORBIDDEN_SCOPE',
          statusCode: 403
        });
        return;
      }

      req.tenantId = requestedTenantId;
      req.franchiseId = requestedFranchiseId;
      recordAuthHeaderResult(true, 'authorization', correlationId, req.path);
      next();
      return;
    }

    const scopedRoles = roles
      .filter((role) => Boolean(role.tenant_id))
      .sort((left, right) => {
        const leftRank = left.franchise_id ? 1 : 0;
        const rightRank = right.franchise_id ? 1 : 0;
        return rightRank - leftRank;
      });
    const defaultRole = scopedRoles[0];

    if (!defaultRole?.tenant_id) {
      res.status(401).json({
        error: 'User has no tenant assignment',
        code: 'NO_TENANT_ASSIGNMENT',
        statusCode: 401
      });
      return;
    }

    req.tenantId = defaultRole.tenant_id;
    req.franchiseId = defaultRole.franchise_id ?? null;
    recordAuthHeaderResult(true, 'authorization', correlationId, req.path);
    next();
  } catch (err) {
    logger.error('Auth middleware error', err);
    res.status(500).json({
      error: 'Internal server error during authentication',
      code: 'AUTH_ERROR',
      statusCode: 500
    });
  }
}

export { AuthRequest };
