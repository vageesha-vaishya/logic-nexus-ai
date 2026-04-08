import type { AmroApiScope } from './livePartsCatalogApi';

type FetchLike = typeof fetch;

export type ItemMasterCrossReference = {
  referenceType: 'alternate' | 'superseded_by' | 'supersedes' | 'vendor' | 'oem';
  referencePartNumber: string;
  referenceDescription?: string | null;
  isActive?: boolean;
};

export type ItemMasterUomConversion = {
  fromUom: string;
  toUom: string;
  factor: number;
  roundingMode?: 'half_up' | 'up' | 'down';
  isActive?: boolean;
};

export type ItemMasterRecord = {
  id: string;
  partNumber: string;
  description: string | null;
  itemType: 'part' | 'tool' | 'consumable' | 'kit';
  category: string | null;
  subcategory: string | null;
  status: 'active' | 'inactive' | 'deprecated' | 'retired';
  lifecycleStatus: 'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined';
  specification: Record<string, unknown>;
  manufacturerName: string | null;
  manufacturerPartNumber: string | null;
  oemPartNumber: string | null;
  unitOfMeasure: string;
  baseUnitOfMeasure: string;
  uomConversionFactor: number;
  currency: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  crossReferences: ItemMasterCrossReference[];
  uomConversions: ItemMasterUomConversion[];
};

export type ItemMasterMutationPayload = Omit<ItemMasterRecord, 'id'> & { id?: string };

export type ItemMasterListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  itemType?: string;
  category?: string;
};

type ApiResponseShape = {
  output?: {
    records?: ItemMasterRecord[];
    record?: ItemMasterRecord;
    total?: number;
  };
  error?: string;
  issues?: Array<{ field?: string; message?: string }>;
};

function asJsonHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function buildAuthHeaders(headers: HeadersInit, scope?: AmroApiScope): Promise<HeadersInit> {
  const nextHeaders = new Headers(headers as HeadersInit);
  const token = scope?.accessToken || '';
  if (token.trim()) nextHeaders.set('Authorization', `Bearer ${token.trim()}`);
  if (scope?.tenantId?.trim()) nextHeaders.set('x-tenant-id', scope.tenantId.trim());
  if (scope?.franchiseId?.trim()) nextHeaders.set('x-franchise-id', scope.franchiseId.trim());
  if (scope?.userId?.trim()) nextHeaders.set('x-user-id', scope.userId.trim());
  nextHeaders.set('x-domain-id', 'AMRO');
  return nextHeaders;
}

async function parseApiResponseShape(response: Response): Promise<ApiResponseShape> {
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object') return parsed as ApiResponseShape;
  } catch {
    return {};
  }
  return {};
}

function normalizeRecord(record: ItemMasterRecord): ItemMasterRecord {
  return {
    ...record,
    partNumber: String(record.partNumber || '').trim().toUpperCase(),
    description: record.description ? String(record.description).trim() : null,
    category: record.category ? String(record.category).trim() : null,
    subcategory: record.subcategory ? String(record.subcategory).trim() : null,
    manufacturerName: record.manufacturerName ? String(record.manufacturerName).trim() : null,
    manufacturerPartNumber: record.manufacturerPartNumber ? String(record.manufacturerPartNumber).trim().toUpperCase() : null,
    oemPartNumber: record.oemPartNumber ? String(record.oemPartNumber).trim().toUpperCase() : null,
    unitOfMeasure: String(record.unitOfMeasure || 'EA').trim().toUpperCase(),
    baseUnitOfMeasure: String(record.baseUnitOfMeasure || 'EA').trim().toUpperCase(),
    currency: String(record.currency || 'USD').trim().toUpperCase(),
    uomConversionFactor: Number(record.uomConversionFactor || 1),
    crossReferences: Array.isArray(record.crossReferences) ? record.crossReferences : [],
    uomConversions: Array.isArray(record.uomConversions) ? record.uomConversions : [],
  };
}

