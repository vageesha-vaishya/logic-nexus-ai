import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

export type MpdRecord = {
  id: string;
  mpd_sequence: number | null;
  mpd_code: string | null;
  ata_code: string | null;
  reference_amp: string | null;
  description: string | null;
  category_code: string | null;
  estimated_man_hours: number | null;
  revision_status: string | null;
  interval_hours: number | null;
  interval_cycles: number | null;
  interval_months: number | null;
  is_mandatory: boolean;
  assembly_model_id: string | null;
  task_template_detail_json: unknown[];
  task_template_scope_json: unknown[];
  created_at: string | null;
  updated_at: string | null;
};

export type MpdUpsertInput = {
  mpd_code?: string | null;
  ata_code?: string | null;
  reference_amp?: string | null;
  description?: string | null;
  category_code?: string | null;
  estimated_man_hours?: number | null;
  revision_status?: string | null;
  interval_hours?: number | null;
  interval_cycles?: number | null;
  interval_months?: number | null;
  is_mandatory?: boolean;
  assembly_model_id?: string | null;
  task_template_detail_json?: unknown[];
  task_template_scope_json?: unknown[];
};

type MpdListResponse = {
  records: MpdRecord[];
  total: number;
  page: number;
  page_size: number;
};

const MPD_KEY = ['amro', 'mpd'] as const;

function normalizeString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBoolean(value: unknown, fallback = true): boolean {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function normalizeJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function mapApiRecordToMpdRecord(record: Record<string, unknown>): MpdRecord {
  return {
    id: String(record.id || ''),
    mpd_sequence: normalizeNumber(record.mpd_sequence),
    mpd_code: normalizeString(record.mpd_code),
    ata_code: normalizeString(record.ata_code),
    reference_amp: normalizeString(record.reference_amp),
    description: normalizeString(record.description),
    category_code: normalizeString(record.category_code),
    estimated_man_hours: normalizeNumber(record.estimated_man_hours),
    revision_status: normalizeString(record.revision_status),
    interval_hours: normalizeNumber(record.interval_hours),
    interval_cycles: normalizeNumber(record.interval_cycles),
    interval_months: normalizeNumber(record.interval_months),
    is_mandatory: normalizeBoolean(record.is_mandatory, true),
    assembly_model_id: normalizeString(record.assembly_model_id),
    task_template_detail_json: normalizeJsonArray(record.task_template_detail_json),
    task_template_scope_json: normalizeJsonArray(record.task_template_scope_json),
    created_at: normalizeString(record.created_at),
    updated_at: normalizeString(record.updated_at),
  };
}

export function mapMpdInputToApiPayload(input: MpdUpsertInput): Record<string, unknown> {
  return {
    mpd_code: normalizeString(input.mpd_code),
    ata_code: normalizeString(input.ata_code),
    reference_amp: normalizeString(input.reference_amp),
    description: normalizeString(input.description),
    category_code: normalizeString(input.category_code),
    estimated_man_hours: normalizeNumber(input.estimated_man_hours),
    revision_status: normalizeString(input.revision_status),
    interval_hours: normalizeNumber(input.interval_hours),
    interval_cycles: normalizeNumber(input.interval_cycles),
    interval_months: normalizeNumber(input.interval_months),
    is_mandatory: normalizeBoolean(input.is_mandatory, true),
    assembly_model_id: normalizeString(input.assembly_model_id),
    task_template_detail_json: normalizeJsonArray(input.task_template_detail_json),
    task_template_scope_json: normalizeJsonArray(input.task_template_scope_json),
  };
}

function useAuthHeaders(): HeadersInit | null {
  const { session } = useAuth();
  return useMemo(() => {
    const token = session?.access_token;
    if (!token) return null;
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [session?.access_token]);
}

async function parseApiResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Invalid API response (${response.status})`);
  }
}

async function fetchMpdList(
  headers: HeadersInit,
  params: { page: number; pageSize: number; search?: string },
): Promise<MpdListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
  });
  const response = await fetch(`/api/v2/amro/mpd?${query.toString()}`, {
    method: 'GET',
    headers,
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to list MPD records (${response.status})`));
  }
  const output = payload.output && typeof payload.output === 'object' ? payload.output as Record<string, unknown> : {};
  const records = Array.isArray(output.records) ? output.records : [];
  return {
    records: records.map((record) => mapApiRecordToMpdRecord(record as Record<string, unknown>)),
    total: Number(output.total || records.length),
    page: Number(output.page || params.page),
    page_size: Number(output.page_size || params.pageSize),
  };
}

async function mutateCreateMpd(input: MpdUpsertInput, headers: HeadersInit): Promise<MpdRecord> {
  const response = await fetch('/api/v2/amro/mpd', {
    method: 'POST',
    headers,
    body: JSON.stringify(mapMpdInputToApiPayload(input)),
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to create MPD (${response.status})`));
  }
  const output = payload.output && typeof payload.output === 'object' ? payload.output as Record<string, unknown> : {};
  return mapApiRecordToMpdRecord((output.record || {}) as Record<string, unknown>);
}

async function mutateUpdateMpd(id: string, input: MpdUpsertInput, headers: HeadersInit): Promise<MpdRecord> {
  const response = await fetch(`/api/v2/amro/mpd/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(mapMpdInputToApiPayload(input)),
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to update MPD (${response.status})`));
  }
  const output = payload.output && typeof payload.output === 'object' ? payload.output as Record<string, unknown> : {};
  return mapApiRecordToMpdRecord((output.record || {}) as Record<string, unknown>);
}

async function mutateDeleteMpd(id: string, headers: HeadersInit): Promise<void> {
  const response = await fetch(`/api/v2/amro/mpd/${id}`, {
    method: 'DELETE',
    headers,
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to delete MPD (${response.status})`));
  }
}

async function exportMpdCsv(headers: HeadersInit): Promise<Blob> {
  const response = await fetch('/api/v2/amro/mpd?export=csv', {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    const payload = await parseApiResponse(response);
    throw new Error(String(payload.error || `Failed to export MPD (${response.status})`));
  }
  const text = await response.text();
  return new Blob([text], { type: 'text/csv;charset=utf-8;' });
}

export function useListMpd(params: { page?: number; pageSize?: number; search?: string; enabled?: boolean } = {}) {
  const authHeaders = useAuthHeaders();
  const { page = 1, pageSize = 200, search, enabled = true } = params;
  return useQuery({
    queryKey: [...MPD_KEY, 'list', page, pageSize, search || 'all'] as const,
    queryFn: () => authHeaders ? fetchMpdList(authHeaders, { page, pageSize, search }) : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 30_000,
    retry: 2,
  });
}

export function useCreateMpd() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MpdUpsertInput) => authHeaders ? mutateCreateMpd(input, authHeaders) : Promise.reject(new Error('Not authenticated')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MPD_KEY });
    },
  });
}

export function useUpdateMpd() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MpdUpsertInput }) =>
      authHeaders ? mutateUpdateMpd(id, input, authHeaders) : Promise.reject(new Error('Not authenticated')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MPD_KEY });
    },
  });
}

export function useDeleteMpd() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authHeaders ? mutateDeleteMpd(id, authHeaders) : Promise.reject(new Error('Not authenticated')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MPD_KEY });
    },
  });
}

export function useMpdActions() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: MPD_KEY });
  }, [queryClient]);

  const exportCsv = useCallback(async () => {
    if (!authHeaders) throw new Error('Not authenticated');
    return exportMpdCsv(authHeaders);
  }, [authHeaders]);

  return { invalidate, exportCsv };
}
