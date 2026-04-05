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

type ScanMode = 'barcode' | 'rfid' | 'manual';
type ScanEventType = 'receive' | 'issue' | 'transfer' | 'audit' | 'reserve' | 'release';

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

function parseRequiredText(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${fieldName} is required`);
  return normalized;
}

function parsePositiveNumber(value: unknown, fallback = 1): number {
  const num = Number(value || fallback);
  if (!Number.isFinite(num) || num <= 0) throw new Error('quantity must be > 0');
  return num;
}

function parseScanMode(value: unknown): ScanMode {
  const mode = String(value || 'manual').trim().toLowerCase();
  if (mode !== 'barcode' && mode !== 'rfid' && mode !== 'manual') throw new Error('scan_mode must be barcode, rfid or manual');
  return mode as ScanMode;
}

function parseScanEventType(value: unknown): ScanEventType {
  const event = String(value || 'audit').trim().toLowerCase();
  if (event !== 'receive' && event !== 'issue' && event !== 'transfer' && event !== 'audit' && event !== 'reserve' && event !== 'release') {
    throw new Error('event_type must be receive, issue, transfer, audit, reserve or release');
  }
  return event as ScanEventType;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
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

    const body = parseBody(req.body);
    const scanMode = parseScanMode(body.scan_mode);
    const eventType = parseScanEventType(body.event_type);
    const scanCode = parseRequiredText(body.scan_code || body.code, 'scan_code');
    const quantity = parsePositiveNumber(body.quantity, 1);
    const fromLocation = String(body.from_location || '').trim() || null;
    const toLocation = String(body.to_location || '').trim() || null;

    const supabase = getSupabaseAdminClient();
    const { data: inventoryRow, error: inventoryError } = await supabase
      .from('parts_inventory')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`barcode_value.eq.${scanCode},rfid_tag.eq.${scanCode},part_number.eq.${scanCode},serial_number.eq.${scanCode}`)
      .limit(1)
      .maybeSingle();
    if (inventoryError) throw new Error(`Failed to resolve inventory by scan_code: ${inventoryError.message}`);
    if (!inventoryRow) throw new Error(`No inventory record matches scan_code ${scanCode}`);

    const inventoryId = String(inventoryRow.id);
    const qtyOnHand = Number(inventoryRow.quantity_on_hand || 0);
    const qtyReserved = Number(inventoryRow.quantity_reserved || 0);
    let nextOnHand = qtyOnHand;
    let nextReserved = qtyReserved;

    if (eventType === 'receive') nextOnHand += quantity;
    if (eventType === 'issue') {
      nextOnHand -= quantity;
      if (nextOnHand < 0) throw new Error(`Cannot issue ${quantity}, quantity_on_hand=${qtyOnHand}`);
    }
    if (eventType === 'reserve') {
      const available = qtyOnHand - qtyReserved;
      if (available < quantity) throw new Error(`Cannot reserve ${quantity}, available=${available}`);
      nextReserved += quantity;
    }
    if (eventType === 'release') {
      nextReserved = Math.max(0, qtyReserved - quantity);
    }

    const reorderLevel = Number(inventoryRow.reorder_level || 0);
    const nextStatus = nextOnHand <= reorderLevel ? 'low_stock' : (nextReserved > 0 ? 'reserved' : 'available');

    const { error: updateError } = await supabase
      .from('parts_inventory')
      .update({
        quantity_on_hand: nextOnHand,
        quantity_reserved: nextReserved,
        status: nextStatus,
        warehouse_location: toLocation || inventoryRow.warehouse_location,
        last_movement_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId);
    if (updateError) throw new Error(`Failed to apply scan inventory update: ${updateError.message}`);

    if (eventType === 'receive' || eventType === 'issue' || eventType === 'transfer') {
      const movementType = eventType === 'transfer' ? 'transfer' : (eventType === 'receive' ? 'receipt' : 'issue');
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          inventory_id: inventoryId,
          movement_type: movementType,
          quantity,
          from_location: fromLocation || null,
          to_location: toLocation || inventoryRow.warehouse_location || null,
          reference_type: 'scan_event',
          moved_by: authUser.userId,
          notes: `Auto movement from ${scanMode} scan`,
        });
      if (movementError) {
        logger.warn('amro-scan-stock-movement-insert-failed', { message: movementError.message });
      }
    }

    const { data: scanRow, error: scanError } = await supabase
      .from('amro_inventory_scan_events')
      .insert({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        inventory_id: inventoryId,
        scan_mode: scanMode,
        scan_code: scanCode,
        event_type: eventType,
        scanner_device_id: body.scanner_device_id || null,
        from_location: fromLocation,
        to_location: toLocation,
        quantity,
        status: 'validated',
        validation_message: 'scan processed',
        metadata: {
          correlation_id: ctx.correlationId,
          ui_source: body.ui_source || null,
        },
        created_by: authUser.userId,
      })
      .select('id')
      .limit(1)
      .maybeSingle();
    if (scanError) throw new Error(`Failed to persist AMRO scan event: ${scanError.message}`);

    res.status(200).json({
      version: 'v2',
      interface: 'amro-inventory-scan',
      correlationId: ctx.correlationId,
      output: {
        scan_event_id: scanRow?.id || null,
        inventory_id: inventoryId,
        part_number: inventoryRow.part_number,
        event_type: eventType,
        scan_mode: scanMode,
        quantity,
        quantity_on_hand: nextOnHand,
        quantity_reserved: nextReserved,
        status: nextStatus,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
