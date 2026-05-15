/**
 * Authentication Middleware
 * JWT token verification and tenant context extraction
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { executeWithResilience } from '../utils/resilience';

interface AuthRequest extends Request {
  tenantId?: string;
  franchiseId?: string | null;
  userId?: string;
  user?: any;
}

const supabaseUrl = String(
  process.env.AMRO_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '',
).replace(/\/$/, '');
const supabaseServiceKey =
  process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type TenantRoleScope = {
  role: string | null;
  tenant_id: string | null;
  franchise_id: string | null;
};

function roleRequiresFranchise(roleName: string): boolean {
  return ['franchise_admin', 'user', 'sales_manager', 'viewer'].includes(roleName);
}

type ParsedAuthorizationHeader = {
  present: boolean;
  rawHeader: string;
  rawPreview: string;
  rawLength: number;
  scheme: string | null;
  token: string | null;
  tokenLength: number;
  parseError: 'missing' | 'malformed' | 'unsupported_scheme' | null;
};

type AuthHeaderSource = 'authorization' | 'query' | 'none';

const authHeaderMonitoringOptions = {
  windowMs: Number(process.env.AMRO_AUTH_HEADER_MONITORING_WINDOW_MS || 300000),
  minSamples: Number(process.env.AMRO_AUTH_HEADER_MONITORING_MIN_SAMPLES || 30),
  alertFailurePercent: Number(process.env.AMRO_AUTH_HEADER_ALERT_FAILURE_PERCENT || 2),
  minAlertIntervalMs: Number(process.env.AMRO_AUTH_HEADER_MIN_ALERT_INTERVAL_MS || 60000),
};

const authHeaderMonitoringState = {
  totalChecks: 0,
  totalSuccess: 0,
  totalFailure: 0,
  failuresByReason: {} as Record<string, number>,
  lastAlertAt: 0,
  window: [] as Array<{ at: number; success: boolean; reason: string }>,
};

function buildHeaderPreview(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length <= 24) return normalized;
  return `${normalized.slice(0, 16)}...${normalized.slice(-8)}`;
}

function isRecoverableLookupError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code || '').trim();
  const message = String((error as { message?: unknown } | null)?.message || '').toLowerCase();
  if (code === '42P01' || code === '42703') return true;
  return (
    message.includes('does not exist') ||
    message.includes('undefined table') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

/**
 * Extract Bearer token from Authorization header
 */
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
      rawHeader: '',
      rawPreview: '',
      rawLength: 0,
      scheme: null,
      token: null,
      tokenLength: 0,
      parseError: 'missing',
    };
  }
  const parts = normalized.split(/\s+/);
  if (parts.length !== 2) {
    return {
      present: true,
      rawHeader: normalized,
      rawPreview: buildHeaderPreview(normalized),
      rawLength: normalized.length,
      scheme: null,
      token: null,
      tokenLength: 0,
      parseError: 'malformed',
    };
  }
  const [rawScheme, rawToken] = parts;
  const scheme = String(rawScheme || '').toLowerCase();
  const token = String(rawToken || '').trim();
  if (!token) {
    return {
      present: true,
      rawHeader: normalized,
      rawPreview: buildHeaderPreview(normalized),
      rawLength: normalized.length,
      scheme,
      token: null,
      tokenLength: 0,
      parseError: 'malformed',
    };
  }
  if (scheme !== 'bearer') {
    return {
      present: true,
      rawHeader: normalized,
      rawPreview: buildHeaderPreview(normalized),
      rawLength: normalized.length,
      scheme,
      token: null,
      tokenLength: token.length,
      parseError: 'unsupported_scheme',
    };
  }
  return {
    present: true,
    rawHeader: normalized,
    rawPreview: buildHeaderPreview(normalized),
    rawLength: normalized.length,
    scheme,
    token,
    tokenLength: token.length,
    parseError: null,
  };
}

