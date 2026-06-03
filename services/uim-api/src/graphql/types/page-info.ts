// Phase 7 UIM Step 8.2 — Relay-style PageInfo.
//
// Shared across every Connection type. Cursors are opaque base64
// strings; encoder/decoder lives in src/graphql/lib/cursor.ts.

import { builder } from '../builder.js';

export type PageInfoShape = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export const PageInfoRef = builder.objectRef<PageInfoShape>('PageInfo');

builder.objectType(PageInfoRef, {
  description: 'Relay-style page info for cursor-paginated connections.',
  fields: (t) => ({
    hasNextPage: t.exposeBoolean('hasNextPage'),
    hasPreviousPage: t.exposeBoolean('hasPreviousPage'),
    startCursor: t.string({ nullable: true, resolve: (p) => p.startCursor }),
    endCursor: t.string({ nullable: true, resolve: (p) => p.endCursor }),
  }),
});
