/**
 * Authentication Middleware
 * JWT token verification and tenant context extraction
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

interface AuthRequest extends Request {
  tenantId?: string;
  userId?: string;
  user?: any;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

/**
 * Verify JWT token and look up tenant_id from user_roles
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Extract token from Authorization header
    const token = extractToken(req.headers.authorization);
    if (!token) {
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

    // Look up tenant_id from user_roles table
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', userId)
      .not('tenant_id', 'is', null)
      .limit(1)
      .single();

    if (roleError || !userRoles?.tenant_id) {
      res.status(401).json({
        error: 'User has no tenant assignment',
        code: 'NO_TENANT_ASSIGNMENT',
        statusCode: 401,
      });
      return;
    }

    req.tenantId = userRoles.tenant_id;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({
      error: 'Internal server error during authentication',
      code: 'AUTH_ERROR',
      statusCode: 500,
    });
  }
}

export { AuthRequest };
