/**
 * Authentication Middleware
 * JWT token verification and tenant context extraction
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

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
    const { data, error } = await supabase.auth.getUser(token);
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

    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', userId);

    if (roleError) {
      res.status(500).json({
        error: 'Failed to resolve tenant assignment',
        code: 'TENANT_LOOKUP_FAILED',
        statusCode: 500,
      });
      return;
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
      const { data: franchiseRows, error: franchiseError } = await supabase
        .from('franchises')
        .select('tenant_id')
        .in('id', roleFranchiseIds)
        .not('tenant_id', 'is', null)
        .limit(1);
      if (franchiseError) {
        res.status(500).json({
          error: 'Failed to resolve franchise tenant assignment',
          code: 'FRANCHISE_TENANT_LOOKUP_FAILED',
          statusCode: 500,
        });
        return;
      }
      const firstFranchise = (Array.isArray(franchiseRows) ? franchiseRows[0] : null) as { tenant_id?: string | null } | null;
      franchiseResolvedTenantId = String(firstFranchise?.tenant_id || '').trim() || null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      res.status(500).json({
        error: 'Failed to resolve profile tenant assignment',
        code: 'PROFILE_TENANT_LOOKUP_FAILED',
        statusCode: 500,
      });
      return;
    }

    const profileTenantId = String((profile as { tenant_id?: string | null } | null)?.tenant_id || '').trim();
    const { data: preferences, error: preferenceError } = await supabase
      .from('user_preferences')
      .select('tenant_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (preferenceError) {
      res.status(500).json({
        error: 'Failed to resolve preference tenant assignment',
        code: 'PREFERENCE_TENANT_LOOKUP_FAILED',
        statusCode: 500,
      });
      return;
    }

    const preferenceTenantId = String((preferences as { tenant_id?: string | null } | null)?.tenant_id || '').trim();
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
    logger.error('Auth middleware error:', err);
    res.status(500).json({
      error: 'Internal server error during authentication',
      code: 'AUTH_ERROR',
      statusCode: 500,
    });
  }
}

export { AuthRequest };
