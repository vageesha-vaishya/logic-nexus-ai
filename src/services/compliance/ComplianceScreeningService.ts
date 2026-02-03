import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ScreeningMatch {
    id: string;
    source_list: string;
    entity_name: string;
    address: string;
    country_code: string;
    similarity: number;
    remarks: string;
}

export interface ScreeningResult {
    status: 'clear' | 'potential_match' | 'confirmed_match';
    matches: ScreeningMatch[];
    screening_id: string;
}

export interface QuoteScreeningResult extends ScreeningResult {
    quote_screening_id: string;
    cached?: boolean;
}

export const ComplianceScreeningService = {
    /**
     * Screens a party against restricted party lists (DPL, EL, SDN, etc.)
     * and logs the result to the compliance_screenings audit table.
     */
    async screenEntity(
        name: string, 
        country: string | null = null, 
        entityType: 'contact' | 'account' | 'lead' | 'custom' = 'custom',
        entityId: string | null = null
    ): Promise<ScreeningResult | null> {
        try {
            // 1. Perform Screening via RPC
            const { data: matches, error: rpcError } = await supabase.rpc('screen_restricted_party', {
                p_name: name,
                p_country: country,
                p_threshold: 0.6 // 60% similarity threshold
            });

            if (rpcError) {
                logger.error('RPC Error in screenEntity', { error: rpcError, component: 'ComplianceScreeningService' });
                throw rpcError;
            }

            const status = (matches && matches.length > 0) ? 'potential_match' : 'clear';
            const bestScore = (matches && matches.length > 0) ? (matches[0].similarity || 0) * 100 : 0;

            // 2. Log to Audit Table
            const { data: userData } = await supabase.auth.getUser();
            
            const { data: logData, error: logError } = await supabase
                .from('compliance_screenings')
                .insert({
                    search_name: name,
                    search_country: country,
                    linked_entity_type: entityType,
                    linked_entity_id: entityId,
                    status: status,
                    match_score: bestScore,
                    matches_found: matches ? matches : [],
                    performed_by: userData.user?.id
                })
                .select('id')
                .single();

            if (logError) {
                // Non-blocking error, but should be logged
                 logger.error('Failed to log screening result', { error: logError, component: 'ComplianceScreeningService' });
            }

            return {
                status,
                matches: (matches || []) as ScreeningMatch[],
                screening_id: logData?.id || ''
            };

        } catch (error) {
            logger.error('Error in screenEntity', { error, component: 'ComplianceScreeningService' });
            return null;
        }
    },

    /**
     * Screens a specific contact for a quote context.
     * Caches 'clear' results for 24 hours to avoid duplicate calls.
     * Persists result in quote_contacts_screening.
     */
    async screenQuoteContact(
        quoteId: string,
        contactId: string,
        direction: 'shipper' | 'consignee',
        contactName: string,
        contactCountry: string | null = null
    ): Promise<QuoteScreeningResult | null> {
        try {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            // 1. Check Cache (Recent Clear Screening < 24h)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: recentScreening } = await supabase
                .from('compliance_screenings')
                .select('*')
                .eq('linked_entity_type', 'contact')
                .eq('linked_entity_id', contactId)
                .eq('status', 'clear')
                .gte('performed_at', twentyFourHoursAgo)
                .order('performed_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let screeningResult: ScreeningResult | null = null;
            let isCached = false;

            if (recentScreening) {
                isCached = true;
                screeningResult = {
                    status: 'clear',
                    matches: [],
                    screening_id: recentScreening.id
                };
            } else {
                // 2. Perform New Screening
                screeningResult = await this.screenEntity(contactName, contactCountry, 'contact', contactId);
            }

            if (!screeningResult) return null;

            // 3. Persist in Quote Context
            // Map 'potential_match' -> 'review' or 'hit' for quote context. 
            // We'll use 'hit' if there are matches, 'cleared' if clear.
            // The requirement says: green = cleared, red = hit, amber = review.
            // For now, if matches > 0, we set to 'hit' (user can override to review/cleared).
            
            let quoteStatus = 'pending';
            if (screeningResult.status === 'clear') {
                quoteStatus = 'cleared';
            } else if (screeningResult.status === 'potential_match' || screeningResult.status === 'confirmed_match') {
                quoteStatus = 'hit';
            }

            const { data: quoteScreening, error: qsError } = await supabase
                .from('quote_contacts_screening')
                .upsert({
                    quote_id: quoteId,
                    contact_id: contactId,
                    direction: direction,
                    status: quoteStatus,
                    matched_json: screeningResult.matches,
                    performed_by: userId
                }, { onConflict: 'quote_id, direction' })
                .select('id')
                .single();

            if (qsError) {
                logger.error('Failed to save quote screening result', { error: qsError });
                throw qsError;
            }

            return {
                ...screeningResult,
                quote_screening_id: quoteScreening.id,
                cached: isCached
            };

        } catch (error) {
            logger.error('Error in screenQuoteContact', { error, component: 'ComplianceScreeningService' });
            return null;
        }
    }
};
