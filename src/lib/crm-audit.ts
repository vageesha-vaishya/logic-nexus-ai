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

  /**
   * Like computeDiff, but also returns old/new value maps narrowed to only
   * the fields that actually changed (used by the generic entity_type/
   * entity_id logging methods below, e.g. logContactUpdated).
   */
  private computeChangeSet(
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ): {
    changed_fields: string[];
    old_values: Record<string, any>;
    new_values: Record<string, any>;
  } {
    const changed_fields = this.computeDiff(oldValues, newValues);
    const old_values: Record<string, any> = {};
    const new_values: Record<string, any> = {};
    changed_fields.forEach((key) => {
      old_values[key] = oldValues[key];
      new_values[key] = newValues[key];
    });
    return { changed_fields, old_values, new_values };
  }

  /**
   * Generic single-record logger for the entity_type/entity_id-shaped rows
   * (contact/opportunity/quote/interaction). Adds user context the same way
   * the lead-specific methods do, then delegates to the array-based log().
   */
  private async logEntry(entry: Record<string, any>): Promise<void> {
    const userContext = await this.addUserContext();
    await this.log([
      {
        user_id: userContext.userId,
        user_email: userContext.userEmail,
        ...entry,
      },
    ]);
  }

  async logContactCreated(
    contactId: string,
    leadId: string,
    values: Record<string, any>,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    await this.logEntry({
      action: 'create',
      entity_type: 'contact',
      entity_id: contactId,
      related_entity_id: leadId,
      related_entity_type: 'lead',
      new_values: values,
      changed_fields: Object.keys(values),
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
    });
  }

  async logContactUpdated(
    contactId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    const { changed_fields, old_values, new_values } = this.computeChangeSet(
      oldValues,
      newValues
    );
    if (changed_fields.length === 0) return;
    await this.logEntry({
      action: 'update',
      entity_type: 'contact',
      entity_id: contactId,
      old_values,
      new_values,
      changed_fields,
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
    });
  }

  async logContactInteraction(
    contactId: string,
    type: 'call' | 'email' | 'meeting',
    details: Record<string, any>,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    await this.logEntry({
      action: 'interaction',
      entity_type: 'interaction',
      entity_id: `${contactId}-${Date.now()}`,
      related_entity_id: contactId,
      related_entity_type: 'contact',
      new_values: details,
      metadata: { interaction_type: type },
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
    });
  }

  async logOpportunityCreated(
    opportunityId: string,
    leadId: string,
    values: Record<string, any>,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    await this.logEntry({
      action: 'create',
      entity_type: 'opportunity',
      entity_id: opportunityId,
      related_entity_id: leadId,
      related_entity_type: 'lead',
      new_values: values,
      changed_fields: Object.keys(values),
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
    });
  }

  async logPipelineMove(
    opportunityId: string,
    fromStage: string,
    toStage: string,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    await this.logEntry({
      action: 'move',
      entity_type: 'opportunity',
      entity_id: opportunityId,
      metadata: { stage_from: fromStage, stage_to: toStage },
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
    });
  }

  async logQuoteCreated(
    quoteId: string,
    opportunityId: string,
    values: Record<string, any>,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    await this.logEntry({
      action: 'create',
      entity_type: 'quote',
      entity_id: quoteId,
      related_entity_id: opportunityId,
      related_entity_type: 'opportunity',
      new_values: values,
      changed_fields: Object.keys(values),
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
    });
  }

  async logQuoteApproved(
    quoteId: string,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    await this.logEntry({
      action: 'approve',
      entity_type: 'quote',
      entity_id: quoteId,
      tenant_id: tenantId,
      franchise_id: franchiseId ?? null,
    });
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
