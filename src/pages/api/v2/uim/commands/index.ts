import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { resolveUimAccess } from '../_shared';

type CommandType = 'RECEIVE' | 'MOVE' | 'RESERVE' | 'CONSUME';

type CommandPayload = Record<string, unknown>;

function parseCommandType(value: unknown): CommandType {
  const normalized = String(value || '').trim().toUpperCase();
  if (!['RECEIVE', 'MOVE', 'RESERVE', 'CONSUME'].includes(normalized)) {
    throw new Error('Unsupported command_type. Use RECEIVE, MOVE, RESERVE, or CONSUME');
  }
  return normalized as CommandType;
}

function parsePayload(value: unknown): CommandPayload {
  if (value && typeof value === 'object') return value as CommandPayload;
  return {};
}

function parseQuantity(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  return parsed;
}

async function applyReceive(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  context: { tenantId: string; franchiseId: string; userId: string },
  payload: CommandPayload,
): Promise<Record<string, unknown>> {
  let catalogItemId = String(payload.catalog_item_id || '').trim();
  const quantity = parseQuantity(payload.quantity, 'quantity');
  if (!catalogItemId) {
    const sku = String(payload.sku || '').trim();
    const title = String(payload.title || payload.item_name || '').trim();
    if (!sku || !title) throw new Error('catalog_item_id or (sku + title) is required for RECEIVE');
    const { data: catalogItem, error: catalogError } = await supabase
      .from('uim_catalog_items')
      .insert({
        tenant_id: context.tenantId,
        franchise_id: context.franchiseId || null,
        sku,
        title,
        category: payload.category || null,
        unit_of_measure: payload.uom || 'pcs',
        attributes: payload.attributes || {},
        created_by: context.userId,
        updated_by: context.userId,
      })
      .select('id')
      .limit(1)
      .maybeSingle();
    if (catalogError) throw new Error(`Failed to create catalog item for RECEIVE: ${catalogError.message}`);
    catalogItemId = String(catalogItem?.id || '');
  }
  if (!catalogItemId) throw new Error('Unable to resolve catalog item for RECEIVE');

  const { data: insertedItem, error: itemError } = await supabase
    .from('uim_inventory_items')
    .insert({
      tenant_id: context.tenantId,
      franchise_id: context.franchiseId || null,
      catalog_item_id: catalogItemId,
      quantity,
      status: 'available',
      location_type: payload.location_type || null,
      location_id: payload.location_id || null,
      metadata: payload.metadata || {},
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select('id, catalog_item_id, quantity, status')
    .limit(1)
    .maybeSingle();
  if (itemError) throw new Error(`Failed to apply RECEIVE command: ${itemError.message}`);

  const itemId = String(insertedItem?.id || '');
  if (!itemId) throw new Error('RECEIVE command failed to persist inventory item');

  const { error: ledgerError } = await supabase.from('uim_inventory_ledger').insert({
    tenant_id: context.tenantId,
    franchise_id: context.franchiseId || null,
    inventory_item_id: itemId,
    transaction_type: 'RECEIVE',
    quantity_changed: quantity,
    to_location_id: payload.location_id || null,
    metadata: payload.metadata || {},
    performed_by: context.userId,
  });
  if (ledgerError) throw new Error(`Failed to write RECEIVE ledger entry: ${ledgerError.message}`);

  return {
    inventory_item_id: itemId,
    quantity,
  };
}

async function applyMove(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  context: { tenantId: string; franchiseId: string; userId: string },
  payload: CommandPayload,
): Promise<Record<string, unknown>> {
  const inventoryItemId = String(payload.inventory_item_id || '').trim();
  if (!inventoryItemId) throw new Error('inventory_item_id is required for MOVE');
  const toLocationId = String(payload.to_location_id || '').trim();
  if (!toLocationId) throw new Error('to_location_id is required for MOVE');
  const fromLocationId = String(payload.from_location_id || '').trim() || null;

  const { data: updatedItem, error: updateError } = await supabase
    .from('uim_inventory_items')
    .update({
      location_id: toLocationId,
      location_type: payload.location_type || null,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    })
    .eq('tenant_id', context.tenantId)
    .eq('id', inventoryItemId)
    .select('id, location_id')
    .limit(1)
    .maybeSingle();
  if (updateError) throw new Error(`Failed to apply MOVE command: ${updateError.message}`);
  if (!updatedItem) throw new Error('MOVE command target inventory item not found');

  const { error: ledgerError } = await supabase.from('uim_inventory_ledger').insert({
    tenant_id: context.tenantId,
    franchise_id: context.franchiseId || null,
    inventory_item_id: inventoryItemId,
    transaction_type: 'MOVE',
    quantity_changed: 0,
    from_location_id: fromLocationId,
    to_location_id: toLocationId,
    metadata: payload.metadata || {},
    performed_by: context.userId,
  });
  if (ledgerError) throw new Error(`Failed to write MOVE ledger entry: ${ledgerError.message}`);

  return {
    inventory_item_id: inventoryItemId,
    from_location_id: fromLocationId,
    to_location_id: toLocationId,
  };
}

async function applyReserve(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  context: { tenantId: string; franchiseId: string; userId: string },
  payload: CommandPayload,
): Promise<Record<string, unknown>> {
  const inventoryItemId = String(payload.inventory_item_id || '').trim();
  let catalogItemId = String(payload.catalog_item_id || '').trim();
  if (!inventoryItemId) {
    throw new Error('inventory_item_id is required for RESERVE');
  }
  if (!catalogItemId) {
    const { data: itemRecord, error: itemError } = await supabase
      .from('uim_inventory_items')
      .select('catalog_item_id')
      .eq('tenant_id', context.tenantId)
      .eq('id', inventoryItemId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (itemError) throw new Error(`Failed to resolve catalog item for RESERVE: ${itemError.message}`);
    catalogItemId = String(itemRecord?.catalog_item_id || '');
  }
  if (!catalogItemId) throw new Error('Unable to resolve catalog_item_id for RESERVE');
  const reservedQuantity = parseQuantity(payload.quantity, 'quantity');
  const reservationToken = String(payload.reservation_token || `uim-resv-${Date.now().toString(36)}`);

  const { data: reservationRecord, error: reservationError } = await supabase
    .from('uim_inventory_reservations')
    .insert({
      tenant_id: context.tenantId,
      franchise_id: context.franchiseId || null,
      catalog_item_id: catalogItemId,
      inventory_item_id: inventoryItemId,
      reserved_quantity: reservedQuantity,
      reservation_status: 'active',
      reservation_token: reservationToken,
      expected_use_date: payload.expected_use_date || null,
      referenced_module: payload.referenced_module || null,
      referenced_record_id: payload.referenced_record_id || null,
      metadata: payload.metadata || {},
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select('id, reservation_token, reserved_quantity')
    .limit(1)
    .maybeSingle();
  if (reservationError) throw new Error(`Failed to apply RESERVE command: ${reservationError.message}`);

  const reservationId = String(reservationRecord?.id || '');
  if (!reservationId) throw new Error('RESERVE command failed to persist reservation');

  const { error: ledgerError } = await supabase.from('uim_inventory_ledger').insert({
    tenant_id: context.tenantId,
    franchise_id: context.franchiseId || null,
    inventory_item_id: inventoryItemId,
    transaction_type: 'RESERVE',
    quantity_changed: reservedQuantity,
    reservation_id: reservationId,
    referenced_module: payload.referenced_module || null,
    referenced_record_id: payload.referenced_record_id || null,
    metadata: payload.metadata || {},
    performed_by: context.userId,
  });
  if (ledgerError) throw new Error(`Failed to write RESERVE ledger entry: ${ledgerError.message}`);

  return {
    reservation_id: reservationId,
    reservation_token: String(reservationRecord?.reservation_token || reservationToken),
    reserved_quantity: Number(reservationRecord?.reserved_quantity || reservedQuantity),
  };
}

async function applyConsume(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  context: { tenantId: string; franchiseId: string; userId: string },
  payload: CommandPayload,
): Promise<Record<string, unknown>> {
  const inventoryItemId = String(payload.inventory_item_id || '').trim();
  if (!inventoryItemId) throw new Error('inventory_item_id is required for CONSUME');
  const consumeQuantity = parseQuantity(payload.quantity, 'quantity');

  const { data: currentItem, error: currentError } = await supabase
    .from('uim_inventory_items')
    .select('id, quantity')
    .eq('tenant_id', context.tenantId)
    .eq('id', inventoryItemId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (currentError) throw new Error(`Failed to load inventory item for CONSUME: ${currentError.message}`);
  if (!currentItem) throw new Error('CONSUME target inventory item not found');

  const currentQuantity = Number(currentItem.quantity || 0);
  if (currentQuantity < consumeQuantity) {
    throw new Error('CONSUME quantity exceeds available item quantity');
  }

  const nextQuantity = Number((currentQuantity - consumeQuantity).toFixed(4));
  const nextStatus = nextQuantity <= 0 ? 'consumed' : 'available';

  const { data: updatedItem, error: updateError } = await supabase
    .from('uim_inventory_items')
    .update({
      quantity: nextQuantity,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    })
    .eq('tenant_id', context.tenantId)
    .eq('id', inventoryItemId)
    .select('id, quantity, status')
    .limit(1)
    .maybeSingle();
  if (updateError) throw new Error(`Failed to apply CONSUME command: ${updateError.message}`);

  const reservationId = String(payload.reservation_id || '').trim() || null;
  if (reservationId) {
    const { error: reservationUpdateError } = await supabase
      .from('uim_inventory_reservations')
      .update({
        reservation_status: 'fulfilled',
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', context.tenantId)
      .eq('id', reservationId);
    if (reservationUpdateError) {
      throw new Error(`Failed to mark reservation fulfilled: ${reservationUpdateError.message}`);
    }
  }

  const { error: ledgerError } = await supabase.from('uim_inventory_ledger').insert({
    tenant_id: context.tenantId,
    franchise_id: context.franchiseId || null,
    inventory_item_id: inventoryItemId,
    transaction_type: 'CONSUME',
    quantity_changed: consumeQuantity,
    reservation_id: reservationId,
    referenced_module: payload.referenced_module || null,
    referenced_record_id: payload.referenced_record_id || null,
    metadata: payload.metadata || {},
    performed_by: context.userId,
  });
  if (ledgerError) throw new Error(`Failed to write CONSUME ledger entry: ${ledgerError.message}`);

  return {
    inventory_item_id: inventoryItemId,
    consumed_quantity: consumeQuantity,
    remaining_quantity: Number(updatedItem?.quantity || nextQuantity),
    status: String(updatedItem?.status || nextStatus),
  };
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
    const access = await resolveUimAccess(req, ctx);
    const supabase = getSupabaseAdminClient();

    const requestBody = (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {};
    const commandType = parseCommandType(requestBody.command_type);
    const commandPayload = parsePayload(requestBody.command_payload);
    const idempotencyKey = String(requestBody.idempotency_key || '').trim() || null;

    if (idempotencyKey) {
      const { data: existingCommand, error: existingError } = await supabase
        .from('uim_inventory_commands')
        .select('id, command_status, command_type, command_payload, created_at, applied_at')
        .eq('tenant_id', access.tenantId)
        .eq('idempotency_key', idempotencyKey)
        .limit(1)
        .maybeSingle();
      if (existingError) throw new Error(`Failed to evaluate idempotency key: ${existingError.message}`);
      if (existingCommand) {
        res.status(200).json({
          version: 'v2',
          interface: 'uim-command-handler',
          correlationId: ctx.correlationId,
          output: {
            replayed: true,
            command: existingCommand,
          },
        });
        return;
      }
    }

    const { data: createdCommand, error: commandInsertError } = await supabase
      .from('uim_inventory_commands')
      .insert({
        tenant_id: access.tenantId,
        franchise_id: access.franchiseId || null,
        command_type: commandType,
        command_payload: commandPayload,
        idempotency_key: idempotencyKey,
        command_status: 'accepted',
        created_by: access.userId,
      })
      .select('id, command_type, command_status, command_payload, created_at')
      .limit(1)
      .maybeSingle();
    if (commandInsertError) throw new Error(`Failed to persist command envelope: ${commandInsertError.message}`);

    const commandId = String(createdCommand?.id || '');
    if (!commandId) throw new Error('Command envelope was not created');

    let commandOutput: Record<string, unknown>;
    if (commandType === 'RECEIVE') {
      commandOutput = await applyReceive(supabase, access, commandPayload);
    } else if (commandType === 'MOVE') {
      commandOutput = await applyMove(supabase, access, commandPayload);
    } else if (commandType === 'RESERVE') {
      commandOutput = await applyReserve(supabase, access, commandPayload);
    } else {
      commandOutput = await applyConsume(supabase, access, commandPayload);
    }

    const { error: commandUpdateError } = await supabase
      .from('uim_inventory_commands')
      .update({
        command_status: 'applied',
        applied_at: new Date().toISOString(),
      })
      .eq('tenant_id', access.tenantId)
      .eq('id', commandId);
    if (commandUpdateError) throw new Error(`Failed to mark command applied: ${commandUpdateError.message}`);

    res.status(200).json({
      version: 'v2',
      interface: 'uim-command-handler',
      correlationId: ctx.correlationId,
      output: {
        command_id: commandId,
        command_type: commandType,
        command_status: 'applied',
        applied_output: commandOutput,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
