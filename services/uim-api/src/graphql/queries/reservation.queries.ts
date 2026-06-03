// Phase 7 UIM Step 8.3 — top-level reservation + ledger queries.
//
// Both are Relay cursor-paginated. Cursor key is updated_at /
// created_at respectively, tiebreaker is id.

import { GraphQLError } from 'graphql';

import { builder } from '../builder.js';
import {
  ReservationConnectionRef,
  type ReservationConnectionShape,
} from '../types/reservation-connection.js';
import type { ReservationRow } from '../types/reservation.js';
import {
  LedgerEntryConnectionRef,
  type LedgerEntryConnectionShape,
} from '../types/ledger-entry-connection.js';
import type { LedgerEntryRow } from '../types/ledger-entry.js';
import { decodeCursor, encodeCursor } from '../lib/cursor.js';

const RESERVATION_SELECT =
  'id, catalog_item_id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, referenced_module, referenced_record_id, expected_use_date, metadata, created_at, updated_at';

const LEDGER_SELECT =
  'id, inventory_item_id, transaction_type, quantity_changed, reservation_id, referenced_module, performed_by, created_at';

builder.queryFields((t) => ({
  reservations: t.field({
    type: ReservationConnectionRef,
    description:
      'Relay cursor-paginated reservations for the caller tenant + franchise. Ordered by updated_at DESC, id DESC.',
    args: {
      first: t.arg.int({ defaultValue: 25 }),
      after: t.arg.string({ required: false }),
      status: t.arg.string({ required: false }),
      referencedModule: t.arg.string({ required: false }),
    },
    resolve: async (_parent, args, ctx): Promise<ReservationConnectionShape> => {
      const { tenantId, franchiseId, supabase } = ctx;
      const firstRaw = Number(args.first ?? 25);
      const first = Math.min(Math.max(Number.isFinite(firstRaw) ? firstRaw : 25, 1), 200);
      const cursor = decodeCursor(args.after ?? null);

      let query = supabase
        .from('uim_inventory_reservations')
        .select(RESERVATION_SELECT, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(first + 1);
      if (franchiseId) query = query.eq('franchise_id', franchiseId);
      if (args.status) query = query.eq('reservation_status', String(args.status));
      if (args.referencedModule) query = query.eq('referenced_module', String(args.referencedModule));
      if (cursor) {
        query = query.or(
          `updated_at.lt.${cursor.k},and(updated_at.eq.${cursor.k},id.lt.${cursor.i})`,
        );
      }
      const { data, error, count } = await query;
      if (error) {
        throw new GraphQLError(`Failed to list reservations: ${error.message}`, {
          extensions: { code: 'UIM_RESERVATIONS_LIST_ERROR' },
        });
      }
      const rowsAll = (data ?? []) as ReservationRow[];
      const hasNextPage = rowsAll.length > first;
      const rows = hasNextPage ? rowsAll.slice(0, first) : rowsAll;
      const edges = rows.map((row) => ({
        cursor: encodeCursor({ k: String(row.updated_at), i: String(row.id) }),
        node: row,
      }));
      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: Boolean(cursor),
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
        totalCount: Number(count || 0),
      };
    },
  }),

  ledgerEntries: t.field({
    type: LedgerEntryConnectionRef,
    description:
      'Relay cursor-paginated ledger entries. Ordered by created_at DESC, id DESC.',
    args: {
      first: t.arg.int({ defaultValue: 25 }),
      after: t.arg.string({ required: false }),
      inventoryItemId: t.arg.id({ required: false }),
      transactionType: t.arg.string({ required: false }),
      since: t.arg({ type: 'DateTime', required: false }),
    },
    resolve: async (_parent, args, ctx): Promise<LedgerEntryConnectionShape> => {
      const { tenantId, franchiseId, supabase } = ctx;
      const firstRaw = Number(args.first ?? 25);
      const first = Math.min(Math.max(Number.isFinite(firstRaw) ? firstRaw : 25, 1), 200);
      const cursor = decodeCursor(args.after ?? null);

      let query = supabase
        .from('uim_inventory_ledger')
        .select(LEDGER_SELECT, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(first + 1);
      if (franchiseId) query = query.eq('franchise_id', franchiseId);
      if (args.inventoryItemId) query = query.eq('inventory_item_id', String(args.inventoryItemId));
      if (args.transactionType) query = query.eq('transaction_type', String(args.transactionType));
      if (args.since) query = query.gte('created_at', String(args.since));
      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.k},and(created_at.eq.${cursor.k},id.lt.${cursor.i})`,
        );
      }
      const { data, error, count } = await query;
      if (error) {
        throw new GraphQLError(`Failed to list ledger entries: ${error.message}`, {
          extensions: { code: 'UIM_LEDGER_LIST_ERROR' },
        });
      }
      const rowsAll = (data ?? []) as LedgerEntryRow[];
      const hasNextPage = rowsAll.length > first;
      const rows = hasNextPage ? rowsAll.slice(0, first) : rowsAll;
      const edges = rows.map((row) => ({
        cursor: encodeCursor({ k: String(row.created_at), i: String(row.id) }),
        node: row,
      }));
      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: Boolean(cursor),
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
        totalCount: Number(count || 0),
      };
    },
  }),
}));
