/**
 * React Query Hooks for AMRO Emergency Work Packages
 * 
 * Follows the pattern established in useWorkPackageState.ts
 * Provides hooks for:
 * - Listing emergency work packages
 * - Creating emergency work packages
 * - Resolving emergency work packages
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

export type EmergencyType = 'aog' | 'unscheduled_removal' | 'flight_delay_risk' | 'safety_issue' | 'technical_fault';
export type UrgencyLevel = 'immediate' | 'urgent' | 'priority' | 'routine';

export interface EmergencyWorkPackage {
  id: string;
  tenant_id: string;
  work_package_id: string;
  emergency_type: EmergencyType;
  urgency_level: UrgencyLevel;
  reason: string;
  impact_assessment: string | null;
  initial_assessment: string | null;
  estimated_ground_time_hours: number | null;
  
  // Response tracking
  declared_by: string | null;
  declared_at: string;
  response_team: string[];
  resolution_summary: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  
  // Conversion tracking
  converted_from_task_id: string | null;
  auto_prioritized: boolean;
  priority_escalation_reason: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  work_packages?: {
    id: string;
    work_package_number: string;
    title: string;
    status: string;
    priority: number;
    aircraft_id: string | null;
  };
}

export interface EmergencyWPListResponse {
  records: EmergencyWorkPackage[];
  total: number;
  page: number;
  page_size: number;
  active_count: number;
}

const EMERGENCY_WP_KEY = ['amro', 'emergency-wp'] as const;

// ── List emergency work packages ────────────────────────────────────────────

interface UseListEmergencyWPParams {
  page?: number;
  pageSize?: number;
  emergencyType?: EmergencyType;
  urgencyLevel?: UrgencyLevel;
  status?: 'active' | 'resolved';
  enabled?: boolean;
}

async function fetchEmergencyWP(
  params: {
    page: number;
    page_size: number;
    emergency_type?: string;
    urgency_level?: string;
    status?: string;
  },
  headers: HeadersInit,
): Promise<EmergencyWPListResponse> {
  const qs = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.page_size),
    ...(params.emergency_type ? { emergency_type: params.emergency_type } : {}),
    ...(params.urgency_level ? { urgency_level: params.urgency_level } : {}),
    ...(params.status ? { status: params.status } : {}),
  });

  const url = `/api/v2/amro/emergency/work-packages?${qs.toString()}`;
  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) throw new Error(`Failed to list emergency work packages: ${response.status}`);
  const json = await response.json();
  
  const records = json.output?.records || json.data || [];
  return {
    records: Array.isArray(records) ? records : [],
    total: json.output?.total || records.length,
    page: json.output?.page || 1,
    page_size: json.output?.page_size || records.length,
    active_count: json.output?.active_count || 0,
  };
}

export function useListEmergencyWP(params: UseListEmergencyWPParams = {}) {
  const authHeaders = useAuthHeaders();
  const {
    page = 1,
    pageSize = 20,
    emergencyType,
    urgencyLevel,
    status,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      ...EMERGENCY_WP_KEY,
      'list',
      page,
      pageSize,
      emergencyType || 'all',
      urgencyLevel || 'all',
      status || 'all',
    ] as const,
    queryFn: () =>
      authHeaders
        ? fetchEmergencyWP(
            {
              page,
              page_size: pageSize,
              emergency_type: emergencyType,
              urgency_level: urgencyLevel,
              status,
            },
            authHeaders,
          )
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 15_000,
    retry: 2,
  });
}

// ── Create emergency work package ───────────────────────────────────────────

interface CreateEmergencyWPInput {
  aircraft_id: string;
  emergency_type: EmergencyType;
  urgency_level: UrgencyLevel;
  reason: string;
  impact_assessment?: string;
  initial_assessment?: string;
  estimated_ground_time_hours?: number;
  response_team?: string[];
  converted_from_task_id?: string;
}

async function mutateCreateEmergencyWP(input: CreateEmergencyWPInput, headers: HeadersInit): Promise<{
  work_package_id: string;
  work_package_number: string;
  emergency_wp_id: string;
  declared_at: string;
  auto_prioritized: boolean;
  priority: number;
  message: string;
}> {
  const response = await fetch('/api/v2/amro/emergency/work-packages', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create emergency WP failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateEmergencyWP() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmergencyWPInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateCreateEmergencyWP(input, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...EMERGENCY_WP_KEY, 'list'] });
    },
  });
}

// ── Resolve emergency work package ──────────────────────────────────────────

interface ResolveEmergencyWPInput {
  id: string;
  resolution_summary: string;
}

async function mutateResolveEmergencyWP(input: ResolveEmergencyWPInput, headers: HeadersInit): Promise<EmergencyWorkPackage> {
  const response = await fetch(`/api/v2/amro/emergency/work-packages/${input.id}/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resolution_summary: input.resolution_summary }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resolve emergency WP failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useResolveEmergencyWP() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveEmergencyWPInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateResolveEmergencyWP(input, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...EMERGENCY_WP_KEY, 'list'] });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useEmergencyWPActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: EMERGENCY_WP_KEY });
  }, [queryClient]);
  return { invalidate };
}
