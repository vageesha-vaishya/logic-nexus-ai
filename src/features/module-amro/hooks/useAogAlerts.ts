// useAogAlerts — React Query hooks for the AOG (Aircraft on Ground)
// alert REST surface on services/amro-api. Per AOG S3 of
// docs/plans/2026-06-04-aog-alert-surface-design.md.

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

// ── Types mirror the DB columns + LLM triage output ─────────────────

export type AogStatus =
  | 'declared' | 'triaged' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled';

export type AogPriority =
  | 'P1_AOG_CRITICAL' | 'P2_AOG_URGENT' | 'P3_AOG_PLANNED' | 'P4_DEFER_MEL';

export type AogReporterRole =
  | 'flight_crew' | 'maintenance' | 'ground_ops' | 'engineering' | 'other';

export interface AogAlert {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  alert_number: string;
  aircraft_id: string | null;
  aircraft_registration: string | null;
  airport_iata: string;
  airport_local_time: string | null;
  reported_at: string;
  reporter_user_id: string | null;
  reporter_role: AogReporterRole | null;
  defect_summary: string;
  ata_chapter_code: string | null;
  severity_signal: string | null;
  related_warnings: string[];
  mel_eligible: boolean | null;
  status: AogStatus;
  priority: AogPriority | null;
  assigned_to: string | null;
  estimated_recovery_hours: number | null;
  last_triage_output: Record<string, unknown> | null;
  last_triage_invocation_id: string | null;
  last_triage_at: string | null;
  work_order_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface AogAlertWithAircraft extends AogAlert {
  aircraft: {
    id: string;
    registration: string | null;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
  } | null;
}

export interface AogAlertListFilters {
  status?: AogStatus | 'active' | null;
  airport_iata?: string | null;
  aircraft_id?: string | null;
  limit?: number;
}

export interface AogAlertCreateInput {
  airport_iata: string;
  defect_summary: string;
  aircraft_id?: string | null;
  aircraft_registration?: string | null;
  airport_local_time?: string | null;
  reporter_role?: AogReporterRole | null;
  ata_chapter_code?: string | null;
  severity_signal?: string | null;
  related_warnings?: string[];
  mel_eligible?: boolean | null;
}

export interface AogAlertUpdateInput {
  status?: AogStatus;
  priority?: AogPriority | '';
  assigned_to?: string | null;
  estimated_recovery_hours?: number | null;
  ata_chapter_code?: string | null;
  severity_signal?: string | null;
  related_warnings?: string[];
  mel_eligible?: boolean | null;
}

// ── HTTP helper ─────────────────────────────────────────────────────

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

const ALERTS_KEY = ['amro', 'aog', 'alerts'] as const;

export function useAogAlerts(
  filters: AogAlertListFilters = {},
  options: Omit<UseQueryOptions<{ records: AogAlert[]; total: number }>, 'queryKey' | 'queryFn'> = {},
) {
  return useQuery({
    queryKey: [...ALERTS_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.airport_iata) params.set('airport_iata', filters.airport_iata.toUpperCase());
      if (filters.aircraft_id) params.set('aircraft_id', filters.aircraft_id);
      if (filters.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      const res = await authedFetch(`/api/v1/amro/aog/alerts${qs ? `?${qs}` : ''}`);
      return asJson<{ records: AogAlert[]; total: number }>(res);
    },
    ...options,
  });
}

export function useAogAlert(id: string | null | undefined) {
  return useQuery({
    queryKey: [...ALERTS_KEY, id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error('id required');
      const res = await authedFetch(`/api/v1/amro/aog/alerts/${id}`);
      return asJson<AogAlertWithAircraft>(res);
    },
  });
}

export function useCreateAogAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AogAlertCreateInput): Promise<AogAlert> => {
      const res = await authedFetch('/api/v1/amro/aog/alerts', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return asJson<AogAlert>(res);
    },
    onSuccess: (alert) => {
      void qc.invalidateQueries({ queryKey: ALERTS_KEY });
      toast.success(`AOG alert ${alert.alert_number} declared`);
    },
    onError: (e: unknown) => {
      logger.error({ event: 'aog.declare.failed', err: String(e) });
      toast.error(`Failed to declare AOG: ${(e as Error).message}`);
    },
  });
}

export function useUpdateAogAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & AogAlertUpdateInput): Promise<AogAlert> => {
      const { id, ...patch } = input;
      const res = await authedFetch(`/api/v1/amro/aog/alerts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return asJson<AogAlert>(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ALERTS_KEY });
    },
    onError: (e: unknown) => {
      toast.error(`Failed to update AOG alert: ${(e as Error).message}`);
    },
  });
}

export interface AogTriageResponse {
  alert_id: string;
  invocation_id: string;
  triage: Record<string, unknown>;
}

export function useTriageAogAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string): Promise<AogTriageResponse> => {
      const res = await authedFetch(`/api/v1/amro/aog/alerts/${alertId}/triage`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return asJson<AogTriageResponse>(res);
    },
    onSuccess: (resp) => {
      void qc.invalidateQueries({ queryKey: ALERTS_KEY });
      void qc.invalidateQueries({ queryKey: [...ALERTS_KEY, resp.alert_id] });
      toast.success('AI triage complete');
    },
    onError: (e: unknown) => {
      toast.error(`AI triage failed: ${(e as Error).message}`);
    },
  });
}

export interface AogConvertResponse {
  alert_id: string;
  work_order_id: string;
  work_order_number: string | null;
  tasks_inserted: number;
  tasks_warning: string | null;
  status: 'in_progress';
}

export function useConvertAogToWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string): Promise<AogConvertResponse> => {
      const res = await authedFetch(`/api/v1/amro/aog/alerts/${alertId}/convert`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return asJson<AogConvertResponse>(res);
    },
    onSuccess: (resp) => {
      void qc.invalidateQueries({ queryKey: ALERTS_KEY });
      void qc.invalidateQueries({ queryKey: [...ALERTS_KEY, resp.alert_id] });
      const label = resp.work_order_number ?? resp.work_order_id.slice(0, 8);
      const tasksNote = resp.tasks_inserted > 0
        ? ` (${resp.tasks_inserted} task${resp.tasks_inserted === 1 ? '' : 's'} pre-filled from AI plan)`
        : '';
      toast.success(`Converted to work order ${label}${tasksNote}`);
      if (resp.tasks_warning) {
        toast.warning(resp.tasks_warning);
      }
    },
    onError: (e: unknown) => {
      toast.error(`Convert to WO failed: ${(e as Error).message}`);
    },
  });
}

export function useResolveAogAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; resolution_summary?: string }): Promise<AogAlert> => {
      const res = await authedFetch(`/api/v1/amro/aog/alerts/${input.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution_summary: input.resolution_summary ?? null }),
      });
      return asJson<AogAlert>(res);
    },
    onSuccess: (alert) => {
      void qc.invalidateQueries({ queryKey: ALERTS_KEY });
      void qc.invalidateQueries({ queryKey: [...ALERTS_KEY, alert.id] });
      toast.success('AOG alert resolved');
    },
    onError: (e: unknown) => {
      toast.error(`Resolve failed: ${(e as Error).message}`);
    },
  });
}
