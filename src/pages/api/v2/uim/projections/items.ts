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

function parseLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 500);
}

function parseOffset(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function enrichSnapshotsWithMroAttributes(
  snapshots: Array<Record<string, unknown>>,
  inventoryRows: Array<Record<string, unknown>>,
  catalogRows: Array<Record<string, unknown>>,
  profileRows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const inventoryById = new Map<string, Record<string, unknown>>(
    inventoryRows.map((row) => [String(row.id || ''), row]),
  );
  const catalogById = new Map<string, Record<string, unknown>>(
    catalogRows.map((row) => [String(row.id || ''), row]),
  );
  const profileByCatalogId = new Map<string, Record<string, unknown>>(
    profileRows.map((row) => [String(row.catalog_item_id || ''), row]),
  );

  return snapshots.map((snapshot) => {
    const inventoryItemId = String(snapshot.inventory_item_id || '');
    const inventory = inventoryById.get(inventoryItemId) || {};
    const catalogItemId = String(inventory.catalog_item_id || '');
    const catalog = catalogById.get(catalogItemId) || {};
    const profile = profileByCatalogId.get(catalogItemId) || {};

    return {
      ...snapshot,
      catalog_item_id: catalogItemId || null,
      sku: catalog.sku || null,
      part_number: catalog.part_number || null,
      title: catalog.title || null,
      category: catalog.category || null,
      unit_of_measure: catalog.unit_of_measure || null,
      serial_number: inventory.serial_number || null,
      batch_lot_number: inventory.batch_lot_number || null,
      inventory_status: inventory.status || null,
      inventory_location_type: inventory.location_type || null,
      maintenance_category: profile.maintenance_category || null,
      ata_chapter_code: profile.ata_chapter_code || null,
      ata_sub_chapter_code: profile.ata_sub_chapter_code || null,
      ata_section_code: profile.ata_section_code || null,
      condition_code: profile.condition_code || null,
      certification_status: profile.certification_status || null,
      aog_priority: Boolean(profile.aog_priority),
    };
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
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
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const supabase = getSupabaseAdminClient();

    const projectionSelect = 'id, inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, last_ledger_id, last_ledger_at, replay_version, updated_at';

    let data: Array<Record<string, unknown>> | null = null;
    let count: number | null = null;

    if (access.franchiseId) {
      const franchiseScoped = await supabase
        .from('uim_inventory_projection_snapshots')
        .select(projectionSelect, { count: 'exact' })
        .eq('tenant_id', access.tenantId)
        .eq('franchise_id', access.franchiseId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (franchiseScoped.error) throw new Error(`Failed to query franchise-scoped projection snapshots: ${franchiseScoped.error.message}`);
      data = franchiseScoped.data as Array<Record<string, unknown>> | null;
      count = Number(franchiseScoped.count || 0);
    }

    // Fallback: if franchise scope is empty, return tenant-level snapshots.
    if (!access.franchiseId || (count || 0) === 0) {
      const tenantScoped = await supabase
        .from('uim_inventory_projection_snapshots')
        .select(projectionSelect, { count: 'exact' })
        .eq('tenant_id', access.tenantId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (tenantScoped.error) throw new Error(`Failed to query tenant-scoped projection snapshots: ${tenantScoped.error.message}`);
      data = tenantScoped.data as Array<Record<string, unknown>> | null;
      count = Number(tenantScoped.count || 0);
    }

    let snapshots = data || [];
    if (snapshots.length > 0) {
      const inventoryItemIds = snapshots
        .map((row) => String(row.inventory_item_id || '').trim())
        .filter(Boolean);
      if (inventoryItemIds.length > 0) {
        const inventoryQuery = await supabase
          .from('uim_inventory_items')
          .select('id, catalog_item_id, serial_number, batch_lot_number, status, location_type')
          .eq('tenant_id', access.tenantId)
          .in('id', inventoryItemIds);
        if (inventoryQuery.error) throw new Error(`Failed to query projection inventory items: ${inventoryQuery.error.message}`);
        const inventoryRows = (inventoryQuery.data || []) as Array<Record<string, unknown>>;

        const catalogItemIds = inventoryRows
          .map((row) => String(row.catalog_item_id || '').trim())
          .filter(Boolean);

        let catalogRows: Array<Record<string, unknown>> = [];
        let profileRows: Array<Record<string, unknown>> = [];

        if (catalogItemIds.length > 0) {
          const catalogQuery = await supabase
            .from('uim_catalog_items')
            .select('id, sku, part_number, title, category, unit_of_measure, attributes')
            .eq('tenant_id', access.tenantId)
            .in('id', catalogItemIds);
          if (catalogQuery.error) throw new Error(`Failed to query projection catalog items: ${catalogQuery.error.message}`);
          catalogRows = (catalogQuery.data || []) as Array<Record<string, unknown>>;

          const profileQuery = await supabase
            .from('uim_mro_item_profiles')
            .select('catalog_item_id, maintenance_category, ata_chapter_code, ata_sub_chapter_code, ata_section_code, condition_code, certification_status, aog_priority')
            .eq('tenant_id', access.tenantId)
            .in('catalog_item_id', catalogItemIds);
          if (profileQuery.error) throw new Error(`Failed to query UIM MRO projection profiles: ${profileQuery.error.message}`);
          profileRows = (profileQuery.data || []) as Array<Record<string, unknown>>;
        }

        snapshots = enrichSnapshotsWithMroAttributes(snapshots, inventoryRows, catalogRows, profileRows);
      }
    }

    res.status(200).json({
      version: 'v2',
      interface: 'uim-projection-items-query',
      correlationId: ctx.correlationId,
      output: {
        pagination: {
          limit,
          offset,
          total: Number(count || 0),
        },
        snapshots,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
