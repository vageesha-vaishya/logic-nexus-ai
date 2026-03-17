import type { ApiRequest, ApiResponse } from './types';
import { ServiceUnavailableException } from './errors';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { logger } from '@/lib/logger';

const rateStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;
const DEFAULT_EMERGENCY_BLOCKED_EMAILS = ['bahuguna.vimal001@gmail.com'];
const ALLOW_GLOBAL_PLATFORM_SCOPE = String(process.env.ALLOW_GLOBAL_PLATFORM_SCOPE || '').trim().toLowerCase() === 'true';

function parseEmergencyBlockedEmails(): string[] {
  const configured = String(process.env.EMERGENCY_BLOCKED_EMAILS || '').trim();
  if (!configured) return DEFAULT_EMERGENCY_BLOCKED_EMAILS;
  return configured
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseEmergencyBlockedUserIds(): string[] {
  return String(process.env.EMERGENCY_BLOCKED_USER_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isEmergencyBlockedPrincipal(userId: string, email: string): boolean {
  const blockedEmails = new Set(parseEmergencyBlockedEmails());
  const blockedUserIds = new Set(parseEmergencyBlockedUserIds());
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail && blockedEmails.has(normalizedEmail)) return true;
  if (userId && blockedUserIds.has(userId)) return true;
  return false;
}

export type ApiContext = {
  correlationId: string;
  tenantId: string;
  franchiseId: string;
  userId: string;
  role: string;
  isPlatformAdmin: boolean;
  adminOverrideEnabled: boolean;
};

export type UserAccessProfile = {
  userId: string;
  roles: string[];
  isPlatformAdmin: boolean;
  tenantId: string | null;
  franchiseId: string | null;
  adminOverrideEnabled: boolean;
  overrideTenantId: string | null;
  overrideFranchiseId: string | null;
};

function normalizeDomainCodes(rows: any[]): string[] {
  const seen = new Set<string>();
  for (const row of rows || []) {
    const code = String(row?.platform_domains?.code || row?.code || '').trim().toUpperCase();
    if (code) seen.add(code);
  }
  return Array.from(seen);
}

function isMissingRelationError(error: any): boolean {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('does not exist') || message.includes('undefined table');
}

async function resolveTenantPrimaryDomainCode(supabase: any, tenantId: string): Promise<string[]> {
  const { data: tenantRow, error: tenantError } = await supabase
    .from('tenants')
    .select('domain_id')
    .eq('id', tenantId)
    .limit(1)
    .maybeSingle();

  if (tenantError) {
    throw new Error(`Failed to resolve tenant fallback domain: ${tenantError.message}`);
  }

  const domainId = tenantRow?.domain_id ? String(tenantRow.domain_id) : '';
  if (!domainId) {
    return [];
  }

  const { data: domainRow, error: domainError } = await supabase
    .from('platform_domains')
    .select('code')
    .eq('id', domainId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (domainError) {
    throw new Error(`Failed to resolve tenant fallback domain: ${domainError.message}`);
  }

  const fallbackCode = String(domainRow?.code || '').trim().toUpperCase();
  return fallbackCode ? [fallbackCode] : [];
}

async function resolveTenantDomainCodes(supabase: any, tenantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenant_domain_assignments')
    .select('platform_domains!inner(code)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) {
    if (!isMissingRelationError(error)) {
      throw new Error(`Failed to resolve tenant domains: ${error.message}`);
    }
    logger.warn('[DomainAccess] tenant_domain_assignments table unavailable; using tenant primary domain fallback', {
      tenantId,
      error: String(error.message || ''),
      code: String(error.code || ''),
    });
    return resolveTenantPrimaryDomainCode(supabase, tenantId);
  }

  const tenantDomainCodes = normalizeDomainCodes(data || []);
  if (tenantDomainCodes.length > 0) {
    return tenantDomainCodes;
  }

  logger.warn('[DomainAccess] tenant has no active tenant_domain_assignments; using tenant primary domain fallback', {
    tenantId,
  });
  return resolveTenantPrimaryDomainCode(supabase, tenantId);
}

async function resolveUserAssignedDomainCodes(
  supabase: any,
  userId: string,
  tenantId: string,
  tenantDomainCodes: string[]
): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_domain_assignments')
    .select('platform_domains!inner(code)')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) {
    if (!isMissingRelationError(error)) {
      throw new Error(`Failed to resolve domain assignments: ${error.message}`);
    }
    logger.warn('[DomainAccess] user_domain_assignments table unavailable; using tenant-level domain access fallback', {
      tenantId,
      userId,
      error: String(error.message || ''),
      code: String(error.code || ''),
    });
    return tenantDomainCodes;
  }

  const assignedCodes = normalizeDomainCodes(data || []);
  return assignedCodes.filter((code) => tenantDomainCodes.includes(code));
}

type CorsOptions = {
  methods?: string[];
};

export function parseHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export function getCorrelationId(req: ApiRequest): string {
  const fromHeader = parseHeaderValue(req.headers['x-correlation-id']);
  return fromHeader || crypto.randomUUID();
}

export function getClientIp(req: ApiRequest): string {
  const forwardedFor = parseHeaderValue(req.headers['x-forwarded-for']);
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = parseHeaderValue(req.headers['x-real-ip']);
  return realIp || 'unknown';
}

function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCookieMap(headerValue: string): Record<string, string> {
  if (!headerValue) return {};
  return headerValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, segment) => {
      const eqIndex = segment.indexOf('=');
      if (eqIndex <= 0) return acc;
      const key = segment.slice(0, eqIndex).trim();
      const value = segment.slice(eqIndex + 1).trim();
      if (key) acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {});
}

