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
import { buildUimMroSeedItems, normalizeSeedCount, UIM_MRO_SEED_LIMITS } from '@/modules/uim/seeding/uimMroSeedService';

type Row = Record<string, unknown>;

function parseBody(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object') return input as Record<string, unknown>;
  return {};
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

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.setHeader('Allow', ['POST', 'GET']);
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
    const tenantId = access.tenantId;
    const franchiseId = access.franchiseId || null;

    if (req.method === 'GET') {
      const { count: catalogCount, error: catalogCountError } = await supabase
        .from('uim_catalog_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .like('sku', 'UIM-MRO-%');
      if (catalogCountError) throw new Error(`Failed to count seeded catalog records: ${catalogCountError.message}`);

      const { count: profileCount, error: profileCountError } = await supabase
        .from('uim_mro_item_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (profileCountError) throw new Error(`Failed to count MRO profile records: ${profileCountError.message}`);

      const { count: inventoryCount, error: inventoryCountError } = await supabase
        .from('uim_inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .like('serial_number', 'SER-%');
      if (inventoryCountError) throw new Error(`Failed to count seeded inventory records: ${inventoryCountError.message}`);

      res.status(200).json({
        version: 'v2',
        interface: 'uim-mro-seeding-status',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId,
          seed_limits: UIM_MRO_SEED_LIMITS,
          seeded: {
            catalog_items: Number(catalogCount || 0),
            profile_items: Number(profileCount || 0),
            inventory_items: Number(inventoryCount || 0),
          },
        },
      });
      return;
    }

    const body = parseBody(req.body);
    const seedCount = normalizeSeedCount(body.target_count as number);
    const dryRun = parseBoolean(body.dry_run);
    const items = buildUimMroSeedItems(seedCount);

    if (dryRun) {
      res.status(200).json({
        version: 'v2',
        interface: 'uim-mro-seeding-preview',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: tenantId,
          franchise_id: franchiseId,
          target_count: seedCount,
          sample: items.slice(0, 5),
        },
      });
      return;
    }

    const catalogRows = items.map((item) => ({
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
      const { error } = await supabase
        .from('uim_catalog_items')
        .upsert(chunk, { onConflict: 'tenant_id,sku' });
      if (error) throw new Error(`Failed to upsert UIM MRO catalog chunk: ${error.message}`);
    });

    const skus = items.map((item) => item.sku);
    const { data: catalogData, error: catalogFetchError } = await supabase
      .from('uim_catalog_items')
      .select('id, sku')
      .eq('tenant_id', tenantId)
      .in('sku', skus);
    if (catalogFetchError) throw new Error(`Failed to resolve seeded catalog ids: ${catalogFetchError.message}`);
    const catalogBySku = new Map<string, string>((catalogData || []).map((row: any) => [String(row.sku), String(row.id)]));

    const inventoryRows = items
      .map((item) => {
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
      .filter(Boolean) as Row[];

    await upsertInChunks(inventoryRows, 200, async (chunk) => {
      const { error } = await supabase
        .from('uim_inventory_items')
        .upsert(chunk, { onConflict: 'tenant_id,serial_number' });
      if (error) throw new Error(`Failed to upsert UIM inventory chunk: ${error.message}`);
    });

    const { data: inventoryData, error: inventoryFetchError } = await supabase
      .from('uim_inventory_items')
      .select('id, serial_number, catalog_item_id, quantity')
      .eq('tenant_id', tenantId)
      .in('serial_number', items.map((item) => item.serial_number));
    if (inventoryFetchError) throw new Error(`Failed to resolve seeded inventory ids: ${inventoryFetchError.message}`);
    const inventoryByCatalog = new Map<string, { id: string; quantity: number }>();
    for (const row of inventoryData || []) {
      inventoryByCatalog.set(String(row.catalog_item_id), {
        id: String(row.id),
        quantity: Number(row.quantity || 0),
      });
    }

    const profileRows = items
      .map((item, index) => {
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
          regulatory_compliance: {
            faa_14_cfr_43: true,
            easa_part_145: true,
          },
          aog_priority: item.aog_priority,
          traceability: {
            serial_number: item.serial_number,
            lot_number: `LOT-${item.serial_number.slice(4)}`,
          },
          metadata: {
            seeded_by: 'uim-mro-seeding-api',
          },
        };
      })
      .filter(Boolean) as Row[];

    await upsertInChunks(profileRows, 200, async (chunk) => {
      const { error } = await supabase
        .from('uim_mro_item_profiles')
        .upsert(chunk, { onConflict: 'tenant_id,catalog_item_id' });
      if (error) throw new Error(`Failed to upsert UIM MRO profile chunk: ${error.message}`);
    });

    const snapshotRows = [...inventoryByCatalog.values()].map((inventory) => ({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      inventory_item_id: inventory.id,
      projected_available_quantity: inventory.quantity,
      projected_reserved_quantity: 0,
      projected_consumed_quantity: 0,
      replay_version: 1,
      last_ledger_at: new Date().toISOString(),
    }));
    await upsertInChunks(snapshotRows, 200, async (chunk) => {
      const { error } = await supabase
        .from('uim_inventory_projection_snapshots')
        .upsert(chunk, { onConflict: 'tenant_id,inventory_item_id' });
      if (error) throw new Error(`Failed to upsert projection snapshots: ${error.message}`);
    });

    res.status(200).json({
      version: 'v2',
      interface: 'uim-mro-seeding',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: tenantId,
        franchise_id: franchiseId,
        seeded_count: items.length,
        modules: {
          uim_independent: true,
          amro_integration_ready: true,
        },
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
