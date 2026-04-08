import type {
  PartCriticality,
  PartInventoryRecord,
  PartInventoryStatus,
} from './mockPartsInventoryData';
import type { PartsCatalogApi, PartsCatalogQuery, PartsCatalogResponse } from './partsInventoryContracts';
import { supabase } from '@/integrations/supabase/client';

type FetchLike = typeof fetch;

type ApiRecord = {
  id?: string;
  partNumber?: string;
  serialNumber?: string | null;
  description?: string | null;
  status?: string;
  lifecycleStatus?: string;
  quantityOnHand?: number;
  quantityReserved?: number;
  warehouseLocation?: string;
  supplierName?: string | null;
  criticality?: string;
  ataChapter?: string | null;
  reorderLevel?: number;
  reorderQuantity?: number;
  minServiceableQty?: number;
  unitCost?: number;
  currency?: string | null;
  certificationExpiryDate?: string | null;
  expiryDate?: string | null;
  metadata?: {
    barcodeValue?: string | null;
    rfidTag?: string | null;
    conditionCode?: string | null;
    aogPriority?: boolean;
    tags?: string[] | null;
    itemMasterId?: string | null;
    itemMasterPartNumber?: string | null;
    linkageSource?: string | null;
    linkedAt?: string | null;
  } | null;
};

type ApiResponseShape = {
  correlationId?: string;
  error?: string;
  code?: string;
  message?: string;
  issues?: Array<{ field?: string; message?: string }>;
  details?: {
    rejected_non_inventory_fields?: string[];
    rejected_unknown_fields?: string[];
  };
  auth_diagnostics?: {
    failure_category?: string;
    reason_code?: string;
    remediation?: string;
  };
  output?: {
    page?: number;
    page_size?: number;
    total?: number;
    records?: ApiRecord[];
  };
};

export type AmroApiScope = {
  tenantId?: string | null;
  franchiseId?: string | null;
  userId?: string | null;
  accessToken?: string | null;
};

export type PartsMutationPayload = {
  part_number: string;
  serial_number?: string | null;
  description?: string | null;
  status: PartInventoryStatus;
  lifecycle_status?: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  warehouse_location: string;
  supplier_name?: string | null;
  criticality?: PartCriticality;
  ata_chapter?: string | null;
  metadata?: Record<string, unknown>;
};

const INVENTORY_MUTATION_KEYS = new Set<keyof PartsMutationPayload>([
  'part_number',
  'serial_number',
  'description',
  'status',
  'lifecycle_status',
  'quantity_on_hand',
  'quantity_reserved',
  'warehouse_location',
  'metadata',
]);

function sanitizeInventoryMutationPayload(
  payload: Partial<PartsMutationPayload>,
): Partial<PartsMutationPayload> {
  const sanitized: Partial<PartsMutationPayload> = {};
  for (const key of Object.keys(payload) as Array<keyof PartsMutationPayload>) {
    if (!INVENTORY_MUTATION_KEYS.has(key)) continue;
    const value = payload[key];
    if (value === undefined) continue;
    if (key === 'part_number') {
      (sanitized as Record<string, unknown>)[key] = String(value || '').trim().toUpperCase();
      continue;
    }
    if (key === 'warehouse_location') {
      (sanitized as Record<string, unknown>)[key] = String(value || '').trim();
      continue;
    }
    if (key === 'serial_number' || key === 'description') {
      if (key === 'serial_number') {
        const normalizedSerial = String(value || '').trim().toUpperCase();
        (sanitized as Record<string, unknown>)[key] = normalizedSerial || null;
        continue;
      }
      const normalized = String(value || '').trim();
      (sanitized as Record<string, unknown>)[key] = normalized || null;
      continue;
    }
    if (key === 'status' || key === 'lifecycle_status') {
      (sanitized as Record<string, unknown>)[key] = String(value || '').trim().toLowerCase();
      continue;
    }
    if (key === 'quantity_on_hand' || key === 'quantity_reserved') {
      (sanitized as Record<string, unknown>)[key] = Number(value ?? 0);
      continue;
    }
    if (key === 'metadata') {
      (sanitized as Record<string, unknown>)[key] = (value && typeof value === 'object' && !Array.isArray(value))
        ? value
        : {};
      continue;
    }
    (sanitized as Record<string, unknown>)[key] = value;
  }
  return sanitized;
}

export type PartsApiAuthDiagnostics = {
  failureCategory: string | null;
  reasonCode: string | null;
  remediation: string | null;
};

export class PartsApiError extends Error {
  status: number;
  authDiagnostics: PartsApiAuthDiagnostics | null;

  constructor(message: string, status: number, authDiagnostics: PartsApiAuthDiagnostics | null = null) {
    super(message);
    this.name = 'PartsApiError';
    this.status = status;
    this.authDiagnostics = authDiagnostics;
  }
}