function parseFlag(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isAuthFlowLoggingEnabled(): boolean {
  return parseFlag(process.env.AMRO_AUTH_HEADER_FLOW_LOG, true);
}

function shouldLogRawAuthorizationHeader(): boolean {
  return process.env.NODE_ENV !== 'production' || parseFlag(process.env.AMRO_AUTH_HEADER_LOG_RAW, false);
}

function recordAuthHeaderResult(success: boolean, reason: string, requestId: string, pathName: string): void {
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
      requestId,
      path: pathName,
      windowMs: authHeaderMonitoringOptions.windowMs,
      sampleCount,
      failureCount,
      failurePercent: Number(failurePercent.toFixed(2)),
      thresholdPercent: authHeaderMonitoringOptions.alertFailurePercent,
    });
  }
}

function resolveToken(req: Request): { token: string | null; source: AuthHeaderSource; parsedHeader: ParsedAuthorizationHeader } {
  const parsedHeader = parseAuthorizationHeader(req.headers.authorization);
  if (parsedHeader.token) {
    return {
      token: parsedHeader.token,
      source: 'authorization',
      parsedHeader,
    };
  }
  const queryToken = extractTokenFromQuery(req);
  if (queryToken) {
    return {
      token: queryToken,
      source: 'query',
      parsedHeader,
    };
  }
  return {
    token: null,
    source: 'none',
    parsedHeader,
  };
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

function extractTokenFromQuery(req: Request): string | null {
  const token = req.query.access_token;
  if (typeof token !== 'string') {
    return null;
  }
  const normalized = token.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Verify JWT token and look up tenant_id from user_roles
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = String(req.header('x-request-id') || '');
  try {
    const fallbackUserHeader = req.headers['x-user-id'];
    const fallbackUserId = typeof fallbackUserHeader === 'string'
      ? fallbackUserHeader.trim()
      : Array.isArray(fallbackUserHeader)
        ? String(fallbackUserHeader[0] || '').trim()
        : '';
    const fallbackTenantHeader = req.headers['x-tenant-id'];
    const fallbackTenantId = typeof fallbackTenantHeader === 'string'
      ? fallbackTenantHeader.trim()
      : Array.isArray(fallbackTenantHeader)
        ? String(fallbackTenantHeader[0] || '').trim()
        : '';

    const { token, source, parsedHeader } = resolveToken(req);
    if (isAuthFlowLoggingEnabled()) {
      logger.info('Auth header flow check', {
        requestId,
        path: req.path,
        method: req.method,
        headerPresent: parsedHeader.present,
        headerLength: parsedHeader.rawLength,
        scheme: parsedHeader.scheme,
        tokenSource: source,
        parseError: parsedHeader.parseError,
        tokenLength: parsedHeader.tokenLength,
        authorizationHeader: shouldLogRawAuthorizationHeader() ? parsedHeader.rawHeader : parsedHeader.rawPreview,
      });
    }
    if (!token) {
      if (process.env.NODE_ENV !== 'production' && fallbackUserId && fallbackTenantId) {
        recordAuthHeaderResult(true, 'fallback_headers', requestId, req.path);
        req.userId = fallbackUserId;
        req.tenantId = fallbackTenantId;
        req.user = {
          id: fallbackUserId,
          app_metadata: { tenant_id: fallbackTenantId },
          user_metadata: { tenant_id: fallbackTenantId },
        };
        next();
        return;
      }
      recordAuthHeaderResult(false, parsedHeader.parseError || 'missing', requestId, req.path);
      logger.warn('Authorization header validation failed', {
        requestId,
        path: req.path,
        method: req.method,
        headerPresent: parsedHeader.present,
        scheme: parsedHeader.scheme,
        parseError: parsedHeader.parseError,
        tokenSource: source,
        authorizationHeader: shouldLogRawAuthorizationHeader() ? parsedHeader.rawHeader : parsedHeader.rawPreview,
      });
      res.status(401).json({
        error: 'Missing or malformed Authorization header',
        code: 'MISSING_TOKEN',
        statusCode: 401,
      });
      return;
    }

    // Verify token with Supabase
    const { data, error } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: 'auth.getUser',
        requestId,
      },
      async () => supabase.auth.getUser(token),
    );
    if (error || !data.user) {
      recordAuthHeaderResult(false, 'invalid_token', requestId, req.path);
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
        statusCode: 401,
      });
      return;
    }

    const userId = data.user.id;
    req.userId = userId;
    req.user = data.user;

    const requestedTenantHeader = req.headers['x-tenant-id'];
    const requestedTenantRaw =
      typeof requestedTenantHeader === 'string'
        ? requestedTenantHeader
        : Array.isArray(requestedTenantHeader)
          ? requestedTenantHeader[0]
          : '';
    const requestedTenantId = requestedTenantRaw.trim().length > 0 ? requestedTenantRaw.trim() : null;

    const requestedFranchiseHeader = req.headers['x-franchise-id'];
    const requestedFranchiseRaw =
      typeof requestedFranchiseHeader === 'string'
        ? requestedFranchiseHeader
        : Array.isArray(requestedFranchiseHeader)
          ? requestedFranchiseHeader[0]
          : '';
    const requestedFranchiseId = requestedFranchiseRaw.trim().length > 0 ? requestedFranchiseRaw.trim() : null;

    const { data: userRoles, error: roleError } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: 'auth.user_roles.lookup',
        requestId,
        tenantId: requestedTenantId || undefined,
      },
      async () =>
        await supabase
          .from('user_roles')
          .select('role, tenant_id, franchise_id')
          .eq('user_id', userId),
    );

    const roleLookupRecoverable = Boolean(roleError && isRecoverableLookupError(roleError));
    if (roleError) {
      if (!roleLookupRecoverable) {
        res.status(500).json({
          error: 'Failed to resolve tenant assignment',
          code: 'TENANT_LOOKUP_FAILED',
          statusCode: 500,
        });
        return;
      }
      logger.warn('Auth middleware user_roles lookup unavailable; continuing with fallback resolution', {
        userId,
        error: String((roleError as any)?.message || ''),
        code: String((roleError as any)?.code || ''),
      });
    }

    const scopedRoles = (Array.isArray(userRoles) ? userRoles : []) as TenantRoleScope[];
    const hasPlatformAdminRole = scopedRoles.some((role) => String(role.role || '') === 'platform_admin');

    if (requestedFranchiseId && !requestedTenantId) {
      res.status(400).json({
        error: 'Franchise scope requires tenant scope',
        code: 'INVALID_SCOPE',
        statusCode: 400,
      });
      return;
    }

    for (const role of scopedRoles) {
      const roleName = String(role.role || '').trim();
      if (!roleName) {
        res.status(401).json({
          error: 'Invalid user role assignment',
          code: 'INVALID_ROLE_SCOPE',
          statusCode: 401,
        });
        return;
      }

      const isPlatformScoped = roleName === 'platform_admin' || roleName === 'platform_domain_admin';
      if (!isPlatformScoped && !String(role.tenant_id || '').trim()) {
        res.status(401).json({
          error: 'User has an invalid tenant assignment',
          code: 'INVALID_ROLE_SCOPE',
          statusCode: 401,
        });
        return;
      }

      if (roleRequiresFranchise(roleName) && !String(role.franchise_id || '').trim()) {
        res.status(401).json({
          error: 'User has an invalid franchise assignment',
          code: 'INVALID_ROLE_SCOPE',
          statusCode: 401,
        });
        return;
      }
    }

    const normalizedRoleTenantIds = scopedRoles
      .map((role) => String(role.tenant_id || '').trim())
      .filter((tenantId) => tenantId.length > 0);
    const hasRequestedRoleTenant = requestedTenantId
      ? normalizedRoleTenantIds.includes(requestedTenantId)
      : false;
    const defaultRoleTenantId = normalizedRoleTenantIds[0] || null;
    const roleFranchiseIds = scopedRoles
      .map((role) => String(role.franchise_id || '').trim())
      .filter((franchiseId) => franchiseId.length > 0);

    if (requestedTenantId && requestedFranchiseId) {
      if (roleLookupRecoverable) {
        res.status(503).json({
          error: 'Unable to validate franchise scope',
          code: 'SCOPE_VALIDATION_UNAVAILABLE',
          statusCode: 503,
        });
        return;
      }

      const canAccessRequested = hasPlatformAdminRole || scopedRoles.some((role) => {
        if (String(role.tenant_id || '').trim() !== requestedTenantId) return false;
        if (String(role.role || '').trim() === 'tenant_admin' && !String(role.franchise_id || '').trim()) return true;
        return String(role.franchise_id || '').trim() === requestedFranchiseId;
      });

      if (!canAccessRequested) {
        res.status(403).json({
          error: 'Requested tenant/franchise scope is not assigned to the user',
          code: 'FORBIDDEN_SCOPE',
          statusCode: 403,
        });
        return;
      }

      const { data: franchiseScopeRow, error: franchiseScopeError } = await executeWithResilience(
        {
          dependency: 'supabase',
          operation: 'auth.franchise.scope.validate',
          requestId,
          tenantId: requestedTenantId,
        },
        async () =>
          await supabase
            .from('franchises')
            .select('tenant_id')
            .eq('id', requestedFranchiseId)
            .maybeSingle(),
      );

      if (franchiseScopeError || !franchiseScopeRow?.tenant_id || String(franchiseScopeRow.tenant_id) !== requestedTenantId) {
        res.status(403).json({
          error: 'Requested franchise scope does not belong to requested tenant',
          code: 'FORBIDDEN_SCOPE',
          statusCode: 403,
        });
        return;
      }
    }
    let franchiseResolvedTenantId: string | null = null;
    if (roleFranchiseIds.length > 0) {
      const { data: franchiseRows, error: franchiseError } = await executeWithResilience(
        {
          dependency: 'supabase',
          operation: 'auth.franchises.lookup',
          requestId,
          tenantId: requestedTenantId || undefined,
        },
        async () =>
          await supabase
            .from('franchises')
            .select('tenant_id')
            .in('id', roleFranchiseIds)
            .not('tenant_id', 'is', null)
            .limit(1),
      );
      if (franchiseError) {
        if (!isRecoverableLookupError(franchiseError)) {
          res.status(500).json({
            error: 'Failed to resolve franchise tenant assignment',
            code: 'FRANCHISE_TENANT_LOOKUP_FAILED',
            statusCode: 500,
          });
          return;
        }
        logger.warn('Auth middleware franchises lookup unavailable; skipping franchise tenant fallback', {
          userId,
          error: String((franchiseError as any)?.message || ''),
          code: String((franchiseError as any)?.code || ''),
        });
      } else {
        const firstFranchise = (Array.isArray(franchiseRows) ? franchiseRows[0] : null) as { tenant_id?: string | null } | null;
        franchiseResolvedTenantId = String(firstFranchise?.tenant_id || '').trim() || null;
      }
    }

    const { data: profile, error: profileError } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: 'auth.profiles.lookup',
        requestId,
        tenantId: requestedTenantId || undefined,
      },
      async () =>
        await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', userId)
          .maybeSingle(),
    );

    if (profileError) {
      if (!isRecoverableLookupError(profileError)) {
        res.status(500).json({
          error: 'Failed to resolve profile tenant assignment',
          code: 'PROFILE_TENANT_LOOKUP_FAILED',
          statusCode: 500,
        });
        return;
      }
      logger.warn('Auth middleware profiles lookup unavailable; continuing with fallback resolution', {
        userId,
        error: String((profileError as any)?.message || ''),
        code: String((profileError as any)?.code || ''),
      });
    }

    const profileTenantId = profileError ? '' : String((profile as { tenant_id?: string | null } | null)?.tenant_id || '').trim();
    const { data: preferences, error: preferenceError } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: 'auth.user_preferences.lookup',
        requestId,
        tenantId: requestedTenantId || undefined,
      },
      async () =>
        await supabase
          .from('user_preferences')
          .select('tenant_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle(),
    );

    if (preferenceError) {
      if (!isRecoverableLookupError(preferenceError)) {
        res.status(500).json({
          error: 'Failed to resolve preference tenant assignment',
          code: 'PREFERENCE_TENANT_LOOKUP_FAILED',
          statusCode: 500,
        });
        return;
      }
      logger.warn('Auth middleware user_preferences lookup unavailable; continuing with fallback resolution', {
        userId,
        error: String((preferenceError as any)?.message || ''),
        code: String((preferenceError as any)?.code || ''),
      });
    }

    const preferenceTenantId = preferenceError ? '' : String((preferences as { tenant_id?: string | null } | null)?.tenant_id || '').trim();
    const metadataTenantId = String(
      ((data.user.app_metadata as Record<string, unknown> | undefined)?.tenant_id ||
        (data.user.user_metadata as Record<string, unknown> | undefined)?.tenant_id ||
        '') as string,
    ).trim();
    const allowHeaderFallback = roleLookupRecoverable && process.env.NODE_ENV !== 'production';
    const resolvedTenantId = requestedTenantId
      ? hasRequestedRoleTenant || hasPlatformAdminRole || allowHeaderFallback
        ? requestedTenantId
        : profileTenantId === requestedTenantId ||
            preferenceTenantId === requestedTenantId ||
            metadataTenantId === requestedTenantId ||
            franchiseResolvedTenantId === requestedTenantId
          ? requestedTenantId
          : null
      : defaultRoleTenantId || franchiseResolvedTenantId || profileTenantId || preferenceTenantId || metadataTenantId || null;

    if (!resolvedTenantId) {
      res.status(401).json({
        error: 'User has no tenant assignment',
        code: 'NO_TENANT_ASSIGNMENT',
        statusCode: 401,
      });
      return;
    }

    req.tenantId = resolvedTenantId;
    const hasTenantAdminRole = scopedRoles.some((role) => String(role.role || '').trim() === 'tenant_admin' && String(role.tenant_id || '').trim() === resolvedTenantId);
    let resolvedFranchiseId: string | null = null;
    if (requestedFranchiseId) {
      resolvedFranchiseId = requestedFranchiseId;
    } else if (!hasTenantAdminRole) {
      resolvedFranchiseId = roleFranchiseIds[0] || null;
    }

    if (resolvedFranchiseId) {
      const { data: franchiseRow, error: franchiseError } = await executeWithResilience(
        {
          dependency: 'supabase',
          operation: 'auth.franchise.resolve',
          requestId,
          tenantId: resolvedTenantId,
        },
        async () =>
          await supabase
            .from('franchises')
            .select('tenant_id')
            .eq('id', resolvedFranchiseId)
            .maybeSingle(),
      );

      if (franchiseError || !franchiseRow?.tenant_id || String(franchiseRow.tenant_id) !== resolvedTenantId) {
        res.status(403).json({
          error: 'Resolved franchise scope does not belong to resolved tenant',
          code: 'FORBIDDEN_SCOPE',
          statusCode: 403,
        });
        return;
      }
    }

    req.franchiseId = resolvedFranchiseId;
    recordAuthHeaderResult(true, source === 'authorization' ? 'authorization' : source === 'query' ? 'query' : 'fallback', requestId, req.path);
    next();
  } catch (err) {
    const statusCode = Number((err as { statusCode?: unknown } | null)?.statusCode || 500);
    const errorCode = String((err as { code?: unknown } | null)?.code || 'AUTH_ERROR');
    const errorMessage =
      statusCode >= 500
        ? 'Internal server error during authentication'
        : String((err as { message?: unknown } | null)?.message || 'Authentication failed');
    logger.error('Auth middleware error', {
      requestId,
      statusCode,
      errorCode,
      message: String((err as { message?: unknown } | null)?.message || ''),
      headersSent: res.headersSent,
    });
    if (res.headersSent) {
      return;
    }
    res.status(statusCode).json({
      error: errorMessage,
      code: errorCode,
      statusCode,
    });
  }
}

export { AuthRequest };
