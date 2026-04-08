import type { ApiRequest } from '@/pages/api/_utils/types';
import { getSupabaseAdminClient } from '@/pages/api/_utils/supabaseAdmin';

export type LifecycleStatus =
  | 'serviceable'
  | 'inspection_due'
  | 'needs_repair'
  | 'repair_in_progress'
  | 'ready_for_install'
  | 'replaced'
  | 'retired'
  | 'quarantined';

export type WorkflowEventType =
  | 'part_inspection'
  | 'repair_scheduling'
  | 'replacement_authorization';

export type PartsTemplateRecord = {
  id?: string;
  partNumber: string;
  serialNumber?: string | null;
  description?: string | null;
  status: 'available' | 'reserved' | 'low_stock' | 'quarantined' | 'unserviceable';
  lifecycleStatus?: LifecycleStatus;
  quantityOnHand: number;
  quantityReserved?: number;
  warehouseLocation: string;
  supplierName?: string | null;
  criticality?: 'critical' | 'high' | 'normal' | 'low';
  ataChapter?: string | null;
  metadata?: {
    barcodeValue?: string | null;
    rfidTag?: string | null;
    conditionCode?: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR' | null;
    aogPriority?: boolean;
    tags?: string[] | null;
    itemMasterId?: string | null;
    itemMasterPartNumber?: string | null;
    linkageSource?: string | null;
    linkedAt?: string | null;
  };
};

