import type { ApiRequest, ApiResponse } from './types';
import { ServiceUnavailableException } from './errors';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { logger } from '@/lib/logger';

const rateStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;

export type ApiContext = {
  correlationId: string;
  tenantId: string;
  userId: string;
  role: string;
};

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
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Cookie,x-csrf-token,x-tenant-id,x-user-id,x-user-role,x-user-permissions,x-correlation-id');
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

export function enforceRateLimit(req: ApiRequest): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const existing = rateStore.get(ip);
  if (!existing || existing.resetAt <= now) {
    rateStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
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

  const role = String((data.user as any).app_metadata?.role || 'user');
  const rawPermissions = (data.user as any).app_metadata?.permissions;
  const permissions = Array.isArray(rawPermissions)
    ? rawPermissions.map((item: unknown) => String(item))
    : [];
  return { userId: data.user.id, role, permissions };
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
  const tenantId = parseHeaderValue(req.headers['x-tenant-id']).trim();
  return {
    correlationId,
    tenantId,
    userId: '',
    role: '',
  };
}
