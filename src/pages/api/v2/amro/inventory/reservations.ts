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
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_INVENTORY_V2_ENABLED, true);
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

function parsePositiveNumber(value: unknown, fieldName: string, fallback?: number): number {
  const num = Number(value ?? fallback);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return num;
}

function toLineItems(body: Record<string, unknown>): Array<{ inventory_id: string; quantity: number; notes?: string }> {
  const raw = body.line_items || body.demand_lines;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('line_items must include at least one reservation line');
  }
  return raw.map((item) => {
    const obj = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const inventoryId = assertNonEmpty(obj.inventory_id, 'inventory_id');
    const quantity = parsePositiveNumber(obj.quantity, 'quantity');
    const notes = obj.notes ? String(obj.notes).trim() : undefined;
    return { inventory_id: inventoryId, quantity, notes };
  });
}

type ReservationStatus = 'active' | 'fulfilled' | 'released' | 'expired' | 'cancelled';

function isValidStatus(value: string): value is ReservationStatus {
  return ['active', 'fulfilled', 'released', 'expired', 'cancelled'].includes(value);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
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

    // ── GET: list reservations ──────────────────────────────────────────────
    if (req.method === 'GET') {
      const workPackageId = String(req.query.work_package_id || '').trim() || null;
      const inventoryId = String(req.query.inventory_id || '').trim() || null;
      const statusFilter = String(req.query.status || '').trim() || null;
      const limit = Math.min(Number(req.query.limit || 50), 200);

      let query = supabase
        .from('reservations')
        .select('*, parts_inventory(part_number, serial_number, description, warehouse_location)')
        .eq('tenant_id', tenantId);

      if (franchiseId) query = query.eq('franchise_id', franchiseId);
      if (workPackageId) query = query.eq('work_package_id', workPackageId);
      if (inventoryId) query = query.eq('inventory_id', inventoryId);
      if (statusFilter && isValidStatus(statusFilter)) query = query.eq('status', statusFilter);

      query = query.order('created_at', { ascending: false }).limit(limit);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list reservations: ${error.message}`);

      const items = (data || []).map((r: any) => ({
        id: r.id,
        inventory_id: r.inventory_id,
        part_number: r.parts_inventory?.part_number || null,
        serial_number: r.parts_inventory?.serial_number || null,
        description: r.parts_inventory?.description || null,
        warehouse_location: r.parts_inventory?.warehouse_location || null,
        work_package_id: r.work_package_id,
        task_id: r.task_id,
        reserved_quantity: r.reserved_quantity,
        status: r.status,
        reserved_by: r.reserved_by,
        expires_at: r.expires_at,
        fulfilled_at: r.fulfilled_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      res.status(200).json({
        version: 'v2',
        interface: 'list-reservations',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          count: items.length,
          items,
        },
      });
      return;
    }

    // ── POST: create reservation ────────────────────────────────────────────
    if (req.method === 'POST') {
      const payload = parseBody(req.body);
      const workPackageId = payload.work_package_id ? assertNonEmpty(payload.work_package_id, 'work_package_id') : null;
      const taskId = payload.task_id ? assertNonEmpty(payload.task_id, 'task_id') : null;
      const expiresAt = payload.expires_at ? String(payload.expires_at).trim() : null;
      const lineItems = toLineItems(payload);

      const createdReservations: Array<{
        id: string;
        inventory_id: string;
        part_number: string | null;
        reserved_quantity: number;
        status: string;
        error?: string;
      }> = [];

      for (const line of lineItems) {
        // 1. Verify inventory exists and belongs to tenant
        const { data: inv, error: invErr } = await supabase
          .from('parts_inventory')
          .select('id, part_number, quantity_on_hand, quantity_reserved')
          .eq('id', line.inventory_id)
          .eq('tenant_id', tenantId)
          .single();

        if (invErr || !inv) {
          createdReservations.push({
            id: line.inventory_id,
            inventory_id: line.inventory_id,
            part_number: null,
            reserved_quantity: line.quantity,
            status: 'failed',
            error: invErr?.message || 'Inventory record not found',
          });
          continue;
        }

        // 2. Check sufficient available stock
        const onHand = Number(inv.quantity_on_hand || 0);
        const reserved = Number(inv.quantity_reserved || 0);
        const available = onHand - reserved;

        if (available < line.quantity) {
          createdReservations.push({
            id: line.inventory_id,
            inventory_id: line.inventory_id,
            part_number: inv.part_number,
            reserved_quantity: line.quantity,
            status: 'rejected',
            error: `Insufficient stock: requested ${line.quantity}, available ${available}`,
          });
          continue;
        }

        // 3. Insert reservation record
        const { data: resRow, error: resErr } = await supabase
          .from('reservations')
          .insert({
            tenant_id: tenantId,
            franchise_id: franchiseId,
            inventory_id: line.inventory_id,
            work_package_id: workPackageId,
            task_id: taskId,
            reserved_quantity: line.quantity,
            status: 'active',
            reserved_by: authUser.userId,
            expires_at: expiresAt || null,
          })
          .select('id')
          .single();

        if (resErr) {
          createdReservations.push({
            id: line.inventory_id,
            inventory_id: line.inventory_id,
            part_number: inv.part_number,
            reserved_quantity: line.quantity,
            status: 'failed',
            error: resErr.message,
          });
          continue;
        }

        // 4. Increment quantity_reserved on parts_inventory
        const { error: updateErr } = await supabase
          .from('parts_inventory')
          .update({
            quantity_reserved: reserved + line.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', line.inventory_id);

        if (updateErr) {
          createdReservations.push({
            id: line.inventory_id,
            inventory_id: line.inventory_id,
            part_number: inv.part_number,
            reserved_quantity: line.quantity,
            status: 'failed',
            error: `Reservation created but failed to update inventory: ${updateErr.message}`,
          });
          continue;
        }

        createdReservations.push({
          id: resRow.id,
          inventory_id: line.inventory_id,
          part_number: inv.part_number,
          reserved_quantity: line.quantity,
          status: 'active',
        });
      }

      const succeeded = createdReservations.filter((r) => r.status === 'active');
      const failed = createdReservations.filter((r) => r.status !== 'active');

      res.status(succeeded.length > 0 ? 200 : 400).json({
        version: 'v2',
        interface: 'reserve-parts',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          work_package_id: workPackageId,
          task_id: taskId,
          total_requested: lineItems.length,
          succeeded: succeeded.length,
          failed: failed.length,
          reservations: createdReservations,
          reserved_at: new Date().toISOString(),
        },
      });
      return;
    }

    // ── DELETE: release/cancel reservation ──────────────────────────────────
    if (req.method === 'DELETE') {
      const payload = parseBody(req.body);
      const reservationId = assertNonEmpty(payload.reservation_id || req.query.reservation_id, 'reservation_id');

      // 1. Fetch the reservation
      const { data: resData, error: resErr } = await supabase
        .from('reservations')
        .select('id, inventory_id, reserved_quantity, status, tenant_id')
        .eq('id', reservationId)
        .eq('tenant_id', tenantId)
        .single();

      if (resErr || !resData) {
        throw new Error(`Reservation ${reservationId} not found`);
      }

      if (resData.status !== 'active') {
        throw new Error(`Cannot release reservation with status "${resData.status}". Only active reservations can be released.`);
      }

      // 2. Decrement quantity_reserved on parts_inventory
      const { data: inv, error: invErr } = await supabase
        .from('parts_inventory')
        .select('quantity_reserved')
        .eq('id', resData.inventory_id)
        .eq('tenant_id', tenantId)
        .single();

      if (invErr) {
        throw new Error(`Failed to read inventory: ${invErr.message}`);
      }

      const currentReserved = Number(inv?.quantity_reserved || 0);
      const newReserved = Math.max(0, currentReserved - resData.reserved_quantity);

      const { error: updateErr } = await supabase
        .from('parts_inventory')
        .update({
          quantity_reserved: newReserved,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resData.inventory_id);

      if (updateErr) {
        throw new Error(`Failed to update inventory: ${updateErr.message}`);
      }

      // 3. Update reservation status to 'released'
      const { error: statusErr } = await supabase
        .from('reservations')
        .update({
          status: 'released',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId);

      if (statusErr) {
        throw new Error(`Failed to update reservation status: ${statusErr.message}`);
      }

      res.status(200).json({
        version: 'v2',
        interface: 'cancel-reservation',
        correlationId: ctx.correlationId,
        output: {
          reservation_id: reservationId,
          inventory_id: resData.inventory_id,
          released_quantity: resData.reserved_quantity,
          status: 'released',
          released_at: new Date().toISOString(),
        },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}

