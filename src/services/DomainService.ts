
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

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

function normalizeDomainRows(rows: any[]): PlatformDomain[] {
  return (rows || [])
    .map((row: any) => row?.platform_domains || row)
    .filter((row: any) => row && row.code && row.is_active !== false)
    .map((row: any) => ({
      id: String(row.id || ''),
      code: String(row.code || ''),
      name: String(row.name || ''),
      description: row.description == null ? null : String(row.description),
      is_active: Boolean(row.is_active ?? true),
    }));
}

async function resolveTenantDomainsClientSide(): Promise<{ domains: PlatformDomain[]; tenantDomainCount: number }> {
  const { data: tenantAssignmentRows, error: tenantAssignmentError } = await (supabase as any)
    .from('tenant_domain_assignments')
    .select('platform_domains!inner(id, code, name, description, is_active)')
    .eq('is_active', true);

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

  const tenantDomainCount = tenantDomains.length;
  if (tenantDomainCount <= 1) {
    return { domains: tenantDomains, tenantDomainCount };
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || '';
  if (!userId) {
    return { domains: tenantDomains, tenantDomainCount };
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
    tenantDomains = tenantDomains.filter((domain) => assignedCodes.has(domain.code.toUpperCase()));
  }

  return { domains: tenantDomains, tenantDomainCount };
}

async function fallbackAuthorizedDomains(reason: string): Promise<AuthorizedDomainsResponse> {
  logger.warn('[DomainService] falling back to client-side domain resolution', {
    component: 'DomainService',
    reason,
  });
  const { domains, tenantDomainCount } = await resolveTenantDomainsClientSide();
  return {
    domains,
    tenantDomainCount,
    tenantId: null,
    isPlatformAdmin: false,
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
    const accessToken = await this.getSessionToken();
    const response = await fetch(DOMAIN_ASSIGNMENT_API_PATH, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

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
      .from('domain_tenant')
      .select('domain_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw error;
    return Array.from(new Set((data || []).map((row: any) => String(row.domain_id))));
  },

  async setTenantDomains(tenantId: string, nextDomainIds: string[], currentDomainIds: string[]) {
    const nextSet = new Set((nextDomainIds || []).map((id) => String(id)));
    const currentSet = new Set((currentDomainIds || []).map((id) => String(id)));
    const assignDomainIds = Array.from(nextSet).filter((id) => !currentSet.has(id));
    const revokeDomainIds = Array.from(currentSet).filter((id) => !nextSet.has(id));
    const batchId = crypto.randomUUID();

    await Promise.all(assignDomainIds.map((domainId) =>
      this.callDomainAssignmentApi('POST', {
        domainId,
        tenantIds: [tenantId],
        batchId,
      })
    ));

    await Promise.all(revokeDomainIds.map((domainId) =>
      this.callDomainAssignmentApi('DELETE', {
        domainId,
        tenantIds: [tenantId],
        batchId,
      })
    ));

    return {
      assigned: assignDomainIds.length,
      revoked: revokeDomainIds.length,
      batchId,
    };
  },

  async getDomainAssignmentAuditHistory(filters?: {
    tenantId?: string;
    domainId?: string;
    batchId?: string;
    limit?: number;
  }): Promise<DomainAssignmentAuditLog[]> {
    const accessToken = await this.getSessionToken();
    const params = new URLSearchParams();
    if (filters?.tenantId) params.set('tenant_id', filters.tenantId);
    if (filters?.domainId) params.set('domain_id', filters.domainId);
    if (filters?.batchId) params.set('batch_id', filters.batchId);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const queryString = params.toString();
    const response = await fetch(`${DOMAIN_ASSIGNMENT_API_PATH}${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

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
        : `Domain audit request failed (${response.status})`;
      if (body?.correlationId) {
        throw new Error(`${parsedError} (ref: ${body.correlationId})`);
      }
      throw new Error(parsedError);
    }

    const rows = Array.isArray(body?.data) ? body.data : [];
    return rows as DomainAssignmentAuditLog[];
  },

  async getAuthorizedDomains(forceRefresh = false): Promise<AuthorizedDomainsResponse> {
    const cacheBypass = forceRefresh ? '?refresh=1' : '';
    const accessToken = await this.getSessionToken();
    logger.debug('[DomainService] requesting authorized domains', {
      component: 'DomainService',
      forceRefresh,
      hasSessionToken: Boolean(accessToken),
    });
    const response = await fetch(`${DOMAIN_API_PATH}${cacheBypass}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

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
      logger.error('[DomainService] authorized domains request failed', {
        component: 'DomainService',
        status: response.status,
        correlationId,
        message: parsedMessage,
      });
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
    const domains = Array.isArray(data.domains) ? data.domains : [];
    logger.info('[DomainService] authorized domains loaded', {
      component: 'DomainService',
      correlationId: typeof payload?.correlationId === 'string' ? payload.correlationId : null,
      count: domains.length,
      tenantDomainCount: Number(data.tenantDomainCount || 0),
      tenantId: typeof data.tenantId === 'string' ? data.tenantId : null,
      isPlatformAdmin: Boolean(data.isPlatformAdmin),
    });

    return {
      domains: domains as PlatformDomain[],
      tenantDomainCount: Number(data.tenantDomainCount || 0),
      tenantId: typeof data.tenantId === 'string' ? data.tenantId : null,
      isPlatformAdmin: Boolean(data.isPlatformAdmin),
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
      console.error('Error fetching domains:', error);
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
    // Check for duplicate code
    const existing = await this.getDomainByCode(domain.code);
    if (existing) {
      throw new Error(`Domain with code "${domain.code}" already exists.`);
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .insert(domain)
      .select()
      .single();

    if (error) throw error;
    this.invalidateCache();
    return data;
  },

  /**
   * Updates an existing domain.
   */
  async updateDomain(id: string, updates: Partial<PlatformDomain>): Promise<PlatformDomain> {
    // Check for duplicate code if code is being updated
    if (updates.code) {
      const existing = await this.getDomainByCode(updates.code);
      if (existing && existing.id !== id) {
        throw new Error(`Domain with code "${updates.code}" already exists.`);
      }
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
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

    if (error) throw error;
    this.invalidateCache();
  },

  /**
   * Invalidates the cache. Call this after mutations.
   */
  invalidateCache() {
    domainCache = null;
    cacheTimestamp = 0;
  }
};
