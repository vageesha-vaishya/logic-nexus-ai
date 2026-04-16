import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import {
  buildCsv,
  getEntityConfig,
  parseBulkOperation,
  parseExportRequested,
  parsePagination,
  parseSearch,
  parseSort,
  resolveEntity,
  sanitizeWritePayload,
  sendError,
  validatePayload,
  writeAuditRecord,
  HttpError,
} from './shared';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';
import { logger } from '@/lib/logger';

const ENTITY_UNAVAILABLE = new Map<string, number>();
const ENTITY_COLUMN_OVERRIDES = new Map<string, Set<string>>();
const ENTITY_SEARCH_COLUMN_OVERRIDES = new Map<string, Set<string>>();
const ENTITY_UNAVAILABLE_TTL_MS = 30_000;

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeManufacturerToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLookupToken(value: string): string {
  return value.trim().toLowerCase();
}

type ManufacturerRecord = {
  id: string;
  manufacturer_code: string | null;
  name: string | null;
  is_active: boolean | null;
};

type AssemblyReferenceRecord = {
  id: string;
  tenant_id: string | null;
  franchise_id: string | null;
  is_active: boolean | null;
};

type AssemblyModelReferenceRecord = {
  id: string;
  tenant_id: string | null;
  franchise_id: string | null;
  manufacturer_id: string | null;
  model_code: string | null;
  name: string | null;
  primary_model: string | null;
  is_active: boolean | null;
};

type AirportRecord = {
  id: string;
  name: string | null;
  icao_code: string | null;
};

function extractJoinedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value.find((entry) => Boolean(entry) && typeof entry === 'object');
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

async function loadAircraftByField(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  field: 'id' | 'registration' | 'tail_number',
  values: string[],
  tenantId: string | null,
): Promise<Record<string, unknown>[]> {
  if (values.length === 0) return [];
  let query = supabase
    .from('aircraft')
    .select('id,registration,tail_number,status')
    .in(field, values);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  } else if (typeof query.is === 'function') {
    query = query.is('tenant_id', null);
  } else {
    query = query.eq('tenant_id', null);
  }
  const { data } = await query;
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

async function loadAirportsByField(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  field: 'id' | 'icao_code' | 'name',
  values: string[],
  tenantId: string | null,
): Promise<AirportRecord[]> {
  if (values.length === 0) return [];
  let query = supabase
    .from('airports')
    .select('id,name,icao_code')
    .in(field, values);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  } else if (typeof query.is === 'function') {
    query = query.is('tenant_id', null);
  } else {
    query = query.eq('tenant_id', null);
  }
  const { data } = await query;
  return Array.isArray(data) ? (data as AirportRecord[]) : [];
}

async function loadManufacturers(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
): Promise<ManufacturerRecord[]> {
  const query = supabase
    .from('manufacturers')
    .select('id,manufacturer_code,name,is_active');
  const { data, error } = await query;
  if (error) {
    throw new HttpError(error.message, 400);
  }
  return Array.isArray(data) ? data : [];
}

async function loadAssemblyReferenceRecords(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  table: 'manufacturers' | 'assembly_types',
  tenantId: string,
  ids: string[],
): Promise<AssemblyReferenceRecord[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from(table)
    .select('id,tenant_id,franchise_id,is_active')
    .eq('tenant_id', tenantId)
    .in('id', ids);
  if (error) {
    throw new HttpError(error.message, 400);
  }
  return Array.isArray(data) ? (data as AssemblyReferenceRecord[]) : [];
}

async function loadAssemblyModelReferenceRecords(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  manufacturerIds: string[],
): Promise<AssemblyModelReferenceRecord[]> {
  if (manufacturerIds.length === 0) return [];
  const { data, error } = await supabase
    .from('assembly_models')
    .select('id,tenant_id,franchise_id,manufacturer_id,model_code,name,primary_model,is_active')
    .eq('tenant_id', tenantId)
    .in('manufacturer_id', manufacturerIds);
  if (error) {
    throw new HttpError(error.message, 400);
  }
  return Array.isArray(data) ? (data as AssemblyModelReferenceRecord[]) : [];
}

function validateReferenceFranchise(record: AssemblyReferenceRecord, franchiseId: string | null): boolean {
  if (!franchiseId) return true;
  if (!record.franchise_id) return true;
  return record.franchise_id === franchiseId;
}

function validateAssemblyModelFranchise(record: AssemblyModelReferenceRecord, franchiseId: string | null): boolean {
  if (!franchiseId) return true;
  if (!record.franchise_id) return true;
  return record.franchise_id === franchiseId;
}

function collectAssemblyModelTokens(record: AssemblyModelReferenceRecord): string[] {
  return [record.id, record.model_code, record.name, record.primary_model]
    .filter((value): value is string => Boolean(asNullableString(value)))
    .map((value) => normalizeLookupToken(value));
}

