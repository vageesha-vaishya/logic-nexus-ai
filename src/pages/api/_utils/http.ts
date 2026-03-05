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

export function applyCors(req: ApiRequest, res: ApiResponse): void {
  const origin = parseHeaderValue(req.headers.origin);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,x-tenant-id,x-user-id,x-correlation-id');
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

export async function authenticateRequest(req: ApiRequest): Promise<{ userId: string; role: string }> {
  const authHeader = parseHeaderValue(req.headers.authorization);
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  // Internal/test fallback header (non-production only)
  const fallbackUserId = parseHeaderValue(req.headers['x-user-id']);
  if (!token) {
    if (process.env.NODE_ENV !== 'production' && fallbackUserId) {
      return { userId: fallbackUserId, role: parseHeaderValue(req.headers['x-user-role']) || 'developer' };
    }
    throw new Error('Unauthorized');
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error('Unauthorized');
  }

  const role = String((data.user as any).app_metadata?.role || 'user');
  return { userId: data.user.id, role };
}

export function enforceRoles(role: string, allowedRoles: string[]): void {
  if (!allowedRoles.includes(role)) {
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
