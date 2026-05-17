/**
 * useConsent — DPDP Act 2023 consent management
 *
 * Reads and writes consent records from platform.consents.
 * Used by ConsentBanner to gate dashboard access until the user
 * has explicitly consented to data processing.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCRM } from '@/hooks/useCRM';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConsentPurposes {
  data_processing: boolean;
  marketing: boolean;
  analytics: boolean;
}

export interface ConsentRecord {
  id:              string;
  consent_version: string;
  purposes:        ConsentPurposes;
  consented_at:    string;
  is_active:       boolean;
}

const CONSENT_VERSION = '1.0';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConsent() {
  const { user, context } = useCRM();
  const userId   = user?.id as string | undefined;
  const tenantId = context?.tenantId as string | null | undefined;
  const qc       = useQueryClient();

  // ── Query ────────────────────────────────────────────────────────────────────

  const query = useQuery<ConsentRecord | null>({
    queryKey:  ['consent', userId],
    staleTime: 10 * 60_000,
    enabled:   Boolean(userId),
    queryFn:   async () => {
      if (!userId) return null;

      const { data, error } = await (supabase as any)
        .schema('platform')
        .from('consents')
        .select('id, consent_version, purposes, consented_at, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('consent_version', CONSENT_VERSION)
        .maybeSingle();

      if (error) throw error;
      return (data as ConsentRecord | null) ?? null;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['consent', userId] });

  // ── giveConsent ───────────────────────────────────────────────────────────────

  const giveConsent = async (purposes: ConsentPurposes) => {
    if (!userId) throw new Error('User not authenticated');

    const { error } = await (supabase as any)
      .schema('platform')
      .from('consents')
      .upsert(
        {
          user_id:         userId,
          tenant_id:       tenantId ?? null,
          consent_version: CONSENT_VERSION,
          purposes,
          is_active:       true,
          consented_at:    new Date().toISOString(),
          withdrawn_at:    null,
        },
        { onConflict: 'user_id,consent_version' },
      );

    if (error) throw error;
    await invalidate();
  };

  // ── withdrawConsent ───────────────────────────────────────────────────────────

  const withdrawConsent = async () => {
    if (!userId) throw new Error('User not authenticated');

    const { error } = await (supabase as any)
      .schema('platform')
      .from('consents')
      .update({ withdrawn_at: new Date().toISOString(), is_active: false })
      .eq('user_id', userId);

    if (error) throw error;
    await invalidate();
  };

  // ── Return ────────────────────────────────────────────────────────────────────

  const consent = query.data ?? null;

  return {
    consent,
    isLoading:       query.isLoading,
    hasConsented:    consent !== null && consent.is_active,
    userId,          // exposed so ConsentBanner can gate on user being ready
    giveConsent,
    withdrawConsent,
  };
}
