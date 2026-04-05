import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { resolveUimAccess } from '../_shared';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { mapAmroPayloadToUimMetadata, mapUimAvailabilityRowToAmro } from '@/modules/uim/integration/uimAmroMapper';

type Action = 'reserve' | 'consume' | 'return' | 'sync-batch' | 'process-queue';

function parseBody(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object') return input as Record<string, unknown>;
  return {};
}

function parseAction(value: unknown): Action {
  const normalized = String(value || '').trim().toLowerCase();
  if (!['reserve', 'consume', 'return', 'sync-batch', 'process-queue'].includes(normalized)) {
    throw new Error('Unsupported action. Use reserve, consume, return, sync-batch, or process-queue');
  }
  return normalized as Action;
}

function parseQuantity(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${fieldName} must be a positive number`);
  return parsed;
}

async function enqueueJob(input: {
  tenantId: string;
  franchiseId: string | null;
  idempotencyKey: string;
  jobType: string;
  payload: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from('uim_amro_sync_jobs')
    .select('id, status, response_payload')
    .eq('tenant_id', input.tenantId)
    .eq('idempotency_key', input.idempotencyKey)
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(`Failed to verify idempotency for sync job: ${existingError.message}`);
  if (existing && String(existing.status || '') === 'succeeded') {
    return {
      jobId: String(existing.id || ''),
      replayed: true,
      responsePayload: (existing.response_payload || {}) as Record<string, unknown>,
    };
  }

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
      started_at: new Date().toISOString(),
      queued_at: new Date().toISOString(),
    })
    .select('id')
    .limit(1)
    .maybeSingle();
  if (insertError) throw new Error(`Failed to queue AMRO sync job: ${insertError.message}`);
  return {
    jobId: String(inserted?.id || ''),
    replayed: false,
    responsePayload: null as Record<string, unknown> | null,
  };
}

async function finalizeJob(input: {
  tenantId: string;
  jobId: string;
  status: 'succeeded' | 'retrying' | 'failed';
  responsePayload?: Record<string, unknown>;
  lastError?: string;
  nextRetryAt?: string | null;
}) {
  if (!input.jobId) return;
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
    completed_at: input.status === 'succeeded' || input.status === 'failed' ? new Date().toISOString() : null,
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

function buildIdempotencyKey(
  tenantId: string,
  action: Action,
  body: Record<string, unknown>,
): string {
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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  let activeJob: { tenantId: string; jobId: string } | null = null;

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
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
    const tenantId = access.tenantId;
    const franchiseId = access.franchiseId || null;
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      const partNumbersCsv = String(req.query.part_numbers || '').trim();
      const partNumbers = partNumbersCsv ? partNumbersCsv.split(',').map((item) => item.trim()).filter(Boolean) : [];

      let catalogQuery = supabase
        .from('uim_catalog_items')
        .select('id, sku, part_number, title')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);
      if (partNumbers.length > 0) catalogQuery = catalogQuery.in('part_number', partNumbers);
      const { data: catalogRows, error: catalogError } = await catalogQuery.limit(500);
      if (catalogError) throw new Error(`Failed to load UIM catalog availability rows: ${catalogError.message}`);

      const catalogIds = (catalogRows || []).map((row: any) => String(row.id));
      const { data: inventoryRows, error: inventoryError } = catalogIds.length > 0
        ? await supabase
          .from('uim_inventory_items')
          .select('id, catalog_item_id, quantity, status, location_type')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .in('catalog_item_id', catalogIds)
        : { data: [], error: null };
      if (inventoryError) throw new Error(`Failed to load UIM inventory rows: ${inventoryError.message}`);

      const { data: reservationRows, error: reservationError } = catalogIds.length > 0
        ? await supabase
          .from('uim_inventory_reservations')
          .select('catalog_item_id, reserved_quantity')
          .eq('tenant_id', tenantId)
          .eq('reservation_status', 'active')
          .in('catalog_item_id', catalogIds)
        : { data: [], error: null };
      if (reservationError) throw new Error(`Failed to load UIM reservation rows: ${reservationError.message}`);

      const { data: profileRows, error: profileError } = catalogIds.length > 0
        ? await supabase
          .from('uim_mro_item_profiles')
          .select('catalog_item_id, maintenance_category, ata_chapter_code, condition_code, certification_status, aog_priority')
          .eq('tenant_id', tenantId)
          .in('catalog_item_id', catalogIds)
        : { data: [], error: null };
      if (profileError) throw new Error(`Failed to load UIM MRO profile rows: ${profileError.message}`);

      const reservedByCatalog = new Map<string, number>();
      for (const row of reservationRows || []) {
        const key = String((row as any).catalog_item_id || '');
        const next = (reservedByCatalog.get(key) || 0) + Number((row as any).reserved_quantity || 0);
        reservedByCatalog.set(key, next);
      }
      const profileByCatalog = new Map<string, Record<string, unknown>>(
        (profileRows || []).map((row: any) => [String(row.catalog_item_id), row as Record<string, unknown>]),
      );

      const responseRows = (inventoryRows || []).map((inventory: any) => {
        const catalog = (catalogRows || []).find((row: any) => String(row.id) === String(inventory.catalog_item_id)) || {};
        const profile = profileByCatalog.get(String(inventory.catalog_item_id)) || {};
        const reserved = reservedByCatalog.get(String(inventory.catalog_item_id)) || 0;
        return mapUimAvailabilityRowToAmro({
          inventory_item_id: inventory.id,
          catalog_item_id: inventory.catalog_item_id,
          sku: (catalog as any).sku,
          part_number: (catalog as any).part_number,
          title: (catalog as any).title,
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

      res.status(200).json({
        version: 'v2',
        interface: 'uim-external-mro-pipeline-availability',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId,
          records: responseRows,
        },
      });
      return;
    }

    const body = parseBody(req.body);
    const action = parseAction(body.action);
    const idempotencyKey = buildIdempotencyKey(tenantId, action, body);
    const queued = await enqueueJob({
      tenantId,
      franchiseId,
      idempotencyKey,
      jobType: action === 'sync-batch' ? 'batch_sync' : action,
      payload: body,
    });
    activeJob = { tenantId, jobId: queued.jobId };
    if (queued.replayed && queued.responsePayload) {
      res.status(200).json({
        version: 'v2',
        interface: 'uim-external-mro-pipeline-replay',
        correlationId: ctx.correlationId,
        output: {
          ...queued.responsePayload,
          integration_job: {
            id: queued.jobId,
            replayed: true,
          },
        },
      });
      return;
    }

    if (action === 'reserve') {
      const partNumber = String(body.part_number || '').trim();
      const quantity = parseQuantity(body.quantity, 'quantity');
      if (!partNumber) throw new Error('part_number is required for reserve');
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

      const catalogItemId = String((catalog as any).id);
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

      const inventoryItemId = String((inventory as any).id);
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
        reservation_id: (reservation as any)?.id || null,
        referenced_module: 'amro',
        metadata: mapAmroPayloadToUimMetadata(body),
      });

      const output = {
        action,
        part_number: partNumber,
        reservation_id: String((reservation as any)?.id || ''),
        reservation_token: String((reservation as any)?.reservation_token || ''),
        reserved_quantity: quantity,
        integration_job: {
          id: queued.jobId,
          replayed: false,
        },
      };
      await finalizeJob({ tenantId, jobId: queued.jobId, status: 'succeeded', responsePayload: output });
      await supabase.from('uim_amro_sync_audit').insert({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        job_id: queued.jobId,
        action,
        direction: 'amro_to_uim',
        inventory_item_id: inventoryItemId,
        reservation_id: (reservation as any)?.id || null,
        payload: body,
        outcome: 'processed',
        correlation_id: ctx.correlationId,
      });
      res.status(200).json({ version: 'v2', interface: 'uim-external-mro-pipeline', correlationId: ctx.correlationId, output });
      return;
    }

    if (action === 'consume' || action === 'return') {
      const reservationId = String(body.reservation_id || '').trim();
      const quantity = parseQuantity(body.quantity, 'quantity');
      if (!reservationId) throw new Error('reservation_id is required for consume/return actions');

      const { data: reservation, error: reservationError } = await supabase
        .from('uim_inventory_reservations')
        .select('id, inventory_item_id, catalog_item_id, reserved_quantity, reservation_status')
        .eq('tenant_id', tenantId)
        .eq('id', reservationId)
        .limit(1)
        .maybeSingle();
      if (reservationError) throw new Error(`Failed to resolve reservation: ${reservationError.message}`);
      if (!reservation) throw new Error('Reservation not found');
      const inventoryItemId = String((reservation as any).inventory_item_id || '');
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

      const currentQuantity = Number((inventory as any).quantity || 0);
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
            ...(((reservation as any).metadata || {}) as Record<string, unknown>),
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
        integration_job: {
          id: queued.jobId,
          replayed: false,
        },
      };
      await finalizeJob({ tenantId, jobId: queued.jobId, status: 'succeeded', responsePayload: output });
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
        correlation_id: ctx.correlationId,
      });
      res.status(200).json({ version: 'v2', interface: 'uim-external-mro-pipeline', correlationId: ctx.correlationId, output });
      return;
    }

    if (action === 'sync-batch') {
      const records = Array.isArray(body.records) ? body.records as Array<Record<string, unknown>> : [];
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
        integration_job: {
          id: queued.jobId,
          replayed: false,
        },
      };
      await finalizeJob({ tenantId, jobId: queued.jobId, status: 'succeeded', responsePayload: output });
      await supabase.from('uim_amro_sync_audit').insert({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        job_id: queued.jobId,
        action,
        direction: 'amro_to_uim',
        payload: { count: rows.length },
        outcome: 'processed',
        correlation_id: ctx.correlationId,
      });
      res.status(200).json({ version: 'v2', interface: 'uim-external-mro-pipeline', correlationId: ctx.correlationId, output });
      return;
    }

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
      const attempts = Number((job as any).attempts || 0) + 1;
      const maxAttempts = Number((job as any).max_attempts || 5);
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
        .eq('id', String((job as any).id));
      processedJobIds.push(String((job as any).id));
    }

    const output = {
      action,
      processed_jobs: processedJobIds.length,
      processed_job_ids: processedJobIds,
      integration_job: {
        id: queued.jobId,
        replayed: false,
      },
    };
    await finalizeJob({ tenantId, jobId: queued.jobId, status: 'succeeded', responsePayload: output });
    res.status(200).json({ version: 'v2', interface: 'uim-external-mro-pipeline', correlationId: ctx.correlationId, output });
  } catch (error) {
    if (activeJob) {
      await finalizeJob({
        tenantId: activeJob.tenantId,
        jobId: activeJob.jobId,
        status: 'retrying',
        lastError: error instanceof Error ? error.message : String(error),
        nextRetryAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      });
    }
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