export type PartsInventoryRow = {
  id?: string;
  tenant_id?: string;
  franchise_id?: string | null;
  part_number: string;
  serial_number?: string | null;
  description?: string | null;
  status: string;
  lifecycle_status?: LifecycleStatus;
  quantity_on_hand: number;
  quantity_reserved: number;
  warehouse_location: string;
  supplier_name?: string | null;
  criticality?: 'critical' | 'high' | 'normal' | 'low';
  ata_chapter?: string | null;
  reorder_level?: number;
  quantity_available?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

const PART_NUMBER_PATTERN = /^[A-Za-z0-9-]{3,64}$/;
const SERIAL_PATTERN = /^[A-Z0-9-]{0,64}$/;
const ALLOWED_STATUS = new Set(['available', 'reserved', 'low_stock', 'quarantined', 'unserviceable']);
const ALLOWED_LIFECYCLE = new Set<LifecycleStatus>([
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
  return text ? text : null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function mapTemplateToPartsInventoryRow(
  template: PartsTemplateRecord,
): PartsInventoryRow {
  const qtyOnHand = Math.max(0, Math.round(toFiniteNumber(template.quantityOnHand, 0)));
  const qtyReserved = Math.max(0, Math.round(toFiniteNumber(template.quantityReserved, 0)));
  return {
    part_number: normalizeText(template.partNumber).toUpperCase(),
    serial_number: toNullableText(template.serialNumber)?.toUpperCase() || null,
    description: toNullableText(template.description),
    status: normalizeText(template.status).toLowerCase(),
    lifecycle_status: (template.lifecycleStatus || mapStatusToLifecycle(template.status)) as LifecycleStatus,
    quantity_on_hand: qtyOnHand,
    quantity_reserved: Math.min(qtyOnHand, qtyReserved),
    warehouse_location: normalizeText(template.warehouseLocation),
    supplier_name: toNullableText(template.supplierName),
    criticality: (template.criticality || 'normal').toLowerCase() as PartsInventoryRow['criticality'],
    ata_chapter: toNullableText(template.ataChapter),
    metadata: {
      source_template: 'amro_parts_record_detail_template',
      mapper_version: '2026-04-08',
    },
  };
}

export function mapPartsInventoryRowToTemplate(row: Record<string, unknown>): PartsTemplateRecord {
  const status = normalizeText(row.status || 'available').toLowerCase() as PartsTemplateRecord['status'];
  return {
    id: normalizeText(row.id),
    partNumber: normalizeText(row.part_number),
    serialNumber: toNullableText(row.serial_number),
    description: toNullableText(row.description),
    status,
    lifecycleStatus: (normalizeText(row.lifecycle_status || mapStatusToLifecycle(status)) as LifecycleStatus),
    quantityOnHand: toFiniteNumber(row.quantity_on_hand, 0),
    quantityReserved: toFiniteNumber(row.quantity_reserved, 0),
    warehouseLocation: normalizeText(row.warehouse_location),
    supplierName: toNullableText(row.supplier_name),
    criticality: (normalizeText(row.criticality || 'normal').toLowerCase() as PartsTemplateRecord['criticality']),
    ataChapter: toNullableText(row.ata_chapter),
    metadata: (() => {
      const metadata = row.metadata && typeof row.metadata === 'object'
        ? row.metadata as Record<string, unknown>
        : {};
      return {
        barcodeValue: toNullableText(metadata.barcode_value),
        rfidTag: toNullableText(metadata.rfid_tag),
        conditionCode: toNullableText(metadata.condition_code) as PartsTemplateRecord['metadata']['conditionCode'],
        aogPriority: Boolean(metadata.aog_priority),
        tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        itemMasterId: toNullableText(metadata.item_master_id),
        itemMasterPartNumber: toNullableText(metadata.item_master_part_number),
        linkageSource: toNullableText(metadata.linkage_source),
        linkedAt: toNullableText(metadata.linked_at),
      };
    })(),
  };
}

export function mapStatusToLifecycle(status: string): LifecycleStatus {
  switch (String(status).toLowerCase()) {
    case 'quarantined':
      return 'quarantined';
    case 'unserviceable':
      return 'needs_repair';
    default:
      return 'serviceable';
  }
}

export function validatePartsRecordInput(input: Record<string, unknown>): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  const partNumber = normalizeText(input.part_number || input.partNumber).toUpperCase();
  const serial = normalizeText(input.serial_number || input.serialNumber);
  const status = normalizeText(input.status).toLowerCase();
  const lifecycle = normalizeText(input.lifecycle_status || input.lifecycleStatus).toLowerCase();
  const qtyOnHand = toFiniteNumber(input.quantity_on_hand ?? input.quantityOnHand, NaN);
  const qtyReserved = toFiniteNumber(input.quantity_reserved ?? input.quantityReserved, NaN);

  if (!partNumber) issues.push({ field: 'part_number', message: 'part_number is required' });
  if (partNumber && !PART_NUMBER_PATTERN.test(partNumber)) {
    issues.push({ field: 'part_number', message: 'part_number must match /^[A-Z0-9-]{3,64}$/' });
  }
  if (serial && !SERIAL_PATTERN.test(serial)) {
    issues.push({ field: 'serial_number', message: 'serial_number must match /^[A-Z0-9-]{0,64}$/' });
  }
  if (status && !ALLOWED_STATUS.has(status)) {
    issues.push({ field: 'status', message: 'status must be available, reserved, low_stock, quarantined, or unserviceable' });
  }
  if (lifecycle && !ALLOWED_LIFECYCLE.has(lifecycle as LifecycleStatus)) {
    issues.push({ field: 'lifecycle_status', message: 'lifecycle_status is invalid for MRO lifecycle management' });
  }
  if (!Number.isFinite(qtyOnHand) || qtyOnHand < 0) {
    issues.push({ field: 'quantity_on_hand', message: 'quantity_on_hand must be a non-negative number' });
  }
  if (!Number.isFinite(qtyReserved) || qtyReserved < 0) {
    issues.push({ field: 'quantity_reserved', message: 'quantity_reserved must be a non-negative number' });
  }
  if (Number.isFinite(qtyOnHand) && Number.isFinite(qtyReserved) && qtyReserved > qtyOnHand) {
    issues.push({ field: 'quantity_reserved', message: 'quantity_reserved cannot exceed quantity_on_hand' });
  }
  if (!normalizeText(input.warehouse_location || input.warehouseLocation)) {
    issues.push({ field: 'warehouse_location', message: 'warehouse_location is required' });
  }

  return issues;
}

export function resolveWorkflowTriggers(params: {
  previous: Record<string, unknown> | null;
  next: Record<string, unknown>;
}): WorkflowEventType[] {
  const prev = params.previous || {};
  const next = params.next;
  const prevLifecycle = normalizeText(prev.lifecycle_status || prev.lifecycleStatus).toLowerCase();
  const nextLifecycle = normalizeText(next.lifecycle_status || next.lifecycleStatus).toLowerCase();
  const nextStatus = normalizeText(next.status).toLowerCase();
  const criticality = normalizeText(next.criticality || 'normal').toLowerCase();
  const qtyOnHand = toFiniteNumber(next.quantity_on_hand, 0);
  const reorderLevel = toFiniteNumber(next.reorder_level, 0);

  const events: WorkflowEventType[] = [];

  if (nextLifecycle === 'inspection_due' || nextStatus === 'quarantined') {
    if (!(prevLifecycle === 'inspection_due')) {
      events.push('part_inspection');
    }
  }
  if (nextLifecycle === 'needs_repair' || nextStatus === 'unserviceable') {
    if (!(prevLifecycle === 'needs_repair')) {
      events.push('repair_scheduling');
    }
  }
  if (qtyOnHand <= reorderLevel && (criticality === 'critical' || criticality === 'high')) {
    events.push('replacement_authorization');
  }

  return Array.from(new Set(events));
}

export async function writePartsWorkflowEvents(params: {
  tenantId: string;
  franchiseId: string | null;
  partInventoryId: string;
  events: WorkflowEventType[];
  userId: string;
  correlationId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (params.events.length === 0) return;
  const supabase = getSupabaseAdminClient();
  const rows = params.events.map((eventType) => ({
    tenant_id: params.tenantId,
    franchise_id: params.franchiseId,
    part_inventory_id: params.partInventoryId,
    event_type: eventType,
    event_status: 'pending',
    trigger_reason: 'auto-rule',
    payload: {
      correlation_id: params.correlationId,
      event_type: eventType,
      part_payload: params.payload,
    },
    triggered_by: params.userId,
  }));
  await supabase.from('amro_parts_mro_workflow_events').insert(rows);
}

export async function writePartsAuditLog(params: {
  tenantId: string;
  userId: string;
  action: string;
  partInventoryId?: string | null;
  correlationId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase.from('audit_logs').insert({
    user_id: params.userId,
    action: params.action,
    resource_type: 'amro_parts_inventory',
    resource_id: params.partInventoryId || null,
    tenant_id: params.tenantId,
    details: {
      correlation_id: params.correlationId,
      ...params.details,
    },
  });
}

export function parsePagination(req: ApiRequest): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(200, Number(req.query.page_size || req.query.pageSize || 50) || 50));
  return { page, pageSize };
}

function readHeaderValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

export function buildPartsAuthDiagnostics(req: ApiRequest, error: unknown): {
  http_status: number;
  failure_category: 'token' | 'permission' | 'scope' | 'domain' | 'unknown';
  reason_code: string;
  remediation: string;
  checks: {
    has_authorization_header: boolean;
    has_access_token_query: boolean;
    has_access_token_body: boolean;
    has_tenant_header: boolean;
    has_franchise_header: boolean;
    has_user_header: boolean;
    has_domain_header: boolean;
  };
} {
  const message = String((error as { message?: unknown })?.message || 'Unauthorized');
  const normalized = message.toLowerCase();
  const authHeader = readHeaderValue(req.headers?.authorization);
  const queryToken = readHeaderValue((req.query as Record<string, unknown>)?.access_token);
  const bodyToken = readHeaderValue((req.body as Record<string, unknown>)?.access_token);
  const tenantHeader = readHeaderValue(req.headers?.['x-tenant-id']);
  const franchiseHeader = readHeaderValue(req.headers?.['x-franchise-id']);
  const userHeader = readHeaderValue(req.headers?.['x-user-id']);
  const domainHeader = readHeaderValue(req.headers?.['x-domain-id']);

  if (normalized.includes('domain') || normalized.includes('amro access')) {
    return {
      http_status: 403,
      failure_category: 'domain',
      reason_code: 'amro_domain_access_denied',
      remediation: 'Assign AMRO domain to tenant/user and ensure subscription is active.',
      checks: {
        has_authorization_header: Boolean(authHeader),
        has_access_token_query: Boolean(queryToken),
        has_access_token_body: Boolean(bodyToken),
        has_tenant_header: Boolean(tenantHeader),
        has_franchise_header: Boolean(franchiseHeader),
        has_user_header: Boolean(userHeader),
        has_domain_header: Boolean(domainHeader),
      },
    };
  }
  if (normalized.includes('forbidden') || normalized.includes('permission')) {
    return {
      http_status: 403,
      failure_category: 'permission',
      reason_code: 'missing_permission_amro_parts_view',
      remediation: 'Grant dashboards.view or view_amro_dashboard permission to this user role.',
      checks: {
        has_authorization_header: Boolean(authHeader),
        has_access_token_query: Boolean(queryToken),
        has_access_token_body: Boolean(bodyToken),
        has_tenant_header: Boolean(tenantHeader),
        has_franchise_header: Boolean(franchiseHeader),
        has_user_header: Boolean(userHeader),
        has_domain_header: Boolean(domainHeader),
      },
    };
  }
  if (normalized.includes('tenant') || normalized.includes('franchise') || normalized.includes('scope')) {
    return {
      http_status: 403,
      failure_category: 'scope',
      reason_code: 'scope_resolution_failed',
      remediation: 'Provide valid x-tenant-id/x-franchise-id headers aligned with the user access profile.',
      checks: {
        has_authorization_header: Boolean(authHeader),
        has_access_token_query: Boolean(queryToken),
        has_access_token_body: Boolean(bodyToken),
        has_tenant_header: Boolean(tenantHeader),
        has_franchise_header: Boolean(franchiseHeader),
        has_user_header: Boolean(userHeader),
        has_domain_header: Boolean(domainHeader),
      },
    };
  }
  if (normalized.includes('unauthorized') || normalized.includes('token') || normalized.includes('jwt')) {
    return {
      http_status: 401,
      failure_category: 'token',
      reason_code: 'token_invalid_or_missing',
      remediation: 'Re-authenticate and send a valid Bearer token or access_token with AMRO scope headers.',
      checks: {
        has_authorization_header: Boolean(authHeader),
        has_access_token_query: Boolean(queryToken),
        has_access_token_body: Boolean(bodyToken),
        has_tenant_header: Boolean(tenantHeader),
        has_franchise_header: Boolean(franchiseHeader),
        has_user_header: Boolean(userHeader),
        has_domain_header: Boolean(domainHeader),
      },
    };
  }
  return {
    http_status: 401,
    failure_category: 'unknown',
    reason_code: 'auth_access_unknown',
    remediation: 'Review correlationId in server logs and verify token, permissions, and AMRO scope headers.',
    checks: {
      has_authorization_header: Boolean(authHeader),
      has_access_token_query: Boolean(queryToken),
      has_access_token_body: Boolean(bodyToken),
      has_tenant_header: Boolean(tenantHeader),
      has_franchise_header: Boolean(franchiseHeader),
      has_user_header: Boolean(userHeader),
      has_domain_header: Boolean(domainHeader),
    },
  };
}
