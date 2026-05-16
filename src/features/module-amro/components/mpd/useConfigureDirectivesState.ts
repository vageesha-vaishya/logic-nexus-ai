import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  mapApiRecordToDirectiveRecord,
  useAssemblyModelOptions,
  useAssemblyTypeOptions,
  useAtaCodeOptions,
  useDirectiveTypeOptions,
  type DirectiveRecord,
} from './useDirectivesState';

type ConfigureListResponse<TRecord> = {
  records: TRecord[];
  total: number;
  page: number;
  page_size: number;
};

export type ConfigureAircraftOption = {
  id: string;
  registration: string;
  label: string;
  assembly_model_id: string | null;
  status: string | null;
};

export type ConfigureDirectivesConfiguredRecord = DirectiveRecord & {
  task_id: string;
  directive_id: string | null;
  work_order_id: string | null;
  task_number: string | null;
  task_title: string | null;
  task_description: string | null;
  task_category: string | null;
  task_status: string | null;
  task_sequence_order: number | null;
  task_assigned_to: string | null;
  task_planned_start_date: string | null;
  task_planned_end_date: string | null;
  task_actual_start_date: string | null;
  task_actual_end_date: string | null;
  task_created_at: string | null;
  task_updated_at: string | null;
};

const CONFIGURE_DIRECTIVES_KEY = ['amro', 'configure-directives'] as const;

function normalizeString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function mapConfiguredRecord(record: Record<string, unknown>): ConfigureDirectivesConfiguredRecord {
  const base = mapApiRecordToDirectiveRecord(record);
  return {
    ...base,
    task_id: String(record.task_id || record.id || ''),
    directive_id: normalizeString(record.directive_id),
    work_order_id: normalizeString(record.work_order_id),
    task_number: normalizeString(record.task_number),
    task_title: normalizeString(record.task_title),
    task_description: normalizeString(record.task_description),
    task_category: normalizeString(record.task_category),
    task_status: normalizeString(record.task_status),
    task_sequence_order: normalizeNumber(record.task_sequence_order),
    task_assigned_to: normalizeString(record.task_assigned_to),
    task_planned_start_date: normalizeString(record.task_planned_start_date),
    task_planned_end_date: normalizeString(record.task_planned_end_date),
    task_actual_start_date: normalizeString(record.task_actual_start_date),
    task_actual_end_date: normalizeString(record.task_actual_end_date),
    task_created_at: normalizeString(record.task_created_at),
    task_updated_at: normalizeString(record.task_updated_at),
  };
}

async function fetchNonConfigured(
  headers: HeadersInit,
  params: {
    page: number;
    pageSize: number;
    modelId?: string;
    aircraftId?: string;
    search?: string;
    ataCode?: string;
    directivesTypeId?: string;
  },
): Promise<ConfigureListResponse<DirectiveRecord>> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.modelId ? { model_id: params.modelId } : {}),
    ...(params.aircraftId ? { aircraft_id: params.aircraftId } : {}),
    ...(params.search ? { search: params.search } : {}),
    ...(params.ataCode ? { ata_code: params.ataCode } : {}),
    ...(params.directivesTypeId ? { directives_type_id: params.directivesTypeId } : {}),
  });
  const response = await fetch(`/api/v2/amro/configure-directives/non-configured?${query.toString()}`, {
    method: 'GET',
    headers,
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to list non-configured directives (${response.status})`));
  }
  const output = payload.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
  const records = Array.isArray(output.records) ? output.records : [];
  return {
    records: records.map((record) => mapApiRecordToDirectiveRecord(record as Record<string, unknown>)),
    total: Number(output.total || records.length),
    page: Number(output.page || params.page),
    page_size: Number(output.page_size || params.pageSize),
  };
}

async function fetchConfigured(
  headers: HeadersInit,
  params: {
    page: number;
    pageSize: number;
    aircraftId?: string;
    search?: string;
  },
): Promise<ConfigureListResponse<ConfigureDirectivesConfiguredRecord>> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.aircraftId ? { aircraft_id: params.aircraftId } : {}),
    ...(params.search ? { search: params.search } : {}),
  });
  const response = await fetch(`/api/v2/amro/configure-directives/configured?${query.toString()}`, {
    method: 'GET',
    headers,
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to list configured directives (${response.status})`));
  }
  const output = payload.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
  const records = Array.isArray(output.records) ? output.records : [];
  return {
    records: records.map((record) => mapConfiguredRecord(record as Record<string, unknown>)),
    total: Number(output.total || records.length),
    page: Number(output.page || params.page),
    page_size: Number(output.page_size || params.pageSize),
  };
}

