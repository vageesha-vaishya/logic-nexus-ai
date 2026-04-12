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
  const response = await fetch('/api/v2/amro/work-package-templates/model-options', {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to load templates: ${response.status}`);
  }
  
  const json = await response.json();
  const rows = json.data || json.output?.records || json.output?.items || json.items || [];
  
  return (Array.isArray(rows) ? rows : [])
    .filter((row: any) => row && row.id)
    .map((row: any) => ({
      id: String(row.id),
      name: String(row.name || row.template_name || row.title || 'Untitled Template'),
      description: row.description || null,
      version: Number(row.version || row.version_number || 1),
      status: String(row.status || 'active'),
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
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change often
    retry: 2,
  });

  const options = useMemo(() => {
    if (!data) return [];
    return data
      .filter((t) => t.status === 'active' || t.status === 'approved')
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
