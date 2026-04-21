import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { ENTITY_LABEL } from './constants';
import type { ReferenceEntity } from './types';
import { getPayloadRecords } from './utils';

type ApiHeaderBuildOptions = {
  fallbackAccessToken?: string | null;
  requestTag?: string;
  requestUrl?: string;
  requestMethod?: string;
};

type AircraftTemplatePayloadInput = {
  template_name?: unknown;
  franchise_id?: unknown;
  assembly_models?: unknown;
  maintenance_program?: unknown;
  revision_number?: unknown;
  amendment_number?: unknown;
};

export type AircraftTemplateRecord = {
  id: string;
  tenant_id: string;
  franchise_id: string;
  template_name: string;
  assembly_models: string;
  aircraft_type?: string;
  manufacturer?: string;
  manufacturer_id?: string;
  aircraft_model?: string;
  maintenance_program: string;
  revision_number: string;
  amendment_number: string;
  updated_at?: string;
};

export function filterManufacturersByTenant<T extends { tenantId?: string }>(records: T[], tenantId: string): T[] {
  const scopedTenantId = String(tenantId || '').trim();
  if (!scopedTenantId) {
    return records;
  }
  return records.filter((record) => {
    const recordTenantId = String(record.tenantId || '').trim();
    return !recordTenantId || recordTenantId === scopedTenantId;
  });
}

export function filterAssemblyModelsByScope<
  T extends {
    tenantId?: string;
    franchiseId?: string;
    manufacturerId?: string;
    active?: boolean;
  },
>(
  records: T[],
  scope: { tenantId: string; franchiseId: string; manufacturerId: string },
): T[] {
  const scopedTenantId = String(scope.tenantId || '').trim();
  const scopedFranchiseId = String(scope.franchiseId || '').trim();
  const scopedManufacturerId = String(scope.manufacturerId || '').trim();
  if (!scopedTenantId || !scopedFranchiseId || !scopedManufacturerId) {
    return [];
  }
  return records.filter((record) => {
    const recordTenantId = String(record.tenantId || '').trim();
    const recordFranchiseId = String(record.franchiseId || '').trim();
    const recordManufacturerId = String(record.manufacturerId || '').trim();
    const isActive = record.active !== false;
    if (!isActive) {
      return false;
    }
    if (recordTenantId && recordTenantId !== scopedTenantId) {
      return false;
    }
    if (recordManufacturerId && recordManufacturerId !== scopedManufacturerId) {
      return false;
    }
    if (!recordFranchiseId) {
      return true;
    }
    return recordFranchiseId === scopedFranchiseId;
  });
}

export async function buildApiHeaders(
  scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null },
  options: ApiHeaderBuildOptions = {},
) {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token || '';
  let source = token ? 'session' : 'none';
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed?.session?.access_token || '';
    source = token ? 'refresh' : 'none';
  }
  const fallbackToken = String(options.fallbackAccessToken || '').trim();
  if (!token && fallbackToken) {
    token = fallbackToken;
    source = 'fallback';
  }
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (scope.tenantId) headers.set('x-tenant-id', scope.tenantId);
  if (scope.franchiseId) headers.set('x-franchise-id', scope.franchiseId);
  if (scope.userId) headers.set('x-user-id', scope.userId);
  headers.set('x-domain-id', 'AMRO');
  if (!token) {
    logger.warn('AMRO API request headers missing Authorization token', {
      component: 'amro-settings-master-data/services',
      requestTag: options.requestTag || 'unknown',
      requestUrl: options.requestUrl || '',
      requestMethod: options.requestMethod || 'GET',
      tenantId: String(scope.tenantId || ''),
      franchiseId: String(scope.franchiseId || ''),
      userId: String(scope.userId || ''),
      authorizationHeader: String(headers.get('Authorization') || ''),
      tokenSource: source,
      hasSessionToken: Boolean(sessionData?.session?.access_token),
      hasFallbackToken: Boolean(fallbackToken),
    });
  }
  return headers;
}

export async function parseApiPayload(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    if (response.ok) {
      return {};
    }
    throw new Error(`Invalid response format (${response.status})`);
  }
}

