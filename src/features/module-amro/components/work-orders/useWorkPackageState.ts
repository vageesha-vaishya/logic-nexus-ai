import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type WorkPackageStatus = 'planning' | 'approved' | 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'closed' | 'cancelled';
export type WorkPackagePriority = 1 | 2 | 3 | 4 | 5;
export type MaintenanceType = 'line' | 'base' | 'component' | 'inspection' | 'overhaul' | 'repair' | 'upgrade' | 'modification';

export interface WorkPackageListItem {
  id: string;
  work_order_number: string;
  title: string;
  aircraft_id: string | null;
  aircraft_registration: string | null;
  status: WorkPackageStatus;
  priority: WorkPackagePriority;
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

export interface WorkPackageDetail extends WorkPackageListItem {
  description: string | null;
  estimated_labor_hours: number | null;
  actual_labor_hours: number | null;
  supervisor_id: string | null;
  reference_documents: string[];
  notes: string | null;
  external_reference: string | null;
  tasks: WorkPackageTask[];
  materials: WorkPackageMaterial[];
  maintenance_events: MaintenanceEvent[];
}

export interface WorkPackageTask {
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

export interface WorkPackageMaterial {
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

export interface WorkPackageListResponse {
  records: WorkPackageListItem[];
  total: number;
  page: number;
  page_size: number;
}

const WORK_PACKAGES_KEY = ['amro', 'work-packages'] as const;

// ── List work packages ──────────────────────────────────────────────────────

interface UseListWorkPackagesParams {
  page?: number;
  pageSize?: number;
  status?: WorkPackageStatus;
  priority?: WorkPackagePriority;
  maintenanceType?: MaintenanceType;
  aircraftId?: string;
  assignedTo?: string;
  search?: string;
  enabled?: boolean;
}

async function fetchWorkPackages(params: {
  page: number;
  pageSize: number;
  status?: string;
  priority?: string;
  maintenance_type?: string;
  aircraft_id?: string;
  assigned_to?: string;
  search?: string;
}): Promise<WorkPackageListResponse> {
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

  const url = `/api/v2/amro/work-orders?${qs.toString()}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to list work packages: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function useListWorkPackages(params: UseListWorkPackagesParams = {}) {
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
      fetchWorkPackages({
        page,
        pageSize,
        status,
        priority: priority ? String(priority) : undefined,
        maintenance_type: maintenanceType,
        aircraft_id: aircraftId,
        assigned_to: assignedTo,
        search,
      }),
    enabled,
    staleTime: 15_000,
    retry: 2,
  });
}

// ── Get single work package ─────────────────────────────────────────────────

async function fetchWorkPackage(id: string): Promise<WorkPackageDetail> {
  const url = `/api/v2/amro/work-orders/${id}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`Failed to get work package: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function useWorkPackage(id: string | null) {
  return useQuery({
    queryKey: [...WORK_PACKAGES_KEY, 'detail', id || 'none'] as const,
    queryFn: () => fetchWorkPackage(id!),
    enabled: !!id,
    staleTime: 10_000,
    retry: 2,
  });
}

// ── Create work package ─────────────────────────────────────────────────────

interface CreateWorkPackageInput {
  aircraft_id: string;
  title: string;
  description?: string;
  work_type?: string;
  maintenance_type: MaintenanceType;
  priority: WorkPackagePriority;
  source?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  estimated_labor_hours?: number;
  estimated_cost?: number;
  assigned_to?: string;
  supervisor_id?: string;
  notes?: string;
  reference_documents?: string[];
  template_id?: string;
}

async function mutateCreateWorkPackage(input: CreateWorkPackageInput): Promise<{
  id: string;
  work_order_number: string;
  status: WorkPackageStatus;
}> {
  const response = await fetch('/api/v2/amro/work-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create work package failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateWorkPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateCreateWorkPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
    },
  });
}

// ── Update work package ─────────────────────────────────────────────────────

interface UpdateWorkPackageInput {
  id: string;
  title?: string;
  description?: string;
  priority?: WorkPackagePriority;
  maintenance_type?: MaintenanceType;
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_to?: string;
  supervisor_id?: string;
  notes?: string;
  status?: WorkPackageStatus;
}

async function mutateUpdateWorkPackage(input: UpdateWorkPackageInput): Promise<{
  id: string;
  status: WorkPackageStatus;
  work_order_number: string;
}> {
  const response = await fetch(`/api/v2/amro/work-orders/${input.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update work package failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useUpdateWorkPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateUpdateWorkPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
    },
  });
}

// ── Transition work package state ───────────────────────────────────────────

interface TransitionWorkPackageInput {
  id: string;
  target_status: WorkPackageStatus;
  compliance_notes?: string;
}

async function mutateTransitionWorkPackage(input: TransitionWorkPackageInput): Promise<{
  id: string;
  previous_status: string;
  new_status: WorkPackageStatus;
  transitioned_at: string;
}> {
  const response = await fetch(`/api/v2/amro/work-orders/${input.id}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_status: input.target_status,
      compliance_notes: input.compliance_notes,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transition failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useTransitionWorkPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateTransitionWorkPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
    },
  });
}

// ── Delete work package ─────────────────────────────────────────────────────

async function mutateDeleteWorkPackage(id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/work-orders/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete work package failed: ${response.status} — ${text}`);
  }
}

export function useDeleteWorkPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateDeleteWorkPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useWorkPackageActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: WORK_PACKAGES_KEY });
  }, [queryClient]);
  return { invalidate };
}
