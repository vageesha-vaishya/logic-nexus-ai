/**
 * Template Service Layer
 * 
 * Centralized API integration for Work Package Templates with:
 * - Error handling and retry logic
 * - Request/response normalization
 * - Type-safe API calls
 * - Timeout handling
 */

import { WorkPackageTemplate } from '../AmroWorkPackageTemplatesPage';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FetchTemplatesParams {
  page: number;
  pageSize: number;
  search?: string;
  maintenanceType?: string;
  status?: string;
  aircraftModels?: string[];
  sort?: string; // e.g., "template_name:asc,version:desc"
  updatedAtGte?: string;
  updatedAtLte?: string;
  tasksCountGte?: number;
  tasksCountLte?: number;
}

export interface FetchTemplatesResponse {
  templates: WorkPackageTemplate[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TemplateServiceError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const API_BASE_URL = '/api/v2/amro';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// ── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Normalize template data from API response
 */
function normalizeTemplate(r: any): WorkPackageTemplate {
  return {
    id: String(r.id || ''),
    tenant_id: String(r.tenant_id || ''),
    franchise_id: r.franchise_id || null,
    template_code: String(r.template_code || r.code || ''),
    template_name: String(r.template_name || r.name || 'Untitled'),
    description: r.description || null,
    maintenance_type: String(r.maintenance_type || 'line'),
    model_id: r.model_id || null,
    aircraft_model: r.aircraft_model || null,
    version: Number(r.version || 1),
    active: Boolean(r.active ?? true),
    status: String(r.status || 'active'),
    scope_json: r.scope_json || {},
    tasks_json: r.tasks_json || [],
    materials_json: r.materials_json || [],
    tooling_json: r.tooling_json || [],
    compliance_requirements_json: r.compliance_requirements_json || [],
    policy_snapshot_id: r.policy_snapshot_id || null,
    tasks_count: Number(r.tasks_count || r.task_count || (r.tasks_json?.length || 0)),
    estimated_labor_hours: r.estimated_labor_hours ? Number(r.estimated_labor_hours) : null,
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
    created_by: r.created_by || null,
    updated_by: r.updated_by || null,
  };
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Handle API errors
 */
function handleApiError(error: unknown, context: string): TemplateServiceError {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return {
        message: 'Request timeout. Please try again.',
        code: 'TIMEOUT',
      };
    }
    
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
    };
  }

  return {
    message: `Failed to ${context}`,
    code: 'UNKNOWN_ERROR',
  };
}

// ── Service Functions ──────────────────────────────────────────────────────────

/**
 * Fetch templates with pagination, filtering, and sorting
 */
export async function fetchTemplates(
  accessToken: string,
  params: FetchTemplatesParams
): Promise<FetchTemplatesResponse> {
  const queryParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });

  if (params.search) queryParams.set('search', params.search);
  if (params.maintenanceType) queryParams.set('maintenance_type', params.maintenanceType);
  if (params.status) queryParams.set('status', params.status);
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.updatedAtGte) queryParams.set('updated_at_gte', params.updatedAtGte);
  if (params.updatedAtLte) queryParams.set('updated_at_lte', params.updatedAtLte);
  if (params.tasksCountGte !== undefined) queryParams.set('tasks_count_gte', String(params.tasksCountGte));
  if (params.tasksCountLte !== undefined) queryParams.set('tasks_count_lte', String(params.tasksCountLte));
  
  if (params.aircraftModels && params.aircraftModels.length > 0) {
    params.aircraftModels.forEach(model => queryParams.append('aircraft_model[]', model));
  }

  const url = `${API_BASE_URL}/master-data/work_package_templates?${queryParams.toString()}`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const records = json.data || json.output?.records || json.output?.data || [];

    return {
      templates: (Array.isArray(records) ? records : []).map(normalizeTemplate),
      total: json.output?.total || json.count || records.length,
      page: params.page,
      pageSize: params.pageSize,
    };
  } catch (error) {
    throw handleApiError(error, 'fetch templates');
  }
}

