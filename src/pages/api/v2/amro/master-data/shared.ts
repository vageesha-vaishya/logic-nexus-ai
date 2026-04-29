import { logger } from '@/lib/logger';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

export type AmroMasterDataEntity =
  | 'aircraft'
  | 'aircraft_template'
  | 'ata_codes'
  | 'flight_logs'
  | 'parts_inventory'
  | 'suppliers'
  | 'maintenance_facilities'
  | 'work_centers'
  | 'skill_codes'
  | 'manufacturers'
  | 'assembly_types'
  | 'assembly_models'
  | 'regulator_profiles'
  | 'shift_calendars'
  | 'work_order_templates';

type EntityConfig = {
  table: string;
  searchableColumns: string[];
  listColumns: string;
  requiredCreateFields: string[];
  writeAllowedFields: string[];
  defaultSortColumn: string;
};

const AIRCRAFT_ALLOWED_STATUSES = new Set(['active', 'maintenance', 'grounded', 'retired', 'storage']);
const AIRCRAFT_STATUS_ALIASES: Record<string, string> = {
  inactive: 'retired',
};

export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const ENTITY_CONFIG: Record<AmroMasterDataEntity, EntityConfig> = {
  aircraft: {
    table: 'aircraft',
    searchableColumns: [
      'tail_number',
      'registration',
      'serial_number',
      'assembly_models',
      'msn',
      'owner_name',
      'base_location',
      'restrictions',
    ],
    listColumns:
      'id,tenant_id,franchise_id,aircraft_template_id,registration,tail_number,serial_number,assembly_models,msn,line_number,configuration_code,maintenance_program,status,operator_code,station_code,engine_type,manufacturing_date,base_location,owner_name,warranty_json,defect_count,first_limit_remaining,restrictions,current_flight_hours,current_cycles,current_flight_hours_since_new,current_cycles_since_new,engine_install_history,thrust_rating_change_log,on_wing_lifecycle_records,created_at,updated_at',
    requiredCreateFields: ['tail_number', 'serial_number'],
    writeAllowedFields: [
      'registration',
      'tail_number',
      'serial_number',
      'aircraft_template_id',
      'assembly_models',
      'configuration_code',
      'maintenance_program',
      'msn',
      'line_number',
      'status',
      'operator_code',
      'station_code',
      'base_location',
      'owner_name',
      'warranty_json',
      'manufacturing_date',
      'defect_count',
      'first_limit_remaining',
      'restrictions',
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
    listColumns: 'id,tenant_id,franchise_id,part_number,serial_number,description,category,unit_of_measure,min_stock_level,reorder_level,reorder_quantity,quantity_on_hand,quantity_reserved,quantity_available,supplier_id,supplier_name,warehouse_location,status,last_movement_at,created_at,updated_at',
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
    writeAllowedFields: [
      'supplier_code',
      'name',
      'contact_name',
      'email',
      'phone',
      'lead_time_days',
      'rating',
      'is_active',
      'metadata',
    ],
    defaultSortColumn: 'updated_at',
  },
  maintenance_facilities: {
    table: 'maintenance_facilities',
    searchableColumns: ['facility_code', 'name', 'station_code', 'facility_type', 'location_city', 'location_country'],
    listColumns: 'id,tenant_id,franchise_id,facility_code,name,facility_type,station_code,location_city,location_country,timezone,is_active,metadata,created_at,updated_at',
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
    listColumns: 'id,tenant_id,franchise_id,facility_id,facility_code,work_center_code,name,center_type,station_code,capacity_hours_per_day,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['work_center_code', 'name', 'center_type', 'station_code'],
    writeAllowedFields: [
      'facility_id',
      'facility_code',
      'work_center_code',
      'name',
      'center_type',
      'station_code',
      'capacity_hours_per_day',
      'is_active',
      'metadata',
    ],
    defaultSortColumn: 'updated_at',
  },
  skill_codes: {
    table: 'skill_codes',
    searchableColumns: ['skill_code', 'description', 'skill_family', 'license_authority'],
    listColumns: 'id,tenant_id,franchise_id,skill_code,description,skill_family,license_authority,is_certification_required,validity_period_months,is_active,metadata,created_at,updated_at',
    requiredCreateFields: ['skill_code', 'description'],
    writeAllowedFields: [
      'skill_code',
      'description',
      'skill_family',
      'license_authority',
      'is_certification_required',
      'validity_period_months',
      'is_active',
      'metadata',
    ],
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
  work_order_templates: {
    table: 'work_order_templates',
    searchableColumns: ['template_code', 'template_name', 'maintenance_type', 'aircraft_model', 'assembly_models_id'],
    listColumns:
      'id,tenant_id,franchise_id,template_code,version,active,template_name,maintenance_type,assembly_models_id,aircraft_model,assembly_models,scope_json,tasks_json,policy_snapshot_id,created_at,updated_at',
    requiredCreateFields: ['template_code', 'version', 'template_name', 'maintenance_type'],
    writeAllowedFields: [
      'template_code',
      'version',
      'active',
      'template_name',
      'maintenance_type',
      'assembly_models_id',
      'aircraft_model',
      'assembly_models',
      'scope_json',
      'tasks_json',
      'policy_snapshot_id',
    ],
    defaultSortColumn: 'updated_at',
  },
  aircraft_template: {
    table: 'aircraft_template',
    searchableColumns: ['template_name', 'maintenance_program'],
    listColumns:
      'id,tenant_id,franchise_id,template_name,assembly_models,maintenance_program,revision_number,amendment_number,model_json,is_active,created_at,updated_at',
    requiredCreateFields: ['template_name'],
    writeAllowedFields: [
      'template_name',
      'franchise_id',
      'assembly_models',
      'maintenance_program',
      'revision_number',
      'amendment_number',
      'model_json',
      'is_active',
    ],
    defaultSortColumn: 'updated_at',
  },
  ata_codes: {
    table: 'ata_codes',
    searchableColumns: ['code', 'description', 'chapter_code', 'parent_code_ref'],
    listColumns:
      'id,tenant_id,franchise_id,code,description,parent_id,level,chapter_code,parent_code_ref,is_active,created_at,updated_at',
    requiredCreateFields: ['code'],
    writeAllowedFields: [
      'franchise_id',
      'code',
      'description',
      'parent_id',
      'level',
      'chapter_code',
      'parent_code_ref',
      'is_active',
    ],
    defaultSortColumn: 'code',
  },
};

function asString(value: unknown): string {
  return String(value || '').trim();
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new HttpError('Invalid numeric value', 400);
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
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
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

function parseTimeToSeconds(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? '0');
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function resolveEntity(rawEntity: unknown): AmroMasterDataEntity {
  const normalizedEntity = asString(rawEntity).toLowerCase().replace(/-/g, '_');
  const entity = (normalizedEntity === 'work_order_templates' ? 'work_order_templates' : normalizedEntity) as AmroMasterDataEntity;
  if (!ENTITY_CONFIG[entity]) {
    throw new HttpError('Unsupported master data entity', 404);
  }
  return entity;
}

export function getEntityConfig(entity: AmroMasterDataEntity): EntityConfig {
  return ENTITY_CONFIG[entity];
}

export function parsePagination(req: ApiRequest): { page: number; pageSize: number; start: number; end: number } {
  const pageRaw = Number(req.query.page || 1);
  const pageSizeRaw = Number(req.query.page_size || req.query.pageSize || 25);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Math.min(200, Math.max(1, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : 25));
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  return { page, pageSize, start, end };
}

export function parseSort(req: ApiRequest, entity: AmroMasterDataEntity): { sortBy: string; ascending: boolean } {
  const config = getEntityConfig(entity);
  const sortBy = asString(req.query.sort_by || req.query.sortBy) || config.defaultSortColumn;
  const ascending = asString(req.query.sort_dir || req.query.sortDir).toLowerCase() === 'asc';
  return { sortBy, ascending };
}

export function parseSearch(req: ApiRequest): string {
  return asString(req.query.search || req.query.q);
}

export function parseExportRequested(req: ApiRequest): boolean {
  return asString(req.query.export).toLowerCase() === 'csv';
}

export function parseBulkOperation(body: unknown): { isBulkImport: boolean; records: Record<string, unknown>[] } {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const operation = asString(payload.operation).toLowerCase();
  const records = Array.isArray(payload.records)
    ? payload.records.filter((record) => record && typeof record === 'object') as Record<string, unknown>[]
    : [];
  return { isBulkImport: operation === 'bulk_import', records };
}

function normalizeAircraft(payload: Record<string, unknown>) {
  const tailNumber = asString(payload.tail_number || payload.registration);
  const serialSource = asString(payload.serial_number || payload.msn);
  const serialToken = serialSource.toUpperCase();
  const requiresSyntheticSerial = !serialSource || serialToken === 'N/A' || serialToken === 'NA' || serialToken === '-';
  const serialFallbackToken = asString(payload.tail_number || payload.registration)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
  const serialNumber = requiresSyntheticSerial
    ? `NSN-${serialFallbackToken || 'UNSPECIFIED'}`
    : serialSource;
  const assemblyModel = asNullableString(payload.assembly_models || payload.assembly_model_id || payload.aircraft_model);
  const normalizedStatusToken = asString(payload.status).toLowerCase();
  const normalizedStatus = AIRCRAFT_STATUS_ALIASES[normalizedStatusToken] || normalizedStatusToken || 'active';
  const hasWarrantyJson = Object.prototype.hasOwnProperty.call(payload, 'warranty_json');
  const rawWarrantyJson = payload.warranty_json;
  if (hasWarrantyJson && rawWarrantyJson !== null && rawWarrantyJson !== undefined && rawWarrantyJson !== '' && (typeof rawWarrantyJson !== 'object' || Array.isArray(rawWarrantyJson))) {
    throw new HttpError('warranty_json must be an object', 400);
  }
  const warrantyJsonRecord = (asJsonObject(rawWarrantyJson) ?? {}) as Record<string, unknown>;
  const normalizedWarranty = {
    is_under_warranty: asBoolean(
      warrantyJsonRecord.is_under_warranty ?? payload.is_under_warranty,
      false,
    ),
    warranty_start_date: asDateString(
      warrantyJsonRecord.warranty_start_date ?? payload.warranty_start_date,
    ),
    warranty_end_date: asDateString(
      warrantyJsonRecord.warranty_end_date ?? payload.warranty_end_date,
    ),
  };
  return {
    registration: asString(payload.registration) || tailNumber,
    tail_number: tailNumber,
    serial_number: serialNumber,
    aircraft_template_id: asNullableString(payload.aircraft_template_id || payload.aircraft_template),
    assembly_models: assemblyModel,
    configuration_code: asNullableString(payload.configuration_code),
    maintenance_program: asNullableString(payload.maintenance_program),
    msn: asNullableString(payload.msn),
    line_number: asNullableString(payload.line_number),
    status: normalizedStatus,
    operator_code: asNullableString(payload.operator_code),
    station_code: asNullableString(payload.station_code),
    base_location: asNullableString(payload.base_location),
    owner_name: asNullableString(payload.owner_name),
    manufacturing_date: asNullableString(payload.manufacturing_date),
    defect_count: asNumber(payload.defect_count) ?? 0,
    first_limit_remaining: asNumber(payload.first_limit_remaining),
    restrictions: asNullableString(payload.restrictions),
    engine_type: asNullableString(payload.engine_type),
    current_flight_hours: asNumber(payload.current_flight_hours) ?? 0,
    current_cycles: asNumber(payload.current_cycles) ?? 0,
    current_flight_hours_since_new: asNumber(payload.current_flight_hours_since_new) ?? 0,
    current_cycles_since_new: asNumber(payload.current_cycles_since_new) ?? 0,
    warranty_json: normalizedWarranty,
    engine_install_history: asJsonArray(payload.engine_install_history),
    thrust_rating_change_log: asJsonArray(payload.thrust_rating_change_log),
    on_wing_lifecycle_records: asJsonArray(payload.on_wing_lifecycle_records),
  };
}

function normalizePartsInventory(payload: Record<string, unknown>) {
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

function normalizeFlightLog(payload: Record<string, unknown>) {
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

function normalizeSupplier(payload: Record<string, unknown>) {
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

function normalizeMaintenanceFacility(payload: Record<string, unknown>) {
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

function normalizeWorkCenter(payload: Record<string, unknown>) {
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

function normalizeSkillCode(payload: Record<string, unknown>) {
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

function normalizeManufacturer(payload: Record<string, unknown>) {
  return {
    manufacturer_code: asString(payload.manufacturer_code),
    name: asString(payload.name),
    country: asNullableString(payload.country),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeAssemblyType(payload: Record<string, unknown>) {
  return {
    assembly_code: asString(payload.assembly_code),
    name: asString(payload.name),
    description: asString(payload.description),
    is_active: asBoolean(payload.is_active, true),
    metadata: asJsonObject(payload.metadata),
  };
}

function normalizeAssemblyModel(payload: Record<string, unknown>) {
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

function normalizeRegulatorProfile(payload: Record<string, unknown>) {
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

function normalizeShiftCalendar(payload: Record<string, unknown>) {
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

function normalizeWorkOrderTemplate(payload: Record<string, unknown>) {
  return {
    template_code: asString(payload.template_code),
    version: asNumber(payload.version),
    active: asBoolean(payload.active, true),
    template_name: asString(payload.template_name),
    maintenance_type: asString(payload.maintenance_type),
    assembly_models_id: asNullableString(payload.assembly_models_id),
    aircraft_model: asNullableString(payload.aircraft_model),
    scope_json: asJsonArray(payload.scope_json),
    tasks_json: asJsonArray(payload.tasks_json),
    policy_snapshot_id: asNullableString(payload.policy_snapshot_id),
  };
}

function normalizeAircraftTemplate(payload: Record<string, unknown>) {
  return {
    template_name: asString(payload.template_name),
    franchise_id: asNullableString(payload.franchise_id),
    assembly_models: asNullableString(payload.assembly_models),
    maintenance_program: asNullableString(payload.maintenance_program),
    revision_number: asNullableString(payload.revision_number),
    amendment_number: asNullableString(payload.amendment_number),
    model_json: asJsonArray(payload.model_json),
    is_active: asBoolean(payload.is_active, true),
  };
}

function normalizeAtaCode(payload: Record<string, unknown>) {
  const chapterCode = asNullableString(payload.chapter_code);
  return {
    franchise_id: asNullableString(payload.franchise_id),
    code: asString(payload.code).toUpperCase(),
    description: asNullableString(payload.description),
    parent_id: asNullableString(payload.parent_id),
    level: asNumber(payload.level),
    chapter_code: chapterCode ? chapterCode.toUpperCase() : null,
    parent_code_ref: asNullableString(payload.parent_code_ref),
    is_active: asBoolean(payload.is_active, true),
  };
}

export function normalizePayload(entity: AmroMasterDataEntity, payload: Record<string, unknown>) {
  if (entity === 'aircraft') return normalizeAircraft(payload);
  if (entity === 'ata_codes') return normalizeAtaCode(payload);
  if (entity === 'flight_logs') return normalizeFlightLog(payload);
  if (entity === 'parts_inventory') return normalizePartsInventory(payload);
  if (entity === 'suppliers') return normalizeSupplier(payload);
  if (entity === 'maintenance_facilities') return normalizeMaintenanceFacility(payload);
  if (entity === 'work_centers') return normalizeWorkCenter(payload);
  if (entity === 'skill_codes') return normalizeSkillCode(payload);
  if (entity === 'manufacturers') return normalizeManufacturer(payload);
  if (entity === 'assembly_types') return normalizeAssemblyType(payload);
  if (entity === 'assembly_models') return normalizeAssemblyModel(payload);
  if (entity === 'regulator_profiles') return normalizeRegulatorProfile(payload);
  if (entity === 'shift_calendars') return normalizeShiftCalendar(payload);
  if (entity === 'aircraft_template') return normalizeAircraftTemplate(payload);
  return normalizeWorkOrderTemplate(payload);
}

export type MasterDataValidationIssue = {
  field: string;
  message: string;
};

export function validatePayload(entity: AmroMasterDataEntity, payload: Record<string, unknown>): MasterDataValidationIssue[] {
  const issues: MasterDataValidationIssue[] = [];
  if (entity === 'ata_codes') {
    const code = asString(payload.code);
    const chapterCode = asNullableString(payload.chapter_code);
    if (code && code.length > 20) {
      issues.push({
        field: 'code',
        message: 'code cannot exceed 20 characters',
      });
    }
    if (chapterCode && chapterCode.length !== 2) {
      issues.push({
        field: 'chapter_code',
        message: 'chapter_code must be exactly 2 characters',
      });
    }
  }
  if (entity === 'aircraft') {
    const manufacturingDate = asNullableString(payload.manufacturing_date);
    if (manufacturingDate && !/^\d{4}-\d{2}-\d{2}$/.test(manufacturingDate)) {
      issues.push({
        field: 'manufacturing_date',
        message: 'manufacturing_date must be in YYYY-MM-DD format',
      });
    }
    const statusRaw = asString(payload.status).toLowerCase();
    const normalizedStatus = AIRCRAFT_STATUS_ALIASES[statusRaw] || statusRaw;
    if (statusRaw && !AIRCRAFT_ALLOWED_STATUSES.has(normalizedStatus)) {
      issues.push({
        field: 'status',
        message: 'status must be one of active, maintenance, grounded, retired, or storage',
      });
    }
    if (payload.defect_count !== undefined) {
      const defectCount = Number(payload.defect_count);
      if (!Number.isInteger(defectCount) || defectCount < 0) {
        issues.push({
          field: 'defect_count',
          message: 'defect_count must be a non-negative integer',
        });
      }
    }
    if (payload.current_cycles !== undefined) {
      const currentCycles = Number(payload.current_cycles);
      if (!Number.isInteger(currentCycles) || currentCycles < 0) {
        issues.push({
          field: 'current_cycles',
          message: 'current_cycles must be a non-negative integer',
        });
      }
    }
    if (payload.current_cycles_since_new !== undefined) {
      const currentCyclesSinceNew = Number(payload.current_cycles_since_new);
      if (!Number.isInteger(currentCyclesSinceNew) || currentCyclesSinceNew < 0) {
        issues.push({
          field: 'current_cycles_since_new',
          message: 'current_cycles_since_new must be a non-negative integer',
        });
      }
    }
    if (payload.current_flight_hours !== undefined) {
      const currentFlightHours = Number(payload.current_flight_hours);
      if (!Number.isFinite(currentFlightHours) || currentFlightHours < 0) {
        issues.push({
          field: 'current_flight_hours',
          message: 'current_flight_hours must be a non-negative number',
        });
      }
    }
    if (payload.current_flight_hours_since_new !== undefined) {
      const currentFlightHoursSinceNew = Number(payload.current_flight_hours_since_new);
      if (!Number.isFinite(currentFlightHoursSinceNew) || currentFlightHoursSinceNew < 0) {
        issues.push({
          field: 'current_flight_hours_since_new',
          message: 'current_flight_hours_since_new must be a non-negative number',
        });
      }
    }
  }
  if (entity === 'flight_logs') {
    const departureAirport = asString(payload.departure_airport);
    const arrivalAirport = asString(payload.arrival_airport);
    const flightHours = Number(payload.flight_hours ?? 0);
    const blockHours = Number(payload.block_hours ?? 0);
    const flightCycles = Number(payload.flight_cycles ?? 0);
    if (departureAirport && arrivalAirport && departureAirport === arrivalAirport) {
      issues.push({
        field: 'arrival_airport',
        message: 'arrival_airport must be different from departure_airport',
      });
    }
    if (flightHours < 0 || !Number.isFinite(flightHours)) {
      issues.push({
        field: 'flight_hours',
        message: 'flight_hours must be a non-negative number',
      });
    }
    if (blockHours < 0 || !Number.isFinite(blockHours)) {
      issues.push({
        field: 'block_hours',
        message: 'block_hours must be a non-negative number',
      });
    }
    if (!Number.isInteger(flightCycles) || flightCycles < 0) {
      issues.push({
        field: 'flight_cycles',
        message: 'flight_cycles must be a non-negative integer',
      });
    }
    if (flightHours <= 0 && blockHours <= 0 && flightCycles <= 0) {
      issues.push({
        field: 'flight_hours',
        message: 'at least one of flight_hours, block_hours, or flight_cycles must be greater than zero',
      });
    }
  }
  if (entity === 'parts_inventory') {
    const quantityOnHand = Number(payload.quantity_on_hand ?? 0);
    const quantityReserved = Number(payload.quantity_reserved ?? 0);
    if (quantityReserved > quantityOnHand) {
      issues.push({
        field: 'quantity_reserved',
        message: 'quantity_reserved cannot exceed quantity_on_hand',
      });
    }
  }
  if (entity === 'work_centers') {
    const capacity = Number(payload.capacity_hours_per_day ?? 0);
    if (!(capacity > 0)) {
      issues.push({
        field: 'capacity_hours_per_day',
        message: 'capacity_hours_per_day must be greater than zero',
      });
    }
  }
  if (entity === 'skill_codes') {
    const validityPeriod = payload.validity_period_months;
    if (validityPeriod !== null && validityPeriod !== undefined && Number(validityPeriod) <= 0) {
      issues.push({
        field: 'validity_period_months',
        message: 'validity_period_months must be greater than zero when provided',
      });
    }
  }
  if (entity === 'regulator_profiles' || entity === 'shift_calendars') {
    const effectiveFrom = asNullableString(payload.effective_from);
    const effectiveTo = asNullableString(payload.effective_to);
    if (effectiveFrom && effectiveTo && Date.parse(effectiveTo) < Date.parse(effectiveFrom)) {
      issues.push({
        field: 'effective_to',
        message: 'effective_to must be greater than or equal to effective_from',
      });
    }
  }
  if (entity === 'shift_calendars') {
    const capacity = Number(payload.capacity ?? 0);
    if (!(capacity > 0)) {
      issues.push({
        field: 'capacity',
        message: 'capacity must be greater than zero',
      });
    }
    const shiftStart = parseTimeToSeconds(asNullableString(payload.shift_start_time));
    const shiftEnd = parseTimeToSeconds(asNullableString(payload.shift_end_time));
    if (payload.shift_start_time && shiftStart === null) {
      issues.push({
        field: 'shift_start_time',
        message: 'Shift Start must be in HH:mm or HH:mm:ss format',
      });
    }
    if (payload.shift_end_time && shiftEnd === null) {
      issues.push({
        field: 'shift_end_time',
        message: 'Shift End must be in HH:mm or HH:mm:ss format',
      });
    }
    if (shiftStart !== null && shiftEnd !== null && shiftEnd <= shiftStart) {
      issues.push({
        field: 'shift_end_time',
        message: 'Shift End must be after Shift Start',
      });
    }
  }
  if (entity === 'work_order_templates') {
    const version = Number(payload.version ?? 0);
    if (!(version > 0)) {
      issues.push({
        field: 'version',
        message: 'version must be greater than zero',
      });
    }
    const modelId = asNullableString(payload.assembly_models_id);
    if (modelId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(modelId)) {
      issues.push({
        field: 'assembly_models_id',
        message: 'assembly_models_id must be a valid UUID',
      });
    }
    if (!Array.isArray(payload.scope_json)) {
      issues.push({
        field: 'scope_json',
        message: 'scope_json must be an array',
      });
    }
    if (!Array.isArray(payload.tasks_json)) {
      issues.push({
        field: 'tasks_json',
        message: 'tasks_json must be an array',
      });
    }
  }
  return issues;
}

export function sanitizeWritePayload(
  entity: AmroMasterDataEntity,
  payload: Record<string, unknown>,
  options: { requireCreateFields?: boolean; includeOnlyProvidedFields?: boolean } = {},
): Record<string, unknown> {
  const requireCreateFields = options.requireCreateFields ?? true;
  const includeOnlyProvidedFields = options.includeOnlyProvidedFields ?? false;
  const config = getEntityConfig(entity);
  const normalized = normalizePayload(entity, payload) as Record<string, unknown>;
  const writePayload: Record<string, unknown> = {};
  const providedKeys = new Set(Object.keys(payload));
  const shouldIncludeField = (field: string): boolean => {
    if (!includeOnlyProvidedFields) return true;
    if (!providedKeys.size) return false;
    if (providedKeys.has(field)) return true;
    if (entity === 'aircraft') {
      if ((field === 'registration' || field === 'tail_number') && (providedKeys.has('registration') || providedKeys.has('tail_number'))) {
        return true;
      }
      if ((field === 'serial_number' || field === 'msn') && (providedKeys.has('serial_number') || providedKeys.has('msn'))) {
        return true;
      }
      if (field === 'aircraft_template_id' && (providedKeys.has('aircraft_template_id') || providedKeys.has('aircraft_template'))) {
        return true;
      }
      if (field === 'assembly_models' && (providedKeys.has('assembly_models') || providedKeys.has('assembly_model_id') || providedKeys.has('aircraft_model') || providedKeys.has('model'))){
        return true;
      }
    }
    return false;
  };
  for (const field of config.writeAllowedFields) {
    if (!shouldIncludeField(field)) {
      continue;
    }
    if (normalized[field] !== undefined) {
      writePayload[field] = normalized[field];
    }
  }
  if (requireCreateFields) {
    for (const requiredField of config.requiredCreateFields) {
      const value = asString(writePayload[requiredField]);
      if (!value) {
        throw new HttpError(`${requiredField} is required`, 400);
      }
    }
  }
  return writePayload;
}

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureAtaFranchiseExists(
  supabase: SupabaseAdminClient,
  tenantId: string,
  franchiseId: string | null,
): Promise<void> {
  if (!franchiseId) return;
  if (!isUuid(franchiseId)) {
    throw new HttpError('franchise_id must be a valid UUID', 422);
  }
  const { data, error } = await supabase
    .from('franchises')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', franchiseId)
    .maybeSingle();
  if (error) {
    throw new HttpError(error.message, 400);
  }
  if (!data) {
    throw new HttpError('franchise_id does not exist in current tenant scope', 422);
  }
}

export async function ensureAtaCodeUnique(
  supabase: SupabaseAdminClient,
  tenantId: string,
  code: string,
  excludeId?: string | null,
): Promise<void> {
  const normalizedCode = asString(code).toUpperCase();
  if (!normalizedCode) return;
  let query = supabase
    .from('ata_codes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('code', normalizedCode)
    .limit(1);
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new HttpError(error.message, 400);
  }
  if (data) {
    throw new HttpError('ATA code already exists for this tenant', 409);
  }
}

export async function resolveAtaHierarchyContext(
  supabase: SupabaseAdminClient,
  tenantId: string,
  franchiseId: string | null,
  parentId: string | null,
): Promise<{ level: number; parentCodeRef: string | null }> {
  if (!parentId) {
    return { level: 1, parentCodeRef: null };
  }
  if (!isUuid(parentId)) {
    throw new HttpError('parent_id must be a valid UUID', 422);
  }
  const { data, error } = await supabase
    .from('ata_codes')
    .select('id,franchise_id,level,code,is_active')
    .eq('tenant_id', tenantId)
    .eq('id', parentId)
    .maybeSingle();
  if (error) {
    throw new HttpError(error.message, 400);
  }
  if (!data) {
    throw new HttpError('parent_id does not exist in current tenant scope', 422);
  }
  const parentFranchiseId = asNullableString((data as Record<string, unknown>).franchise_id);
  if (franchiseId && parentFranchiseId && parentFranchiseId !== franchiseId) {
    throw new HttpError('parent_id must belong to current franchise scope', 422);
  }
  if ((data as Record<string, unknown>).is_active === false) {
    throw new HttpError('parent_id must reference an active ATA code', 422);
  }
  const parentLevel = Number((data as Record<string, unknown>).level ?? 0);
  return {
    level: Number.isFinite(parentLevel) ? parentLevel + 1 : 1,
    parentCodeRef: asNullableString((data as Record<string, unknown>).code),
  };
}

export async function ensureNoAtaCircularReference(
  supabase: SupabaseAdminClient,
  tenantId: string,
  recordId: string,
  parentId: string | null,
): Promise<void> {
  if (!parentId) return;
  if (recordId === parentId) {
    throw new HttpError('parent_id cannot reference the same ATA code', 422);
  }
  const visited = new Set<string>([recordId]);
  let cursor: string | null = parentId;
  let hopCount = 0;
  while (cursor && hopCount < 64) {
    if (visited.has(cursor)) {
      throw new HttpError('Circular ATA hierarchy is not allowed', 422);
    }
    visited.add(cursor);
    const { data, error } = await supabase
      .from('ata_codes')
      .select('id,parent_id')
      .eq('tenant_id', tenantId)
      .eq('id', cursor)
      .maybeSingle();
    if (error) {
      throw new HttpError(error.message, 400);
    }
    if (!data) {
      throw new HttpError('parent_id does not exist in current tenant scope', 422);
    }
    cursor = asNullableString((data as Record<string, unknown>).parent_id);
    hopCount += 1;
  }
  if (hopCount >= 64) {
    throw new HttpError('ATA hierarchy depth exceeded while validating parent chain', 422);
  }
}

export async function writeAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  entity: AmroMasterDataEntity;
  action: 'create' | 'update' | 'delete' | 'bulk_import';
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
}) {
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
  const { error } = await supabase.from('maintenance_events').insert(payload);
  if (error) {
    logger.warn('[AMRO Master Data] audit insert failed', {
      entity: params.entity,
      action: params.action,
      message: String(error.message || ''),
    });
  }
}

export function buildCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row || {}).forEach((key) => acc.add(key));
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
    lines.push(headers.map((header) => escapeCsv((row as Record<string, unknown>)[header])).join(','));
  }
  return lines.join('\n');
}

export function sendError(res: ApiResponse, error: unknown, correlationId: string) {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.message,
      version: 'v2',
      correlationId,
    });
    return;
  }
  const message = String((error as Error)?.message || 'Internal Server Error');
  const normalized = message.toLowerCase();
  const statusCode = normalized.includes('unauthorized')
    ? 401
    : normalized.includes('forbidden')
      ? 403
      : normalized.includes('rate limit')
        ? 429
        : normalized.includes('https required')
          ? 400
          : normalized.includes('csrf')
            ? 403
            : 500;
  res.status(statusCode).json({
    error: message,
    version: 'v2',
    correlationId,
  });
}
