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

export interface WorkPackageTemplateOption {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
}

const TEMPLATES_KEY = ['amro', 'work-package-templates'] as const;

async function fetchWorkPackageTemplates(
  headers: HeadersInit,
): Promise<WorkPackageTemplateOption[]> {
  // FIXED: Use the correct master-data endpoint for work package templates
  // Previously was calling /model-options which returns assembly_models instead
  const response = await fetch('/api/v2/amro/master-data/work_package_templates?page=1&page_size=200', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to load templates: ${response.status}`);
  }

  const json = await response.json();
  // Parse master-data API response format
  const rows = json.output?.records || json.output?.data || json.data || json.output?.templates || [];

  return (Array.isArray(rows) ? rows : [])
    .filter((row: any) => row && row.id)
    .map((row: any) => ({
      id: String(row.id),
      name: String(row.template_name || row.name || row.title || 'Untitled Template'),
      description: row.description || row.template_code || null,
      version: Number(row.version || row.version_number || 1),
      status: String(row.status || 'draft'),
    }));
}

export function useWorkPackageTemplateOptions(enabled = true) {
  const authHeaders = useAuthHeaders();

  const { data, isLoading, error } = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () =>
      authHeaders
        ? fetchWorkPackageTemplates(authHeaders)
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
