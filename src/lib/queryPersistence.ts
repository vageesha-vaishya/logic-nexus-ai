/**
 * TanStack Query persistence adapter + persister setup (Phase 1 Addendum T24d).
 *
 * The mobile shell needs read-only offline access to recent data —
 * portfolio tiers, risk profile, last-fetched signals, and the most-recent
 * diagnostic / risk-score snapshots. We persist the React Query cache to
 * Capacitor Preferences, which on Android maps to
 * `EncryptedSharedPreferences` (AES-256 backed by the device keystore) and
 * on web falls through to `localStorage`.
 *
 * Architecture choices:
 *
 *   • AsyncStorage shape — we expose `getItem` / `setItem` / `removeItem`
 *     so `createAsyncStoragePersister` works the same on web + native.
 *   • Single bucket — persisted under a single Preferences key
 *     (`logic-nexus.query-cache.v1`); the buster (v1) lets us invalidate
 *     all clients after a breaking schema change without DB migrations.
 *   • No serializer override — the default JSON serialiser handles
 *     TanStack Query's dehydrated state. If we add Date / BigInt support
 *     later we can drop in `superjson`.
 *   • Per-query whitelist (see `shouldDehydrateQuery` in App.tsx).
 *
 * Mutations are NOT persisted — addendum §2 explicitly forbids queued
 * offline mutations. The mutation cache is created fresh on every cold
 * start; only the query cache survives.
 */
import { Preferences } from "@capacitor/preferences";
import {
  createAsyncStoragePersister,
  type AsyncStorage,
} from "@tanstack/query-async-storage-persister";

const PERSIST_KEY = "logic-nexus.query-cache.v1";

/**
 * Capacitor Preferences wrapped to look like the AsyncStorage interface
 * TanStack Query expects. The plugin's `get` returns `{ value: string | null }`
 * so we destructure into a flat string-or-null result.
 *
 * Errors from the plugin (e.g. quota exceeded on a tiny device, or the
 * plugin not being installed in jsdom tests) collapse to a benign
 * "nothing to restore" state by returning null / undefined. Persistence
 * is best-effort; the app must work without it.
 */
export const capacitorAsyncStorage: AsyncStorage<string> = {
  async getItem(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch {
      /* best-effort — never throw */
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch {
      /* best-effort */
    }
  },
};

/**
 * The persister used by PersistQueryClientProvider. We throttle to one
 * write per second so a chatty signal feed doesn't hammer Preferences
 * (which round-trips to native IO on Android).
 */
export const queryPersister = createAsyncStoragePersister({
  storage: capacitorAsyncStorage,
  key:     PERSIST_KEY,
  throttleTime: 1_000,
});

// ── Query key whitelist ──────────────────────────────────────────────────────
//
// Only retail-facing read queries persist. Trading/order paths
// (`useBrokerConnections`, `useConnectionOrders`, etc.) are excluded —
// stale broker data presented as fresh would be actively dangerous.
//
// Each entry is matched as a prefix on the query key tuple. The shape of
// our marketsKeys factory means `[markets, retail, profile]` etc., so a
// 2-element prefix like ['markets','retail','profile'] catches all
// variants below it.

const OFFLINE_WHITELIST_PREFIXES: ReadonlyArray<ReadonlyArray<string>> = [
  ["markets", "retail", "profile"],
  ["markets", "retail", "tiers"],
  ["markets", "retail", "starter-templates"],
  ["markets", "retail", "risk-score"],
  ["markets", "retail", "rebalance"],
  ["markets", "retail", "signals"],
  ["markets", "retail", "behavioral", "events"],
  ["markets", "portfolios", "list"],  // PortfolioTierView's underlying portfolios
];

/**
 * Returns true when the given query key should survive a reload. Used as
 * `dehydrateOptions.shouldDehydrateQuery` on the PersistQueryClientProvider.
 *
 * Exported for unit tests so we can pin the whitelist contract.
 */
export function shouldPersistQuery(queryKey: ReadonlyArray<unknown>): boolean {
  return OFFLINE_WHITELIST_PREFIXES.some((prefix) => {
    if (queryKey.length < prefix.length) return false;
    for (let i = 0; i < prefix.length; i++) {
      if (queryKey[i] !== prefix[i]) return false;
    }
    return true;
  });
}