async function parseApiResponseShape(response: Response): Promise<ApiResponseShape> {
  try {
    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload as ApiResponseShape : {};
  } catch {
    return {};
  }
}

async function buildMutationErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await parseApiResponseShape(response);
  const issues = payload.issues || [];
  if (issues.length > 0) {
    const first = issues[0];
    const field = String(first?.field || 'payload');
    const message = String(first?.message || 'validation failed');
    return `${fallback} (${response.status}) - ${field}: ${message}`;
  }
  const rejectedNonInventory = payload.details?.rejected_non_inventory_fields || [];
  if (rejectedNonInventory.length > 0) {
    return `${fallback} (${response.status}) - unsupported fields: ${rejectedNonInventory.join(', ')}`;
  }
  const rejectedUnknown = payload.details?.rejected_unknown_fields || [];
  if (rejectedUnknown.length > 0) {
    return `${fallback} (${response.status}) - unknown fields: ${rejectedUnknown.join(', ')}`;
  }
  const topLevelMessage = String(payload.message || '').trim();
  if (topLevelMessage) return `${fallback} (${response.status}) - ${topLevelMessage}`;
  const topLevelError = String(payload.error || '').trim();
  if (topLevelError) return `${fallback} (${response.status}) - ${topLevelError}`;
  return `${fallback} (${response.status})`;
}

function normalizeAuthDiagnostics(payload: ApiResponseShape): PartsApiAuthDiagnostics | null {
  const diagnostics = payload.auth_diagnostics;
  if (!diagnostics && !payload.code) return null;
  return {
    failureCategory: diagnostics?.failure_category ? String(diagnostics.failure_category) : 'token',
    reasonCode: diagnostics?.reason_code ? String(diagnostics.reason_code) : (payload.code ? String(payload.code).toLowerCase() : null),
    remediation: diagnostics?.remediation ? String(diagnostics.remediation) : (payload.error ? String(payload.error) : null),
  };
}

async function resolveAccessToken(preferredToken?: string | null): Promise<string> {
  const normalizedPreferred = String(preferredToken || '').trim();
  if (normalizedPreferred) return normalizedPreferred;
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token || '';
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed?.session?.access_token || '';
  }
  return token;
}

async function buildAuthHeaders(headers: Record<string, string>, scope: AmroApiScope = {}): Promise<Record<string, string>> {
  const token = await resolveAccessToken(scope.accessToken);
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(scope.tenantId ? { 'x-tenant-id': scope.tenantId } : {}),
    ...(scope.franchiseId ? { 'x-franchise-id': scope.franchiseId } : {}),
    ...(scope.userId ? { 'x-user-id': scope.userId } : {}),
    'x-domain-id': 'AMRO',
  };
}

function normalizeStatus(status: string | undefined): PartInventoryStatus {
  const normalized = String(status || 'available').toLowerCase();
  if (normalized === 'available' || normalized === 'low_stock' || normalized === 'reserved' || normalized === 'quarantined' || normalized === 'unserviceable') {
    return normalized;
  }
  return 'available';
}

function normalizeCriticality(criticality: string | undefined): PartCriticality {
  const normalized = String(criticality || 'normal').toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'normal' || normalized === 'low') {
    return normalized;
  }
  return 'normal';
}

function normalizeLifecycleStatus(lifecycleStatus: string | undefined, fallbackStatus: PartInventoryStatus): PartInventoryRecord['lifecycle_status'] {
  const normalized = String(lifecycleStatus || '').toLowerCase();
  if (
    normalized === 'serviceable'
    || normalized === 'inspection_due'
    || normalized === 'needs_repair'
    || normalized === 'repair_in_progress'
    || normalized === 'ready_for_install'
    || normalized === 'replaced'
    || normalized === 'retired'
    || normalized === 'quarantined'
  ) {
    return normalized;
  }
  if (fallbackStatus === 'unserviceable') return 'needs_repair';
  if (fallbackStatus === 'quarantined') return 'quarantined';
  return 'serviceable';
}

