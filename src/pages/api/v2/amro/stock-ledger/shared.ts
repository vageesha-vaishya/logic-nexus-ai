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

  return {
    part_inventory_id: partInventoryId,
    movement_type: movementType,
    quantity_delta: quantityDelta,
    unit_cost: unitCost,
    currency: record.currency ? String(record.currency) : undefined,
    effective_at: record.effective_at ? String(record.effective_at) : undefined,
    source_module: record.source_module ? String(record.source_module) : undefined,
    source_reference: record.source_reference ? String(record.source_reference) : undefined,
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
