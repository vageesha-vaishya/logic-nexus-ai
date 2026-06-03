// Phase 7 UIM Step 4b.8 — inventory commands route.
//
// Carves src/pages/api/v2/uim/commands/index.ts (413 LOC) into uim-api.
// The single biggest legacy UIM route. Generic command processor for
// inventory operations with idempotency support and an audit envelope
// table.
//
// Flow per request:
//   1. Validate command_type ∈ {RECEIVE, MOVE, RESERVE, CONSUME}
//   2. If idempotency_key set + envelope already exists → return
//      replayed=true with the prior envelope. No re-application.
//   3. INSERT uim_inventory_commands envelope, status='accepted'
//   4. Dispatch to the per-type applier (apply{Receive,Move,Reserve,
//      Consume}). Each applier writes the inventory mutation + an
//      uim_inventory_ledger entry.
//   5. UPDATE envelope status='applied' + applied_at=now()
//
// Behavior preserved verbatim from the legacy route so existing tests
// pass against the new surface byte-for-byte (when pointed here).

import { Router, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

type CommandType = 'RECEIVE' | 'MOVE' | 'RESERVE' | 'CONSUME';
type CommandPayload = Record<string, unknown>;
interface CommandContext { tenantId: string; franchiseId: string | null; userId: string; }

const COMMAND_TYPES = new Set<CommandType>(['RECEIVE', 'MOVE', 'RESERVE', 'CONSUME']);

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function bad(res: Response, message: string, code = 'INVALID_REQUEST', status = 400): void {
  res.status(status).json({ error: message, code, statusCode: status } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function parseCommandType(value: unknown): CommandType {
  const normalized = String(value || '').trim().toUpperCase();
  if (!COMMAND_TYPES.has(normalized as CommandType)) {
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

// ── Per-type appliers ───────────────────────────────────────────────

async function applyReceive(
  sb: SupabaseClient,
  ctx: CommandContext,
  payload: CommandPayload,
): Promise<Record<string, unknown>> {
  let catalogItemId = String(payload.catalog_item_id || '').trim();
  const quantity = parseQuantity(payload.quantity, 'quantity');
  if (!catalogItemId) {
    const sku = String(payload.sku || '').trim();
    const title = String(payload.title || payload.item_name || '').trim();
    if (!sku || !title) {
      throw new Error('catalog_item_id or (sku + title) is required for RECEIVE');
    }
    const { data: catalogItem, error: catalogErr } = await sb
      .from('uim_catalog_items')
      .insert({
        tenant_id: ctx.tenantId,
        franchise_id: ctx.franchiseId,
        sku,
        title,
        category: payload.category || null,
        unit_of_measure: payload.uom || 'pcs',
        attributes: payload.attributes || {},
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })
      .select('id')
      .limit(1)
      .maybeSingle();
    if (catalogErr) throw new Error(`catalog create: ${catalogErr.message}`);
    catalogItemId = String(catalogItem?.id || '');
  }
  if (!catalogItemId) throw new Error('Unable to resolve catalog item for RECEIVE');

  const { data: insertedItem, error: itemErr } = await sb
    .from('uim_inventory_items')
    .insert({
      tenant_id: ctx.tenantId,
      franchise_id: ctx.franchiseId,
      catalog_item_id: catalogItemId,
      quantity,
      status: 'available',
      location_type: payload.location_type || null,
      location_id: payload.location_id || null,
      metadata: payload.metadata || {},
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select('id, catalog_item_id, quantity, status')
    .limit(1)
    .maybeSingle();
  if (itemErr) throw new Error(`apply RECEIVE: ${itemErr.message}`);
  const itemId = String(insertedItem?.id || '');
  if (!itemId) throw new Error('RECEIVE failed to persist inventory item');

  const { error: ledgerErr } = await sb.from('uim_inventory_ledger').insert({
    tenant_id: ctx.tenantId,
    franchise_id: ctx.franchiseId,
    inventory_item_id: itemId,
    transaction_type: 'RECEIVE',
    quantity_changed: quantity,
    to_location_id: payload.location_id || null,
    metadata: payload.metadata || {},
    performed_by: ctx.userId,
  });
  if (ledgerErr) throw new Error(`RECEIVE ledger: ${ledgerErr.message}`);

  return { inventory_item_id: itemId, quantity };
}

async function applyMove(
  sb: SupabaseClient,
  ctx: CommandContext,
  payload: CommandPayload,
): Promise<Record<string, unknown>> {
  const inventoryItemId = String(payload.inventory_item_id || '').trim();
  if (!inventoryItemId) throw new Error('inventory_item_id is required for MOVE');
  const toLocationId = String(payload.to_location_id || '').trim();
  if (!toLocationId) throw new Error('to_location_id is required for MOVE');
  const fromLocationId = String(payload.from_location_id || '').trim() || null;

  const { data: updatedItem, error: updateErr } = await sb
    .from('uim_inventory_items')
    .update({
      location_id: toLocationId,
      location_type: payload.location_type || null,
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    })
    .eq('tenant_id', ctx.tenantId)
    .eq('id', inventoryItemId)
    .select('id, location_id')
    .limit(1)
    .maybeSingle();
  if (updateErr) throw new Error(`apply MOVE: ${updateErr.message}`);
  if (!updatedItem) throw new Error('MOVE target inventory item not found');

  const { error: ledgerErr } = await sb.from('uim_inventory_ledger').insert({
    tenant_id: ctx.tenantId,
    franchise_id: ctx.franchiseId,
    inventory_item_id: inventoryItemId,
    transaction_type: 'MOVE',
    quantity_changed: 0,
    from_location_id: fromLocationId,
    to_location_id: toLocationId,
    metadata: payload.metadata || {},
    performed_by: ctx.userId,
  });
  if (ledgerErr) throw new Error(`MOVE ledger: ${ledgerErr.message}`);

  return { inventory_item_id: inventoryItemId, from_location_id: fromLocationId, to_location_id: toLocationId };
}

async function applyReserve(
  sb: SupabaseClient,
  ctx: CommandContext,
  payload: CommandPayload,
): Promise<Record<string, unknown>> {
  const inventoryItemId = String(payload.inventory_item_id || '').trim();
  if (!inventoryItemId) throw new Error('inventory_item_id is required for RESERVE');
  let catalogItemId = String(payload.catalog_item_id || '').trim();
  if (!catalogItemId) {
    const { data: itemRecord, error: itemErr } = await sb
      .from('uim_inventory_items')
      .select('catalog_item_id')
      .eq('tenant_id', ctx.tenantId)
      .eq('id', inventoryItemId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (itemErr) throw new Error(`resolve catalog: ${itemErr.message}`);
    catalogItemId = String(itemRecord?.catalog_item_id || '');
  }
  if (!catalogItemId) throw new Error('Unable to resolve catalog_item_id for RESERVE');
  const reservedQuantity = parseQuantity(payload.quantity, 'quantity');
  const reservationToken = String(payload.reservation_token || `uim-resv-${Date.now().toString(36)}`);

  const { data: reservationRecord, error: reservationErr } = await sb
    .from('uim_inventory_reservations')
    .insert({
      tenant_id: ctx.tenantId,
      franchise_id: ctx.franchiseId,
      catalog_item_id: catalogItemId,
      inventory_item_id: inventoryItemId,
      reserved_quantity: reservedQuantity,
      reservation_status: 'active',
      reservation_token: reservationToken,
      expected_use_date: payload.expected_use_date || null,
      referenced_module: payload.referenced_module || null,
      referenced_record_id: payload.referenced_record_id || null,
      metadata: payload.metadata || {},
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select('id, reservation_token, reserved_quantity')
    .limit(1)
    .maybeSingle();
  if (reservationErr) throw new Error(`apply RESERVE: ${reservationErr.message}`);
  const reservationId = String(reservationRecord?.id || '');
  if (!reservationId) throw new Error('RESERVE failed to persist reservation');

  const { error: ledgerErr } = await sb.from('uim_inventory_ledger').insert({
    tenant_id: ctx.tenantId,
    franchise_id: ctx.franchiseId,
    inventory_item_id: inventoryItemId,
    transaction_type: 'RESERVE',
    quantity_changed: reservedQuantity,
    reservation_id: reservationId,
    referenced_module: payload.referenced_module || null,
    referenced_record_id: payload.referenced_record_id || null,
    metadata: payload.metadata || {},
    performed_by: ctx.userId,
  });
  if (ledgerErr) throw new Error(`RESERVE ledger: ${ledgerErr.message}`);

  return {
    reservation_id: reservationId,
    reservation_token: String(reservationRecord?.reservation_token || reservationToken),
    reserved_quantity: Number(reservationRecord?.reserved_quantity || reservedQuantity),
  };
}

async function applyConsume(
  sb: SupabaseClient,
  ctx: CommandContext,
  payload: CommandPayload,
): Promise<Record<string, unknown>> {
  const inventoryItemId = String(payload.inventory_item_id || '').trim();
  if (!inventoryItemId) throw new Error('inventory_item_id is required for CONSUME');
  const consumeQuantity = parseQuantity(payload.quantity, 'quantity');

  const { data: currentItem, error: currentErr } = await sb
    .from('uim_inventory_items')
    .select('id, quantity')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', inventoryItemId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (currentErr) throw new Error(`load for CONSUME: ${currentErr.message}`);
  if (!currentItem) throw new Error('CONSUME target inventory item not found');

  const currentQuantity = Number(currentItem.quantity || 0);
  if (currentQuantity < consumeQuantity) {
    throw new Error('CONSUME quantity exceeds available item quantity');
  }
  const nextQuantity = Number((currentQuantity - consumeQuantity).toFixed(4));
  const nextStatus = nextQuantity <= 0 ? 'consumed' : 'available';

  const { data: updatedItem, error: updateErr } = await sb
    .from('uim_inventory_items')
    .update({
      quantity: nextQuantity,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      updated_by: ctx.userId,
    })
    .eq('tenant_id', ctx.tenantId)
    .eq('id', inventoryItemId)
    .select('id, quantity, status')
    .limit(1)
    .maybeSingle();
  if (updateErr) throw new Error(`apply CONSUME: ${updateErr.message}`);

  const reservationId = String(payload.reservation_id || '').trim() || null;
  if (reservationId) {
    const { error: rUpdErr } = await sb
      .from('uim_inventory_reservations')
      .update({
        reservation_status: 'fulfilled',
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', ctx.tenantId)
      .eq('id', reservationId);
    if (rUpdErr) throw new Error(`mark reservation fulfilled: ${rUpdErr.message}`);
  }

  const { error: ledgerErr } = await sb.from('uim_inventory_ledger').insert({
    tenant_id: ctx.tenantId,
    franchise_id: ctx.franchiseId,
    inventory_item_id: inventoryItemId,
    transaction_type: 'CONSUME',
    quantity_changed: consumeQuantity,
    reservation_id: reservationId,
    referenced_module: payload.referenced_module || null,
    referenced_record_id: payload.referenced_record_id || null,
    metadata: payload.metadata || {},
    performed_by: ctx.userId,
  });
  if (ledgerErr) throw new Error(`CONSUME ledger: ${ledgerErr.message}`);

  return {
    inventory_item_id: inventoryItemId,
    consumed_quantity: consumeQuantity,
    remaining_quantity: Number(updatedItem?.quantity || nextQuantity),
    status: String(updatedItem?.status || nextStatus),
  };
}

// ── Route handler ───────────────────────────────────────────────────

router.post(
  '/v1/uim/commands',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const body = (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {};
    let commandType: CommandType;
    let commandPayload: CommandPayload;
    try {
      commandType = parseCommandType(body.command_type);
      commandPayload = parsePayload(body.command_payload);
    } catch (err) {
      return bad(res, err instanceof Error ? err.message : 'invalid command');
    }
    const idempotencyKey = String(body.idempotency_key || '').trim() || null;
    const ctx: CommandContext = {
      tenantId: authReq.tenantId,
      franchiseId: authReq.franchiseId ?? null,
      userId: authReq.userId,
    };

    try {
      const supabase = getServiceRoleClient();

      // Idempotency check — return prior envelope without re-applying.
      if (idempotencyKey) {
        const { data: existing, error: existingErr } = await supabase
          .from('uim_inventory_commands')
          .select('id, command_status, command_type, command_payload, created_at, applied_at')
          .eq('tenant_id', ctx.tenantId)
          .eq('idempotency_key', idempotencyKey)
          .limit(1)
          .maybeSingle();
        if (existingErr) throw new Error(`idempotency check: ${existingErr.message}`);
        if (existing) {
          return res.json({ replayed: true, command: existing });
        }
      }

      // Create envelope.
      const { data: createdCmd, error: createErr } = await supabase
        .from('uim_inventory_commands')
        .insert({
          tenant_id: ctx.tenantId,
          franchise_id: ctx.franchiseId,
          command_type: commandType,
          command_payload: commandPayload,
          idempotency_key: idempotencyKey,
          command_status: 'accepted',
          created_by: ctx.userId,
        })
        .select('id, command_type, command_status, command_payload, created_at')
        .limit(1)
        .maybeSingle();
      if (createErr) throw new Error(`envelope create: ${createErr.message}`);
      const commandId = String(createdCmd?.id || '');
      if (!commandId) throw new Error('Command envelope was not created');

      // Dispatch.
      let appliedOutput: Record<string, unknown>;
      try {
        appliedOutput =
          commandType === 'RECEIVE' ? await applyReceive(supabase, ctx, commandPayload) :
          commandType === 'MOVE'    ? await applyMove(supabase, ctx, commandPayload) :
          commandType === 'RESERVE' ? await applyReserve(supabase, ctx, commandPayload) :
                                       await applyConsume(supabase, ctx, commandPayload);
      } catch (applyErr) {
        // Mark envelope as failed so the audit row reflects what actually
        // happened. Then re-throw — the outer handler returns 500.
        const failMessage = applyErr instanceof Error ? applyErr.message : String(applyErr);
        await supabase
          .from('uim_inventory_commands')
          .update({
            command_status: 'failed',
            applied_at: new Date().toISOString(),
            metadata: { error: failMessage.slice(0, 4000) },
          })
          .eq('tenant_id', ctx.tenantId)
          .eq('id', commandId);
        throw applyErr;
      }

      // Mark applied.
      const { error: updErr } = await supabase
        .from('uim_inventory_commands')
        .update({
          command_status: 'applied',
          applied_at: new Date().toISOString(),
        })
        .eq('tenant_id', ctx.tenantId)
        .eq('id', commandId);
      if (updErr) throw new Error(`envelope mark applied: ${updErr.message}`);

      logger.info('uim.commands applied', {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        commandType,
        commandId,
      });

      return res.status(200).json({
        command_id: commandId,
        command_type: commandType,
        command_status: 'applied',
        applied_output: appliedOutput,
      });
    } catch (err) {
      logger.error('uim.commands error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Command failed',
        code: 'UIM_COMMAND_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
