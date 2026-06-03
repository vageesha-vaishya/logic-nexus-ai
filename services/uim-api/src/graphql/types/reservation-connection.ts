// Phase 7 UIM Step 8.3 — Reservation Relay connection.

import { builder } from '../builder.js';
import { ReservationRef, type ReservationRow } from './reservation.js';
import { PageInfoRef, type PageInfoShape } from './page-info.js';

export type ReservationEdgeShape = { cursor: string; node: ReservationRow };
export type ReservationConnectionShape = {
  edges: ReservationEdgeShape[];
  pageInfo: PageInfoShape;
  totalCount: number;
};

export const ReservationEdgeRef = builder.objectRef<ReservationEdgeShape>('ReservationEdge');
builder.objectType(ReservationEdgeRef, {
  fields: (t) => ({
    cursor: t.exposeString('cursor'),
    node: t.field({ type: ReservationRef, resolve: (p) => p.node }),
  }),
});

export const ReservationConnectionRef =
  builder.objectRef<ReservationConnectionShape>('ReservationConnection');
builder.objectType(ReservationConnectionRef, {
  fields: (t) => ({
    edges: t.field({ type: [ReservationEdgeRef], resolve: (p) => p.edges }),
    pageInfo: t.field({ type: PageInfoRef, resolve: (p) => p.pageInfo }),
    totalCount: t.int({ resolve: (p) => p.totalCount }),
  }),
});
