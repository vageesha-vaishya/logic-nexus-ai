// Phase 7 UIM Step 4b.12 — external MRO pipeline route.
//
// Carves src/pages/api/v2/uim/integrations/external-mro-pipeline.ts
// (547 LOC) into uim-api. The biggest remaining single legacy file.
// Two-method endpoint with job-queue dispatch + idempotency replay:
//
//   GET  /api/v1/uim/integrations/external-mro-pipeline
//        ?part_numbers=PN1,PN2,…
//        → AMRO-shaped availability rows (catalog + inventory +
//          reservations + MRO profile join, mapped through
//          mapUimAvailabilityRowToAmro).
//
//   POST /api/v1/uim/integrations/external-mro-pipeline
//        body: { action, … }
//        action ∈ { reserve, consume, return, sync-batch, process-queue }
//        → All actions enqueue a uim_amro_sync_jobs row first. If an
//          idempotency-key collision finds a 'succeeded' job, the
//          stored response_payload is replayed verbatim (no side
//          effects). Otherwise the action applies and the job is
//          finalized 'succeeded'; on throw the job is finalized
//          'retrying' with next_retry_at = now + 2min.
//
// The 4 mutating actions also insert a uim_amro_sync_audit row
// (direction='amro_to_uim', outcome='processed') so the AMRO ↔ UIM
// boundary has a complete event trail. process-queue is a one-shot
// drain of due jobs (queued/retrying with next_retry_at ≤ now); it
// marks them 'failed' if attempts ≥ max_attempts else 'succeeded'.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';
import { mapAmroPayloadToUimMetadata, mapUimAvailabilityRowToAmro } from '../services/amro-mapper.js';

const router = Router();

type Action = 'reserve' | 'consume' | 'return' | 'sync-batch' | 'process-queue';

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function bad(res: Response, message: string): void {
  res.status(400).json({
    error: message,
    code: 'INVALID_REQUEST',
    statusCode: 400,
  } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function parseBody(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object') return input as Record<string, unknown>;
  return {};
}

function parseAction(value: unknown): Action | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!['reserve', 'consume', 'return', 'sync-batch', 'process-queue'].includes(normalized)) {
    return null;
  }
  return normalized as Action;
}

function parseQuantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('quantity must be a positive number');
  }
  return parsed;
}

function buildIdempotencyKey(tenantId: string, action: Action, body: Record<string, unknown>): string {
  const explicit = String(body.idempotency_key || '').trim();
  if (explicit) return explicit;
  return [
    tenantId,
    action,
    String(body.part_number || ''),
    String(body.reservation_id || ''),
    String(body.quantity || ''),
    String(body.maintenance_order_id || ''),
  ].join(':');
}

type SupabaseClient = ReturnType<typeof getServiceRoleClient>;

async function enqueueJob(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    franchiseId: string | null;
    idempotencyKey: string;
    jobType: string;
    payload: Record<string, unknown>;
  },
): Promise<{ jobId: string; replayed: boolean; responsePayload: Record<string, unknown> | null }> {
  const { data: existing, error: existingError } = await supabase
    .from('uim_amro_sync_jobs')
    .select('id, status, response_payload')
    .eq('tenant_id', input.tenantId)
    .eq('idempotency_key', input.idempotencyKey)
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(`Failed to verify idempotency for sync job: ${existingError.message}`);
  if (existing && String((existing as Record<string, unknown>).status || '') === 'succeeded') {
    return {
      jobId: String((existing as Record<string, unknown>).id || ''),
      replayed: true,
      responsePayload: ((existing as Record<string, unknown>).response_payload || {}) as Record<string, unknown>,
    };
  }

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from('uim_amro_sync_jobs')
    .insert({
      tenant_id: input.tenantId,
      franchise_id: input.franchiseId,
      job_type: input.jobType,
      status: 'running',
      idempotency_key: input.idempotencyKey,
      payload: input.payload,
      attempts: 1,
      max_attempts: 5,
      started_at: nowIso,
      queued_at: nowIso,
    })
    .select('id')
    .limit(1)
    .maybeSingle();
  if (insertError) throw new Error(`Failed to queue AMRO sync job: ${insertError.message}`);
  return {
    jobId: String((inserted as Record<string, unknown>)?.id || ''),
    replayed: false,
    responsePayload: null,
  };
}

