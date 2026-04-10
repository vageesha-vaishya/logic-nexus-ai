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

export type StockLedgerBatchReject = {
  rowIndex: number;
  reason: string;
  payload: Record<string, unknown>;
};

export type StockLedgerReportTemplate = {
  id: string;
  name: string;
  report_type: 'stock-balance' | 'transaction-history' | 'valuation-summary';
  filters: Record<string, unknown>;
  columns: string[];
  created_at: string;
  updated_at: string;
};

export type StockLedgerScheduledExport = {
  id: string;
  template_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  timezone: string;
  next_run_at: string;
  destinations: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type StockLedgerComplianceDashboard = {
  immutableHashCoveragePercent: number;
  pendingApprovals: number;
  staleApprovals: number;
  openPeriods: number;
  failedReconciliationRuns: number;
  evidenceSnapshot: Record<string, number>;
};

export type StockLedgerCurrencyRow = {
  currency: string;
  rawTotal: number;
  baseTotal: number;
  txnCount: number;
};

export type StockLedgerCurrencyDashboard = {
  baseCurrency: string;
  totalBaseValue: number;
  fxRates: Record<string, number>;
  records: StockLedgerCurrencyRow[];
};

export type StockLedgerDashboardKpis = {
  pendingApprovals: number;
  pendingApprovalSlaBreaches: number;
  unresolvedVarianceItems: number;
  openPeriodAgeHours: number;
  totalInventoryValue: number;
  latestReconciliation: Record<string, unknown> | null;
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

function escapeCsvField(value: unknown): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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
    idempotency_key: `sl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
}

export async function listStockLedgerRecords(
  params: { page: number; pageSize: number; movementType?: string; search?: string; cursor?: string },
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<{ records: StockLedgerRecord[]; total: number; nextCursor: string | null; hasNextPage: boolean }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('page_size', String(params.pageSize));
  if (params.movementType && params.movementType !== 'all') query.set('movement_type', params.movementType);
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.cursor) query.set('cursor', params.cursor);
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
    nextCursor: output.next_cursor ?? null,
    hasNextPage: Boolean(output.has_next_page),
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
): Promise<{ batchId: string; createdCount: number; rejectedCount: number; rejected: StockLedgerBatchReject[] }> {
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
    rejected: Array.isArray(output.rejected)
      ? output.rejected.map((item, index) => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          rowIndex: Number(row.row_index ?? index),
          reason: String(row.reason || row.message || 'rejected'),
          payload: row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {},
        };
      })
      : [],
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
  const csvRows = [headers.map(escapeCsvField).join(',')];
  for (const row of rows) {
    const mapped = headers.map((header) => escapeCsvField((row as Record<string, unknown>)[header]));
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

export async function getStockLedgerDashboardKpis(
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerDashboardKpis> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/dashboard/kpis', {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to load stock ledger KPIs');
  const payload = await parseResponse(response);
  const output = payload.output || {};
  return {
    pendingApprovals: Number(output.pending_approvals || 0),
    pendingApprovalSlaBreaches: Number(output.pending_approval_sla_breaches || 0),
    unresolvedVarianceItems: Number(output.unresolved_variance_items || 0),
    openPeriodAgeHours: Number(output.open_period_age_hours || 0),
    totalInventoryValue: Number(output.total_inventory_value || 0),
    latestReconciliation:
      output.latest_reconciliation && typeof output.latest_reconciliation === 'object'
        ? (output.latest_reconciliation as Record<string, unknown>)
        : null,
  };
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
  const csvRows = [headers.map(escapeCsvField).join(',')];
  for (const row of rows) {
    const mapped = headers.map((header) => escapeCsvField((row as Record<string, unknown>)[header]));
    csvRows.push(mapped.join(','));
  }
  return csvRows.join('\n');
}

export function buildBatchRetryPayload(rejected: StockLedgerBatchReject[]): StockLedgerCreatePayload[] {
  return rejected
    .map((item) => item.payload)
    .map((payload) => ({
      partInventoryId: String(payload.partInventoryId || payload.part_inventory_id || ''),
      movementType: String(payload.movementType || payload.movement_type || 'adjustment') as StockLedgerMovementType,
      valuationMethod: String(payload.valuationMethod || payload.valuation_method || 'weighted_average') as StockLedgerValuationMethod,
      quantityDelta: Number(payload.quantityDelta ?? payload.quantity_delta ?? 0),
      unitCost: Number(payload.unitCost ?? payload.unit_cost ?? 0),
      currency: String(payload.currency || 'USD'),
      sourceModule: payload.sourceModule ? String(payload.sourceModule) : (payload.source_module ? String(payload.source_module) : undefined),
      sourceReference: payload.sourceReference ? String(payload.sourceReference) : (payload.source_reference ? String(payload.source_reference) : undefined),
      notes: payload.notes ? String(payload.notes) : undefined,
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata as Record<string, unknown> : undefined,
      batchId: payload.batchId ? String(payload.batchId) : (payload.batch_id ? String(payload.batch_id) : undefined),
    }))
    .filter((entry) => entry.partInventoryId && Number.isFinite(entry.quantityDelta) && entry.quantityDelta !== 0);
}

export async function listStockLedgerReportTemplates(
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerReportTemplate[]> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/dashboard/report-templates', {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to load report templates');
  const payload = await parseResponse(response);
  return Array.isArray(payload.output?.records) ? (payload.output?.records as StockLedgerReportTemplate[]) : [];
}

export async function saveStockLedgerReportTemplate(
  input: Partial<StockLedgerReportTemplate> & Pick<StockLedgerReportTemplate, 'name' | 'report_type'>,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerReportTemplate> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/dashboard/report-templates', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify(input),
  });
  await assertResponse(response, 'Failed to save report template');
  const payload = await parseResponse(response);
  return (payload.output?.record || {}) as StockLedgerReportTemplate;
}

export async function listStockLedgerScheduledExports(
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerScheduledExport[]> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/dashboard/scheduled-exports', {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to load scheduled exports');
  const payload = await parseResponse(response);
  return Array.isArray(payload.output?.records) ? (payload.output?.records as StockLedgerScheduledExport[]) : [];
}

export async function createStockLedgerScheduledExport(
  input: {
    template_id: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    timezone?: string;
    destinations?: string[];
    enabled?: boolean;
  },
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerScheduledExport> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/dashboard/scheduled-exports', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify(input),
  });
  await assertResponse(response, 'Failed to create scheduled export');
  const payload = await parseResponse(response);
  return (payload.output?.record || {}) as StockLedgerScheduledExport;
}

export async function runStockLedgerScheduledExportNow(
  scheduleId: string,
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerScheduledExport> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/dashboard/scheduled-exports', {
    method: 'PATCH',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({ id: scheduleId, execute_now: true }),
  });
  await assertResponse(response, 'Failed to execute scheduled export');
  const payload = await parseResponse(response);
  return (payload.output?.record || {}) as StockLedgerScheduledExport;
}

export async function getStockLedgerComplianceDashboard(
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerComplianceDashboard> {
  const response = await fetchImpl('/api/v2/amro/stock-ledger/dashboard/compliance', {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to load compliance dashboard');
  const payload = await parseResponse(response);
  const output = payload.output || {};
  return {
    immutableHashCoveragePercent: Number(output.immutable_hash_coverage_percent || 0),
    pendingApprovals: Number(output.pending_approvals || 0),
    staleApprovals: Number(output.stale_approvals || 0),
    openPeriods: Number(output.open_periods || 0),
    failedReconciliationRuns: Number(output.failed_reconciliation_runs || 0),
    evidenceSnapshot:
      output.evidence_snapshot && typeof output.evidence_snapshot === 'object'
        ? (output.evidence_snapshot as Record<string, number>)
        : {},
  };
}

export async function exportStockLedgerEvidenceBundle(
  format: 'json' | 'csv' = 'json',
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<string> {
  const response = await fetchImpl(`/api/v2/amro/stock-ledger/dashboard/evidence-bundle?format=${encodeURIComponent(format)}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to export evidence bundle');
  const payload = await parseResponse(response);
  if (format === 'csv') return String(payload.output?.csv || '');
  return JSON.stringify(payload.output || {}, null, 2);
}

export async function getStockLedgerCurrencyDashboard(
  baseCurrency = 'USD',
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<StockLedgerCurrencyDashboard> {
  const response = await fetchImpl(`/api/v2/amro/stock-ledger/dashboard/multi-currency?base_currency=${encodeURIComponent(baseCurrency)}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(scope),
  });
  await assertResponse(response, 'Failed to load multi-currency dashboard');
  const payload = await parseResponse(response);
  const output = payload.output || {};
  const rows = Array.isArray(output.records) ? output.records : [];
  return {
    baseCurrency: String(output.base_currency || baseCurrency),
    totalBaseValue: Number(output.total_base_value || 0),
    fxRates: output.fx_rates && typeof output.fx_rates === 'object' ? output.fx_rates as Record<string, number> : {},
    records: rows.map((row) => {
      const rec = row as Record<string, unknown>;
      return {
        currency: String(rec.currency || ''),
        rawTotal: Number(rec.raw_total || 0),
        baseTotal: Number(rec.base_total || 0),
        txnCount: Number(rec.txn_count || 0),
      };
    }),
  };
}

export async function submitStockLedgerScanPosting(
  input: {
    scanMode: 'barcode' | 'rfid' | 'manual';
    eventType: 'receive' | 'issue' | 'transfer' | 'audit' | 'reserve' | 'release';
    scanCode: string;
    quantity: number;
    fromLocation?: string;
    toLocation?: string;
  },
  fetchImpl: FetchLike = fetch,
  scope: AmroApiScope = {},
): Promise<Record<string, unknown>> {
  const response = await fetchImpl('/api/v2/amro/inventory/scan', {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(scope),
    body: JSON.stringify({
      scan_mode: input.scanMode,
      event_type: input.eventType,
      scan_code: input.scanCode,
      quantity: input.quantity,
      from_location: input.fromLocation || null,
      to_location: input.toLocation || null,
      ui_source: 'stock_ledger_p2_scan_mode',
    }),
  });
  await assertResponse(response, 'Failed to process scan posting');
  const payload = await parseResponse(response);
  return payload.output && typeof payload.output === 'object' ? payload.output : {};
}