export async function verifyReferenceExists(headers: Headers, entity: ReferenceEntity, searchTerm: string, fieldKeys: string[]): Promise<boolean> {
  const query = new URLSearchParams({
    search: searchTerm,
    page: '1',
    page_size: '20',
  });
  const response = await fetch(`/api/v2/amro/master-data/${entity}?${query.toString()}`, {
    method: 'GET',
    headers,
  });
  const payload = await parseApiPayload(response);
  if (!response.ok) {
    const label = (ENTITY_LABEL as Record<string, string>)[entity] ?? 'reference';
    throw new Error(String(payload.error || `Failed to validate ${label} reference`));
  }
  const records = getPayloadRecords(payload);
  const normalized = searchTerm.trim().toLowerCase();
  return records.some((record) => fieldKeys.some((fieldKey) => String(record[fieldKey] || '').trim().toLowerCase() === normalized));
}

const normalizeAircraftTemplateRecord = (record: Record<string, unknown>): AircraftTemplateRecord | null => {
  const id = String(record.id || '').trim();
  if (!id) {
    return null;
  }
  return {
    id,
    tenant_id: String(record.tenant_id || '').trim(),
    franchise_id: String(record.franchise_id || '').trim(),
    template_name: String(record.template_name || '').trim(),
    assembly_models: String(record.assembly_models || '').trim(),
    aircraft_type: String(record.aircraft_type || '').trim(),
    manufacturer: String(record.manufacturer || '').trim(),
    manufacturer_id: String(record.manufacturer_id || '').trim(),
    aircraft_model: String(record.aircraft_model || '').trim(),
    maintenance_program: String(record.maintenance_program || '').trim(),
    revision_number: String(record.revision_number || '').trim(),
    amendment_number: String(record.amendment_number || '').trim(),
    updated_at: String(record.updated_at || '').trim(),
  };
};

const sanitizeAircraftTemplatePayload = (input: AircraftTemplatePayloadInput): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  const templateName = String(input.template_name || '').trim();
  const franchiseId = String(input.franchise_id || '').trim();
  const assemblyModels = String(input.assembly_models || '').trim();
  const maintenanceProgram = String(input.maintenance_program || '').trim();
  const revisionNumber = String(input.revision_number || '').trim();
  const amendmentNumber = String(input.amendment_number || '').trim();
  if (templateName) payload.template_name = templateName;
  if (franchiseId) payload.franchise_id = franchiseId;
  if (assemblyModels) payload.assembly_models = assemblyModels;
  if (maintenanceProgram) payload.maintenance_program = maintenanceProgram;
  if (revisionNumber) payload.revision_number = revisionNumber;
  if (amendmentNumber) payload.amendment_number = amendmentNumber;
  return payload;
};

const resolveFirstPayloadRecord = (payload: Record<string, unknown>): Record<string, unknown> | null => {
  const output = payload.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : null;
  const outputRecord = output?.record && typeof output.record === 'object' ? (output.record as Record<string, unknown>) : null;
  if (outputRecord) {
    return outputRecord;
  }
  const records = getPayloadRecords(payload);
  if (records.length > 0) {
    return records[0];
  }
  return null;
};

async function performAircraftTemplateRequest(
  scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null },
  options: {
    fallbackAccessToken?: string | null;
    path: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
    requestTag: string;
  },
) {
  const executeRequest = async (attempt: 1 | 2) => {
    const headers = await buildApiHeaders(scope, {
      fallbackAccessToken: options.fallbackAccessToken,
      requestTag: options.requestTag,
      requestUrl: options.path,
      requestMethod: options.method,
    });
    const response = await fetch(options.path, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if ((response.status === 401 || response.status === 403) && attempt === 1) {
      logger.warn('AMRO aircraft template API request unauthorized, retrying with refreshed session', {
        component: 'amro-settings-master-data/services',
        requestTag: options.requestTag,
        requestUrl: options.path,
        requestMethod: options.method,
        tenantId: String(scope.tenantId || ''),
        franchiseId: String(scope.franchiseId || ''),
        userId: String(scope.userId || ''),
        status: response.status,
      });
      return executeRequest(2);
    }
    return response;
  };
  return executeRequest(1);
}

export async function listAircraftTemplates(
  scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null },
  fallbackAccessToken?: string | null,
): Promise<AircraftTemplateRecord[]> {
  const query = new URLSearchParams({
    page: '1',
    page_size: '200',
    sort_by: 'template_name',
    sort_dir: 'asc',
  });
  const path = `/api/v2/amro/master-data/aircraft_template?${query.toString()}`;
  const response = await performAircraftTemplateRequest(scope, {
    fallbackAccessToken,
    path,
    method: 'GET',
    requestTag: 'list-aircraft-templates',
  });
  const payload = await parseApiPayload(response);
  if (!response.ok) {
    throw new Error(String(payload.error || 'Failed to load aircraft templates'));
  }
  return getPayloadRecords(payload)
    .map(normalizeAircraftTemplateRecord)
    .filter((record): record is AircraftTemplateRecord => Boolean(record));
}

