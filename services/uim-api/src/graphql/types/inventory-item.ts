// Phase 7 UIM Step 8.1 — InventoryItem type.
//
// Backed by uim_inventory_items. The 4b.10 shim only returned 6
// columns; this v1 type exposes the same 6 to preserve byte-
// identical responses. Cross-entity fields (catalogItem,
// activeReservations, recentLedger) ship in slices 8.2 / 8.3 once
// the loaders land.

import { builder } from '../builder.js';
import { CatalogItemRef } from './catalog-item.js';
import { ReservationRef } from './reservation.js';
import { LedgerEntryRef } from './ledger-entry.js';

export type InventoryItemRow = {
  id: string;
  catalog_item_id: string | null;
  quantity: number;
  status: string;
  location_id: string | null;
  updated_at: string;
};

export const InventoryItemRef = builder.objectRef<InventoryItemRow>('InventoryItem');

builder.objectType(InventoryItemRef, {
  description:
    'A single inventory item — physical (serialized) or fungible (batched). Quantity is current on-hand at the recorded location.',
  fields: (t) => ({
    id: t.exposeID('id'),
    catalogItemId: t.id({
      nullable: true,
      resolve: (parent) => parent.catalog_item_id,
    }),
    quantity: t.float({
      resolve: (parent) => Number(parent.quantity || 0),
    }),
    status: t.exposeString('status'),
    locationId: t.id({
      nullable: true,
      resolve: (parent) => parent.location_id,
    }),
    updatedAt: t.field({
      type: 'DateTime',
      resolve: (parent) => parent.updated_at,
    }),
    // Cross-entity — DataLoader batches every catalogItem lookup in
    // a request into one SELECT … IN (...).
    catalogItem: t.field({
      type: CatalogItemRef,
      nullable: true,
      description: 'The catalog item that defines this inventory row, batched via DataLoader.',
      resolve: async (parent, _args, ctx) => {
        if (!parent.catalog_item_id) return null;
        return ctx.loaders.catalogItem.load(parent.catalog_item_id);
      },
    }),
    activeReservations: t.field({
      type: [ReservationRef],
      description: 'Active reservations against this inventory item, batched via DataLoader.',
      resolve: async (parent, _args, ctx) => {
        return ctx.loaders.activeReservationsByInventory.load(parent.id);
      },
    }),
    recentLedger: t.field({
      type: [LedgerEntryRef],
      description: 'Most recent ledger entries for this inventory item (newest first).',
      args: {
        limit: t.arg.int({ defaultValue: 10 }),
      },
      resolve: async (parent, args, ctx) => {
        const limitRaw = Number(args.limit ?? 10);
        const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1), 50);
        const all = await ctx.loaders.recentLedgerByInventory.load(parent.id);
        return all.slice(0, limit);
      },
    }),
  }),
});
