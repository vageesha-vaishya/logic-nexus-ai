// Phase 7 UIM Step 8.2 — InventoryItem Relay connection.
//
// Cursor: { k: updated_at ISO, i: id }. Ordering: updated_at DESC,
// id DESC for tiebreak. Filtering applies BEFORE the cursor
// predicate (cursor is a "skip rows already seen" hint, not a
// post-filter).

import { builder } from '../builder.js';
import type { InventoryItemRow } from './inventory-item.js';
import { InventoryItemRef } from './inventory-item.js';
import { PageInfoRef } from './page-info.js';
import type { PageInfoShape } from './page-info.js';

export type InventoryItemEdgeShape = {
  cursor: string;
  node: InventoryItemRow;
};

export type InventoryItemConnectionShape = {
  edges: InventoryItemEdgeShape[];
  pageInfo: PageInfoShape;
  totalCount: number;
};

export const InventoryItemEdgeRef =
  builder.objectRef<InventoryItemEdgeShape>('InventoryItemEdge');

builder.objectType(InventoryItemEdgeRef, {
  fields: (t) => ({
    cursor: t.exposeString('cursor'),
    node: t.field({ type: InventoryItemRef, resolve: (p) => p.node }),
  }),
});

export const InventoryItemConnectionRef =
  builder.objectRef<InventoryItemConnectionShape>('InventoryItemConnection');

builder.objectType(InventoryItemConnectionRef, {
  fields: (t) => ({
    edges: t.field({ type: [InventoryItemEdgeRef], resolve: (p) => p.edges }),
    pageInfo: t.field({ type: PageInfoRef, resolve: (p) => p.pageInfo }),
    totalCount: t.int({ resolve: (p) => p.totalCount }),
  }),
});