async function validateAssemblyModelReferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  franchiseId: string | null,
  records: Record<string, unknown>[],
): Promise<Map<number, { field: string; message: string }[]>> {
  const manufacturerIds = Array.from(
    new Set(
      records
        .map((record) => asNullableString(record.manufacturer_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const assemblyTypeIds = Array.from(
    new Set(
      records
        .map((record) => asNullableString(record.assembly_type_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const manufacturerRows = await loadAssemblyReferenceRecords(supabase, 'manufacturers', tenantId, manufacturerIds);
  const assemblyTypeRows = await loadAssemblyReferenceRecords(supabase, 'assembly_types', tenantId, assemblyTypeIds);
  const manufacturerById = new Map(manufacturerRows.map((row) => [row.id, row]));
  const assemblyTypeById = new Map(assemblyTypeRows.map((row) => [row.id, row]));
  const issues = new Map<number, { field: string; message: string }[]>();

  records.forEach((record, index) => {
    const rowIssues: { field: string; message: string }[] = [];
    const manufacturerId = asNullableString(record.manufacturer_id);
    const assemblyTypeId = asNullableString(record.assembly_type_id);

    if (!manufacturerId) {
      rowIssues.push({ field: 'manufacturer_id', message: 'manufacturer_id is required' });
    } else {
      const manufacturer = manufacturerById.get(manufacturerId);
      if (!manufacturer) {
        rowIssues.push({ field: 'manufacturer_id', message: 'manufacturer_id must belong to current tenant' });
      } else {
        if (manufacturer.is_active === false) {
          rowIssues.push({ field: 'manufacturer_id', message: 'manufacturer_id must reference an active manufacturer' });
        }
        if (!validateReferenceFranchise(manufacturer, franchiseId)) {
          rowIssues.push({ field: 'manufacturer_id', message: 'manufacturer_id must belong to current franchise scope' });
        }
      }
    }

    if (!assemblyTypeId) {
      rowIssues.push({ field: 'assembly_type_id', message: 'assembly_type_id is required' });
    } else {
      const assemblyType = assemblyTypeById.get(assemblyTypeId);
      if (!assemblyType) {
        rowIssues.push({ field: 'assembly_type_id', message: 'assembly_type_id must belong to current tenant' });
      } else {
        if (assemblyType.is_active === false) {
          rowIssues.push({ field: 'assembly_type_id', message: 'assembly_type_id must reference an active assembly type' });
        }
        if (!validateReferenceFranchise(assemblyType, franchiseId)) {
          rowIssues.push({ field: 'assembly_type_id', message: 'assembly_type_id must belong to current franchise scope' });
        }
      }
    }

    if (rowIssues.length > 0) {
      issues.set(index, rowIssues);
    }
  });

  return issues;
}

async function resolveAircraftManufacturerReferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  records: Record<string, unknown>[],
): Promise<{ resolved: Record<string, unknown>[]; issues: Map<number, { field: string; message: string }[]> }> {
  const manufacturers = await loadManufacturers(supabase);
  const byId = new Map<string, ManufacturerRecord>();
  const byToken = new Map<string, ManufacturerRecord>();
  manufacturers.forEach((record) => {
    if (record.id) {
      byId.set(record.id, record);
    }
    const code = record.manufacturer_code ? normalizeManufacturerToken(record.manufacturer_code) : null;
    const name = record.name ? normalizeManufacturerToken(record.name) : null;
    if (code) {
      byToken.set(code, record);
    }
    if (name) {
      byToken.set(name, record);
    }
  });
  const issues = new Map<number, { field: string; message: string }[]>();
  const resolved = records.map((record, index) => {
    const manufacturerId = asNullableString(record.manufacturer_id);
    const manufacturerToken = asNullableString(record.manufacturer || record.manufacturer_code);
    if (manufacturerId) {
      const match = byId.get(manufacturerId);
      if (!match) {
        issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id is not valid' }]);
        return record;
      }
      if (match.is_active === false) {
        issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id must reference an active manufacturer' }]);
        return record;
      }
      return { ...record, manufacturer: match.name || record.manufacturer };
    }
    if (manufacturerToken) {
      const match = byToken.get(normalizeManufacturerToken(manufacturerToken));
      if (!match) {
        issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id is required' }]);
        return record;
      }
      if (match.is_active === false) {
        issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id must reference an active manufacturer' }]);
        return record;
      }
      return { ...record, manufacturer_id: match.id, manufacturer: match.name || record.manufacturer };
    }
    issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id is required' }]);
    return record;
  });
  return { resolved, issues };
}

async function validateAircraftModelManufacturerReferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  franchiseId: string | null,
  records: Record<string, unknown>[],
): Promise<Map<number, { field: string; message: string }[]>> {
  const manufacturerIds = Array.from(
    new Set(
      records
        .map((record) => asNullableString(record.manufacturer_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const modelReferenceRecords = await loadAssemblyModelReferenceRecords(supabase, tenantId, manufacturerIds);
  const modelsByManufacturerId = new Map<string, AssemblyModelReferenceRecord[]>();
  modelReferenceRecords.forEach((record) => {
    const manufacturerId = asNullableString(record.manufacturer_id);
    if (!manufacturerId) return;
    const bucket = modelsByManufacturerId.get(manufacturerId);
    if (bucket) {
      bucket.push(record);
      return;
    }
    modelsByManufacturerId.set(manufacturerId, [record]);
  });

  const issues = new Map<number, { field: string; message: string }[]>();
  records.forEach((record, index) => {
    const modelToken = asNullableString(record.aircraft_model || record.model);
    const manufacturerId = asNullableString(record.manufacturer_id);
    if (!modelToken || !manufacturerId) {
      return;
    }
    const normalizedToken = normalizeLookupToken(modelToken);
    const manufacturerModels = modelsByManufacturerId.get(manufacturerId) || [];
    const matchedModel = manufacturerModels.find((reference) => collectAssemblyModelTokens(reference).includes(normalizedToken));
    if (!matchedModel) {
      issues.set(index, [{ field: 'aircraft_model', message: 'aircraft_model must belong to the selected manufacturer' }]);
      return;
    }
    const rowIssues: { field: string; message: string }[] = [];
    if (matchedModel.is_active === false) {
      rowIssues.push({ field: 'aircraft_model', message: 'aircraft_model must reference an active assembly model' });
    }
    if (!validateAssemblyModelFranchise(matchedModel, franchiseId)) {
      rowIssues.push({ field: 'aircraft_model', message: 'aircraft_model must belong to current franchise scope' });
    }
    if (rowIssues.length > 0) {
      issues.set(index, rowIssues);
    }
  });
  return issues;
}

function isV2Enabled(): boolean {
  const normalized = String(process.env.AMRO_MASTER_DATA_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function asBodyObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function splitColumns(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getActiveColumns(entity: string, listColumns: string): string[] {
  const override = ENTITY_COLUMN_OVERRIDES.get(entity);
  if (override) {
    return Array.from(override);
  }
  return splitColumns(listColumns);
}

function getActiveSearchableColumns(entity: string, searchableColumns: string[]): string[] {
  const override = ENTITY_SEARCH_COLUMN_OVERRIDES.get(entity);
  if (override) {
    return Array.from(override);
  }
  return [...searchableColumns];
}

function buildRequiredFieldIssues(entity: string, payload: Record<string, unknown>): { field: string; message: string }[] {
  const config = getEntityConfig(entity as never);
  return config.requiredCreateFields
    .filter((field) => !asNullableString(payload[field]))
    .map((field) => ({ field, message: `${field} is required` }));
}

function getSelectClause(entity: string, listColumns: string): string {
  const columns = getActiveColumns(entity, listColumns);
  if (!columns.length) {
    return '*';
  }
  if (entity === 'flight_logs') {
    return [
      ...columns,
      'aircraft_ref:aircraft!flight_logs_aircraft_id_fkey(id,registration,tail_number,status)',
      'departure_airport_ref:airports!flight_logs_departure_airport_fkey(id,name,icao_code)',
      'arrival_airport_ref:airports!flight_logs_arrival_airport_fkey(id,name,icao_code)',
    ].join(',');
  }
  return columns.join(',');
}

function extractMissingColumn(errorMessage: string): string | null {
  const direct = errorMessage.match(/column\s+([a-zA-Z0-9_."]+)\s+does not exist/i);
  if (direct?.[1]) {
    return direct[1].replace(/"/g, '');
  }
  const postgrest = errorMessage.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i);
  if (postgrest?.[1]) {
    return postgrest[1];
  }
  return null;
}

function isMissingTableError(errorMessage: string): boolean {
  return (
    /Could not find the table/i.test(errorMessage) ||
    /relation\s+["']?[a-zA-Z0-9_.]+["']?\s+does not exist/i.test(errorMessage)
  );
}

function markMissingColumn(entity: string, rawColumnName: string, listColumns: string, searchableColumns: string[]): boolean {
  const normalized = rawColumnName.replace(/^public\./, '');
  const column = normalized.includes('.') ? normalized.split('.').slice(-1)[0] : normalized;
  if (!column) {
    return false;
  }
  const columns = new Set(getActiveColumns(entity, listColumns));
  const hadColumn = columns.delete(column);
  if (hadColumn) {
    ENTITY_COLUMN_OVERRIDES.set(entity, columns);
  }
  const activeSearchable = new Set(getActiveSearchableColumns(entity, searchableColumns));
  const hadSearchColumn = activeSearchable.delete(column);
  if (hadSearchColumn) {
    ENTITY_SEARCH_COLUMN_OVERRIDES.set(entity, activeSearchable);
  }
  return hadColumn || hadSearchColumn;
}

function resolveSortColumn(entity: string, requestedSortBy: string, listColumns: string): string {
  const columns = getActiveColumns(entity, listColumns);
  if (!columns.length) {
    return requestedSortBy || 'updated_at';
  }
  if (requestedSortBy && columns.includes(requestedSortBy)) {
    return requestedSortBy;
  }
  if (columns.includes('updated_at')) {
    return 'updated_at';
  }
  if (columns.includes('created_at')) {
    return 'created_at';
  }
  return columns[0];
}

function matchesSearch(row: Record<string, unknown>, searchableColumns: string[], search: string): boolean {
  if (!search) return true;
  const searchLower = search.toLowerCase();
  return searchableColumns.some((column) => {
    const value = row[column];
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(searchLower);
  });
}

function isValidationOnly(req: ApiRequest, body: Record<string, unknown>): boolean {
  const queryFlag = String(req.query.validate_only || req.query.validateOnly || '')
    .trim()
    .toLowerCase();
  if (queryFlag === 'true' || queryFlag === '1' || queryFlag === 'yes' || queryFlag === 'on') {
    return true;
  }
  const bodyFlag = String(body.validate_only || body.validateOnly || '')
    .trim()
    .toLowerCase();
  return bodyFlag === 'true' || bodyFlag === '1' || bodyFlag === 'yes' || bodyFlag === 'on';
}

type SelectedTaskTemplateResolution = {
  taskTemplateIds: string[];
  taskReferenceTokens: string[];
  aircraftModelToken: string | null;
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function extractSelectedTaskTemplateResolution(payload: Record<string, unknown>): SelectedTaskTemplateResolution {
  const parsedTasksJson = (() => {
    if (Array.isArray(payload.tasks_json)) {
      return payload.tasks_json;
    }
    if (typeof payload.tasks_json === 'string') {
      const raw = payload.tasks_json.trim();
      if (!raw) {
        return [];
      }
      try {
        const decoded = JSON.parse(raw);
        return Array.isArray(decoded) ? decoded : [];
      } catch {
        return [];
      }
    }
    return [];
  })();
  const tasksJson = asArray(parsedTasksJson);
  const identifiers = new Set<string>();
  const referenceTokens = new Set<string>();
  const aircraftModelToken = asNullableString(payload.aircraft_model);

  for (const entry of tasksJson) {
    if (!entry) continue;
    if (typeof entry === 'string') {
      const normalized = entry.trim();
      if (!normalized) continue;
      if (isUuid(normalized)) {
        identifiers.add(normalized);
      } else {
        referenceTokens.add(normalized);
      }
      continue;
    }
    if (typeof entry !== 'object') {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const idCandidates = [
      row.task_template_id,
      row.taskTemplateId,
      row.id,
      row.tt_sequence,
    ];
    const resolvedId = idCandidates
      .map((candidate) => asNullableString(candidate))
      .find((candidate): candidate is string => Boolean(candidate));
    if (resolvedId) {
      if (isUuid(resolvedId)) {
        identifiers.add(resolvedId);
      } else {
        referenceTokens.add(resolvedId);
      }
    }
    const taskTemplateRecord = row.task_template && typeof row.task_template === 'object'
      ? (row.task_template as Record<string, unknown>)
      : null;
    const referenceCandidates = [
      row.task_id,
      row.taskId,
      row.code_form_no,
      row.codeFormNo,
      taskTemplateRecord?.task_id,
      taskTemplateRecord?.code_form_no,
      taskTemplateRecord?.id,
    ];
    referenceCandidates.forEach((candidate) => {
      const token = asNullableString(candidate);
      if (!token) return;
      if (isUuid(token)) {
        identifiers.add(token);
        return;
      }
      referenceTokens.add(token);
    });
    if (typeof row.task_template === 'string') {
      const token = asNullableString(row.task_template);
      if (!token) continue;
      if (isUuid(token)) {
        identifiers.add(token);
      } else {
        referenceTokens.add(token);
      }
    }
  }

  return {
    taskTemplateIds: Array.from(identifiers),
    taskReferenceTokens: Array.from(referenceTokens),
    aircraftModelToken,
  };
}

async function logWorkPackageTemplateLinkSnapshot(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  correlationId: string;
  templateId: string;
  tenantId: string;
}) {
  const { data, error } = await params.supabase
    .from('work_package_template_task_templates')
    .select('task_template_id', { count: 'exact' })
    .eq('tenant_id', params.tenantId)
    .eq('work_package_template_id', params.templateId);
  if (error) {
    logger.warn('[AMRO Master Data API] failed to read work package template link snapshot', {
      correlationId: params.correlationId,
      templateId: params.templateId,
      message: String(error.message || ''),
    });
    return;
  }
  logger.info('[AMRO Master Data API] work package template link snapshot', {
    correlationId: params.correlationId,
    templateId: params.templateId,
    linkedTaskTemplateCount: Number((Array.isArray(data) ? data.length : 0) || 0),
  });
}

function isFranchiseCompatible(
  recordFranchiseId: string | null,
  requestFranchiseId: string | null,
): boolean {
  if (!requestFranchiseId) return true;
  if (!recordFranchiseId) return true;
  return recordFranchiseId === requestFranchiseId;
}

async function resolveWorkPackageTemplateModelId(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  franchiseId: string | null,
  modelToken: string | null,
): Promise<string | null> {
  if (!modelToken) return null;

  const token = modelToken.trim();
  let query = supabase
    .from('assembly_models')
    .select('id,franchise_id,model_code,name,primary_model')
    .eq('tenant_id', tenantId);
  if (franchiseId) {
    query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
  }
  query = query.or(`model_code.eq.${token},name.eq.${token},primary_model.eq.${token}`);
  if (isUuid(token)) {
    query = query.or(`id.eq.${token}`);
  }
  const { data, error } = await query.limit(25);
  if (error) {
    throw new HttpError(error.message, 400);
  }
  const rows = (Array.isArray(data) ? data : [])
    .filter((record) =>
      isFranchiseCompatible(
        asNullableString((record as Record<string, unknown>).franchise_id),
        franchiseId,
      ),
    );
  if (!rows.length) {
    return null;
  }
  const exact = rows.find((row) => {
    const source = row as Record<string, unknown>;
    return [source.model_code, source.name, source.primary_model, source.id]
      .map((value) => asNullableString(value))
      .some((value) => value === token);
  });
  const resolved = exact || rows[0];
  return asNullableString((resolved as Record<string, unknown>).id);
}

export async function syncWorkPackageTemplateTaskLinks(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  correlationId: string;
  workPackageTemplateId: string;
  taskTemplateIds: string[];
  taskReferenceTokens: string[];
  aircraftModelToken: string | null;
}) {
  logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-01 sync-started', {
    correlationId: params.correlationId,
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    workPackageTemplateId: params.workPackageTemplateId,
    requestedTaskTemplateCount: params.taskTemplateIds.length,
    requestedTaskReferenceCount: params.taskReferenceTokens.length,
    aircraftModelToken: params.aircraftModelToken || null,
  });
  const uniqueTaskTemplateIds = Array.from(new Set(
    params.taskTemplateIds
      .map((id) => asNullableString(id))
      .filter((id): id is string => Boolean(id))
      .filter((id) => isUuid(id)),
  ));
  const uniqueTaskReferenceTokens = Array.from(new Set(
    params.taskReferenceTokens
      .map((token) => asNullableString(token))
      .filter((token): token is string => Boolean(token))
      .filter((token) => !isUuid(token)),
  ));
  logger.info('[AMRO Master Data API] work package template relationship sync started', {
    correlationId: params.correlationId,
    workPackageTemplateId: params.workPackageTemplateId,
    selectedTaskTemplateCount: uniqueTaskTemplateIds.length,
    selectedTaskTemplateIds: uniqueTaskTemplateIds,
    selectedTaskReferenceCount: uniqueTaskReferenceTokens.length,
    selectedTaskReferenceTokens: uniqueTaskReferenceTokens,
    aircraftModelToken: params.aircraftModelToken || '',
  });
  logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-02 normalized-identifiers', {
    correlationId: params.correlationId,
    workPackageTemplateId: params.workPackageTemplateId,
    uniqueTaskTemplateCount: uniqueTaskTemplateIds.length,
    uniqueTaskReferenceCount: uniqueTaskReferenceTokens.length,
  });

  const taskTemplateRowsById = new Map<string, Record<string, unknown>>();
  const resolvedReferenceTokens = new Set<string>();
  const resolveScopedTaskTemplateQuery = () => {
    let query = params.supabase
      .from('task_templates')
      .select('id,assembly_models,franchise_id,tt_sequence,code_form_no')
      .eq('tenant_id', params.tenantId);
    if (params.franchiseId) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
    }
    return query;
  };
  if (uniqueTaskTemplateIds.length > 0) {
    logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-03 querying-task-templates-by-id', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
      queryIdCount: uniqueTaskTemplateIds.length,
    });
    const { data: byIdRows, error: byIdError } = await resolveScopedTaskTemplateQuery().in('id', uniqueTaskTemplateIds);
    if (byIdError) {
      throw new HttpError(byIdError.message, 400);
    }
    (Array.isArray(byIdRows) ? byIdRows : []).forEach((row) => {
      const record = row as Record<string, unknown>;
      const id = asNullableString(record.id);
      if (!id) return;
      taskTemplateRowsById.set(id, record);
    });
  }
  if (uniqueTaskReferenceTokens.length > 0) {
    logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-04 querying-task-templates-by-reference', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
      queryReferenceCount: uniqueTaskReferenceTokens.length,
    });
    const { data: byTaskIdRows, error: byTaskIdError } = await resolveScopedTaskTemplateQuery().in('tt_sequence', uniqueTaskReferenceTokens);
    if (byTaskIdError) {
      throw new HttpError(byTaskIdError.message, 400);
    }
    (Array.isArray(byTaskIdRows) ? byTaskIdRows : []).forEach((row) => {
      const record = row as Record<string, unknown>;
      const id = asNullableString(record.id);
      const taskId = asNullableString(record.tt_sequence);
      if (taskId) resolvedReferenceTokens.add(taskId);
      if (!id) return;
      taskTemplateRowsById.set(id, record);
    });
    const { data: byCodeRows, error: byCodeError } = await resolveScopedTaskTemplateQuery().in('code_form_no', uniqueTaskReferenceTokens);
    if (byCodeError) {
      throw new HttpError(byCodeError.message, 400);
    }
    (Array.isArray(byCodeRows) ? byCodeRows : []).forEach((row) => {
      const record = row as Record<string, unknown>;
      const id = asNullableString(record.id);
      const codeFormNo = asNullableString(record.code_form_no);
      if (codeFormNo) resolvedReferenceTokens.add(codeFormNo);
      if (!id) return;
      taskTemplateRowsById.set(id, record);
    });
  }

  const taskTemplateRows = Array.from(taskTemplateRowsById.values());
  const availableIds = new Set(
    taskTemplateRows
      .map((row) => asNullableString((row as Record<string, unknown>).id))
      .filter((id): id is string => Boolean(id)),
  );
  const missingIds = uniqueTaskTemplateIds.filter((id) => !availableIds.has(id));
  const missingReferenceTokens = uniqueTaskReferenceTokens.filter((token) => !resolvedReferenceTokens.has(token));
  logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-05 resolution-summary', {
    correlationId: params.correlationId,
    workPackageTemplateId: params.workPackageTemplateId,
    resolvedTaskTemplateCount: availableIds.size,
    missingTaskTemplateCount: missingIds.length,
    missingReferenceTokenCount: missingReferenceTokens.length,
  });
  if (missingIds.length > 0 || missingReferenceTokens.length > 0) {
    const missingTokens = [...missingIds, ...missingReferenceTokens];
    logger.warn('[AMRO Master Data API] task template validation failed for work package template', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
      missingTaskTemplateIds: missingIds,
      missingTaskReferenceTokens: missingReferenceTokens,
    });
    throw new HttpError(`Validation failed: task_template reference not found (${missingTokens.join(', ')})`, 422);
  }
  const resolvedTaskTemplateIds = Array.from(availableIds);
  if (resolvedTaskTemplateIds.length === 0) {
    logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-06 no-task-resolved-cleanup-start', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
    });
    let cleanupQuery = params.supabase
      .from('work_package_template_task_templates')
      .delete()
      .eq('tenant_id', params.tenantId)
      .eq('work_package_template_id', params.workPackageTemplateId);
    if (params.franchiseId) {
      cleanupQuery = cleanupQuery.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
    }
    const { error: cleanupError } = await cleanupQuery;
    if (cleanupError) {
      throw new HttpError(cleanupError.message, 400);
    }
    logger.info('[AMRO Master Data API] no task templates resolved for work package template sync, existing links cleared', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
    });
    logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-07 no-task-resolved-cleanup-complete', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
    });
    return;
  }

  let modelId = await resolveWorkPackageTemplateModelId(
    params.supabase,
    params.tenantId,
    params.franchiseId,
    params.aircraftModelToken,
  );
  if (!modelId) {
    const modelIds = Array.from(
      new Set(
        taskTemplateRows
          .map((row) => asNullableString((row as Record<string, unknown>).assembly_models))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (modelIds.length === 1) {
      modelId = modelIds[0];
    } else if (modelIds.length > 1) {
      throw new HttpError('Validation failed: selected task templates belong to different aircraft models', 422);
    } else {
      throw new HttpError('Validation failed: aircraft_model is required to link selected task templates', 422);
    }
  }
  logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-08 model-resolved', {
    correlationId: params.correlationId,
    workPackageTemplateId: params.workPackageTemplateId,
    resolvedModelId: modelId,
    resolvedTaskTemplateCount: resolvedTaskTemplateIds.length,
  });

  let deleteQuery = params.supabase
    .from('work_package_template_task_templates')
    .delete()
    .eq('tenant_id', params.tenantId)
    .eq('work_package_template_id', params.workPackageTemplateId);
  logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-09 deleting-existing-links', {
    correlationId: params.correlationId,
    workPackageTemplateId: params.workPackageTemplateId,
    franchiseScoped: Boolean(params.franchiseId),
  });
  if (params.franchiseId) {
    deleteQuery = deleteQuery.or(`franchise_id.is.null,franchise_id.eq.${params.franchiseId}`);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    logger.error('[AMRO WORK PACKAGE TEMPLATE SYNC] step-09-delete-failed', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
      message: String(deleteError.message || ''),
    });
    throw new HttpError(deleteError.message, 400);
  }

  const relationshipRows = resolvedTaskTemplateIds.map((taskTemplateId) => ({
    tenant_id: params.tenantId,
    franchise_id: params.franchiseId,
    work_package_template_id: params.workPackageTemplateId,
    model_id: modelId,
    task_template_id: taskTemplateId,
    created_by: params.userId,
    updated_by: params.userId,
  }));
  logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-10 inserting-links', {
    correlationId: params.correlationId,
    workPackageTemplateId: params.workPackageTemplateId,
    insertRowCount: relationshipRows.length,
  });
  let relationInsertResult = await params.supabase
    .from('work_package_template_task_templates')
    .insert(relationshipRows);
  if (
    relationInsertResult.error &&
    /column .*created_by.* does not exist|column .*updated_by.* does not exist/i.test(String(relationInsertResult.error.message || ''))
  ) {
    logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-11 retry-insert-without-audit-columns', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
      message: String(relationInsertResult.error.message || ''),
    });
    relationInsertResult = await params.supabase
      .from('work_package_template_task_templates')
      .insert(relationshipRows.map((row) => {
        const { created_by, updated_by, ...rest } = row;
        return rest;
      }));
  }
  if (relationInsertResult.error) {
    logger.error('[AMRO WORK PACKAGE TEMPLATE SYNC] step-12-insert-failed', {
      correlationId: params.correlationId,
      workPackageTemplateId: params.workPackageTemplateId,
      message: String(relationInsertResult.error.message || ''),
    });
    throw new HttpError(relationInsertResult.error.message, 400);
  }

  logger.info('[AMRO Master Data API] linked work package template task templates', {
    correlationId: params.correlationId,
    workPackageTemplateId: params.workPackageTemplateId,
    linkedTaskTemplateCount: resolvedTaskTemplateIds.length,
    linkedTaskTemplateIds: resolvedTaskTemplateIds,
    resolvedModelId: modelId,
  });
  logger.info('[AMRO WORK PACKAGE TEMPLATE SYNC] step-13 sync-completed', {
    correlationId: params.correlationId,
    workPackageTemplateId: params.workPackageTemplateId,
    linkedTaskTemplateCount: resolvedTaskTemplateIds.length,
  });
}

