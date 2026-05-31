import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InvoiceFinalizedEvent } from '../../events/finance-events.types.js';
import { MockERPConnector } from './MockERPConnector.js';

export class GLPosterService {
  // Lazy: defer client creation to first use so module-load doesn't
  // crash when env vars aren't set yet (e.g., during container boot
  // before secrets land, or during local typecheck without .env).
  private static _supabase: SupabaseClient | null = null;

  private static get supabase(): SupabaseClient {
    if (this._supabase) return this._supabase;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    this._supabase = createClient(supabaseUrl, supabaseServiceKey);
    return this._supabase;
  }

  static async postInvoiceFinalized(event: InvoiceFinalizedEvent): Promise<void> {
    const tenantId = event.tenant_id;
    const invoiceId = event.data.invoice_id;
    const existingEntry = await this.getExistingJournalEntry(tenantId, invoiceId);

    if (existingEntry) {
      return;
    }

    const { data: inserted, error: insertError } = await this.supabase
      .schema('finance')
      .from('journal_entries')
      .insert({
        tenant_id: tenantId,
        reference_id: invoiceId,
        reference_type: 'INVOICE',
        sync_status: 'PENDING',
        retry_count: 0
      })
      .select('id,retry_count')
      .single();

    if (insertError || !inserted) {
      throw insertError || new Error('Failed to insert journal entry');
    }

    try {
      const connectorResult = await MockERPConnector.syncJournalEntry({
        journalEntryId: inserted.id,
        tenantId,
        referenceId: invoiceId,
        type: 'INVOICE'
      });

      const { error: syncError } = await this.supabase
        .schema('finance')
        .from('journal_entries')
        .update({
          sync_status: 'SYNCED',
          external_id: connectorResult.externalId,
          synced_at: new Date().toISOString()
        })
        .eq('id', inserted.id);

      if (syncError) {
        throw syncError;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'GL sync failed';
      const { error: failedUpdateError } = await this.supabase
        .schema('finance')
        .from('journal_entries')
        .update({
          sync_status: 'FAILED',
          retry_count: Number(inserted.retry_count || 0) + 1,
          error_message: message
        })
        .eq('id', inserted.id);

      if (failedUpdateError) {
        throw failedUpdateError;
      }

      throw error;
    }
  }

  private static async getExistingJournalEntry(tenantId: string, invoiceId: string) {
    const { data, error } = await this.supabase
      .schema('finance')
      .from('journal_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('reference_id', invoiceId)
      .eq('reference_type', 'INVOICE')
      .in('sync_status', ['PENDING', 'SYNCED'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }
}
