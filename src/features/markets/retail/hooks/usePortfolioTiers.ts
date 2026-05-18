import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { PortfolioTier, UpsertTierInput } from '../types';

/**
 * Lists the three tier slots (Safety Net / Core Portfolio / Experimental)
 * for the current user, sorted by tier_number. Empty array before the user
 * has run through onboarding's tier-setup step.
 */
export function usePortfolioTiers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: marketsKeys.retail.tiers(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PortfolioTier[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('portfolio_tiers')
        .select('*')
        .eq('user_id', user!.id)
        .order('tier_number');
      if (error) throw error;
      return (data as PortfolioTier[]) ?? [];
    },
  });
}

/**
 * Upserts one tier slot. Conflicts on (user_id, tier_number) so re-saving
 * the same slot updates in place rather than creating duplicates.
 */
export function useUpsertPortfolioTier() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertTierInput): Promise<PortfolioTier> => {
      if (!user?.id) throw new Error('Not authenticated');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('portfolio_tiers')
        .upsert(
          { ...input, user_id: user.id },
          { onConflict: 'user_id,tier_number' },
        )
        .select()
        .single();
      if (error) throw error;
      return data as PortfolioTier;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.tiers() }),
  });
}
