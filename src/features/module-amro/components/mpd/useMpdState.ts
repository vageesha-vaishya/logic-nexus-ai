import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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
  threshold_cycles: number | null;
  is_mandatory: boolean;
  assembly_model_id: string | null;
  loc_json: unknown[];
  other_details_json: unknown[];
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
  threshold_cycles?: number | null;
  is_mandatory?: boolean;
  assembly_model_id?: string | null;
  loc_json?: unknown[];
  other_details_json?: unknown[];
  task_template_detail_json?: unknown[];
  task_template_scope_json?: unknown[];
};

type MpdListResponse = {
  records: MpdRecord[];
  total: number;
  page: number;
  page_size: number;
};

export type AssemblyTypeOption = {
  id: string;
  name: string;
};

export type AssemblyModelOption = {
  id: string;
  name: string;
  assembly_type_id: string | null;
};

export type AtaCodeOption = {
  id: string;
  code: string;
  description: string | null;
  label: string;
};

export type TaskCategoryOption = {
  id: string;
  code: string;
  name: string;
  label: string;
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
    threshold_cycles: normalizeNumber(record.threshold_cycles),
    is_mandatory: normalizeBoolean(record.is_mandatory, true),
    assembly_model_id: normalizeString(record.assembly_model_id),
    loc_json: normalizeJsonArray(record.loc_json),
    other_details_json: normalizeJsonArray(record.other_details_json),
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
    threshold_cycles: normalizeNumber(input.threshold_cycles),
    is_mandatory: normalizeBoolean(input.is_mandatory, true),
    assembly_model_id: normalizeString(input.assembly_model_id),
    loc_json: normalizeJsonArray(input.loc_json),
    other_details_json: normalizeJsonArray(input.other_details_json),
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
  params: { page: number; pageSize: number; search?: string; modelId?: string },
): Promise<MpdListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.modelId ? { model_id: params.modelId } : {}),
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

