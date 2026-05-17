import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

export interface DataAccessContext {
  tenantId?: string | null;
  franchiseId?: string | null;
  ownedTenantId?: string | null;
  ownedFranchiseId?: string | null;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  isFranchiseAdmin: boolean;
  userId?: string;
  adminOverrideEnabled?: boolean;
}

type TableName = string;

/**
 * Canonical platform domain `code` values from public.platform_domains.
 * Used to gate cross-cutting access checks via assertDomainAccess().
 */
export const PlatformDomains = {
  AMRO: 'amro',
  LOGISTICS: 'logistics',
  MARKETS: 'markets',
  CRM: 'crm',
  FINANCE: 'finance',
  TRADING: 'trading',
  INSURANCE: 'insurance',
  CUSTOMS: 'customs',
  BANKING: 'banking',
  ECOMMERCE: 'ecommerce',
  TELECOM: 'telecom',
  HEALTHCARE: 'healthcare',
  REAL_ESTATE: 'real_estate',
} as const;

export type PlatformDomainKey = typeof PlatformDomains[keyof typeof PlatformDomains];

/** Subscription states that grant active access. */
const ACTIVE_SUBSCRIPTION_STATES = new Set(['active', 'trialing', 'grace_period']);

export interface DomainAccessResult {
  allowed: boolean;
  subscriptionStatus?: string;
  graceUntil?: string | null;
  domainStatus?: string;
  reason?: string;
}

/**
 * Free function: check whether a tenant has the named domain assigned and active.
 * Equivalent to: SELECT … FROM tenant_domain_assignments tda JOIN platform_domains pd …
 *
 * No caching — at scale this hits the DB on every call; T1.5 (markets-doc §16.8 P2)
 * introduces Redis caching for these checks.
 */
export async function checkDomainAccess(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  domain: PlatformDomainKey,
): Promise<DomainAccessResult> {
  // We can't .from('tenant_domain_assignments') with strong typing if it isn't in
  // the generated Database type, so cast through any for safety.
  const { data, error } = await (supabase as any)
    .from('tenant_domain_assignments')
    .select(
      'is_active, subscription_status, grace_until, platform_domains!inner(code, status, is_active)'
    )
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('platform_domains.code', domain)
    .eq('platform_domains.is_active', true)
    .maybeSingle();

  if (error) {
    return { allowed: false, reason: `domain_lookup_error: ${error.message ?? 'unknown'}` };
  }
  if (!data) {
    return { allowed: false, reason: 'no_assignment' };
  }

  const subStatus: string = data.subscription_status;
  if (!ACTIVE_SUBSCRIPTION_STATES.has(subStatus)) {
    return {
      allowed: false,
      subscriptionStatus: subStatus,
      reason: `subscription_${subStatus}`,
    };
  }

  // grace_period expires at grace_until
  if (subStatus === 'grace_period' && data.grace_until) {
    const graceUntil = new Date(data.grace_until);
    if (Number.isFinite(graceUntil.getTime()) && graceUntil < new Date()) {
      return {
        allowed: false,
        subscriptionStatus: subStatus,
        graceUntil: data.grace_until,
        reason: 'grace_period_expired',
      };
    }
  }

  return {
    allowed: true,
    subscriptionStatus: subStatus,
    graceUntil: data.grace_until ?? null,
    domainStatus: data.platform_domains?.status,
  };
}

/**
 * Applies mandatory scope filters to a Supabase query based on user context.
 * This is a standalone function that can be used with any query builder.
 */