async function finalizeJob(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    jobId: string;
    status: 'succeeded' | 'retrying' | 'failed';
    responsePayload?: Record<string, unknown>;
    lastError?: string;
    nextRetryAt?: string | null;
  },
): Promise<void> {
  if (!input.jobId) return;
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: nowIso,
    completed_at: input.status === 'succeeded' || input.status === 'failed' ? nowIso : null,
  };
  if (input.responsePayload) patch.response_payload = input.responsePayload;
  if (input.lastError) patch.last_error = input.lastError;
  if (input.nextRetryAt !== undefined) patch.next_retry_at = input.nextRetryAt;
  const { error } = await supabase
    .from('uim_amro_sync_jobs')
    .update(patch)
    .eq('tenant_id', input.tenantId)
    .eq('id', input.jobId);
  if (error) throw new Error(`Failed to update AMRO sync job status: ${error.message}`);
}

// ── GET — availability ──────────────────────────────────────────────
router.get(
  '/v1/uim/integrations/external-mro-pipeline',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const tenantId = authReq.tenantId;
    const franchiseId = authReq.franchiseId || null;

    const partNumbersCsv = String(req.query.part_numbers || '').trim();
    const partNumbers = partNumbersCsv
      ? partNumbersCsv.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

    try {
      const supabase = getServiceRoleClient();
      let catalogQuery = supabase
        .from('uim_catalog_items')
        .select('id, sku, part_number, title')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);
      if (partNumbers.length > 0) catalogQuery = catalogQuery.in('part_number', partNumbers);
      const { data: catalogRows, error: catalogError } = await catalogQuery.limit(500);
      if (catalogError) throw new Error(`Failed to load UIM catalog availability rows: ${catalogError.message}`);

      const catalogIds = (catalogRows || []).map((row) => String((row as Record<string, unknown>).id));
      const inventoryQ = catalogIds.length > 0
        ? await supabase
            .from('uim_inventory_items')
            .select('id, catalog_item_id, quantity, status, location_type')
            .eq('tenant_id', tenantId)
            .is('deleted_at', null)
            .in('catalog_item_id', catalogIds)
        : { data: [] as Array<Record<string, unknown>>, error: null };
      if (inventoryQ.error) throw new Error(`Failed to load UIM inventory rows: ${inventoryQ.error.message}`);
      const inventoryRows = (inventoryQ.data || []) as Array<Record<string, unknown>>;

      const reservationQ = catalogIds.length > 0
        ? await supabase
            .from('uim_inventory_reservations')
            .select('catalog_item_id, reserved_quantity')
            .eq('tenant_id', tenantId)
            .eq('reservation_status', 'active')
            .in('catalog_item_id', catalogIds)
        : { data: [] as Array<Record<string, unknown>>, error: null };
      if (reservationQ.error) throw new Error(`Failed to load UIM reservation rows: ${reservationQ.error.message}`);

      const profileQ = catalogIds.length > 0
        ? await supabase
            .from('uim_mro_item_profiles')
            .select('catalog_item_id, maintenance_category, ata_chapter_code, condition_code, certification_status, aog_priority')
            .eq('tenant_id', tenantId)
            .in('catalog_item_id', catalogIds)
        : { data: [] as Array<Record<string, unknown>>, error: null };
      if (profileQ.error) throw new Error(`Failed to load UIM MRO profile rows: ${profileQ.error.message}`);

      const reservedByCatalog = new Map<string, number>();
      for (const row of reservationQ.data || []) {
        const r = row as Record<string, unknown>;
        const key = String(r.catalog_item_id || '');
        const next = (reservedByCatalog.get(key) || 0) + Number(r.reserved_quantity || 0);
        reservedByCatalog.set(key, next);
      }
      const profileByCatalog = new Map<string, Record<string, unknown>>(
        (profileQ.data || []).map((row) => {
          const r = row as Record<string, unknown>;
          return [String(r.catalog_item_id), r] as const;
        }),
      );

      const responseRows = inventoryRows.map((inventory) => {
        const catalog =
          (catalogRows || []).find(
            (row) => String((row as Record<string, unknown>).id) === String(inventory.catalog_item_id),
          ) || ({} as Record<string, unknown>);
        const profile = profileByCatalog.get(String(inventory.catalog_item_id)) || {};
        const reserved = reservedByCatalog.get(String(inventory.catalog_item_id)) || 0;
        return mapUimAvailabilityRowToAmro({
          inventory_item_id: inventory.id,
          catalog_item_id: inventory.catalog_item_id,
          sku: (catalog as Record<string, unknown>).sku,
          part_number: (catalog as Record<string, unknown>).part_number,
          title: (catalog as Record<string, unknown>).title,
          quantity: inventory.quantity,
          projected_reserved_quantity: reserved,
          status: inventory.status,
          location_type: inventory.location_type,
          maintenance_category: profile.maintenance_category,
          ata_chapter_code: profile.ata_chapter_code,
          condition_code: profile.condition_code,
          certification_status: profile.certification_status,
          aog_priority: profile.aog_priority,
        });
      });

      return res.status(200).json({
        version: 'v1',
        interface: 'uim-external-mro-pipeline-availability',
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId,
          records: responseRows,
        },
      });
    } catch (err) {
      logger.error('uim.external-mro-pipeline GET error', { error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load availability',
        code: 'UIM_AMRO_PIPELINE_GET_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── POST — actions ──────────────────────────────────────────────────
router.post(
  '/v1/uim/integrations/external-mro-pipeline',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const tenantId = authReq.tenantId;
    const franchiseId = authReq.franchiseId || null;

    const body = parseBody(req.body);
    const action = parseAction(body.action);
    if (!action) {
      return bad(res, 'Unsupported action. Use reserve, consume, return, sync-batch, or process-queue');
    }

    const supabase = getServiceRoleClient();
    const idempotencyKey = buildIdempotencyKey(tenantId, action, body);
    let queued: { jobId: string; replayed: boolean; responsePayload: Record<string, unknown> | null };
    try {
      queued = await enqueueJob(supabase, {
        tenantId,
        franchiseId,
        idempotencyKey,
        jobType: action === 'sync-batch' ? 'batch_sync' : action,
        payload: body,
      });
    } catch (err) {
      logger.error('uim.external-mro-pipeline enqueue error', { error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to enqueue sync job',
        code: 'UIM_AMRO_PIPELINE_ENQUEUE_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }

    if (queued.replayed && queued.responsePayload) {
      return res.status(200).json({
        version: 'v1',
        interface: 'uim-external-mro-pipeline-replay',
        output: {
          ...queued.responsePayload,
          integration_job: { id: queued.jobId, replayed: true },
        },
      });
    }

    const activeJob = { tenantId, jobId: queued.jobId };

    try {
      if (action === 'reserve') {
        const partNumber = String(body.part_number || '').trim();
        if (!partNumber) throw new Error('part_number is required for reserve');
        const quantity = parseQuantity(body.quantity);

        const { data: catalog, error: catalogError } = await supabase
          .from('uim_catalog_items')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('part_number', partNumber)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();
        if (catalogError) throw new Error(`Failed to resolve catalog item for reserve: ${catalogError.message}`);
        if (!catalog) throw new Error(`No UIM catalog item found for part_number ${partNumber}`);
        const catalogItemId = String((catalog as Record<string, unknown>).id);

        const { data: inventory, error: inventoryError } = await supabase
          .from('uim_inventory_items')
          .select('id, quantity')
          .eq('tenant_id', tenantId)
          .eq('catalog_item_id', catalogItemId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (inventoryError) throw new Error(`Failed to resolve inventory item for reserve: ${inventoryError.message}`);
        if (!inventory) throw new Error('No UIM inventory item available for reserve');
        const inventoryItemId = String((inventory as Record<string, unknown>).id);

        const { data: reservation, error: reservationError } = await supabase
          .from('uim_inventory_reservations')
          .insert({
            tenant_id: tenantId,
            franchise_id: franchiseId,
            catalog_item_id: catalogItemId,
            inventory_item_id: inventoryItemId,
            reserved_quantity: quantity,
            reservation_status: 'active',
            reservation_token: `uim-amro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            referenced_module: 'amro',
            metadata: mapAmroPayloadToUimMetadata(body),
          })
          .select('id, reservation_token')
          .limit(1)
          .maybeSingle();
        if (reservationError) throw new Error(`Failed to create UIM reservation: ${reservationError.message}`);

        await supabase.from('uim_inventory_ledger').insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          inventory_item_id: inventoryItemId,
          transaction_type: 'RESERVE',
          quantity_changed: quantity,
          reservation_id: (reservation as Record<string, unknown>)?.id || null,
          referenced_module: 'amro',
          metadata: mapAmroPayloadToUimMetadata(body),
        });

        const output = {
          action,
          part_number: partNumber,
          reservation_id: String((reservation as Record<string, unknown>)?.id || ''),
          reservation_token: String((reservation as Record<string, unknown>)?.reservation_token || ''),
          reserved_quantity: quantity,
          integration_job: { id: queued.jobId, replayed: false },
        };
        await finalizeJob(supabase, { tenantId, jobId: queued.jobId, status: 'succeeded', responsePayload: output });
        await supabase.from('uim_amro_sync_audit').insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          job_id: queued.jobId,
          action,
          direction: 'amro_to_uim',
          inventory_item_id: inventoryItemId,
          reservation_id: (reservation as Record<string, unknown>)?.id || null,
          payload: body,
          outcome: 'processed',
        });
        return res.status(200).json({ version: 'v1', interface: 'uim-external-mro-pipeline', output });
      }

      if (action === 'consume' || action === 'return') {
        const reservationId = String(body.reservation_id || '').trim();
        if (!reservationId) throw new Error('reservation_id is required for consume/return actions');
        const quantity = parseQuantity(body.quantity);

        const { data: reservation, error: reservationError } = await supabase
          .from('uim_inventory_reservations')
          .select('id, inventory_item_id, catalog_item_id, reserved_quantity, reservation_status, metadata')
          .eq('tenant_id', tenantId)
          .eq('id', reservationId)
          .limit(1)
          .maybeSingle();
        if (reservationError) throw new Error(`Failed to resolve reservation: ${reservationError.message}`);
        if (!reservation) throw new Error('Reservation not found');
        const inventoryItemId = String((reservation as Record<string, unknown>).inventory_item_id || '');
        if (!inventoryItemId) throw new Error('Reservation has no inventory_item_id');

        const { data: inventory, error: inventoryError } = await supabase
          .from('uim_inventory_items')
          .select('id, quantity')
          .eq('tenant_id', tenantId)
          .eq('id', inventoryItemId)
          .limit(1)
          .maybeSingle();
        if (inventoryError) throw new Error(`Failed to load inventory row: ${inventoryError.message}`);
        if (!inventory) throw new Error('Inventory item not found for reservation');

        const currentQuantity = Number((inventory as Record<string, unknown>).quantity || 0);
        const nextQuantity = action === 'consume' ? currentQuantity - quantity : currentQuantity + quantity;
        if (nextQuantity < 0) throw new Error('consume quantity exceeds available quantity');

        const nextStatus = nextQuantity <= 0 ? 'consumed' : 'available';
        const { error: updateError } = await supabase
          .from('uim_inventory_items')
          .update({
            quantity: nextQuantity,
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('id', inventoryItemId);
        if (updateError) throw new Error(`Failed to update inventory quantity: ${updateError.message}`);

        const reservationStatus = action === 'consume' ? 'fulfilled' : 'cancelled';
        await supabase
          .from('uim_inventory_reservations')
          .update({
            reservation_status: reservationStatus,
            updated_at: new Date().toISOString(),
            metadata: {
              ...(((reservation as Record<string, unknown>).metadata || {}) as Record<string, unknown>),
              processed_via: 'uim-amro-pipeline',
            },
          })
          .eq('tenant_id', tenantId)
          .eq('id', reservationId);

        await supabase.from('uim_inventory_ledger').insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          inventory_item_id: inventoryItemId,
          transaction_type: action === 'consume' ? 'CONSUME' : 'RETURN',
          quantity_changed: quantity,
          reservation_id: reservationId,
          referenced_module: 'amro',
          metadata: mapAmroPayloadToUimMetadata(body),
        });

        const output = {
          action,
          reservation_id: reservationId,
          inventory_item_id: inventoryItemId,
          quantity_processed: quantity,
          quantity_on_hand: nextQuantity,
          status: nextStatus,
          integration_job: { id: queued.jobId, replayed: false },
        };
        await finalizeJob(supabase, { tenantId, jobId: queued.jobId, status: 'succeeded', responsePayload: output });
        await supabase.from('uim_amro_sync_audit').insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          job_id: queued.jobId,
          action,
          direction: 'amro_to_uim',
          inventory_item_id: inventoryItemId,
          reservation_id: reservationId,
          payload: body,
          outcome: 'processed',
        });
        return res.status(200).json({ version: 'v1', interface: 'uim-external-mro-pipeline', output });
      }

      if (action === 'sync-batch') {
        const records = Array.isArray(body.records) ? (body.records as Array<Record<string, unknown>>) : [];
        if (!records.length) throw new Error('records array is required for sync-batch');
        const rows = records.map((record, index) => {
          const partNumber = String(record.part_number || '').trim() || `AMRO-PN-${String(index + 1).padStart(8, '0')}`;
          return {
            tenant_id: tenantId,
            franchise_id: franchiseId,
            sku: String(record.sku || `AMRO-${partNumber}`),
            part_number: partNumber,
            title: String(record.title || record.description || `Synced AMRO Item ${index + 1}`),
            category: String(record.category || 'rotable'),
            unit_of_measure: String(record.uom || 'EA'),
            attributes: {
              ...record,
              source_system: 'amro',
            },
          };
        });
        const { error: upsertError } = await supabase
          .from('uim_catalog_items')
          .upsert(rows, { onConflict: 'tenant_id,sku' });
        if (upsertError) throw new Error(`Failed to upsert sync-batch catalog records: ${upsertError.message}`);

        const output = {
          action,
          synced_records: rows.length,
          integration_job: { id: queued.jobId, replayed: false },
        };
        await finalizeJob(supabase, { tenantId, jobId: queued.jobId, status: 'succeeded', responsePayload: output });
        await supabase.from('uim_amro_sync_audit').insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          job_id: queued.jobId,
          action,
          direction: 'amro_to_uim',
          payload: { count: rows.length },
          outcome: 'processed',
        });
        return res.status(200).json({ version: 'v1', interface: 'uim-external-mro-pipeline', output });
      }

      // process-queue
      const nowIso = new Date().toISOString();
      const { data: dueJobs, error: dueJobsError } = await supabase
        .from('uim_amro_sync_jobs')
        .select('id, status, attempts, max_attempts')
        .eq('tenant_id', tenantId)
        .in('status', ['queued', 'retrying'])
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .limit(100);
      if (dueJobsError) throw new Error(`Failed to load due queue jobs: ${dueJobsError.message}`);

      const processedJobIds: string[] = [];
      for (const job of dueJobs || []) {
        const j = job as Record<string, unknown>;
        const attempts = Number(j.attempts || 0) + 1;
        const maxAttempts = Number(j.max_attempts || 5);
        const status = attempts >= maxAttempts ? 'failed' : 'succeeded';
        await supabase
          .from('uim_amro_sync_jobs')
          .update({
            status,
            attempts,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('id', String(j.id));
        processedJobIds.push(String(j.id));
      }

      const output = {
        action,
        processed_jobs: processedJobIds.length,
        processed_job_ids: processedJobIds,
        integration_job: { id: queued.jobId, replayed: false },
      };
      await finalizeJob(supabase, { tenantId, jobId: queued.jobId, status: 'succeeded', responsePayload: output });
      return res.status(200).json({ version: 'v1', interface: 'uim-external-mro-pipeline', output });
    } catch (err) {
      // Finalize the job into 'retrying' so the next process-queue
      // call picks it back up. 2-minute backoff matches legacy.
      try {
        await finalizeJob(supabase, {
          tenantId: activeJob.tenantId,
          jobId: activeJob.jobId,
          status: 'retrying',
          lastError: err instanceof Error ? err.message : String(err),
          nextRetryAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        });
      } catch (finalizeErr) {
        logger.error('uim.external-mro-pipeline finalize-on-error failed', {
          error: String(finalizeErr),
          originalError: String(err),
        });
      }
      const message = err instanceof Error ? err.message : 'AMRO pipeline action failed';
      const status = /required|exceeds|not found/i.test(message) ? 400 : 500;
      const code = status === 400 ? 'INVALID_REQUEST' : 'UIM_AMRO_PIPELINE_ACTION_ERROR';
      logger.error('uim.external-mro-pipeline action error', { action, error: String(err) });
      return res.status(status).json({ error: message, code, statusCode: status } as ErrorResponse);
    }
  }),
);

export default router;
