import { logger } from '@/lib/logger';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

export type AmroMasterDataEntity =
  | 'aircraft'
  | 'parts_inventory'
  | 'suppliers'
  | 'maintenance_facilities'
  | 'work_centers'
  | 'skill_codes';

type EntityConfig = {
  table: string;
  searchableColumns: string[];
  listColumns: string;
  requiredCreateFields: string[];
  writeAllowedFields: string[];
  defaultSortColumn: string;
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
    searchableColumns: ['tail_number', 'registration', 'serial_number', 'aircraft_type', 'aircraft_model', 'msn'],
    listColumns: 'id,tenant_id,franchise_id,registration,tail_number,serial_number,aircraft_type,aircraft_model,configuration_code,maintenance_program,status,created_at,updated_at',
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
    ],
    defaultSortColumn: 'updated_at',
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

export function resolveEntity(rawEntity: unknown): AmroMasterDataEntity {
  const entity = asString(rawEntity).toLowerCase() as AmroMasterDataEntity;
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

export function normalizePayload(entity: AmroMasterDataEntity, payload: Record<string, unknown>) {
  if (entity === 'aircraft') return normalizeAircraft(payload);
  if (entity === 'parts_inventory') return normalizePartsInventory(payload);
  if (entity === 'suppliers') return normalizeSupplier(payload);
  if (entity === 'maintenance_facilities') return normalizeMaintenanceFacility(payload);
  if (entity === 'work_centers') return normalizeWorkCenter(payload);
  return normalizeSkillCode(payload);
}

export function sanitizeWritePayload(entity: AmroMasterDataEntity, payload: Record<string, unknown>): Record<string, unknown> {
  const config = getEntityConfig(entity);
  const normalized = normalizePayload(entity, payload) as Record<string, unknown>;
  const writePayload: Record<string, unknown> = {};
  for (const field of config.writeAllowedFields) {
    if (normalized[field] !== undefined) {
      writePayload[field] = normalized[field];
    }
  }
  for (const requiredField of config.requiredCreateFields) {
    const value = asString(writePayload[requiredField]);
    if (!value) {
      throw new HttpError(`${requiredField} is required`, 400);
    }
  }
  return writePayload;
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
  res.status(500).json({
    error: String((error as Error)?.message || 'Internal Server Error'),
    version: 'v2',
    correlationId,
  });
}
