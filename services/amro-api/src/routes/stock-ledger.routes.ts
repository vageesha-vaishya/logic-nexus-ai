import { Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import type { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

type JsonRecord = Record<string, unknown>;

const router = Router();
const MUTATION_ALLOWED_ROLES = new Set([
  'platform_admin',
  'tenant_admin',
  'maintenance_manager',
  'inventory_controller',
  'storekeeper',
]);

function getSupabaseAdminClient(): SupabaseClient {
  const url = String(
    process.env.AMRO_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '',
  ).replace(/\/$/, '');
  const serviceKey = String(
    process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      '',
  ).trim();
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceKey);
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function toNullableText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function toUpperText(value: unknown, fallback = ''): string {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || fallback;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parsePagination(req: AuthRequest): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(500, Number(req.query.page_size || req.query.pageSize || 50) || 50));
  return { page, pageSize };
}

function resolveUserRole(req: AuthRequest): string | null {
  const fromUser = String((req.user as JsonRecord | undefined)?.role || '').trim().toLowerCase();
  if (fromUser) return fromUser;
  const fromHeader = String(req.headers['x-user-role'] || '').trim().toLowerCase();
  return fromHeader || null;
}

function enforceMutationRole(req: AuthRequest, res: Parameters<typeof asyncHandler>[0] extends (req: any, res: infer R, next: any)=>any ? R : never): boolean {
  const strict = String(process.env.AMRO_STOCK_LEDGER_STRICT_RBAC || 'false').trim().toLowerCase();
  const role = resolveUserRole(req);
  if (!strict || strict === '0' || strict === 'false' || strict === 'off') return true;
  if (!role || !MUTATION_ALLOWED_ROLES.has(role)) {
    res.status(403).json({
      error: 'Forbidden: missing required role for stock ledger mutation',
      code: 'FORBIDDEN',
      statusCode: 403,
      details: {
        required_roles: Array.from(MUTATION_ALLOWED_ROLES),
      },
    });
    return false;
  }
  return true;
}

function mapLedgerRow(row: JsonRecord): JsonRecord {
  return {
    id: String(row.id || ''),
    partInventoryId: String(row.part_inventory_id || ''),
    movementType: String(row.movement_type || ''),
    valuationMethod: String(row.valuation_method || ''),
    quantityDelta: Number(row.quantity_delta || 0),
    balanceAfter: row.balance_after === null || row.balance_after === undefined ? null : Number(row.balance_after),
    unitCost: Number(row.unit_cost || 0),
    totalCost: Number(row.total_cost || 0),
    currency: String(row.currency || 'USD'),
    effectiveAt: String(row.effective_at || ''),
    batchId: toNullableText(row.batch_id),
    sourceModule: toNullableText(row.source_module),
    sourceReference: toNullableText(row.source_reference),
    notes: toNullableText(row.notes),
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: String(row.created_at || ''),
  };
}

async function validatePartAndStock(
  supabase: SupabaseClient,
  tenantId: string,
  partInventoryId: string,
  quantityDelta: number,
): Promise<{ ok: boolean; message?: string; part?: JsonRecord }> {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select('id, quantity_on_hand, quantity_reserved, part_number, warehouse_location')
    .eq('tenant_id', tenantId)
    .eq('id', partInventoryId)
    .limit(1)
    .maybeSingle();
  if (error) {
    return { ok: false, message: `Failed to validate part record: ${error.message}` };
  }
  if (!data) {
    return { ok: false, message: 'Part inventory record not found' };
  }
  const currentOnHand = Number(data.quantity_on_hand || 0);
  const projectedOnHand = currentOnHand + quantityDelta;
  if (projectedOnHand < 0) {
    return { ok: false, message: `Negative stock prevention triggered. Current on hand=${currentOnHand}, delta=${quantityDelta}` };
  }
  return { ok: true, part: data as JsonRecord };
}

async function applyInventoryBalanceMutation(
  supabase: SupabaseClient,
  tenantId: string,
  partInventoryId: string,
  quantityDelta: number,
  userId: string,
): Promise<{ ok: boolean; message?: string; balanceAfter?: number }> {
  const validation = await validatePartAndStock(supabase, tenantId, partInventoryId, quantityDelta);
  if (!validation.ok || !validation.part) return { ok: false, message: validation.message };
  const currentOnHand = Number(validation.part.quantity_on_hand || 0);
  const balanceAfter = currentOnHand + quantityDelta;

  const { error } = await supabase
    .from('parts_inventory')
    .update({
      quantity_on_hand: balanceAfter,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', partInventoryId);
  if (error) return { ok: false, message: `Failed to update stock balance: ${error.message}` };
  return { ok: true, balanceAfter };
}

function buildImmutableHash(input: JsonRecord): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

async function writeAuditEvent(params: {
  supabase: SupabaseClient;
  tenantId: string;
  franchiseId: string | null;
  actorUserId: string | null;
  eventType: string;
  referenceId?: string | null;
  payload: JsonRecord;
}): Promise<void> {
  const immutableHash = buildImmutableHash({
    tenant_id: params.tenantId,
    event_type: params.eventType,
    reference_id: params.referenceId || null,
    payload: params.payload,
    at: new Date().toISOString(),
  });
  await params.supabase.from('amro_stock_audit_timeline').insert({
    tenant_id: params.tenantId,
    franchise_id: params.franchiseId,
    actor_user_id: params.actorUserId,
    event_type: params.eventType,
    event_category: 'stock-ledger',
    reference_id: params.referenceId || null,
    event_payload: params.payload,
    immutable_hash: immutableHash,
  });
}

async function resolveClosedPeriodForDate(
  supabase: SupabaseClient,
  tenantId: string,
  effectiveAt: string,
): Promise<JsonRecord | null> {
  const isoDate = new Date(effectiveAt).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('amro_stock_period_closes')
    .select('id,period_code,period_start,period_end,close_status')
    .eq('tenant_id', tenantId)
    .eq('close_status', 'closed')
    .lte('period_start', isoDate)
    .gte('period_end', isoDate)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data ? (data as JsonRecord) : null;
}

function movementAffectsValuation(movementType: string): boolean {
  return !['reserve', 'release'].includes(movementType);
}

async function applyValuationForTransaction(params: {
  supabase: SupabaseClient;
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  transactionId: string;
  partInventoryId: string;
  movementType: string;
  valuationMethod: string;
  quantityDelta: number;
  unitCost: number;
}): Promise<{ ok: boolean; message?: string; effectiveUnitCost?: number }> {
  if (!movementAffectsValuation(params.movementType)) return { ok: true, effectiveUnitCost: params.unitCost };
  const method = params.valuationMethod;
  const qty = params.quantityDelta;
  const absQty = Math.abs(qty);
  const isInbound = qty > 0;

  if (isInbound) {
    if (method === 'weighted_average') {
      const { data: layer, error: layerError } = await params.supabase
        .from('amro_stock_valuation_layers')
        .select('id,available_quantity,unit_cost')
        .eq('tenant_id', params.tenantId)
        .eq('part_inventory_id', params.partInventoryId)
        .eq('valuation_method', 'weighted_average')
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (layerError) return { ok: false, message: `Failed to load weighted-average layer: ${layerError.message}` };
      if (layer?.id) {
        const currentQty = Number(layer.available_quantity || 0);
        const currentUnitCost = Number(layer.unit_cost || 0);
        const nextQty = currentQty + absQty;
        const nextUnitCost = nextQty > 0
          ? ((currentQty * currentUnitCost) + (absQty * params.unitCost)) / nextQty
          : params.unitCost;
        const { error: updateError } = await params.supabase
          .from('amro_stock_valuation_layers')
          .update({
            available_quantity: nextQty,
            unit_cost: nextUnitCost,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', params.tenantId)
          .eq('id', layer.id);
        if (updateError) return { ok: false, message: `Failed to update weighted-average layer: ${updateError.message}` };
      } else {
        const { error: insertError } = await params.supabase
          .from('amro_stock_valuation_layers')
          .insert({
            tenant_id: params.tenantId,
            franchise_id: params.franchiseId,
            part_inventory_id: params.partInventoryId,
            valuation_method: 'weighted_average',
            inbound_transaction_id: params.transactionId,
            available_quantity: absQty,
            unit_cost: params.unitCost,
            consumed_quantity: 0,
            created_by: params.userId,
          });
        if (insertError) return { ok: false, message: `Failed to create weighted-average layer: ${insertError.message}` };
      }
      return { ok: true, effectiveUnitCost: params.unitCost };
    }

    const { error: insertLayerError } = await params.supabase
      .from('amro_stock_valuation_layers')
      .insert({
        tenant_id: params.tenantId,
        franchise_id: params.franchiseId,
        part_inventory_id: params.partInventoryId,
        valuation_method: method,
        inbound_transaction_id: params.transactionId,
        available_quantity: absQty,
        unit_cost: params.unitCost,
        consumed_quantity: 0,
        created_by: params.userId,
      });
    if (insertLayerError) return { ok: false, message: `Failed to create valuation layer: ${insertLayerError.message}` };
    return { ok: true, effectiveUnitCost: params.unitCost };
  }

  const layerOrderAscending = method !== 'lifo';
  const { data: layers, error: layersError } = await params.supabase
    .from('amro_stock_valuation_layers')
    .select('id,available_quantity,unit_cost')
    .eq('tenant_id', params.tenantId)
    .eq('part_inventory_id', params.partInventoryId)
    .eq('valuation_method', method)
    .gt('available_quantity', 0)
    .order('received_at', { ascending: layerOrderAscending });
  if (layersError) return { ok: false, message: `Failed to load valuation layers: ${layersError.message}` };

  let remaining = absQty;
  let totalCost = 0;
  for (const layerEntry of layers || []) {
    if (remaining <= 0) break;
    const layer = layerEntry as JsonRecord;
    const available = Number(layer.available_quantity || 0);
    const consumeQty = Math.min(available, remaining);
    if (consumeQty <= 0) continue;
    const unitCost = Number(layer.unit_cost || 0);
    const nextAvailable = available - consumeQty;
    totalCost += consumeQty * unitCost;
    remaining -= consumeQty;
    const { error: layerUpdateError } = await params.supabase
      .from('amro_stock_valuation_layers')
      .update({
        available_quantity: nextAvailable,
        consumed_quantity: Number(layer.consumed_quantity || 0) + consumeQty,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', params.tenantId)
      .eq('id', String(layer.id));
    if (layerUpdateError) return { ok: false, message: `Failed to update valuation layer: ${layerUpdateError.message}` };
    const { error: consumeInsertError } = await params.supabase
      .from('amro_stock_valuation_consumptions')
      .insert({
        tenant_id: params.tenantId,
        franchise_id: params.franchiseId,
        ledger_transaction_id: params.transactionId,
        valuation_layer_id: String(layer.id),
        consumed_quantity: consumeQty,
        unit_cost: unitCost,
        metadata: { movement_type: params.movementType },
      });
    if (consumeInsertError) return { ok: false, message: `Failed to insert valuation consumption: ${consumeInsertError.message}` };
  }
  if (remaining > 0.0000001) {
    return { ok: false, message: `Insufficient valuation layers for ${method}. Missing quantity ${remaining}` };
  }
  const effectiveUnitCost = absQty > 0 ? totalCost / absQty : params.unitCost;
  return { ok: true, effectiveUnitCost };
}

router.get('/amro/stock-ledger', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const tenantId = String(req.tenantId);
  const { page, pageSize } = parsePagination(req);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const movementType = String(req.query.movement_type || req.query.movementType || '').trim().toLowerCase();
  const partInventoryId = String(req.query.part_inventory_id || req.query.partInventoryId || '').trim();
  const batchId = String(req.query.batch_id || req.query.batchId || '').trim();
  const search = String(req.query.search || '').trim();
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from('amro_stock_ledger_transactions')
    .select('id,part_inventory_id,movement_type,valuation_method,quantity_delta,balance_after,unit_cost,total_cost,currency,effective_at,batch_id,source_module,source_reference,notes,metadata,created_at', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('effective_at', { ascending: false })
    .range(from, to);
  if (movementType) query = query.eq('movement_type', movementType);
  if (partInventoryId) query = query.eq('part_inventory_id', partInventoryId);
  if (batchId) query = query.eq('batch_id', batchId);
  if (search) query = query.or(`source_reference.ilike.%${search}%,notes.ilike.%${search}%,source_module.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) {
    res.status(500).json({ error: `Failed to query stock ledger records: ${error.message}`, code: 'STOCK_LEDGER_QUERY_FAILED', statusCode: 500 });
    return;
  }
  res.status(200).json({
    version: 'v2',
    interface: 'amro-stock-ledger-list',
    output: {
      page,
      page_size: pageSize,
      total: Number(count || 0),
      records: (data || []).map((row) => mapLedgerRow(row as JsonRecord)),
    },
  });
}));

router.get('/amro/stock-ledger/:id([0-9a-fA-F-]{36})', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const tenantId = String(req.tenantId);
  const id = String(req.params.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_ledger_transactions')
    .select('id,part_inventory_id,movement_type,valuation_method,quantity_delta,balance_after,unit_cost,total_cost,currency,effective_at,batch_id,source_module,source_reference,notes,metadata,created_at')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .limit(1)
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: `Failed to query stock ledger record: ${error.message}`, code: 'STOCK_LEDGER_QUERY_FAILED', statusCode: 500 });
    return;
  }
  if (!data) {
    res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND', statusCode: 404 });
    return;
  }
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-detail', output: { record: mapLedgerRow(data as JsonRecord) } });
}));

router.post('/amro/stock-ledger', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
    return;
  }
  if (!enforceMutationRole(req, res)) return;

  const tenantId = String(req.tenantId);
  const payload = asObject(req.body);
  const partInventoryId = String(payload.part_inventory_id || payload.partInventoryId || '').trim();
  const movementType = String(payload.movement_type || payload.movementType || '').trim().toLowerCase();
  const valuationMethod = String(payload.valuation_method || payload.valuationMethod || 'weighted_average').trim().toLowerCase();
  const quantityDelta = toFiniteNumber(payload.quantity_delta ?? payload.quantityDelta, 0);
  const unitCost = toFiniteNumber(payload.unit_cost ?? payload.unitCost, 0);
  const currency = toUpperText(payload.currency || 'USD', 'USD');
  const sourceModule = toNullableText(payload.source_module || payload.sourceModule);
  const sourceReference = toNullableText(payload.source_reference || payload.sourceReference);
  const notes = toNullableText(payload.notes);
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const effectiveAt = String(payload.effective_at || payload.effectiveAt || new Date().toISOString());
  if (!partInventoryId || !movementType || !Number.isFinite(quantityDelta) || quantityDelta === 0) {
    res.status(400).json({
      error: 'part_inventory_id, movement_type, and non-zero quantity_delta are required',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    return;
  }

  const supabase = getSupabaseAdminClient();
  const franchiseId = req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null;
  const closedPeriod = await resolveClosedPeriodForDate(supabase, tenantId, effectiveAt);
  if (closedPeriod) {
    const createApprovalRequest = payload.create_approval_request === true || payload.createApprovalRequest === true;
    if (createApprovalRequest) {
      const { data: approvalRow } = await supabase
        .from('amro_stock_approval_queue')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          request_type: 'backdated_posting',
          request_status: 'pending',
          requested_by: req.userId,
          reason: `Posting attempted in closed period ${String(closedPeriod.period_code || '')}`,
          metadata: { requested_payload: payload, closed_period: closedPeriod },
        })
        .select('id')
        .limit(1)
        .maybeSingle();
      await writeAuditEvent({
        supabase,
        tenantId,
        franchiseId,
        actorUserId: String(req.userId),
        eventType: 'approval.requested',
        referenceId: approvalRow?.id ? String(approvalRow.id) : null,
        payload: { request_type: 'backdated_posting', period: closedPeriod },
      });
      res.status(409).json({
        error: `Posting locked for closed period ${String(closedPeriod.period_code || '')}. Approval request queued.`,
        code: 'POSTING_LOCKED_CLOSED_PERIOD',
        statusCode: 409,
        output: { approval_request_id: approvalRow?.id || null },
      });
      return;
    }
    res.status(409).json({
      error: `Posting locked for closed period ${String(closedPeriod.period_code || '')}. Set createApprovalRequest=true to queue approval.`,
      code: 'POSTING_LOCKED_CLOSED_PERIOD',
      statusCode: 409,
    });
    return;
  }
  const mutation = await applyInventoryBalanceMutation(supabase, tenantId, partInventoryId, quantityDelta, String(req.userId));
  if (!mutation.ok) {
    res.status(409).json({ error: mutation.message || 'Stock mutation rejected', code: 'NEGATIVE_STOCK_PREVENTED', statusCode: 409 });
    return;
  }

  const insertPayload = {
    tenant_id: tenantId,
    franchise_id: franchiseId,
    part_inventory_id: partInventoryId,
    movement_type: movementType,
    valuation_method: valuationMethod,
    quantity_delta: quantityDelta,
    balance_after: mutation.balanceAfter ?? null,
    unit_cost: unitCost,
    currency,
    batch_id: payload.batch_id || payload.batchId || null,
    source_module: sourceModule,
    source_reference: sourceReference,
    notes,
    metadata,
    effective_at: effectiveAt,
    created_by: req.userId,
    updated_by: req.userId,
  };

  const { data, error } = await supabase
    .from('amro_stock_ledger_transactions')
    .insert(insertPayload)
    .select('id,part_inventory_id,movement_type,valuation_method,quantity_delta,balance_after,unit_cost,total_cost,currency,effective_at,batch_id,source_module,source_reference,notes,metadata,created_at')
    .limit(1)
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: `Failed to create stock ledger transaction: ${error.message}`, code: 'STOCK_LEDGER_CREATE_FAILED', statusCode: 500 });
    return;
  }
  const transactionId = String(data?.id || '');
  const valuationResult = await applyValuationForTransaction({
    supabase,
    tenantId,
    franchiseId,
    userId: String(req.userId),
    transactionId,
    partInventoryId,
    movementType,
    valuationMethod,
    quantityDelta,
    unitCost,
  });
  if (!valuationResult.ok) {
    res.status(409).json({
      error: valuationResult.message || 'Valuation posting failed',
      code: 'VALUATION_POSTING_FAILED',
      statusCode: 409,
    });
    return;
  }
  if (valuationResult.effectiveUnitCost !== undefined && Math.abs(valuationResult.effectiveUnitCost - unitCost) > 0.000001) {
    await supabase
      .from('amro_stock_ledger_transactions')
      .update({
        unit_cost: valuationResult.effectiveUnitCost,
        updated_by: req.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', transactionId);
    (data as JsonRecord).unit_cost = valuationResult.effectiveUnitCost;
    (data as JsonRecord).total_cost = Math.abs(quantityDelta) * valuationResult.effectiveUnitCost;
  }
  await writeAuditEvent({
    supabase,
    tenantId,
    franchiseId,
    actorUserId: String(req.userId),
    eventType: 'ledger.transaction.created',
    referenceId: transactionId,
    payload: {
      movement_type: movementType,
      valuation_method: valuationMethod,
      quantity_delta: quantityDelta,
      balance_after: mutation.balanceAfter ?? null,
    },
  });
  res.status(201).json({
    version: 'v2',
    interface: 'amro-stock-ledger-create',
    output: { record: mapLedgerRow((data || {}) as JsonRecord) },
  });
}));

router.post('/amro/stock-ledger/batch', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
    return;
  }
  if (!enforceMutationRole(req, res)) return;
  const payload = asObject(req.body);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (entries.length === 0) {
    res.status(400).json({ error: 'entries[] is required', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  if (entries.length > 500) {
    res.status(400).json({ error: 'entries[] exceeds batch limit (500)', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }

  const tenantId = String(req.tenantId);
  const supabase = getSupabaseAdminClient();
  const franchiseId = req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null;
  const batchId = payload.batch_id || payload.batchId || crypto.randomUUID();
  const created: JsonRecord[] = [];
  const rejected: JsonRecord[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = asObject(entries[index]);
    const partInventoryId = String(entry.part_inventory_id || entry.partInventoryId || '').trim();
    const movementType = String(entry.movement_type || entry.movementType || '').trim().toLowerCase();
    const valuationMethod = String(entry.valuation_method || entry.valuationMethod || 'weighted_average').trim().toLowerCase();
    const quantityDelta = toFiniteNumber(entry.quantity_delta ?? entry.quantityDelta, 0);
    const unitCost = toFiniteNumber(entry.unit_cost ?? entry.unitCost, 0);
    const effectiveAt = String(entry.effective_at || entry.effectiveAt || new Date().toISOString());
    if (!partInventoryId || !movementType || !Number.isFinite(quantityDelta) || quantityDelta === 0) {
      rejected.push({ index, reason: 'invalid payload', entry });
      continue;
    }
    const closedPeriod = await resolveClosedPeriodForDate(supabase, tenantId, effectiveAt);
    if (closedPeriod) {
      rejected.push({ index, reason: `posting locked for closed period ${String(closedPeriod.period_code || '')}`, entry });
      continue;
    }
    const mutation = await applyInventoryBalanceMutation(supabase, tenantId, partInventoryId, quantityDelta, String(req.userId));
    if (!mutation.ok) {
      rejected.push({ index, reason: mutation.message || 'negative stock prevented', entry });
      continue;
    }

    const { data, error } = await supabase
      .from('amro_stock_ledger_transactions')
      .insert({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        part_inventory_id: partInventoryId,
        movement_type: movementType,
        valuation_method: valuationMethod,
        quantity_delta: quantityDelta,
        balance_after: mutation.balanceAfter ?? null,
        unit_cost: unitCost,
        currency: toUpperText(entry.currency || 'USD', 'USD'),
        batch_id: batchId,
        source_module: toNullableText(entry.source_module || entry.sourceModule),
        source_reference: toNullableText(entry.source_reference || entry.sourceReference),
        notes: toNullableText(entry.notes),
        metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
        effective_at: effectiveAt,
        created_by: req.userId,
        updated_by: req.userId,
      })
      .select('id,part_inventory_id,movement_type,valuation_method,quantity_delta,balance_after,unit_cost,total_cost,currency,effective_at,batch_id,source_module,source_reference,notes,metadata,created_at')
      .limit(1)
      .maybeSingle();
    if (error) {
      rejected.push({ index, reason: error.message, entry });
      continue;
    }
    const transactionId = String(data?.id || '');
    const valuationResult = await applyValuationForTransaction({
      supabase,
      tenantId,
      franchiseId,
      userId: String(req.userId),
      transactionId,
      partInventoryId,
      movementType,
      valuationMethod,
      quantityDelta,
      unitCost,
    });
    if (!valuationResult.ok) {
      rejected.push({ index, reason: valuationResult.message || 'valuation failed', entry });
      continue;
    }
    if (valuationResult.effectiveUnitCost !== undefined && Math.abs(valuationResult.effectiveUnitCost - unitCost) > 0.000001) {
      await supabase
        .from('amro_stock_ledger_transactions')
        .update({
          unit_cost: valuationResult.effectiveUnitCost,
          updated_by: req.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', transactionId);
      (data as JsonRecord).unit_cost = valuationResult.effectiveUnitCost;
      (data as JsonRecord).total_cost = Math.abs(quantityDelta) * valuationResult.effectiveUnitCost;
    }
    await writeAuditEvent({
      supabase,
      tenantId,
      franchiseId,
      actorUserId: String(req.userId),
      eventType: 'ledger.transaction.created',
      referenceId: transactionId,
      payload: {
        movement_type: movementType,
        valuation_method: valuationMethod,
        quantity_delta: quantityDelta,
        batch_id: String(batchId),
      },
    });
    created.push(mapLedgerRow((data || {}) as JsonRecord));
  }

  res.status(201).json({
    version: 'v2',
    interface: 'amro-stock-ledger-batch-create',
    output: {
      batch_id: String(batchId),
      created_count: created.length,
      rejected_count: rejected.length,
      records: created,
      rejected,
    },
  });
}));

router.post('/amro/stock-ledger/reconcile', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
    return;
  }
  if (!enforceMutationRole(req, res)) return;
  const tenantId = String(req.tenantId);
  const supabase = getSupabaseAdminClient();

  const { data: run, error: runError } = await supabase
    .from('amro_stock_reconciliation_runs')
    .insert({
      tenant_id: tenantId,
      franchise_id: req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null,
      run_status: 'running',
      requested_by: req.userId,
      started_at: new Date().toISOString(),
      parameters: asObject(req.body),
    })
    .select('id')
    .limit(1)
    .maybeSingle();
  if (runError || !run?.id) {
    res.status(500).json({ error: `Failed to initialize reconciliation run: ${runError?.message || 'unknown error'}`, code: 'RECONCILIATION_RUN_FAILED', statusCode: 500 });
    return;
  }
  const runId = String(run.id);

  const { data: balances, error: balanceError } = await supabase
    .from('amro_stock_balance_summary')
    .select('tenant_id,part_inventory_id,current_on_hand,ledger_net_quantity')
    .eq('tenant_id', tenantId);
  if (balanceError) {
    await supabase.from('amro_stock_reconciliation_runs').update({
      run_status: 'failed',
      completed_at: new Date().toISOString(),
      summary: { error: balanceError.message },
    }).eq('tenant_id', tenantId).eq('id', runId);
    res.status(500).json({ error: `Failed to evaluate balances: ${balanceError.message}`, code: 'RECONCILIATION_RUN_FAILED', statusCode: 500 });
    return;
  }

  const varianceRows = (balances || [])
    .map((row) => {
      const expected = Number((row as JsonRecord).ledger_net_quantity || 0);
      const actual = Number((row as JsonRecord).current_on_hand || 0);
      const variance = actual - expected;
      return {
        tenant_id: tenantId,
        run_id: runId,
        part_inventory_id: String((row as JsonRecord).part_inventory_id || ''),
        expected_quantity: expected,
        actual_quantity: actual,
        variance_quantity: variance,
        variance_cost: 0,
        variance_reason: Math.abs(variance) > 0 ? 'ledger_balance_mismatch' : null,
        metadata: {},
      };
    })
    .filter((row) => row.part_inventory_id);

  if (varianceRows.length > 0) {
    await supabase.from('amro_stock_reconciliation_items').insert(varianceRows);
  }
  const varianceCount = varianceRows.filter((row) => Math.abs(row.variance_quantity) > 0).length;
  await supabase.from('amro_stock_reconciliation_runs').update({
    run_status: 'completed',
    completed_at: new Date().toISOString(),
    summary: {
      inspected_items: varianceRows.length,
      variance_items: varianceCount,
    },
  }).eq('tenant_id', tenantId).eq('id', runId);
  await writeAuditEvent({
    supabase,
    tenantId,
    franchiseId: req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null,
    actorUserId: String(req.userId),
    eventType: 'ledger.reconciliation.completed',
    referenceId: runId,
    payload: {
      inspected_items: varianceRows.length,
      variance_items: varianceCount,
    },
  });

  res.status(200).json({
    version: 'v2',
    interface: 'amro-stock-ledger-reconcile',
    output: {
      run_id: runId,
      inspected_items: varianceRows.length,
      variance_items: varianceCount,
    },
  });
}));

router.get('/amro/stock-ledger/periods', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_period_closes')
    .select('*')
    .eq('tenant_id', req.tenantId)
    .order('period_end', { ascending: false });
  if (error) {
    res.status(500).json({ error: `Failed to load stock periods: ${error.message}`, code: 'PERIOD_QUERY_FAILED', statusCode: 500 });
    return;
  }
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-period-list', output: { records: data || [] } });
}));

router.post('/amro/stock-ledger/periods/open', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
    return;
  }
  if (!enforceMutationRole(req, res)) return;
  const payload = asObject(req.body);
  const periodCode = String(payload.period_code || payload.periodCode || '').trim();
  const periodStart = String(payload.period_start || payload.periodStart || '').trim();
  const periodEnd = String(payload.period_end || payload.periodEnd || '').trim();
  if (!periodCode || !periodStart || !periodEnd) {
    res.status(400).json({ error: 'period_code, period_start, period_end are required', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  const tenantId = String(req.tenantId);
  const franchiseId = req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_period_closes')
    .upsert({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      period_code: periodCode,
      period_start: periodStart,
      period_end: periodEnd,
      close_status: 'open',
      valuation_method: String(payload.valuation_method || payload.valuationMethod || 'weighted_average'),
      notes: toNullableText(payload.notes),
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,period_code' })
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) {
    res.status(500).json({ error: `Failed to open period: ${error.message}`, code: 'PERIOD_OPEN_FAILED', statusCode: 500 });
    return;
  }
  await writeAuditEvent({
    supabase,
    tenantId,
    franchiseId,
    actorUserId: String(req.userId),
    eventType: 'period.opened',
    referenceId: data?.id ? String(data.id) : null,
    payload: { period_code: periodCode, period_start: periodStart, period_end: periodEnd },
  });
  res.status(201).json({ version: 'v2', interface: 'amro-stock-ledger-period-open', output: { record: data || null } });
}));

router.post('/amro/stock-ledger/periods/:id/close', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
    return;
  }
  if (!enforceMutationRole(req, res)) return;
  const tenantId = String(req.tenantId);
  const periodId = String(req.params.id || '').trim();
  if (!periodId) {
    res.status(400).json({ error: 'period id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_period_closes')
    .update({
      close_status: 'closed',
      closed_by: req.userId,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: toNullableText(asObject(req.body).notes),
    })
    .eq('tenant_id', tenantId)
    .eq('id', periodId)
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    res.status(500).json({ error: `Failed to close period: ${error?.message || 'not found'}`, code: 'PERIOD_CLOSE_FAILED', statusCode: 500 });
    return;
  }
  await writeAuditEvent({
    supabase,
    tenantId,
    franchiseId: req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null,
    actorUserId: String(req.userId),
    eventType: 'period.closed',
    referenceId: periodId,
    payload: { period_code: String(data.period_code || ''), closed_at: data.closed_at },
  });
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-period-close', output: { record: data } });
}));

router.post('/amro/stock-ledger/periods/:id/reopen-request', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
    return;
  }
  const periodId = String(req.params.id || '').trim();
  if (!periodId) {
    res.status(400).json({ error: 'period id is required', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  const tenantId = String(req.tenantId);
  const franchiseId = req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null;
  const payload = asObject(req.body);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_approval_queue')
    .insert({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      request_type: 'period_reopen',
      request_status: 'pending',
      related_period_id: periodId,
      requested_by: req.userId,
      reason: toNullableText(payload.reason) || 'Period reopen requested',
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    })
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    res.status(500).json({ error: `Failed to create reopen request: ${error?.message || 'unknown error'}`, code: 'PERIOD_REOPEN_REQUEST_FAILED', statusCode: 500 });
    return;
  }
  await writeAuditEvent({
    supabase,
    tenantId,
    franchiseId,
    actorUserId: String(req.userId),
    eventType: 'period.reopen.requested',
    referenceId: periodId,
    payload: { approval_id: String(data.id || ''), reason: String(data.reason || '') },
  });
  res.status(201).json({ version: 'v2', interface: 'amro-stock-ledger-period-reopen-request', output: { record: data } });
}));

router.post('/amro/stock-ledger/periods/:id/reopen', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
    return;
  }
  if (!enforceMutationRole(req, res)) return;
  const periodId = String(req.params.id || '').trim();
  const approvalId = String(asObject(req.body).approval_id || asObject(req.body).approvalId || '').trim();
  if (!periodId || !approvalId) {
    res.status(400).json({ error: 'period id and approval_id are required', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  const tenantId = String(req.tenantId);
  const supabase = getSupabaseAdminClient();
  const { data: approval, error: approvalError } = await supabase
    .from('amro_stock_approval_queue')
    .select('id,request_status,request_type,related_period_id')
    .eq('tenant_id', tenantId)
    .eq('id', approvalId)
    .limit(1)
    .maybeSingle();
  if (approvalError || !approval) {
    res.status(400).json({ error: `Invalid approval reference: ${approvalError?.message || 'not found'}`, code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  if (String(approval.request_status || '') !== 'approved' || String(approval.request_type || '') !== 'period_reopen') {
    res.status(400).json({ error: 'Approval must be approved period_reopen request', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  if (String(approval.related_period_id || '') !== periodId) {
    res.status(400).json({ error: 'Approval does not match target period', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  const { data, error } = await supabase
    .from('amro_stock_period_closes')
    .update({
      close_status: 'reopened',
      reopened_by: req.userId,
      reopened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', periodId)
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    res.status(500).json({ error: `Failed to reopen period: ${error?.message || 'unknown error'}`, code: 'PERIOD_REOPEN_FAILED', statusCode: 500 });
    return;
  }
  await writeAuditEvent({
    supabase,
    tenantId,
    franchiseId: req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null,
    actorUserId: String(req.userId),
    eventType: 'period.reopened',
    referenceId: periodId,
    payload: { approval_id: approvalId, period_code: String(data.period_code || '') },
  });
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-period-reopen', output: { record: data } });
}));

router.get('/amro/stock-ledger/approvals', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const status = String(req.query.status || 'pending').trim().toLowerCase();
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('amro_stock_approval_queue')
    .select('*')
    .eq('tenant_id', req.tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') query = query.eq('request_status', status);
  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: `Failed to load approval queue: ${error.message}`, code: 'APPROVAL_QUERY_FAILED', statusCode: 500 });
    return;
  }
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-approval-list', output: { records: data || [] } });
}));

router.post('/amro/stock-ledger/approvals/:id/decision', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: 'Missing auth context', code: 'MISSING_AUTH_CONTEXT', statusCode: 401 });
    return;
  }
  if (!enforceMutationRole(req, res)) return;
  const payload = asObject(req.body);
  const decision = String(payload.decision || '').trim().toLowerCase();
  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ error: 'decision must be approved or rejected', code: 'VALIDATION_ERROR', statusCode: 400 });
    return;
  }
  const approvalId = String(req.params.id || '').trim();
  const tenantId = String(req.tenantId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_approval_queue')
    .update({
      request_status: decision,
      reviewed_by: req.userId,
      reviewed_at: new Date().toISOString(),
      decision_notes: toNullableText(payload.notes || payload.decision_notes || payload.decisionNotes),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', approvalId)
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    res.status(500).json({ error: `Failed to update approval decision: ${error?.message || 'not found'}`, code: 'APPROVAL_DECISION_FAILED', statusCode: 500 });
    return;
  }
  await writeAuditEvent({
    supabase,
    tenantId,
    franchiseId: req.headers['x-franchise-id'] ? String(req.headers['x-franchise-id']) : null,
    actorUserId: String(req.userId),
    eventType: 'approval.decided',
    referenceId: approvalId,
    payload: { decision, request_type: String(data.request_type || '') },
  });
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-approval-decision', output: { record: data } });
}));

router.get('/amro/stock-ledger/audit', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 200) || 200));
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_audit_timeline')
    .select('*')
    .eq('tenant_id', req.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    res.status(500).json({ error: `Failed to load audit timeline: ${error.message}`, code: 'AUDIT_QUERY_FAILED', statusCode: 500 });
    return;
  }
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-audit-list', output: { records: data || [] } });
}));

router.get('/amro/stock-ledger/audit/export', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_audit_export')
    .select('*')
    .eq('tenant_id', req.tenantId)
    .limit(5000);
  if (error) {
    res.status(500).json({ error: `Failed to export audit timeline: ${error.message}`, code: 'AUDIT_EXPORT_FAILED', statusCode: 500 });
    return;
  }
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-audit-export', output: { records: data || [] } });
}));

router.get('/amro/stock-ledger/reports/stock-balance', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_balance_summary')
    .select('*')
    .eq('tenant_id', req.tenantId)
    .order('part_number', { ascending: true });
  if (error) {
    res.status(500).json({ error: `Failed to build stock balance report: ${error.message}`, code: 'REPORT_GENERATION_FAILED', statusCode: 500 });
    return;
  }
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-report-balance', output: { records: data || [] } });
}));

router.get('/amro/stock-ledger/reports/transaction-history', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const supabase = getSupabaseAdminClient();
  const limit = Math.max(1, Math.min(2000, Number(req.query.limit || 500) || 500));
  const { data, error } = await supabase
    .from('amro_stock_ledger_transactions')
    .select('id,part_inventory_id,movement_type,valuation_method,quantity_delta,balance_after,unit_cost,total_cost,currency,effective_at,batch_id,source_module,source_reference,notes,metadata,created_at')
    .eq('tenant_id', req.tenantId)
    .order('effective_at', { ascending: false })
    .limit(limit);
  if (error) {
    res.status(500).json({ error: `Failed to build transaction history report: ${error.message}`, code: 'REPORT_GENERATION_FAILED', statusCode: 500 });
    return;
  }
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-report-history', output: { records: (data || []).map((row) => mapLedgerRow(row as JsonRecord)) } });
}));

router.get('/amro/stock-ledger/reports/valuation-summary', asyncHandler(async (req: AuthRequest, res) => {
  if (!req.tenantId) {
    res.status(401).json({ error: 'Missing tenant context', code: 'MISSING_TENANT', statusCode: 401 });
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('amro_stock_valuation_summary')
    .select('*')
    .eq('tenant_id', req.tenantId)
    .order('part_number', { ascending: true });
  if (error) {
    res.status(500).json({ error: `Failed to build valuation summary report: ${error.message}`, code: 'REPORT_GENERATION_FAILED', statusCode: 500 });
    return;
  }
  res.status(200).json({ version: 'v2', interface: 'amro-stock-ledger-report-valuation', output: { records: data || [] } });
}));

export default router;
