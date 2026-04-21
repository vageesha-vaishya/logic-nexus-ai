import { Router } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { executeWithResilience } from '../utils/resilience';

type JsonRecord = Record<string, unknown>;

type AssemblyReferenceRecord = {
  id: string;
  tenant_id: string | null;
  franchise_id: string | null;
  is_active: boolean | null;
};

type AirportRecord = {
  id: string;
  name: string | null;
  icao_code: string | null;
};

type MasterEntity =
  | 'aircraft'
  | 'aircraft_template'
  | 'flight_logs'
  | 'parts_inventory'
  | 'suppliers'
  | 'maintenance_facilities'
  | 'work_centers'
  | 'skill_codes'
  | 'manufacturers'
  | 'assembly_types'
  | 'assembly_models'
  | 'ata_codes'
  | 'task_categories'
  | 'regulator_profiles'
  | 'shift_calendars'
  | 'work_package_templates';

type EntityConfig = {
  table: string;
  searchableColumns: string[];
  listColumns: string;
  requiredCreateFields: string[];
  writeAllowedFields: string[];
  defaultSortColumn: string;
};

const ENTITY_COLUMN_OVERRIDES = new Map<MasterEntity, Set<string>>();
const ENTITY_SEARCH_COLUMN_OVERRIDES = new Map<MasterEntity, Set<string>>();