export function withScope<T>(query: T, context: DataAccessContext): T {
  // Platform admins see everything UNLESS they have explicitly enabled override
  if (context.isPlatformAdmin && !context.adminOverrideEnabled) {
    return query;
  }

  let scopedQuery = query as any;

  // Admin Override Logic - Platform Admin with override enabled
  if (context.isPlatformAdmin && context.adminOverrideEnabled) {
    // Debug logging for troubleshooting filtering issues
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      logger.debug(`[ScopedDataAccess] Platform Admin Override: Tenant=${context.tenantId}, Franchise=${context.franchiseId}`);
    }

    if (context.tenantId) {
      scopedQuery = scopedQuery.eq('tenant_id', context.tenantId);
    }
    if (context.franchiseId) {
      scopedQuery = scopedQuery.eq('franchise_id', context.franchiseId);
    }
    return scopedQuery as T;
  }

  // Tenant Admin: Must scope to their tenant
  if (context.isTenantAdmin) {
    if (!context.tenantId) {
      throw new Error('Missing tenant scope for tenant admin');
    }
    scopedQuery = scopedQuery.eq('tenant_id', context.tenantId);
    
    // Allow Tenant Admin to filter by franchise if specified
    if (context.franchiseId) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        logger.debug(`[ScopedDataAccess] Applying franchise filter for Tenant Admin: ${context.franchiseId}`);
      }
      scopedQuery = scopedQuery.eq('franchise_id', context.franchiseId);
    }
  }
  
  // Franchise Admin: Must scope to their franchise (and implicitly tenant)
  if (context.isFranchiseAdmin) {
    if (!context.tenantId || !context.franchiseId) {
      throw new Error('Missing tenant/franchise scope for franchise admin');
    }
    scopedQuery = scopedQuery.eq('tenant_id', context.tenantId);
    scopedQuery = scopedQuery.eq('franchise_id', context.franchiseId);
  }

  // Regular user: Must scope to their tenant + franchise (defense-in-depth with RLS)
  if (!context.isPlatformAdmin && !context.isTenantAdmin && !context.isFranchiseAdmin) {
    if (!context.tenantId || !context.franchiseId) {
      throw new Error('Missing tenant/franchise scope for user');
    }
    scopedQuery = scopedQuery.eq('tenant_id', context.tenantId);
    scopedQuery = scopedQuery.eq('franchise_id', context.franchiseId);
  }

  return scopedQuery as T;
}

/**
 * Factory for creating a scoped data access layer.
 * Enforces data isolation by injecting tenant/franchise filters.
 * 
 * NOTE: This class uses 'any' types intentionally to avoid TypeScript
 * infinite type instantiation errors with Supabase's complex generic types.
 */
export class ScopedDataAccess {
  constructor(
    private supabase: SupabaseClient<Database>,
    private context: DataAccessContext
  ) {}

  public get client(): SupabaseClient<Database> {
    return this.supabase;
  }

  public get accessContext(): DataAccessContext {
    return this.context;
  }

  /**
   * Creates a new ScopedDataAccess instance with a different context.
   * Useful for temporary context switching (e.g. Platform Admin impersonation during import).
   */
  public withContext(context: DataAccessContext): ScopedDataAccess {
    return new ScopedDataAccess(this.supabase, context);
  }

  private async logAudit(action: string, resourceType: string, details: any) {
    if (!this.context.userId) return;
    
    const payload: any = {
      user_id: this.context.userId,
      action,
      resource_type: resourceType,
      details: details,
    };

    if (this.context.tenantId) payload.tenant_id = this.context.tenantId;
    if (this.context.franchiseId) payload.franchise_id = this.context.franchiseId;

    // Fire and forget audit log to avoid blocking the UI
    this.supabase.from('audit_logs').insert(payload).then(({ error }) => {
      if (error) logger.warn('Audit log failed:', error);
    });
  }

  /**
   * Wrapper for RPC calls to maintain interface compatibility with SupabaseClient.
   * Note: RPCs must handle their own scoping via arguments.
   */
  public rpc(fn: string, args?: any, options?: { head?: boolean; count?: 'exact' | 'planned' | 'estimated' }) {
    return this.supabase.rpc(fn as any, args, options);
  }

  /**
   * Creates a query builder for the specified table with automatic scope filtering.
   * The select() method applies scope filters immediately and returns the full query builder.
   * @param table The table to query
   * @param isGlobal If true, skips scope injection and filtering (for global reference tables)
   */
  from(table: TableName, isGlobal: boolean = false) {
    const baseQuery = this.supabase.from(table);
    const skipScope = isGlobal && table !== 'tenants' && table !== 'franchises';
    const ctx = this.context;
    const logAudit = this.logAudit.bind(this);
    const injectScope = (v: any) => this.injectScope(v, table);
    const applyScopeFilter = (query: any) => this.applyScopeFilter(query, table);

    return {
      select: (columns = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) => {
        const selectQuery = baseQuery.select(columns, options as any) as any;
        if (!skipScope) {
          return applyScopeFilter(selectQuery);
        }
        return selectQuery;
      },
      
      insert: (values: any) => {
        let finalValues = values;
        if (!skipScope) {
          finalValues = Array.isArray(values) 
            ? values.map(v => injectScope(v)) 
            : injectScope(values);
        }
        
        logAudit('INSERT', table as string, { count: Array.isArray(values) ? values.length : 1 });
        return baseQuery.insert(finalValues) as any;
      },

      update: (values: any) => {
        const updateQuery = baseQuery.update(values) as any;
        logAudit('UPDATE', table as string, { values });
        if (!skipScope) {
          return applyScopeFilter(updateQuery);
        }
        return updateQuery;
      },

      upsert: (values: any, options?: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' | 'planned' | 'estimated'; defaultToNull?: boolean }) => {
        let finalValues = values;
        if (!skipScope) {
          finalValues = Array.isArray(values) 
            ? values.map(v => injectScope(v)) 
            : injectScope(values);
        }

        logAudit('UPSERT', table as string, { count: Array.isArray(values) ? values.length : 1 });
        const upsertQuery = baseQuery.upsert(finalValues, options) as any;
        if (!skipScope) {
          return applyScopeFilter(upsertQuery);
        }
        return upsertQuery;
      },

      delete: () => {
        const deleteQuery = baseQuery.delete() as any;
        logAudit('DELETE', table as string, {});
        if (!skipScope) {
          return applyScopeFilter(deleteQuery);
        }
        return deleteQuery;
      }
    };
  }

