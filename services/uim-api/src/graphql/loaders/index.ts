// Phase 7 UIM Step 8.2 — per-request loader registry.
//
// Loaders MUST be per-request (built fresh in the yoga context()
// factory) so they don't leak data across tenants or stale across
// requests. The registry shape lets us add loaders incrementally
// — each slice that needs a new batch-read drops one in.

import type { SupabaseClient } from '@supabase/supabase-js';
import type DataLoader from 'dataloader';

import { buildCatalogItemLoader } from './catalog-item.loader.js';
import { buildActiveReservationsByInventoryLoader } from './reservations-by-inventory.loader.js';
import { buildRecentLedgerByInventoryLoader } from './recent-ledger-by-inventory.loader.js';

import type { CatalogItemRow } from '../types/catalog-item.js';
import type { ReservationRow } from '../types/reservation.js';
import type { LedgerEntryRow } from '../types/ledger-entry.js';

export type Loaders = {
  catalogItem: DataLoader<string, CatalogItemRow | null>;
  activeReservationsByInventory: DataLoader<string, ReservationRow[]>;
  recentLedgerByInventory: DataLoader<string, LedgerEntryRow[]>;
};

export function buildLoaders(input: {
  supabase: SupabaseClient;
  tenantId: string;
}): Loaders {
  return {
    catalogItem: buildCatalogItemLoader(input),
    activeReservationsByInventory: buildActiveReservationsByInventoryLoader(input),
    recentLedgerByInventory: buildRecentLedgerByInventoryLoader(input),
  };
}
