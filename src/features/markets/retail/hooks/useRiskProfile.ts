import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { RiskProfile, UpsertRiskProfileInput } from '../types';

export function useRiskProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: marketsKeys.retail.profile(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RiskProfile | null> => {
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('risk_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  return {
    ...query,
    hasOnboarded: query.data?.onboarding_complete ?? false,
  };
}

export function useUpsertRiskProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertRiskProfileInput): Promise<RiskProfile> => {
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('risk_profiles')
        .upsert({ ...input, user_id: user!.id }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.profile() }),
  });
}
