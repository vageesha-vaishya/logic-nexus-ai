// Phase 7 UIM Step 8.3 — recent ledger entries grouped by inventory_item_id.
//
// Caveat: per-key limit isn't expressible in one SQL query without
// a lateral join (which Postgres does support, but Supabase JS
// client doesn't). For v1 we fetch ALL ledger rows for the requested
// inventory items + tenant + cap at LIMIT per item in code. For
// hot pages the recentLedger(limit: 10) call falls within typical
// per-item ledger size; if not, slice 8.4+ adds a lateral join
// via supabase.rpc.

import DataLoader from 'dataloader';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GraphQLError } from 'graphql';

import type { LedgerEntryRow } from '../types/ledger-entry.js';

const LEDGER_SELECT =
  'id, inventory_item_id, transaction_type, quantity_changed, reservation_id, referenced_module, performed_by, created_at';

const MAX_BATCH_FETCH_PER_ITEM = 50; // safety cap for the in-code slice

export function buildRecentLedgerByInventoryLoader(input: {
  supabase: SupabaseClient;
  tenantId: string;
}): DataLoader<string, LedgerEntryRow[]> {
  return new DataLoader<string, LedgerEntryRow[]>(async (ids) => {
    const idList = ids as readonly string[];
    const { data, error } = await input.supabase
      .from('uim_inventory_ledger')
      .select(LEDGER_SELECT)
      .eq('tenant_id', input.tenantId)
      .in('inventory_item_id', idList as string[])
      .order('created_at', { ascending: false })
      .limit(idList.length * MAX_BATCH_FETCH_PER_ITEM);
    if (error) {
      throw new GraphQLError(`ledger batch fetch failed: ${error.message}`, {
        extensions: { code: 'UIM_LEDGER_BATCH_ERROR' },
      });
    }
    const byInventoryId = new Map<string, LedgerEntryRow[]>();
    for (const row of (data ?? []) as LedgerEntryRow[]) {
      const key = String(row.inventory_item_id ?? '');
      const list = byInventoryId.get(key) ?? [];
      list.push(row);
      byInventoryId.set(key, list);
    }
    return idList.map((id) => byInventoryId.get(String(id)) ?? []);
  });
}
