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
};

type ApiResponseShape = {
  correlationId?: string;
  output?: {
    page?: number;
    page_size?: number;
    total?: number;
    records?: ApiRecord[];
  };
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
};

async function resolveAccessToken(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token || '';
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed?.session?.access_token || '';
  }
  return token;
}

async function buildAuthHeaders(headers: Record<string, string>): Promise<Record<string, string>> {
  const token = await resolveAccessToken();
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export function mapLiveApiRecordToPartInventoryRecord(record: ApiRecord): PartInventoryRecord {
  const quantityOnHand = Math.max(0, Number(record.quantityOnHand || 0));
  const quantityReserved = Math.max(0, Number(record.quantityReserved || 0));
  const quantityAvailable = Math.max(0, quantityOnHand - quantityReserved);
  const normalizedStatus = normalizeStatus(record.status);
  const id = String(record.id || `part-${Math.random().toString(36).slice(2, 10)}`);
  const partNumber = String(record.partNumber || 'UNKNOWN-PART');
  const ata = String(record.ataChapter || 'N/A');
  const location = String(record.warehouseLocation || 'UNASSIGNED');
  const supplier = String(record.supplierName || 'Unknown Supplier');

  return {
    id,
    part_number: partNumber,
    serial_number: record.serialNumber ?? null,
    description: String(record.description || `${partNumber} inventory record`),
    item_type: 'part',
    ata_chapter: ata,
    warehouse_location: location,
    quantity_on_hand: quantityOnHand,
    quantity_reserved: quantityReserved,
    quantity_available: quantityAvailable,
    reorder_level: 10,
    reorder_quantity: 25,
    min_serviceable_qty: 2,
    status: normalizedStatus,
    criticality: normalizeCriticality(record.criticality),
    supplier_name: supplier,
    unit_cost: 100,
    currency: 'USD',
    certification_expiry_date: null,
    expiry_date: null,
    updated_at: new Date().toISOString(),
    metadata: {
      barcode_value: `BAR-${id}`,
      rfid_tag: `RFID-${id}`,
      condition_code: normalizedStatus === 'quarantined' ? 'QUAR' : normalizedStatus === 'unserviceable' ? 'INSP' : 'SV',
      aog_priority: normalizeCriticality(record.criticality) === 'critical',
      tags: [normalizedStatus, record.lifecycleStatus || 'serviceable'],
    },
  };
}

export function createAmroPartsCatalogApi(fetchImpl: FetchLike = fetch): PartsCatalogApi {
  return {
    async listParts(query: PartsCatalogQuery): Promise<PartsCatalogResponse> {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('page_size', String(query.pageSize));
      if (query.search?.trim()) params.set('search', query.search.trim());
      if (query.status && query.status !== 'all') params.set('status', query.status);
      const token = await resolveAccessToken();
      const requestHeaders = await buildAuthHeaders({ Accept: 'application/json' });
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
        throw new Error(`Failed to load parts catalog (${fallbackResponse.status})`);
      }

      const payload = await fallbackResponse.json() as ApiResponseShape;
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
): Promise<void> {
  const headers = await buildAuthHeaders(asJsonHeaders());
  const response = await fetchImpl('/api/v2/amro/parts', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to create part (${response.status})`);
  }
}

export async function updateAmroPartRecord(
  id: string,
  payload: Partial<PartsMutationPayload>,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const headers = await buildAuthHeaders(asJsonHeaders());
  const response = await fetchImpl(`/api/v2/amro/parts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to update part (${response.status})`);
  }
}

export async function deleteAmroPartRecord(id: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const headers = await buildAuthHeaders({ Accept: 'application/json' });
  const response = await fetchImpl(`/api/v2/amro/parts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete part (${response.status})`);
  }
}
