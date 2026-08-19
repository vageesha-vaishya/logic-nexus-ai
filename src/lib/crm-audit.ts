import { SupabaseClient } from '@supabase/supabase-js';

export class CRMAuditService {
  private static instance: CRMAuditService | null = null;
  private supabase: SupabaseClient | null = null;

  private constructor() {}

  static getInstance(): CRMAuditService {
    if (!CRMAuditService.instance) {
      CRMAuditService.instance = new CRMAuditService();
    }
    return CRMAuditService.instance;
  }

  initialize(supabase: SupabaseClient): void {
    this.supabase = supabase;
  }

  async logLeadCreated(
    leadId: string,
    leadData: Record<string, any>,
    tenantId: string
  ): Promise<void> {
    const userContext = await this.addUserContext();
    const payload = {
      lead_id: leadId,
      tenant_id: tenantId,
      action: 'created',
      changed_fields: Object.keys(leadData),
      old_values: null,
      new_values: leadData,
      user_id: userContext.userId,
      user_email: userContext.userEmail,
    };

    await this.log([payload]);
  }

  async logLeadUpdated(
    leadId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    tenantId: string
  ): Promise<void> {
    const changedFields = this.computeDiff(oldValues, newValues);
    const userContext = await this.addUserContext();

    const payload = {
      lead_id: leadId,
      tenant_id: tenantId,
      action: 'updated',
      changed_fields: changedFields,
      old_values: oldValues,
      new_values: newValues,
      user_id: userContext.userId,
      user_email: userContext.userEmail,
    };

    await this.log([payload]);
  }

  async logLeadDeleted(
    leadId: string,
    leadData: Record<string, any>,
    tenantId: string
  ): Promise<void> {
    const userContext = await this.addUserContext();
    const payload = {
      lead_id: leadId,
      tenant_id: tenantId,
      action: 'deleted',
      changed_fields: Object.keys(leadData),
      old_values: leadData,
      new_values: null,
      user_id: userContext.userId,
      user_email: userContext.userEmail,
    };

    await this.log([payload]);
  }

  private computeDiff(
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ): string[] {
    const changed: string[] = [];
    const allKeys = new Set([
      ...Object.keys(oldValues),
      ...Object.keys(newValues),
    ]);

    allKeys.forEach((key) => {
      if (oldValues[key] !== newValues[key]) {
        changed.push(key);
      }
    });

    return changed;
  }

  private async addUserContext(): Promise<{
    userId: string;
    userEmail: string;
  }> {
    if (!this.supabase) {
      return { userId: 'unknown', userEmail: 'unknown' };
    }

    const { data, error } = await this.supabase.auth.getUser();

    if (error || !data.user) {
      return { userId: 'unknown', userEmail: 'unknown' };
    }

    return {
      userId: data.user.id,
      userEmail: data.user.email || 'unknown',
    };
  }

  private async log(
    records: Record<string, any>[]
  ): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { data, error } = await this.supabase
      .from('crm_audit_logs')
      .insert(records);

    if (error) {
      // Silently fail to avoid disrupting main app flow
      return;
    }
  }
}

export const auditService = CRMAuditService.getInstance();
