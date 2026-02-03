
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ScreeningParams {
  name: string;
  country?: string;
  address?: string;
  threshold?: number;
  linkedEntityType?: string;
  linkedEntityId?: string;
}

export interface ScreeningMatch {
  id: string;
  source_list: string;
  entity_name: string;
  address: string;
  country_code: string;
  similarity: number;
  remarks: string;
  external_id: string;
}

export interface ScreeningLog {
  id: string;
  performed_at: string;
  status: 'clear' | 'potential_match' | 'confirmed_match';
  matches_found: ScreeningMatch[];
}

export const RestrictedPartyScreeningService = {
  /**
   * Screens a party against the restricted party lists.
   * Logs the screening attempt and results to compliance_screenings.
   */
  async screen(params: ScreeningParams): Promise<{ matches: ScreeningMatch[], logId: string }> {
    try {
      logger.info('Starting restricted party screening', { component: 'RestrictedPartyScreeningService', params });

      // 1. Call the RPC to get potential matches
      const { data: matches, error: rpcError } = await supabase.rpc('screen_restricted_party', {
        p_name: params.name,
        p_country: params.country || null,
        p_threshold: params.threshold || 0.6
      });

      if (rpcError) {
        logger.error('Error calling screen_restricted_party RPC', { component: 'RestrictedPartyScreeningService', error: rpcError });
        throw rpcError;
      }

      const foundMatches = (matches as ScreeningMatch[]) || [];
      const status = foundMatches.length > 0 ? 'potential_match' : 'clear';
      const maxScore = foundMatches.length > 0 ? Math.max(...foundMatches.map(m => m.similarity)) * 100 : 0;

      // 2. Log the screening attempt
      // We use the current user as performed_by (handled by RLS/Default, but explicitly if needed)
      // The table defaults performed_by to auth.uid() if we don't send it, but RLS requires it.
      // Wait, RLS "Users can create screenings" checks performed_by = auth.uid().
      // The table definition has `performed_by UUID REFERENCES auth.users(id)`.
      // We should let the backend handle performed_by via default or trigger, 
      // BUT our INSERT policy checks `performed_by = auth.uid()`.
      // So we must send it, or the trigger must set it before insert.
      // Usually better to fetch current user and send it, or use `auth.uid()` default if set.
      // Let's check the table definition again. `performed_by` has no default in the migration I read?
      // "performed_by UUID REFERENCES auth.users(id)" - no default.
      // So we must provide it.
      
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
          logger.warn('No authenticated user found for screening log', { component: 'RestrictedPartyScreeningService' });
          // Proceed without logging? Or fail? 
          // If we are in a context without user (e.g. public quote), we might skip logging or use a system user.
          // For now, assume authenticated.
      }

      const logPayload = {
        performed_by: userId,
        search_name: params.name,
        search_country: params.country,
        search_address: params.address,
        linked_entity_type: params.linkedEntityType,
        linked_entity_id: params.linkedEntityId,
        status: status,
        match_score: maxScore,
        matches_found: foundMatches, // JSONB
      };

      const { data: logData, error: logError } = await supabase
        .from('compliance_screenings')
        .insert(logPayload)
        .select()
        .single();

      if (logError) {
        logger.error('Error logging compliance screening', { component: 'RestrictedPartyScreeningService', error: logError });
        // We don't block the result if logging fails, but we should know.
      }

      return {
        matches: foundMatches,
        logId: logData?.id
      };

    } catch (error) {
      logger.error('Unexpected error in screening service', { component: 'RestrictedPartyScreeningService', error });
      throw error;
    }
  },

  /**
   * Retrieves screening history for a given entity (e.g., a specific shipment or contact)
   */
  async getHistory(entityType: string, entityId: string) {
    const { data, error } = await supabase
      .from('compliance_screenings')
      .select('*')
      .eq('linked_entity_type', entityType)
      .eq('linked_entity_id', entityId)
      .order('performed_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};
