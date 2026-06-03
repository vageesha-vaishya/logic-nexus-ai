// Phase 7 UIM Step 4b.6 — MRO seeding route.
//
// Carves src/pages/api/v2/uim/seeding/mro.ts (284 LOC) into uim-api +
// the supporting src/modules/uim/seeding/uimMroSeedService.ts (110 LOC,
// pure helper) which lives at services/uim-api/src/services/mro-seed.service.ts.
//
// Behavior preserved verbatim from the legacy route — same upsert
// targets, same onConflict keys, same chunk size of 200, same response
// shape. Adds platform_admin gating since seeding 500-1000 rows per
// tenant shouldn't be tenant-side self-service.
//
// Source tables (still public.uim_*): catalog_items, inventory_items,
// mro_item_profiles, inventory_projection_snapshots. When the
// public.uim_* → uim.* mirror migration lands, the .from(...) calls
// flip schemas.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';
import {
  buildUimMroSeedItems,
  normalizeSeedCount,
  UIM_MRO_SEED_LIMITS,
} from '../services/mro-seed.service.js';

const router = Router();
type Row = Record<string, unknown>;

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function forbidden(res: Response, message: string): void {
  res.status(403).json({
    error: message, code: 'FORBIDDEN', statusCode: 403,
  } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function toDateOnly(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function upsertInChunks(
  rows: Row[],
  chunkSize: number,
  inserter: (chunk: Row[]) => Promise<void>,
): Promise<void> {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await inserter(rows.slice(i, i + chunkSize));
  }
}

// ── GET /v1/uim/seeding/mro ────────────────────────────────────────
// Status snapshot — how many seeded rows currently exist for the
// tenant across catalog / profiles / inventory.
router.get(
  '/v1/uim/seeding/mro',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    try {
      const supabase = getServiceRoleClient();
      const tenantId = authReq.tenantId;
      const franchiseId = authReq.franchiseId ?? null;

      const [catalog, profile, inventory] = await Promise.all([
        supabase.from('uim_catalog_items')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .like('sku', 'UIM-MRO-%'),
        supabase.from('uim_mro_item_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase.from('uim_inventory_items')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .like('serial_number', 'SER-%'),
      ]);
      if (catalog.error) throw catalog.error;
      if (profile.error) throw profile.error;
      if (inventory.error) throw inventory.error;

      return res.json({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        seed_limits: UIM_MRO_SEED_LIMITS,
        seeded: {
          catalog_items: Number(catalog.count || 0),
          profile_items: Number(profile.count || 0),
          inventory_items: Number(inventory.count || 0),
        },
      });
    } catch (err) {
      logger.error('uim.seeding.mro status error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch seeding status',
        code: 'UIM_SEEDING_STATUS_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

// ── POST /v1/uim/seeding/mro ───────────────────────────────────────
// Body: { target_count?: number (500-1000), dry_run?: boolean }
// platform_admin only — seeding writes to 4 tables and is not a
// tenant-side self-service operation.
router.post(
  '/v1/uim/seeding/mro',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const sb = getServiceRoleClient();
    const { data: roles } = await sb
      .from('user_roles')
      .select('role')
      .eq('user_id', authReq.userId);
    const isPlatformAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'platform_admin');
    if (!isPlatformAdmin) return forbidden(res, 'platform_admin role required');

    const body = (req.body ?? {}) as Record<string, unknown>;
    const seedCount = normalizeSeedCount(Number(body.target_count));
    const dryRun = parseBoolean(body.dry_run);
    const items = buildUimMroSeedItems(seedCount);
    const tenantId = authReq.tenantId;
    const franchiseId = authReq.franchiseId ?? null;

    try {
      if (dryRun) {
        return res.json({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          target_count: seedCount,
          sample: items.slice(0, 5),
        });
      }

      // 1) Catalog upsert
      const catalogRows: Row[] = items.map((item) => ({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        sku: item.sku,
        part_number: item.part_number,
        title: item.title,
        category: item.category,
        unit_of_measure: 'EA',
        is_serialized: item.category !== 'consumable',
        attributes: {
          manufacturer_name: item.manufacturer_name,
          manufacturer_code: item.manufacturer_code,
          maintenance_category: item.maintenance_category,
          ata_chapter_code: item.ata_chapter_code,
          ata_sub_chapter_code: item.ata_sub_chapter_code,
          ata_section_code: item.ata_section_code,
          condition_code: item.condition_code,
        },
      }));
      await upsertInChunks(catalogRows, 200, async (chunk) => {
        const { error } = await sb
          .from('uim_catalog_items')
          .upsert(chunk, { onConflict: 'tenant_id,sku' });
        if (error) throw new Error(`catalog chunk: ${error.message}`);
      });

      // 2) Resolve catalog ids
      const skus = items.map((item) => item.sku);
      const { data: catalogData, error: catalogFetchErr } = await sb
        .from('uim_catalog_items')
        .select('id, sku')
        .eq('tenant_id', tenantId)
        .in('sku', skus);
      if (catalogFetchErr) throw new Error(`catalog id resolve: ${catalogFetchErr.message}`);
      const catalogBySku = new Map<string, string>(
        ((catalogData ?? []) as Array<{ id: string; sku: string }>).map(
          (row) => [String(row.sku), String(row.id)],
        ),
      );

      // 3) Inventory upsert
      const inventoryRows: Row[] = items
        .map((item): Row | null => {
          const catalogItemId = catalogBySku.get(item.sku);
          if (!catalogItemId) return null;
          return {
            tenant_id: tenantId,
            franchise_id: franchiseId,
            catalog_item_id: catalogItemId,
            serial_number: item.serial_number,
            batch_lot_number: `LOT-${item.serial_number.slice(4)}`,
            quantity: item.quantity,
            status: item.condition_code === 'QUAR' ? 'quarantine' : 'available',
            location_type: 'warehouse',
            metadata: {
              storage_requirements: item.storage_requirements,
              certification_status: item.certification_status,
              seed_batch: 'UIM-MRO-SEED-API-v1',
            },
          };
        })
        .filter((row): row is Row => row !== null);
      await upsertInChunks(inventoryRows, 200, async (chunk) => {
        const { error } = await sb
          .from('uim_inventory_items')
          .upsert(chunk, { onConflict: 'tenant_id,serial_number' });
        if (error) throw new Error(`inventory chunk: ${error.message}`);
      });

      // 4) Resolve inventory ids
      const { data: inventoryData, error: inventoryFetchErr } = await sb
        .from('uim_inventory_items')
        .select('id, serial_number, catalog_item_id, quantity')
        .eq('tenant_id', tenantId)
        .in('serial_number', items.map((item) => item.serial_number));
      if (inventoryFetchErr) throw new Error(`inventory id resolve: ${inventoryFetchErr.message}`);
      const inventoryByCatalog = new Map<string, { id: string; quantity: number }>();
      for (const row of (inventoryData ?? []) as Array<{ id: string; catalog_item_id: string; quantity: number }>) {
        inventoryByCatalog.set(String(row.catalog_item_id), {
          id: String(row.id),
          quantity: Number(row.quantity || 0),
        });
      }

      // 5) Profile upsert
      const profileRows: Row[] = items
        .map((item, index): Row | null => {
          const catalogItemId = catalogBySku.get(item.sku);
          if (!catalogItemId) return null;
          return {
            tenant_id: tenantId,
            franchise_id: franchiseId,
            catalog_item_id: catalogItemId,
            maintenance_category: item.maintenance_category,
            ata_chapter_code: item.ata_chapter_code,
            ata_sub_chapter_code: item.ata_sub_chapter_code,
            ata_section_code: item.ata_section_code,
            manufacturer_name: item.manufacturer_name,
            manufacturer_code: item.manufacturer_code,
            shelf_life_days: item.shelf_life_days,
            condition_code: item.condition_code,
            storage_requirements: item.storage_requirements,
            certification_status: item.certification_status,
            certification_reference: `CERT-UIM-${String(index + 1).padStart(8, '0')}`,
            hazardous_material: item.hazardous_material,
            calibrated_tool: item.category === 'tooling' || item.category === 'equipment',
            calibration_due_date: item.category === 'tooling' || item.category === 'equipment'
              ? toDateOnly((index % 180) + 30)
              : null,
            regulatory_compliance: { faa_14_cfr_43: true, easa_part_145: true },
            aog_priority: item.aog_priority,
            traceability: {
              serial_number: item.serial_number,
              lot_number: `LOT-${item.serial_number.slice(4)}`,
            },
            metadata: { seeded_by: 'uim-api.seeding.mro' },
          };
        })
        .filter((row): row is Row => row !== null);
      await upsertInChunks(profileRows, 200, async (chunk) => {
        const { error } = await sb
          .from('uim_mro_item_profiles')
          .upsert(chunk, { onConflict: 'tenant_id,catalog_item_id' });
        if (error) throw new Error(`profile chunk: ${error.message}`);
      });

      // 6) Projection snapshots — used by the projections/items route
      const snapshotRows: Row[] = [...inventoryByCatalog.values()].map((inv) => ({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        inventory_item_id: inv.id,
        projected_available_quantity: inv.quantity,
        projected_reserved_quantity: 0,
        projected_consumed_quantity: 0,
        replay_version: 1,
        last_ledger_at: new Date().toISOString(),
      }));
      await upsertInChunks(snapshotRows, 200, async (chunk) => {
        const { error } = await sb
          .from('uim_inventory_projection_snapshots')
          .upsert(chunk, { onConflict: 'tenant_id,inventory_item_id' });
        if (error) throw new Error(`snapshot chunk: ${error.message}`);
      });

      logger.info('uim.seeding.mro applied', {
        actorUserId: authReq.userId,
        tenantId,
        seeded_count: items.length,
      });

      return res.json({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        seeded_count: items.length,
        modules: { uim_independent: true, amro_integration_ready: true },
      });
    } catch (err) {
      logger.error('uim.seeding.mro apply error', err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Seeding failed',
        code: 'UIM_SEEDING_APPLY_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
