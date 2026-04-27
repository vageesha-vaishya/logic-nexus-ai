import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

export type WorkOrderStatus = 'planning' | 'approved' | 'scheduled' | 'in_progress' | 'on_hold' | 'blocked' | 'completed' | 'closed' | 'cancelled';
export type WorkOrderPriority = 1 | 2 | 3 | 4 | 5;
export type MaintenanceType = 'line' | 'base' | 'component' | 'inspection' | 'overhaul' | 'repair' | 'upgrade' | 'modification';

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

export interface WorkOrderListItem {
  id: string;
  work_order_number: string;
  work_order_number?: string;
  title: string;
  aircraft_id: string | null;
  aircraft_registration: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  maintenance_type: MaintenanceType;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  assigned_to: string | null;
  source: string | null;
  created_at: string;
}

export interface WorkOrderDetail extends WorkOrderListItem {
  description: string | null;
  estimated_labor_hours: number | null;
  actual_labor_hours: number | null;
  supervisor_id: string | null;
  reference_documents: string[];
  notes: string | null;
  external_reference: string | null;
  tasks: WorkOrderTask[];
  materials: WorkOrderMaterial[];
  maintenance_events: MaintenanceEvent[];
}

export interface WorkOrderTask {
  id: string;
  task_number: string;
  title: string;
  description: string | null;
  task_category: string | null;
  estimated_duration_hours: number | null;
  complexity_level: string | null;
  sequence_order: number | null;
  status: string;
  progress_percentage: number | null;
  assigned_to: string | null;
  qa_verified_by: string | null;
  qa_verified_at: string | null;
  notes: string | null;
}

export interface WorkOrderMaterial {
  id: string;
  part_number: string;
  description: string | null;
  manufacturer: string | null;
  action: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: string;
  supplier_name: string | null;
  is_critical: boolean;
}

export interface MaintenanceEvent {
  id: string;
  event_type: string;
  event_code: string | null;
  title: string;
  description: string | null;
  performed_by: string | null;
  approved_by: string | null;
  event_timestamp: string;
}

export interface WorkOrderListResponse {
  records: WorkOrderListItem[];
  total: number;
  page: number;
  page_size: number;
}

const WORK_PACKAGES_KEY = ['amro', 'work-orders'] as const;

function normalizeWorkOrderListResponse(json: any): WorkOrderListResponse {
  const rawItems = json.items || json.data?.workOrders || json.output?.records || json.output?.items || json.data || [];
  const recordsArray = Array.isArray(rawItems) ? rawItems : [];
  return {
    records: recordsArray.map((item: any) => ({
      id: item.id || item.work_order_id || '',
      work_order_number: item.work_order_number || item.work_order_number || item.package_number || item.code || item.id || '',
      work_order_number: item.work_order_number || item.work_order_number || item.code || '',
      title: item.title || 'Work Package',
      aircraft_id: item.aircraft_id || null,
      aircraft_registration: item.aircraft_registration || null,
      status: (item.status || 'planning') as WorkOrderStatus,
      priority: (item.priority || 3) as WorkOrderPriority,
      maintenance_type: (item.maintenance_type || 'line') as MaintenanceType,
      planned_start_date: item.planned_start_date || item.planned_start || null,
      planned_end_date: item.planned_end_date || item.planned_end || item.due_at || null,
      actual_start_date: item.actual_start_date || null,
      actual_end_date: item.actual_end_date || null,
      estimated_cost: item.estimated_cost || null,
      actual_cost: item.actual_cost || null,
      assigned_to: item.assigned_to || null,
      source: item.source || null,
      created_at: item.created_at || '',
    })),
    total: json.pagination?.total_items || json.count || json.output?.total || recordsArray.length,
    page: json.pagination?.page || json.output?.page || 1,
    page_size: json.pagination?.page_size || json.output?.page_size || recordsArray.length,
  };
}

// ── List work packages ──────────────────────────────────────────────────────

