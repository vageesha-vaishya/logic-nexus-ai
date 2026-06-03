// Phase 7 UIM Step 8.3 — active reservations grouped by inventory_item_id.
//
// One round-trip per request even if 25 inventory items each ask
// for their active reservations. Returns [] for items with none.

import DataLoader from 'dataloader';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GraphQLError } from 'graphql';

import type { ReservationRow } from '../types/reservation.js';

const RESERVATION_SELECT =
  'id, catalog_item_id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, referenced_module, referenced_record_id, expected_use_date, metadata, created_at, updated_at';

export function buildActiveReservationsByInventoryLoader(input: {
  supabase: SupabaseClient;
  tenantId: string;
}): DataLoader<string, ReservationRow[]> {
  return new DataLoader<string, ReservationRow[]>(async (ids) => {
    const idList = ids as readonly string[];
    const { data, error } = await input.supabase
      .from('uim_inventory_reservations')
      .select(RESERVATION_SELECT)
      .eq('tenant_id', input.tenantId)
      .eq('reservation_status', 'active')
      .in('inventory_item_id', idList as string[]);
    if (error) {
      throw new GraphQLError(`reservations batch fetch failed: ${error.message}`, {
        extensions: { code: 'UIM_RESERVATIONS_BATCH_ERROR' },
      });
    }
    const byInventoryId = new Map<string, ReservationRow[]>();
    for (const row of (data ?? []) as ReservationRow[]) {
      const key = String(row.inventory_item_id ?? '');
      const list = byInventoryId.get(key) ?? [];
      list.push(row);
      byInventoryId.set(key, list);
    }
    return idList.map((id) => byInventoryId.get(String(id)) ?? []);
  });
}
