import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { RiskProfile, UpsertRiskProfileInput } from '../types';

/**
 * Fetches the current user's risk profile from markets.risk_profiles.
 * Returns null if the user has not started onboarding yet.
 *
 * Exposes a derived `hasOnboarded` flag so callers can gate the rest of the
 * retail UI without poking at `data?.onboarding_complete` repeatedly.
 */
export function useRiskProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: marketsKeys.retail.profile(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RiskProfile | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('risk_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as RiskProfile | null) ?? null;
    },
  });

  return {
    ...query,
    hasOnboarded: query.data?.onboarding_complete ?? false,
  };
}

/**
 * Upserts the current user's risk profile. RLS enforces `auth.uid() = user_id`
 * so we always stamp the calling user's id server-side via the upsert payload.
 */
export function useUpsertRiskProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertRiskProfileInput): Promise<RiskProfile> => {
      if (!user?.id) throw new Error('Not authenticated');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('markets')
        .from('risk_profiles')
        .upsert({ ...input, user_id: user.id }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data as RiskProfile;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.profile() }),
  });
}