async function fetchAircraftOptions(
  headers: HeadersInit,
  modelId?: string,
): Promise<ConfigureAircraftOption[]> {
  const query = new URLSearchParams({
    ...(modelId ? { model_id: modelId } : {}),
  });
  const response = await fetch(`/api/v2/amro/configure-directives/aircraft-options?${query.toString()}`, {
    method: 'GET',
    headers,
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(String(payload.error || `Failed to load aircraft options (${response.status})`));
  }
  const output = payload.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
  const records = Array.isArray(output.records) ? output.records : [];
  return records
    .map((record) => {
      const row = record as Record<string, unknown>;
      return {
        id: String(row.id || '').trim(),
        registration: String(row.registration || '').trim(),
        label: String(row.label || row.registration || row.id || '').trim(),
        assembly_model_id: normalizeString(row.assembly_model_id),
        status: normalizeString(row.status),
      };
    })
    .filter((row) => row.id.length > 0);
}

export function useListConfigureDirectivesNonConfigured(
  params: {
    page?: number;
    pageSize?: number;
    modelId?: string;
    aircraftId?: string;
    search?: string;
    ataCode?: string;
    directivesTypeId?: string;
    enabled?: boolean;
  } = {},
) {
  const authHeaders = useAuthHeaders();
  const {
    page = 1,
    pageSize = 500,
    modelId,
    aircraftId,
    search,
    ataCode,
    directivesTypeId,
    enabled = true,
  } = params;
  return useQuery({
    queryKey: [
      ...CONFIGURE_DIRECTIVES_KEY,
      'non-configured',
      page,
      pageSize,
      modelId || 'no-model',
      aircraftId || 'no-aircraft',
      search || 'all',
      ataCode || 'all-ata',
      directivesTypeId || 'all-directive-type',
    ] as const,
    queryFn: () =>
      authHeaders
        ? fetchNonConfigured(authHeaders, {
            page,
            pageSize,
            modelId,
            aircraftId,
            search,
            ataCode,
            directivesTypeId,
          })
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 30_000,
    retry: 2,
  });
}

export function useListConfigureDirectivesConfigured(
  params: {
    page?: number;
    pageSize?: number;
    aircraftId?: string;
    search?: string;
    enabled?: boolean;
  } = {},
) {
  const authHeaders = useAuthHeaders();
  const { page = 1, pageSize = 500, aircraftId, search, enabled = true } = params;
  return useQuery({
    queryKey: [...CONFIGURE_DIRECTIVES_KEY, 'configured', page, pageSize, aircraftId || 'no-aircraft', search || 'all'] as const,
    queryFn: () =>
      authHeaders
        ? fetchConfigured(authHeaders, { page, pageSize, aircraftId, search })
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 30_000,
    retry: 2,
  });
}

export function useConfigureDirectivesAircraftOptions(modelId?: string, enabled = true) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: [...CONFIGURE_DIRECTIVES_KEY, 'aircraft-options', modelId || 'all-models'] as const,
    queryFn: () => (authHeaders ? fetchAircraftOptions(authHeaders, modelId) : Promise.reject(new Error('Not authenticated'))),
    enabled: enabled && !!authHeaders,
    staleTime: 60_000,
    retry: 2,
  });
}

export function useConfigureDirectivesOptions(enabled = true) {
  const assemblyTypeOptionsQuery = useAssemblyTypeOptions(enabled);
  const assemblyModelOptionsQuery = useAssemblyModelOptions(enabled);
  const ataCodeOptionsQuery = useAtaCodeOptions(enabled);
  const directiveTypeOptionsQuery = useDirectiveTypeOptions(enabled);
  return {
    assemblyTypeOptionsQuery,
    assemblyModelOptionsQuery,
    ataCodeOptionsQuery,
    directiveTypeOptionsQuery,
  };
}

