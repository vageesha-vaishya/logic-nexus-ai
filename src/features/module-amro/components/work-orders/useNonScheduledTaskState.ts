/**
 * React Query Hooks for AMRO Non-Scheduled Tasks
 * 
 * Follows the pattern established in useWorkPackageState.ts
 * Provides hooks for:
 * - Listing non-scheduled tasks
 * - Creating non-scheduled tasks
 * - Converting tasks to emergency work packages
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

function useAuthHeaders(): HeadersInit | null {
  const { session } = useAuth();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export type TaskSource = 'pilot_report' | 'mechanic_report' | 'inspection_finding' | 'reliability_program' | 'manufacturer_advisory' | 'incident_investigation' | 'quality_audit';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical' | 'aog';
export type TaskStatus = 'reported' | 'under_review' | 'approved' | 'converted_to_wp' | 'deferred' | 'cancelled';

export interface NonScheduledTask {
  id: string;
  tenant_id: string;
  aircraft_id: string;
  task_source: TaskSource;
  task_description: string;
  defect_description: string | null;
  fault_code: string | null;
  reported_by: string | null;
  reported_at: string;
  priority: TaskPriority;
  initial_assessment: string | null;
  estimated_duration_hours: number | null;
  required_qualifications: any[];
  required_materials: any[];
  status: TaskStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  converted_to_wp_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NonScheduledTaskListResponse {
  records: NonScheduledTask[];
  total: number;
  page: number;
  page_size: number;
}

const NON_SCHEDULED_TASKS_KEY = ['amro', 'non-scheduled-tasks'] as const;

// ── List non-scheduled tasks ────────────────────────────────────────────────

interface UseListNonScheduledTasksParams {
  page?: number;
  pageSize?: number;
  aircraftId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  taskSource?: TaskSource;
  enabled?: boolean;
}

async function fetchNonScheduledTasks(
  params: {
    page: number;
    page_size: number;
    aircraft_id?: string;
    status?: string;
    priority?: string;
    task_source?: string;
  },
  headers: HeadersInit,
): Promise<NonScheduledTaskListResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.page_size),
    ...(params.aircraft_id ? { aircraft_id: params.aircraft_id } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(params.task_source ? { task_source: params.task_source } : {}),
  });

  const url = `/api/v2/amro/non-scheduled-tasks?${qs.toString()}`;
  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) throw new Error(`Failed to list non-scheduled tasks: ${response.status}`);
  const json = await response.json();
  
  const records = json.output?.records || json.data || [];
  return {
    records: Array.isArray(records) ? records : [],
    total: json.output?.total || records.length,
    page: json.output?.page || 1,
    page_size: json.output?.page_size || records.length,
  };
}

export function useListNonScheduledTasks(params: UseListNonScheduledTasksParams = {}) {
  const authHeaders = useAuthHeaders();
  const {
    page = 1,
    pageSize = 20,
    aircraftId,
    status,
    priority,
    taskSource,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      ...NON_SCHEDULED_TASKS_KEY,
      'list',
      page,
      pageSize,
      aircraftId || 'all',
      status || 'all',
      priority || 'all',
      taskSource || 'all',
    ] as const,
    queryFn: () =>
      authHeaders
        ? fetchNonScheduledTasks(
            {
              page,
              page_size: pageSize,
              aircraft_id: aircraftId,
              status,
              priority,
              task_source: taskSource,
            },
            authHeaders,
          )
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 15_000,
    retry: 2,
  });
}

// ── Get single non-scheduled task ───────────────────────────────────────────

async function fetchNonScheduledTask(id: string, headers: HeadersInit): Promise<NonScheduledTask> {
  const url = `/api/v2/amro/non-scheduled-tasks/${id}`;
  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) throw new Error(`Failed to get non-scheduled task: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function useNonScheduledTask(id: string | null) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: [...NON_SCHEDULED_TASKS_KEY, 'detail', id || 'none'] as const,
    queryFn: () => (authHeaders ? fetchNonScheduledTask(id!, authHeaders) : Promise.reject(new Error('Not authenticated'))),
    enabled: !!id && !!authHeaders,
    staleTime: 30_000,
    retry: 2,
  });
}

// ── Create non-scheduled task ───────────────────────────────────────────────

interface CreateNonScheduledTaskInput {
  aircraft_id: string;
  task_source: TaskSource;
  task_description: string;
  defect_description?: string;
  fault_code?: string;
  priority?: TaskPriority;
  initial_assessment?: string;
  estimated_duration_hours?: number;
  required_qualifications?: any[];
  required_materials?: any[];
}

async function mutateCreateNonScheduledTask(input: CreateNonScheduledTaskInput, headers: HeadersInit): Promise<NonScheduledTask> {
  const response = await fetch('/api/v2/amro/non-scheduled-tasks', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create non-scheduled task failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateNonScheduledTask() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNonScheduledTaskInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateCreateNonScheduledTask(input, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...NON_SCHEDULED_TASKS_KEY, 'list'] });
    },
  });
}

// ── Convert to emergency work package ───────────────────────────────────────

interface ConvertToWPInput {
  id: string;
  urgency_level?: 'immediate' | 'urgent' | 'priority' | 'routine';
  assign_to_technician?: string;
  scheduled_start?: string;
  priority_override?: string;
}

async function mutateConvertToWP(input: ConvertToWPInput, headers: HeadersInit): Promise<{
  work_package_id: string;
  work_package_number: string;
  emergency_wp_id: string | null;
  converted_from_task_id: string;
  conversion_timestamp: string;
  auto_prioritized: boolean;
  priority: number;
  urgency_level: string;
  message: string;
}> {
  const response = await fetch(`/api/v2/amro/non-scheduled-tasks/${input.id}/convert-to-wp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Convert to WP failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useConvertNonScheduledTaskToWP() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConvertToWPInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateConvertToWP(input, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...NON_SCHEDULED_TASKS_KEY, 'list'] });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useNonScheduledTaskActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: NON_SCHEDULED_TASKS_KEY });
  }, [queryClient]);
  return { invalidate };
}