class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const ENTITY_CONFIG: Record<MasterEntity, EntityConfig> = {
  aircraft: {
    table: 'aircraft',
    searchableColumns: ['tail_number', 'registration', 'serial_number', 'aircraft_type', 'aircraft_model', 'msn'],
    listColumns:
      'id,tenant_id,franchise_id,registration,tail_number,serial_number,aircraft_type,aircraft_model,configuration_code,maintenance_program,status,engine_install_history,thrust_rating_change_log,on_wing_lifecycle_records,created_at,updated_at',
    requiredCreateFields: ['tail_number', 'serial_number', 'aircraft_type', 'aircraft_model'],
    writeAllowedFields: [
      'registration',
      'tail_number',
      'serial_number',
      'aircraft_type',
      'aircraft_model',
      'configuration_code',
      'maintenance_program',
      'manufacturer',
      'model',
      'msn',
      'line_number',
      'status',
      'operator_code',
      'station_code',
      'base_location',
      'engine_type',
      'current_flight_hours',
      'current_cycles',
      'current_flight_hours_since_new',
      'current_cycles_since_new',
      'engine_install_history',
      'thrust_rating_change_log',
      'on_wing_lifecycle_records',
    ],
    defaultSortColumn: 'updated_at',
  },
  aircraft_template: {
    table: 'aircraft_template',
    searchableColumns: ['template_name', 'maintenance_program'],
    listColumns:
      'id,tenant_id,franchise_id,template_name,assembly_models,maintenance_program,revision_number,amendment_number,created_at,updated_at,created_by,updated_by',
    requiredCreateFields: ['template_name'],
    writeAllowedFields: [
      'template_name',
      'franchise_id',
      'assembly_models',
      'maintenance_program',
      'revision_number',
      'amendment_number',
    ],
    defaultSortColumn: 'template_name',
  },
  flight_logs: {
    table: 'flight_logs',
    searchableColumns: ['flight_number', 'departure_airport', 'arrival_airport', 'pilot_name', 'regulatory_authority'],
    listColumns:
      'id,tenant_id,franchise_id,aircraft_id,flight_date,flight_number,departure_airport,arrival_airport,pilot_name,flight_hours,block_hours,flight_cycles,crew_details,fuel_burn_kg,oil_uplift_liters,pirep_discrepancy,regulatory_authority,is_deleted,deleted_at,deleted_by,metadata,created_at,updated_at,created_by,updated_by',
    requiredCreateFields: ['aircraft_id', 'flight_date', 'departure_airport', 'arrival_airport'],
    writeAllowedFields: [
      'aircraft_id',
      'flight_date',
      'flight_number',
      'departure_airport',
      'arrival_airport',
      'pilot_name',
      'flight_hours',
      'block_hours',
      'flight_cycles',
      'crew_details',
      'fuel_burn_kg',
      'oil_uplift_liters',
      'pirep_discrepancy',
      'regulatory_authority',
      'metadata',
    ],
    defaultSortColumn: 'flight_date',
  },
  parts_inventory: {
    table: 'parts_inventory',
    searchableColumns: ['part_number', 'serial_number', 'description', 'warehouse_location', 'category', 'supplier_name'],
    listColumns:
      'id,tenant_id,franchise_id,part_number,serial_number,description,category,unit_of_measure,min_stock_level,reorder_level,reorder_quantity,quantity_on_hand,quantity_reserved,quantity_available,supplier_id,supplier_name,warehouse_location,status,last_movement_at,created_at,updated_at',
    requiredCreateFields: ['part_number', 'warehouse_location'],
    writeAllowedFields: [
      'part_number',
      'serial_number',
      'description',
      'category',
      'unit_of_measure',
      'min_stock_level',
      'reorder_level',
      'reorder_quantity',
      'quantity_on_hand',
      'quantity_reserved',
      'component_id',
      'supplier_id',
      'supplier_name',
      'warehouse_location',
      'status',
      'unit_cost',
      'currency',
      'last_movement_at',
    ],
    defaultSortColumn: 'updated_at',
  },
  suppliers: {
    table: 'suppliers',
    searchableColumns: ['supplier_code', 'name', 'contact_name', 'email', 'phone'],
    listColumns: 'id,tenant_id,franchise_id,supplier_code,name,contact_name,email,phone,lead_time_days,rating,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['supplier_code', 'name'],
    writeAllowedFields: ['supplier_code', 'name', 'contact_name', 'email', 'phone', 'lead_time_days', 'rating', 'is_active', 'metadata'],
    defaultSortColumn: 'updated_at',
  },
  maintenance_facilities: {
    table: 'maintenance_facilities',
    searchableColumns: ['facility_code', 'name', 'station_code', 'facility_type', 'location_city', 'location_country'],
    listColumns:
      'id,tenant_id,franchise_id,facility_code,name,facility_type,station_code,location_city,location_country,timezone,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['facility_code', 'name', 'facility_type', 'station_code'],
    writeAllowedFields: [
      'facility_code',
      'name',
      'facility_type',
      'station_code',
      'location_city',
      'location_country',
      'timezone',
      'contact_name',
      'contact_email',
      'contact_phone',
      'is_active',
      'metadata',
    ],
    defaultSortColumn: 'updated_at',
  },
  work_centers: {
    table: 'work_centers',
    searchableColumns: ['work_center_code', 'name', 'center_type', 'station_code', 'facility_code'],
    listColumns:
      'id,tenant_id,franchise_id,facility_id,facility_code,work_center_code,name,center_type,station_code,capacity_hours_per_day,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['work_center_code', 'name', 'center_type', 'station_code'],
    writeAllowedFields: ['facility_id', 'facility_code', 'work_center_code', 'name', 'center_type', 'station_code', 'capacity_hours_per_day', 'is_active', 'metadata'],
    defaultSortColumn: 'updated_at',
  },
  skill_codes: {
    table: 'skill_codes',
    searchableColumns: ['skill_code', 'description', 'skill_family', 'license_authority'],
    listColumns:
      'id,tenant_id,franchise_id,skill_code,description,skill_family,license_authority,is_certification_required,validity_period_months,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['skill_code', 'description'],
    writeAllowedFields: ['skill_code', 'description', 'skill_family', 'license_authority', 'is_certification_required', 'validity_period_months', 'is_active', 'metadata'],
    defaultSortColumn: 'updated_at',
  },
  manufacturers: {
    table: 'manufacturers',
    searchableColumns: ['manufacturer_code', 'name', 'country', 'id'],
    listColumns: 'id,tenant_id,franchise_id,manufacturer_code,name,country,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['manufacturer_code', 'name'],
    writeAllowedFields: ['manufacturer_code', 'name', 'country', 'is_active', 'metadata'],
    defaultSortColumn: 'updated_at',
  },
  assembly_types: {
    table: 'assembly_types',
    searchableColumns: ['assembly_code', 'name', 'description', 'id'],
    listColumns: 'id,tenant_id,franchise_id,assembly_code,name,description,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['assembly_code', 'name', 'description'],
    writeAllowedFields: ['assembly_code', 'name', 'description', 'is_active', 'metadata'],
    defaultSortColumn: 'updated_at',
  },
  assembly_models: {
    table: 'assembly_models',
    searchableColumns: ['model_code', 'name', 'primary_model', 'aircraft_type', 'id'],
    listColumns:
      'id,tenant_id,franchise_id,manufacturer_id,assembly_type_id,aircraft_type,model_code,name,primary_model,description,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['manufacturer_id', 'assembly_type_id', 'model_code', 'name'],
    writeAllowedFields: [
      'manufacturer_id',
      'assembly_type_id',
      'aircraft_type',
      'model_code',
      'name',
      'primary_model',
      'description',
      'is_active',
      'metadata',
    ],
    defaultSortColumn: 'updated_at',
  },
  ata_codes: {
    table: 'ata_codes',
    searchableColumns: ['code', 'description', 'id'],
    listColumns: 'id,tenant_id,franchise_id,code,description,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['code', 'description'],
    writeAllowedFields: ['code', 'description', 'is_active', 'metadata'],
    defaultSortColumn: 'updated_at',
  },
  task_categories: {
    table: 'task_categories',
    searchableColumns: ['code', 'name', 'description', 'task_category_type', 'id'],
    listColumns: 'id,tenant_id,franchise_id,code,name,description,task_category_type,is_active,created_at,updated_at',
    requiredCreateFields: ['code', 'name', 'task_category_type'],
    writeAllowedFields: ['code', 'name', 'description', 'task_category_type', 'is_active'],
    defaultSortColumn: 'updated_at',
  },
  regulator_profiles: {
    table: 'regulator_profiles',
    searchableColumns: ['regulator_code', 'regulator_name', 'jurisdiction', 'policy_version'],
    listColumns:
      'id,tenant_id,franchise_id,regulator_code,regulator_name,jurisdiction,policy_version,effective_from,effective_to,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['regulator_code', 'regulator_name', 'jurisdiction', 'policy_version'],
    writeAllowedFields: [
      'regulator_code',
      'regulator_name',
      'jurisdiction',
      'policy_version',
      'effective_from',
      'effective_to',
      'is_active',
      'metadata',
    ],
    defaultSortColumn: 'updated_at',
  },
  shift_calendars: {
    table: 'shift_calendars',
    searchableColumns: ['station_code', 'shift_name'],
    listColumns:
      'id,tenant_id,franchise_id,station_code,shift_name,shift_start_time,shift_end_time,capacity,effective_from,effective_to,is_active,created_at,updated_at',
    requiredCreateFields: ['station_code', 'shift_name', 'shift_start_time', 'shift_end_time'],
    writeAllowedFields: [
      'station_code',
      'shift_name',
      'shift_start_time',
      'shift_end_time',
      'capacity',
      'effective_from',
      'effective_to',
      'is_active',
    ],
    defaultSortColumn: 'updated_at',
  },
  work_package_templates: {
    table: 'work_package_templates',
    searchableColumns: ['template_code', 'template_name', 'maintenance_type', 'assembly_models_id'],
    listColumns:
      'id,tenant_id,franchise_id,assembly_models_id,template_code,version,active,template_name,maintenance_type,assembly_models,scope_json,tasks_json,materials_json,tooling_json,compliance_requirements_json,policy_snapshot_id,created_at,updated_at',
    requiredCreateFields: ['assembly_models_id', 'template_code', 'version', 'template_name', 'maintenance_type'],
    writeAllowedFields: [
      'assembly_models_id',
      'template_code',
      'version',
      'active',
      'template_name',
      'maintenance_type',
      'assembly_models',
      'scope_json',
      'tasks_json',
      'materials_json',
      'tooling_json',
      'compliance_requirements_json',
      'policy_snapshot_id',
    ],
    defaultSortColumn: 'updated_at',
  },
};

