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

type SyncInterface =
  | 'status'
  | 'sync-catalog-and-stock'
  | 'sync-reservations'
  | 'asset-movements';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_UIM_SYNC_V2_ENABLED, true);
}

function parseInterface(value: unknown): SyncInterface {
  const normalized = String(value || 'status').trim().toLowerCase();
  if (
    normalized !== 'status'
    && normalized !== 'sync-catalog-and-stock'
    && normalized !== 'sync-reservations'
    && normalized !== 'asset-movements'
  ) {
    throw new Error('Unsupported interface');
  }
  return normalized as SyncInterface;
}

function parseBody(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

function normalizeUuid(value: unknown): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  return uuidPattern.test(normalized) ? normalized : null;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const startedAt = Date.now();
  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions, ['dashboards.view']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const franchiseId = String(access.franchiseId || '');
    if (!tenantId) throw new Error('Tenant context is required');

    const selectedInterface = parseInterface(req.query.interface || req.query.action);
    const supabase = getSupabaseAdminClient();

    if (selectedInterface === 'status' && req.method === 'GET') {
      const [catalogCount, stockCount, reservationCount, amroPartsCount] = await Promise.all([
        supabase.from('uim_catalog_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('uim_inventory_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('uim_inventory_reservations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('parts_inventory').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      ]);
      if (catalogCount.error) throw new Error(`Failed to count UIM catalog items: ${catalogCount.error.message}`);
      if (stockCount.error) throw new Error(`Failed to count UIM inventory items: ${stockCount.error.message}`);
      if (reservationCount.error) throw new Error(`Failed to count UIM reservations: ${reservationCount.error.message}`);
      if (amroPartsCount.error) throw new Error(`Failed to count AMRO parts inventory: ${amroPartsCount.error.message}`);

      res.status(200).json({
        version: 'v2',
        interface: 'amro-uim-sync-status',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId || null,
          counters: {
            uim_catalog_items: Number(catalogCount.count || 0),
            uim_inventory_items: Number(stockCount.count || 0),
            uim_reservations: Number(reservationCount.count || 0),
            amro_parts_inventory: Number(amroPartsCount.count || 0),
          },
          sync_health: 'ready',
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    if (selectedInterface === 'sync-catalog-and-stock' && req.method === 'POST') {
      const body = parseBody(req.body);
      const maxRows = Math.max(1, Math.min(500, Number(body.max_rows || 200) || 200));
      const { data: amroParts, error: amroPartsError } = await supabase
        .from('parts_inventory')
        .select('id, part_number, description, category, unit_of_measure, quantity_on_hand, quantity_reserved, warehouse_location, supplier_name')
        .eq('tenant_id', tenantId)
        .limit(maxRows);
      if (amroPartsError) throw new Error(`Failed to read AMRO inventory for sync: ${amroPartsError.message}`);

      const rows = amroParts || [];
      let syncedCatalog = 0;
      let syncedStock = 0;
      const syncErrors: string[] = [];

      for (const row of rows) {
        const partNumber = String(row.part_number || '').trim();
        if (!partNumber) continue;
        const sku = `AMRO-${partNumber}`;
        const title = String(row.description || partNumber).trim();
        const unitOfMeasure = String(row.unit_of_measure || 'pcs').trim() || 'pcs';
        const category = String(row.category || 'amro-general').trim();
        const qtyOnHand = Number(row.quantity_on_hand || 0);
        const qtyReserved = Number(row.quantity_reserved || 0);
        const qtyAvailable = Math.max(0, Number((qtyOnHand - qtyReserved).toFixed(4)));
        const inventorySerial = `AMRO-STOCK-${partNumber}`;
        const warehouseLocation = String(row.warehouse_location || 'AMRO-MAIN').trim() || 'AMRO-MAIN';
        const supplierName = String(row.supplier_name || '').trim() || null;
        const sourcePartInventoryId = String(row.id || '').trim();

        const { data: upsertedCatalog, error: upsertCatalogError } = await supabase
          .from('uim_catalog_items')
          .upsert({
            tenant_id: tenantId,
            franchise_id: franchiseId || null,
            sku,
            part_number: partNumber,
            title,
            category,
            unit_of_measure: unitOfMeasure,
            is_serialized: false,
            attributes: {
              source_module: 'AMRO',
              source_table: 'parts_inventory',
              source_record_id: sourcePartInventoryId,
              warehouse_location: warehouseLocation,
              supplier_name: supplierName,
            },
            created_by: auth.userId,
            updated_by: auth.userId,
          }, {
            onConflict: 'tenant_id,sku',
          })
          .select('id')
          .limit(1)
          .maybeSingle();
        if (upsertCatalogError) {
          syncErrors.push(`catalog:${partNumber}:${upsertCatalogError.message}`);
          continue;
        }
        const catalogItemId = String(upsertedCatalog?.id || '');
        if (!catalogItemId) {
          syncErrors.push(`catalog:${partNumber}:missing-catalog-id`);
          continue;
        }
        syncedCatalog += 1;

        const { error: upsertStockError } = await supabase
          .from('uim_inventory_items')
          .upsert({
            tenant_id: tenantId,
            franchise_id: franchiseId || null,
            catalog_item_id: catalogItemId,
            serial_number: inventorySerial,
            batch_lot_number: `AMRO-BATCH-${partNumber}`,
            quantity: qtyAvailable,
            status: qtyAvailable > 0 ? 'available' : 'reserved',
            location_type: 'warehouse',
            location_id: null,
            metadata: {
              source_module: 'AMRO',
              warehouse_location: warehouseLocation,
              source_part_inventory_id: sourcePartInventoryId,
            },
            created_by: auth.userId,
            updated_by: auth.userId,
          }, {
            onConflict: 'tenant_id,serial_number',
          });
        if (upsertStockError) {
          syncErrors.push(`stock:${partNumber}:${upsertStockError.message}`);
          continue;
        }
        syncedStock += 1;
      }

      // ADR-0013 Step 66: amro_uim_inventory_sync_events was dropped
      // once the parts_consumed outbox emitter (Step 64) + UIM consumer
      // (Step 65) replaced the polling pipeline. The audit summary now
      // lives in correlation logs + core.outbox.audit. We keep the
      // info-level log so ops can still trace bulk-sync calls.
      logger.info('amro-uim-bulk-sync-completed', {
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId,
        recordsProcessed: rows.length,
        recordsSucceeded: syncedStock,
        recordsFailed: rows.length - syncedStock,
        status: syncErrors.length > 0 ? 'partial' : 'success',
        sampleErrors: syncErrors.slice(0, 10),
      });

      res.status(200).json({
        version: 'v2',
        interface: 'amro-uim-sync-catalog-and-stock',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId || null,
          processed_rows: rows.length,
          synced_catalog_items: syncedCatalog,
          synced_inventory_items: syncedStock,
          failed_rows: rows.length - syncedStock,
          sample_errors: syncErrors.slice(0, 10),
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    if (selectedInterface === 'sync-reservations' && req.method === 'POST') {
      const body = parseBody(req.body);
      const reservationRows = Array.isArray(body.reservations) ? body.reservations : [];
      if (reservationRows.length === 0) throw new Error('reservations[] is required');

      let synced = 0;
      for (const row of reservationRows) {
        const normalized = parseBody(row);
        const reservationToken = String(normalized.reservation_token || `amro-sync-${Date.now()}-${synced}`).trim();
        const catalogItemId = String(normalized.catalog_item_id || '').trim();
        const inventoryItemId = String(normalized.inventory_item_id || '').trim() || null;
        const referencedRecordId = normalizeUuid(normalized.referenced_record_id);
        const reservedQuantity = Number(normalized.reserved_quantity || 0);
        if (!catalogItemId || !Number.isFinite(reservedQuantity) || reservedQuantity <= 0) continue;

        const { error: reservationError } = await supabase.from('uim_inventory_reservations').upsert({
          tenant_id: tenantId,
          franchise_id: franchiseId || null,
          catalog_item_id: catalogItemId,
          inventory_item_id: inventoryItemId,
          reserved_quantity: reservedQuantity,
          reservation_status: String(normalized.reservation_status || 'active').trim().toLowerCase(),
          reservation_token: reservationToken,
          expected_use_date: normalized.expected_use_date || null,
          referenced_module: 'AMRO',
          referenced_record_id: referencedRecordId,
          metadata: {
            source_module: 'AMRO',
            work_order_id: normalized.work_order_id || null,
            external_reference: normalized.referenced_record_id || null,
          },
          created_by: auth.userId,
          updated_by: auth.userId,
        }, { onConflict: 'tenant_id,reservation_token' });
        if (!reservationError) synced += 1;
      }

      res.status(200).json({
        version: 'v2',
        interface: 'amro-uim-sync-reservations',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId || null,
          received_rows: reservationRows.length,
          synced_rows: synced,
          failed_rows: reservationRows.length - synced,
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    if (selectedInterface === 'asset-movements' && req.method === 'GET') {
      const maxRows = Math.max(1, Math.min(500, Number(req.query.limit || 100) || 100));
      const { data: movementRows, error: movementError } = await supabase
        .from('uim_inventory_ledger')
        .select('id, inventory_item_id, transaction_type, quantity_changed, from_location_id, to_location_id, referenced_module, referenced_record_id, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(maxRows);
      if (movementError) throw new Error(`Failed to read asset movement ledger: ${movementError.message}`);

      res.status(200).json({
        version: 'v2',
        interface: 'amro-uim-asset-movements',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId || null,
          movement_count: (movementRows || []).length,
          movements: movementRows || [],
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    res.status(400).json({
      error: `Interface ${selectedInterface} is not supported for method ${req.method}`,
      version: 'v2',
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    logger.error('amro-uim-sync-endpoint-failed', {
      correlationId: ctx.correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
