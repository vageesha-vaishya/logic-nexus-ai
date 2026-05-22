
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Detect Capacitor native shells (Sthira / future per-domain mobile apps).
 *
 * Capacitor loads the bundled `dist/` at https://localhost/ without any
 * proxy, so every `/api/v1/*` call returns 404+HTML instead of JSON. Hitting
 * those endpoints from the WebView wastes round-trips and floods the console
 * with parse errors. Short-circuit the read paths and let the existing
 * client-side fallback resolve domains directly via Supabase RLS-scoped
 * queries (resolveTenantDomainsClientSide).
 *
 * See docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md
 * and the multi-domain independence design — proper Phase 2 work will give
 * each domain its own SPA bundle that doesn't even know about /api/*.
 */
function isCapacitorShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export interface PlatformDomain {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface AuthorizedDomainsResponse {
  domains: PlatformDomain[];
  tenantDomainCount: number;
  tenantId: string | null;
  isPlatformAdmin: boolean;
}

export interface AuthorizedDomainScope {
  tenantId?: string | null;
  franchiseId?: string | null;
}

export interface DomainTenantOption {
  id: string;
  name: string;
  is_active?: boolean;
}

export interface DomainAssignmentAuditLog {
  id: string;
  action: string;
  tenant_id: string | null;
  domain_id: string | null;
  actor_user_id: string | null;
  batch_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

let domainCache: PlatformDomain[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DOMAIN_API_UNAVAILABLE_RETRY_MS = 30_000;
let domainApiUnavailableUntil = 0;
const DOMAIN_ASSIGNMENT_API_UNAVAILABLE_RETRY_MS = 30_000;
let domainAssignmentApiUnavailableUntil = 0;
const DOMAIN_API_PATH = '/api/v1/platform-domains';
const DOMAIN_ASSIGNMENT_API_PATH = '/api/v1/domain-assignments';
const DOMAIN_CONFIG_API_PATH = '/api/v1/domain-config';

export interface DomainConfigPayload {
  id?: string;
  domain_id: string;
  plugin_name: string;
  environment: string;
  json_settings: Record<string, unknown>;
  encrypted_secrets: string | null;
  updated_at?: string;
}

function dedupeDomains(domains: PlatformDomain[]): PlatformDomain[] {
  const seen = new Set<string>();
  const unique: PlatformDomain[] = [];
  for (const domain of domains) {
    const idKey = String(domain.id || '').trim();
    const codeKey = String(domain.code || '').trim().toUpperCase();
    const key = idKey || codeKey;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(domain);
  }
  return unique;
}

function normalizeDomainRows(rows: any[]): PlatformDomain[] {
  const mapped = (rows || [])
    .map((row: any) => row?.platform_domains || row)
    .filter((row: any) => row && row.code && row.is_active !== false)
    .map((row: any) => ({
      id: String(row.id || ''),
      code: String(row.code || ''),
      name: String(row.name || ''),
      description: row.description == null ? null : String(row.description),
      is_active: Boolean(row.is_active ?? true),
    }));
  return dedupeDomains(mapped);
}

function isNetworkConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return normalized.includes('failed to fetch') || normalized.includes('networkerror') || normalized.includes('econnrefused');
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  const message = typeof (error as { message?: unknown })?.message === 'string'
    ? String((error as { message?: string }).message).trim()
    : '';
  if (message) {
    return message;
  }
  return fallback;
}

function formatDomainDeleteError(error: unknown): string {
  const fallback = 'Failed to delete domain';
  const rawMessage = toErrorMessage(error, fallback);
  const code = String((error as { code?: unknown })?.code || '').toUpperCase();
  const normalized = rawMessage.toLowerCase();
  const isReferenceConstraint =
    code === '23503'
    || normalized.includes('foreign key')
    || normalized.includes('still referenced')
    || normalized.includes('violates foreign key constraint');
  if (isReferenceConstraint) {
    return 'Cannot delete domain because it is assigned or referenced by existing records';
  }
  return rawMessage;
}

function isDomainApiTemporarilyUnavailable(): boolean {
  return Date.now() < domainApiUnavailableUntil;
}

function markDomainApiTemporarilyUnavailable() {
  domainApiUnavailableUntil = Date.now() + DOMAIN_API_UNAVAILABLE_RETRY_MS;
}

function isDomainAssignmentApiTemporarilyUnavailable(): boolean {
  return Date.now() < domainAssignmentApiUnavailableUntil;
}

function markDomainAssignmentApiTemporarilyUnavailable() {
  domainAssignmentApiUnavailableUntil = Date.now() + DOMAIN_ASSIGNMENT_API_UNAVAILABLE_RETRY_MS;
}

async function resolveClientSidePlatformAdminState(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || '';
  if (!userId) {
    return false;
  }
  const { data, error } = await (supabase as any)
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'platform_admin')
    .limit(1);
  if (error && (error as any)?.code !== '42P01') {
    const message = String((error as any)?.message || '').toLowerCase();
    const recoverable =
      message.includes('no api key')
      || message.includes('invalid api key')
      || message.includes('jwt')
      || message.includes('unauthorized')
      || message.includes('forbidden');
    if (recoverable) {
      logger.warn('[DomainService] unable to resolve platform_admin via user_roles, defaulting false', {
        component: 'DomainService',
        message: (error as any)?.message || 'unknown',
      });
      return false;
    }
    throw error;
  }
  return Array.isArray(data) && data.length > 0;
}

async function loadActivePlatformDomainsClientSide(): Promise<PlatformDomain[]> {
  const { data, error } = await (supabase as any)
    .from('platform_domains')
    .select('id, code, name, description, is_active')
    .eq('is_active', true)
    .order('name');
  if (error) {
    throw error;
  }
  return normalizeDomainRows(data || []);
}

async function resolveTenantDomainsClientSide(): Promise<{ domains: PlatformDomain[]; tenantDomainCount: number; isPlatformAdmin: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    return { domains: [], tenantDomainCount: 0, isPlatformAdmin: false };
  }

  // Phase 1 lifecycle: read from tenant_active_domain_assignments rather than
  // the raw table so expired / cancelled / past_due / inactive rows are
  // filtered server-side. Falls back to the raw table if the view is missing
  // (older DBs that pre-date 20260522160216).
  // See supabase/migrations/20260522160216_phase1_lifecycle_grace_and_past_due_sweeps.sql.
  let tenantAssignmentRows: any[] | null = null;
  let tenantAssignmentError: any = null;
  {
    const viewResult = await (supabase as any)
      .from('tenant_active_domain_assignments')
      .select('platform_domains!inner(id, code, name, description, is_active)');
    if (viewResult.error && (viewResult.error as any)?.code === '42P01') {
      // View not yet present — fall back to the table with the lifecycle filter inlined.
      const tableResult = await (supabase as any)
        .from('tenant_domain_assignments')
        .select('platform_domains!inner(id, code, name, description, is_active), subscription_status')
        .eq('is_active', true)
        .in('subscription_status', ['active', 'trialing', 'grace_period']);
      tenantAssignmentRows = tableResult.data ?? null;
      tenantAssignmentError = tableResult.error;
    } else {
      tenantAssignmentRows = viewResult.data ?? null;
      tenantAssignmentError = viewResult.error;
    }
  }

  let tenantDomains = normalizeDomainRows(tenantAssignmentRows || []);
  const missingAssignments = (tenantAssignmentError as any)?.code === '42P01';

  if (tenantAssignmentError && !missingAssignments) {
    throw tenantAssignmentError;
  }

  if (tenantDomains.length === 0) {
    const { data: tenantFallbackRows, error: tenantFallbackError } = await (supabase as any)
      .from('tenants')
      .select('platform_domains!tenants_domain_id_fkey(id, code, name, description, is_active)')
      .limit(1);

    if (tenantFallbackError) {
      throw tenantFallbackError;
    }

    tenantDomains = normalizeDomainRows(tenantFallbackRows || []);
  }

  if (tenantDomains.length === 0) {
    try {
      const activeDomains = await loadActivePlatformDomainsClientSide();
      tenantDomains = normalizeDomainRows(activeDomains || []);
    } catch {
      // noop: keep fallback path below
    }
  }

  if (tenantDomains.length === 0) {
    // Local-dev safety net: avoid domain-resolution deadlock when API routes are not hosted.
    tenantDomains = [
      { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', code: 'AMRO', name: 'AMRO', description: 'Local fallback AMRO domain', is_active: true },
      { id: '849b380e-3603-4530-94d3-e028126e2a2c', code: 'LOGISTICS', name: 'Logistics', description: 'Local fallback Logistics domain', is_active: true },
    ];
  }

  const tenantDomainCount = tenantDomains.length;
  const isPlatformAdmin = await resolveClientSidePlatformAdminState();
  if (isPlatformAdmin) {
    if (tenantDomains.length <= 1) {
      try {
        const allDomains = await loadActivePlatformDomainsClientSide();
        if (allDomains.length > tenantDomains.length) {
          tenantDomains = allDomains;
        }
      } catch (error) {
        logger.warn('[DomainService] failed to hydrate active domains for platform admin fallback', {
          component: 'DomainService',
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
    return {
      domains: tenantDomains,
      tenantDomainCount: Math.max(tenantDomainCount, tenantDomains.length),
      isPlatformAdmin,
    };
  }

  if (tenantDomainCount <= 1) {
    return { domains: tenantDomains, tenantDomainCount, isPlatformAdmin };
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || '';
  if (!userId) {
    return { domains: tenantDomains, tenantDomainCount, isPlatformAdmin };
  }

  const { data: userAssignmentRows, error: userAssignmentError } = await (supabase as any)
    .from('user_domain_assignments')
    .select('platform_domains!inner(id, code, name, description, is_active)')
    .eq('is_active', true)
    .eq('user_id', userId);

  if (userAssignmentError && (userAssignmentError as any)?.code !== '42P01') {
    throw userAssignmentError;
  }

  if (!userAssignmentError) {
    const assignedCodes = new Set(
      normalizeDomainRows(userAssignmentRows || [])
        .map((domain) => domain.code.toUpperCase())
    );
    if (assignedCodes.size > 0) {
      tenantDomains = tenantDomains.filter((domain) => assignedCodes.has(domain.code.toUpperCase()));
    }
  }

  return { domains: tenantDomains, tenantDomainCount, isPlatformAdmin };
}

async function fallbackAuthorizedDomains(reason: string): Promise<AuthorizedDomainsResponse> {
  logger.warn('[DomainService] falling back to client-side domain resolution', {
    component: 'DomainService',
    reason,
  });
  const { domains, tenantDomainCount, isPlatformAdmin } = await resolveTenantDomainsClientSide();
  return {
    domains,
    tenantDomainCount,
    tenantId: null,
    isPlatformAdmin,
  };
}

export const DomainService = {
  async getSessionToken(): Promise<string> {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData?.session?.access_token || '';
  },

  async callDomainAssignmentApi(
    method: 'POST' | 'DELETE',
    payload: { domainId: string; tenantIds: string[]; batchId?: string },
  ): Promise<{ data?: any; correlationId?: string; error?: string }> {
    if (isDomainAssignmentApiTemporarilyUnavailable()) {
      throw new Error('Domain assignment API temporarily unavailable');
    }
    const accessToken = await this.getSessionToken();
    let response: Response;
    try {
      response = await fetch(DOMAIN_ASSIGNMENT_API_PATH, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markDomainAssignmentApiTemporarilyUnavailable();
      }
      throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    let body: any = {};
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = { error: await response.text() };
    }

    if (!response.ok) {
      const parsedError = typeof body?.error === 'string' && body.error.trim()
        ? body.error
        : `Domain assignment request failed (${response.status})`;
      if (body?.correlationId) {
        throw new Error(`${parsedError} (ref: ${body.correlationId})`);
      }
      throw new Error(parsedError);
    }

    return body;
  },

  async getTenantOptions(): Promise<DomainTenantOption[]> {
    const { data, error } = await (supabase as any)
      .from('tenants')
      .select('id, name, is_active')
      .order('name');
    if (error) throw error;
    return (data || []) as DomainTenantOption[];
  },

  async getTenantAssignedDomainIds(tenantId: string): Promise<string[]> {
    if (!tenantId) return [];
    const { data, error } = await (supabase as any)
      .from('tenant_domain_assignments')
      .select('domain_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) {
      logger.warn('[DomainService] Failed to load tenant domain assignments, falling back to domain_tenant', error);
      // Fallback to legacy table if new table doesn't exist yet
      const { data: fallbackData, error: fallbackError } = await (supabase as any)
        .from('domain_tenant')
        .select('domain_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      if (fallbackError) throw fallbackError;
      return Array.from(new Set((fallbackData || []).map((row: any) => String(row.domain_id))));
    }
    return Array.from(new Set((data || []).map((row: any) => String(row.domain_id))));
  },

  async setTenantDomains(tenantId: string, nextDomainIds: string[], currentDomainIds: string[]) {
    const nextSet = new Set((nextDomainIds || []).map((id) => String(id)));
    const currentSet = new Set((currentDomainIds || []).map((id) => String(id)));
    const assignDomainIds = Array.from(nextSet).filter((id) => !currentSet.has(id));
    const revokeDomainIds = Array.from(currentSet).filter((id) => !nextSet.has(id));
    const batchId = crypto.randomUUID();

    // Use Promise.allSettled to track individual successes/failures
    const assignResults = await Promise.allSettled(
      assignDomainIds.map((domainId) =>
        this.callDomainAssignmentApi('POST', {
          domainId,
          tenantIds: [tenantId],
          batchId,
        })
      )
    );

    const revokeResults = await Promise.allSettled(
      revokeDomainIds.map((domainId) =>
        this.callDomainAssignmentApi('DELETE', {
          domainId,
          tenantIds: [tenantId],
          batchId,
        })
      )
    );

    // Count successes and log failures
    const assignSuccesses = assignResults.filter((r) => r.status === 'fulfilled').length;
    const revokeSuccesses = revokeResults.filter((r) => r.status === 'fulfilled').length;

    // Log any failures
    assignResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('[DomainService] Failed to assign domain', {
          domainId: assignDomainIds[index],
          tenantId,
          error: result.reason,
        });
      }
    });

    revokeResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('[DomainService] Failed to revoke domain', {
          domainId: revokeDomainIds[index],
          tenantId,
          error: result.reason,
        });
      }
    });

    return {
      assigned: assignSuccesses,
      revoked: revokeSuccesses,
      batchId,
      totalAttempts: assignDomainIds.length + revokeDomainIds.length,
      totalSuccesses: assignSuccesses + revokeSuccesses,
      totalFailures: (assignDomainIds.length - assignSuccesses) + (revokeDomainIds.length - revokeSuccesses),
    };
  },

  async getDomainAssignmentAuditHistory(filters?: {
    tenantId?: string;
    domainId?: string;
    batchId?: string;
    limit?: number;
  }): Promise<DomainAssignmentAuditLog[]> {
    if (isDomainAssignmentApiTemporarilyUnavailable()) {
      return [];
    }
    const accessToken = await this.getSessionToken();
    const params = new URLSearchParams();
    if (filters?.tenantId) params.set('tenant_id', filters.tenantId);
    if (filters?.domainId) params.set('domain_id', filters.domainId);
    if (filters?.batchId) params.set('batch_id', filters.batchId);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const queryString = params.toString();
    let response: Response;
    try {
      response = await fetch(`${DOMAIN_ASSIGNMENT_API_PATH}${queryString ? `?${queryString}` : ''}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
    } catch (error) {
      if (isNetworkConnectivityError(error)) {
        markDomainAssignmentApiTemporarilyUnavailable();
        return [];
      }
      throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    let body: any = {};
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = { error: await response.text() };
    }

    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        return [];
      }
      const parsedError = typeof body?.error === 'string' && body.error.trim()
        ? body.error
        : `Domain audit request failed (${response.status})`;
      if (body?.correlationId) {
        throw new Error(`${parsedError} (ref: ${body.correlationId})`);
      }
      throw new Error(parsedError);
    }

    const rows = Array.isArray(body?.data) ? body.data : [];
    return rows as DomainAssignmentAuditLog[];
  },

  async getAuthorizedDomains(
    forceRefresh = false,
    scope: AuthorizedDomainScope = {},
  ): Promise<AuthorizedDomainsResponse> {
    // Capacitor shell has no /api/* proxy — skip the round-trip and resolve
    // domains client-side from Supabase. Quiet log so we can see this branch
    // exercised without the alarming error-level logs of the proxy path.
    if (isCapacitorShell()) {
      logger.debug('[DomainService] capacitor shell — resolving domains client-side', {
        component: 'DomainService',
      });
      return fallbackAuthorizedDomains('capacitor-shell');
    }

    const cacheBypass = forceRefresh ? '?refresh=1' : '';
    let accessToken = await this.getSessionToken();
    if (!accessToken) {
      const refreshSession = (supabase.auth as { refreshSession?: typeof supabase.auth.refreshSession }).refreshSession;
      if (typeof refreshSession === 'function') {
        const { data: refreshedSession } = await refreshSession.call(supabase.auth);
        accessToken = refreshedSession?.session?.access_token || '';
      }
    }
    logger.debug('[DomainService] requesting authorized domains', {
      component: 'DomainService',
      forceRefresh,
      hasSessionToken: Boolean(accessToken),
    });
    if (!accessToken) {
      return {
        domains: [],
        tenantDomainCount: 0,
        tenantId: null,
        isPlatformAdmin: false,
      };
    }
    if (isDomainApiTemporarilyUnavailable()) {
      return fallbackAuthorizedDomains('network-cooldown-active');
    }
    let response: Response;
    try {
      const tenantIdHeader = typeof scope.tenantId === 'string' ? scope.tenantId.trim() : '';
      const franchiseIdHeader = typeof scope.franchiseId === 'string' ? scope.franchiseId.trim() : '';
      response = await fetch(`${DOMAIN_API_PATH}${cacheBypass}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(tenantIdHeader ? { 'x-tenant-id': tenantIdHeader } : {}),
          ...(franchiseIdHeader ? { 'x-franchise-id': franchiseIdHeader } : {}),
        },
      });
    } catch (error) {
      logger.error('[DomainService] authorized domains network request failed', {
        component: 'DomainService',
        message: error instanceof Error ? error.message : 'unknown',
      });
      if (isNetworkConnectivityError(error)) {
        markDomainApiTemporarilyUnavailable();
      }
      return fallbackAuthorizedDomains('network-request-failure');
    }

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      const fallbackMessage = `Failed to load authorized domains (${response.status})`;
      let parsedMessage = fallbackMessage;
      let correlationId: string | null = null;
      try {
        const payload = contentType.includes('application/json')
          ? await response.json()
          : { error: await response.text() };
        correlationId = typeof payload?.correlationId === 'string' ? payload.correlationId : null;
        parsedMessage = typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error
          : fallbackMessage;
      } catch {
        parsedMessage = fallbackMessage;
      }
      if (response.status === 404) {
        logger.warn('[DomainService] authorized domains request failed', {
          component: 'DomainService',
          status: response.status,
          correlationId,
          message: parsedMessage,
        });
      } else {
        logger.error('[DomainService] authorized domains request failed', {
          component: 'DomainService',
          status: response.status,
          correlationId,
          message: parsedMessage,
        });
      }
      const shouldFallback =
        response.status === 401
        || response.status === 404
        || response.status === 405
        || response.status >= 500;
      if (shouldFallback) {
        try {
          return await fallbackAuthorizedDomains(`api-error:${response.status}`);
        } catch (fallbackError) {
          logger.error('[DomainService] fallback authorized domain resolution failed', {
            component: 'DomainService',
            status: response.status,
            correlationId,
            message: fallbackError instanceof Error ? fallbackError.message : 'unknown',
          });
        }
      }
      if (correlationId) {
        throw new Error(`${parsedMessage} (ref: ${correlationId})`);
      }
      throw new Error(parsedMessage);
    }
    if (!contentType.includes('application/json')) {
      const preview = (await response.text()).slice(0, 120);
      logger.error('[DomainService] non-JSON response from authorized domains API', {
        component: 'DomainService',
        status: response.status,
        contentType: contentType || 'unknown',
        responsePreview: preview,
      });
      return fallbackAuthorizedDomains(`non-json-response:${contentType || 'unknown'}`);
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch (error) {
      logger.error('[DomainService] failed to parse authorized domains JSON payload', {
        component: 'DomainService',
        status: response.status,
        contentType,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return fallbackAuthorizedDomains('json-parse-failure');
    }
    const data = payload?.data || {};
    let domains = dedupeDomains(Array.isArray(data.domains) ? data.domains : []);
    const isPlatformAdmin = Boolean(data.isPlatformAdmin);
    if (isPlatformAdmin) {
      try {
        const allDomains = await loadActivePlatformDomainsClientSide();
        if (allDomains.length > domains.length) {
          domains = allDomains;
        }
      } catch (error) {
        logger.warn('[DomainService] failed to hydrate active domains for platform admin API response', {
          component: 'DomainService',
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
    logger.info('[DomainService] authorized domains loaded', {
      component: 'DomainService',
      correlationId: typeof payload?.correlationId === 'string' ? payload.correlationId : null,
      count: domains.length,
      tenantDomainCount: Number(data.tenantDomainCount || 0),
      tenantId: typeof data.tenantId === 'string' ? data.tenantId : null,
      isPlatformAdmin,
    });

    return {
      domains: domains as PlatformDomain[],
      tenantDomainCount: isPlatformAdmin
        ? Math.max(Number(data.tenantDomainCount || 0), domains.length)
        : Number(data.tenantDomainCount || 0),
      tenantId: typeof data.tenantId === 'string' ? data.tenantId : null,
      isPlatformAdmin,
    };
  },

  async getDomainConfig(
    domainId: string,
    pluginName = 'QUOTATION',
    environment = 'prod'
  ): Promise<DomainConfigPayload | null> {
    const accessToken = await this.getSessionToken();
    const params = new URLSearchParams({
      domain_id: domainId,
      plugin_name: pluginName.toUpperCase(),
      environment,
    });
    const response = await fetch(`${DOMAIN_CONFIG_API_PATH}?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(String(body?.error || `Failed to load domain config (${response.status})`));
    }
    return body?.data || null;
  },

  async upsertDomainConfig(payload: {
    domainId: string;
    pluginName?: string;
    environment?: string;
    jsonSettings: Record<string, unknown>;
    encryptedSecrets?: string | null;
  }): Promise<DomainConfigPayload> {
    const accessToken = await this.getSessionToken();
    const response = await fetch(DOMAIN_CONFIG_API_PATH, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        domainId: payload.domainId,
        pluginName: payload.pluginName || 'QUOTATION',
        environment: payload.environment || 'prod',
        jsonSettings: payload.jsonSettings,
        encryptedSecrets: payload.encryptedSecrets ?? null,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(String(body?.error || `Failed to update domain config (${response.status})`));
    }
    return body.data as DomainConfigPayload;
  },

  /**
   * Fetches all platform domains with in-memory caching.
   * Useful for dropdowns and type validation.
   */
  async getAllDomains(forceRefresh = false): Promise<PlatformDomain[]> {
    const now = Date.now();
    
    if (!forceRefresh && domainCache && (now - cacheTimestamp < CACHE_TTL)) {
      return domainCache;
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .select('*')
      .order('name');

    if (error) {
      logger.error('Error fetching domains:', error);
      throw error;
    }

    domainCache = (data || []) as PlatformDomain[];
    cacheTimestamp = now;
    return domainCache;
  },

  /**
   * Gets a single domain by code (e.g., 'LOGISTICS').
   * Uses cached data if available.
   */
  async getDomainByCode(code: string): Promise<PlatformDomain | undefined> {
    const domains = await this.getAllDomains();
    return domains.find(d => d.code === code);
  },

  /**
   * Creates a new domain.
   */
  async createDomain(domain: Omit<PlatformDomain, 'id' | 'created_at' | 'updated_at'>): Promise<PlatformDomain> {
    // Normalize input
    const normalizedCode = domain.code ? domain.code.trim().toUpperCase() : null;
    const normalizedName = domain.name.trim();

    // Validate non-empty
    if (!normalizedName) {
      throw new Error('Domain name is required.');
    }
    if (!normalizedCode) {
      throw new Error('Domain code is required.');
    }

    // Check for duplicate code (case-insensitive)
    const allDomains = await this.getAllDomains(false);
    const duplicateByCode = allDomains.find(
      d => d.code && d.code.trim().toUpperCase() === normalizedCode
    );
    if (duplicateByCode) {
      throw new Error(`Domain with code "${normalizedCode}" already exists.`);
    }

    // Check for duplicate name (case-insensitive)
    const duplicateByName = allDomains.find(
      d => d.name.trim().toUpperCase() === normalizedName.toUpperCase()
    );
    if (duplicateByName) {
      throw new Error(`Domain with name "${normalizedName}" already exists.`);
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .insert({
        ...domain,
        code: normalizedCode,
        name: normalizedName,
      })
      .select()
      .single();

    if (error) {
      // Handle database-level constraint violations
      if (error.code === '23505') { // unique_violation
        const message = error.message || '';
        if (message.includes('code') || message.includes(normalizedCode)) {
          throw new Error(`Domain with code "${normalizedCode}" already exists.`);
        }
        if (message.includes('name') || message.includes(normalizedName)) {
          throw new Error(`Domain with name "${normalizedName}" already exists.`);
        }
        throw new Error('A domain with these details already exists.');
      }
      throw error;
    }
    
    this.invalidateCache();
    return data;
  },

  /**
   * Updates an existing domain.
   */
  async updateDomain(id: string, updates: Partial<PlatformDomain>): Promise<PlatformDomain> {
    // Normalize input if code/name being updated
    const normalizedCode = updates.code ? updates.code.trim().toUpperCase() : undefined;
    const normalizedName = updates.name ? updates.name.trim() : undefined;

    // Check for duplicate code if code is being updated
    if (normalizedCode) {
      const allDomains = await this.getAllDomains(false);
      const existing = allDomains.find(
        d => d.code && d.code.trim().toUpperCase() === normalizedCode && d.id !== id
      );
      if (existing) {
        throw new Error(`Domain with code "${normalizedCode}" already exists.`);
      }
    }

    // Check for duplicate name if name is being updated
    if (normalizedName) {
      const allDomains = await this.getAllDomains(false);
      const existing = allDomains.find(
        d => d.name.trim().toUpperCase() === normalizedName.toUpperCase() && d.id !== id
      );
      if (existing) {
        throw new Error(`Domain with name "${normalizedName}" already exists.`);
      }
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .update({
        ...updates,
        code: normalizedCode !== undefined ? normalizedCode : undefined,
        name: normalizedName !== undefined ? normalizedName : undefined,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Handle database-level constraint violations
      if (error.code === '23505') { // unique_violation
        const message = error.message || '';
        if (message.includes('code') || (normalizedCode && message.includes(normalizedCode))) {
          throw new Error(`Domain with code "${normalizedCode || updates.code}" already exists.`);
        }
        if (message.includes('name') || (normalizedName && message.includes(normalizedName))) {
          throw new Error(`Domain with name "${normalizedName || updates.name}" already exists.`);
        }
        throw new Error('A domain with these details already exists.');
      }
      throw error;
    }
    
    this.invalidateCache();
    return data;
  },

  /**
   * Deletes a domain.
   */
  async deleteDomain(id: string): Promise<void> {
    const { error } = await supabase
      .from('platform_domains')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(formatDomainDeleteError(error));
    }
    this.invalidateCache();
  },

  /**
   * Invalidates the cache. Call this after mutations.
   */
  invalidateCache() {
    domainCache = null;
    cacheTimestamp = 0;
    domainApiUnavailableUntil = 0;
  }
};
