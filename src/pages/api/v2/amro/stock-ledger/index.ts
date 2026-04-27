import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { mapStockLedgerRow, parseLedgerListFilters, parsePagination, validateStockLedgerMutation } from './shared';

const REQUIRED_PERMISSIONS = ['inventory.admin', 'inventory.read', 'dashboards.view'];
const SOURCE_ENTITY_TABLES: Record<string, string[]> = {
  procurement: ['amro_purchase_orders', 'amro_procurement_orders', 'purchase_orders'],
  sales: ['amro_sales_orders', 'sales_orders'],
  warehouse: ['amro_warehouse_transactions', 'warehouse_transactions'],
  maintenance: ['amro_work_orders', 'maintenance_work_orders', 'work_orders', 'work_orders'],
  inventory_adjustment: ['amro_inventory_adjustments', 'inventory_adjustments'],
};

const SOURCE_ENTITY_COLUMNS = [
  'id',
  'source_reference',
  'reference_code',
  'order_number',
  'document_number',
  'transaction_number',
  'work_order_number',
  'work_package_number',
];

async function validateSourceReferenceEntity(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  sourceModule?: string,
  sourceReference?: string,
): Promise<void> {
  if (!sourceModule || !sourceReference) return;
  if (sourceModule === 'stock-ledger-ui' || sourceModule === 'stock_ledger_void') return;
  const tables = SOURCE_ENTITY_TABLES[sourceModule];
  if (!tables || tables.length === 0) return;

  const tableErrors: Array<{ table: string; code?: string; message?: string }> = [];
  for (const table of tables) {
    let columnLookupSuccess = false;
    for (const column of SOURCE_ENTITY_COLUMNS) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq(column, sourceReference)
        .limit(1)
        .maybeSingle();

      if (!error && data) return;
      if (error) {
        if (error.code === '42P01' || /does not exist/i.test(String(error.message || ''))) {
          tableErrors.push({ table, code: error.code, message: error.message });
          break;
        }
      }
      if (!error && data === null) {
        columnLookupSuccess = true;
      }
    }
    if (!columnLookupSuccess && tableErrors.every((e) => e.table !== table)) {
      tableErrors.push({ table, message: `No matching record found in ${table}` });
    }
  }

  if (tableErrors.length === tables.length) {
    throw new Error(`source_reference ${sourceReference} was not found for source_module ${sourceModule}`);
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const startedAt = Date.now();
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions || [], REQUIRED_PERMISSIONS);
    const accessContext = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(accessContext, { correlationId: ctx.correlationId });
    const supabase = getSupabaseAdminClient();
    const tenantId = String(accessContext.tenantId || '');
    const franchiseId = accessContext.franchiseId ? String(accessContext.franchiseId) : null;

    if (req.method === 'GET') {
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const filters = parseLedgerListFilters(req.query as Record<string, unknown>);
      const cursor = req.query.cursor ? String(req.query.cursor).trim() : null;

      let query = supabase
        .from('amro_stock_ledger_transactions')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order(filters.sortBy, { ascending: filters.sortDirection === 'asc' });

      if (cursor) {
        // Cursor-based pagination: fetch records after the cursor position
        if (filters.sortDirection === 'asc') {
          query = query.gt(filters.sortBy, cursor);
        } else {
          query = query.lt(filters.sortBy, cursor);
        }
      } else {
        // Offset-based pagination (backward compatible)
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      if (!filters.includeVoided) query = query.eq('is_voided', false);
      if (filters.movementType) query = query.eq('movement_type', filters.movementType);
      if (filters.partInventoryId) query = query.eq('part_inventory_id', filters.partInventoryId);
      if (filters.sourceModule) query = query.eq('source_module', filters.sourceModule);
      if (filters.valuationMethod) query = query.eq('valuation_method', filters.valuationMethod);
      if (filters.effectiveFrom) query = query.gte('effective_at', filters.effectiveFrom);
      if (filters.effectiveTo) query = query.lte('effective_at', filters.effectiveTo);

      query = query.limit(cursor ? pageSize : undefined);

      const { data, error, count } = await query;
      if (error) throw error;

      const records = (data || []).map((row) => mapStockLedgerRow(row as Record<string, unknown>));
      const nextCursor = cursor
        ? (records.length > 0 ? String((records[records.length - 1] as any)[filters.sortBy] || '') : null)
        : null;
      const hasNextPage = cursor
        ? records.length === pageSize
        : page * pageSize < (count ?? 0);
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-list',
        output: {
          records,
          total: count ?? 0,
          page,
          page_size: pageSize,
          next_cursor: nextCursor,
          has_next_page: hasNextPage,
          pagination_mode: cursor ? 'cursor' : 'offset',
          applied_filters: filters,
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    if (req.method === 'POST') {
      const payload = validateStockLedgerMutation(req.body);
      await validateSourceReferenceEntity(
        supabase,
        tenantId,
        payload.source_module,
        payload.source_reference,
      );
      const { data, error } = await supabase.rpc('amro_stock_ledger_post_transaction', {
        p_tenant_id: tenantId,
        p_franchise_id: franchiseId,
        p_user_id: auth.userId,
        p_part_inventory_id: payload.part_inventory_id,
        p_movement_type: payload.movement_type,
        p_quantity_delta: payload.quantity_delta,
        p_unit_cost: payload.unit_cost ?? 0,
        p_currency: payload.currency ?? 'USD',
        p_effective_at: payload.effective_at ?? new Date().toISOString(),
        p_source_module: payload.source_module ?? 'stock-ledger-ui',
        p_source_reference: payload.source_reference ?? null,
        p_notes: payload.notes ?? null,
        p_metadata: payload.metadata ?? {},
        p_valuation_method: payload.valuation_method ?? 'weighted_average',
        p_idempotency_key: payload.idempotency_key ?? null,
      });
      if (error) throw error;
      res.status(201).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-create',
        output: {
          record: mapStockLedgerRow((data as unknown as Record<string, unknown>) || {}),
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
