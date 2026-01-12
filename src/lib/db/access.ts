import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

export interface DataAccessContext {
  tenantId?: string | null;
  franchiseId?: string | null;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  isFranchiseAdmin: boolean;
  userId?: string;
  adminOverrideEnabled?: boolean;
}

type TableName = keyof Database['public']['Tables'];

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
      console.debug(`[ScopedDataAccess] Platform Admin Override: Tenant=${context.tenantId}, Franchise=${context.franchiseId}`);
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
  if (context.isTenantAdmin && context.tenantId) {
    scopedQuery = scopedQuery.eq('tenant_id', context.tenantId);
    
    // Allow Tenant Admin to filter by franchise if specified
    if (context.franchiseId) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        console.debug(`[ScopedDataAccess] Applying franchise filter for Tenant Admin: ${context.franchiseId}`);
      }
      scopedQuery = scopedQuery.eq('franchise_id', context.franchiseId);
    }
  }
  
  // Franchise Admin: Must scope to their franchise (and implicitly tenant)
  if (context.isFranchiseAdmin) {
    if (context.tenantId) {
      scopedQuery = scopedQuery.eq('tenant_id', context.tenantId);
    }
    if (context.franchiseId) {
      scopedQuery = scopedQuery.eq('franchise_id', context.franchiseId);
    }
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
      if (error) console.warn('Audit log failed:', error);
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
    const ctx = this.context;
    const logAudit = this.logAudit.bind(this);
    const injectScope = this.injectScope.bind(this);
    const applyScopeFilter = (query: any) => this.applyScopeFilter(query, table);

    return {
      select: (columns = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) => {
        let selectQuery = baseQuery.select(columns, options as any) as any;
        // Apply scope filters unless it's a global table
        if (!isGlobal) {
          return applyScopeFilter(selectQuery);
        }
        return selectQuery;
      },
      
      insert: (values: any) => {
        // Auto-inject tenant_id/franchise_id if missing and not global
        let finalValues = values;
        if (!isGlobal) {
          finalValues = Array.isArray(values) 
            ? values.map(v => injectScope(v)) 
            : injectScope(values);
        }
        
        logAudit('INSERT', table as string, { count: Array.isArray(values) ? values.length : 1 });
        return baseQuery.insert(finalValues) as any;
      },

      update: (values: any) => {
        let updateQuery = baseQuery.update(values) as any;
        logAudit('UPDATE', table as string, { values });
        // Apply scope filters unless it's a global table
        if (!isGlobal) {
          return applyScopeFilter(updateQuery);
        }
        return updateQuery;
      },

      upsert: (values: any, options?: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' | 'planned' | 'estimated'; defaultToNull?: boolean }) => {
        let finalValues = values;
        if (!isGlobal) {
          finalValues = Array.isArray(values) 
            ? values.map(v => injectScope(v)) 
            : injectScope(values);
        }

        logAudit('UPSERT', table as string, { count: Array.isArray(values) ? values.length : 1 });
        let upsertQuery = baseQuery.upsert(finalValues, options) as any;
        // Apply scope filters unless it's a global table
        if (!isGlobal) {
          return applyScopeFilter(upsertQuery);
        }
        return upsertQuery;
      },

      delete: () => {
        let deleteQuery = baseQuery.delete() as any;
        logAudit('DELETE', table as string, {});
        // Apply scope filters unless it's a global table
        if (!isGlobal) {
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

    // Admin Override Logic - Platform Admin with override enabled
    if (ctx.isPlatformAdmin && ctx.adminOverrideEnabled) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        console.debug(`[ScopedDataAccess] Platform Admin Override applied: Tenant=${ctx.tenantId}, Franchise=${ctx.franchiseId}`);
      }
      
      // LOGGING FOR DEBUGGING
      console.log(`[ScopedDataAccess] Applying Admin Override Filters. Tenant: ${ctx.tenantId}, Franchise: ${ctx.franchiseId}`);

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
    if (ctx.isTenantAdmin && ctx.tenantId) {
      query = query.eq('tenant_id', ctx.tenantId);
      
      if (ctx.franchiseId) {
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          console.debug(`[ScopedDataAccess] Applying franchise filter for Tenant Admin: ${ctx.franchiseId}`);
        }
        // Special-case: franchises table uses 'id' not 'franchise_id'
        if (table === 'franchises') {
          query = query.eq('id', ctx.franchiseId);
        } else {
          query = query.eq('franchise_id', ctx.franchiseId);
        }
      }
    }
    
    // Franchise Admin: Must scope to their franchise (and implicitly tenant)
    if (ctx.isFranchiseAdmin) {
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
    }

    return query;
  }

  private injectScope(value: any): any {
    const newValue = { ...value };
    // Inject if not platform admin, or if platform admin has enabled override
    const shouldInject = !this.context.isPlatformAdmin || (this.context.isPlatformAdmin && this.context.adminOverrideEnabled);

    if (shouldInject) {
      if (this.context.tenantId && !newValue.tenant_id) {
        newValue.tenant_id = this.context.tenantId;
      }
      if (this.context.franchiseId && !newValue.franchise_id) {
        newValue.franchise_id = this.context.franchiseId;
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

  /**
   * Retrieves a system setting by key.
   */
  public async getSystemSetting(key: string): Promise<{ data: { setting_value: any } | null, error: any }> {
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