interface UseListWorkOrdersParams {
  page?: number;
  pageSize?: number;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  maintenanceType?: MaintenanceType;
  aircraftId?: string;
  assignedTo?: string;
  search?: string;
  enabled?: boolean;
}

async function fetchWorkOrders(
  params: {
    page: number;
    pageSize: number;
    status?: string;
    priority?: string;
    maintenance_type?: string;
    aircraft_id?: string;
    assigned_to?: string;
    search?: string;
  },
  headers: HeadersInit,
): Promise<WorkOrderListResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(params.maintenance_type ? { maintenance_type: params.maintenance_type } : {}),
    ...(params.aircraft_id ? { aircraft_id: params.aircraft_id } : {}),
    ...(params.assigned_to ? { assigned_to: params.assigned_to } : {}),
    ...(params.search ? { search: params.search } : {}),
  });

  const queryString = qs.toString();
  const fetchList = async (endpoint: '/api/v2/amro/work-orders' | '/api/v2/amro/work-orders') => {
    const response = await fetch(`${endpoint}?${queryString}`, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Failed to list work packages: ${response.status}`);
    const json = await response.json();
    return normalizeWorkOrderListResponse(json);
  };

  let primaryError: Error | null = null;
  try {
    const primary = await fetchList('/api/v2/amro/work-orders');
    if (primary.records.length > 0) return primary;
  } catch (error) {
    primaryError = error as Error;
  }

  try {
    return await fetchList('/api/v2/amro/work-orders');
  } catch (fallbackError) {
    throw primaryError || fallbackError;
  }
}

export function useListWorkOrders(params: UseListWorkOrdersParams = {}) {
  const authHeaders = useAuthHeaders();
  const {
    page = 1,
    pageSize = 20,
    status,
    priority,
    maintenanceType,
    aircraftId,
    assignedTo,
    search,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      ...WORK_PACKAGES_KEY,
      'list',
      page,
      pageSize,
      status || 'all',
      priority || 'all',
      maintenanceType || 'all',
      aircraftId || 'all',
      assignedTo || 'all',
      search || 'all',
    ] as const,
    queryFn: () =>
      authHeaders
        ? fetchWorkOrders(
            {
              page,
              pageSize,
              status,
              priority: priority ? String(priority) : undefined,
              maintenance_type: maintenanceType,
              aircraft_id: aircraftId,
              assigned_to: assignedTo,
              search,
            },
            authHeaders,
          )
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 15_000,
    retry: 2,
  });
}

// ── Get single work package ─────────────────────────────────────────────────

async function fetchWorkOrder(id: string, headers: HeadersInit): Promise<WorkOrderDetail> {
  const mapDetail = (json: any): WorkOrderDetail => {
    const dataBlock = json.data || json.output || {};
    const item = dataBlock.work_order || dataBlock.record || dataBlock;
    return {
      id: item.id || id,
      work_order_number: item.work_order_number || item.work_order_number || item.code || '',
      work_order_number: item.work_order_number || item.work_order_number || item.code || '',
      title: item.title || item.work_order_number || 'Work Package',
      aircraft_id: item.aircraft_id || null,
      aircraft_registration: item.aircraft_registration || item.aircraft || null,
      status: (item.status || 'planning') as WorkOrderStatus,
      priority: Number(item.priority || 3) as WorkOrderPriority,
      maintenance_type: (item.maintenance_type || 'line') as MaintenanceType,
      description: item.description || null,
      planned_start_date: item.planned_start_date || item.planned_start || null,
      planned_end_date: item.planned_end_date || item.planned_end || null,
      actual_start_date: item.actual_start_date || null,
      actual_end_date: item.actual_end_date || null,
      estimated_cost: item.estimated_cost || null,
      actual_cost: item.actual_cost || null,
      estimated_labor_hours: item.estimated_labor_hours || null,
      actual_labor_hours: item.actual_labor_hours || null,
      assigned_to: item.assigned_to || null,
      supervisor_id: item.supervisor_id || null,
      source: item.source || null,
      notes: item.notes || null,
      reference_documents: item.reference_documents || [],
      external_reference: item.external_reference || null,
      tasks: item.tasks || item.task_list || [],
      materials: item.materials || item.material_list || [],
      maintenance_events: item.maintenance_events || [],
      created_at: item.created_at || '',
    };
  };

  const fetchDetail = async (endpoint: '/api/v2/amro/work-orders' | '/api/v2/amro/work-orders') => {
    const response = await fetch(`${endpoint}/${id}`, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Failed to get work package: ${response.status}`);
    const json = await response.json();
    return mapDetail(json);
  };

  try {
    return await fetchDetail('/api/v2/amro/work-orders');
  } catch {
    return fetchDetail('/api/v2/amro/work-orders');
  }
}

