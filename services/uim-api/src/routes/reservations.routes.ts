// Phase 7 UIM Step 4b.7 — soft inventory reservations route.
//
// Carves src/pages/api/v2/uim/reservations/soft.ts (205 LOC) into
// uim-api + the supporting _validation.ts (81 LOC) which lives at
// services/uim-api/src/services/reservation-validation.ts.
//
// Soft reservations are inventory holds that don't subtract from
// physical stock yet — they're the inventory side of the "added to
// quote / pending PO" state. Two writes per request:
//   1. uim_inventory_reservations row (status='active')
//   2. uim_inventory_ledger entry (transaction_type='RESERVE') linked
//      to the reservation
//
// Insufficient stock returns 409 with the snapshot so the caller can
// surface it inline rather than re-querying. Validation errors are
// ReservationValidationError → 422 with the field-level details.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';
import {
  ReservationValidationError,
  validateSoftReservationPayload,
} from '../services/reservation-validation.js';

const router = Router();

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function buildReservationToken(): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `uim-resv-${stamp}-${random}`;
}

router.post(
  '/v1/uim/reservations/soft',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    let payload;
    try {
      payload = validateSoftReservationPayload(req.body);
    } catch (err) {
      if (err instanceof ReservationValidationError) {
        return res.status(422).json({
          error: err.message,
          code: err.code,
          statusCode: 422,
          details: err.details || {},
        });
      }
      throw err;
    }

    const tenantId = authReq.tenantId;
    const franchiseId = authReq.franchiseId ?? null;
    const { catalogItemId, quantity, expectedUseDate, referencedModule, referencedRecordId } = payload;

    try {
      const supabase = getServiceRoleClient();

      // 1. Catalog item must exist + not soft-deleted in this tenant.
      const { data: catalogItem, error: catalogErr } = await supabase
        .from('uim_catalog_items')
        .select('id, sku, title')
        .eq('tenant_id', tenantId)
        .eq('id', catalogItemId)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (catalogErr) throw new Error(`catalog lookup: ${catalogErr.message}`);
      if (!catalogItem) {
        return res.status(404).json({
          error: 'Catalog item not found',
          code: 'UIM_CATALOG_ITEM_NOT_FOUND',
          statusCode: 404,
        } as ErrorResponse);
      }

      // 2. Available inventory rows for this catalog item.
      let availableQuery = supabase
        .from('uim_inventory_items')
        .select('id, quantity')
        .eq('tenant_id', tenantId)
        .eq('catalog_item_id', catalogItemId)
        .eq('status', 'available')
        .is('deleted_at', null);
      if (franchiseId) availableQuery = availableQuery.eq('franchise_id', franchiseId);
      const { data: availableRows, error: availableErr } = await availableQuery.limit(500);
      if (availableErr) throw new Error(`inventory eval: ${availableErr.message}`);

      const totalAvailable = (availableRows ?? []).reduce(
        (sum, row) => sum + Number((row as Record<string, unknown>).quantity || 0),
        0,
      );
      if (totalAvailable < quantity) {
        return res.status(409).json({
          error: 'Insufficient available inventory for soft reservation',
          code: 'UIM_INSUFFICIENT_AVAILABLE_QUANTITY',
          statusCode: 409,
          snapshot: {
            requested_quantity: quantity,
            available_quantity: totalAvailable,
            catalog_item_id: catalogItemId,
          },
        });
      }

      const firstAvailableItemId = String(
        (availableRows?.[0] as Record<string, unknown> | undefined)?.id || '',
      );
      if (!firstAvailableItemId) {
        throw new Error('Unable to derive inventory item for reservation ledger write');
      }

      // 3. Persist the reservation.
      const reservationToken = buildReservationToken();
      const { data: reservationRecord, error: reservationErr } = await supabase
        .from('uim_inventory_reservations')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          catalog_item_id: catalogItemId,
          inventory_item_id: firstAvailableItemId,
          reserved_quantity: quantity,
          reservation_status: 'active',
          expected_use_date: expectedUseDate,
          reservation_token: reservationToken,
          referenced_module: referencedModule,
          referenced_record_id: referencedRecordId,
          created_by: authReq.userId,
          updated_by: authReq.userId,
          metadata: {
            mode: 'soft',
            source: 'uim-api.reservations.soft',
          },
        })
        .select('id, reservation_token, reservation_status, reserved_quantity, expected_use_date')
        .limit(1)
        .maybeSingle();
      if (reservationErr) throw new Error(`reservation persist: ${reservationErr.message}`);

      // 4. Ledger entry tagging the reserved units.
      const { error: ledgerErr } = await supabase
        .from('uim_inventory_ledger')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          inventory_item_id: firstAvailableItemId,
          transaction_type: 'RESERVE',
          quantity_changed: quantity,
          reservation_id: reservationRecord?.id || null,
          referenced_module: referencedModule,
          referenced_record_id: referencedRecordId,
          metadata: {
            reservation_token: reservationRecord?.reservation_token || reservationToken,
            lifecycle_state: 'active',
          },
          performed_by: authReq.userId,
        });
      if (ledgerErr) throw new Error(`ledger persist: ${ledgerErr.message}`);

      logger.info('uim.reservations.soft created', {
        userId: authReq.userId,
        tenantId,
        catalogItemId,
        quantity,
        reservationId: reservationRecord?.id,
      });

      return res.status(201).json({
        tenant_id: tenantId,
        reservation_id: String(reservationRecord?.id || ''),
        reservation_token: String(reservationRecord?.reservation_token || reservationToken),
        reservation_status: String(reservationRecord?.reservation_status || 'active'),
        reserved_quantity: Number(reservationRecord?.reserved_quantity || quantity),
        expected_use_date: String(reservationRecord?.expected_use_date || expectedUseDate),
        available_quantity_snapshot: totalAvailable,
        request: {
          catalog_item_id: catalogItemId,
          quantity,
          expected_use_date: expectedUseDate,
        },
      });
    } catch (err) {
      logger.error('uim.reservations.soft error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to create reservation',
        code: 'UIM_RESERVATION_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
