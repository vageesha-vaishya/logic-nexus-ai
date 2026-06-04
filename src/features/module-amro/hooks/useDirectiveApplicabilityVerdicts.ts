// useDirectiveApplicabilityVerdicts — hooks for the
// amro.directive_applicability REST surface (S2, commit 62ab615c).
// Per Directive Applicability S4 of
// docs/plans/2026-06-04-directive-applicability-surface-design.md.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { getAmroApiBaseUrl } from './amroWorkspaceHelpers';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type ApplicabilityStatus =
  | 'awaiting_review' | 'accepted' | 'overridden' | 'superseded' | 'obsolete';

export type ApplicabilityAction = 'accept' | 'override' | 'snooze';

export interface ApplicabilityVerdict {
  id: string;
  tenant_id: string;
  directive_id: string;
  aircraft_id: string;
  applies: boolean;
  confidence: number;
  reasoning: string | null;
  matched_criteria: string[];
  unmatched_criteria: string[];
  ata_chapters_touched: string[];
  recommended_followup: string | null;
  invocation_id: string | null;
  prompt_key: string;
  prompt_version: number;
  llm_model: string | null;
  status: ApplicabilityStatus;
  human_reviewer_id: string | null;
  human_review_at: string | null;
  human_override_reason: string | null;
  superseded_by: string | null;
  aircraft_snapshot_jsonb: Record<string, unknown>;
  directive_snapshot_jsonb: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApplicabilityListFilters {
  status?: ApplicabilityStatus | null;
}

export interface ApplicabilityQueueFilters {
  max_confidence?: number | null;
  limit?: number;
}

export interface CheckInput {
  directive_id: string;
  aircraft_id: string;
}

export interface CheckResponse {
  verdict: ApplicabilityVerdict;
  invocation_id: string | null;
}

export interface BatchInput {
  pairs: Array<{ directive_id: string; aircraft_id: string }>;
}

export interface BatchPairResult {
  directive_id: string;
  aircraft_id: string;
  verdict?: ApplicabilityVerdict;
  invocation_id?: string;
  error?: string;
}

export interface BatchResponse {
  results: BatchPairResult[];
  total: number;
  success: number;
  failed: number;
}

export interface UpdateInput {
  id: string;
  action: ApplicabilityAction;
  human_override_reason?: string;
  applies?: boolean;
}

// ── HTTP helper (shared pattern with useAogAlerts) ──────────────────

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getAmroApiBaseUrl();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  };
  return fetch(`${base}${path}`, { ...init, headers });
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: string;
    try {
      const body = await res.json();
      detail = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
    } catch {
      detail = `HTTP ${res.status}`;
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ── Hooks ───────────────────────────────────────────────────────────

const KEY = ['amro', 'directive_applicability'] as const;

export function useDirectiveApplicability(
  directiveId: string | null | undefined,
  filters: ApplicabilityListFilters = {},
  options: Omit<UseQueryOptions<{ records: ApplicabilityVerdict[]; total: number }>, 'queryKey' | 'queryFn'> = {},
) {
  return useQuery({
    queryKey: [...KEY, 'by-directive', directiveId, filters],
    enabled: !!directiveId,
    queryFn: async () => {
      if (!directiveId) throw new Error('directiveId required');
      const qs = new URLSearchParams();
      if (filters.status) qs.set('status', filters.status);
      const url = `/api/v1/amro/directives/${directiveId}/applicability${qs.toString() ? `?${qs}` : ''}`;
      const res = await authedFetch(url);
      return asJson<{ records: ApplicabilityVerdict[]; total: number }>(res);
    },
    ...options,
  });
}

export function useAircraftApplicability(
  aircraftId: string | null | undefined,
  filters: ApplicabilityListFilters = {},
  options: Omit<UseQueryOptions<{ records: ApplicabilityVerdict[]; total: number }>, 'queryKey' | 'queryFn'> = {},
) {
  return useQuery({
    queryKey: [...KEY, 'by-aircraft', aircraftId, filters],
    enabled: !!aircraftId,
    queryFn: async () => {
      if (!aircraftId) throw new Error('aircraftId required');
      const qs = new URLSearchParams();
      if (filters.status) qs.set('status', filters.status);
      const url = `/api/v1/amro/aircraft/${aircraftId}/applicability${qs.toString() ? `?${qs}` : ''}`;
      const res = await authedFetch(url);
      return asJson<{ records: ApplicabilityVerdict[]; total: number }>(res);
    },
    ...options,
  });
}

export function useApplicabilityQueue(filters: ApplicabilityQueueFilters = {}) {
  return useQuery({
    queryKey: [...KEY, 'queue', filters],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (typeof filters.max_confidence === 'number') {
        qs.set('max_confidence', String(filters.max_confidence));
      }
      if (filters.limit) qs.set('limit', String(filters.limit));
      const url = `/api/v1/amro/directives/applicability/queue${qs.toString() ? `?${qs}` : ''}`;
      const res = await authedFetch(url);
      return asJson<{ records: ApplicabilityVerdict[]; total: number }>(res);
    },
  });
}