function parsePermissionHeader(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function applyCors(req: ApiRequest, res: ApiResponse, options: CorsOptions = {}): void {
  const origin = parseHeaderValue(req.headers.origin);
  const allowedOrigins = getAllowedOrigins();
  const methods = options.methods && options.methods.length > 0 ? options.methods : ['GET', 'OPTIONS'];
  const normalizedMethods = Array.from(new Set([...methods, 'OPTIONS']));

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', normalizedMethods.join(','));
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Cookie,x-csrf-token,x-tenant-id,x-domain-id,x-user-id,x-user-role,x-user-permissions,x-correlation-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export function enforceHttps(req: ApiRequest): void {
  if (process.env.NODE_ENV !== 'production') return;
  const proto = parseHeaderValue(req.headers['x-forwarded-proto']).toLowerCase();
  if (proto && proto !== 'https') {
    throw new Error('HTTPS required');
  }
}

export function handlePreflight(req: ApiRequest, res: ApiResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function enforceCsrfProtection(req: ApiRequest): void {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const csrfHeader = parseHeaderValue(req.headers['x-csrf-token']).trim();
  const cookieMap = parseCookieMap(parseHeaderValue(req.headers.cookie));
  const csrfCookie = String(cookieMap.csrf_token || '').trim();

  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    throw new Error('CSRF validation failed');
  }

  const allowedOrigins = getAllowedOrigins();
  const origin = parseHeaderValue(req.headers.origin).trim();
  if (origin && !allowedOrigins.includes(origin)) {
    throw new Error('CSRF validation failed');
  }

  const referer = parseHeaderValue(req.headers.referer).trim();
  if (!origin && referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        throw new Error('CSRF validation failed');
      }
    } catch {
      throw new Error('CSRF validation failed');
    }
  }
}