/**
 * Create a new template
 */
export async function createTemplate(
  accessToken: string,
  templateData: Partial<WorkPackageTemplate>
): Promise<WorkPackageTemplate> {
  const url = `${API_BASE_URL}/master-data/work_package_templates`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(templateData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const record = json.data || json.output?.record || json.output?.data;
    
    if (!record) {
      throw new Error('No data returned from create template');
    }

    return normalizeTemplate(record);
  } catch (error) {
    throw handleApiError(error, 'create template');
  }
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  accessToken: string,
  templateId: string,
  templateData: Partial<WorkPackageTemplate>,
  expectedUpdatedAt?: string
): Promise<WorkPackageTemplate> {
  const url = `${API_BASE_URL}/master-data/work_package_templates/${templateId}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  // Add concurrency control header if provided
  if (expectedUpdatedAt) {
    headers['If-Match'] = expectedUpdatedAt;
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(templateData),
    });

    if (!response.ok) {
      if (response.status === 412) {
        throw new Error('CONFLICT: Template was modified by another user');
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const record = json.data || json.output?.record || json.output?.data;
    
    if (!record) {
      throw new Error('No data returned from update template');
    }

    return normalizeTemplate(record);
  } catch (error) {
    throw handleApiError(error, 'update template');
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(accessToken: string, templateId: string): Promise<void> {
  const url = `${API_BASE_URL}/master-data/work_package_templates/${templateId}`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    throw handleApiError(error, 'delete template');
  }
}

/**
 * Clone a template
 */
export async function cloneTemplate(
  accessToken: string,
  templateId: string,
  newName: string,
  newCode: string
): Promise<WorkPackageTemplate> {
  const url = `${API_BASE_URL}/master-data/work_package_templates/${templateId}/clone`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        template_name: newName,
        template_code: newCode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const record = json.data || json.output?.record || json.output?.data;
    
    if (!record) {
      throw new Error('No data returned from clone template');
    }

    return normalizeTemplate(record);
  } catch (error) {
    throw handleApiError(error, 'clone template');
  }
}

/**
 * Bulk delete templates
 */
export async function bulkDeleteTemplates(
  accessToken: string,
  templateIds: string[]
): Promise<{ success: number; failed: number; errors: Array<{ id: string; error: string }> }> {
  const url = `${API_BASE_URL}/master-data/work_package_templates/bulk-delete`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ template_ids: templateIds }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return {
      success: json.success || 0,
      failed: json.failed || 0,
      errors: json.errors || [],
    };
  } catch (error) {
    throw handleApiError(error, 'bulk delete templates');
  }
}

/**
 * Bulk update template status
 */
export async function bulkUpdateTemplateStatus(
  accessToken: string,
  templateIds: string[],
  status: string,
  reason?: string
): Promise<{ success: number; failed: number; errors: Array<{ id: string; error: string }> }> {
  const url = `${API_BASE_URL}/master-data/work_package_templates/bulk-status`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        template_ids: templateIds,
        status,
        reason,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return {
      success: json.success || 0,
      failed: json.failed || 0,
      errors: json.errors || [],
    };
  } catch (error) {
    throw handleApiError(error, 'bulk update template status');
  }
}

/**
 * Fetch aircraft model options
 */
export async function fetchAircraftModels(
  accessToken: string,
  tenantId?: string
): Promise<Array<{ id: string; name: string; code: string }>> {
  const query = new URLSearchParams();
  if (tenantId) query.set('tenant_id', tenantId);

  const url = `${API_BASE_URL}/work-package-templates/model-options?${query.toString()}`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    const records = json.data || json.output?.records || [];
    
    return (Array.isArray(records) ? records : []).map((r: any) => ({
      id: String(r.id || ''),
      name: String(r.name || ''),
      code: String(r.code || r.model_code || ''),
    }));
  } catch (error) {
    console.error('Failed to fetch aircraft models:', error);
    return [];
  }
}
