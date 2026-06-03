// Phase 7 UIM Step 4b.3 — inventory projection snapshots route.
//
// Carves src/pages/api/v2/uim/projections/items.ts (184 LOC) into
// uim-api. Reads uim_inventory_projection_snapshots and enriches each
// row with the linked inventory_items + catalog_items + mro_item_profiles
// fields. Franchise-scoped lookup with a tenant fallback so a fresh
// franchise (zero projections yet) still surfaces the tenant-wide view.
//
// Source today: public.uim_inventory_* / public.uim_mro_item_profiles
// — all part of the 12 legacy public.uim_* tables. When the
// public.uim_* → uim.* mirror migration lands, the .from(...) calls
// flip schemas.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

const PROJECTION_SELECT =
  'id, inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, last_ledger_id, last_ledger_at, replay_version, updated_at';

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

function clampLimit(raw: unknown, fallback = 50, hardMax = 500): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), hardMax);
}

function clampOffset(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

// Builds the enriched-snapshot output. Lifted verbatim from the
// legacy route so the response shape stays byte-identical and tests
// against either implementation pass.
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

router.get(
  '/v1/uim/projections/items',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const limit = clampLimit(req.query.limit, 50, 500);
    const offset = clampOffset(req.query.offset);

    try {
      const supabase = getServiceRoleClient();

      let data: Array<Record<string, unknown>> | null = null;
      let count: number | null = null;

      // Franchise-scoped first when present; tenant fallback if empty.
      // Mirrors the legacy route's behavior exactly so a fresh
      // franchise with no projections yet doesn't render an empty
      // page in the operator UI.
      if (authReq.franchiseId) {
        const franchiseScoped = await supabase
          .from('uim_inventory_projection_snapshots')
          .select(PROJECTION_SELECT, { count: 'exact' })
          .eq('tenant_id', authReq.tenantId)
          .eq('franchise_id', authReq.franchiseId)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (franchiseScoped.error) throw franchiseScoped.error;
        data = franchiseScoped.data as Array<Record<string, unknown>> | null;
        count = Number(franchiseScoped.count || 0);
      }

      if (!authReq.franchiseId || (count || 0) === 0) {
        const tenantScoped = await supabase
          .from('uim_inventory_projection_snapshots')
          .select(PROJECTION_SELECT, { count: 'exact' })
          .eq('tenant_id', authReq.tenantId)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (tenantScoped.error) throw tenantScoped.error;
        data = tenantScoped.data as Array<Record<string, unknown>> | null;
        count = Number(tenantScoped.count || 0);
      }

      let snapshots = data || [];
      if (snapshots.length > 0) {
        const inventoryItemIds = snapshots
          .map((row) => String(row.inventory_item_id || '').trim())
          .filter(Boolean);

        if (inventoryItemIds.length > 0) {
          const invQ = await supabase
            .from('uim_inventory_items')
            .select('id, catalog_item_id, serial_number, batch_lot_number, status, location_type')
            .eq('tenant_id', authReq.tenantId)
            .in('id', inventoryItemIds);
          if (invQ.error) throw invQ.error;
          const inventoryRows = (invQ.data || []) as Array<Record<string, unknown>>;

          const catalogItemIds = inventoryRows
            .map((row) => String(row.catalog_item_id || '').trim())
            .filter(Boolean);

          let catalogRows: Array<Record<string, unknown>> = [];
          let profileRows: Array<Record<string, unknown>> = [];

          if (catalogItemIds.length > 0) {
            const catQ = await supabase
              .from('uim_catalog_items')
              .select('id, sku, part_number, title, category, unit_of_measure, attributes')
              .eq('tenant_id', authReq.tenantId)
              .in('id', catalogItemIds);
            if (catQ.error) throw catQ.error;
            catalogRows = (catQ.data || []) as Array<Record<string, unknown>>;

            const profQ = await supabase
              .from('uim_mro_item_profiles')
              .select('catalog_item_id, maintenance_category, ata_chapter_code, ata_sub_chapter_code, ata_section_code, condition_code, certification_status, aog_priority')
              .eq('tenant_id', authReq.tenantId)
              .in('catalog_item_id', catalogItemIds);
            if (profQ.error) throw profQ.error;
            profileRows = (profQ.data || []) as Array<Record<string, unknown>>;
          }

          snapshots = enrichSnapshotsWithMroAttributes(snapshots, inventoryRows, catalogRows, profileRows);
        }
      }

      return res.json({
        snapshots,
        pagination: { limit, offset, total: Number(count || 0) },
      });
    } catch (err) {
      logger.error('uim.projections list error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to query projection snapshots',
        code: 'UIM_PROJECTION_LIST_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
