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

function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
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

    const token = extractToken(req.headers.authorization);
    if (!token) {
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
