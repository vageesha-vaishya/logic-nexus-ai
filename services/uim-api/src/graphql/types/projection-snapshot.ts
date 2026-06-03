// Phase 7 UIM Step 8.1 — ProjectionSnapshot type.
//
// Backed by uim_inventory_projection_snapshots — same 6 columns
// the 4b.10 shim returned. Field names match the camelCase
// convention used by Pothos (auto-conversion would be nice but
// Pothos doesn't do it; we map explicitly).

import { builder } from '../builder.js';

export type ProjectionSnapshotRow = {
  inventory_item_id: string;
  projected_available_quantity: number;
  projected_reserved_quantity: number;
  projected_consumed_quantity: number;
  replay_version: number;
  updated_at: string;
};

export const ProjectionSnapshotRef =
  builder.objectRef<ProjectionSnapshotRow>('ProjectionSnapshot');

builder.objectType(ProjectionSnapshotRef, {
  description:
    'Inventory projection snapshot — read-model rebuilt from the ledger. One row per inventory item with rolled-up available/reserved/consumed quantities.',
  fields: (t) => ({
    inventoryItemId: t.id({
      resolve: (parent) => parent.inventory_item_id,
    }),
    projectedAvailableQuantity: t.float({
      resolve: (parent) => Number(parent.projected_available_quantity || 0),
    }),
    projectedReservedQuantity: t.float({
      resolve: (parent) => Number(parent.projected_reserved_quantity || 0),
    }),
    projectedConsumedQuantity: t.float({
      resolve: (parent) => Number(parent.projected_consumed_quantity || 0),
    }),
    replayVersion: t.int({
      resolve: (parent) => Number(parent.replay_version || 0),
    }),
    updatedAt: t.field({
      type: 'DateTime',
      resolve: (parent) => parent.updated_at,
    }),
  }),
});
