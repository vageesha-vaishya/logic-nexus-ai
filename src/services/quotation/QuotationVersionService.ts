import { SupabaseClient } from '@supabase/supabase-js';

export interface VersionMetadata {
  created_by: string;
  created_at: string;
  change_reason?: string;
  source?: string;
  [key: string]: any;
}

export interface QuotationVersion {
  id: string;
  quote_id: string;
  tenant_id: string;
  version_number: number;
  major: number;
  minor: number;
  kind: 'major' | 'minor';
  status: 'draft' | 'active' | 'archived' | 'deleted';
  is_active: boolean;
  is_current: boolean;
  is_locked: boolean;
  locked_at?: string;
  locked_by?: string;
  change_reason?: string;
  metadata?: VersionMetadata;
  created_at: string;
  updated_at: string;
}

export class QuotationVersionService {
  private db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  /**
   * Save a new version of a quotation.
   * Logic:
   * - If type is 'minor', increment minor version.
   * - If type is 'major', increment major version and reset minor to 0.
   * - If existing draft exists and type is 'draft', update it instead of creating new?
   *   (Typically we want immutable versions, but drafts can be mutable until finalized)
   */
  async saveVersion(
    quoteId: string,
    tenantId: string,
    data: any, // The full quote data payload to snapshot
    type: 'draft' | 'minor' | 'major' = 'minor',
    userId: string,
    reason?: string
  ): Promise<QuotationVersion> {
    // 1. Get latest version
    const { data: latest } = await this.db
      .from('quotation_versions')
      .select('major, minor, version_number')
      .eq('quote_id', quoteId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let major = latest?.major || 1;
    let minor = latest?.minor || 0;
    let versionNum = latest?.version_number || 1;

    if (type === 'major') {
      major++;
      minor = 0;
    } else if (type === 'minor') {
      minor++;
    }
    // For 'draft', we might not increment if we just want to update the current draft?
    // Assuming for now every save is a new immutable snapshot for audit trail safety.
    versionNum++;

    // 2. Insert new version record
    const { data: newVersion, error } = await this.db
      .from('quotation_versions')
      .insert({
        quote_id: quoteId,
        tenant_id: tenantId,
        major: major,
        minor: minor,
        version_number: versionNum,
        kind: type === 'major' ? 'major' : 'minor',
        status: type === 'draft' ? 'draft' : 'active',
        change_reason: reason,
        created_by: userId,
        metadata: {
          snapshot: data, // Store full JSON snapshot for easy restoration
          source: 'manual_save'
        }
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Update current_version_id on the parent quote
    const { error: updateError } = await this.db
      .from('quotes')
      .update({ current_version_id: newVersion.id })
      .eq('id', quoteId);

    if (updateError) {
      console.warn('Failed to update current_version_id on quote', updateError);
      // We don't throw here to avoid failing the version save, but it's an inconsistency.
    }

    // 4. Log Audit
    await this.logAudit(newVersion.id, 'CREATED', userId, { type, reason });

    return newVersion;
  }

  /**
   * Retrieve a specific version or the latest active one.
   */
  async getVersion(quoteId: string, versionId?: string): Promise<QuotationVersion | null> {
    let query = this.db.from('quotation_versions').select('*').eq('quote_id', quoteId);

    if (versionId) {
      query = query.eq('id', versionId);
    } else {
      query = query.eq('is_active', true).order('version_number', { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * List all versions for a quote with pagination.
   */
  async listVersions(quoteId: string, page = 1, limit = 10): Promise<{ data: QuotationVersion[]; count: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await this.db
      .from('quotation_versions')
      .select('*', { count: 'exact' })
      .eq('quote_id', quoteId)
      .order('version_number', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  /**
   * Soft delete a version.
   */
  async deleteVersion(versionId: string, userId: string): Promise<boolean> {
    const { error } = await this.db.rpc('soft_delete_quotation_version', {
      version_id: versionId,
      user_id: userId
    });

    if (error) throw error;
    return true;
  }

  /**
   * Purge old archived versions.
   */
  async purgeVersions(retentionDays = 90): Promise<number> {
    const { data, error } = await this.db.rpc('purge_old_quotation_versions', {
      retention_days: retentionDays
    });

    if (error) throw error;
    return data as number;
  }

  private async logAudit(versionId: string, action: string, userId: string, details: any) {
    await this.db.from('quotation_version_audit_logs').insert({
      quotation_version_id: versionId,
      action,
      performed_by: userId,
      details
    });
  }
}
