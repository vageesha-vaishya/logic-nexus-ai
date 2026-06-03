// Phase 7 UIM Step 8.4 — LocationAvailability aggregation type.
//
// Result shape for availableQuantityByLocation. Rolls
// uim_inventory_items rows up by (location_id, location_type) and
// sums quantity. inventoryItemCount = number of items rolled up.

import { builder } from '../builder.js';

export type LocationAvailabilityShape = {
  location_id: string | null;
  location_type: string | null;
  total_quantity: number;
  inventory_item_count: number;
};

export const LocationAvailabilityRef =
  builder.objectRef<LocationAvailabilityShape>('LocationAvailability');

builder.objectType(LocationAvailabilityRef, {
  description: 'Roll-up of inventory items by location_id + location_type.',
  fields: (t) => ({
    locationId: t.id({ nullable: true, resolve: (p) => p.location_id }),
    locationType: t.string({ nullable: true, resolve: (p) => p.location_type }),
    totalQuantity: t.float({ resolve: (p) => Number(p.total_quantity || 0) }),
    inventoryItemCount: t.int({ resolve: (p) => Number(p.inventory_item_count || 0) }),
  }),
});