export async function createAircraftTemplate(
  scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null },
  fallbackAccessToken: string | null | undefined,
  input: AircraftTemplatePayloadInput,
): Promise<AircraftTemplateRecord> {
  const payload = sanitizeAircraftTemplatePayload(input);
  const response = await performAircraftTemplateRequest(scope, {
    fallbackAccessToken,
    path: '/api/v2/amro/master-data/aircraft_template',
    method: 'POST',
    body: payload,
    requestTag: 'create-aircraft-template',
  });
  const responsePayload = await parseApiPayload(response);
  if (!response.ok) {
    throw new Error(String(responsePayload.error || 'Failed to create aircraft template'));
  }
  const record = resolveFirstPayloadRecord(responsePayload);
  const normalizedRecord = record ? normalizeAircraftTemplateRecord(record) : null;
  if (!normalizedRecord) {
    throw new Error('Aircraft template create response is missing record data');
  }
  logger.info('Aircraft template created', {
    component: 'amro-settings-master-data/services',
    templateId: normalizedRecord.id,
    tenantId: String(scope.tenantId || ''),
    franchiseId: String(scope.franchiseId || ''),
    userId: String(scope.userId || ''),
  });
  return normalizedRecord;
}

export async function updateAircraftTemplate(
  scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null },
  fallbackAccessToken: string | null | undefined,
  templateId: string,
  input: AircraftTemplatePayloadInput,
): Promise<AircraftTemplateRecord> {
  const payload = sanitizeAircraftTemplatePayload(input);
  const normalizedTemplateId = String(templateId || '').trim();
  if (!normalizedTemplateId) {
    throw new Error('Template id is required');
  }
  const response = await performAircraftTemplateRequest(scope, {
    fallbackAccessToken,
    path: `/api/v2/amro/master-data/aircraft_template/${normalizedTemplateId}`,
    method: 'PATCH',
    body: payload,
    requestTag: 'update-aircraft-template',
  });
  const responsePayload = await parseApiPayload(response);
  if (!response.ok) {
    throw new Error(String(responsePayload.error || 'Failed to update aircraft template'));
  }
  const record = resolveFirstPayloadRecord(responsePayload);
  const normalizedRecord = record ? normalizeAircraftTemplateRecord(record) : null;
  if (!normalizedRecord) {
    throw new Error('Aircraft template update response is missing record data');
  }
  logger.info('Aircraft template updated', {
    component: 'amro-settings-master-data/services',
    templateId: normalizedRecord.id,
    tenantId: String(scope.tenantId || ''),
    franchiseId: String(scope.franchiseId || ''),
    userId: String(scope.userId || ''),
  });
  return normalizedRecord;
}

export async function deleteAircraftTemplate(
  scope: { tenantId?: string | null; franchiseId?: string | null; userId?: string | null },
  fallbackAccessToken: string | null | undefined,
  templateId: string,
): Promise<void> {
  const normalizedTemplateId = String(templateId || '').trim();
  if (!normalizedTemplateId) {
    throw new Error('Template id is required');
  }
  const response = await performAircraftTemplateRequest(scope, {
    fallbackAccessToken,
    path: `/api/v2/amro/master-data/aircraft_template/${normalizedTemplateId}`,
    method: 'DELETE',
    requestTag: 'delete-aircraft-template',
  });
  const responsePayload = await parseApiPayload(response);
  if (!response.ok) {
    throw new Error(String(responsePayload.error || 'Failed to delete aircraft template'));
  }
  logger.info('Aircraft template deleted', {
    component: 'amro-settings-master-data/services',
    templateId: normalizedTemplateId,
    tenantId: String(scope.tenantId || ''),
    franchiseId: String(scope.franchiseId || ''),
    userId: String(scope.userId || ''),
  });
}
