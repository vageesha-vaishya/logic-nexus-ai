// Phase 7 UIM Step 8.3 — LedgerEntry Relay connection.

import { builder } from '../builder.js';
import { LedgerEntryRef, type LedgerEntryRow } from './ledger-entry.js';
import { PageInfoRef, type PageInfoShape } from './page-info.js';

export type LedgerEntryEdgeShape = { cursor: string; node: LedgerEntryRow };
export type LedgerEntryConnectionShape = {
  edges: LedgerEntryEdgeShape[];
  pageInfo: PageInfoShape;
  totalCount: number;
};

export const LedgerEntryEdgeRef = builder.objectRef<LedgerEntryEdgeShape>('LedgerEntryEdge');
builder.objectType(LedgerEntryEdgeRef, {
  fields: (t) => ({
    cursor: t.exposeString('cursor'),
    node: t.field({ type: LedgerEntryRef, resolve: (p) => p.node }),
  }),
});

export const LedgerEntryConnectionRef =
  builder.objectRef<LedgerEntryConnectionShape>('LedgerEntryConnection');
builder.objectType(LedgerEntryConnectionRef, {
  fields: (t) => ({
    edges: t.field({ type: [LedgerEntryEdgeRef], resolve: (p) => p.edges }),
    pageInfo: t.field({ type: PageInfoRef, resolve: (p) => p.pageInfo }),
    totalCount: t.int({ resolve: (p) => p.totalCount }),
  }),
});
