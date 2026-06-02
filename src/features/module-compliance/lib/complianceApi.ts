// Thin wrapper for talking to /api/compliance/v1/* (services/compliance-api).
// Mirrors the crm-api fetch pattern in src/pages/dashboard/Leads.tsx —
// JWT Authorization header + x-tenant-id passthrough. Returns parsed
// JSON or throws a typed error for upstream toasts.

import { supabase } from '@/integrations/supabase/client';

const BASE = '/api/compliance/v1/compliance';

export class ComplianceApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = 'ComplianceApiError';
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token ?? '';
  // Tenant comes from the JWT-resolved role in the compliance-api auth
  // middleware; sending x-tenant-id is optional but helps when a user
  // has multiple roles spanning tenants (default-role resolution picks
  // one; the header pins it).
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const errBody = body as { error?: string; code?: string } | null;
    throw new ComplianceApiError(
      res.status,
      errBody?.error ?? `compliance-api returned ${res.status}`,
      errBody?.code,
    );
  }
  return body as T;
}

export async function getBlockedParties<T>(status?: string, limit?: number): Promise<T[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const res = await fetch(`${BASE}/blocked-parties${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'include',
    headers: await authHeaders(),
  });
  const body = await parseOrThrow<{ data: T[] }>(res);
  return body.data ?? [];
}

export async function getScreening<T>(id: string): Promise<T | null> {
  const res = await fetch(`${BASE}/screenings/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'include',
    headers: await authHeaders(),
  });
  if (res.status === 404) return null;
  return parseOrThrow<T>(res);
}

export async function getScreeningDecisions<T>(id: string): Promise<T[]> {
  const res = await fetch(`${BASE}/screenings/${encodeURIComponent(id)}/decisions`, {
    method: 'GET',
    credentials: 'include',
    headers: await authHeaders(),
  });
  const body = await parseOrThrow<{ data: T[] }>(res);
  return body.data ?? [];
}

export async function overrideScreening(input: { screening_id: string; reason: string; evidence_file_ids?: string[] }): Promise<unknown> {
  const res = await fetch(`${BASE}/screenings/${encodeURIComponent(input.screening_id)}/override`, {
    method: 'POST',
    credentials: 'include',
    headers: await authHeaders(),
    body: JSON.stringify({ reason: input.reason, evidence_file_ids: input.evidence_file_ids ?? null }),
  });
  const body = await parseOrThrow<{ data: unknown }>(res);
  return body.data;
}

export async function revokeOverride(input: { screening_id: string; reason: string }): Promise<unknown> {
  const res = await fetch(`${BASE}/screenings/${encodeURIComponent(input.screening_id)}/revoke-override`, {
    method: 'POST',
    credentials: 'include',
    headers: await authHeaders(),
    body: JSON.stringify({ reason: input.reason }),
  });
  const body = await parseOrThrow<{ data: unknown }>(res);
  return body.data;
}
