/**
 * React Query Hooks for AMRO Work Package Template Versions
 * 
 * Follows the pattern established in useWorkOrderState.ts
 * Provides hooks for:
 * - Listing template versions
 * - Creating new versions
 * - Updating versions
 * - Submitting for review
 * - Approving/rejecting versions
 * - Deleting versions
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

export type TemplateVersionStatus = 'draft' | 'pending_review' | 'approved' | 'active' | 'deprecated' | 'archived';

export interface TemplateVersion {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  template_id: string;
  version_number: number;
  version_label: string | null;
  change_description: string;
  change_reason: string | null;
  status: TemplateVersionStatus;
  
  // Approval workflow
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  
  // Template content
  scope_json: Record<string, unknown>;
  tasks_json: any[];
  materials_json: any[];
  tooling_json: any[];
  compliance_requirements_json: any[];
  
  // Effectivity
  effective_from: string | null;
  effective_until: string | null;
  aircraft_models: string[] | null;
  engine_models: string[] | null;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface TemplateVersionListResponse {
  records: TemplateVersion[];
  total: number;
  page: number;
  page_size: number;
}

const TEMPLATE_VERSIONS_KEY = ['amro', 'template-versions'] as const;

// ── List template versions ──────────────────────────────────────────────────

interface UseListTemplateVersionsParams {
  templateId: string;
  page?: number;
  pageSize?: number;
  status?: TemplateVersionStatus;
  enabled?: boolean;
}

async function fetchTemplateVersions(
  params: {
    template_id: string;
    page: number;
    page_size: number;
    status?: string;
  },
  headers: HeadersInit,
): Promise<TemplateVersionListResponse> {
  const qs = new URLSearchParams({
    template_id: params.template_id,
    page: String(params.page),
    page_size: String(params.page_size),
    ...(params.status ? { status: params.status } : {}),
  });

  const url = `/api/v2/amro/work-order-template-versions?${qs.toString()}`;
  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) throw new Error(`Failed to list template versions: ${response.status}`);
  const json = await response.json();
  
  const records = json.output?.records || json.data || [];
  return {
    records: Array.isArray(records) ? records : [],
    total: json.output?.total || records.length,
    page: json.output?.page || 1,
    page_size: json.output?.page_size || records.length,
  };
}

export function useListTemplateVersions(params: UseListTemplateVersionsParams) {
  const authHeaders = useAuthHeaders();
  const { templateId, page = 1, pageSize = 20, status, enabled = true } = params;

  return useQuery({
    queryKey: [
      ...TEMPLATE_VERSIONS_KEY,
      'list',
      templateId,
      page,
      pageSize,
      status || 'all',
    ] as const,
    queryFn: () =>
      authHeaders
        ? fetchTemplateVersions(
            { template_id: templateId, page, page_size: pageSize, status },
            authHeaders,
          )
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders && !!templateId,
    staleTime: 30_000,
    retry: 2,
  });
}

// ── Get single template version ─────────────────────────────────────────────

async function fetchTemplateVersion(id: string, headers: HeadersInit): Promise<TemplateVersion> {
  const url = `/api/v2/amro/work-order-template-versions/${id}`;
  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) throw new Error(`Failed to get template version: ${response.status}`);
  const json = await response.json();
  return json.output;
}

export function useTemplateVersion(id: string | null) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: [...TEMPLATE_VERSIONS_KEY, 'detail', id || 'none'] as const,
    queryFn: () => (authHeaders ? fetchTemplateVersion(id!, authHeaders) : Promise.reject(new Error('Not authenticated'))),
    enabled: !!id && !!authHeaders,
    staleTime: 30_000,
    retry: 2,
  });
}

// ── Create template version ─────────────────────────────────────────────────

interface CreateTemplateVersionInput {
  template_id: string;
  change_description: string;
  change_reason?: string;
  version_label?: string;
  scope_json?: Record<string, unknown>;
  tasks_json?: any[];
  materials_json?: any[];
  tooling_json?: any[];
  compliance_requirements_json?: any[];
  effective_from?: string;
  effective_until?: string;
  aircraft_models?: string[];
  engine_models?: string[];
}

async function mutateCreateTemplateVersion(input: CreateTemplateVersionInput, headers: HeadersInit): Promise<TemplateVersion> {
  const response = await fetch('/api/v2/amro/work-order-template-versions', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create template version failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useCreateTemplateVersion() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateVersionInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateCreateTemplateVersion(input, authHeaders);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...TEMPLATE_VERSIONS_KEY, 'list'] });
    },
  });
}

// ── Update template version ─────────────────────────────────────────────────

interface UpdateTemplateVersionInput {
  id: string;
  version_label?: string;
  change_description?: string;
  change_reason?: string;
  scope_json?: Record<string, unknown>;
  tasks_json?: any[];
  materials_json?: any[];
  tooling_json?: any[];
  compliance_requirements_json?: any[];
  effective_from?: string;
  effective_until?: string;
  aircraft_models?: string[];
  engine_models?: string[];
}

async function mutateUpdateTemplateVersion(input: UpdateTemplateVersionInput, headers: HeadersInit): Promise<TemplateVersion> {
  const { id, ...updateData } = input;
  const response = await fetch(`/api/v2/amro/work-order-template-versions/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updateData),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Update template version failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useUpdateTemplateVersion() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTemplateVersionInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateUpdateTemplateVersion(input, authHeaders);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...TEMPLATE_VERSIONS_KEY, 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: [...TEMPLATE_VERSIONS_KEY, 'list'] });
    },
  });
}

// ── Delete template version ─────────────────────────────────────────────────

async function mutateDeleteTemplateVersion(id: string, headers: HeadersInit): Promise<void> {
  const response = await fetch(`/api/v2/amro/work-order-template-versions/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete template version failed: ${response.status} — ${text}`);
  }
}

export function useDeleteTemplateVersion() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateDeleteTemplateVersion(id, authHeaders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...TEMPLATE_VERSIONS_KEY, 'list'] });
    },
  });
}

// ── Submit for review ───────────────────────────────────────────────────────

async function mutateSubmitForReview(id: string, headers: HeadersInit): Promise<TemplateVersion> {
  const response = await fetch(`/api/v2/amro/work-order-template-versions/${id}/submit`, {
    method: 'POST',
    headers,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Submit for review failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useSubmitTemplateVersion() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateSubmitForReview(id, authHeaders);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...TEMPLATE_VERSIONS_KEY, 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: [...TEMPLATE_VERSIONS_KEY, 'list'] });
    },
  });
}

// ── Approve/Reject ──────────────────────────────────────────────────────────

interface ReviewTemplateVersionInput {
  id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
  set_active?: boolean;
}

async function mutateReviewTemplateVersion(input: ReviewTemplateVersionInput, headers: HeadersInit): Promise<TemplateVersion> {
  const { id, ...reviewData } = input;
  const response = await fetch(`/api/v2/amro/work-order-template-versions/${id}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify(reviewData),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Review template version failed: ${response.status} — ${text}`);
  }
  const json = await response.json();
  return json.output;
}

export function useReviewTemplateVersion() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewTemplateVersionInput) => {
      if (!authHeaders) return Promise.reject(new Error('Not authenticated'));
      return mutateReviewTemplateVersion(input, authHeaders);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...TEMPLATE_VERSIONS_KEY, 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: [...TEMPLATE_VERSIONS_KEY, 'list'] });
    },
  });
}

// ── Invalidation helper ─────────────────────────────────────────────────────

export function useTemplateVersionActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: TEMPLATE_VERSIONS_KEY });
  }, [queryClient]);
  return { invalidate };
}
