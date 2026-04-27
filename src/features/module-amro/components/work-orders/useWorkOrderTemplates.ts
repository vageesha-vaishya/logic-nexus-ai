/**
 * React Query Hooks for AMRO Work Package Templates
 * 
 * Provides hooks for:
 * - Listing available templates for work package creation
 * - Fetching template details
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

function useAuthHeaders(): HeadersInit | null {
  const { session } = useAuth();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export interface WorkOrderTemplateOption {
  id: string;
  tenant_id: string | null;
  assembly_models_id: string | null;
  aircraft_model: string | null;
  assembly_models: string | null;
  name: string;
  description: string | null;
  version: number;
  status: string;
}

const TEMPLATES_KEY = ['amro', 'work-order-templates'] as const;

async function fetchWorkOrderTemplates(
  headers: HeadersInit,
): Promise<WorkOrderTemplateOption[]> {
  // FIXED: Use the correct master-data endpoint for work package templates
  // Previously was calling /model-options which returns assembly_models instead
  const response = await fetch('/api/v2/amro/master-data/work_order_templates?page=1&page_size=200', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to load templates: ${response.status}`);
  }

  const json = await response.json();
  // Parse master-data API response format
  const rows = json.output?.records || json.output?.data || json.data || json.output?.templates || [];
  console.log('[API_MAP] raw template rows received', {
    count: Array.isArray(rows) ? rows.length : 0,
    sample: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
  });

  return (Array.isArray(rows) ? rows : [])
    .filter((row: any) => row && row.id)
    .map((row: any) => {
      const parsed = {
        id: String(row.id),
        tenant_id: row.tenant_id ? String(row.tenant_id) : null,
        assembly_models_id: row.assembly_models_id ? String(row.assembly_models_id) : (row.model_id ? String(row.model_id) : null),
        aircraft_model: row.aircraft_model ? String(row.aircraft_model) : null,
        assembly_models: row.assembly_models ? String(row.assembly_models) : (row.assemblymodels ? String(row.assemblymodels) : null),
        name: String(row.template_name || row.name || row.title || 'Untitled Template'),
        description: row.description || row.template_code || null,
        version: Number(row.version || row.version_number || 1),
        status: String(row.status || 'draft'),
      };
      console.log(`[API_MAP] Template ${parsed.id}: mapped models`, {
        assembly_models_id: parsed.assembly_models_id,
        assembly_models: parsed.assembly_models,
        raw_assembly_models: row.assembly_models,
        assemblymodels: row.assemblymodels,
        model_id: row.model_id,
        keys: Object.keys(row || {}),
      });
      if (!parsed.assembly_models_id && !parsed.assembly_models) {
        console.warn(`[API_MAP] Template ${parsed.id} missing both assembly_models_id and assembly_models after mapping`);
      }
      return parsed;
    });
}

export function useWorkOrderTemplateOptions(enabled = true) {
  const authHeaders = useAuthHeaders();

  const { data, isLoading, error } = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () =>
      authHeaders
        ? fetchWorkOrderTemplates(authHeaders)
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 2 * 60 * 1000, // 2 minutes - templates may change when created/edited
    retry: 2,
  });

  const options = useMemo(() => {
    if (!data) return [];
    // FIXED: Include draft templates so newly created templates are selectable
    // Previously filtered to only 'active' or 'approved', hiding draft templates
    return data
      .filter((t) => t.status === 'active' || t.status === 'approved' || t.status === 'draft')
      .map((t) => ({
        value: t.id,
        label: `${t.name} v${t.version}`,
        ...t,
      }));
  }, [data]);

  return {
    options,
    isLoading,
    error,
    templates: data || [],
  };
}

// ── Fetch single work package template detail ───────────────────────────────

export interface WorkOrderTemplateDetail {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  template_code: string;
  version: number;
  active: boolean;
  template_name: string;
  maintenance_type: string;
  assembly_models_id: string | null;
  aircraft_model: string | null;
  scope_json: any;
  tasks_json: any[];
  policy_snapshot_id: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchWorkOrderTemplateDetail(
  templateId: string,
  headers: HeadersInit,
): Promise<WorkOrderTemplateDetail | null> {
  // Use the master-data entity endpoint with ID
  const response = await fetch(`/api/v2/amro/master-data/work_order_templates/${templateId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to load template detail: ${response.status}`);
  }

  const json = await response.json();
  return json.output || json.data || null;
}

export function useWorkOrderTemplateDetail(
  templateId: string,
  enabled = true,
) {
  const authHeaders = useAuthHeaders();

  const { data, isLoading, error } = useQuery({
    queryKey: [...TEMPLATES_KEY, 'detail', templateId] as const,
    queryFn: () =>
      authHeaders && templateId
        ? fetchWorkOrderTemplateDetail(templateId, authHeaders)
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders && !!templateId,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  return {
    data,
    isLoading,
    error,
  };
}