async function fetchMasterDataRecords(
  entity: 'assembly-types' | 'assembly-models' | 'ata-codes' | 'task-categories',
  headers: HeadersInit,
  extraParams?: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams({
    page: '1',
    page_size: '500',
    sort_by: 'name',
    sort_dir: 'asc',
    ...(extraParams || {}),
  });
  const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, {
    method: 'GET',
    headers,
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to load ${entity} (${response.status})`));
  }
  const output = payload.output && typeof payload.output === 'object' ? payload.output as Record<string, unknown> : {};
  const records = Array.isArray(output.records) ? output.records : [];
  return records.filter((record): record is Record<string, unknown> => Boolean(record && typeof record === 'object'));
}

async function fetchTaskCategories(headers: HeadersInit): Promise<TaskCategoryOption[]> {
  const records = await fetchMasterDataRecords('task-categories', headers, {
    task_category_type: 'Inspection',
    is_active: 'true',
  });
  return records
    .map((record) => {
      const id = String(record.id || '').trim();
      const code = String(record.code || '').trim();
      const name = String(record.name || '').trim();
      return {
        id,
        code,
        name,
        label: code && name ? `${code} - ${name}` : code || name,
      };
    })
    .filter((record) => record.id && record.code && record.name);
}

async function fetchAssemblyTypes(headers: HeadersInit): Promise<AssemblyTypeOption[]> {
  const records = await fetchMasterDataRecords('assembly-types', headers);
  return records
    .map((record) => ({
      id: String(record.id || '').trim(),
      name: String(record.name || '').trim(),
      is_active: normalizeBoolean(record.is_active, true),
    }))
    .filter((record) => record.id && record.name && record.is_active)
    .map(({ id, name }) => ({ id, name }));
}

async function fetchAssemblyModels(headers: HeadersInit): Promise<AssemblyModelOption[]> {
  const records = await fetchMasterDataRecords('assembly-models', headers);
  return records
    .map((record) => ({
      id: String(record.id || '').trim(),
      name: String(record.name || '').trim(),
      assembly_type_id: normalizeString(record.assembly_type_id),
      is_active: normalizeBoolean(record.is_active, true),
    }))
    .filter((record) => record.id && record.name && record.is_active)
    .map(({ id, name, assembly_type_id }) => ({ id, name, assembly_type_id }));
}

async function fetchAtaCodes(headers: HeadersInit): Promise<AtaCodeOption[]> {
  const records = await fetchMasterDataRecords('ata-codes', headers);
  return records
    .map((record) => {
      const id = String(record.id || '').trim();
      const code = String(record.code || '').trim();
      const description = normalizeString(record.description);
      return {
        id,
        code,
        description,
        label: description ? `${code} - ${description}` : code,
        is_active: normalizeBoolean(record.is_active, true),
      };
    })
    .filter((record) => record.id && record.code && record.is_active)
    .map(({ id, code, description, label }) => ({ id, code, description, label }));
}

const ATTACHMENT_BUCKET_CANDIDATES = ['amro-mpd-attachments', 'documents', 'tenant-docs'] as const;

export type UploadedMpdAttachment = {
  bucket: string;
  path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  public_url: string | null;
  uploaded_at: string;
};

async function uploadMpdAttachment(file: File, tenantIdHint: string | null): Promise<UploadedMpdAttachment> {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const tenantToken = String(tenantIdHint || 'unscoped').trim() || 'unscoped';
  const basePath = `mpd/${tenantToken}/${Date.now()}-${sanitizedName}`;

  let lastError: Error | null = null;
  for (const bucket of ATTACHMENT_BUCKET_CANDIDATES) {
    const { error } = await supabase.storage.from(bucket).upload(basePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
    if (error) {
      lastError = new Error(error.message);
      continue;
    }
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(basePath);
    return {
      bucket,
      path: basePath,
      file_name: file.name,
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      public_url: publicUrlData?.publicUrl || null,
      uploaded_at: new Date().toISOString(),
    };
  }
  throw lastError || new Error('Failed to upload MPD attachment');
}

export function useListMpd(params: { page?: number; pageSize?: number; search?: string; modelId?: string; enabled?: boolean } = {}) {
  const authHeaders = useAuthHeaders();
  const { page = 1, pageSize = 200, search, modelId, enabled = true } = params;
  return useQuery({
    queryKey: [...MPD_KEY, 'list', page, pageSize, search || 'all', modelId || 'no-model'] as const,
    queryFn: () => authHeaders ? fetchMpdList(authHeaders, { page, pageSize, search, modelId }) : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 30_000,
    retry: 2,
  });
}

export function useAssemblyTypeOptions(enabled = true) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: [...MPD_KEY, 'assembly-types'] as const,
    queryFn: () => authHeaders ? fetchAssemblyTypes(authHeaders) : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 60_000,
    retry: 2,
  });
}

export function useAssemblyModelOptions(enabled = true) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: [...MPD_KEY, 'assembly-models'] as const,
    queryFn: () => authHeaders ? fetchAssemblyModels(authHeaders) : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 60_000,
    retry: 2,
  });
}

export function useAtaCodeOptions(enabled = true) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: [...MPD_KEY, 'ata-codes'] as const,
    queryFn: () => authHeaders ? fetchAtaCodes(authHeaders) : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 60_000,
    retry: 2,
  });
}

export function useTaskCategoryOptions(enabled = true) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: [...MPD_KEY, 'task-categories', 'inspection', 'active'] as const,
    queryFn: () => authHeaders ? fetchTaskCategories(authHeaders) : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 60_000,
    retry: 2,
  });
}

export function useUploadMpdAttachment() {
  const { session } = useAuth();
  const tenantIdHint = useMemo(() => {
    const payload = session?.user?.app_metadata || {};
    return String((payload as Record<string, unknown>).tenant_id || '').trim() || null;
  }, [session?.user?.app_metadata]);

  return useMutation({
    mutationFn: async (file: File) => uploadMpdAttachment(file, tenantIdHint),
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
