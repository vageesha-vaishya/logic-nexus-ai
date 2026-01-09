
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

export interface DataAccessContext {
  tenantId?: string | null;
  franchiseId?: string | null;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  isFranchiseAdmin: boolean;
  userId?: string;
}

/**
 * Applies mandatory scope filters to a Supabase query based on user context.
 * @param query The Supabase query builder instance
 * @param context The user's security context
 * @returns The scoped query
 */
export function withScope<T>(query: T, context: DataAccessContext): T {
  // Platform admins see everything
  if (context.isPlatformAdmin) {
    return query;
  }

  let scopedQuery = query as any;

  // Tenant Admin: Must scope to their tenant
  if (context.isTenantAdmin && context.tenantId) {
    scopedQuery = scopedQuery.eq('tenant_id', context.tenantId);
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

  return scopedQuery;
}

/**
 * Factory for creating a scoped data access layer.
 * Enforces data isolation by injecting tenant/franchise filters.
 */
export class ScopedDataAccess {
  constructor(
    private supabase: SupabaseClient<Database>,
    private context: DataAccessContext
  ) {}

  private async logAudit(action: string, resourceType: string, details: any) {
    if (!this.context.userId) return;
    
    // Fire and forget audit log to avoid blocking the UI
    this.supabase.from('audit_logs').insert({
      user_id: this.context.userId,
      action,
      resource_type: resourceType,
      details: details,
      // IP address would ideally be captured server-side
    }).then(({ error }) => {
      if (error) console.warn('Audit log failed:', error);
    });
  }

  from(table: keyof Database['public']['Tables']) {
    const query = this.supabase.from(table);
    
    return {
      select: (columns = '*', { count, head }: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean } = {}) => {
        const selectQuery = query.select(columns, { count, head });
        return withScope(selectQuery, this.context);
      },
      
      insert: (values: any) => {
        // Auto-inject tenant_id/franchise_id if missing and context has them
        const injectedValues = Array.isArray(values) 
          ? values.map(v => this.injectScope(v)) 
          : this.injectScope(values);
        
        this.logAudit('INSERT', table as string, { count: Array.isArray(values) ? values.length : 1 });
        return query.insert(injectedValues);
      },

      update: (values: any) => {
        const updateQuery = query.update(values);
        this.logAudit('UPDATE', table as string, { values });
        return withScope(updateQuery, this.context);
      },

      delete: () => {
        const deleteQuery = query.delete();
        this.logAudit('DELETE', table as string, {});
        return withScope(deleteQuery, this.context);
      }
    };
  }

  private injectScope(value: any) {
    const newValue = { ...value };
    // Only inject if not platform admin, or if platform admin didn't specify them (optional)
    if (!this.context.isPlatformAdmin) {
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
   * This allows UI components to log user preferences without exposing the generic logAudit.
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
