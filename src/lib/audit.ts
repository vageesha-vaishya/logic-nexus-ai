import { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogEntry {
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
  tenant_id?: string;
  franchise_id?: string;
}

class AuditService {
  private static instance: AuditService;
  private supabase: SupabaseClient | null = null;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  initialize(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async log(entry: AuditLogEntry) {
    if (!this.supabase) {
      console.warn('AuditService not initialized with Supabase client');
      return;
    }

    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      
      const payload = {
        user_id: user?.id,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        details: entry.details || {},
        created_at: new Date().toISOString(),
        // tenant_id and franchise_id should ideally be fetched from user context if not provided
        // For now, we rely on RLS or explicit passing
        tenant_id: entry.tenant_id,
        franchise_id: entry.franchise_id
      };

      const { error } = await this.supabase
        .from('audit_logs')
        .insert(payload);

      if (error) {
        console.error('Failed to write audit log:', error);
      }
    } catch (error) {
      console.error('Error in AuditService:', error);
    }
  }
}

export const auditLogger = AuditService.getInstance();
