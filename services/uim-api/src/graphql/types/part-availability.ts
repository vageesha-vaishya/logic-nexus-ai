// Phase 7 UIM Step 8.4 — PartAvailability aggregation type.
//
// Result shape for availabilityByPartNumber(partNumbers: [...]).
// Mirrors the AMRO-shaped availability record (the contract surface
// the external-mro-pipeline route advertises via uimAvailabilityRecord)
// so frontend code that already renders that shape can drop in
// without a transformer.

import { builder } from '../builder.js';

export type PartAvailabilityShape = {
  inventory_item_id: string;
  catalog_item_id: string;
  sku: string;
  part_number: string;
  title: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  status: string;
  location_type: string | null;
  maintenance_category: string | null;
  ata_chapter_code: string | null;
  condition_code: string | null;
  certification_status: string | null;
  aog_priority: boolean;
};

export const PartAvailabilityRef =
  builder.objectRef<PartAvailabilityShape>('PartAvailability');

builder.objectType(PartAvailabilityRef, {
  description:
    'Joined view of inventory items + catalog metadata + reservations for an AMRO part_number lookup. quantity_available = on_hand - reserved.',
  fields: (t) => ({
    inventoryItemId: t.id({ resolve: (p) => p.inventory_item_id }),
    catalogItemId: t.id({ resolve: (p) => p.catalog_item_id }),
    sku: t.exposeString('sku'),
    partNumber: t.exposeString('part_number'),
    title: t.exposeString('title'),
    quantityOnHand: t.float({ resolve: (p) => Number(p.quantity_on_hand || 0) }),
    quantityReserved: t.float({ resolve: (p) => Number(p.quantity_reserved || 0) }),
    quantityAvailable: t.float({ resolve: (p) => Number(p.quantity_available || 0) }),
    status: t.exposeString('status'),
    locationType: t.string({ nullable: true, resolve: (p) => p.location_type }),
    maintenanceCategory: t.string({ nullable: true, resolve: (p) => p.maintenance_category }),
    ataChapterCode: t.string({ nullable: true, resolve: (p) => p.ata_chapter_code }),
    conditionCode: t.string({ nullable: true, resolve: (p) => p.condition_code }),
    certificationStatus: t.string({ nullable: true, resolve: (p) => p.certification_status }),
    aogPriority: t.boolean({ resolve: (p) => Boolean(p.aog_priority) }),
  }),
});
