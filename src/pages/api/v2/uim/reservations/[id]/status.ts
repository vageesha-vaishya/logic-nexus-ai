import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { ReservationValidationError, validateReservationStatusPayload } from '../_validation';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['PATCH', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'PATCH') {
      res.setHeader('Allow', ['PATCH']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const authUser = await authenticateRequest(req);
    ctx.userId = authUser.userId;
    ctx.role = authUser.role;
    enforceAnyPermission(authUser.permissions, ['dashboards.view']);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = String(scopedAccess.franchiseId || '');
    if (!tenantId) throw new Error('Tenant context is required');

    const reservationId = String(req.query.id || '').trim();
    if (!reservationId) throw new Error('reservation id is required');
    const status = validateReservationStatusPayload(req.body);

    const supabase = getSupabaseAdminClient();

    let reservationQuery = supabase
      .from('uim_inventory_reservations')
      .select('id, inventory_item_id, reserved_quantity, reservation_status, referenced_module, referenced_record_id')
      .eq('tenant_id', tenantId)
      .eq('id', reservationId)
      .is('deleted_at', null);
    if (franchiseId) {
      reservationQuery = reservationQuery.eq('franchise_id', franchiseId);
    }

    const { data: reservation, error: reservationError } = await reservationQuery.limit(1).maybeSingle();
    if (reservationError) {
      throw new Error(`Failed to load reservation: ${reservationError.message}`);
    }
    if (!reservation) {
      res.status(404).json({
        error: 'Reservation not found',
        code: 'UIM_RESERVATION_NOT_FOUND',
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    if (String(reservation.reservation_status || '') !== 'active') {
      res.status(422).json({
        error: 'Disallowed reservation transition',
        code: 'UIM_RESERVATION_INVALID_TRANSITION',
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          reservation_id: reservationId,
          current_status: String(reservation.reservation_status || ''),
          requested_transition: `active_to_${status}`,
          allowed_from: 'active',
        },
      });
      return;
    }

    const { data: updatedReservation, error: updateError } = await supabase
      .from('uim_inventory_reservations')
      .update({
        reservation_status: status,
        updated_by: authUser.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', reservationId)
      .select('id, reservation_status, reserved_quantity, inventory_item_id')
      .limit(1)
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update reservation status: ${updateError.message}`);
    }

    const inventoryItemId = String(updatedReservation?.inventory_item_id || reservation.inventory_item_id || '').trim();
    if (!inventoryItemId) {
      throw new Error('Reservation does not include inventory_item_id required for ledger transition');
    }

    const ledgerInsert = {
      tenant_id: tenantId,
      franchise_id: franchiseId || null,
      inventory_item_id: inventoryItemId,
      transaction_type: status === 'fulfilled' ? 'CONSUME' : 'RELEASE',
      quantity_changed: Number(updatedReservation?.reserved_quantity || reservation.reserved_quantity || 0),
      reservation_id: reservationId,
      referenced_module: reservation.referenced_module || null,
      referenced_record_id: reservation.referenced_record_id || null,
      metadata: {
        lifecycle_transition: `active_to_${status}`,
      },
      performed_by: authUser.userId,
    };

    const { error: ledgerError } = await supabase
      .from('uim_inventory_ledger')
      .insert(ledgerInsert);
    if (ledgerError) {
      throw new Error(`Failed to persist reservation lifecycle ledger event: ${ledgerError.message}`);
    }

    res.status(200).json({
      version: 'v2',
      interface: 'uim-reservation-lifecycle-transition',
      correlationId: ctx.correlationId,
      output: {
        reservation_id: reservationId,
        previous_status: 'active',
        current_status: String(updatedReservation?.reservation_status || status),
      },
    });
  } catch (error) {
    if (error instanceof ReservationValidationError) {
      res.status(422).json({
        error: error.message,
        code: error.code,
        version: 'v2',
        correlationId: ctx.correlationId,
        output: error.details || {},
      });
      return;
    }
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
