import type { ApiRequest } from '@/pages/api/_utils/types';
import { getSupabaseAdminClient } from '@/pages/api/_utils/supabaseAdmin';

export type ItemMasterLifecycleStatus =
  | 'serviceable'
  | 'inspection_due'
  | 'needs_repair'
  | 'repair_in_progress'
  | 'ready_for_install'
  | 'replaced'
  | 'retired'
  | 'quarantined';

export type ItemMasterStatus = 'active' | 'inactive' | 'deprecated' | 'retired';
export type ItemMasterType = 'part' | 'tool' | 'consumable' | 'kit';

export type ItemMasterTemplateRecord = {
  id?: string;
  partNumber: string;
  description?: string | null;
  itemType?: ItemMasterType;
  category?: string | null;
  subcategory?: string | null;
  status?: ItemMasterStatus;
  lifecycleStatus?: ItemMasterLifecycleStatus;
  specification?: Record<string, unknown>;
  manufacturerName?: string | null;
  manufacturerPartNumber?: string | null;
  oemPartNumber?: string | null;
  unitOfMeasure?: string;
  baseUnitOfMeasure?: string;
  uomConversionFactor?: number;
  currency?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  crossReferences?: Array<{
    referenceType: 'alternate' | 'superseded_by' | 'supersedes' | 'vendor' | 'oem';
    referencePartNumber: string;
    referenceDescription?: string | null;
    isActive?: boolean;
  }>;
  uomConversions?: Array<{
    fromUom: string;
    toUom: string;
    factor: number;
    roundingMode?: 'half_up' | 'up' | 'down';
    isActive?: boolean;
  }>;
};

export type ItemMasterRow = {
  id?: string;
  tenant_id?: string;
  franchise_id?: string | null;
  part_number: string;
  description?: string | null;
  item_type: ItemMasterType;
  category?: string | null;
  subcategory?: string | null;
  status: ItemMasterStatus;
  lifecycle_status: ItemMasterLifecycleStatus;
  specification?: Record<string, unknown>;
  manufacturer_name?: string | null;
  manufacturer_part_number?: string | null;
  oem_part_number?: string | null;
  unit_of_measure: string;
  base_unit_of_measure: string;
  uom_conversion_factor: number;
  currency: string;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type ItemMasterCrossReferenceRow = {
  id?: string;
  reference_type: 'alternate' | 'superseded_by' | 'supersedes' | 'vendor' | 'oem';
  reference_part_number: string;
  reference_description?: string | null;
  is_active: boolean;
};

export type ItemMasterUomConversionRow = {
  id?: string;
  from_uom: string;
  to_uom: string;
  factor: number;
  rounding_mode: 'half_up' | 'up' | 'down';
  is_active: boolean;
};

const PART_NUMBER_PATTERN = /^[A-Z0-9-]{3,64}$/;
const ALLOWED_STATUSES = new Set<ItemMasterStatus>(['active', 'inactive', 'deprecated', 'retired']);
const ALLOWED_ITEM_TYPES = new Set<ItemMasterType>(['part', 'tool', 'consumable', 'kit']);
const ALLOWED_LIFECYCLE = new Set<ItemMasterLifecycleStatus>([
  'serviceable',
  'inspection_due',
  'needs_repair',
  'repair_in_progress',
  'ready_for_install',
  'replaced',
  'retired',
  'quarantined',
]);

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function toNullableText(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toSpecification(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mapTemplateToItemMasterRow(template: ItemMasterTemplateRecord): ItemMasterRow {
  return {
    part_number: normalizeText(template.partNumber).toUpperCase(),
    description: toNullableText(template.description),
    item_type: (normalizeText(template.itemType || 'part').toLowerCase() as ItemMasterType),
    category: toNullableText(template.category),
    subcategory: toNullableText(template.subcategory),
    status: (normalizeText(template.status || 'active').toLowerCase() as ItemMasterStatus),
    lifecycle_status: (normalizeText(template.lifecycleStatus || 'serviceable').toLowerCase() as ItemMasterLifecycleStatus),
    specification: toSpecification(template.specification),
    manufacturer_name: toNullableText(template.manufacturerName),
    manufacturer_part_number: toNullableText(template.manufacturerPartNumber),
    oem_part_number: toNullableText(template.oemPartNumber),
    unit_of_measure: normalizeText(template.unitOfMeasure || 'EA').toUpperCase(),
    base_unit_of_measure: normalizeText(template.baseUnitOfMeasure || 'EA').toUpperCase(),
    uom_conversion_factor: Math.max(0.000001, toFiniteNumber(template.uomConversionFactor, 1)),
    currency: normalizeText(template.currency || 'USD').toUpperCase(),
    is_active: template.isActive !== false,
    metadata: toSpecification(template.metadata),
  };
}

export function mapItemMasterRowToTemplate(row: Record<string, unknown>): ItemMasterTemplateRecord {
  const crossReferencesRaw = Array.isArray(row.cross_references) ? row.cross_references : [];
  const uomConversionsRaw = Array.isArray(row.uom_conversions) ? row.uom_conversions : [];
  return {
    id: normalizeText(row.id),
    partNumber: normalizeText(row.part_number),
    description: toNullableText(row.description),
    itemType: (normalizeText(row.item_type || 'part').toLowerCase() as ItemMasterType),
    category: toNullableText(row.category),
    subcategory: toNullableText(row.subcategory),
    status: (normalizeText(row.status || 'active').toLowerCase() as ItemMasterStatus),
    lifecycleStatus: (normalizeText(row.lifecycle_status || 'serviceable').toLowerCase() as ItemMasterLifecycleStatus),
    specification: toSpecification(row.specification),
    manufacturerName: toNullableText(row.manufacturer_name),
    manufacturerPartNumber: toNullableText(row.manufacturer_part_number),
    oemPartNumber: toNullableText(row.oem_part_number),
    unitOfMeasure: normalizeText(row.unit_of_measure || 'EA').toUpperCase(),
    baseUnitOfMeasure: normalizeText(row.base_unit_of_measure || 'EA').toUpperCase(),
    uomConversionFactor: toFiniteNumber(row.uom_conversion_factor, 1),
    currency: normalizeText(row.currency || 'USD').toUpperCase(),
    isActive: Boolean(row.is_active ?? true),
    metadata: toSpecification(row.metadata),
    crossReferences: crossReferencesRaw.map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        referenceType: String(record.reference_type || 'alternate').toLowerCase() as never,
        referencePartNumber: normalizeText(record.reference_part_number || ''),
        referenceDescription: toNullableText(record.reference_description),
        isActive: Boolean(record.is_active ?? true),
      };
    }),
    uomConversions: uomConversionsRaw.map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        fromUom: normalizeText(record.from_uom || 'EA').toUpperCase(),
        toUom: normalizeText(record.to_uom || 'EA').toUpperCase(),
        factor: toFiniteNumber(record.factor, 1),
        roundingMode: String(record.rounding_mode || 'half_up').toLowerCase() as never,
        isActive: Boolean(record.is_active ?? true),
      };
    }),
  };
}

