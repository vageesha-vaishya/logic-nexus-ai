import { supabase } from '@/integrations/supabase/client';
import { JournalEntry, JournalEntryInsert } from './types';

export class GLSyncService {
  /**
   * Syncs a finalized financial document (Invoice/Payment) to the external GL.
   * This method is intended to be called asynchronously (e.g., via a job queue).
   */
  static async syncTransaction(tenantId: string, referenceId: string, type: 'INVOICE' | 'PAYMENT'): Promise<void> {
    console.log(`Syncing ${type} ${referenceId} for tenant ${tenantId} to GL...`);
    
    // 1. Create a pending Journal Entry record
    const entry: JournalEntryInsert = {
      tenant_id: tenantId,
      reference_id: referenceId,
      reference_type: type,
      sync_status: 'PENDING',
      retry_count: 0
    };

    const { data: journalEntry, error: insertError } = await supabase
      .schema('finance')
      .from('journal_entries')
      .insert(entry)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create journal entry record', insertError);
      throw insertError;
    }

    try {
      // 2. Fetch transaction details (Mocking the data fetch for now)
      // In a real scenario, we would fetch the Invoice/Payment and its lines
      // const document = await InvoiceService.getInvoice(referenceId);

      // 3. Push to External Connector (Mock)
      await this.mockExternalSync(journalEntry.id);

      // 4. Update sync status to SYNCED
      const { error: updateError } = await supabase
        .schema('finance')
        .from('journal_entries')
        .update({
          sync_status: 'SYNCED',
          synced_at: new Date().toISOString(),
          external_id: `EXT-${Math.floor(Math.random() * 100000)}`
        })
        .eq('id', journalEntry.id);

      if (updateError) throw updateError;
      console.log(`Successfully synced ${type} ${referenceId} to GL.`);

    } catch (err: any) {
      console.error('GL Sync failed', err);
      
      // Update status to FAILED
      await supabase
        .schema('finance')
        .from('journal_entries')
        .update({
          sync_status: 'FAILED',
          error_message: err.message || 'Unknown error'
        })
        .eq('id', journalEntry.id);
        
      throw err;
    }
  }

  private static async mockExternalSync(journalEntryId: string): Promise<void> {
    // Simulate network delay
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  /**
   * Get sync status for a transaction
   */
  static async getSyncStatus(referenceId: string): Promise<JournalEntry | null> {
    const { data, error } = await supabase
        .schema('finance')
        .from('journal_entries')
        .select('*')
        .eq('reference_id', referenceId)
        .maybeSingle();
        
    if (error) throw error;
    return data;
  }
}
