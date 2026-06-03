// Phase 7 UIM Step 8.4 — aggregation queries.
//
// availabilityByPartNumber(partNumbers: [String!]!) → [PartAvailability!]!
//   Mirrors the GET /api/v1/uim/integrations/external-mro-pipeline
//   AMRO availability response field-by-field. Joins:
//     uim_catalog_items
//     uim_inventory_items
//     uim_inventory_reservations (active only, summed by catalog)
//     uim_mro_item_profiles
//   Implementation reuses the same mapper from amro-mapper.ts the
//   REST route uses, so any change to the AMRO shape happens in
//   exactly one place.
//
// availableQuantityByLocation(status?: String) → [LocationAvailability!]!
//   Group-by aggregation in-memory (no SQL GROUP BY because the
//   supabase-js client doesn't model it cleanly; row volumes are
//   bounded by tenant inventory size, well under 50k limit).

import { GraphQLError } from 'graphql';

import { builder } from '../builder.js';
import { PartAvailabilityRef, type PartAvailabilityShape } from '../types/part-availability.js';
import {
  LocationAvailabilityRef,
  type LocationAvailabilityShape,
} from '../types/location-availability.js';
import {
  mapUimAvailabilityRowToAmro,
  type UimAvailabilityRecord,
} from '../../services/amro-mapper.js';

builder.queryFields((t) => ({
  availabilityByPartNumber: t.field({
    type: [PartAvailabilityRef],
    description:
      'AMRO-shaped availability lookup for a list of part_numbers. Joins catalog + inventory + active reservations + MRO profile in one round-trip.',
    args: {
      partNumbers: t.arg.stringList({ required: true }),
    },
    resolve: async (_parent, args, ctx): Promise<PartAvailabilityShape[]> => {
      const { tenantId, supabase } = ctx;
      const partNumbers = (args.partNumbers ?? [])
        .map((p) => String(p || '').trim())
        .filter(Boolean);
      if (partNumbers.length === 0) return [];

      // 1) Catalog rows for the requested parts.
      const catalogQ = await supabase
        .from('uim_catalog_items')
        .select('id, sku, part_number, title')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .in('part_number', partNumbers)
        .limit(500);
      if (catalogQ.error) {
        throw new GraphQLError(`catalog lookup failed: ${catalogQ.error.message}`, {
          extensions: { code: 'UIM_AVAILABILITY_CATALOG_ERROR' },
        });
      }
      const catalogRows = (catalogQ.data ?? []) as Array<Record<string, unknown>>;
      const catalogIds = catalogRows.map((row) => String(row.id));
      if (catalogIds.length === 0) return [];

      // 2-4) Inventory + active reservations + MRO profiles in parallel.
      const [inventoryQ, reservationQ, profileQ] = await Promise.all([
        supabase
          .from('uim_inventory_items')
          .select('id, catalog_item_id, quantity, status, location_type')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .in('catalog_item_id', catalogIds),
        supabase
          .from('uim_inventory_reservations')
          .select('catalog_item_id, reserved_quantity')
          .eq('tenant_id', tenantId)
          .eq('reservation_status', 'active')
          .in('catalog_item_id', catalogIds),
        supabase
          .from('uim_mro_item_profiles')
          .select('catalog_item_id, maintenance_category, ata_chapter_code, condition_code, certification_status, aog_priority')
          .eq('tenant_id', tenantId)
          .in('catalog_item_id', catalogIds),
      ]);
      if (inventoryQ.error) {
        throw new GraphQLError(`inventory lookup failed: ${inventoryQ.error.message}`, {
          extensions: { code: 'UIM_AVAILABILITY_INVENTORY_ERROR' },
        });
      }
      if (reservationQ.error) {
        throw new GraphQLError(`reservation lookup failed: ${reservationQ.error.message}`, {
          extensions: { code: 'UIM_AVAILABILITY_RESERVATION_ERROR' },
        });
      }
      if (profileQ.error) {
        throw new GraphQLError(`mro profile lookup failed: ${profileQ.error.message}`, {
          extensions: { code: 'UIM_AVAILABILITY_PROFILE_ERROR' },
        });
      }

      const reservedByCatalog = new Map<string, number>();
      for (const row of (reservationQ.data ?? []) as Array<Record<string, unknown>>) {
        const key = String(row.catalog_item_id || '');
        const next = (reservedByCatalog.get(key) || 0) + Number(row.reserved_quantity || 0);
        reservedByCatalog.set(key, next);
      }
      const profileByCatalog = new Map<string, Record<string, unknown>>(
        ((profileQ.data ?? []) as Array<Record<string, unknown>>).map((row) => [
          String(row.catalog_item_id),
          row,
        ]),
      );

      const records: UimAvailabilityRecord[] = ((inventoryQ.data ?? []) as Array<Record<string, unknown>>).map(
        (inventory) => {
          const catalog =
            catalogRows.find((row) => String(row.id) === String(inventory.catalog_item_id)) ??
            ({} as Record<string, unknown>);
          const profile = profileByCatalog.get(String(inventory.catalog_item_id)) ?? {};
          const reserved = reservedByCatalog.get(String(inventory.catalog_item_id)) ?? 0;
          return mapUimAvailabilityRowToAmro({
            inventory_item_id: inventory.id,
            catalog_item_id: inventory.catalog_item_id,
            sku: catalog.sku,
            part_number: catalog.part_number,
            title: catalog.title,
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
        },
      );

      // Adapt UimAvailabilityRecord (mapper output shape) →
      // PartAvailabilityShape (graphql object shape). Field names
      // line up 1:1; this is just a TS-side cast.
      return records as unknown as PartAvailabilityShape[];
    },
  }),

  availableQuantityByLocation: t.field({
    type: [LocationAvailabilityRef],
    description:
      'Roll-up of inventory item quantities by (location_id, location_type) for the caller tenant + franchise.',
    args: {
      status: t.arg.string({ required: false }),
    },
    resolve: async (_parent, args, ctx): Promise<LocationAvailabilityShape[]> => {
      const { tenantId, franchiseId, supabase } = ctx;

      let query = supabase
        .from('uim_inventory_items')
        .select('quantity, status, location_id, location_type')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .limit(50000);
      if (franchiseId) query = query.eq('franchise_id', franchiseId);
      if (args.status) query = query.eq('status', String(args.status));

      const { data, error } = await query;
      if (error) {
        throw new GraphQLError(`location roll-up failed: ${error.message}`, {
          extensions: { code: 'UIM_LOCATION_ROLLUP_ERROR' },
        });
      }

      const byKey = new Map<string, LocationAvailabilityShape>();
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const locId = row.location_id ? String(row.location_id) : null;
        const locType = row.location_type ? String(row.location_type) : null;
        const key = `${locId ?? ''}::${locType ?? ''}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.total_quantity += Number(row.quantity || 0);
          existing.inventory_item_count += 1;
        } else {
          byKey.set(key, {
            location_id: locId,
            location_type: locType,
            total_quantity: Number(row.quantity || 0),
            inventory_item_count: 1,
          });
        }
      }
      // Sort by total_quantity DESC so the heaviest locations
      // come first — matches how the operator dashboard renders.
      return [...byKey.values()].sort((a, b) => b.total_quantity - a.total_quantity);
    },
  }),
}));
