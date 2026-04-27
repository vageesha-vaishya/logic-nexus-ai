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
import { logger } from '@/lib/logger';

type WorkOrderInterface = 'reserve' | 'consume' | 'release' | 'reconcile';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_INVENTORY_V2_ENABLED, true);
}

function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? body as Record<string, unknown> : {};
}

function parseInterface(value: unknown): WorkOrderInterface {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized !== 'reserve' && normalized !== 'consume' && normalized !== 'release' && normalized !== 'reconcile') {
    throw new Error('interface must be one of: reserve, consume, release, reconcile');
  }
  return normalized as WorkOrderInterface;
}

function parsePositiveNumber(value: unknown, fieldName: string): number {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) throw new Error(`${fieldName} must be > 0`);
  return num;
}

function parseRequiredText(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

async function safeInsertWorkOrderLink(supabase: ReturnType<typeof getSupabaseAdminClient>, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('amro_inventory_work_order_links').insert(payload);
  if (error) {
    logger.warn('amro-work-order-link-insert-skipped', { message: error.message });
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.setHeader('Allow', ['POST', 'GET']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    ctx.role = authUser.role;
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const franchiseId = String(access.franchiseId || '') || null;

    const supabase = getSupabaseAdminClient();
    const selectedInterface = parseInterface(req.query.interface || parseBody(req.body).interface);

    if (selectedInterface === 'reconcile' && req.method === 'GET') {
      const { data: healthRows, error: healthError } = await supabase
        .from('amro_inventory_health_overview')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();
      if (healthError) throw new Error(`Failed to read AMRO inventory health overview: ${healthError.message}`);

      const { data: openReservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');
      if (reservationsError) throw new Error(`Failed to read AMRO reservations for reconciliation: ${reservationsError.message}`);

      res.status(200).json({
        version: 'v2',
        interface: 'amro-work-order-reconcile',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId,
          inventory_health: healthRows || null,
          active_reservations: Number(openReservations?.length || 0),
          reconciled_at: new Date().toISOString(),
        },
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(400).json({
        error: `Interface ${selectedInterface} requires POST`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const body = parseBody(req.body);
    const workOrderId = String(body.work_order_id || '').trim() || null;
    const taskId = String(body.task_id || '').trim() || null;
    const partNumber = parseRequiredText(body.part_number, 'part_number');
    const quantity = parsePositiveNumber(body.quantity, 'quantity');

    const inventoryQuery = supabase
      .from('parts_inventory')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('part_number', partNumber)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: inventoryRow, error: inventoryError } = await inventoryQuery;
    if (inventoryError) throw new Error(`Failed to resolve inventory item for part_number ${partNumber}: ${inventoryError.message}`);
    if (!inventoryRow) throw new Error(`No AMRO inventory item found for part_number ${partNumber}`);

    const inventoryId = String(inventoryRow.id);
    const qtyOnHand = Number(inventoryRow.quantity_on_hand || 0);
    const qtyReserved = Number(inventoryRow.quantity_reserved || 0);
    const qtyAvailable = Math.max(0, qtyOnHand - qtyReserved);

    if (selectedInterface === 'reserve') {
      if (qtyAvailable < quantity) throw new Error(`Insufficient available quantity: requested=${quantity}, available=${qtyAvailable}`);
      const updatedReserved = qtyReserved + quantity;
      const nextStatus = qtyOnHand <= Number(inventoryRow.reorder_level || 0) ? 'low_stock' : (updatedReserved > 0 ? 'reserved' : 'available');

      const { error: updateError } = await supabase
        .from('parts_inventory')
        .update({
          quantity_reserved: updatedReserved,
          status: nextStatus,
          last_movement_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventoryId);
      if (updateError) throw new Error(`Failed to update inventory reservation quantity: ${updateError.message}`);

      const { data: reservationRow, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          inventory_id: inventoryId,
          work_order_id: workOrderId,
          task_id: taskId,
          reserved_quantity: quantity,
          status: 'active',
          reserved_by: authUser.userId,
          expires_at: body.expires_at || null,
        })
        .select('id')
        .limit(1)
        .maybeSingle();
      if (reservationError) throw new Error(`Failed to insert AMRO reservation: ${reservationError.message}`);

      await safeInsertWorkOrderLink(supabase, {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        inventory_id: inventoryId,
        reservation_id: reservationRow?.id || null,
        work_order_id: workOrderId,
        task_id: taskId,
        action_type: 'reserve',
        quantity,
        posting_status: 'posted',
        metadata: {
          correlation_id: ctx.correlationId,
          source_interface: 'work-order-sync',
        },
        created_by: authUser.userId,
      });

      res.status(200).json({
        version: 'v2',
        interface: 'amro-work-order-reserve',
        correlationId: ctx.correlationId,
        output: {
          reservation_id: reservationRow?.id || null,
          inventory_id: inventoryId,
          part_number: partNumber,
          reserved_quantity: quantity,
          remaining_available: qtyOnHand - updatedReserved,
          status: 'reserved',
        },
      });
      return;
    }

    if (selectedInterface === 'consume') {
      const reservationId = String(body.reservation_id || '').trim() || null;
      const updatedOnHand = qtyOnHand - quantity;
      if (updatedOnHand < 0) throw new Error(`Insufficient quantity_on_hand: requested=${quantity}, on_hand=${qtyOnHand}`);
      const updatedReserved = Math.max(0, qtyReserved - quantity);
      const nextStatus = updatedOnHand <= Number(inventoryRow.reorder_level || 0) ? 'low_stock' : (updatedReserved > 0 ? 'reserved' : 'available');

      const { error: updateError } = await supabase
        .from('parts_inventory')
        .update({
          quantity_on_hand: updatedOnHand,
          quantity_reserved: updatedReserved,
          status: nextStatus,
          last_movement_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventoryId);
      if (updateError) throw new Error(`Failed to consume inventory quantity: ${updateError.message}`);

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          inventory_id: inventoryId,
          movement_type: 'issue',
          quantity,
          from_location: inventoryRow.warehouse_location || null,
          to_location: body.to_location || null,
          reference_type: 'work_order_consume',
          reference_id: workOrderId || null,
          moved_by: authUser.userId,
          notes: body.notes || 'Auto-consumption posted from work-order completion',
        });
      if (movementError) throw new Error(`Failed to insert stock movement: ${movementError.message}`);

      if (reservationId) {
        await supabase
          .from('reservations')
          .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', reservationId)
          .eq('tenant_id', tenantId);
      }

      await safeInsertWorkOrderLink(supabase, {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        inventory_id: inventoryId,
        reservation_id: reservationId,
        work_order_id: workOrderId,
        task_id: taskId,
        action_type: 'consume',
        quantity,
        posting_status: 'posted',
        metadata: {
          correlation_id: ctx.correlationId,
          source_interface: 'work-order-sync',
        },
        created_by: authUser.userId,
      });

      res.status(200).json({
        version: 'v2',
        interface: 'amro-work-order-consume',
        correlationId: ctx.correlationId,
        output: {
          inventory_id: inventoryId,
          part_number: partNumber,
          consumed_quantity: quantity,
          quantity_on_hand: updatedOnHand,
          quantity_reserved: updatedReserved,
          status: nextStatus,
        },
      });
      return;
    }

    const releaseReservationId = parseRequiredText(body.reservation_id, 'reservation_id');
    const { data: reservationRow, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', releaseReservationId)
      .limit(1)
      .maybeSingle();
    if (reservationError) throw new Error(`Failed to resolve reservation: ${reservationError.message}`);
    if (!reservationRow) throw new Error('reservation_id not found');
    const releaseQty = Number(reservationRow.reserved_quantity || quantity);
    const updatedReserved = Math.max(0, qtyReserved - releaseQty);
    const nextStatus = qtyOnHand <= Number(inventoryRow.reorder_level || 0) ? 'low_stock' : (updatedReserved > 0 ? 'reserved' : 'available');

    const { error: releaseUpdateError } = await supabase
      .from('parts_inventory')
      .update({
        quantity_reserved: updatedReserved,
        status: nextStatus,
        last_movement_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId);
    if (releaseUpdateError) throw new Error(`Failed to release reservation quantity: ${releaseUpdateError.message}`);

    await supabase
      .from('reservations')
      .update({ status: 'released', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', releaseReservationId);

    await safeInsertWorkOrderLink(supabase, {
      tenant_id: tenantId,
      franchise_id: franchiseId,
      inventory_id: inventoryId,
      reservation_id: releaseReservationId,
      work_order_id: workOrderId,
      task_id: taskId,
      action_type: 'release',
      quantity: releaseQty,
      posting_status: 'posted',
      metadata: {
        correlation_id: ctx.correlationId,
        source_interface: 'work-order-sync',
      },
      created_by: authUser.userId,
    });

    res.status(200).json({
      version: 'v2',
      interface: 'amro-work-order-release',
      correlationId: ctx.correlationId,
      output: {
        reservation_id: releaseReservationId,
        part_number: partNumber,
        released_quantity: releaseQty,
        quantity_reserved: updatedReserved,
        status: nextStatus,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