  /**
   * Applies scope filtering to a query based on user context.
   * Returns the query with tenant/franchise filters applied.
   */
  private applyScopeFilter(query: any, table?: TableName): any {
    const ctx = this.context;

    // Platform admins see everything UNLESS they have explicitly enabled override
    if (ctx.isPlatformAdmin && !ctx.adminOverrideEnabled) {
      return query;
    }

    // Ports/Locations are a global shared resource, never scoped
    if (table === 'ports_locations') {
      return query;
    }

    if (table === 'tenants' as TableName) {
      if (ctx.tenantId) {
        query = query.eq('id', ctx.tenantId);
      }
      return query;
    }

    // Quotation Configuration is tenant-scoped only (no franchise column)
    if (table === 'quotation_configuration' as TableName || table === 'quote_number_config_tenant' as TableName) {
      if (ctx.tenantId) {
        query = query.eq('tenant_id', ctx.tenantId);
      }
      return query;
    }

    // Master Commodities are tenant-scoped only (no franchise column)
    if (table === 'master_commodities' as TableName) {
      if (ctx.tenantId) {
        query = query.eq('tenant_id', ctx.tenantId);
      }
      return query;
    }

    // CRM Core: Contacts and Accounts default to tenant-scoped (legacy datasets may not have franchise_id)
    if (table === 'contacts' as TableName || table === 'accounts' as TableName) {
      if (ctx.tenantId) {
        query = query.eq('tenant_id', ctx.tenantId);
      }
      return query;
    }

    // Admin Override Logic - Platform Admin with override enabled
    if (ctx.isPlatformAdmin && ctx.adminOverrideEnabled) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        logger.debug(`[ScopedDataAccess] Platform Admin Override applied: Tenant=${ctx.tenantId}, Franchise=${ctx.franchiseId}`);
      }