export function mapLiveApiRecordToPartInventoryRecord(record: ApiRecord): PartInventoryRecord {
  const quantityOnHand = Math.max(0, Number(record.quantityOnHand || 0));
  const quantityReserved = Math.max(0, Number(record.quantityReserved || 0));
  const quantityAvailable = Math.max(0, quantityOnHand - quantityReserved);
  const normalizedStatus = normalizeStatus(record.status);
  const normalizedLifecycleStatus = normalizeLifecycleStatus(record.lifecycleStatus, normalizedStatus);
  const partNumber = String(record.partNumber || '').trim();
  const id = String(record.id || `missing-${partNumber || 'part'}`).trim();
  const ata = String(record.ataChapter || '').trim();
  const location = String(record.warehouseLocation || '').trim();
  const supplier = String(record.supplierName || '').trim();
  const metadata = record.metadata || null;

  return {
    id,
    part_number: partNumber,
    serial_number: record.serialNumber ?? null,
    description: String(record.description || '').trim(),
    lifecycle_status: normalizedLifecycleStatus,
    item_type: 'part',
    ata_chapter: ata,
    warehouse_location: location,
    quantity_on_hand: quantityOnHand,
    quantity_reserved: quantityReserved,
    quantity_available: quantityAvailable,
    reorder_level: Math.max(0, Number(record.reorderLevel || 0)),
    reorder_quantity: Math.max(0, Number(record.reorderQuantity || 0)),
    min_serviceable_qty: Math.max(0, Number(record.minServiceableQty || 0)),
    status: normalizedStatus,
    criticality: normalizeCriticality(record.criticality),
    supplier_name: supplier,
    unit_cost: Math.max(0, Number(record.unitCost || 0)),
    currency: String(record.currency || 'USD').trim() || 'USD',
    certification_expiry_date: record.certificationExpiryDate ?? null,
    expiry_date: record.expiryDate ?? null,
    updated_at: new Date().toISOString(),
    metadata: {
      barcode_value: String(metadata?.barcodeValue || '').trim(),
      rfid_tag: String(metadata?.rfidTag || '').trim(),
      condition_code: (metadata?.conditionCode === 'SV' || metadata?.conditionCode === 'AR' || metadata?.conditionCode === 'INSP' || metadata?.conditionCode === 'OH' || metadata?.conditionCode === 'SCRAP' || metadata?.conditionCode === 'QUAR')
        ? metadata.conditionCode
        : 'SV',
      aog_priority: Boolean(metadata?.aogPriority),
      tags: Array.isArray(metadata?.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      item_master_id: String(metadata?.itemMasterId || '').trim(),
      item_master_part_number: String(metadata?.itemMasterPartNumber || '').trim(),
      linkage_source: String(metadata?.linkageSource || '').trim(),
      linked_at: String(metadata?.linkedAt || '').trim(),
    },
  };
}

export function createAmroPartsCatalogApi(fetchImpl: FetchLike = fetch, scope: AmroApiScope = {}): PartsCatalogApi {
  return {
    async listParts(query: PartsCatalogQuery): Promise<PartsCatalogResponse> {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('page_size', String(query.pageSize));
      if (query.search?.trim()) params.set('search', query.search.trim());
      if (query.status && query.status !== 'all') params.set('status', query.status);
      const token = await resolveAccessToken(scope.accessToken);
      const requestHeaders = await buildAuthHeaders({ Accept: 'application/json' }, scope);
      const response = await fetchImpl(`/api/v2/amro/parts?${params.toString()}`, {
        method: 'GET',
        headers: requestHeaders,
        credentials: 'include',
      });
      const fallbackResponse = response.status === 401 && token
        ? await fetchImpl(`/api/v2/amro/parts?${params.toString()}&access_token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: requestHeaders,
          credentials: 'include',
        })
        : response;

      if (!fallbackResponse.ok) {
        const payload = await parseApiResponseShape(fallbackResponse);
        const diagnostics = normalizeAuthDiagnostics(payload);
        const message = String(payload.error || `Failed to load parts catalog (${fallbackResponse.status})`);
        throw new PartsApiError(message, fallbackResponse.status, diagnostics);
      }

      const payload = await parseApiResponseShape(fallbackResponse);
      const output = payload.output || {};
      const records = Array.isArray(output.records) ? output.records : [];
      const page = Number(output.page || query.page || 1);
      const pageSize = Number(output.page_size || query.pageSize || 50);
      const total = Number(output.total || records.length || 0);

      return {
        items: records.map(mapLiveApiRecordToPartInventoryRecord),
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        requestId: payload.correlationId,
      };
    },
  };
}

function asJsonHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function createAmroPartRecord(
  payload: PartsMutationPayload,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<void> {
  const sanitizedPayload = sanitizeInventoryMutationPayload(payload);
  const headers = await buildAuthHeaders(asJsonHeaders(), scope);
  const response = await fetchImpl('/api/v2/amro/parts', {
    method: 'POST',
    headers,
    body: JSON.stringify(sanitizedPayload),
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await buildMutationErrorMessage(response, 'Failed to create part'));
  }
}

export async function updateAmroPartRecord(
  id: string,
  payload: Partial<PartsMutationPayload>,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<void> {
  const sanitizedPayload = sanitizeInventoryMutationPayload(payload);
  const headers = await buildAuthHeaders(asJsonHeaders(), scope);
  const response = await fetchImpl(`/api/v2/amro/parts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(sanitizedPayload),
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(await buildMutationErrorMessage(response, 'Failed to update part'));
  }
}

export async function deleteAmroPartRecord(id: string, fetchImpl: FetchLike = fetch, scope: AmroApiScope = {}): Promise<void> {
  const headers = await buildAuthHeaders({ Accept: 'application/json' }, scope);
  const response = await fetchImpl(`/api/v2/amro/parts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete part (${response.status})`);
  }
}
