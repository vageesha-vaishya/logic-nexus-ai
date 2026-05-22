/**
 * Fetch + upsert markets.retail_profile (wizard-meta state).
 *
 * Separate from useRiskProfile (which owns the investment-meta side:
 * quiz_answers, goals, risk_tag). retail_profile holds the wizard's own
 * checkpoints: disclosure acceptance, nominee, tour-completed.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';

export interface RetailProfile {
  user_id:                string;
  disclosure_accepted_at: string | null;
  tour_completed:         boolean;
  nominee: {
    name?:         string;
    relationship?: string;
    pan?:          string;
    share_pct?:    number;
    /** Set to true if user explicitly skipped the nominee step. */
    skipped?:      boolean;
  } | null;
  created_at: string;
  updated_at: string;
}

export type RetailProfilePatch = Partial<
  Pick<RetailProfile, 'disclosure_accepted_at' | 'tour_completed' | 'nominee'>
>;

const RETAIL_PROFILE_KEY = () =>
  [...marketsKeys.retail.all(), 'retail_profile'] as const;

export function useRetailProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: RETAIL_PROFILE_KEY(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RetailProfile | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('retail_profile')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as RetailProfile | null) ?? null;
    },
  });
}

export function useUpsertRetailProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: RetailProfilePatch): Promise<RetailProfile> => {
      if (!user?.id) throw new Error('Not authenticated');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('retail_profile')
        .upsert(
          { user_id: user.id, ...patch, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        )
        .select()
        .single();
      if (error) throw error;
      return data as RetailProfile;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: RETAIL_PROFILE_KEY() }),
  });
}