export function useCheckApplicability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckInput): Promise<CheckResponse> => {
      const res = await authedFetch('/api/v1/amro/directives/applicability/check', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return asJson<CheckResponse>(res);
    },
    onSuccess: (resp) => {
      // Invalidate per-directive AND per-aircraft caches since this new
      // verdict lands in both views.
      void qc.invalidateQueries({ queryKey: [...KEY, 'by-directive', resp.verdict.directive_id] });
      void qc.invalidateQueries({ queryKey: [...KEY, 'by-aircraft', resp.verdict.aircraft_id] });
      void qc.invalidateQueries({ queryKey: [...KEY, 'queue'] });
      toast.success(
        resp.verdict.applies
          ? `Applies (${Math.round(resp.verdict.confidence * 100)}% confidence)`
          : `Does not apply (${Math.round(resp.verdict.confidence * 100)}% confidence)`,
      );
    },
    onError: (e: unknown) => {
      logger.error({ event: 'directive_applicability.check.failed', err: String(e) });
      toast.error(`Applicability check failed: ${(e as Error).message}`);
    },
  });
}

export function useBatchCheckApplicability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BatchInput): Promise<BatchResponse> => {
      if (input.pairs.length > 20) {
        throw new Error('Synchronous batch capped at 20 pairs. Use the (TODO) BullMQ worker for fleet-wide.');
      }
      const res = await authedFetch('/api/v1/amro/directives/applicability/batch', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return asJson<BatchResponse>(res);
    },
    onSuccess: (resp) => {
      void qc.invalidateQueries({ queryKey: KEY });
      if (resp.failed > 0) {
        toast.warning(`Batch: ${resp.success} ok, ${resp.failed} failed`);
      } else {
        toast.success(`Batch complete: ${resp.success} verdicts persisted`);
      }
    },
    onError: (e: unknown) => {
      toast.error(`Batch failed: ${(e as Error).message}`);
    },
  });
}

export function useUpdateApplicabilityVerdict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInput): Promise<ApplicabilityVerdict> => {
      const { id, ...payload } = input;
      const res = await authedFetch(`/api/v1/amro/directives/applicability/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return asJson<ApplicabilityVerdict>(res);
    },
    onSuccess: (verdict) => {
      void qc.invalidateQueries({ queryKey: KEY });
      const labelMap: Record<ApplicabilityStatus, string> = {
        awaiting_review: 'Snoozed for later',
        accepted: 'Verdict accepted',
        overridden: 'Verdict overridden',
        superseded: 'Verdict superseded',
        obsolete: 'Verdict marked obsolete',
      };
      toast.success(labelMap[verdict.status]);
    },
    onError: (e: unknown) => {
      toast.error(`Update failed: ${(e as Error).message}`);
    },
  });
}