export function enforceRateLimit(req: ApiRequest, tenantId: string = ''): void {
  const ip = getClientIp(req);
  const scope = tenantId.trim() || 'global';
  const key = `${ip}:${scope}`;
  const now = Date.now();
  const existing = rateStore.get(key);
  if (!existing || existing.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  existing.count += 1;
  if (existing.count > RATE_LIMIT) {
    throw new ServiceUnavailableException('Rate limit exceeded. Try again later.');
  }
}

export function sanitizeQueryId(value: unknown, fieldName: string): string {
  const raw = Array.isArray(value) ? String(value[0] || '') : String(value || '');
  const normalized = raw.trim();
  if (!normalized) return '';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(normalized)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
  return normalized;
}

export async function authenticateRequest(req: ApiRequest): Promise<{ userId: string; role: string; permissions: string[] }> {
  const authHeader = parseHeaderValue(req.headers.authorization);
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  const fallbackUserId = parseHeaderValue(req.headers['x-user-id']);
  const fallbackPermissions = parsePermissionHeader(parseHeaderValue(req.headers['x-user-permissions']));
  if (!token) {
    if (process.env.NODE_ENV !== 'production' && fallbackUserId) {
      return {
        userId: fallbackUserId,
        role: parseHeaderValue(req.headers['x-user-role']) || 'developer',
        permissions: fallbackPermissions,
      };
    }
    throw new Error('Unauthorized');
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error('Unauthorized');
  }
  const userEmail = String((data.user as any).email || '').trim().toLowerCase();
  if (isEmergencyBlockedPrincipal(data.user.id, userEmail)) {
    logger.error('[AccessControl] emergency user block enforced', {
      userId: data.user.id,
      email: userEmail || null,
    });
    throw new Error('Unauthorized');
  }

  const role = String((data.user as any).app_metadata?.role || 'user');
  const rawPermissions = (data.user as any).app_metadata?.permissions;
  const permissions = Array.isArray(rawPermissions)
    ? rawPermissions.map((item: unknown) => String(item))
    : [];
  return { userId: data.user.id, role, permissions };
}

export async function resolveUserAccessProfile(userId: string): Promise<UserAccessProfile> {
  const supabase = getSupabaseAdminClient();
  const [{ data: roleRows, error: rolesError }, { data: prefRow, error: prefError }] = await Promise.all([
    supabase
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', userId),
    supabase
      .from('user_preferences')
      .select('tenant_id, franchise_id, admin_override_enabled')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (rolesError) {
    throw new Error(`Failed to resolve roles: ${rolesError.message}`);
  }
  if (prefError) {
    throw new Error(`Failed to resolve scope preference: ${prefError.message}`);
  }

  const roles = Array.isArray(roleRows)
    ? roleRows.map((row: any) => String(row?.role || '')).filter(Boolean)
    : [];
  const isPlatformAdmin = roles.includes('platform_admin') || roles.includes('super_admin');
  const isTenantAdmin = roles.includes('tenant_admin');
  const effectiveRoleRows = Array.isArray(roleRows) ? roleRows : [];
  const tenantScopedRole = effectiveRoleRows.find((row: any) => !!row?.tenant_id) || null;
  const franchiseScopedRole = effectiveRoleRows.find((row: any) => !!row?.franchise_id) || null;
  const roleTenantId = tenantScopedRole?.tenant_id ? String(tenantScopedRole.tenant_id) : null;
  const roleFranchiseId = franchiseScopedRole?.franchise_id ? String(franchiseScopedRole.franchise_id) : null;

  const adminOverrideEnabled = Boolean((prefRow as any)?.admin_override_enabled);
  const overrideTenantId = (prefRow as any)?.tenant_id ? String((prefRow as any).tenant_id) : null;
  const overrideFranchiseId = (prefRow as any)?.franchise_id ? String((prefRow as any).franchise_id) : null;

  const tenantId = isPlatformAdmin && adminOverrideEnabled
    ? (overrideTenantId || roleTenantId)
    : roleTenantId;
  const franchiseId = (isPlatformAdmin || isTenantAdmin) && adminOverrideEnabled
    ? (overrideFranchiseId || null)
    : roleFranchiseId;

  const normalizedUserId = String(userId || '').trim();
  const profileEmail = String((prefRow as any)?.email || '').trim().toLowerCase();
  const blocked = isEmergencyBlockedPrincipal(normalizedUserId, profileEmail);
  return {
    userId,
    roles,
    isPlatformAdmin: blocked ? false : isPlatformAdmin,
    tenantId,
    franchiseId,
    adminOverrideEnabled: blocked ? false : adminOverrideEnabled,
    overrideTenantId,
    overrideFranchiseId,
  };
}

export function enforceAdminOverrideScope(
  access: UserAccessProfile,
  requestedTenantId: string | null,
  requestedFranchiseId: string | null
): void {
  const targetTenant = requestedTenantId || null;
  const targetFranchise = requestedFranchiseId || null;

  if (!access.isPlatformAdmin) {
    if (targetTenant && targetTenant !== access.tenantId) {
      throw new Error('Forbidden');
    }
    if (targetFranchise && access.franchiseId && targetFranchise !== access.franchiseId) {
      throw new Error('Forbidden');
    }
    return;
  }

  const ownershipTenantId = access.tenantId || access.overrideTenantId || null;
  if (!ALLOW_GLOBAL_PLATFORM_SCOPE && !ownershipTenantId) {
    throw new Error('Forbidden');
  }
  if (targetTenant && ownershipTenantId && targetTenant !== ownershipTenantId) {
    throw new Error('Forbidden');
  }
  if (access.adminOverrideEnabled && targetFranchise && targetFranchise !== access.franchiseId) {
    throw new Error('Forbidden');
  }
}

export async function resolveAndApplyAccessContext(req: ApiRequest, ctx: ApiContext): Promise<UserAccessProfile> {
  const access = await resolveUserAccessProfile(ctx.userId);
  const requestedTenantId = parseHeaderValue(req.headers['x-tenant-id']).trim() || null;
  const requestedFranchiseId = parseHeaderValue(req.headers['x-franchise-id']).trim() || null;

  enforceAdminOverrideScope(access, requestedTenantId, requestedFranchiseId);

  const effectiveTenantId = access.tenantId || '';
  const effectiveFranchiseId = access.franchiseId || '';

  if (requestedTenantId && requestedTenantId !== effectiveTenantId) {
    logger.warn('[AccessControl] tenant header mismatch blocked', {
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      requestedTenantId,
      effectiveTenantId: effectiveTenantId || null,
      isPlatformAdmin: access.isPlatformAdmin,
      adminOverrideEnabled: access.adminOverrideEnabled,
    });
  }

  if (requestedFranchiseId && requestedFranchiseId !== effectiveFranchiseId) {
    logger.warn('[AccessControl] franchise header mismatch blocked', {
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      requestedFranchiseId,
      effectiveFranchiseId: effectiveFranchiseId || null,
      isPlatformAdmin: access.isPlatformAdmin,
      adminOverrideEnabled: access.adminOverrideEnabled,
    });
  }

  ctx.tenantId = effectiveTenantId;
  ctx.franchiseId = effectiveFranchiseId;
  ctx.isPlatformAdmin = access.isPlatformAdmin;
  ctx.adminOverrideEnabled = access.adminOverrideEnabled;

  return access;
}

export async function enforceDomainAccess(
  access: UserAccessProfile,
  requestedDomainCode?: string | null
): Promise<{ authorizedDomainCodes: string[]; tenantDomainCount: number }> {
  const supabase = getSupabaseAdminClient();
  const normalizedDomainCode = String(requestedDomainCode || '').trim().toUpperCase();

  if (access.isPlatformAdmin && !access.tenantId) {
    const { data, error } = await supabase
      .from('platform_domains')
      .select('code')
      .eq('is_active', true);
    if (error) {
      throw new Error(`Failed to resolve domains: ${error.message}`);
    }
    const authorizedDomainCodes = (data || []).map((row: any) => String(row.code || '').toUpperCase()).filter(Boolean);
    if (normalizedDomainCode && !authorizedDomainCodes.includes(normalizedDomainCode)) {
      throw new Error('Forbidden');
    }
    return {
      authorizedDomainCodes,
      tenantDomainCount: authorizedDomainCodes.length,
    };
  }

  const tenantId = access.tenantId;
  if (!tenantId) {
    throw new Error('Forbidden');
  }
  const tenantDomainCodes = await resolveTenantDomainCodes(supabase, tenantId);

  if (access.isPlatformAdmin) {
    if (normalizedDomainCode && !tenantDomainCodes.includes(normalizedDomainCode)) {
      throw new Error('Forbidden');
    }
    return {
      authorizedDomainCodes: tenantDomainCodes,
      tenantDomainCount: tenantDomainCodes.length,
    };
  }

  if (tenantDomainCodes.length <= 1) {
    if (normalizedDomainCode && !tenantDomainCodes.includes(normalizedDomainCode)) {
      throw new Error('Forbidden');
    }
    return {
      authorizedDomainCodes: tenantDomainCodes,
      tenantDomainCount: tenantDomainCodes.length,
    };
  }

  const authorizedDomainCodes = await resolveUserAssignedDomainCodes(
    supabase,
    access.userId,
    tenantId,
    tenantDomainCodes
  );

  if (normalizedDomainCode && !authorizedDomainCodes.includes(normalizedDomainCode)) {
    throw new Error('Forbidden');
  }

  return {
    authorizedDomainCodes,
    tenantDomainCount: tenantDomainCodes.length,
  };
}

export function enforceRoles(role: string, allowedRoles: string[]): void {
  if (!allowedRoles.includes(role)) {
    throw new Error('Forbidden');
  }
}

export function enforceAnyPermission(grantedPermissions: string[], requiredPermissions: string[]): void {
  if (!requiredPermissions.length) return;
  if (grantedPermissions.includes('*')) return;
  const grantedSet = new Set(grantedPermissions);
  const hasAny = requiredPermissions.some((permission) => grantedSet.has(permission));
  if (!hasAny) {
    throw new Error('Forbidden');
  }
}

export function logApiEvent(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown>): void {
  const payload = { ...meta };
  if (level === 'info') logger.info(message, payload);
  else if (level === 'warn') logger.warn(message, payload);
  else logger.error(message, payload);
}

export function buildApiContext(req: ApiRequest): ApiContext {
  const correlationId = getCorrelationId(req);
  return {
    correlationId,
    tenantId: '',
    franchiseId: '',
    userId: '',
    role: '',
    isPlatformAdmin: false,
    adminOverrideEnabled: false,
  };
}
