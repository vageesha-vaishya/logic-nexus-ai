import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { ReservationValidationError, validateSoftReservationPayload } from './_validation';

function buildReservationToken(): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `uim-resv-${stamp}-${random}`;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
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

    const {
      catalogItemId,
      quantity,
      expectedUseDate,
      referencedModule,
      referencedRecordId,
    } = validateSoftReservationPayload(req.body);
    const supabase = getSupabaseAdminClient();

    const { data: catalogItem, error: catalogError } = await supabase
      .from('uim_catalog_items')
      .select('id, sku, title')
      .eq('tenant_id', tenantId)
      .eq('id', catalogItemId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (catalogError) {
      throw new Error(`Failed to validate catalog item: ${catalogError.message}`);
    }
    if (!catalogItem) {
      res.status(404).json({
        error: 'Catalog item not found',
        code: 'UIM_CATALOG_ITEM_NOT_FOUND',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
      return;
    }

    let availableQuery = supabase
      .from('uim_inventory_items')
      .select('id, quantity')
      .eq('tenant_id', tenantId)
      .eq('catalog_item_id', catalogItemId)
      .eq('status', 'available')
      .is('deleted_at', null);

    if (franchiseId) {
      availableQuery = availableQuery.eq('franchise_id', franchiseId);
    }

    const { data: availableRows, error: availableError } = await availableQuery.limit(500);

    if (availableError) {
      throw new Error(`Failed to evaluate available inventory: ${availableError.message}`);
    }

    const totalAvailable = (availableRows || []).reduce((sum, row) => sum + Number((row as Record<string, unknown>).quantity || 0), 0);
    if (totalAvailable < quantity) {
      res.status(409).json({
        error: 'Insufficient available inventory for soft reservation',
        code: 'UIM_INSUFFICIENT_AVAILABLE_QUANTITY',
        correlationId: ctx.correlationId,
        version: 'v2',
        output: {
          requested_quantity: quantity,
          available_quantity: totalAvailable,
          catalog_item_id: catalogItemId,
        },
      });
      return;
    }
    const firstAvailableItemId = String((availableRows?.[0] as Record<string, unknown> | undefined)?.id || '');
    if (!firstAvailableItemId) {
      throw new Error('Unable to derive inventory item for reservation ledger write');
    }

    const reservationToken = buildReservationToken();
    const reservationInsert = {
      tenant_id: tenantId,
      franchise_id: franchiseId || null,
      catalog_item_id: catalogItemId,
      inventory_item_id: firstAvailableItemId,
      reserved_quantity: quantity,
      reservation_status: 'active',
      expected_use_date: expectedUseDate,
      reservation_token: reservationToken,
      referenced_module: referencedModule,
      referenced_record_id: referencedRecordId,
      created_by: authUser.userId,
      updated_by: authUser.userId,
      metadata: {
        mode: 'soft',
        source: 'api_v2_uim_reservations_soft',
      },
    };

    const { data: reservationRecord, error: reservationError } = await supabase
      .from('uim_inventory_reservations')
      .insert(reservationInsert)
      .select('id, reservation_token, reservation_status, reserved_quantity, expected_use_date')
      .limit(1)
      .maybeSingle();

    if (reservationError) {
      throw new Error(`Failed to persist soft reservation: ${reservationError.message}`);
    }

    const ledgerInsert = {
      tenant_id: tenantId,
      franchise_id: franchiseId || null,
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
      performed_by: authUser.userId,
    };

    const { error: ledgerError } = await supabase
      .from('uim_inventory_ledger')
      .insert(ledgerInsert);
    if (ledgerError) {
      throw new Error(`Failed to persist reservation ledger entry: ${ledgerError.message}`);
    }

    res.status(200).json({
      version: 'v2',
      interface: 'uim-soft-reservation',
      correlationId: ctx.correlationId,
      output: {
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
