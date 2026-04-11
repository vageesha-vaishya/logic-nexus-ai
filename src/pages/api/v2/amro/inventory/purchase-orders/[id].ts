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

type PoStatus = 'draft' | 'submitted' | 'acknowledged' | 'shipped' | 'received' | 'cancelled';

const VALID_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['acknowledged', 'cancelled'],
  acknowledged: ['shipped', 'cancelled'],
  shipped: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

function isValidPoStatus(v: string): v is PoStatus {
  return ['draft', 'submitted', 'acknowledged', 'shipped', 'received', 'cancelled'].includes(v);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
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
    const poId = String(req.query.id || '').trim();
    if (!poId) throw new Error('Purchase order ID is required');

    const supabase = getSupabaseAdminClient();

    // ── GET: single PO ────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data: po, error: poErr } = await supabase
        .from('amro_purchase_orders')
        .select('*, suppliers(name as supplier_name)')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (poErr || !po) throw new Error(`Purchase order ${poId} not found`);

      const { data: items, error: itemsErr } = await supabase
        .from('amro_purchase_order_items')
        .select('*, parts_inventory(part_number, serial_number, description, warehouse_location)')
        .eq('purchase_order_id', poId)
        .eq('tenant_id', tenantId);

      if (itemsErr) throw new Error(`Failed to load line items: ${itemsErr.message}`);

      const lineItems = (items || []).map((item: any) => ({
        id: item.id,
        part_inventory_id: item.part_inventory_id,
        part_number: item.parts_inventory?.part_number || null,
        serial_number: item.parts_inventory?.serial_number || null,
        description: item.parts_inventory?.description || null,
        warehouse_location: item.parts_inventory?.warehouse_location || null,
        quantity_ordered: Number(item.quantity_ordered || 0),
        quantity_received: Number(item.quantity_received || 0),
        unit_price: Number(item.unit_price || 0),
        line_total: Number(item.line_total || 0),
        notes: item.notes,
      }));

      res.status(200).json({
        version: 'v2',
        interface: 'get-purchase-order',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          purchase_order: {
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
            metadata: po.metadata || {},
            created_by: po.created_by,
            created_at: po.created_at,
            updated_at: po.updated_at,
          },
          line_items: lineItems,
        },
      });
      return;
    }

    // ── PATCH: update PO status or fields ─────────────────────────────────
    if (req.method === 'PATCH') {
      const payload = parseBody(req.body);

      // Fetch current PO
      const { data: current, error: fetchErr } = await supabase
        .from('amro_purchase_orders')
        .select('id, status, created_at')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchErr || !current) throw new Error(`Purchase order ${poId} not found`);

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: authUser.userId,
      };

      // Status transition
      if (payload.status) {
        const newStatus = String(payload.status).trim().toLowerCase();
        if (!isValidPoStatus(newStatus)) throw new Error(`Invalid status: ${newStatus}`);

        const currentStatus = current.status as PoStatus;
        const allowedTransitions = VALID_TRANSITIONS[currentStatus];
        if (!allowedTransitions.includes(newStatus)) {
          throw new Error(`Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowedTransitions.join(', ') || 'none (terminal state)'}`);
        }

        updates.status = newStatus;

        // On receive, update inventory
        if (newStatus === 'received') {
          updates.actual_delivery_date = payload.actual_delivery_date || new Date().toISOString().slice(0, 10);

          // Load line items to update inventory
          const { data: lineItems, error: liErr } = await supabase
            .from('amro_purchase_order_items')
            .select('id, part_inventory_id, quantity_ordered')
            .eq('purchase_order_id', poId)
            .eq('tenant_id', tenantId);

          if (liErr) throw new Error(`Failed to load PO line items: ${liErr.message}`);

          // Increment inventory for each line item
          for (const li of lineItems || []) {
            const { data: inv, error: invErr } = await supabase
              .from('parts_inventory')
              .select('id, quantity_on_hand')
              .eq('id', li.part_inventory_id)
              .eq('tenant_id', tenantId)
              .single();

            if (invErr || !inv) continue; // skip missing parts gracefully

            const currentOnHand = Number(inv.quantity_on_hand || 0);
            const quantityReceived = Number(li.quantity_ordered || 0);

            await supabase
              .from('parts_inventory')
              .update({
                quantity_on_hand: currentOnHand + quantityReceived,
                updated_at: new Date().toISOString(),
              })
              .eq('id', li.part_inventory_id);

            // Update line item quantity_received
            await supabase
              .from('amro_purchase_order_items')
              .update({ quantity_received: quantityReceived })
              .eq('id', li.id);
          }
        }
      }

      // Update PO-level fields
      if (payload.expected_delivery_date) updates.expected_delivery_date = String(payload.expected_delivery_date).trim();
      if (payload.notes !== undefined) updates.notes = payload.notes ? String(payload.notes).trim() : null;
      if (payload.metadata && typeof payload.metadata === 'object') {
        updates.metadata = { ...(current.metadata || {}), ...(payload.metadata as Record<string, unknown>) };
      }

      const { data: updatedPo, error: updateErr } = await supabase
        .from('amro_purchase_orders')
        .update(updates)
        .eq('id', poId)
        .select('id, po_number, status, actual_delivery_date')
        .single();

      if (updateErr) throw new Error(`Failed to update purchase order: ${updateErr.message}`);

      res.status(200).json({
        version: 'v2',
        interface: 'update-purchase-order',
        correlationId: ctx.correlationId,
        output: {
          id: updatedPo.id,
          po_number: updatedPo.po_number,
          status: updatedPo.status,
          actual_delivery_date: updatedPo.actual_delivery_date,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }

    // ── DELETE: cancel/remove PO ──────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { data: current, error: fetchErr } = await supabase
        .from('amro_purchase_orders')
        .select('id, status')
        .eq('id', poId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchErr || !current) throw new Error(`Purchase order ${poId} not found`);
      if (current.status === 'received') throw new Error('Cannot delete a received purchase order. Use cancel or keep as record.');

      const { error: deleteErr } = await supabase
        .from('amro_purchase_orders')
        .delete()
        .eq('id', poId)
        .eq('tenant_id', tenantId);

      if (deleteErr) throw new Error(`Failed to delete purchase order: ${deleteErr.message}`);

      res.status(200).json({
        version: 'v2',
        interface: 'delete-purchase-order',
        correlationId: ctx.correlationId,
        output: { po_id: poId, deleted: true },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