type FlightLogQueryFilters = {
  flightFrom: string | null;
  flightTo: string | null;
  aircraftId: string | null;
  pilotName: string | null;
  flightNumber: string | null;
  aircraftRegistration: string | null;
};

function parseFlightLogQueryFilters(req: ApiRequest): FlightLogQueryFilters {
  return {
    flightFrom: asNullableString(req.query.flight_from),
    flightTo: asNullableString(req.query.flight_to),
    aircraftId: asNullableString(req.query.aircraft_id),
    pilotName: asNullableString(req.query.pilot_name),
    flightNumber: asNullableString(req.query.flight_number),
    aircraftRegistration: asNullableString(req.query.aircraft_registration),
  };
}

async function resolveAircraftIdsByRegistration(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  franchiseId: string | null,
  aircraftRegistration: string,
): Promise<string[]> {
  let query = supabase
    .from('aircraft')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('tail_number', `%${aircraftRegistration}%`);
  if (franchiseId) {
    query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
  }
  const { data, error } = await query;
  if (error) {
    throw new HttpError(error.message, 400);
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((row) => asNullableString((row as Record<string, unknown>).id))
    .filter((value): value is string => Boolean(value));
}

async function enrichFlightLogRowsWithAircraftData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const identifiers = Array.from(
    new Set(
      rows
        .map((row) => asNullableString(row.aircraft_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  if (identifiers.length === 0) {
    return rows;
  }
  const aircraftById = new Map<string, Record<string, unknown>>();
  const aircraftByToken = new Map<string, Record<string, unknown>>();
  const registerAircraft = (record: Record<string, unknown>) => {
    const id = asNullableString(record.id);
    if (id) {
      aircraftById.set(id, record);
    }
    const registration = asNullableString(record.registration);
    if (registration) {
      aircraftByToken.set(normalizeLookupToken(registration), record);
    }
    const tailNumber = asNullableString(record.tail_number);
    if (tailNumber) {
      aircraftByToken.set(normalizeLookupToken(tailNumber), record);
    }
  };

  const idMatches = await loadAircraftByField(supabase, 'id', identifiers, tenantId);
  idMatches.forEach((record) => registerAircraft(record));
  let unresolved = identifiers.filter((value) => !aircraftById.has(value));
  if (unresolved.length > 0) {
    const registrationMatches = await loadAircraftByField(supabase, 'registration', unresolved, tenantId);
    registrationMatches.forEach((record) => registerAircraft(record));
    const tailMatches = await loadAircraftByField(supabase, 'tail_number', unresolved, tenantId);
    tailMatches.forEach((record) => registerAircraft(record));
    unresolved = unresolved.filter((value) => !aircraftById.has(value) && !aircraftByToken.has(normalizeLookupToken(value)));
  }
  if (unresolved.length > 0) {
    const globalIdMatches = await loadAircraftByField(supabase, 'id', unresolved, null);
    globalIdMatches.forEach((record) => registerAircraft(record));
    const globalRegistrationMatches = await loadAircraftByField(supabase, 'registration', unresolved, null);
    globalRegistrationMatches.forEach((record) => registerAircraft(record));
    const globalTailMatches = await loadAircraftByField(supabase, 'tail_number', unresolved, null);
    globalTailMatches.forEach((record) => registerAircraft(record));
  }

  return rows.map((row) => {
    const aircraftId = asNullableString(row.aircraft_id);
    const joinedAircraft = extractJoinedRecord(row.aircraft_ref);
    const joinedRegistration =
      asNullableString(joinedAircraft?.registration) || asNullableString(joinedAircraft?.tail_number);
    const joinedStatus = asNullableString(joinedAircraft?.status);
    const baseRow = { ...row };
    if (!aircraftId) return baseRow;
    if (joinedAircraft) {
      return {
        ...baseRow,
        aircraft_registration: joinedRegistration,
        aircraft_label: joinedRegistration || aircraftId,
        aircraft_status: joinedStatus,
      };
    }
    const aircraft =
      aircraftById.get(aircraftId) || aircraftByToken.get(normalizeLookupToken(aircraftId));
    if (!aircraft) return baseRow;
    const registration = asNullableString(aircraft.registration) || asNullableString(aircraft.tail_number);
    return {
      ...baseRow,
      aircraft_registration: registration,
      aircraft_label: registration || aircraftId,
      aircraft_status: asNullableString(aircraft.status),
    };
  });
}

function formatAirportLabel(airport: AirportRecord | null, fallback: string): string {
  const name = airport ? asNullableString(airport.name) : null;
  const code = airport ? asNullableString(airport.icao_code) : null;
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return fallback;
}

async function enrichFlightLogRowsWithAirportData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const identifiers = Array.from(
    new Set(
      rows
        .flatMap((row) => [asNullableString(row.departure_airport), asNullableString(row.arrival_airport)])
        .filter((value): value is string => Boolean(value)),
    ),
  );
  if (identifiers.length === 0) {
    return rows;
  }
  const airportById = new Map<string, AirportRecord>();
  const airportByToken = new Map<string, AirportRecord>();
  const registerAirport = (record: AirportRecord) => {
    const id = asNullableString(record.id);
    if (id) {
      airportById.set(id, record);
    }
    const name = asNullableString(record.name);
    if (name) {
      airportByToken.set(normalizeLookupToken(name), record);
    }
    const code = asNullableString(record.icao_code);
    if (code) {
      airportByToken.set(normalizeLookupToken(code), record);
    }
  };

  const idMatches = await loadAirportsByField(supabase, 'id', identifiers, tenantId);
  idMatches.forEach((record) => registerAirport(record));
  let unresolved = identifiers.filter((value) => !airportById.has(value));
  if (unresolved.length > 0) {
    const codeMatches = await loadAirportsByField(supabase, 'icao_code', unresolved, tenantId);
    codeMatches.forEach((record) => registerAirport(record));
    const nameMatches = await loadAirportsByField(supabase, 'name', unresolved, tenantId);
    nameMatches.forEach((record) => registerAirport(record));
    unresolved = unresolved.filter((value) => !airportById.has(value) && !airportByToken.has(normalizeLookupToken(value)));
  }
  if (unresolved.length > 0) {
    const globalIdMatches = await loadAirportsByField(supabase, 'id', unresolved, null);
    globalIdMatches.forEach((record) => registerAirport(record));
    const globalCodeMatches = await loadAirportsByField(supabase, 'icao_code', unresolved, null);
    globalCodeMatches.forEach((record) => registerAirport(record));
    const globalNameMatches = await loadAirportsByField(supabase, 'name', unresolved, null);
    globalNameMatches.forEach((record) => registerAirport(record));
  }
  return rows.map((row) => {
    const departureId = asNullableString(row.departure_airport);
    const arrivalId = asNullableString(row.arrival_airport);
    const departureFallback = departureId || '';
    const arrivalFallback = arrivalId || '';
    const joinedDepartureAirport = extractJoinedRecord(row.departure_airport_ref) as AirportRecord | null;
    const joinedArrivalAirport = extractJoinedRecord(row.arrival_airport_ref) as AirportRecord | null;
    const baseRow = { ...row };
    const departureAirport = departureId
      ? joinedDepartureAirport || airportById.get(departureId) || airportByToken.get(normalizeLookupToken(departureId)) || null
      : null;
    const arrivalAirport = arrivalId
      ? joinedArrivalAirport || airportById.get(arrivalId) || airportByToken.get(normalizeLookupToken(arrivalId)) || null
      : null;
    return {
      ...baseRow,
      departure_airport_label: formatAirportLabel(departureAirport, departureFallback),
      arrival_airport_label: formatAirportLabel(arrivalAirport, arrivalFallback),
    };
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const compatibilityDecision = resolveGatewayCompatibility(req, {
    tenantId: ctx.tenantId,
    franchiseId: ctx.franchiseId,
  });
  applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      throw new HttpError(`Method ${req.method} Not Allowed`, 405);
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    // For aircraft_template, use franchise ID from request header to allow filtering by selected franchise
    const entityForScope = resolveEntity(req.query.entity);
    const requestedFranchiseId = String(req.headers['x-franchise-id'] || '').trim() || null;
    const franchiseId = entityForScope === 'aircraft_template' && requestedFranchiseId
      ? requestedFranchiseId
      : (scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null);
    const entity = entityForScope;
    const entityConfig = getEntityConfig(entity);
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records']);
      const search = parseSearch(req);
      const exportRequested = parseExportRequested(req);
      const { page, pageSize, start, end } = parsePagination(req);
      const { sortBy, ascending } = parseSort(req, entity);
      const flightLogFilters = entity === 'flight_logs' ? parseFlightLogQueryFilters(req) : null;
      const registrationAircraftIds =
        flightLogFilters?.aircraftRegistration
          ? await resolveAircraftIdsByRegistration(
              supabase,
              tenantId,
              franchiseId,
              flightLogFilters.aircraftRegistration,
            )
          : [];

      if (entity === 'flight_logs' && flightLogFilters?.aircraftRegistration && registrationAircraftIds.length === 0) {
        res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            entity,
            records: [],
            page,
            page_size: pageSize,
            total: 0,
          },
        });
        return;
      }

      const unavailableUntil = ENTITY_UNAVAILABLE.get(entity);
      if (unavailableUntil && unavailableUntil > Date.now()) {
        res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            entity,
            records: [],
            page,
            page_size: pageSize,
            total: 0,
          },
        });
        return;
      }
      if (unavailableUntil) {
        ENTITY_UNAVAILABLE.delete(entity);
      }

      let finalData: unknown[] = [];
      let finalCount = 0;
      let currentSortBy = resolveSortColumn(entity, sortBy, entityConfig.listColumns);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const selectClause = getSelectClause(entity, entityConfig.listColumns);
        const searchableColumns = getActiveSearchableColumns(entity, entityConfig.searchableColumns);
        const supportsFranchiseScope = getActiveColumns(entity, entityConfig.listColumns).includes('franchise_id');
        let query = supabase
          .from(entityConfig.table)
          .select(selectClause, { count: 'exact' })
          .order(currentSortBy, { ascending })
          .range(start, end);

        query = query.eq('tenant_id', tenantId);
        if (entity === 'flight_logs') {
          query = query.eq('is_deleted', false);
          if (flightLogFilters?.flightFrom) query = query.gte('flight_date', flightLogFilters.flightFrom);
          if (flightLogFilters?.flightTo) query = query.lte('flight_date', flightLogFilters.flightTo);
          if (flightLogFilters?.aircraftId) query = query.eq('aircraft_id', flightLogFilters.aircraftId);
          if (flightLogFilters?.pilotName) query = query.ilike('pilot_name', `%${flightLogFilters.pilotName}%`);
          if (flightLogFilters?.flightNumber) query = query.ilike('flight_number', `%${flightLogFilters.flightNumber}%`);
          if (registrationAircraftIds.length > 0) query = query.in('aircraft_id', registrationAircraftIds);
        }

        if (franchiseId && supportsFranchiseScope) {
          query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
        }
        if (search && !franchiseId && searchableColumns.length) {
          const clauses = searchableColumns.map((column) => `${column}.ilike.%${search}%`);
          query = query.or(clauses.join(','));
        }

        const { data, count, error } = await query;
        if (!error) {
          finalData = Array.isArray(data) ? data : [];
          finalCount = count || 0;
          break;
        }

        const errorMessage = String(error.message || '');
        if (isMissingTableError(errorMessage)) {
          ENTITY_UNAVAILABLE.set(entity, Date.now() + ENTITY_UNAVAILABLE_TTL_MS);
          finalData = [];
          finalCount = 0;
          break;
        }

        const missingColumn = extractMissingColumn(errorMessage);
        if (missingColumn) {
          markMissingColumn(entity, missingColumn, entityConfig.listColumns, entityConfig.searchableColumns);
          currentSortBy = resolveSortColumn(entity, currentSortBy, entityConfig.listColumns);
          continue;
        }

        throw new HttpError(errorMessage, 400);
      }

      const allowTenantNullFallback = entity !== 'work_package_templates';
      if (tenantId && finalData.length === 0 && allowTenantNullFallback) {
        let fallbackData: unknown[] = [];
        let fallbackCount = 0;
        let fallbackSortBy = currentSortBy;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const selectClause = getSelectClause(entity, entityConfig.listColumns);
          const searchableColumns = getActiveSearchableColumns(entity, entityConfig.searchableColumns);
          const supportsFranchiseScope = getActiveColumns(entity, entityConfig.listColumns).includes('franchise_id');
          let fallbackQuery: any = supabase
            .from(entityConfig.table)
            .select(selectClause, { count: 'exact' })
            .order(fallbackSortBy, { ascending })
            .range(start, end);

          if (typeof fallbackQuery.is === 'function') {
            fallbackQuery = fallbackQuery.is('tenant_id', null);
          } else {
            fallbackQuery = fallbackQuery.eq('tenant_id', null);
          }
          if (entity === 'flight_logs') {
            fallbackQuery = fallbackQuery.eq('is_deleted', false);
            if (flightLogFilters?.flightFrom) fallbackQuery = fallbackQuery.gte('flight_date', flightLogFilters.flightFrom);
            if (flightLogFilters?.flightTo) fallbackQuery = fallbackQuery.lte('flight_date', flightLogFilters.flightTo);
            if (flightLogFilters?.aircraftId) fallbackQuery = fallbackQuery.eq('aircraft_id', flightLogFilters.aircraftId);
            if (flightLogFilters?.pilotName) fallbackQuery = fallbackQuery.ilike('pilot_name', `%${flightLogFilters.pilotName}%`);
            if (flightLogFilters?.flightNumber) fallbackQuery = fallbackQuery.ilike('flight_number', `%${flightLogFilters.flightNumber}%`);
            if (registrationAircraftIds.length > 0) fallbackQuery = fallbackQuery.in('aircraft_id', registrationAircraftIds);
          }
          if (franchiseId && supportsFranchiseScope) {
            if (typeof fallbackQuery.is === 'function') {
              fallbackQuery = fallbackQuery.is('franchise_id', null);
            } else {
              fallbackQuery = fallbackQuery.eq('franchise_id', null);
            }
          }
          if (search && !franchiseId && searchableColumns.length) {
            const clauses = searchableColumns.map((column) => `${column}.ilike.%${search}%`);
            fallbackQuery = fallbackQuery.or(clauses.join(','));
          }

          const { data, count, error } = await fallbackQuery;
          if (!error) {
            fallbackData = Array.isArray(data) ? data : [];
            fallbackCount = count || 0;
            break;
          }

          const errorMessage = String(error.message || '');
          if (isMissingTableError(errorMessage)) {
            ENTITY_UNAVAILABLE.set(entity, Date.now() + ENTITY_UNAVAILABLE_TTL_MS);
            fallbackData = [];
            fallbackCount = 0;
            break;
          }
          const missingColumn = extractMissingColumn(errorMessage);
          if (missingColumn) {
            markMissingColumn(entity, missingColumn, entityConfig.listColumns, entityConfig.searchableColumns);
            fallbackSortBy = resolveSortColumn(entity, fallbackSortBy, entityConfig.listColumns);
            continue;
          }

          throw new HttpError(errorMessage, 400);
        }

        if (fallbackData.length > 0) {
          finalData = fallbackData;
          finalCount = fallbackCount;
        }
      }

      const rawRows = entity === 'flight_logs'
        ? await enrichFlightLogRowsWithAirportData(
            supabase,
            tenantId,
            await enrichFlightLogRowsWithAircraftData(supabase, tenantId, (finalData || []) as Record<string, unknown>[]),
          )
        : ((finalData || []) as Record<string, unknown>[]);
      const activeSearchableColumns = getActiveSearchableColumns(entity, entityConfig.searchableColumns);
      const rows = franchiseId && search ? rawRows.filter((row) => matchesSearch(row, activeSearchableColumns, search)) : rawRows;
      if (exportRequested) {
        const csv = buildCsv(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="amro-${entity}.csv"`);
        res.status(200).end(csv);
        return;
      }
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          records: rows,
          page,
          page_size: pageSize,
          total: finalCount || rows.length,
        },
      });
      return;
    }

    enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);
    const body = asBodyObject(req.body);
    const validationOnly = isValidationOnly(req, body);
    const { isBulkImport, records } = parseBulkOperation(body);

    if (isBulkImport) {
      if (!records.length) {
        throw new HttpError('records are required for bulk import', 400);
      }
      if (records.length > 500) {
        throw new HttpError('bulk import supports up to 500 records per request', 400);
      }
      let resolvedRecords = records;
      let manufacturerIssues = new Map<number, { field: string; message: string }[]>();
      let aircraftModelIssues = new Map<number, { field: string; message: string }[]>();
      let assemblyModelIssues = new Map<number, { field: string; message: string }[]>();
      if (entity === 'aircraft') {
        const resolved = await resolveAircraftManufacturerReferences(supabase, records);
        resolvedRecords = resolved.resolved;
        manufacturerIssues = resolved.issues;
        aircraftModelIssues = await validateAircraftModelManufacturerReferences(
          supabase,
          tenantId,
          franchiseId,
          resolvedRecords,
        );
      }
      if (entity === 'assembly_models') {
        assemblyModelIssues = await validateAssemblyModelReferences(supabase, tenantId, franchiseId, records);
      }
      const prepared = resolvedRecords.map((record) =>
        sanitizeWritePayload(entity, record, { requireCreateFields: entity !== 'aircraft' }),
      );
      const validationResults = prepared.map((record, index) => ({
        index,
        issues: [
          ...(manufacturerIssues.get(index) || []),
          ...(aircraftModelIssues.get(index) || []),
          ...(assemblyModelIssues.get(index) || []),
          ...buildRequiredFieldIssues(entity, record),
          ...validatePayload(entity, record),
        ],
      }));
      const invalidRows = validationResults.filter((result) => result.issues.length > 0);
      if (validationOnly) {
        res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            entity,
            validation: {
              mode: 'bulk_import',
              is_valid: invalidRows.length === 0,
              total_records: prepared.length,
              invalid_records: invalidRows.length,
              results: validationResults,
            },
          },
        });
        return;
      }
      if (invalidRows.length > 0) {
        throw new HttpError(`Validation failed for ${invalidRows.length} record(s)`, 422);
      }
      const supportsFranchiseScope = splitColumns(entityConfig.listColumns).includes('franchise_id');
      const insertRows = prepared.map((record) => {
        const insertRow: Record<string, unknown> = {
          ...record,
          tenant_id: tenantId,
          updated_by: auth.userId,
        };
        if (supportsFranchiseScope) {
          insertRow.franchise_id = franchiseId;
        }
        return insertRow;
      });
      const { data, error } = await supabase
        .from(entityConfig.table)
        .insert(insertRows)
        .select(entityConfig.listColumns);
      if (error) throw new HttpError(error.message, 400);
      await writeAuditRecord({
        tenantId,
        franchiseId,
        userId: auth.userId,
        entity,
        action: 'bulk_import',
        afterData: {
          count: insertRows.length,
        },
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          imported_count: insertRows.length,
          records: data || [],
        },
      });
      return;
    }

    let resolvedBody = body;
    let manufacturerIssues: { field: string; message: string }[] = [];
    let aircraftModelIssues: { field: string; message: string }[] = [];
    if (entity === 'aircraft') {
      const resolved = await resolveAircraftManufacturerReferences(supabase, [body]);
      resolvedBody = resolved.resolved[0] || body;
      manufacturerIssues = resolved.issues.get(0) || [];
      const validation = await validateAircraftModelManufacturerReferences(supabase, tenantId, franchiseId, [resolvedBody]);
      aircraftModelIssues = validation.get(0) || [];
    }
    const payload = sanitizeWritePayload(entity, resolvedBody, { requireCreateFields: entity !== 'aircraft' });
    if (entity === 'work_package_templates') {
      if (Object.prototype.hasOwnProperty.call(payload, 'policy_snapshot_id')) {
        payload.policy_snapshot_id = asNullableString(payload.policy_snapshot_id);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'assembly_models_id')) {
        payload.assembly_models_id = asNullableString(payload.assembly_models_id);
      }
    }
    let assemblyModelIssues: { field: string; message: string }[] = [];
    if (entity === 'assembly_models') {
      const validation = await validateAssemblyModelReferences(supabase, tenantId, franchiseId, [payload]);
      assemblyModelIssues = validation.get(0) || [];
    }
    const workPackageTemplateIssues: { field: string; message: string }[] = [];
    if (entity === 'work_package_templates') {
      const policySnapshotId = asNullableString(payload.policy_snapshot_id);
      const modelId = asNullableString(payload.assembly_models_id);
      if (policySnapshotId && !isUuid(policySnapshotId)) {
        workPackageTemplateIssues.push({
          field: 'policy_snapshot_id',
          message: 'Policy Snapshot ID must be a valid UUID.',
        });
      }
      if (modelId && !isUuid(modelId)) {
        workPackageTemplateIssues.push({
          field: 'assembly_models_id',
          message: 'Aircraft Model reference must be a valid UUID.',
        });
      }
    }
    const issues = [
      ...manufacturerIssues,
      ...aircraftModelIssues,
      ...assemblyModelIssues,
      ...workPackageTemplateIssues,
      ...buildRequiredFieldIssues(entity, payload),
      ...validatePayload(entity, payload),
    ];
    if (validationOnly) {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          validation: {
            mode: 'single',
            is_valid: issues.length === 0,
            issues,
          },
        },
      });
      return;
    }
    if (issues.length > 0) {
      res.status(422).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: 'Validation failed',
        output: {
          entity,
          validation: {
            mode: 'single',
            is_valid: false,
            issues,
          },
        },
      });
      return;
    }
    const supportsFranchiseScope = splitColumns(entityConfig.listColumns).includes('franchise_id');
    const insertPayload: Record<string, unknown> = {
      ...payload,
      tenant_id: tenantId,
      created_by: auth.userId,
      updated_by: auth.userId,
    };
    logger.debug('[CREATE WORK PACKAGE TEMPLATE TASK STEP -001] ', {function: 'insertPayload'});
    if (supportsFranchiseScope) {
      insertPayload.franchise_id = franchiseId;
    }
    if (entity === 'work_package_templates') {
      const { taskTemplateIds, taskReferenceTokens, aircraftModelToken } = extractSelectedTaskTemplateResolution(payload);
      logger.debug('[CREATE WORK PACKAGE TEMPLATE TASK STEP 000] ', {function: 'insertPayload'});
      logger.info('[AMRO Master Data API] create request received for work package template', {
        correlationId: ctx.correlationId,
        apiPath: `/api/v2/amro/master-data/${entity}`,
        method: req.method,
        tenantId,
        franchiseId: franchiseId || null,
        templateCode: asNullableString(insertPayload.template_code),
        templateName: asNullableString(insertPayload.template_name),
        maintenanceType: asNullableString(insertPayload.maintenance_type),
        aircraftModel: aircraftModelToken,
        selectedTaskTemplateCount: taskTemplateIds.length,
        selectedTaskTemplateIds: taskTemplateIds,
        selectedTaskReferenceCount: taskReferenceTokens.length,
        selectedTaskReferenceTokens: taskReferenceTokens,
      });
      const normalizeJsonArray = (value: unknown): unknown[] => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          const raw = value.trim();
          if (!raw) return [];
          try {
            const decoded = JSON.parse(raw);
            return Array.isArray(decoded) ? decoded : [];
          } catch {
            return [];
          }
        }
        return [];
      };
      const rpcPayload: Record<string, unknown> = {
        ...insertPayload,
        tasks_json: normalizeJsonArray(insertPayload.tasks_json),
        scope_json: normalizeJsonArray(insertPayload.scope_json),
        policy_snapshot_id: null,
      };
      logger.info('[AMRO WORK PACKAGE TEMPLATE CREATE] step-01 rpc-payload-prepared', {
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId: franchiseId || null,
        taskCountInPayload: Array.isArray(rpcPayload.tasks_json) ? rpcPayload.tasks_json.length : 0,
        scopeCountInPayload: Array.isArray(rpcPayload.scope_json) ? rpcPayload.scope_json.length : 0,
      });
      logger.info('[AMRO WORK PACKAGE TEMPLATE CREATE] step-02 calling-atomic-function', {
        correlationId: ctx.correlationId,
        functionName: 'amro_create_work_package_template_atomic',
      });
      const { data: atomicResult, error: atomicError } = await supabase.rpc('amro_create_work_package_template_atomic', {
        p_tenant_id: tenantId,
        p_franchise_id: franchiseId,
        p_user_id: auth.userId,
        p_correlation_id: ctx.correlationId,
        p_payload: rpcPayload,
      });
      if (atomicError) {
        const message = String(atomicError.message || '');
        logger.error('[AMRO WORK PACKAGE TEMPLATE CREATE] step-03 atomic-function-failed', {
          correlationId: ctx.correlationId,
          message,
        });
        if (/validation failed/i.test(message)) {
          throw new HttpError(message, 422);
        }
        if (/amro_create_work_package_template_atomic/i.test(message) && /does not exist|undefined function/i.test(message)) {
          logger.error('[AMRO WORK PACKAGE TEMPLATE CREATE] step-04 atomic-function-missing', {
            correlationId: ctx.correlationId,
            message,
          });
          throw new HttpError('Atomic create function is missing in database. Apply latest Supabase migrations Sarvesh.', 500);
        }
        throw new HttpError(message || 'Failed to create work package template transaction', 400);
      }
      const atomic = atomicResult && typeof atomicResult === 'object'
        ? (atomicResult as Record<string, unknown>)
        : {};
      const createdRecord = atomic.record && typeof atomic.record === 'object'
        ? (atomic.record as Record<string, unknown>)
        : null;
      const createdTemplateId = asNullableString(createdRecord?.id);
      if (!createdTemplateId) {
        logger.error('[AMRO WORK PACKAGE TEMPLATE CREATE] step-05 missing-created-template-id', {
          correlationId: ctx.correlationId,
        });
        throw new HttpError('Atomic create did not return work package template id', 500);
      }
      const createdRelationshipsRaw = Array.isArray(atomic.created_relationships)
        ? (atomic.created_relationships as unknown[])
        : [];
      const createdRelationships = createdRelationshipsRaw
        .filter((item) => item && typeof item === 'object')
        .map((item) => item as Record<string, unknown>);
      const requestedModelId = asNullableString(insertPayload.assembly_models_id);
      const requestedAircraftModel = asNullableString(insertPayload.aircraft_model);
      let effectiveCreatedRecord = createdRecord;
      if (requestedModelId || requestedAircraftModel) {
        const patchPayload: Record<string, unknown> = {};
        if (requestedModelId) patchPayload.assembly_models_id = requestedModelId;
        if (requestedAircraftModel) patchPayload.aircraft_model = requestedAircraftModel;
        if (Object.keys(patchPayload).length > 0) {
          const { data: patchedRecord, error: patchError } = await supabase
            .from('work_package_templates')
            .update(patchPayload)
            .eq('tenant_id', tenantId)
            .eq('id', createdTemplateId)
            .select(entityConfig.listColumns)
            .limit(1)
            .maybeSingle();
          if (patchError) {
            logger.warn('[AMRO WORK PACKAGE TEMPLATE CREATE] post-create model context patch skipped', {
              correlationId: ctx.correlationId,
              createdTemplateId,
              message: String(patchError.message || ''),
            });
          } else if (patchedRecord && typeof patchedRecord === 'object') {
            effectiveCreatedRecord = patchedRecord as Record<string, unknown>;
          }
        }
      }
      logger.info('[AMRO WORK PACKAGE TEMPLATE CREATE] step-06 atomic-function-succeeded', {
        correlationId: ctx.correlationId,
        createdTemplateId,
        createdRelationshipCount: createdRelationships.length,
      });
      createdRelationships.forEach((relationship, index) => {
        logger.debug('[AMRO Master Data API] inserted work package template task relationship', {
          correlationId: ctx.correlationId,
          workPackageTemplateId: createdTemplateId,
          relationshipIndex: index,
          taskTemplateId: asNullableString(relationship.task_template_id),
          modelId: asNullableString(relationship.model_id),
        });
      });
      const requestedTaskCount = Array.isArray(createdRecord?.tasks_json) ? createdRecord?.tasks_json.length : 0;
      const { data: verificationRows, error: verificationError } = await supabase
        .from('work_package_template_task_templates')
        .select('task_template_id')
        .eq('tenant_id', tenantId)
        .eq('work_package_template_id', createdTemplateId);
      if (verificationError) {
        logger.error('[AMRO WORK PACKAGE TEMPLATE CREATE] step-07 verification-query-failed', {
          correlationId: ctx.correlationId,
          createdTemplateId,
          message: String(verificationError.message || ''),
        });
        throw new HttpError(verificationError.message, 400);
      }
      const persistedRelationshipCount = Array.isArray(verificationRows) ? verificationRows.length : 0;
      logger.info('[AMRO WORK PACKAGE TEMPLATE CREATE] step-08 verification-summary', {
        correlationId: ctx.correlationId,
        createdTemplateId,
        requestedTaskCount,
        persistedRelationshipCount,
      });
      if (persistedRelationshipCount !== requestedTaskCount) {
        logger.error('[AMRO WORK PACKAGE TEMPLATE CREATE] step-09 verification-mismatch', {
          correlationId: ctx.correlationId,
          createdTemplateId,
          requestedTaskCount,
          persistedRelationshipCount,
        });
        throw new HttpError(
          `Verification failed: relationship count mismatch. expected=${requestedTaskCount} actual=${persistedRelationshipCount}`,
          500,
        );
      }
      await writeAuditRecord({
        tenantId,
        franchiseId,
        userId: auth.userId,
        entity,
        action: 'create',
        entityId: createdTemplateId,
        afterData: effectiveCreatedRecord,
      });
      res.status(201).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          record: effectiveCreatedRecord,
          created_task_relationships: createdRelationships,
          relationship_count: createdRelationships.length,
          requested_task_count: requestedTaskCount,
        },
      });
      logger.info('[AMRO WORK PACKAGE TEMPLATE CREATE] step-10 response-sent', {
        correlationId: ctx.correlationId,
        createdTemplateId,
        requestedTaskCount,
        relationshipCount: createdRelationships.length,
      });
      return;
    }
    const { data, error } = await supabase
      .from(entityConfig.table)
      .insert(insertPayload)
      .select(entityConfig.listColumns)
      .maybeSingle();
    if (error) {
      throw new HttpError(error.message, 400);
    }
    await writeAuditRecord({
      tenantId,
      franchiseId,
      userId: auth.userId,
      entity,
      action: 'create',
      entityId: String(((data as unknown as Record<string, unknown> | null)?.id) || ''),
      afterData: data,
    });
    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        entity,
        record: data,
      },
    });
  } catch (error) {
    sendError(res, error, ctx.correlationId);
  }
}
