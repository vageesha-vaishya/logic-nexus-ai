import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
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
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_INVENTORY_V2_ENABLED, true);
}

function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

function parsePositiveNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error(`${fieldName} must be > 0`);
  return num;
}

function generatePoNumber(): string {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PO-${yyyymmdd}-${rand}`;
}

type PoStatus = 'draft' | 'submitted' | 'acknowledged' | 'shipped' | 'received' | 'cancelled';

function isValidPoStatus(v: string): v is PoStatus {
  return ['draft', 'submitted', 'acknowledged', 'shipped', 'received', 'cancelled'].includes(v);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    ctx.role = authUser.role;
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;
    const supabase = getSupabaseAdminClient();

    // ── GET: list purchase orders ─────────────────────────────────────────
    if (req.method === 'GET') {
      const statusFilter = String(req.query.status || '').trim() || null;
      const supplierId = String(req.query.supplier_id || '').trim() || null;
      const limit = Math.min(Number(req.query.limit || 50), 200);

      let query = supabase
        .from('amro_purchase_orders')
        .select('*, suppliers(name as supplier_name), amro_purchase_order_items(id, part_number, quantity_ordered, quantity_received, unit_price)')
        .eq('tenant_id', tenantId);

      if (franchiseId) query = query.eq('franchise_id', franchiseId);
      if (statusFilter && isValidPoStatus(statusFilter)) query = query.eq('status', statusFilter);
      if (supplierId) query = query.eq('supplier_id', supplierId);

      query = query.order('created_at', { ascending: false }).limit(limit);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list purchase orders: ${error.message}`);

      const items = (data || []).map((po: any) => ({
        id: po.id,
        po_number: po.po_number,
        supplier_id: po.supplier_id,
        supplier_name: po.suppliers?.supplier_name || null,
        status: po.status,
        order_date: po.order_date,
        expected_delivery_date: po.expected_delivery_date,
        actual_delivery_date: po.actual_delivery_date,
        total_amount: Number(po.total_amount || 0),
        currency: po.currency,
        notes: po.notes,
        line_items_count: (po.amro_purchase_order_items || []).length,
        created_by: po.created_by,
        created_at: po.created_at,
        updated_at: po.updated_at,
      }));

      const summary = {
        total: items.length,
        draft: items.filter((i) => i.status === 'draft').length,
        submitted: items.filter((i) => i.status === 'submitted').length,
        shipped: items.filter((i) => i.status === 'shipped').length,
        received: items.filter((i) => i.status === 'received').length,
        cancelled: items.filter((i) => i.status === 'cancelled').length,
      };

      res.status(200).json({
        version: 'v2',
        interface: 'list-purchase-orders',
        correlationId: ctx.correlationId,
        output: { tenant_id: tenantId, summary, items },
      });
      return;
    }

    // ── POST: create purchase order ───────────────────────────────────────
    if (req.method === 'POST') {
      const payload = parseBody(req.body);
      const supplierId = assertNonEmpty(payload.supplier_id, 'supplier_id');
      const notes = payload.notes ? String(payload.notes).trim() : null;
      const expectedDeliveryDate = payload.expected_delivery_date ? String(payload.expected_delivery_date).trim() : null;
      const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};

      // Parse line items
      const rawItems = payload.line_items;
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        throw new Error('line_items is required and must be a non-empty array');
      }

      const lineItems = rawItems.map((item: any) => ({
        part_inventory_id: assertNonEmpty(item.part_inventory_id, 'part_inventory_id'),
        quantity_ordered: parsePositiveNumber(item.quantity_ordered, 'quantity_ordered'),
        unit_price: parsePositiveNumber(item.unit_price, 'unit_price'),
        notes: item.notes ? String(item.notes).trim() : null,
      }));

      // Verify all parts exist and belong to tenant
      const partIds = lineItems.map((li: any) => li.part_inventory_id);
      const { data: parts, error: partsErr } = await supabase
        .from('parts_inventory')
        .select('id, part_number, supplier_name, warehouse_location')
        .in('id', partIds)
        .eq('tenant_id', tenantId);

      if (partsErr) throw new Error(`Failed to verify parts: ${partsErr.message}`);
      if (!parts || parts.length !== partIds.length) {
        const foundIds = new Set(parts.map((p: any) => p.id));
        const missing = partIds.filter((id: string) => !foundIds.has(id));
        throw new Error(`Part(s) not found: ${missing.join(', ')}`);
      }

      const partMap = new Map(parts.map((p: any) => [p.id, p]));

      // Calculate total
      const totalAmount = lineItems.reduce((sum: number, li: any) => sum + li.quantity_ordered * li.unit_price, 0);

      // Create PO
      const poNumber = generatePoNumber();
      const { data: poRow, error: poErr } = await supabase
        .from('amro_purchase_orders')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          po_number: poNumber,
          supplier_id: supplierId,
          status: 'draft',
          expected_delivery_date: expectedDeliveryDate || null,
          total_amount: totalAmount,
          notes,
          metadata,
          created_by: authUser.userId,
        })
        .select('id')
        .single();

      if (poErr) throw new Error(`Failed to create purchase order: ${poErr.message}`);

      // Create line items
      const itemsToInsert = lineItems.map((li: any) => ({
        tenant_id: tenantId,
        purchase_order_id: poRow.id,
        part_inventory_id: li.part_inventory_id,
        quantity_ordered: li.quantity_ordered,
        quantity_received: 0,
        unit_price: li.unit_price,
        notes: li.notes,
      }));

      const { error: itemsErr } = await supabase
        .from('amro_purchase_order_items')
        .insert(itemsToInsert);

      if (itemsErr) throw new Error(`PO created but failed to insert line items: ${itemsErr.message}`);

      res.status(201).json({
        version: 'v2',
        interface: 'create-purchase-order',
        correlationId: ctx.correlationId,
        output: {
          id: poRow.id,
          po_number: poNumber,
          supplier_id: supplierId,
          status: 'draft',
          total_amount: totalAmount,
          currency: 'USD',
          line_items_count: lineItems.length,
          order_date: new Date().toISOString().slice(0, 10),
          expected_delivery_date: expectedDeliveryDate,
          created_at: new Date().toISOString(),
        },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
