// Data layer for the compliance-officer UI (Slice B of Phase 6).
//
// Backs onto:
//   - compliance.v_blocked_parties     (officer inbox feed)
//   - compliance.v_screening_decisions (per-screening decision history)
//   - compliance.screenings            (per-screening detail)
//   - compliance.override_screening    (RPC)
//   - compliance.revoke_override       (RPC)
//
// Schema is exposed via PostgREST (see memory: project_postgrest_exposed_schemas).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

const compliance = () => (supabase as unknown as { schema: (s: string) => typeof supabase }).schema('compliance');

export type BlockedPartyStatus = 'all' | 'failed' | 'overridden' | 'expired';

export interface BlockedPartyRow {
  screening_id: string;
  tenant_id: string;
  subject_type: string;
  subject_id: string | null;
  party_id: string | null;
  party_display_name: string | null;
  account_id: string | null;
  account_name: string | null;
  lead_id: string | null;
  lead_company_name: string | null;
  lead_email: string | null;
  status: string;
  decision: string | null;
  triggered_at: string;
  triggered_by_event: string | null;
  provider: string | null;
  hit_count: number | null;
  max_similarity: number | null;
  hits: unknown;
  expires_at: string | null;
}

export interface ScreeningDecisionRow {
  audit_decision_id: string;
  screening_id: string;
  screening_subject_id: string | null;
  screening_subject_type: string | null;
  screening_current_status: string;
  override_decision: string;
  previous_status: string | null;
  new_status: string;
  reason: string;
  decided_by_user_id: string;
  decided_at: string;
  evidence_file_ids: string[] | null;
  evidence_file_count: number | null;
  metadata: Record<string, unknown> | null;
}

export interface ScreeningDetail {
  id: string;
  tenant_id: string;
  subject_type: string;
  subject_id: string | null;
  subject_party_id: string | null;
  search_name: string;
  search_country: string | null;
  status: string;
  decision: string | null;
  match_score: number | null;
  hits: unknown;
  provider: string | null;
  provider_request_id: string | null;
  triggered_by_event: string | null;
  performed_at: string;
  decided_by_user_id: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  evidence_file_ids: string[] | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
}

const blockedPartiesKey = (status: BlockedPartyStatus) => ['compliance', 'blocked_parties', status] as const;
const screeningKey = (id: string) => ['compliance', 'screening', id] as const;
const decisionsKey = (id: string) => ['compliance', 'screening_decisions', id] as const;

export function useBlockedParties(status: BlockedPartyStatus = 'failed') {
  return useQuery({
    queryKey: blockedPartiesKey(status),
    queryFn: async (): Promise<BlockedPartyRow[]> => {
      let q = compliance()
        .from('v_blocked_parties')
        .select(
          'screening_id, tenant_id, subject_type, subject_id, party_id, party_display_name, account_id, account_name, lead_id, lead_company_name, lead_email, status, decision, triggered_at, triggered_by_event, provider, hit_count, max_similarity, hits, expires_at',
        )
        .order('triggered_at', { ascending: false })
        .limit(500);
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) {
        logger.error({ event: 'compliance.officer.list.failed', error: String(error) });
        throw error;
      }
      return (data ?? []) as BlockedPartyRow[];
    },
    staleTime: 30_000,
  });
}

export function useScreening(id: string | undefined) {
  return useQuery({
    queryKey: screeningKey(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<ScreeningDetail | null> => {
      const { data, error } = await compliance()
        .from('screenings')
        .select(
          'id, tenant_id, subject_type, subject_id, subject_party_id, search_name, search_country, status, decision, match_score, hits, provider, provider_request_id, triggered_by_event, performed_at, decided_by_user_id, decided_at, decision_notes, evidence_file_ids, expires_at, metadata, notes',
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) {
        logger.error({ event: 'compliance.screening.fetch.failed', id, error: String(error) });
        throw error;
      }
      return (data ?? null) as ScreeningDetail | null;
    },
  });
}

export function useScreeningDecisions(id: string | undefined) {
  return useQuery({
    queryKey: decisionsKey(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<ScreeningDecisionRow[]> => {
      const { data, error } = await compliance()
        .from('v_screening_decisions')
        .select(
          'audit_decision_id, screening_id, screening_subject_id, screening_subject_type, screening_current_status, override_decision, previous_status, new_status, reason, decided_by_user_id, decided_at, evidence_file_ids, evidence_file_count, metadata',
        )
        .eq('screening_id', id!)
        .order('decided_at', { ascending: false });
      if (error) {
        logger.error({ event: 'compliance.decisions.fetch.failed', id, error: String(error) });
        throw error;
      }
      return (data ?? []) as ScreeningDecisionRow[];
    },
  });
}

export interface OverrideInput {
  screening_id: string;
  reason: string;
  evidence_file_ids?: string[];
}

export function useOverrideScreening() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OverrideInput) => {
      if (!user?.id) throw new Error('not_authenticated');
      const { data, error } = await compliance().rpc('override_screening', {
        p_screening_id: input.screening_id,
        p_user_id: user.id,
        p_reason: input.reason,
        p_evidence_file_ids: input.evidence_file_ids ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      toast.success('Screening overridden');
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: screeningKey(vars.screening_id) });
      qc.invalidateQueries({ queryKey: decisionsKey(vars.screening_id) });
    },
    onError: (e: unknown) => {
      toast.error(`Override failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}

export interface RevokeInput {
  screening_id: string;
  reason: string;
}

export function useRevokeOverride() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RevokeInput) => {
      if (!user?.id) throw new Error('not_authenticated');
      const { data, error } = await compliance().rpc('revoke_override', {
        p_screening_id: input.screening_id,
        p_user_id: user.id,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      toast.success('Override revoked');
      qc.invalidateQueries({ queryKey: ['compliance'] });
      qc.invalidateQueries({ queryKey: screeningKey(vars.screening_id) });
      qc.invalidateQueries({ queryKey: decisionsKey(vars.screening_id) });
    },
    onError: (e: unknown) => {
      toast.error(`Revoke failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
