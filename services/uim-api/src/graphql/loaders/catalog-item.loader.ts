// Phase 7 UIM Step 8.2 — catalog item DataLoader.
//
// Batches every `inventoryItem.catalogItem` lookup in a single
// request into one SELECT … IN (...). Tenant scope baked in at
// build time so caller code can't accidentally cross tenants.

import DataLoader from 'dataloader';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GraphQLError } from 'graphql';

import type { CatalogItemRow } from '../types/catalog-item.js';

export function buildCatalogItemLoader(input: {
  supabase: SupabaseClient;
  tenantId: string;
}): DataLoader<string, CatalogItemRow | null> {
  return new DataLoader<string, CatalogItemRow | null>(async (ids) => {
    const idList = ids as readonly string[];
    const { data, error } = await input.supabase
      .from('uim_catalog_items')
      .select('id, sku, part_number, title, category, unit_of_measure, is_serialized, attributes')
      .eq('tenant_id', input.tenantId)
      .in('id', idList as string[]);
    if (error) {
      throw new GraphQLError(`catalog item batch fetch failed: ${error.message}`, {
        extensions: { code: 'UIM_CATALOG_BATCH_ERROR' },
      });
    }
    const byId = new Map<string, CatalogItemRow>();
    for (const row of (data ?? []) as CatalogItemRow[]) {
      byId.set(String(row.id), row);
    }
    return idList.map((id) => byId.get(String(id)) ?? null);
  });
}