export function useWorkOrder(id: string | null) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: [...WORK_PACKAGES_KEY, 'detail', id || 'none'] as const,
    queryFn: () => (authHeaders ? fetchWorkOrder(id!, authHeaders) : Promise.reject(new Error('Not authenticated'))),
    enabled: !!id && !!authHeaders,
    staleTime: 10_000,
    retry: 2,
  });
}

// ── Create work package ─────────────────────────────────────────────────────

interface CreateWorkOrderInput {
  aircraft_id: string;
  title?: string;
  work_order_title_id?: string;
  description?: string;
  work_type?: string;
  maintenance_type: MaintenanceType;
  priority: WorkOrderPriority;
  source?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  estimated_labor_hours?: number;
  estimated_cost?: number;
  assigned_to?: string;
  supervisor_id?: string;
  notes?: string;
  reference_documents?: string[];
  work_order_template_id?: string;
}

async function mutateCreateWorkOrder(input: CreateWorkOrderInput, headers: HeadersInit): Promise<{
  id: string;
  work_order_number: string;
  work_order_number?: string;
  status: WorkOrderStatus;
}> {
  const response = await fetch('/api/v2/amro/work-orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create work package failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateWorkOrder() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkOrderInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateCreateWorkOrder(input, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
    },
  });
}

// ── Update work package ─────────────────────────────────────────────────────

interface UpdateWorkOrderInput {
  id: string;
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  maintenance_type?: MaintenanceType;
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_to?: string;
  supervisor_id?: string;
  notes?: string;
  status?: WorkOrderStatus;
}

async function mutateUpdateWorkOrder(input: UpdateWorkOrderInput, headers: HeadersInit): Promise<{
  id: string;
  status: WorkOrderStatus;
  work_order_number: string;
  work_order_number?: string;
}> {
  const response = await fetch(`/api/v2/amro/work-orders/${input.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update work package failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useUpdateWorkOrder() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkOrderInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateUpdateWorkOrder(input, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
    },
  });
}

// ── Transition work package state ───────────────────────────────────────────

interface TransitionWorkOrderInput {
  id: string;
  target_status: WorkOrderStatus;
  compliance_notes?: string;
}

async function mutateTransitionWorkOrder(input: TransitionWorkOrderInput, headers: HeadersInit): Promise<{
  id: string;
  previous_status: string;
  new_status: WorkOrderStatus;
  transitioned_at: string;
}> {
  const response = await fetch(`/api/v2/amro/work-orders/${input.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: input.target_status }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transition failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useTransitionWorkOrder() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionWorkOrderInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateTransitionWorkOrder(input, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
    },
  });
}

// ── Delete work package ─────────────────────────────────────────────────────

async function mutateDeleteWorkOrder(id: string, headers: HeadersInit): Promise<void> {
  const response = await fetch(`/api/v2/amro/work-orders/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete work package failed: ${response.status} — ${text}`);
  }
}

export function useDeleteWorkOrder() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateDeleteWorkOrder(id, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useWorkOrderActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
  }, [queryClient]);
  return { invalidate };
}
