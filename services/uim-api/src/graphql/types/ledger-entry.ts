// Phase 7 UIM Step 8.3 — LedgerEntry type.
//
// Backed by uim_inventory_ledger — append-only ledger of every
// quantity change (RECEIVE / MOVE / RESERVE / CONSUME / etc).

import { builder } from '../builder.js';

export type LedgerEntryRow = {
  id: string;
  inventory_item_id: string;
  transaction_type: string;
  quantity_changed: number;
  reservation_id: string | null;
  referenced_module: string | null;
  performed_by: string | null;
  created_at: string;
};

export const LedgerEntryRef = builder.objectRef<LedgerEntryRow>('LedgerEntry');

builder.objectType(LedgerEntryRef, {
  description: 'A single ledger entry — append-only record of a quantity change.',
  fields: (t) => ({
    id: t.exposeID('id'),
    inventoryItemId: t.id({ resolve: (p) => p.inventory_item_id }),
    transactionType: t.string({ resolve: (p) => p.transaction_type }),
    quantityChanged: t.float({ resolve: (p) => Number(p.quantity_changed || 0) }),
    reservationId: t.id({ nullable: true, resolve: (p) => p.reservation_id }),
    referencedModule: t.string({ nullable: true, resolve: (p) => p.referenced_module }),
    performedBy: t.id({ nullable: true, resolve: (p) => p.performed_by }),
    createdAt: t.field({ type: 'DateTime', resolve: (p) => p.created_at }),
  }),
});