export function validateItemMasterInput(input: Record<string, unknown>): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  const partNumber = normalizeText(input.part_number || input.partNumber).toUpperCase();
  const itemType = normalizeText(input.item_type || input.itemType || 'part').toLowerCase();
  const status = normalizeText(input.status || 'active').toLowerCase();
  const lifecycleStatus = normalizeText(input.lifecycle_status || input.lifecycleStatus || 'serviceable').toLowerCase();
  const uom = normalizeText(input.unit_of_measure || input.unitOfMeasure || 'EA').toUpperCase();
  const baseUom = normalizeText(input.base_unit_of_measure || input.baseUnitOfMeasure || 'EA').toUpperCase();
  const conversionFactor = toFiniteNumber(input.uom_conversion_factor ?? input.uomConversionFactor, NaN);

  if (!partNumber) issues.push({ field: 'part_number', message: 'part_number is required' });
  if (partNumber && !PART_NUMBER_PATTERN.test(partNumber)) {
    issues.push({ field: 'part_number', message: 'part_number must match /^[A-Z0-9-]{3,64}$/' });
  }
  if (!ALLOWED_ITEM_TYPES.has(itemType as ItemMasterType)) {
    issues.push({ field: 'item_type', message: 'item_type must be part, tool, consumable, or kit' });
  }
  if (!ALLOWED_STATUSES.has(status as ItemMasterStatus)) {
    issues.push({ field: 'status', message: 'status must be active, inactive, deprecated, or retired' });
  }
  if (!ALLOWED_LIFECYCLE.has(lifecycleStatus as ItemMasterLifecycleStatus)) {
    issues.push({ field: 'lifecycle_status', message: 'lifecycle_status is invalid for item master' });
  }
  if (!uom) issues.push({ field: 'unit_of_measure', message: 'unit_of_measure is required' });
  if (!baseUom) issues.push({ field: 'base_unit_of_measure', message: 'base_unit_of_measure is required' });
  if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    issues.push({ field: 'uom_conversion_factor', message: 'uom_conversion_factor must be > 0' });
  }

  return issues;
}

export function parsePagination(req: ApiRequest): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(req.query.page_size || req.query.pageSize || 50) || 50));
  return { page, pageSize };
}

export async function writeItemMasterAuditLog(params: {
  tenantId: string;
  userId: string;
  action: string;
  itemMasterId?: string | null;
  correlationId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    resource_type: 'amro_item_master',
    resource_id: params.itemMasterId || null,
    tenant_id: params.tenantId,
    details: {
      correlation_id: params.correlationId,
      ...params.details,
    },
  });
}
