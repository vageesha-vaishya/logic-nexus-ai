export type MovementType =
  | 'receipt'
  | 'issue'
  | 'consume'
  | 'reserve'
  | 'release'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'return';

export type StockLedgerMutation = {
  part_inventory_id: string;
  movement_type: MovementType;
  quantity_delta: number;
  unit_cost?: number;
  currency?: string;
  effective_at?: string;
  source_module?: string;
  source_reference?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  valuation_method?: 'fifo' | 'lifo' | 'weighted_average';
  idempotency_key?: string;
};

export type ReconciliationPolicy = {
  enabled: boolean;
  frequency_hours: number;
  variance_threshold: number;
  approval_sla_hours: number;
  notify_channels: string[];
};

export type LedgerListFilters = {
  movementType?: MovementType;
  partInventoryId?: string;
  sourceModule?: string;
  valuationMethod?: 'fifo' | 'lifo' | 'weighted_average';
  includeVoided: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  sortBy: 'effective_at' | 'created_at' | 'quantity_delta' | 'total_cost';
  sortDirection: 'asc' | 'desc';
};

const ALLOWED_SOURCE_MODULES = new Set([
  'stock-ledger-ui',
  'procurement',
  'sales',
  'warehouse',
  'maintenance',
  'inventory_adjustment',
  'stock_ledger_void',
]);

const SOURCE_REFERENCE_PATTERNS: Record<string, RegExp> = {
  procurement: /^PO[-_/][A-Za-z0-9._-]+$/i,
  sales: /^SO[-_/][A-Za-z0-9._-]+$/i,
  warehouse: /^(WH|WTX|TX|STK)[-_/][A-Za-z0-9._-]+$/i,
  maintenance: /^(WO|WP|MX)[-_/][A-Za-z0-9._-]+$/i,
  inventory_adjustment: /^ADJ[-_/][A-Za-z0-9._-]+$/i,
  stock_ledger_void: /^void:[A-Za-z0-9-]+$/i,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEFAULT_RECONCILIATION_POLICY: ReconciliationPolicy = {
  enabled: true,
  frequency_hours: 24,
  variance_threshold: 0.01,
  approval_sla_hours: 48,
  notify_channels: ['in_app'],
};

export function isValidMovementType(value: string): value is MovementType {
  return [
    'receipt',
    'issue',
    'consume',
    'reserve',
    'release',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'return',
  ].includes(value);
}

export function parseNumber(value: unknown, field: string): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`${field} must be a valid number`);
  return numeric;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function isValidSourceModule(value: string): boolean {
  return ALLOWED_SOURCE_MODULES.has(value);
}

export function validateSourceReferenceForModule(sourceModule: string, sourceReference?: string): void {
  if (sourceModule === 'stock-ledger-ui') return;
  const value = String(sourceReference || '').trim();
  if (!value) {
    throw new Error(`source_reference is required for source_module ${sourceModule}`);
  }
  const expectedPattern = SOURCE_REFERENCE_PATTERNS[sourceModule];
  if (!expectedPattern) return;
  if (!expectedPattern.test(value) && !isUuid(value)) {
    throw new Error(
      `Invalid source_reference format for ${sourceModule}. Expected ${expectedPattern.source} or UUID format.`,
    );
  }
}

function parseInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

export function parseReconciliationPolicy(
  value: unknown,
  fallback: ReconciliationPolicy = DEFAULT_RECONCILIATION_POLICY,
): ReconciliationPolicy {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const frequencyHours = Math.min(168, Math.max(1, parseInteger(record.frequency_hours, fallback.frequency_hours)));
  const approvalSlaHours = Math.min(720, Math.max(1, parseInteger(record.approval_sla_hours, fallback.approval_sla_hours)));
  const varianceThresholdRaw = Number(record.variance_threshold ?? fallback.variance_threshold);
  const varianceThreshold = Number.isFinite(varianceThresholdRaw)
    ? Math.max(0, varianceThresholdRaw)
    : fallback.variance_threshold;
  const notifyChannels = Array.isArray(record.notify_channels)
    ? record.notify_channels.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : fallback.notify_channels;

  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : fallback.enabled,
    frequency_hours: frequencyHours,
    variance_threshold: varianceThreshold,
    approval_sla_hours: approvalSlaHours,
    notify_channels: notifyChannels.length > 0 ? notifyChannels : fallback.notify_channels,
  };
}