export function useConfigureDirectivesActions() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: CONFIGURE_DIRECTIVES_KEY });
  }, [queryClient]);

  const configure = useMutation({
    mutationFn: async (input: {
      aircraftId: string;
      directiveIds: string[];
      done_on?: string;
      work_order_no?: string;
      license_no?: string;
      place?: string;
      actual_man_hours?: number;
      method_of_compliance?: string;
      remark?: string;
      revision_no?: string;
      page_no?: string;
      book_no?: string;
      source_doc?: string;
      extension_date?: string;
      approval_remark?: string;
    }) => {
      if (!authHeaders) throw new Error('Not authenticated');
      const { aircraftId, directiveIds, ...extraFields } = input;
      const response = await fetch('/api/v2/amro/configure-directives/configure', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          aircraft_id: aircraftId,
          directive_ids: directiveIds,
          ...extraFields,
        }),
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(String(payload.error || `Failed to configure directives (${response.status})`));
      }
      return payload;
    },
    onSuccess: () => invalidate(),
  });

  const updateConfiguredTask = useMutation({
    mutationFn: async (input: { taskId: string; patch: Record<string, unknown> }) => {
      if (!authHeaders) throw new Error('Not authenticated');
      const response = await fetch(`/api/v2/amro/configure-directives/configured/${input.taskId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(input.patch),
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(String(payload.error || `Failed to update configured directive task (${response.status})`));
      }
      return payload;
    },
    onSuccess: () => invalidate(),
  });

  const updateNonConfiguredDirective = useMutation({
    mutationFn: async (input: { directiveId: string; patch: Record<string, unknown> }) => {
      if (!authHeaders) throw new Error('Not authenticated');
      const response = await fetch(`/api/v2/amro/configure-directives/non-configured/${input.directiveId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(input.patch),
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(String(payload.error || `Failed to update non-configured directive (${response.status})`));
      }
      return payload;
    },
    onSuccess: () => invalidate(),
  });

  const deleteNonConfiguredDirective = useMutation({
    mutationFn: async (directiveId: string) => {
      if (!authHeaders) throw new Error('Not authenticated');
      const response = await fetch(`/api/v2/amro/configure-directives/non-configured/${directiveId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(String(payload.error || `Failed to delete non-configured directive (${response.status})`));
      }
      return payload;
    },
    onSuccess: () => invalidate(),
  });

  const deleteConfiguredTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!authHeaders) throw new Error('Not authenticated');
      const response = await fetch(`/api/v2/amro/configure-directives/configured/${taskId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const payload = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(String(payload.error || `Failed to delete configured directive task (${response.status})`));
      }
      return payload;
    },
    onSuccess: () => invalidate(),
  });

  const exportNonConfiguredCsv = useCallback(async (params: {
    modelId?: string;
    aircraftId?: string;
    search?: string;
    ataCode?: string;
    directivesTypeId?: string;
  }) => {
    if (!authHeaders) throw new Error('Not authenticated');
    const query = new URLSearchParams({
      page: '1',
      page_size: '5000',
      export: 'csv',
      ...(params.modelId ? { model_id: params.modelId } : {}),
      ...(params.aircraftId ? { aircraft_id: params.aircraftId } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.ataCode ? { ata_code: params.ataCode } : {}),
      ...(params.directivesTypeId ? { directives_type_id: params.directivesTypeId } : {}),
    });
    const response = await fetch(`/api/v2/amro/configure-directives/non-configured?${query.toString()}`, {
      method: 'GET',
      headers: authHeaders,
    });
    if (!response.ok) {
      const payload = await parseApiResponse(response);
      throw new Error(String(payload.error || `Failed to export non-configured directives CSV (${response.status})`));
    }
    const text = await response.text();
    return new Blob([text], { type: 'text/csv;charset=utf-8;' });
  }, [authHeaders]);

  const exportConfiguredCsv = useCallback(async (params: { aircraftId?: string; search?: string }) => {
    if (!authHeaders) throw new Error('Not authenticated');
    const query = new URLSearchParams({
      page: '1',
      page_size: '5000',
      export: 'csv',
      ...(params.aircraftId ? { aircraft_id: params.aircraftId } : {}),
      ...(params.search ? { search: params.search } : {}),
    });
    const response = await fetch(`/api/v2/amro/configure-directives/configured?${query.toString()}`, {
      method: 'GET',
      headers: authHeaders,
    });
    if (!response.ok) {
      const payload = await parseApiResponse(response);
      throw new Error(String(payload.error || `Failed to export configured directives CSV (${response.status})`));
    }
    const text = await response.text();
    return new Blob([text], { type: 'text/csv;charset=utf-8;' });
  }, [authHeaders]);

  return {
    invalidate,
    configure,
    updateNonConfiguredDirective,
    deleteNonConfiguredDirective,
    updateConfiguredTask,
    deleteConfiguredTask,
    exportNonConfiguredCsv,
    exportConfiguredCsv,
  };
}
