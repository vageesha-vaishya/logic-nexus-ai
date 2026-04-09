import type { AmroApiScope } from './livePartsCatalogApi';

type FetchLike = typeof fetch;

export type StockLedgerMovementType =
  | 'receipt'
  | 'issue'
  | 'consume'
  | 'reserve'
  | 'release'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'return';

export type StockLedgerValuationMethod = 'fifo' | 'lifo' | 'weighted_average';

export type StockLedgerRecord = {
  id: string;
  partInventoryId: string;
  movementType: StockLedgerMovementType;
  valuationMethod: StockLedgerValuationMethod;
  quantityDelta: number;
  balanceAfter: number | null;
  unitCost: number;
  totalCost: number;
  currency: string;
  effectiveAt: string;
  batchId: string | null;
  sourceModule: string | null;
  sourceReference: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type StockLedgerCreatePayload = {
  partInventoryId: string;
  movementType: StockLedgerMovementType;
  valuationMethod?: StockLedgerValuationMethod;
  quantityDelta: number;
  unitCost?: number;
  currency?: string;
  sourceModule?: string;
  sourceReference?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  batchId?: string;
};

export type StockLedgerPeriod = {
  id: string;
  period_code: string;
  period_start: string;
  period_end: string;
  close_status: 'open' | 'closing' | 'closed' | 'reopened';
  valuation_method: StockLedgerValuationMethod;
  closed_at?: string | null;
  reopened_at?: string | null;
  notes?: string | null;
};

export type StockLedgerApproval = {
  id: string;
  request_type: 'adjustment' | 'period_reopen' | 'backdated_posting';
  request_status: 'pending' | 'approved' | 'rejected';
  related_period_id?: string | null;
  reason?: string | null;
  decision_notes?: string | null;
  created_at?: string;
};

type ApiResponseShape = {
  error?: string;
  issues?: Array<{ field?: string; message?: string }>;
  output?: Record<string, unknown>;
};

function buildHeaders(scope: AmroApiScope = {}): Headers {
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  if (scope.accessToken?.trim()) headers.set('Authorization', `Bearer ${scope.accessToken.trim()}`);
  if (scope.tenantId?.trim()) headers.set('x-tenant-id', scope.tenantId.trim());
  if (scope.franchiseId?.trim()) headers.set('x-franchise-id', scope.franchiseId.trim());
  if (scope.userId?.trim()) headers.set('x-user-id', scope.userId.trim());
  headers.set('x-domain-id', 'AMRO');
  return headers;
}

async function parseResponse(response: Response): Promise<ApiResponseShape> {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object') return payload as ApiResponseShape;
    return {};
  } catch {
    return {};
  }
}

async function assertResponse(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const payload = await parseResponse(response);
  const issue = payload.issues?.[0];
  if (issue?.field || issue?.message) {
    throw new Error(`${fallback} (${response.status}) - ${String(issue.field || 'payload')}: ${String(issue.message || 'validation failed')}`);
  }
  throw new Error(`${fallback} (${response.status})${payload.error ? ` - ${payload.error}` : ''}`);
}

function mapRecord(value: unknown): StockLedgerRecord {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    id: String(row.id || ''),
    partInventoryId: String(row.partInventoryId || row.part_inventory_id || ''),
    movementType: String(row.movementType || row.movement_type || 'adjustment') as StockLedgerMovementType,
    valuationMethod: String(row.valuationMethod || row.valuation_method || 'weighted_average') as StockLedgerValuationMethod,
    quantityDelta: Number(row.quantityDelta ?? row.quantity_delta ?? 0),
    balanceAfter: row.balanceAfter === null || row.balance_after === null ? null : Number(row.balanceAfter ?? row.balance_after ?? 0),
    unitCost: Number(row.unitCost ?? row.unit_cost ?? 0),
    totalCost: Number(row.totalCost ?? row.total_cost ?? 0),
    currency: String(row.currency || 'USD'),
    effectiveAt: String(row.effectiveAt || row.effective_at || ''),
    batchId: row.batchId ? String(row.batchId) : row.batch_id ? String(row.batch_id) : null,
    sourceModule: row.sourceModule ? String(row.sourceModule) : row.source_module ? String(row.source_module) : null,
    sourceReference: row.sourceReference ? String(row.sourceReference) : row.source_reference ? String(row.source_reference) : null,
    notes: row.notes ? String(row.notes) : null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
    createdAt: String(row.createdAt || row.created_at || ''),
  };
}

function toPayload(payload: StockLedgerCreatePayload): Record<string, unknown> {
  return {
    part_inventory_id: payload.partInventoryId,
    movement_type: payload.movementType,
    valuation_method: payload.valuationMethod || 'weighted_average',
    quantity_delta: payload.quantityDelta,
    unit_cost: payload.unitCost || 0,
    currency: payload.currency || 'USD',
    source_module: payload.sourceModule || null,
    source_reference: payload.sourceReference || null,
    notes: payload.notes || null,
    metadata: payload.metadata || {},
    batch_id: payload.batchId || null,
  };
}

