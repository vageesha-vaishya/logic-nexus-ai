// Phase 7 UIM Step 8.3 — Reservation type.
//
// Backed by uim_inventory_reservations.

import { builder } from '../builder.js';

export type ReservationRow = {
  id: string;
  catalog_item_id: string | null;
  inventory_item_id: string | null;
  reserved_quantity: number;
  reservation_status: string;
  reservation_token: string | null;
  referenced_module: string | null;
  referenced_record_id: string | null;
  expected_use_date: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export const ReservationRef = builder.objectRef<ReservationRow>('Reservation');

builder.objectType(ReservationRef, {
  description: 'A soft inventory reservation. Active reservations decrement projected available quantity.',
  fields: (t) => ({
    id: t.exposeID('id'),
    catalogItemId: t.id({ nullable: true, resolve: (p) => p.catalog_item_id }),
    inventoryItemId: t.id({ nullable: true, resolve: (p) => p.inventory_item_id }),
    reservedQuantity: t.float({ resolve: (p) => Number(p.reserved_quantity || 0) }),
    status: t.string({ resolve: (p) => p.reservation_status }),
    reservationToken: t.string({ nullable: true, resolve: (p) => p.reservation_token }),
    referencedModule: t.string({ nullable: true, resolve: (p) => p.referenced_module }),
    referencedRecordId: t.id({ nullable: true, resolve: (p) => p.referenced_record_id }),
    expectedUseDate: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (p) => p.expected_use_date,
    }),
    metadata: t.field({ type: 'JSON', nullable: true, resolve: (p) => p.metadata }),
    createdAt: t.field({ type: 'DateTime', resolve: (p) => p.created_at }),
    updatedAt: t.field({ type: 'DateTime', resolve: (p) => p.updated_at }),
  }),
});
