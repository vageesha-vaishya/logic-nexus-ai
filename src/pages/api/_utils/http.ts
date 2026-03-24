import type { ApiRequest, ApiResponse } from './types';
import { ServiceUnavailableException } from './errors';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { logger } from '@/lib/logger';

const rateStore = new Map<string, { count: number; resetAt: number }>();
const mutationStore = new Map<string, { count: number; targets: Set<string>; resetAt: number }>();
const tokenReplayStore = new Map<string, number>();
const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;
const MUTATION_RATE_LIMIT = 40;
const MUTATION_TARGET_LIMIT = 20;
const MAX_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_EMERGENCY_BLOCKED_EMAILS = ['bahuguna.vimal001@gmail.com'];
const ALLOW_GLOBAL_PLATFORM_SCOPE = String(process.env.ALLOW_GLOBAL_PLATFORM_SCOPE || '').trim().toLowerCase() === 'true';
const AMRO_DOMAIN_CODE = 'AMRO';
const AMRO_CACHE_TTL_MS = 15_000;
const amroAccessCache = new Map<string, { expiresAt: number; result: AmroDomainAccessResult }>();

async function writeAmroDomainAuditLog(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  params: {
    userId: string;
    tenantId: string;
    correlationId?: string;
    authorized: boolean;
    source: 'database' | 'cache' | 'fallback';
    subscriptionStatus: 'active' | 'grace_period' | 'inactive' | 'missing';
    graceUntil: string | null;
    deniedReason?: string | null;
    allowGracePeriod: boolean;
    validatedAt: string;
  }
) {
  const payload: Record<string, unknown> = {
    user_id: params.userId || null,
    action: 'AMRO_DOMAIN_ACCESS_CHECK',
    resource_type: 'amro_domain_access',
    tenant_id: params.tenantId,
    details: {
      correlationId: params.correlationId || null,
      authorized: params.authorized,
      source: params.source,
      subscriptionStatus: params.subscriptionStatus,
      graceUntil: params.graceUntil,
      deniedReason: params.deniedReason || null,
      allowGracePeriod: params.allowGracePeriod,
      validatedAt: params.validatedAt,
    },
  };

  const { error } = await supabase.from('audit_logs').insert(payload);
  if (error) {
    logger.warn('[AmroDomainAccess] audit log write failed', {
      tenantId: params.tenantId,
      userId: params.userId || null,
      correlationId: params.correlationId || null,
      message: String(error.message || ''),
    });
  }
}

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

