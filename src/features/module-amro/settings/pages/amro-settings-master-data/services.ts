import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { ENTITY_LABEL } from './constants';
import type { ReferenceEntity } from './types';
import { getPayloadRecords } from './utils';

type ApiHeaderBuildOptions = {
  fallbackAccessToken?: string | null;
  requestTag?: string;
  requestUrl?: string;
  requestMethod?: string;
};

export async function buildApiHeaders(
  scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null },
  options: ApiHeaderBuildOptions = {},
) {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token || '';
  let source = token ? 'session' : 'none';
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed?.session?.access_token || '';
    source = token ? 'refresh' : 'none';
  }
  const fallbackToken = String(options.fallbackAccessToken || '').trim();
  if (!token && fallbackToken) {
    token = fallbackToken;
    source = 'fallback';
  }
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (scope.tenantId) headers.set('x-tenant-id', scope.tenantId);
  if (scope.franchiseId) headers.set('x-franchise-id', scope.franchiseId);
  if (scope.userId) headers.set('x-user-id', scope.userId);
  headers.set('x-domain-id', 'AMRO');
  if (!token) {
    logger.warn('AMRO API request headers missing Authorization token', {
      component: 'amro-settings-master-data/services',
      requestTag: options.requestTag || 'unknown',
      requestUrl: options.requestUrl || '',
      requestMethod: options.requestMethod || 'GET',
      tenantId: String(scope.tenantId || ''),
      franchiseId: String(scope.franchiseId || ''),
      userId: String(scope.userId || ''),
      authorizationHeader: String(headers.get('Authorization') || ''),
      tokenSource: source,
      hasSessionToken: Boolean(sessionData?.session?.access_token),
      hasFallbackToken: Boolean(fallbackToken),
    });
  }
  return headers;
}

export async function parseApiPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    if (response.ok) {
      return {};
    }
    throw new Error(`Invalid response format (${response.status})`);
  }
}

export async function verifyReferenceExists(headers: Headers, entity: ReferenceEntity, searchTerm: string, fieldKeys: string[]): Promise<boolean> {
  const query = new URLSearchParams({
    search: searchTerm,
    page: '1',
    page_size: '20',
  });
  const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, {
    method: 'GET',
    headers,
  });
  const payload = await parseApiPayload(response);
  if (!response.ok) {
    const label = (ENTITY_LABEL as Record<string, string>)[entity] ?? 'reference';
    throw new Error(String(payload.error || `Failed to validate ${label} reference`));
  }
  const records = getPayloadRecords(payload);
  const normalized = searchTerm.trim().toLowerCase();
  return records.some((record) => fieldKeys.some((fieldKey) => String(record[fieldKey] || '').trim().toLowerCase() === normalized));
}