export function validateStockLedgerMutation(body: unknown): StockLedgerMutation {
  if (!body || typeof body !== 'object') throw new Error('Request body must be an object');
  const record = body as Record<string, unknown>;
  const partInventoryId = String(record.part_inventory_id || '').trim();
  if (!partInventoryId) throw new Error('part_inventory_id is required');

  const movementType = String(record.movement_type || '').trim();
  if (!isValidMovementType(movementType)) throw new Error(`Invalid movement_type: ${movementType}`);

  const quantityDelta = parseNumber(record.quantity_delta, 'quantity_delta');
  if (quantityDelta === 0) throw new Error('quantity_delta cannot be zero');

  const unitCost = record.unit_cost === undefined ? undefined : parseNumber(record.unit_cost, 'unit_cost');
  if (unitCost !== undefined && unitCost < 0) throw new Error('unit_cost cannot be negative');
  const sourceModule = record.source_module ? String(record.source_module).trim() : 'stock-ledger-ui';
  if (!isValidSourceModule(sourceModule)) {
    throw new Error(`Invalid source_module: ${sourceModule}`);
  }
  const sourceReference = record.source_reference ? String(record.source_reference).trim() : '';
  validateSourceReferenceForModule(sourceModule, sourceReference);

  return {
    part_inventory_id: partInventoryId,
    movement_type: movementType,
    quantity_delta: quantityDelta,
    unit_cost: unitCost,
    currency: record.currency ? String(record.currency) : undefined,
    effective_at: record.effective_at ? String(record.effective_at) : undefined,
    source_module: sourceModule,
    source_reference: sourceReference || undefined,
    notes: record.notes ? String(record.notes) : undefined,
    metadata: typeof record.metadata === 'object' && record.metadata !== null ? (record.metadata as Record<string, unknown>) : undefined,
    valuation_method: (record.valuation_method as 'fifo' | 'lifo' | 'weighted_average' | undefined) || undefined,
    idempotency_key: record.idempotency_key ? String(record.idempotency_key).trim() : undefined,
  };
}

export function mapStockLedgerRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    franchise_id: row.franchise_id,
    part_inventory_id: row.part_inventory_id,
    movement_type: row.movement_type,
    valuation_method: row.valuation_method,
    quantity_delta: row.quantity_delta,
    balance_after: row.balance_after,
    unit_cost: row.unit_cost,
    total_cost: row.total_cost,
    currency: row.currency,
    effective_at: row.effective_at,
    source_module: row.source_module,
    source_reference: row.source_reference,
    notes: row.notes,
    metadata: row.metadata || {},
    idempotency_key: row.idempotency_key || null,
    is_voided: row.is_voided ?? false,
    voided_at: row.voided_at || null,
    void_reason: row.void_reason || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function parsePagination(query: Record<string, unknown>): { page: number; pageSize: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.page_size) || Number(query.limit) || 50));
  return { page, pageSize };
}

export function parseLedgerListFilters(query: Record<string, unknown>): LedgerListFilters {
  const movementTypeRaw = String(query.movement_type || '').trim();
  const movementType = movementTypeRaw && isValidMovementType(movementTypeRaw) ? movementTypeRaw : undefined;
  const sortByRaw = String(query.sort_by || 'effective_at').trim() as LedgerListFilters['sortBy'];
  const sortBy: LedgerListFilters['sortBy'] =
    ['effective_at', 'created_at', 'quantity_delta', 'total_cost'].includes(sortByRaw) ? sortByRaw : 'effective_at';
  const sortDirectionRaw = String(query.sort_dir || 'desc').trim().toLowerCase();
  const sortDirection: LedgerListFilters['sortDirection'] = sortDirectionRaw === 'asc' ? 'asc' : 'desc';
  const includeVoidedRaw = String(query.include_voided || '').trim().toLowerCase();
  return {
    movementType,
    partInventoryId: query.part_inventory_id ? String(query.part_inventory_id).trim() : undefined,
    sourceModule: query.source_module ? String(query.source_module).trim() : undefined,
    valuationMethod: query.valuation_method ? String(query.valuation_method).trim() as LedgerListFilters['valuationMethod'] : undefined,
    includeVoided: includeVoidedRaw === 'true' || includeVoidedRaw === '1',
    effectiveFrom: query.effective_from ? String(query.effective_from) : undefined,
    effectiveTo: query.effective_to ? String(query.effective_to) : undefined,
    sortBy,
    sortDirection,
  };
}
