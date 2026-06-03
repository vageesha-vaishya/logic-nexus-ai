// Phase 7 UIM Step 8.1 — inventory read queries.
//
// uimProjectionItems(limit, offset)  → ProjectionSnapshot[]
// uimInventoryItem(id)               → InventoryItem | null
//
// Both mirror the 4b.10 shim's behavior — same SELECT columns,
// same tenant + franchise scoping, same ordering, same row shape
// in the response. Byte-identical response equality is verified by
// the response-equality tests in Phase A of the design doc.

import { GraphQLError } from 'graphql';

import { builder } from '../builder.js';
import { ProjectionSnapshotRef } from '../types/projection-snapshot.js';
import { InventoryItemRef } from '../types/inventory-item.js';

builder.queryFields((t) => ({
  uimProjectionItems: t.field({
    type: [ProjectionSnapshotRef],
    description:
      'List the caller tenant/franchise projection snapshots, newest first. Mirrors the 4b.10 shim shape; cursor-paginated equivalent ships in slice 8.2.',
    args: {
      limit: t.arg.int({ defaultValue: 50 }),
      offset: t.arg.int({ defaultValue: 0 }),
    },
    resolve: async (_parent, args, ctx) => {
      const { tenantId, franchiseId, supabase } = ctx;
      const limitRaw = Number(args.limit ?? 50);
      const offsetRaw = Number(args.offset ?? 0);
      const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 500);
      const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

      let query = supabase
        .from('uim_inventory_projection_snapshots')
        .select(
          'inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, replay_version, updated_at',
        )
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (franchiseId) query = query.eq('franchise_id', franchiseId);

      const { data, error } = await query;
      if (error) {
        throw new GraphQLError(`Failed to query projection snapshots: ${error.message}`, {
          extensions: { code: 'UIM_PROJECTION_LIST_ERROR' },
        });
      }
      return (data ?? []) as Array<{
        inventory_item_id: string;
        projected_available_quantity: number;
        projected_reserved_quantity: number;
        projected_consumed_quantity: number;
        replay_version: number;
        updated_at: string;
      }>;
    },
  }),

  uimInventoryItem: t.field({
    type: InventoryItemRef,
    nullable: true,
    description: 'Fetch a single inventory item by id, scoped to tenant + franchise.',
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_parent, args, ctx) => {
      const { tenantId, franchiseId, supabase } = ctx;
      const itemId = String(args.id || '').trim();
      if (!itemId) {
        throw new GraphQLError('id is required for uimInventoryItem', {
          extensions: { code: 'INVALID_REQUEST' },
        });
      }
      let query = supabase
        .from('uim_inventory_items')
        .select('id, catalog_item_id, quantity, status, location_id, updated_at')
        .eq('tenant_id', tenantId)
        .eq('id', itemId)
        .is('deleted_at', null)
        .limit(1);
      if (franchiseId) query = query.eq('franchise_id', franchiseId);
      const { data, error } = await query.maybeSingle();
      if (error) {
        throw new GraphQLError(`Failed to query inventory item: ${error.message}`, {
          extensions: { code: 'UIM_INVENTORY_ITEM_ERROR' },
        });
      }
      if (!data) return null;
      const row = data as {
        id: string;
        catalog_item_id: string | null;
        quantity: number;
        status: string;
        location_id: string | null;
        updated_at: string;
      };
      return row;
    },
  }),
}));
