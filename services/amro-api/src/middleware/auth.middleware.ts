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
function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
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

    // Extract token from Authorization header
    const token = extractToken(req.headers.authorization) ?? extractTokenFromQuery(req);
    if (!token) {
      if (process.env.NODE_ENV !== 'production' && fallbackUserId && fallbackTenantId) {
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

    if (roleError) {
      if (!isRecoverableLookupError(roleError)) {
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
    const resolvedTenantId = requestedTenantId
      ? hasRequestedRoleTenant || hasPlatformAdminRole
        ? requestedTenantId
        : profileTenantId === requestedTenantId
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
    });
    res.status(statusCode).json({
      error: errorMessage,
      code: errorCode,
      statusCode,
    });
  }
}

export { AuthRequest };