export async function listStockLedgerRecords(
  params: { page: number; pageSize: number; movementType?: string; search?: string },
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<{ records: StockLedgerRecord[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('page_size', String(params.pageSize));
  if (params.movementType && params.movementType !== 'all') query.set('movement_type', params.movementType);
  if (params.search?.trim()) query.set('search', params.search.trim());
  const response = await fetchImpl(`/api/v2/amro/stock-ledger?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to load stock ledger records');
  const payload = await parseResponse(response);
  const output = payload.output || {};
  const rows = Array.isArray(output.records) ? output.records : [];
  return {
    records: rows.map((row) => mapRecord(row)),
    total: Number(output.total || 0),
  };
}

export async function createStockLedgerRecord(
  payload: StockLedgerCreatePayload,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerRecord> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify(toPayload(payload)),
  });
  await assertResponse(response, 'Failed to create stock ledger record');
  const body = await parseResponse(response);
  const output = body.output || {};
  return mapRecord(output.record);
}

export async function createStockLedgerBatch(
  entries: StockLedgerCreatePayload[],
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<{ batchId: string; createdCount: number; rejectedCount: number }> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/batch', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({ entries: entries.map((entry) => toPayload(entry)) }),
  });
  await assertResponse(response, 'Failed to create stock ledger batch');
  const body = await parseResponse(response);
  const output = body.output || {};
  return {
    batchId: String(output.batch_id || ''),
    createdCount: Number(output.created_count || 0),
    rejectedCount: Number(output.rejected_count || 0),
  };
}

export async function runStockLedgerReconciliation(
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<{ runId: string; inspectedItems: number; varianceItems: number }> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/reconcile', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({ trigger: 'manual' }),
  });
  await assertResponse(response, 'Failed to run reconciliation');
  const body = await parseResponse(response);
  const output = body.output || {};
  return {
    runId: String(output.run_id || ''),
    inspectedItems: Number(output.inspected_items || 0),
    varianceItems: Number(output.variance_items || 0),
  };
}

export async function exportStockLedgerReport(
  reportType: 'stock-balance' | 'transaction-history' | 'valuation-summary',
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<string> {
  const response = await fetchImpl(`/api/v2/amro/stock-ledger/reports/${reportType}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, `Failed to load ${reportType} report`);
  const payload = await parseResponse(response);
  const output = payload.output || {};
  const rows = Array.isArray(output.records) ? output.records : [];
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const mapped = headers.map((header) => {
      const value = (row as Record<string, unknown>)[header];
      const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '');
      return `"${String(raw).replace(/"/g, '""')}"`;
    });
    csvRows.push(mapped.join(','));
  }
  return csvRows.join('\n');
}

export async function listStockLedgerPeriods(
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerPeriod[]> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/periods', {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to load stock periods');
  const payload = await parseResponse(response);
  const rows = Array.isArray(payload.output?.records) ? payload.output?.records : [];
  return rows.map((row) => row as StockLedgerPeriod);
}

export async function openStockLedgerPeriod(
  input: { periodCode: string; periodStart: string; periodEnd: string; valuationMethod: StockLedgerValuationMethod; notes?: string },
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerPeriod> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/periods/open', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({
      period_code: input.periodCode,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      valuation_method: input.valuationMethod,
      notes: input.notes || null,
    }),
  });
  await assertResponse(response, 'Failed to open stock period');
  const payload = await parseResponse(response);
  return (payload.output?.record || {}) as StockLedgerPeriod;
}

export async function closeStockLedgerPeriod(
  periodId: string,
  notes: string,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerPeriod> {
  const response = await fetchImpl(`/api/v2/amro/stock-ledger/periods/${encodeURIComponent(periodId)}/close`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({ notes }),
  });
  await assertResponse(response, 'Failed to close stock period');
  const payload = await parseResponse(response);
  return (payload.output?.record || {}) as StockLedgerPeriod;
}

export async function requestReopenStockLedgerPeriod(
  periodId: string,
  reason: string,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerApproval> {
  const response = await fetchImpl(`/api/v2/amro/stock-ledger/periods/${encodeURIComponent(periodId)}/reopen-request`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({ reason }),
  });
  await assertResponse(response, 'Failed to request period reopen');
  const payload = await parseResponse(response);
  return (payload.output?.record || {}) as StockLedgerApproval;
}

export async function reopenStockLedgerPeriod(
  periodId: string,
  approvalId: string,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerPeriod> {
  const response = await fetchImpl(`/api/v2/amro/stock-ledger/periods/${encodeURIComponent(periodId)}/reopen`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({ approval_id: approvalId }),
  });
  await assertResponse(response, 'Failed to reopen stock period');
  const payload = await parseResponse(response);
  return (payload.output?.record || {}) as StockLedgerPeriod;
}

export async function listStockLedgerApprovals(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerApproval[]> {
  const response = await fetchImpl(`/api/v2/amro/stock-ledger/approvals?status=${encodeURIComponent(status)}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to load stock ledger approvals');
  const payload = await parseResponse(response);
  const rows = Array.isArray(payload.output?.records) ? payload.output?.records : [];
  return rows.map((row) => row as StockLedgerApproval);
}

export async function decideStockLedgerApproval(
  approvalId: string,
  decision: 'approved' | 'rejected',
  notes: string,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerApproval> {
  const response = await fetchImpl(`/api/v2/amro/stock-ledger/approvals/${encodeURIComponent(approvalId)}/decision`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({ decision, notes }),
  });
  await assertResponse(response, 'Failed to update approval decision');
  const payload = await parseResponse(response);
  return (payload.output?.record || {}) as StockLedgerApproval;
}

export async function exportStockLedgerAudit(
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<string> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/audit/export', {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to export stock ledger audit');
  const payload = await parseResponse(response);
  const rows = Array.isArray(payload.output?.records) ? payload.output?.records : [];
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const mapped = headers.map((header) => {
      const value = (row as Record<string, unknown>)[header];
      const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '');
      return `"${String(raw).replace(/"/g, '""')}"`;
    });
    csvRows.push(mapped.join(','));
  }
  return csvRows.join('\n');
}
