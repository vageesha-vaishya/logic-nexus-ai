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
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;
    const entity = resolveEntity(req.query.entity);
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

        if (franchiseId) {
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

      if (tenantId && finalData.length === 0) {
        let fallbackData: unknown[] = [];
        let fallbackCount = 0;
        let fallbackSortBy = currentSortBy;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const selectClause = getSelectClause(entity, entityConfig.listColumns);
          const searchableColumns = getActiveSearchableColumns(entity, entityConfig.searchableColumns);
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
          if (franchiseId) {
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
      const insertRows = prepared.map((record) => ({
        ...record,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        updated_by: auth.userId,
      }));
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
    let assemblyModelIssues: { field: string; message: string }[] = [];
    if (entity === 'assembly_models') {
      const validation = await validateAssemblyModelReferences(supabase, tenantId, franchiseId, [payload]);
      assemblyModelIssues = validation.get(0) || [];
    }
    const issues = [
      ...manufacturerIssues,
      ...aircraftModelIssues,
      ...assemblyModelIssues,
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
    const insertPayload = {
      ...payload,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      created_by: auth.userId,
      updated_by: auth.userId,
    };
    const { data, error } = await supabase
      .from(entityConfig.table)
      .insert(insertPayload)
      .select(entityConfig.listColumns)
      .maybeSingle();
    if (error) throw new HttpError(error.message, 400);
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
