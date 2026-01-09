import { SupabaseClient } from '@supabase/supabase-js';

export interface ImportSession {
  id: string;
  entity_name: string;
  table_name: string;
  file_name: string;
  imported_at: string;
  status: 'success' | 'partial' | 'failed' | 'reverted';
  summary: any;
}

export interface ImportDetail {
  record_id: string;
  operation_type: 'insert' | 'update';
  previous_data?: any; // For updates
  new_data?: any;
}

export const ImportHistoryService = {
  /**
   * Starts a new import session log
   */
  async createSession(
    supabase: SupabaseClient, 
    data: { entity_name: string; table_name: string; file_name: string; imported_by?: string }
  ) {
    const { data: session, error } = await supabase
      .from('import_history')
      .insert({
        entity_name: data.entity_name,
        table_name: data.table_name,
        file_name: data.file_name,
        imported_by: data.imported_by,
        status: 'partial', // Initially partial until complete
        summary: { success: 0, failed: 0, inserted: 0, updated: 0 }
      })
      .select()
      .single();

    if (error) throw error;
    return session as ImportSession;
  },

  /**
   * Logs details for a batch of processed records
   */
  async logDetails(
    supabase: SupabaseClient,
    importId: string,
    details: ImportDetail[]
  ) {
    if (!details.length) return;

    const { error } = await supabase
      .from('import_history_details')
      .insert(
        details.map(d => ({
          import_id: importId,
          record_id: d.record_id,
          operation_type: d.operation_type,
          previous_data: d.previous_data,
          new_data: d.new_data
        }))
      );

    if (error) throw error;
  },

  /**
   * Updates the session status and summary
   */
  async updateSession(
    supabase: SupabaseClient,
    id: string,
    updates: { status?: string; summary?: any }
  ) {
    const { error } = await supabase
      .from('import_history')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Performs the revert operation
   */
  async revertImport(
    supabase: SupabaseClient,
    importId: string
  ): Promise<{ revertedInserts: number; revertedUpdates: number }> {
    // 1. Get Session Info
    const { data: session, error: sessionError } = await supabase
      .from('import_history')
      .select('*')
      .eq('id', importId)
      .single();
    
    if (sessionError || !session) throw new Error("Import session not found");
    if (session.status === 'reverted') throw new Error("Import already reverted");

    const tableName = session.table_name;

    // 2. Fetch all details (handling pagination if needed, but for now assuming it fits in memory or we chunk it)
    // Supabase limit is usually 1000. We might need to page.
    // Let's implement paging to be safe.
    let allDetails: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
        const { data: details, error: detailsError } = await supabase
            .from('import_history_details')
            .select('*')
            .eq('import_id', importId)
            .range(page * pageSize, (page + 1) * pageSize - 1);
            
        if (detailsError) throw detailsError;
        if (!details || details.length === 0) break;
        
        allDetails = [...allDetails, ...details];
        if (details.length < pageSize) break;
        page++;
    }

    const inserts = allDetails.filter(d => d.operation_type === 'insert');
    const updates = allDetails.filter(d => d.operation_type === 'update');

    // 3. Revert Inserts (Delete)
    if (inserts.length > 0) {
        const idsToDelete = inserts.map(d => d.record_id);
        // Delete in batches of 1000
        for (let i = 0; i < idsToDelete.length; i += 1000) {
            const batch = idsToDelete.slice(i, i + 1000);
            const { error: deleteError } = await supabase
                .from(tableName as any)
                .delete()
                .in('id', batch);
            
            if (deleteError) throw deleteError;
        }
    }

    // 4. Revert Updates (Restore previous_data)
    if (updates.length > 0) {
        // Restore in batches
        const recordsToRestore = updates
            .filter(d => d.previous_data) // Only if we have previous data
            .map(d => d.previous_data);
            
        for (let i = 0; i < recordsToRestore.length; i += 1000) {
            const batch = recordsToRestore.slice(i, i + 1000);
            const { error: restoreError } = await supabase
                .from(tableName as any)
                .upsert(batch); // Upsert will update based on PK (id)
            
            if (restoreError) throw restoreError;
        }
    }

    // 5. Update Status
    await this.updateSession(supabase, importId, { 
        status: 'reverted',
        reverted_at: new Date().toISOString(),
        reverted_by: (await supabase.auth.getUser()).data.user?.id
    });

    return {
        revertedInserts: inserts.length,
        revertedUpdates: updates.length
    };
  }
};