function isV2Enabled(): boolean {
  const normalized = String(process.env.AMRO_MASTER_DATA_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function resolveSupabaseCredentials(): { url: string; serviceKey: string } {
  const url = String(
    process.env.AMRO_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '',
  ).replace(/\/$/, '');
  const serviceKey = String(
    process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      '',
  ).trim();
  return { url, serviceKey };
}

function getSupabaseAdminClient(): SupabaseClient {
  const { url, serviceKey } = resolveSupabaseCredentials();
  if (!url || !serviceKey) {
    throw new HttpError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables', 500);
  }
  return createClient(url, serviceKey);
}

function asString(value: unknown): string {
  return String(value || '').trim();
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized || null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError('Invalid numeric value', 400);
  }
  return parsed;
}

function asBoolean(value: unknown, fallback?: boolean): boolean {
  if (value === null || value === undefined || value === '') return Boolean(fallback);
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new HttpError('metadata must be an object', 400);
}

function asJsonArray(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  throw new HttpError('value must be an array', 400);
}

function asDateString(value: unknown): string | null {
  const normalized = asNullableString(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    throw new HttpError('Invalid date value', 400);
  }
  return normalized;
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

function resolveEntity(rawEntity: unknown): MasterEntity {
  const entity = asString(rawEntity)
    .toLowerCase()
    .replace(/[-\s]+/g, '_') as MasterEntity;
  if (!ENTITY_CONFIG[entity]) {
    throw new HttpError('Unsupported master data entity', 404);
  }
  return entity;
}

function parsePagination(req: AuthRequest): { page: number; pageSize: number; start: number; end: number } {
  const pageQuery = firstQueryValue(req.query.page);
  const pageSizeQuery = firstQueryValue(req.query.page_size || req.query.pageSize);
  const pageRaw = pageQuery ? Number(pageQuery) : 1;
  const pageSizeRaw = pageSizeQuery ? Number(pageSizeQuery) : 25;
  if (!Number.isFinite(pageRaw) || pageRaw <= 0 || !Number.isInteger(pageRaw)) {
    throw new HttpError('page must be a positive integer', 400);
  }
  if (!Number.isFinite(pageSizeRaw) || pageSizeRaw <= 0 || !Number.isInteger(pageSizeRaw)) {
    throw new HttpError('page_size must be a positive integer', 400);
  }
  if (pageSizeRaw > 5000) {
    throw new HttpError('page_size must be less than or equal to 5000', 400);
  }
  const page = pageRaw;
  const pageSize = pageSizeRaw;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  return { page, pageSize, start, end };
}

function parseSort(req: AuthRequest, entity: MasterEntity): { sortBy: string; ascending: boolean } {
  const config = ENTITY_CONFIG[entity];
  const sortBy = firstQueryValue(req.query.sort_by || req.query.sortBy) || config.defaultSortColumn;
  const rawSortDir = firstQueryValue(req.query.sort_dir || req.query.sortDir).toLowerCase();
  if (rawSortDir && rawSortDir !== 'asc' && rawSortDir !== 'desc') {
    throw new HttpError('sort_dir must be asc or desc', 400);
  }
  const ascending = rawSortDir === 'asc';
  return { sortBy, ascending };
}

function parseSearch(req: AuthRequest): string {
  const search = firstQueryValue(req.query.search || req.query.q);
  if (search.length > 200) {
    throw new HttpError('search must be 200 characters or fewer', 400);
  }
  return search;
}

function parseExportRequested(req: AuthRequest): boolean {
  const exportValue = firstQueryValue(req.query.export).toLowerCase();
  if (exportValue && exportValue !== 'csv') {
    throw new HttpError('export must be csv when provided', 400);
  }
  return exportValue === 'csv';
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  const statusCode = Number((error as { statusCode?: unknown } | null)?.statusCode || 500);
  const message = String((error as { message?: unknown } | null)?.message || 'Internal Server Error');
  return new HttpError(message, statusCode >= 400 && statusCode <= 599 ? statusCode : 500);
}

function parseBulkOperation(body: unknown): { isBulkImport: boolean; records: JsonRecord[] } {
  const payload = body && typeof body === 'object' ? (body as JsonRecord) : {};
  const operation = asString(payload.operation).toLowerCase();
  const records = Array.isArray(payload.records)
    ? payload.records.filter((record) => record && typeof record === 'object') as JsonRecord[]
    : [];
  return { isBulkImport: operation === 'bulk_import', records };
}

function splitColumns(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getActiveColumns(entity: MasterEntity): string[] {
  const override = ENTITY_COLUMN_OVERRIDES.get(entity);
  if (override) {
    return Array.from(override);
  }
  return splitColumns(ENTITY_CONFIG[entity].listColumns);
}

function getActiveSearchableColumns(entity: MasterEntity): string[] {
  const override = ENTITY_SEARCH_COLUMN_OVERRIDES.get(entity);
  if (override) {
    return Array.from(override);
  }
  return [...ENTITY_CONFIG[entity].searchableColumns];
}

function getSelectClause(entity: MasterEntity): string {
  const columns = getActiveColumns(entity);
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

function extractJoinedRecord(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) {
    const first = value.find((entry) => Boolean(entry) && typeof entry === 'object');
    return first && typeof first === 'object' ? (first as JsonRecord) : null;
  }
  if (value && typeof value === 'object') {
    return value as JsonRecord;
  }
  return null;
}

function formatAirportLabel(airport: AirportRecord | null, fallback: string): string {
  const name = airport ? asNullableString(airport.name) : null;
  const code = airport ? asNullableString(airport.icao_code) : null;
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return fallback;
}

function enrichFlightLogRows(rows: JsonRecord[]): JsonRecord[] {
  return rows.map((row) => {
    const aircraftId = asNullableString(row.aircraft_id);
    const departureId = asNullableString(row.departure_airport);
    const arrivalId = asNullableString(row.arrival_airport);
    const joinedAircraft = extractJoinedRecord(row.aircraft_ref);
    const joinedDepartureAirport = extractJoinedRecord(row.departure_airport_ref) as AirportRecord | null;
    const joinedArrivalAirport = extractJoinedRecord(row.arrival_airport_ref) as AirportRecord | null;
    const aircraftRegistration =
      asNullableString(joinedAircraft?.registration) || asNullableString(joinedAircraft?.tail_number);
    return {
      ...row,
      aircraft_registration: aircraftRegistration,
      aircraft_label: aircraftRegistration || aircraftId || '',
      aircraft_status: asNullableString(joinedAircraft?.status),
      departure_airport_label: formatAirportLabel(joinedDepartureAirport, departureId || ''),
      arrival_airport_label: formatAirportLabel(joinedArrivalAirport, arrivalId || ''),
    };
  });
}

function markMissingColumn(entity: MasterEntity, rawColumnName: string): boolean {
  const normalized = rawColumnName.replace(/^public\./, '');
  const column = normalized.includes('.') ? normalized.split('.').slice(-1)[0] : normalized;
  if (!column) {
    return false;
  }
  const columns = new Set(getActiveColumns(entity));
  const hadColumn = columns.delete(column);
  if (hadColumn) {
    ENTITY_COLUMN_OVERRIDES.set(entity, columns);
  }
  const searchableColumns = new Set(getActiveSearchableColumns(entity));
  const hadSearchColumn = searchableColumns.delete(column);
  if (hadSearchColumn) {
    ENTITY_SEARCH_COLUMN_OVERRIDES.set(entity, searchableColumns);
  }
  return hadColumn || hadSearchColumn;
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

function resolveSortColumn(entity: MasterEntity, requestedSortBy: string): string {
  const columns = getActiveColumns(entity);
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

function normalizeAircraft(payload: JsonRecord): JsonRecord {
  const tailNumber = asString(payload.tail_number || payload.registration);
  const serialNumber = asString(payload.serial_number || payload.msn);
  const aircraftType = asString(payload.aircraft_type || payload.engine_type);
  const aircraftModel = asString(payload.aircraft_model || payload.model);
  return {
    registration: asString(payload.registration) || tailNumber,
    tail_number: tailNumber,
    serial_number: serialNumber,
    aircraft_type: aircraftType,
    aircraft_model: aircraftModel,
    configuration_code: asNullableString(payload.configuration_code),
    maintenance_program: asNullableString(payload.maintenance_program),
    manufacturer: asNullableString(payload.manufacturer),
    model: asNullableString(payload.model),
    msn: asNullableString(payload.msn),
    line_number: asNullableString(payload.line_number),
    status: asString(payload.status) || 'active',
    operator_code: asNullableString(payload.operator_code),
    station_code: asNullableString(payload.station_code),
    base_location: asNullableString(payload.base_location),
    engine_type: asNullableString(payload.engine_type),
    current_flight_hours: asNumber(payload.current_flight_hours) ?? 0,
    current_cycles: asNumber(payload.current_cycles) ?? 0,
    current_flight_hours_since_new: asNumber(payload.current_flight_hours_since_new) ?? 0,
    current_cycles_since_new: asNumber(payload.current_cycles_since_new) ?? 0,
    engine_install_history: asJsonArray(payload.engine_install_history),
    thrust_rating_change_log: asJsonArray(payload.thrust_rating_change_log),
    on_wing_lifecycle_records: asJsonArray(payload.on_wing_lifecycle_records),
  };
}

function normalizePartsInventory(payload: JsonRecord): JsonRecord {
  return {
    part_number: asString(payload.part_number),
    serial_number: asNullableString(payload.serial_number),
    description: asNullableString(payload.description),
    category: asNullableString(payload.category),
    unit_of_measure: asString(payload.unit_of_measure) || 'EA',
    min_stock_level: asNumber(payload.min_stock_level) ?? 0,
    reorder_level: asNumber(payload.reorder_level) ?? asNumber(payload.min_stock_level) ?? 0,
    reorder_quantity: asNumber(payload.reorder_quantity) ?? 0,
    quantity_on_hand: asNumber(payload.quantity_on_hand) ?? 0,
    quantity_reserved: asNumber(payload.quantity_reserved) ?? 0,
    component_id: asNullableString(payload.component_id),
    supplier_id: asNullableString(payload.supplier_id),
    supplier_name: asNullableString(payload.supplier_name),
    warehouse_location: asString(payload.warehouse_location),
    status: asString(payload.status) || 'available',
    unit_cost: asNumber(payload.unit_cost),
    currency: asString(payload.currency) || 'USD',
    last_movement_at: asNullableString(payload.last_movement_at),
  };
}

function normalizeFlightLog(payload: JsonRecord): JsonRecord {
  return {
    aircraft_id: asString(payload.aircraft_id),
    flight_date: asDateString(payload.flight_date) || '',
    flight_number: asNullableString(payload.flight_number),
    departure_airport: asString(payload.departure_airport),
    arrival_airport: asString(payload.arrival_airport),
    pilot_name: asNullableString(payload.pilot_name),
    flight_hours: asNumber(payload.flight_hours) ?? 0,
    block_hours: asNumber(payload.block_hours) ?? 0,
    flight_cycles: asNumber(payload.flight_cycles) ?? 0,
    crew_details: asNullableString(payload.crew_details),
    fuel_burn_kg: asNumber(payload.fuel_burn_kg) ?? 0,
    oil_uplift_liters: asNumber(payload.oil_uplift_liters) ?? 0,
    pirep_discrepancy: asNullableString(payload.pirep_discrepancy),
    regulatory_authority: asNullableString(payload.regulatory_authority),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeSupplier(payload: JsonRecord): JsonRecord {
  return {
    supplier_code: asString(payload.supplier_code),
    name: asString(payload.name),
    contact_name: asNullableString(payload.contact_name),
    email: asNullableString(payload.email),
    phone: asNullableString(payload.phone),
    lead_time_days: asNumber(payload.lead_time_days),
    rating: asNumber(payload.rating),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeManufacturer(payload: JsonRecord): JsonRecord {
  return {
    manufacturer_code: asString(payload.manufacturer_code),
    name: asString(payload.name),
    country: asNullableString(payload.country),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeAssemblyModel(payload: JsonRecord): JsonRecord {
  return {
    manufacturer_id: asString(payload.manufacturer_id),
    assembly_type_id: asString(payload.assembly_type_id),
    model_code: asString(payload.model_code),
    name: asString(payload.name),
    primary_model: asNullableString(payload.primary_model),
    description: asNullableString(payload.description),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeAtaCode(payload: JsonRecord): JsonRecord {
  return {
    code: asString(payload.code),
    description: asString(payload.description),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeTaskCategory(payload: JsonRecord): JsonRecord {
  return {
    code: asString(payload.code),
    name: asString(payload.name),
    description: asNullableString(payload.description),
    task_category_type: asString(payload.task_category_type),
    is_active: asBoolean(payload.is_active, true),
  };
}

function normalizeMaintenanceFacility(payload: JsonRecord): JsonRecord {
  return {
    facility_code: asString(payload.facility_code),
    name: asString(payload.name),
    facility_type: asString(payload.facility_type),
    station_code: asString(payload.station_code),
    location_city: asNullableString(payload.location_city),
    location_country: asNullableString(payload.location_country),
    timezone: asString(payload.timezone) || 'UTC',
    contact_name: asNullableString(payload.contact_name),
    contact_email: asNullableString(payload.contact_email),
    contact_phone: asNullableString(payload.contact_phone),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeWorkCenter(payload: JsonRecord): JsonRecord {
  return {
    facility_id: asNullableString(payload.facility_id),
    facility_code: asNullableString(payload.facility_code),
    work_center_code: asString(payload.work_center_code),
    name: asString(payload.name),
    center_type: asString(payload.center_type),
    station_code: asString(payload.station_code),
    capacity_hours_per_day: asNumber(payload.capacity_hours_per_day) ?? 8,
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeSkillCode(payload: JsonRecord): JsonRecord {
  return {
    skill_code: asString(payload.skill_code),
    description: asString(payload.description),
    skill_family: asNullableString(payload.skill_family),
    license_authority: asNullableString(payload.license_authority),
    is_certification_required: asBoolean(payload.is_certification_required, false),
    validity_period_months: asNumber(payload.validity_period_months),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeRegulatorProfile(payload: JsonRecord): JsonRecord {
  return {
    regulator_code: asString(payload.regulator_code),
    regulator_name: asString(payload.regulator_name),
    jurisdiction: asString(payload.jurisdiction),
    policy_version: asString(payload.policy_version),
    effective_from: asDateString(payload.effective_from) || new Date().toISOString().slice(0, 10),
    effective_to: asDateString(payload.effective_to),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeShiftCalendar(payload: JsonRecord): JsonRecord {
  return {
    station_code: asString(payload.station_code),
    shift_name: asString(payload.shift_name),
    shift_start_time: asString(payload.shift_start_time),
    shift_end_time: asString(payload.shift_end_time),
    capacity: asNumber(payload.capacity) ?? 1,
    effective_from: asDateString(payload.effective_from) || new Date().toISOString().slice(0, 10),
    effective_to: asDateString(payload.effective_to),
    is_active: asBoolean(payload.is_active, true),
  };
}

function normalizeWorkPackageTemplate(payload: JsonRecord): JsonRecord {
  return {
    assembly_models_id: asString(payload.assembly_models_id),
    template_code: asString(payload.template_code),
    version: asNumber(payload.version),
    active: asBoolean(payload.active, true),
    template_name: asString(payload.template_name),
    maintenance_type: asString(payload.maintenance_type),
    assembly_models: asString(payload.assembly_models),
    scope_json: asJsonArray(payload.scope_json),
    tasks_json: asJsonArray(payload.tasks_json),
    materials_json: asJsonArray(payload.materials_json),
    tooling_json: asJsonArray(payload.tooling_json),
    compliance_requirements_json: asJsonArray(payload.compliance_requirements_json),
    policy_snapshot_id: asNullableString(payload.policy_snapshot_id),
  };
}

function normalizeAircraftTemplate(payload: JsonRecord): JsonRecord {
  return {
    template_name: asString(payload.template_name),
    franchise_id: asNullableString(payload.franchise_id),
    assembly_models: asNullableString(payload.assembly_models),
    maintenance_program: asNullableString(payload.maintenance_program),
    revision_number: asNullableString(payload.revision_number),
    amendment_number: asNullableString(payload.amendment_number),
  };
}

function normalizePayload(entity: MasterEntity, payload: JsonRecord): JsonRecord {
  if (entity === 'aircraft') return normalizeAircraft(payload);
  if (entity === 'aircraft_template') return normalizeAircraftTemplate(payload);
  if (entity === 'flight_logs') return normalizeFlightLog(payload);
  if (entity === 'parts_inventory') return normalizePartsInventory(payload);
  if (entity === 'suppliers') return normalizeSupplier(payload);
  if (entity === 'maintenance_facilities') return normalizeMaintenanceFacility(payload);
  if (entity === 'work_centers') return normalizeWorkCenter(payload);
  if (entity === 'skill_codes') return normalizeSkillCode(payload);
  if (entity === 'manufacturers') return normalizeManufacturer(payload);
  if (entity === 'assembly_models') return normalizeAssemblyModel(payload);
  if (entity === 'ata_codes') return normalizeAtaCode(payload);
  if (entity === 'task_categories') return normalizeTaskCategory(payload);
  if (entity === 'regulator_profiles') return normalizeRegulatorProfile(payload);
  if (entity === 'shift_calendars') return normalizeShiftCalendar(payload);
  return normalizeWorkPackageTemplate(payload);
}

function sanitizeWritePayload(entity: MasterEntity, payload: JsonRecord): JsonRecord {
  const config = ENTITY_CONFIG[entity];
  const normalized = normalizePayload(entity, payload);
  const writePayload: JsonRecord = {};
  for (const field of config.writeAllowedFields) {
    if (normalized[field] !== undefined) {
      writePayload[field] = normalized[field];
    }
  }
  for (const requiredField of config.requiredCreateFields) {
    if (!asString(writePayload[requiredField])) {
      throw new HttpError(`${requiredField} is required`, 400);
    }
  }
  return writePayload;
}

async function loadAssemblyReferenceRecords(
  supabase: SupabaseClient,
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

function validateReferenceFranchise(record: AssemblyReferenceRecord, franchiseId: string | null): boolean {
  if (!franchiseId) return true;
  if (!record.franchise_id) return true;
  return record.franchise_id === franchiseId;
}

async function validateAssemblyModelReferences(
  supabase: SupabaseClient,
  tenantId: string,
  franchiseId: string | null,
  records: JsonRecord[],
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

function formatManufacturerLabel(name: string | null, code: string | null, fallback: string): string {
  if (name && code) return `${name} (${code})`;
  return name || code || fallback;
}

async function hydrateAircraftPayload(
  supabase: SupabaseClient,
  tenantId: string,
  franchiseId: string | null,
  payload: JsonRecord,
): Promise<JsonRecord> {
  const manufacturerId = asNullableString(payload.manufacturer_id);
  const manufacturer = asNullableString(payload.manufacturer);
  const aircraftModel = asNullableString(payload.aircraft_model);
  const model = asNullableString(payload.model);
  const enriched: JsonRecord = { ...payload };

  if (!model && aircraftModel) {
    enriched.model = aircraftModel;
  }

  if (!manufacturer && manufacturerId) {
    let query = supabase
      .from('manufacturers')
      .select('name,manufacturer_code,franchise_id')
      .eq('tenant_id', tenantId)
      .eq('id', manufacturerId);
    if (franchiseId) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    const { data } = await query.maybeSingle();
    const record = (data || null) as JsonRecord | null;
    const name = asNullableString(record?.name);
    const code = asNullableString(record?.manufacturer_code);
    enriched.manufacturer = formatManufacturerLabel(name, code, manufacturerId);
  }

  return enriched;
}

function buildCsv(rows: JsonRecord[]): string {
  if (!rows.length) return '';
  const headers = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row).forEach((key) => acc.add(key));
      return acc;
    }, new Set<string>()),
  );
  const escapeCsv = (value: unknown) => {
    const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(','));
  }
  return lines.join('\n');
}

function extractFranchiseId(req: AuthRequest): string | null {
  const headerValue = req.headers['x-franchise-id'];
  if (typeof headerValue === 'string') {
    const normalized = headerValue.trim();
    return normalized || null;
  }
  if (Array.isArray(headerValue)) {
    const normalized = String(headerValue[0] || '').trim();
    return normalized || null;
  }
  return null;
}

async function writeAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  entity: MasterEntity;
  action: 'create' | 'update' | 'delete' | 'bulk_import';
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const payload = {
      tenant_id: params.tenantId,
      franchise_id: params.franchiseId,
      event_type: `amro.master_data.${params.entity}.${params.action}`,
      title: `AMRO master data ${params.action}`,
      description: `${params.entity} ${params.action}`,
      performed_by: params.userId,
      data: {
        entity: params.entity,
        action: params.action,
        entity_id: params.entityId || null,
        before: params.beforeData ?? null,
        after: params.afterData ?? null,
      },
      metadata: {
        source: 'api.v2.amro.master-data',
      },
    };
    const { error } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: `master-data.${params.entity}.audit.${params.action}`,
      },
      async () => await supabase.from('maintenance_events').insert(payload),
    );
    if (error) {
      logger.warn('[AMRO Master Data] audit insert failed', {
        entity: params.entity,
        action: params.action,
        message: String(error.message || ''),
      });
    }
  } catch (error) {
    logger.warn('[AMRO Master Data] audit insert exception', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidValue(value: string): boolean {
  return UUID_REGEX.test(value);
}

function matchesSearch(row: JsonRecord, searchableColumns: string[], search: string): boolean {
  if (!search) return true;
  const searchLower = search.toLowerCase();
  if (isUuidValue(searchLower)) {
    const rowId = String(row.id || '').toLowerCase();
    if (rowId === searchLower) {
      return true;
    }
  }
  return searchableColumns.some((column) => {
    const value = row[column];
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(searchLower);
  });
}

const router = Router();

router.get(
  '/amro/master-data/:entity',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const correlationId = req.header('x-request-id') || crypto.randomUUID();
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId });
      return;
    }
    if (!req.tenantId) {
      throw new HttpError('Missing tenant context', 401);
    }
    const entity = resolveEntity(req.params.entity);
    const entityConfig = ENTITY_CONFIG[entity];
    const search = parseSearch(req);
    const exportRequested = parseExportRequested(req);
    const { page, pageSize, start, end } = parsePagination(req);
    const { sortBy, ascending } = parseSort(req, entity);
    const franchiseId = extractFranchiseId(req);
    const queryFranchiseId = String(req.query.franchise_id || req.query.franchiseId || '').trim();
    const queryManufacturerId = String(req.query.manufacturer_id || req.query.manufacturerId || '').trim();
    const queryTaskCategoryType = String(req.query.task_category_type || req.query.taskCategoryType || '').trim();
    const queryTaskCategoryActive = String(req.query.is_active || req.query.isActive || '').trim().toLowerCase();
    const tenantFilter = String(req.query.tenant_id || req.query.tenantId || '').trim();
    if (tenantFilter && tenantFilter !== String(req.tenantId || '').trim()) {
      throw new HttpError('tenant_id filter must match current tenant context', 403);
    }
    const supabase = getSupabaseAdminClient();

    let finalData: unknown[] = [];
    let finalCount = 0;
    let currentSortBy = resolveSortColumn(entity, sortBy);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const selectClause = getSelectClause(entity);
      const searchableColumns = getActiveSearchableColumns(entity);
      let query = supabase
        .from(entityConfig.table)
        .select(selectClause, { count: 'exact' })
        .order(currentSortBy, { ascending })
        .range(start, end);

      query = query.eq('tenant_id', req.tenantId);

      if (franchiseId && entity !== 'manufacturers' && entity !== 'assembly_models') {
        query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
      }
      if (entity === 'assembly_models') {
        const effectiveFranchiseId = queryFranchiseId || franchiseId || '';
        if (effectiveFranchiseId) {
          query = query.or(`franchise_id.is.null,franchise_id.eq.${effectiveFranchiseId}`);
        }
        if (queryManufacturerId) {
          query = query.eq('manufacturer_id', queryManufacturerId);
        }
      }
      if (entity === 'task_categories') {
        query = query.eq('task_category_type', queryTaskCategoryType || 'Inspection');
        if (queryTaskCategoryActive) {
          query = query.eq('is_active', queryTaskCategoryActive === 'true');
        } else {
          query = query.eq('is_active', true);
        }
      }
      if (search && !franchiseId && searchableColumns.length) {
        const trimmedSearch = search.trim();
        const isUuidSearch = isUuidValue(trimmedSearch);
        if (isUuidSearch && searchableColumns.includes('id')) {
          query = query.eq('id', trimmedSearch);
        } else {
          const ilikeColumns = searchableColumns.filter((column) => column !== 'id');
          if (ilikeColumns.length) {
            const clauses = ilikeColumns.map((column) => `${column}.ilike.%${trimmedSearch}%`);
            query = query.or(clauses.join(','));
          }
        }
      }

      const { data, count, error } = await executeWithResilience(
        {
          dependency: 'supabase',
          operation: `master-data.${entity}.list`,
          requestId: correlationId,
          tenantId: req.tenantId,
        },
        async () => await query,
      );
      if (!error) {
        finalData = Array.isArray(data) ? data : [];
        finalCount = count || 0;
        break;
      }

      const errorMessage = String(error.message || '');
      if (isMissingTableError(errorMessage)) {
        finalData = [];
        finalCount = 0;
        break;
      }

      const missingColumn = extractMissingColumn(errorMessage);
      if (missingColumn && markMissingColumn(entity, missingColumn)) {
        currentSortBy = resolveSortColumn(entity, currentSortBy);
        continue;
      }

      throw toHttpError(error);
    }
    const rawRows = Array.isArray(finalData) ? (finalData as unknown as JsonRecord[]) : [];
    const enrichedRows = entity === 'flight_logs' ? enrichFlightLogRows(rawRows) : rawRows;
    const activeSearchableColumns = getActiveSearchableColumns(entity);
    const rows = franchiseId && search ? enrichedRows.filter((row) => matchesSearch(row, activeSearchableColumns, search)) : enrichedRows;

    if (exportRequested) {
      const csv = buildCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="amro-${entity}.csv"`);
      res.status(200).end(csv);
      return;
    }

    res.status(200).json({
      version: 'v2',
      correlationId,
      output: {
        entity,
        records: rows,
        page,
        page_size: pageSize,
        total: finalCount || rows.length,
      },
    });
  }),
);

router.post(
  '/amro/master-data/:entity',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const correlationId = req.header('x-request-id') || crypto.randomUUID();
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId });
      return;
    }
     logger.info('[AMRO Master Data] POST Method received for entity', {
      correlationId,
      entity: req.params.entity,
    });
    if (!req.tenantId || !req.userId) {
      throw new HttpError('Missing tenant or user context', 401);
    }
    const entity = resolveEntity(req.params.entity);
    const entityConfig = ENTITY_CONFIG[entity];
    const body = req.body && typeof req.body === 'object' ? (req.body as JsonRecord) : {};
    const { isBulkImport, records } = parseBulkOperation(body);
    const franchiseId = extractFranchiseId(req);
    const supabase = getSupabaseAdminClient();
    const scopePayload = { tenant_id: req.tenantId, franchise_id: franchiseId };
   logger.info('[AMRO Master Data] POST Method received for entity002', {
      correlationId,
      entity: req.params.entity,
    });
    if (isBulkImport) {
      if (!records.length) {
        throw new HttpError('records are required for bulk import', 400);
      }
      if (records.length > 500) {
        throw new HttpError('bulk import supports up to 500 records per request', 400);
      }
      const prepared = records.map((record) => ({
        ...sanitizeWritePayload(entity, record),
        ...scopePayload,
        updated_by: req.userId,
      }));
      if (entity === 'assembly_models') {
        const issues = await validateAssemblyModelReferences(supabase, req.tenantId, franchiseId, prepared);
        if (issues.size > 0) {
          throw new HttpError('Invalid assembly model references', 422);
        }
      }
      const { data, error } = await executeWithResilience(
        {
          dependency: 'supabase',
          operation: `master-data.${entity}.bulk_import`,
          requestId: correlationId,
          tenantId: req.tenantId,
        },
        async () => await supabase.from(entityConfig.table).insert(prepared).select(entityConfig.listColumns),
      );
      if (error) {
        throw new HttpError(error.message, 400);
      }
      await writeAuditRecord({
        tenantId: req.tenantId,
        franchiseId,
        userId: req.userId,
        entity,
        action: 'bulk_import',
        afterData: { count: prepared.length },
      });
      res.status(200).json({
        version: 'v2',
        correlationId,
        output: {
          entity,
          imported_count: prepared.length,
          records: data || [],
        },
      });
      return;
    }
    logger.debug('[CREATE WORK PACKAGE TEMPLATE TASK STEP -001] ', {function: 'insertPayload'});
    
    // DEBUG: Log what we received
    if (entity === 'work_package_templates') {
      logger.info('[WPT DEBUG] Received body keys:', Object.keys(body));
      logger.info('[WPT DEBUG] materials_json present:', 'materials_json' in body);
      logger.info('[WPT DEBUG] materials_json value:', body.materials_json);
      logger.info('[WPT DEBUG] tooling_json present:', 'tooling_json' in body);
      logger.info('[WPT DEBUG] tooling_json value:', body.tooling_json);
      logger.info('[WPT DEBUG] compliance_requirements_json present:', 'compliance_requirements_json' in body);
      logger.info('[WPT DEBUG] compliance_requirements_json value:', body.compliance_requirements_json);
    }
    
    const hydratedBody = entity === 'aircraft' ? await hydrateAircraftPayload(supabase, req.tenantId, franchiseId, body) : body;
    const payload = sanitizeWritePayload(entity, hydratedBody);
    
    // DEBUG: Log what passed through sanitization
    if (entity === 'work_package_templates') {
      logger.info('[WPT DEBUG] After sanitizeWritePayload keys:', Object.keys(payload));
      logger.info('[WPT DEBUG] payload.materials_json:', payload.materials_json);
      logger.info('[WPT DEBUG] payload.tooling_json:', payload.tooling_json);
      logger.info('[WPT DEBUG] payload.compliance_requirements_json:', payload.compliance_requirements_json);
    }
    if (entity === 'assembly_models') {
      const issues = await validateAssemblyModelReferences(supabase, req.tenantId, franchiseId, [payload]);
      if (issues.size > 0) {
        throw new HttpError('Invalid assembly model references', 422);
      }
    }
    const insertPayload = {
      ...payload,
      ...scopePayload,
      created_by: req.userId,
      updated_by: req.userId,
    };
    const { data, error } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: `master-data.${entity}.create`,
        requestId: correlationId,
        tenantId: req.tenantId,
      },
      async () =>
        await supabase
          .from(entityConfig.table)
          .insert(insertPayload)
          .select(entityConfig.listColumns)
          .maybeSingle(),
    );
    if (error) {
      throw new HttpError(error.message, 400);
    }
    const createdRecord = (data || null) as JsonRecord | null;
    await writeAuditRecord({
      tenantId: req.tenantId,
      franchiseId,
      userId: req.userId,
      entity,
      action: 'create',
      entityId: String(createdRecord?.id || ''),
      afterData: createdRecord,
    });
    res.status(201).json({
      version: 'v2',
      correlationId,
      output: {
        entity,
        record: createdRecord,
      },
    });
  }),
);

router.get(
  '/amro/master-data/:entity/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const correlationId = req.header('x-request-id') || crypto.randomUUID();
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId });
      return;
    }
    if (!req.tenantId) {
      throw new HttpError('Missing tenant context', 401);
    }
    const entity = resolveEntity(req.params.entity);
    const id = asString(req.params.id);
    if (!id) {
      throw new HttpError('id is required', 400);
    }
    const franchiseId = extractFranchiseId(req);
    const entityConfig = ENTITY_CONFIG[entity];
    const supabase = getSupabaseAdminClient();
    const { data, error } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: `master-data.${entity}.get`,
        requestId: correlationId,
        tenantId: req.tenantId,
      },
      async () => {
        return await supabase
          .from(entityConfig.table)
          .select(entityConfig.listColumns)
          .eq('id', id)
          .eq('tenant_id', req.tenantId)
          .limit(1)
          .maybeSingle();
      },
    );
    if (error) {
      throw new HttpError(error.message, 400);
    }
    if (!data) {
      throw new HttpError('Record not found', 404);
    }
    const record = data as unknown as JsonRecord;
    const recordFranchise = asString(record.franchise_id);
    if (franchiseId && recordFranchise && recordFranchise !== franchiseId) {
      throw new HttpError('Forbidden', 403);
    }
    res.status(200).json({
      version: 'v2',
      correlationId,
      output: {
        entity,
        record,
      },
    });
  }),
);

router.patch(
  '/amro/master-data/:entity/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const correlationId = req.header('x-request-id') || crypto.randomUUID();
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId });
      return;
    }
    if (!req.tenantId || !req.userId) {
      throw new HttpError('Missing tenant or user context', 401);
    }
    const entity = resolveEntity(req.params.entity);
    const id = asString(req.params.id);
    if (!id) {
      throw new HttpError('id is required', 400);
    }
    const franchiseId = extractFranchiseId(req);
    const entityConfig = ENTITY_CONFIG[entity];
    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: `master-data.${entity}.update.load`,
        requestId: correlationId,
        tenantId: req.tenantId,
      },
      async () => {
        return await supabase
          .from(entityConfig.table)
          .select(entityConfig.listColumns)
          .eq('id', id)
          .eq('tenant_id', req.tenantId)
          .limit(1)
          .maybeSingle();
      },
    );
    if (existingError) {
      throw new HttpError(existingError.message, 400);
    }
    if (!existing) {
      throw new HttpError('Record not found', 404);
    }
    const existingRecord = existing as unknown as JsonRecord;
    const existingFranchise = asString(existingRecord.franchise_id);
    if (franchiseId && existingFranchise && existingFranchise !== franchiseId) {
      throw new HttpError('Forbidden', 403);
    }
    const payload = req.body && typeof req.body === 'object' ? (req.body as JsonRecord) : {};
    const updatePayload: JsonRecord = {
      ...sanitizeWritePayload(entity, payload),
      updated_by: req.userId,
    };
    if (entity === 'assembly_models') {
      const existingManufacturerId = asNullableString(existingRecord.manufacturer_id);
      const existingAssemblyTypeId = asNullableString(existingRecord.assembly_type_id);
      const effectiveManufacturerId = asNullableString(updatePayload.manufacturer_id) || existingManufacturerId;
      const effectiveAssemblyTypeId = asNullableString(updatePayload.assembly_type_id) || existingAssemblyTypeId;
      const issues = await validateAssemblyModelReferences(supabase, req.tenantId, franchiseId, [
        { manufacturer_id: effectiveManufacturerId, assembly_type_id: effectiveAssemblyTypeId },
      ]);
      if (issues.size > 0) {
        throw new HttpError('Invalid assembly model references', 422);
      }
    }
    const { data, error } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: `master-data.${entity}.update`,
        requestId: correlationId,
        tenantId: req.tenantId,
      },
      async () => {
        return await supabase
          .from(entityConfig.table)
          .update(updatePayload)
          .eq('id', id)
          .eq('tenant_id', req.tenantId)
          .select(entityConfig.listColumns)
          .limit(1)
          .maybeSingle();
      },
    );
    if (error) {
      throw new HttpError(error.message, 400);
    }
    await writeAuditRecord({
      tenantId: req.tenantId,
      franchiseId,
      userId: req.userId,
      entity,
      action: 'update',
      entityId: id,
      beforeData: existingRecord,
      afterData: data,
    });
    res.status(200).json({
      version: 'v2',
      correlationId,
      output: {
        entity,
        record: data || null,
      },
    });
  }),
);

router.delete(
  '/amro/master-data/:entity/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const correlationId = req.header('x-request-id') || crypto.randomUUID();
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId });
      return;
    }
    if (!req.tenantId || !req.userId) {
      throw new HttpError('Missing tenant or user context', 401);
    }
    const entity = resolveEntity(req.params.entity);
    const id = asString(req.params.id);
    if (!id) {
      throw new HttpError('id is required', 400);
    }
    const franchiseId = extractFranchiseId(req);
    const entityConfig = ENTITY_CONFIG[entity];
    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: `master-data.${entity}.delete.load`,
        requestId: correlationId,
        tenantId: req.tenantId,
      },
      async () =>
        await supabase
          .from(entityConfig.table)
          .select(entityConfig.listColumns)
          .eq('id', id)
          .eq('tenant_id', req.tenantId)
          .limit(1)
          .maybeSingle(),
    );
    if (existingError) {
      throw new HttpError(existingError.message, 400);
    }
    if (!existing) {
      throw new HttpError('Record not found', 404);
    }
    const existingRecord = existing as unknown as JsonRecord;
    const existingFranchise = asString(existingRecord.franchise_id);
    if (franchiseId && existingFranchise && existingFranchise !== franchiseId) {
      throw new HttpError('Forbidden', 403);
    }
    const { error } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: `master-data.${entity}.delete`,
        requestId: correlationId,
        tenantId: req.tenantId,
      },
      async () =>
        await supabase
          .from(entityConfig.table)
          .delete()
          .eq('id', id)
          .eq('tenant_id', req.tenantId),
    );
    if (error) {
      throw new HttpError(error.message, 400);
    }
    await writeAuditRecord({
      tenantId: req.tenantId,
      franchiseId,
      userId: req.userId,
      entity,
      action: 'delete',
      entityId: id,
      beforeData: existingRecord,
    });
    res.status(200).json({
      version: 'v2',
      correlationId,
      output: {
        entity,
        deleted_id: id,
      },
    });
  }),
);

router.use((error: unknown, req: AuthRequest, res: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
  const correlationId = req.header('x-request-id') || crypto.randomUUID();
  const resolved = toHttpError(error);
  logger.error('[AMRO Master Data] request failed', {
    correlationId,
    method: req.method,
    path: req.path,
    statusCode: resolved.statusCode,
    message: resolved.message,
  });
  res.status(resolved.statusCode).json({
    error: resolved.message,
    version: 'v2',
    correlationId,
  });
});

export default router;
