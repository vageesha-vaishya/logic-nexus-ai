import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { PortfolioTier, UpsertTierInput } from '../types';

export function usePortfolioTiers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: marketsKeys.retail.tiers(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PortfolioTier[]> => {
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('portfolio_tiers')
        .select('*')
        .eq('user_id', user!.id)
        .order('tier_number');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertPortfolioTier() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertTierInput): Promise<PortfolioTier> => {
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('portfolio_tiers')
        .upsert(
          { ...input, user_id: user!.id },
          { onConflict: 'user_id,tier_number' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.tiers() }),
  });
}