function toMutationPayload(record: ItemMasterMutationPayload): Record<string, unknown> {
  const normalized = normalizeRecord({
    ...record,
    id: record.id || '',
    specification: record.specification || {},
    metadata: record.metadata || {},
    crossReferences: record.crossReferences || [],
    uomConversions: record.uomConversions || [],
  } as ItemMasterRecord);
  return {
    part_number: normalized.partNumber,
    description: normalized.description,
    item_type: normalized.itemType,
    category: normalized.category,
    subcategory: normalized.subcategory,
    status: normalized.status,
    lifecycle_status: normalized.lifecycleStatus,
    specification: normalized.specification,
    manufacturer_name: normalized.manufacturerName,
    manufacturer_part_number: normalized.manufacturerPartNumber,
    oem_part_number: normalized.oemPartNumber,
    unit_of_measure: normalized.unitOfMeasure,
    base_unit_of_measure: normalized.baseUnitOfMeasure,
    uom_conversion_factor: normalized.uomConversionFactor,
    currency: normalized.currency,
    is_active: normalized.isActive,
    metadata: normalized.metadata,
    cross_references: normalized.crossReferences.map((entry) => ({
      reference_type: entry.referenceType,
      reference_part_number: String(entry.referencePartNumber || '').trim().toUpperCase(),
      reference_description: entry.referenceDescription ? String(entry.referenceDescription).trim() : null,
      is_active: entry.isActive !== false,
    })),
    uom_conversions: normalized.uomConversions.map((entry) => ({
      from_uom: String(entry.fromUom || 'EA').trim().toUpperCase(),
      to_uom: String(entry.toUom || 'EA').trim().toUpperCase(),
      factor: Number(entry.factor || 1),
      rounding_mode: entry.roundingMode || 'half_up',
      is_active: entry.isActive !== false,
    })),
  };
}

async function assertOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const payload = await parseApiResponseShape(response);
  if (response.status === 404) {
    throw new Error(
      `${fallback} (404) - Item Master API route is unavailable on current AMRO backend target. ` +
      'Deploy/enable /api/v2/amro/item-master (AMRO_ITEM_MASTER_V2_ENABLED=true) and verify VITE_AMRO_API_PROXY_TARGET.'
    );
  }
  const issue = payload.issues?.[0];
  if (issue?.field || issue?.message) {
    throw new Error(`${fallback} (${response.status}) - ${String(issue.field || 'payload')}: ${String(issue.message || 'validation failed')}`);
  }
  throw new Error(`${fallback} (${response.status})${payload.error ? ` - ${payload.error}` : ''}`);
}

export async function listItemMasterRecords(
  query: ItemMasterListQuery,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<{ records: ItemMasterRecord[]; total: number }> {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('page_size', String(query.pageSize));
  if (query.search) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.itemType && query.itemType !== 'all') params.set('item_type', query.itemType);
  if (query.category) params.set('category', query.category.trim());
  const headers = await buildAuthHeaders(asJsonHeaders(), scope);
  const response = await fetchImpl(`/api/v2/amro/item-master?${params.toString()}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  await assertOk(response, 'Failed to load item master records');
  const payload = await parseApiResponseShape(response);
  return {
    records: (payload.output?.records || []).map((entry) => normalizeRecord(entry)),
    total: Number(payload.output?.total || 0),
  };
}

export async function getItemMasterRecord(
  id: string,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<ItemMasterRecord> {
  const headers = await buildAuthHeaders(asJsonHeaders(), scope);
  const response = await fetchImpl(`/api/v2/amro/item-master/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  await assertOk(response, 'Failed to load item master record');
  const payload = await parseApiResponseShape(response);
  if (!payload.output?.record) throw new Error('Failed to load item master record (missing record)');
  return normalizeRecord(payload.output.record);
}

export async function createItemMasterRecord(
  payload: ItemMasterMutationPayload,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<ItemMasterRecord> {
  const headers = await buildAuthHeaders(asJsonHeaders(), scope);
  const response = await fetchImpl('/api/v2/amro/item-master', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(toMutationPayload(payload)),
  });
  await assertOk(response, 'Failed to create item master record');
  const body = await parseApiResponseShape(response);
  if (!body.output?.record) throw new Error('Failed to create item master record (missing record)');
  return normalizeRecord(body.output.record);
}

export async function updateItemMasterRecord(
  id: string,
  payload: ItemMasterMutationPayload,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<ItemMasterRecord> {
  const headers = await buildAuthHeaders(asJsonHeaders(), scope);
  const response = await fetchImpl(`/api/v2/amro/item-master/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify(toMutationPayload(payload)),
  });
  await assertOk(response, 'Failed to update item master record');
  const body = await parseApiResponseShape(response);
  if (!body.output?.record) throw new Error('Failed to update item master record (missing record)');
  return normalizeRecord(body.output.record);
}

export async function deleteItemMasterRecord(
  id: string,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<void> {
  const headers = await buildAuthHeaders(asJsonHeaders(), scope);
  const response = await fetchImpl(`/api/v2/amro/item-master/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  await assertOk(response, 'Failed to delete item master record');
}
