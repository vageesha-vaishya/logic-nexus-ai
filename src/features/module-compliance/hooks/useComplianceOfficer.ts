// Data layer for the compliance-officer UI (Slice B of Phase 6).
//
// Step 2 cutover: now goes through services/compliance-api via
// /api/compliance/v1/* instead of reading the compliance schema
// directly from PostgREST. Mirrors how finance / logistics / sales
// hooks talk to their dedicated APIs.
//
// Upstream routes (services/compliance-api/src/routes/screenings.routes.ts):
//   GET  /api/v1/compliance/blocked-parties
//   GET  /api/v1/compliance/screenings/:id
//   GET  /api/v1/compliance/screenings/:id/decisions
//   POST /api/v1/compliance/screenings/:id/override
//   POST /api/v1/compliance/screenings/:id/revoke-override

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import {
  getBlockedParties,
  getScreening,
  getScreeningDecisions,
  overrideScreening,
  revokeOverride,
  gateCheck,
  type GateCheckResult,
} from '../lib/complianceApi';

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
      try {
        return await getBlockedParties<BlockedPartyRow>(status === 'all' ? undefined : status, 500);
      } catch (e) {
        logger.error({ event: 'compliance.officer.list.failed', error: String(e) });
        throw e;
      }
    },
    staleTime: 30_000,
  });
}

export function useScreening(id: string | undefined) {
  return useQuery({
    queryKey: screeningKey(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<ScreeningDetail | null> => {
      try {
        return await getScreening<ScreeningDetail>(id!);
      } catch (e) {
        logger.error({ event: 'compliance.screening.fetch.failed', id, error: String(e) });
        throw e;
      }
    },
  });
}

export function useScreeningDecisions(id: string | undefined) {
  return useQuery({
    queryKey: decisionsKey(id ?? ''),
    enabled: Boolean(id),
    queryFn: async (): Promise<ScreeningDecisionRow[]> => {
      try {
        return await getScreeningDecisions<ScreeningDecisionRow>(id!);
      } catch (e) {
        logger.error({ event: 'compliance.decisions.fetch.failed', id, error: String(e) });
        throw e;
      }
    },
  });
}

export type ComplianceGateSubjectType =
  | 'sales.lead'
  | 'quotation.quote'
  | 'logistics.booking'
  | 'finance.payment';

const gateCheckKey = (t: ComplianceGateSubjectType, id: string) =>
  ['compliance', 'gate-check', t, id] as const;

/**
 * Polls the verdict of the most recent screening for a subject so a
 * caller can refuse to commit a send / create / release transition
 * when verdict is 'failed' or 'flagged' (without override).
 *
 * Pass disabled=true to suspend the query (initiating modules typically
 * only want to check right before a Send button is clicked).
 */
export function useGateCheck(
  subjectType: ComplianceGateSubjectType,
  subjectId: string | undefined,
  opts: { enabled?: boolean } = {},
) {
  const enabled = (opts.enabled ?? true) && Boolean(subjectId);
  return useQuery({
    queryKey: gateCheckKey(subjectType, subjectId ?? ''),
    enabled,
    queryFn: async (): Promise<GateCheckResult> => {
      try {
        return await gateCheck(subjectType, subjectId!);
      } catch (e) {
        logger.error({ event: 'compliance.gate_check.failed', subjectType, subjectId, error: String(e) });
        throw e;
      }
    },
    staleTime: 10_000,
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
      return overrideScreening(input);
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
      return revokeOverride(input);
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
