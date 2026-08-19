import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

interface RetryEntry {
  entry: Record<string, any>;
  attempts: number;
  nextRetry: number;
}

export class CRMAuditService {
  private static instance: CRMAuditService | null = null;
  private supabase: SupabaseClient | null = null;
  private retryQueue: RetryEntry[] = [];
  private isRetrying = false;

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
      logger.warn('Failed to log audit entry, queuing for retry:', error);
      // Queue each record for retry
      records.forEach((entry) => {
        this.retryQueue.push({
          entry,
          attempts: 0,
          nextRetry: Date.now() + 5000 // Retry in 5 seconds
        });
      });
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.isRetrying) return;

    const now = Date.now();
    const nextEntry = this.retryQueue.find((e) => e.nextRetry <= now);

    if (!nextEntry) {
      // Schedule next check
      setTimeout(() => this.scheduleRetry(), 5000);
      return;
    }

    this.isRetrying = true;
    this.retryEntry(nextEntry)
      .then(() => {
        this.isRetrying = false;
        this.scheduleRetry();
      })
      .catch(() => {
        this.isRetrying = false;
        setTimeout(() => this.scheduleRetry(), 5000);
      });
  }

  private async retryEntry(retryEntry: RetryEntry): Promise<void> {
    if (retryEntry.attempts >= 3) {
      logger.error(
        'Audit log retry failed after 3 attempts, dropping:',
        retryEntry.entry
      );
      this.retryQueue = this.retryQueue.filter((e) => e !== retryEntry);
      return;
    }

    try {
      const { error } = await this.supabase!
        .from('crm_audit_logs')
        .insert([retryEntry.entry]);

      if (!error) {
        this.retryQueue = this.retryQueue.filter((e) => e !== retryEntry);
        logger.info('Audit log retry succeeded');
      } else {
        retryEntry.attempts++;
        retryEntry.nextRetry = Date.now() + (5000 * Math.pow(2, retryEntry.attempts));
      }
    } catch (err) {
      retryEntry.attempts++;
      retryEntry.nextRetry = Date.now() + (5000 * Math.pow(2, retryEntry.attempts));
    }
  }
}

export const auditService = CRMAuditService.getInstance();