export type AmroDomainAccessResult = {
  isAuthorized: boolean;
  subscriptionStatus: 'active' | 'grace_period' | 'inactive' | 'missing';
  graceUntil: string | null;
  validatedAt: string;
  source: 'database' | 'cache' | 'fallback';
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

function isMissingColumnError(error: any): boolean {
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' || message.includes('column') || message.includes('does not exist');
}

async function resolveTenantPrimaryDomainCode(supabase: any, tenantId: string): Promise<string[]> {
  const { data: tenantRow, error: tenantError } = await supabase
    .from('tenants')
    .select('domain_id')
    .eq('id', tenantId)
    .limit(1)
    .maybeSingle();

  if (tenantError) {
    if (isMissingRelationError(tenantError) || isMissingColumnError(tenantError)) {
      logger.warn('[DomainAccess] tenant fallback lookup unavailable; returning empty domain set', {
        tenantId,
        error: String(tenantError.message || ''),
        code: String(tenantError.code || ''),
      });
      return [];
    }
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
    if (isMissingRelationError(domainError) || isMissingColumnError(domainError)) {
      logger.warn('[DomainAccess] platform_domains lookup unavailable during fallback; returning empty domain set', {
        tenantId,
        error: String(domainError.message || ''),
        code: String(domainError.code || ''),
      });
      return [];
    }
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
  if (assignedCodes.length === 0) {
    return tenantDomainCodes;
  }
  return assignedCodes.filter((code) => tenantDomainCodes.includes(code));
}

type CorsOptions = {
  methods?: string[];
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length < 2) return null;
  try {
    const payloadSegment = segments[1] || '';
    const payloadJson = Buffer.from(payloadSegment, 'base64url').toString('utf8');
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseUnixSeconds(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function enforceWafPolicy(req: ApiRequest): void {
  const rawPath = String((req as any).url || (req as any).path || '').toLowerCase();
  if (rawPath.includes('../') || rawPath.includes('..\\')) {
    throw new Error('WAF policy violation');
  }
  const serialized = JSON.stringify({
    query: (req as any).query || {},
    body: (req as any).body || {},
  }).toLowerCase();
  const signatures = [
    /(\bor\b|\band\b)\s+\d+=\d+/,
    /union\s+select/,
    /drop\s+table/,
    /<script[\s>]/,
    /javascript:/,
    /%00/,
    /\.\.\//,
    /\.\.\\/,
  ];
  if (signatures.some((pattern) => pattern.test(serialized))) {
    throw new Error('WAF policy violation');
  }
}

function enforceSessionTokenPolicy(req: ApiRequest, token: string, userId: string): void {
  const payload = decodeJwtPayload(token);
  if (!payload) return;
  const nowMs = Date.now();
  const expSeconds = parseUnixSeconds(payload.exp);
  const iatSeconds = parseUnixSeconds(payload.iat);
  if (expSeconds && expSeconds * 1000 <= nowMs) {
    throw new Error('Unauthorized');
  }
  if (expSeconds && iatSeconds && expSeconds - iatSeconds > MAX_ACCESS_TOKEN_TTL_SECONDS) {
    throw new Error('Unauthorized');
  }
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const rotationHeader = parseHeaderValue(req.headers['x-token-rotation-id']).trim();
  const jti = String(payload.jti || '').trim();
  const rotationId = rotationHeader || jti;
  if (!rotationId) {
    throw new Error('Unauthorized');
  }
  const replayKey = `${userId}:${rotationId}`;
  const existingExpiry = tokenReplayStore.get(replayKey);
  if (existingExpiry && existingExpiry > nowMs) {
    throw new Error('Unauthorized');
  }
  const maxExpiryMs = nowMs + MAX_ACCESS_TOKEN_TTL_SECONDS * 1000;
  const tokenExpiryMs = expSeconds ? expSeconds * 1000 : maxExpiryMs;
  tokenReplayStore.set(replayKey, Math.min(tokenExpiryMs, maxExpiryMs));
}

function getMutationTargetSignature(req: ApiRequest): string {
  const query = (req as any).query || {};
  const body = (req as any).body || {};
  const segments = [
    String(query.interface || '').trim(),
    String(query.id || '').trim(),
    String(body.task_id || '').trim(),
    String(body.work_package_id || '').trim(),
    String(body.action || '').trim(),
  ].filter(Boolean);
  return segments.join(':') || 'generic-mutation';
}

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

function isLoopbackRequest(req: ApiRequest): boolean {
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const hostHeader = parseHeaderValue(req.headers.host).trim().toLowerCase();
  if (hostHeader) {
    const hostName = hostHeader.split(':')[0];
    if (localHosts.has(hostName)) {
      return true;
    }
  }
  const originHeader = parseHeaderValue(req.headers.origin).trim();
  if (originHeader) {
    try {
      const originHost = new URL(originHeader).hostname.toLowerCase();
      if (localHosts.has(originHost)) {
        return true;
      }
    } catch {
      return false;
    }
  }
  const refererHeader = parseHeaderValue(req.headers.referer).trim();
  if (refererHeader) {
    try {
      const refererHost = new URL(refererHeader).hostname.toLowerCase();
      if (localHosts.has(refererHost)) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
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
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

export function enforceHttps(req: ApiRequest): void {
  enforceWafPolicy(req);
  const tlsVersion = parseHeaderValue(req.headers['x-tls-version']).toLowerCase();
  if (tlsVersion) {
    const normalized = tlsVersion.startsWith('tlsv') ? tlsVersion.slice(4) : tlsVersion.replace('tls', '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed < 1.2) {
      throw new Error('HTTPS required');
    }
  }
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

  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return;
  }

  const mutationKey = `${ip}:${scope}:mutation`;
  const mutationTarget = getMutationTargetSignature(req);
  const mutationState = mutationStore.get(mutationKey);
  if (!mutationState || mutationState.resetAt <= now) {
    mutationStore.set(mutationKey, {
      count: 1,
      targets: new Set([mutationTarget]),
      resetAt: now + WINDOW_MS,
    });
    return;
  }
  mutationState.count += 1;
  mutationState.targets.add(mutationTarget);
  if (mutationState.count > MUTATION_RATE_LIMIT || mutationState.targets.size > MUTATION_TARGET_LIMIT) {
    throw new ServiceUnavailableException('Anomaly detection triggered for mutation traffic.');
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
    if ((process.env.NODE_ENV !== 'production' || isLoopbackRequest(req)) && fallbackUserId) {
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
  enforceSessionTokenPolicy(req, token, data.user.id);
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
  const requestedTenantId = parseHeaderValue(req.headers['x-tenant-id']).trim() || null;
  const requestedFranchiseId = parseHeaderValue(req.headers['x-franchise-id']).trim() || null;
  const normalizedRole = String(ctx.role || '').trim().toLowerCase();
  const fallbackRole = normalizedRole || 'user';
  const isPlatformRole = fallbackRole === 'platform_admin' || fallbackRole === 'super_admin';

  let access: UserAccessProfile;
  try {
    access = await resolveUserAccessProfile(ctx.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const recoverable = isMissingRelationError({ message })
      || message.includes('schema cache')
      || message.startsWith('Failed to resolve roles:')
      || message.startsWith('Failed to resolve scope preference:');
    if (!recoverable) {
      throw error;
    }
    logger.warn('[AccessControl] access profile fallback applied due to unavailable role metadata store', {
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      role: fallbackRole,
      tenantId: requestedTenantId,
      franchiseId: requestedFranchiseId,
      error: message,
    });
    access = {
      userId: ctx.userId,
      roles: [fallbackRole],
      isPlatformAdmin: isPlatformRole,
      tenantId: requestedTenantId,
      franchiseId: requestedFranchiseId,
      adminOverrideEnabled: false,
      overrideTenantId: null,
      overrideFranchiseId: null,
    };
  }

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

  const hasTenantWideDomainAccess = access.roles.some(
    (role) => role === 'tenant_admin' || role === 'franchise_admin'
  );
  if (hasTenantWideDomainAccess) {
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

export async function enforceAmroDomainAccess(
  access: UserAccessProfile,
  options: { correlationId?: string; allowGracePeriod?: boolean; bypassCache?: boolean } = {}
): Promise<AmroDomainAccessResult> {
  const tenantId = String(access.tenantId || '').trim();
  if (!tenantId) {
    throw new Error('Forbidden: AMRO access requires tenant-scoped session');
  }

  const allowGracePeriod = options.allowGracePeriod !== false;
  const cacheKey = `${tenantId}:${allowGracePeriod ? 'grace' : 'strict'}`;
  const now = Date.now();
  const validatedAt = new Date().toISOString();
  if (!options.bypassCache) {
    const cached = amroAccessCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      const cachedResult: AmroDomainAccessResult = {
        ...cached.result,
        source: 'cache',
      };
      await writeAmroDomainAuditLog(getSupabaseAdminClient(), {
        userId: access.userId,
        tenantId,
        correlationId: options.correlationId,
        authorized: true,
        source: 'cache',
        subscriptionStatus: cachedResult.subscriptionStatus,
        graceUntil: cachedResult.graceUntil,
        allowGracePeriod,
        validatedAt,
      });
      return {
        ...cachedResult,
      };
    }
    if (cached && cached.expiresAt <= now) {
      amroAccessCache.delete(cacheKey);
    }
  }

  const supabase = getSupabaseAdminClient();

  const strictQuery = await supabase
    .from('tenant_domain_assignments')
    .select('id, tenant_id, is_active, subscription_status, grace_until, platform_domains!inner(code, is_active)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  let assignmentRows: any[] | null = (strictQuery.data as any[] | null) || null;
  let assignmentError: any = strictQuery.error;
  let source: 'database' | 'fallback' = 'database';

  if (assignmentError && isMissingColumnError(assignmentError)) {
    const fallbackQuery = await supabase
      .from('tenant_domain_assignments')
      .select('id, tenant_id, is_active, platform_domains!inner(code, is_active)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    assignmentRows = (fallbackQuery.data as any[] | null) || null;
    assignmentError = fallbackQuery.error;
    source = 'fallback';
  }

  if (assignmentError) {
    if (!isMissingRelationError(assignmentError)) {
      throw new Error(`Failed to validate AMRO subscription: ${assignmentError.message}`);
    }
    logger.warn('[AmroDomainAccess] tenant_domain_assignments table unavailable', {
      tenantId,
      correlationId: options.correlationId || null,
      code: String(assignmentError.code || ''),
      error: String(assignmentError.message || ''),
    });
    await writeAmroDomainAuditLog(supabase, {
      userId: access.userId,
      tenantId,
      correlationId: options.correlationId,
      authorized: false,
      source,
      subscriptionStatus: 'missing',
      graceUntil: null,
      deniedReason: 'assignment_table_unavailable',
      allowGracePeriod,
      validatedAt,
    });
    throw new Error('Forbidden: AMRO access requires active AMRO domain subscription');
  }

  const rows = Array.isArray(assignmentRows) ? assignmentRows : [];
  const matched = rows.find((row: any) => {
    const linkedDomain = Array.isArray(row?.platform_domains) ? row.platform_domains[0] : row?.platform_domains;
    const code = String(linkedDomain?.code || '').trim().toUpperCase();
    const domainIsActive = Boolean(linkedDomain?.is_active ?? true);
    return code === AMRO_DOMAIN_CODE && domainIsActive;
  });

  if (!matched) {
    logger.warn('[AmroDomainAccess] AMRO assignment missing', {
      tenantId,
      correlationId: options.correlationId || null,
    });
    await writeAmroDomainAuditLog(supabase, {
      userId: access.userId,
      tenantId,
      correlationId: options.correlationId,
      authorized: false,
      source,
      subscriptionStatus: 'missing',
      graceUntil: null,
      deniedReason: 'amro_assignment_missing',
      allowGracePeriod,
      validatedAt,
    });
    throw new Error('Forbidden: AMRO access requires active AMRO domain subscription');
  }

  const rawStatus = String((matched as any)?.subscription_status || 'active').trim().toLowerCase();
  const normalizedStatus = rawStatus === 'grace_period' ? 'grace_period' : rawStatus === 'active' ? 'active' : 'inactive';
  const graceUntilRaw = (matched as any)?.grace_until ? String((matched as any).grace_until) : null;
  const graceUntilMs = graceUntilRaw ? Date.parse(graceUntilRaw) : Number.NaN;
  const graceWindowOpen = Number.isFinite(graceUntilMs) && graceUntilMs > now;
  const authorizedByStatus =
    normalizedStatus === 'active' || (allowGracePeriod && normalizedStatus === 'grace_period' && graceWindowOpen);

  if (!authorizedByStatus) {
    const reason = normalizedStatus === 'grace_period'
      ? 'Forbidden: AMRO grace period expired'
      : 'Forbidden: AMRO subscription is inactive';
    logger.warn('[AmroDomainAccess] subscription check failed', {
      tenantId,
      correlationId: options.correlationId || null,
      status: normalizedStatus,
      graceUntil: graceUntilRaw,
      allowGracePeriod,
    });
    await writeAmroDomainAuditLog(supabase, {
      userId: access.userId,
      tenantId,
      correlationId: options.correlationId,
      authorized: false,
      source,
      subscriptionStatus: normalizedStatus,
      graceUntil: graceUntilRaw,
      deniedReason: reason,
      allowGracePeriod,
      validatedAt,
    });
    throw new Error(reason);
  }

  const result: AmroDomainAccessResult = {
    isAuthorized: true,
    subscriptionStatus: normalizedStatus === 'grace_period' ? 'grace_period' : 'active',
    graceUntil: graceUntilRaw,
    validatedAt,
    source,
  };

  amroAccessCache.set(cacheKey, {
    result,
    expiresAt: now + AMRO_CACHE_TTL_MS,
  });

  logger.info('[AmroDomainAccess] tenant authorized', {
    tenantId,
    correlationId: options.correlationId || null,
    status: result.subscriptionStatus,
    graceUntil: result.graceUntil,
    source: result.source,
  });
  await writeAmroDomainAuditLog(supabase, {
    userId: access.userId,
    tenantId,
    correlationId: options.correlationId,
    authorized: true,
    source: result.source,
    subscriptionStatus: result.subscriptionStatus,
    graceUntil: result.graceUntil,
    allowGracePeriod,
    validatedAt,
  });

  return result;
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