      if (ctx.tenantId) {
        query = query.eq('tenant_id', ctx.tenantId);
      }
      if (ctx.franchiseId) {
        // Special-case: franchises table uses 'id' not 'franchise_id'
        if (table === 'franchises') {
          query = query.eq('id', ctx.franchiseId);
        } else {
          query = query.eq('franchise_id', ctx.franchiseId);
        }
      }
      return query;
    }

    // Tenant Admin: Must scope to their tenant
    if (ctx.isTenantAdmin) {
      if (!ctx.tenantId) {
        throw new Error('Missing tenant scope for tenant admin');
      }
      query = query.eq('tenant_id', ctx.tenantId);
      
      if (ctx.franchiseId && table !== 'franchises') {
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          logger.debug(`[ScopedDataAccess] Applying franchise filter for Tenant Admin: ${ctx.franchiseId}`);
        }
        query = query.eq('franchise_id', ctx.franchiseId);
      }
    }
    
    // Franchise Admin: Must scope to their franchise (and implicitly tenant)
    if (ctx.isFranchiseAdmin) {
      if (!ctx.tenantId || !ctx.franchiseId) {
        throw new Error('Missing tenant/franchise scope for franchise admin');
      }
      query = query.eq('tenant_id', ctx.tenantId);
      if (ctx.franchiseId) {
        // Special-case: franchises table uses 'id' not 'franchise_id'
        if (table === 'franchises') {
          query = query.eq('id', ctx.franchiseId);
        } else {
          query = query.eq('franchise_id', ctx.franchiseId);
        }
      }
    }

    // Regular user: Must scope to their tenant + franchise (defense-in-depth with RLS)
    if (!ctx.isPlatformAdmin && !ctx.isTenantAdmin && !ctx.isFranchiseAdmin) {
      if (!ctx.tenantId || !ctx.franchiseId) {
        throw new Error('Missing tenant/franchise scope for user');
      }
      if (ctx.tenantId) {
        query = query.eq('tenant_id', ctx.tenantId);
      }
      if (ctx.franchiseId) {
        if (table === 'franchises') {
          query = query.eq('id', ctx.franchiseId);
        } else {
          query = query.eq('franchise_id', ctx.franchiseId);
        }
      }
    }

    return query;
  }

  private injectScope(value: any, table?: TableName): any {
    const newValue = { ...value };
    // Inject if not platform admin, or if platform admin has enabled override
    const shouldInject = !this.context.isPlatformAdmin || (this.context.isPlatformAdmin && (this.context.adminOverrideEnabled || Boolean(this.context.tenantId)));

    if (shouldInject) {
      // Ports/Locations are global, do not inject scope
      if (table === 'ports_locations' || table === 'tenants') {
        return newValue;
      }

      if (this.context.tenantId) {
        newValue.tenant_id = this.context.tenantId;
      }
      if (this.context.franchiseId) {
        // Special-case: franchises table does not have franchise_id
        if (
          table !== 'franchises' &&
          table !== ('master_commodities' as TableName) &&
          table !== ('contacts' as TableName) &&
          table !== ('accounts' as TableName)
        ) {
          newValue.franchise_id = this.context.franchiseId;
        }
      }
    }
    return newValue;
  }

  /**
   * Public method to log view preference changes.
   */
  public logViewPreference(resourceType: string, viewMode: string) {
    this.logAudit('VIEW_CHANGE', resourceType, { viewMode });
  }

  private createPlatformAdminAccessError() {
    return {
      message: 'Access denied - Platform admin privileges required',
      code: 'platform_admin_required',
      status: 403,
    };
  }

  /**
   * Assert that the current tenant has the named domain enabled.
   * Returns `{ data: { allowed: true, … }, error: null }` on success,
   * or `{ data: null, error: { message, code, status } }` if the tenant lacks
   * an active assignment for that domain.
   *
   * Platform admins bypass the check entirely.
   * Edge functions should use the parallel helper at
   *   supabase/functions/_shared/domain-access.ts
   * (Deno-side; same query shape, runs against the user's JWT-scoped client).
   */
  public async assertDomainAccess(
    domain: PlatformDomainKey,
  ): Promise<{
    data: DomainAccessResult | null;
    error: { message: string; code: string; status: number } | null;
  }> {
    // Platform admins always pass — they see everything by design.
    if (this.context.isPlatformAdmin && !this.context.adminOverrideEnabled) {
      return { data: { allowed: true, reason: 'platform_admin_bypass' }, error: null };
    }

    if (!this.context.tenantId) {
      return {
        data: null,
        error: {
          message: 'Missing tenant context — cannot check domain access',
          code: 'no_tenant_in_context',
          status: 401,
        },
      };
    }

    const result = await checkDomainAccess(this.supabase, this.context.tenantId, domain);

    if (!result.allowed) {
      return {
        data: null,
        error: {
          message: `Tenant does not have the "${domain}" domain enabled (${result.reason ?? 'denied'})`,
          code: 'domain_not_enabled',
          status: 403,
        },
      };
    }

    return { data: result, error: null };
  }

  /**
   * Retrieves a system setting by key.
   */
  public async getSystemSetting(key: string): Promise<{ data: { setting_value: any } | null, error: any }> {
    if (!this.context.isPlatformAdmin) {
      return {
        data: null,
        error: this.createPlatformAdminAccessError(),
      };
    }

    const result = await (this.supabase as any)
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();
    return result;
  }

  /**
   * Sets or updates a system setting.
   */
  public async setSystemSetting(key: string, value: any) {
    if (!this.context.isPlatformAdmin) {
      return {
        data: null,
        error: this.createPlatformAdminAccessError(),
      };
    }

    const payload = {
      setting_key: key,
      setting_value: value,
    };
    
    const injectedPayload = this.injectScope(payload);
    
    const result = await this.supabase.from('system_settings' as any).upsert(injectedPayload, {
      onConflict: 'tenant_id, setting_key'
    });
    
    this.logAudit('UPSERT', 'system_settings', { key, value });
    return result;
  }
}
