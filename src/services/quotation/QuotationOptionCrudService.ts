import { SupabaseClient } from '@supabase/supabase-js';

export class QuotationOptionCrudService {
  constructor(private db: SupabaseClient) {}

  async deleteOption(optionId: string, reason?: string): Promise<{ reselectedOptionId?: string | null }> {
    const { data, error } = await this.db.rpc('delete_quote_option_safe', {
      p_option_id: optionId,
      p_reason: reason || null,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Failed to delete option');

    return { reselectedOptionId: data?.reselected_option_id ?? null };
  }
}

